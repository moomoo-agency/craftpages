import { blake3 } from '@noble/hashes/blake3.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'
import { createHash } from 'crypto'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { extname, join } from 'path'
import { APP_DIR } from '../settings'
import { contentType } from '../preview/server'
import { listFiles, type FileEntry } from '../workspace'
import { excluder } from './exclude'
import type {
  CloudflareProject,
  DeployProgress,
  DeployResult,
  DeployStatus,
  DeployTarget,
  Deployment,
  ForeignDeploy,
  SiteSettings
} from '../../shared/types'

const API = 'https://api.cloudflare.com/client/v4'
const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_BUCKET_BYTES = 40 * 1024 * 1024
const MAX_BUCKET_FILES = 1000
const UPLOAD_CONCURRENCY = 3

/** Files Pages reads as configuration rather than serving as assets. */
export const CONFIG_FILES = new Set(['_headers', '_redirects'])
/** Pages Functions / advanced mode: not supported by this uploader. */
const UNSUPPORTED = new Set(['_routes.json', '_worker.js'])

export interface Credentials {
  accountId: string
  token: string
}

interface ApiResponse<T> {
  success: boolean
  errors?: { code: number; message: string }[]
  result: T
  result_info?: {
    page?: number
    per_page?: number
    count?: number
    total_count?: number
    total_pages?: number
  }
}

/**
 * Whether the token reaches R2 storage, which sync between computers needs (publishing
 * doesn't): 'disabled' = the account hasn't turned R2 on yet.
 */
export async function r2Access(creds: Credentials): Promise<'ok' | 'missing' | 'disabled'> {
  try {
    await call(creds.token, `/accounts/${encodeURIComponent(creds.accountId)}/r2/buckets`)
    return 'ok'
  } catch (error) {
    const message = (error as Error).message
    if (/10042|enable R2|not enabled|purchase/i.test(message)) return 'disabled'
    return 'missing'
  }
}

export async function call<T>(auth: string, url: string, init: RequestInit = {}): Promise<T> {
  return (await request<T>(auth, url, init)).result
}

export async function request<T>(
  auth: string,
  url: string,
  init: RequestInit = {}
): Promise<ApiResponse<T>> {
  const response = await fetch(url.startsWith('http') ? url : API + url, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth}`,
      ...(init.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...init.headers
    }
  })
  let json: ApiResponse<T>
  try {
    json = (await response.json()) as ApiResponse<T>
  } catch {
    throw new Error(`Cloudflare API: HTTP ${response.status}`)
  }
  if (!response.ok || !json.success) {
    const errors = json.errors
      ?.map((error) => (error.code ? `${error.message} (${error.code})` : error.message))
      .join('; ')
    // 403 / 10000 / "No access": the token lacks a permission, which the raw message doesn't say.
    const denied =
      response.status === 403 ||
      json.errors?.some(
        (error) => error.code === 10000 || /no access|not authorized/i.test(error.message)
      )
    const hint = denied
      ? ` The API token is missing a permission for this: it needs Account · ${
          url.includes('/r2/')
            ? 'Workers R2 Storage'
            : url.includes('/workers/')
              ? 'Workers Scripts'
              : 'Cloudflare Pages'
        } · Edit on this account (Cloudflare → My Profile → API Tokens).`
      : ''
    throw new Error(`Cloudflare API: ${errors || `HTTP ${response.status}`}.${hint}`)
  }
  return json
}

/**
 * Every item of a list endpoint, page by page. No `per_page`: Cloudflare's
 * limits differ per endpoint and it rejects values above them (error 8000024).
 */
export async function callAll<T>(auth: string, url: string, maxPages = 50): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; page <= maxPages; page++) {
    const { result, result_info: info } = await request<T[]>(
      auth,
      `${url}${url.includes('?') ? '&' : '?'}page=${page}`
    )
    items.push(...result)
    const total =
      info?.total_pages ??
      (info?.total_count !== undefined && info.per_page
        ? Math.ceil(info.total_count / info.per_page)
        : undefined)
    if (!result.length || (total !== undefined ? page >= total : true)) break
  }
  return items
}

const projectPath = (creds: Credentials, project: string): string =>
  `/accounts/${encodeURIComponent(creds.accountId)}/pages/projects/${encodeURIComponent(project)}`

// ---------- Projects & deployments ----------

interface RawProject {
  name: string
  subdomain: string
  production_branch: string
  domains?: string[]
}

const toProject = (raw: RawProject): CloudflareProject => ({
  name: raw.name,
  subdomain: raw.subdomain,
  productionBranch: raw.production_branch,
  domains: raw.domains ?? []
})

export async function listProjects(creds: Credentials): Promise<CloudflareProject[]> {
  const raw = await callAll<RawProject>(
    creds.token,
    `/accounts/${encodeURIComponent(creds.accountId)}/pages/projects`
  )
  return raw.map(toProject)
}

export async function createProject(
  creds: Credentials,
  name: string,
  productionBranch: string
): Promise<CloudflareProject> {
  if (!/^[a-z0-9][a-z0-9-]{0,56}[a-z0-9]$/.test(name)) {
    throw new Error('Project names use lowercase letters, digits and dashes (2–58 characters).')
  }
  const raw = await call<RawProject>(
    creds.token,
    `/accounts/${encodeURIComponent(creds.accountId)}/pages/projects`,
    { method: 'POST', body: JSON.stringify({ name, production_branch: productionBranch }) }
  )
  return toProject(raw)
}

interface RawDeployment {
  id: string
  url: string
  environment: string
  created_on: string
  aliases?: string[] | null
  deployment_trigger?: { metadata?: { branch?: string } }
  latest_stage?: { name: string; status: string }
}

export async function listDeployments(creds: Credentials, project: string): Promise<Deployment[]> {
  const raw = await call<RawDeployment[]>(
    creds.token,
    // The first page (newest first) is enough for the list and rollback.
    `${projectPath(creds, project)}/deployments`
  )
  return raw.map((d) => ({
    id: d.id,
    url: d.url,
    environment: d.environment,
    branch: d.deployment_trigger?.metadata?.branch ?? '',
    createdOn: d.created_on,
    status: d.latest_stage ? `${d.latest_stage.name}: ${d.latest_stage.status}` : '',
    aliases: d.aliases ?? []
  }))
}

interface RawLiveProject {
  canonical_deployment?: {
    id: string
    created_on: string
    deployment_trigger?: { type?: string }
  } | null
}

/** The deployment a Pages project serves in production now, or null when it has none. */
export async function liveDeployment(
  creds: Credentials,
  project: string
): Promise<ForeignDeploy | null> {
  try {
    const raw = await call<RawLiveProject>(creds.token, projectPath(creds, project))
    const live = raw.canonical_deployment
    if (!live) return null
    return {
      id: live.id,
      createdOn: live.created_on,
      source: live.deployment_trigger?.type ?? '',
      author: ''
    }
  } catch (error) {
    // A project that doesn't exist yet has nothing live.
    if (/not found|8000007/i.test((error as Error).message)) return null
    throw error
  }
}

export async function rollback(
  creds: Credentials,
  project: string,
  deploymentId: string
): Promise<void> {
  await call(
    creds.token,
    `${projectPath(creds, project)}/deployments/${encodeURIComponent(deploymentId)}/rollback`,
    {
      method: 'POST'
    }
  )
}

// ---------- Files & hashes ----------

export interface SiteFile {
  path: string
  hash: string
  bytes: number
}

/** The hash Pages uses to dedupe assets (same as wrangler): blake3(base64 + extension), 32 hex chars. */
function assetHash(content: Buffer, path: string): string {
  return bytesToHex(blake3(utf8ToBytes(content.toString('base64') + extname(path).slice(1)))).slice(
    0,
    32
  )
}

/**
 * The files a publish sends. On a server (`server: true`) Apache's .htaccess files go too
 * and Cloudflare's _headers / _redirects stay behind.
 */
export async function publishedFiles(
  root: string,
  site: SiteSettings,
  { server = false }: { server?: boolean } = {}
): Promise<FileEntry[]> {
  const excluded = excluder(site.deploy.exclude)
  return (await listFiles(root)).filter((file) => {
    if (excluded(file.path)) return false
    // Cloudflare's config files mean nothing to a server (it uses .htaccess); left out there.
    if (server ? CONFIG_FILES.has(file.path) : UNSUPPORTED.has(file.path)) return false
    // Dot-files are private unless they are under .well-known (or .htaccess on a server).
    return !file.path
      .split('/')
      .some(
        (part) =>
          part.startsWith('.') && part !== '.well-known' && !(server && part === '.htaccess')
      )
  })
}

/** The files a publish sends, with their hashes (and, on Cloudflare, its 25 MiB cap). */
export async function collect(
  root: string,
  site: SiteSettings,
  { server = false }: { server?: boolean } = {}
): Promise<SiteFile[]> {
  const files = await publishedFiles(root, site, { server })
  const out: SiteFile[] = []
  for (const file of files) {
    if (!server && file.bytes > MAX_FILE_BYTES)
      throw new Error(`${file.path} is over Cloudflare's 25 MiB file limit`)
    const content = await readFile(join(root, file.path))
    out.push({
      path: file.path,
      bytes: file.bytes,
      // A server only needs to tell versions apart: native SHA-256 is far faster than BLAKE3.
      hash: server
        ? createHash('sha256').update(content).digest('hex').slice(0, 32)
        : assetHash(content, file.path)
    })
  }
  return out
}

// ---------- Deploy state ----------

export interface DeployState {
  lastDeploy: DeployStatus['lastDeploy']
  files: Record<string, string>
  /**
   * Live versions (Worker version or Pages deployment ids) that this folder put in
   * production, by publishing or rolling back, newest last. Anything else that is live was
   * published from somewhere else.
   */
  published?: string[]
}

const stateFile = (root: string): string => join(root, APP_DIR, 'deploy-state.json')

export async function readState(root: string): Promise<DeployState> {
  try {
    return JSON.parse(await readFile(stateFile(root), 'utf8')) as DeployState
  } catch {
    return { lastDeploy: null, files: {} }
  }
}

/** Remembers what was deployed, so the next deploy can say what changed. */
export async function saveState(
  root: string,
  files: SiteFile[],
  deployed: { id: string; url: string; branch: string }
): Promise<void> {
  const state: DeployState = {
    lastDeploy: { ...deployed, at: new Date().toISOString() },
    files: Object.fromEntries(files.map((file) => [file.path, file.hash])),
    published: (await readState(root)).published
  }
  await mkdir(join(root, APP_DIR), { recursive: true })
  await writeFile(stateFile(root), JSON.stringify(state, null, 2))
}

/** Records a version this folder put live (after a production publish or a rollback). */
export async function rememberPublished(root: string, id: string): Promise<void> {
  const state = await readState(root)
  const published = [...(state.published ?? []).filter((known) => known !== id), id].slice(-100)
  await mkdir(join(root, APP_DIR), { recursive: true })
  await writeFile(stateFile(root), JSON.stringify({ ...state, published }, null, 2))
}

/** Whether this folder put that version live. Folders from before the list fall back to the last deploy. */
export function publishedHere(state: DeployState, id: string): boolean {
  return state.published ? state.published.includes(id) : state.lastDeploy?.id === id
}

export async function deployStatus(root: string, site: SiteSettings): Promise<DeployStatus> {
  const [files, state] = await Promise.all([
    collect(root, site, { server: site.deploy.target === 'server' }),
    readState(root)
  ])
  const current = new Map(files.map((file) => [file.path, file.hash]))
  const changedPaths = [
    ...files.filter((file) => state.files[file.path] !== file.hash).map((file) => file.path),
    ...Object.keys(state.files).filter((path) => !current.has(path))
  ]
  const changedPages = changedPaths
    .map((path) => path.replace(/^\/+/, ''))
    .filter((path) => /\.html?$/i.test(path))
    .sort()
  return {
    files: files.length,
    changed: changedPaths.length,
    changedPages,
    lastDeploy: state.lastDeploy
  }
}

// ---------- Deploy ----------

export async function inBatches<T>(
  items: T[],
  concurrency: number,
  run: (item: T) => Promise<void>
): Promise<void> {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) await run(items[next++])
    })
  )
}

/**
 * Direct upload to Cloudflare Pages: hash every file, ask which hashes the
 * account doesn't have yet, upload only those, then create a deployment from
 * the full `path → hash` manifest. `_headers` / `_redirects` go along as config.
 */
export async function deployPages(
  root: string,
  site: SiteSettings,
  creds: Credentials,
  target: DeployTarget,
  onProgress: (progress: DeployProgress) => void
): Promise<DeployResult> {
  const project = site.deploy.projectName
  if (!project) throw new Error('Choose a Cloudflare Pages project in Project settings first.')
  const branch = target === 'production' ? site.deploy.productionBranch : site.deploy.previewBranch

  onProgress({ phase: 'scan', message: 'Hashing site files…' })
  const files = await collect(root, site)
  const assets = files.filter((file) => !CONFIG_FILES.has(file.path))

  onProgress({ phase: 'check', message: 'Checking what Cloudflare already has…' })
  const { jwt } = await call<{ jwt: string }>(
    creds.token,
    `${projectPath(creds, project)}/upload-token`
  )
  const hashes = [...new Set(assets.map((file) => file.hash))]
  const missing = new Set(
    await call<string[]>(jwt, '/pages/assets/check-missing', {
      method: 'POST',
      body: JSON.stringify({ hashes })
    })
  )

  const toUpload = [
    ...new Map(
      assets.filter((file) => missing.has(file.hash)).map((file) => [file.hash, file])
    ).values()
  ]
  const buckets: SiteFile[][] = []
  let bucket: SiteFile[] = []
  let bucketBytes = 0
  for (const file of toUpload) {
    const size = Math.ceil(file.bytes / 3) * 4
    if (
      bucket.length > 0 &&
      (bucketBytes + size > MAX_BUCKET_BYTES || bucket.length >= MAX_BUCKET_FILES)
    ) {
      buckets.push(bucket)
      bucket = []
      bucketBytes = 0
    }
    bucket.push(file)
    bucketBytes += size
  }
  if (bucket.length > 0) buckets.push(bucket)

  let uploaded = 0
  onProgress({
    phase: 'upload',
    message: `Uploading ${toUpload.length} new files…`,
    done: 0,
    total: toUpload.length
  })
  await inBatches(buckets, UPLOAD_CONCURRENCY, async (group) => {
    const payload = await Promise.all(
      group.map(async (file) => ({
        key: file.hash,
        value: (await readFile(join(root, file.path))).toString('base64'),
        metadata: { contentType: contentType(file.path).split(';')[0] },
        base64: true
      }))
    )
    await call(jwt, '/pages/assets/upload', { method: 'POST', body: JSON.stringify(payload) })
    uploaded += group.length
    onProgress({
      phase: 'upload',
      message: `Uploaded ${uploaded} of ${toUpload.length}`,
      done: uploaded,
      total: toUpload.length
    })
  })
  await call(jwt, '/pages/assets/upsert-hashes', {
    method: 'POST',
    body: JSON.stringify({ hashes })
  })

  onProgress({ phase: 'deploy', message: `Creating ${target} deployment on “${branch}”…` })
  const manifest = Object.fromEntries(assets.map((file) => [`/${file.path}`, file.hash]))
  const form = new FormData()
  form.append('manifest', JSON.stringify(manifest))
  form.append('branch', branch)
  form.append('commit_message', `CraftPages · ${new Date().toISOString()}`)
  form.append('commit_dirty', 'true')
  for (const name of CONFIG_FILES) {
    if (files.some((file) => file.path === name)) {
      form.append(name, new Blob([await readFile(join(root, name))]), name)
    }
  }
  const deployment = await call<{ id: string; url: string }>(
    creds.token,
    `${projectPath(creds, project)}/deployments`,
    {
      method: 'POST',
      body: form
    }
  )

  await saveState(root, files, { id: deployment.id, url: deployment.url, branch })

  onProgress({ phase: 'done', message: `Deployed: ${deployment.url}` })
  return { id: deployment.id, url: deployment.url, uploaded: toUpload.length, total: files.length }
}
