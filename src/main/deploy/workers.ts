import { createHash } from 'crypto'
import { readFile } from 'fs/promises'
import { extname, join } from 'path'
import { contentType } from '../preview/server'
import {
  call,
  collect,
  CONFIG_FILES,
  inBatches,
  request,
  saveState,
  type Credentials
} from './cloudflare'
import type {
  CloudflareWorker,
  Deployment,
  DeployProgress,
  DeployResult,
  ForeignDeploy,
  SiteSettings
} from '../../shared/types'

/**
 * Publishing a site as a Worker with static assets, Cloudflare's default for
 * new projects (https://developers.cloudflare.com/workers/static-assets/direct-upload/):
 *
 * 1. register the manifest (`/path → hash, size`); Cloudflare answers with the
 *    hashes it doesn't have yet, grouped in buckets, and an upload token
 * 2. upload each bucket (base64, one form field per hash)
 * 3. upload the Worker with the completion token; `_headers` and `_redirects`
 *    go in its asset config
 *
 * Only files the account doesn't already have are sent.
 */

/** Marks Workers CraftPages made, so it knows it may publish over them. */
const TAG = 'craftpages'
const COMPATIBILITY_DATE = '2025-09-01'
const UPLOAD_CONCURRENCY = 3

/** Used only if Cloudflare refuses a Worker made of files alone: serve the files, nothing else. */
const SERVE_ASSETS = 'export default { fetch(request, env) { return env.ASSETS.fetch(request) } }\n'

const account = (creds: Credentials): string => `/accounts/${encodeURIComponent(creds.accountId)}`
const scriptPath = (creds: Credentials, name: string): string =>
  `${account(creds)}/workers/scripts/${encodeURIComponent(name)}`

/** The hash from Cloudflare's direct-upload guide: sha256(base64 + extension), 32 hex chars. */
function workerHash(content: Buffer, path: string): string {
  return createHash('sha256')
    .update(content.toString('base64') + extname(path).slice(1))
    .digest('hex')
    .slice(0, 32)
}

// ---------- Workers in the account ----------

interface RawScript {
  id: string
  has_assets?: boolean
  has_modules?: boolean
  tags?: string[] | null
}

export async function listWorkers(creds: Credentials): Promise<CloudflareWorker[]> {
  const scripts = await call<RawScript[]>(creds.token, `${account(creds)}/workers/scripts`)
  return scripts
    .map((script): CloudflareWorker => {
      const ours = script.tags?.includes(TAG)
      const filesOnly = script.has_assets === true && script.has_modules === false
      return ours || filesOnly
        ? { name: script.id, usable: true }
        : {
            name: script.id,
            usable: false,
            reason: 'has its own code, which publishing would replace'
          }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The account's `*.workers.dev` subdomain, or null when it has none yet. */
async function accountSubdomain(creds: Credentials): Promise<string | null> {
  try {
    const { subdomain } = await call<{ subdomain: string }>(
      creds.token,
      `${account(creds)}/workers/subdomain`
    )
    return subdomain || null
  } catch {
    return null
  }
}

async function workerUrl(creds: Credentials, name: string): Promise<string> {
  const subdomain = await accountSubdomain(creds)
  return subdomain ? `https://${name}.${subdomain}.workers.dev` : ''
}

// ---------- Deploy ----------

interface UploadSession {
  jwt: string
  buckets?: string[][]
}

export async function deployWorker(
  root: string,
  site: SiteSettings,
  creds: Credentials,
  onProgress: (progress: DeployProgress) => void
): Promise<DeployResult> {
  const name = site.deploy.workerName
  if (!name) throw new Error('Choose or name a Worker in Project settings → Publishing first.')

  // Never replace someone's Worker code with a static site.
  const existing = (await listWorkers(creds)).find((worker) => worker.name === name)
  if (existing && !existing.usable) {
    throw new Error(
      `The Worker “${name}” ${existing.reason}. Pick another Worker, or type a new name to create one.`
    )
  }

  onProgress({ phase: 'scan', message: 'Hashing site files…' })
  const files = await collect(root, site)
  const assets = await Promise.all(
    files
      .filter((file) => !CONFIG_FILES.has(file.path))
      .map(async (file) => ({
        ...file,
        workerHash: workerHash(await readFile(join(root, file.path)), file.path)
      }))
  )

  onProgress({ phase: 'check', message: 'Checking what Cloudflare already has…' })
  const manifest = Object.fromEntries(
    assets.map((file) => [`/${file.path}`, { hash: file.workerHash, size: file.bytes }])
  )
  const session = await call<UploadSession>(
    creds.token,
    `${scriptPath(creds, name)}/assets-upload-session`,
    {
      method: 'POST',
      body: JSON.stringify({ manifest })
    }
  )

  // Nothing new: the session token already completes the upload.
  let completion = session.jwt
  const buckets = (session.buckets ?? []).filter((bucket) => bucket.length)
  const byHash = new Map(assets.map((file) => [file.workerHash, file]))
  const total = buckets.reduce((sum, bucket) => sum + bucket.length, 0)
  let uploaded = 0
  onProgress({ phase: 'upload', message: `Uploading ${total} new files…`, done: 0, total })
  await inBatches(buckets, UPLOAD_CONCURRENCY, async (bucket) => {
    const form = new FormData()
    for (const hash of bucket) {
      const file = byHash.get(hash)
      if (!file) throw new Error('Cloudflare asked for a file that is not in the site')
      const base64 = (await readFile(join(root, file.path))).toString('base64')
      form.append(
        hash,
        new File([base64], hash, { type: contentType(file.path).split(';')[0] }),
        hash
      )
    }
    const { result } = await request<{ jwt?: string }>(
      session.jwt,
      `${account(creds)}/workers/assets/upload?base64=true`,
      { method: 'POST', body: form }
    )
    // The response to the last bucket carries the completion token.
    if (result?.jwt) completion = result.jwt
    uploaded += bucket.length
    onProgress({
      phase: 'upload',
      message: `Uploaded ${uploaded} of ${total}`,
      done: uploaded,
      total
    })
  })

  onProgress({ phase: 'deploy', message: `Publishing the Worker “${name}”…` })
  const read = async (path: string): Promise<string | undefined> =>
    files.some((file) => file.path === path) ? await readFile(join(root, path), 'utf8') : undefined
  const config = {
    html_handling: 'auto-trailing-slash',
    // Like Pages: a 404.html is served for unknown addresses.
    not_found_handling: files.some((file) => file.path === '404.html') ? '404-page' : 'none',
    _headers: await read('_headers'),
    _redirects: await read('_redirects')
  }
  const metadata = {
    compatibility_date: COMPATIBILITY_DATE,
    assets: { jwt: completion, config },
    tags: [TAG]
  }
  try {
    await uploadScript(creds, name, metadata, false)
  } catch (error) {
    // Files alone weren't accepted: add the smallest script that serves them.
    if (!/module|script|main|entry/i.test((error as Error).message)) throw error
    await uploadScript(creds, name, metadata, true)
  }

  // Reachable at name.<account>.workers.dev (a custom domain can be added in Cloudflare).
  await call(creds.token, `${scriptPath(creds, name)}/subdomain`, {
    method: 'POST',
    body: JSON.stringify({ enabled: true, previews_enabled: false })
  }).catch(() => null)
  const url = await workerUrl(creds, name)

  const deployments = await listWorkerDeployments(creds, name).catch(() => [])
  const id = deployments[0]?.id ?? name
  await saveState(root, files, { id, url, branch: 'production' })
  onProgress({
    phase: 'done',
    message: url
      ? `Deployed: ${url}`
      : 'Deployed. The account has no workers.dev subdomain yet: add one, or a custom domain, in Cloudflare.'
  })
  return { id, url, uploaded: total, total: files.length }
}

async function uploadScript(
  creds: Credentials,
  name: string,
  metadata: Record<string, unknown>,
  withScript: boolean
): Promise<void> {
  const form = new FormData()
  form.append(
    'metadata',
    new Blob(
      [
        JSON.stringify(
          withScript
            ? {
                ...metadata,
                main_module: 'worker.js',
                bindings: [{ type: 'assets', name: 'ASSETS' }]
              }
            : metadata
        )
      ],
      { type: 'application/json' }
    )
  )
  if (withScript) {
    form.append(
      'worker.js',
      new File([SERVE_ASSETS], 'worker.js', { type: 'application/javascript+module' }),
      'worker.js'
    )
  }
  await call(creds.token, scriptPath(creds, name), { method: 'PUT', body: form })
}

// ---------- Deployments & rollback ----------

interface RawWorkerDeployment {
  id: string
  created_on: string
  source?: string
  author_email?: string
  strategy?: string
  versions: { version_id: string; percentage: number }[]
  annotations?: Record<string, string>
}

/** Newest first. Each entry's id is the version it serves, which is what a rollback needs. */
export async function listWorkerDeployments(
  creds: Credentials,
  name: string
): Promise<Deployment[]> {
  const { deployments } = await call<{ deployments: RawWorkerDeployment[] }>(
    creds.token,
    `${scriptPath(creds, name)}/deployments`
  )
  const url = await workerUrl(creds, name)
  return [...deployments]
    .sort((a, b) => b.created_on.localeCompare(a.created_on))
    .map((deployment) => ({
      id: deployment.versions[0]?.version_id ?? deployment.id,
      url,
      environment: 'production',
      branch: '',
      createdOn: deployment.created_on,
      status: deployment.annotations?.['workers/triggered_by'] ?? deployment.source ?? '',
      aliases: []
    }))
}

/** The version a Worker serves now, or null when it doesn't exist or has never been deployed. */
export async function liveWorkerDeployment(
  creds: Credentials,
  name: string
): Promise<ForeignDeploy | null> {
  try {
    const { deployments } = await call<{ deployments: RawWorkerDeployment[] }>(
      creds.token,
      `${scriptPath(creds, name)}/deployments`
    )
    const live = [...deployments].sort((a, b) => b.created_on.localeCompare(a.created_on))[0]
    if (!live) return null
    return {
      id: live.versions[0]?.version_id ?? live.id,
      createdOn: live.created_on,
      source: live.source ?? '',
      author: live.author_email ?? ''
    }
  } catch (error) {
    if (/not found|does not exist|10007/i.test((error as Error).message)) return null
    throw error
  }
}

export async function rollbackWorker(
  creds: Credentials,
  name: string,
  versionId: string
): Promise<void> {
  await call(creds.token, `${scriptPath(creds, name)}/deployments`, {
    method: 'POST',
    body: JSON.stringify({
      strategy: 'percentage',
      versions: [{ version_id: versionId, percentage: 100 }],
      annotations: { 'workers/message': 'Rollback from CraftPages' }
    })
  })
}
