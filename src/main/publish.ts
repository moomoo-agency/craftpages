import * as cloudflare from './deploy/cloudflare'
import * as server from './deploy/server'
import * as workers from './deploy/workers'
import { isSyncOn, syncNow } from './sync/engine'
import { createSnapshot } from './sync/snapshots'
import { listFiles } from './workspace'
import { refreshSearch } from './search-site'
import { writeSitemap } from './seo-site'
import { connectionById, getSiteSettings, trustHostKey } from './settings'
import { broadcast, getWorkspace } from './state'
import type {
  AppEvent,
  Deployment,
  DeployResult,
  DeployTarget,
  ForeignDeploy
} from '../shared/types'

let deploying: string | null = null

export const isDeploying = (): boolean => deploying !== null

/** A project's deploy connection (each project can deploy to a different account). */
export async function credentialsFor(root: string): Promise<cloudflare.Credentials> {
  const { deploy } = await getSiteSettings(root)
  const { accountId, token } = await connectionById(deploy.connection)
  return { accountId, token }
}

/** The project's server connection, checked to be FTP / SFTP. */
async function serverConnection(root: string): Promise<server.ServerConnection> {
  const { deploy } = await getSiteSettings(root)
  const connection = await connectionById(deploy.connection)
  if (connection.type !== 'ftp' && connection.type !== 'sftp')
    throw new Error(
      'This project publishes to a server: choose an FTP or SFTP connection in Project settings → Deploy.'
    )
  return connection
}

/** SFTP: the first key a server shows is remembered, and must match from then on. */
const trust =
  (connection: server.ServerConnection) =>
  (key: string): void => {
    trustHostKey(connection.id, key).catch(() => null)
  }

/**
 * The version live in production now, when this folder didn't put it there: someone
 * published from another computer, with wrangler, or from the Cloudflare dashboard.
 * Publishing over it would replace their changes, since Cloudflare can't give files back.
 */
export async function checkLive(root: string): Promise<ForeignDeploy | null> {
  const site = await getSiteSettings(root)
  if (site.deploy.target === 'server') {
    const connection = await serverConnection(root)
    const state = await cloudflare.readState(root)
    return server.foreignOnServer(
      await server.liveServerState(connection, site, trust(connection)),
      (id) => cloudflare.publishedHere(state, id)
    )
  }
  const creds = await credentialsFor(root)
  const live =
    site.deploy.target === 'workers'
      ? site.deploy.workerName
        ? await workers.liveWorkerDeployment(creds, site.deploy.workerName)
        : null
      : site.deploy.projectName
        ? await cloudflare.liveDeployment(creds, site.deploy.projectName)
        : null
  if (!live) return null
  return cloudflare.publishedHere(await cloudflare.readState(root), live.id) ? null : live
}

/**
 * Deploys a project: refreshes the sitemap (when automatic) and the search
 * index first. One deploy at a time, from the Publish screen or the scheduler.
 * Progress is shown only for the open project.
 *
 * A production deploy stops when the live version wasn't published from this folder,
 * unless `force` is set (the user saw the warning and chose to publish anyway). The
 * scheduler never forces.
 */
export async function deployProject(
  root: string,
  target: DeployTarget,
  force = false
): Promise<DeployResult> {
  if (deploying) throw new Error('A deploy is already running')
  deploying = root
  const report = (progress: Extract<AppEvent, { type: 'deploy' }>): void => {
    if (getWorkspace()?.root === root) broadcast(progress)
  }
  try {
    // With sync on, publish on top of what the other computers have, never over it.
    const synced = target === 'production' && (await isSyncOn(root))
    if (synced) {
      report({
        type: 'deploy',
        progress: { phase: 'scan', message: 'Syncing with your other computers…' }
      })
      const sync = await syncNow(root)
      if (sync.conflicts.length)
        throw new Error(
          `Not published: ${sync.conflicts.length} file(s) were changed both here and on ${sync.from ?? 'another computer'} ` +
            `(${sync.conflicts.slice(0, 3).join(', ')}${sync.conflicts.length > 3 ? '…' : ''}). ` +
            'Check them in Project settings → Sync, then publish again.'
        )
    }
    if ((await getSiteSettings(root)).seo.sitemapAuto) await writeSitemap(root)
    await refreshSearch(root)
    const site = await getSiteSettings(root)
    const onProgress = (progress: Parameters<typeof report>[0]['progress']): void =>
      report({ type: 'deploy', progress })
    if (site.deploy.target !== 'pages' && target === 'preview')
      throw new Error(
        'Preview deploys are for Pages projects for now. Publish to production instead.'
      )
    if (target === 'production' && !force) {
      const foreign = await checkLive(root)
      if (foreign && !foreign.createdOn)
        throw new Error(
          `Not published: the server folder already has files that CraftPages didn’t put there. ` +
            'Publishing could overwrite them. Publish from the Publish screen and choose “Publish anyway”, ' +
            'or pick an empty folder in Project settings → Deploy.'
        )
      if (foreign)
        throw new Error(
          `Not published: the live site was published from somewhere else on ${new Date(foreign.createdOn).toLocaleString()}` +
            `${foreign.source ? ` (${foreign.source})` : ''}. Publishing would replace it with this folder, ` +
            'and changes made there would be lost. Get the latest files into this folder first, ' +
            'or publish from the Publish screen and choose “Publish anyway”.'
        )
    }
    let result: DeployResult
    if (site.deploy.target === 'server') {
      const connection = await serverConnection(root)
      result = await server.deployServer(root, site, connection, onProgress, trust(connection))
    } else
      result =
        site.deploy.target === 'workers'
          ? await workers.deployWorker(root, site, await credentialsFor(root), onProgress)
          : await cloudflare.deployPages(root, site, await credentialsFor(root), target, onProgress)
    if (target === 'production') {
      await cloudflare.rememberPublished(root, result.id)
      await recordVersion(root, site, result)
      // The other computers learn about this publish right away.
      if (synced) await syncNow(root).catch(() => null)
    }
    return result
  } catch (error) {
    report({ type: 'deploy', progress: { phase: 'error', message: (error as Error).message } })
    throw error
  } finally {
    deploying = null
  }
}

/**
 * Keeps what was just published as a version (Publish → History). A failure here never
 * fails the publish: the site is live either way.
 */
async function recordVersion(
  root: string,
  site: Awaited<ReturnType<typeof getSiteSettings>>,
  result: DeployResult
): Promise<void> {
  try {
    const published = new Set(
      (
        await cloudflare.publishedFiles(root, site, { server: site.deploy.target === 'server' })
      ).map((file) => file.path)
    )
    const unpublished = (await listFiles(root))
      .map((file) => file.path)
      .filter((path) => !published.has(path))
    const where =
      site.deploy.target === 'server'
        ? `${(await connectionById(site.deploy.connection)).host}${site.deploy.remoteDir ? ` · ${site.deploy.remoteDir}` : ''}`
        : site.deploy.target === 'workers'
          ? `Worker ${site.deploy.workerName}`
          : `Pages ${site.deploy.projectName}`
    await createSnapshot(root, {
      kind: 'publish',
      label: `Published to ${where}`,
      unpublished,
      deploy: { target: site.deploy.target, id: result.id, url: result.url, where }
    })
  } catch (error) {
    console.error('Could not record the published version:', error)
  }
}

/** The project's recent deployments, newest first. */
export async function listDeploymentsFor(root: string): Promise<Deployment[]> {
  const site = await getSiteSettings(root)
  if (site.deploy.target === 'server') {
    const connection = await serverConnection(root)
    const { manifest } = await server.liveServerState(connection, site, trust(connection))
    return server.serverDeployments(manifest, site)
  }
  const creds = await credentialsFor(root)
  if (site.deploy.target === 'workers') {
    if (!site.deploy.workerName) throw new Error('Choose a Worker in Project settings first.')
    return workers.listWorkerDeployments(creds, site.deploy.workerName).catch((error: Error) => {
      // A Worker that hasn't been published yet has no deployments.
      if (/not found|does not exist|10007/i.test(error.message)) return []
      throw error
    })
  }
  if (!site.deploy.projectName)
    throw new Error('Choose a Cloudflare Pages project in Project settings first.')
  return cloudflare.listDeployments(creds, site.deploy.projectName)
}

/** Puts an earlier deployment back in production. */
export async function rollbackFor(root: string, id: string): Promise<void> {
  const site = await getSiteSettings(root)
  if (site.deploy.target === 'server')
    throw new Error('Rolling back on a server isn’t available yet.')
  const creds = await credentialsFor(root)
  if (site.deploy.target === 'workers')
    await workers.rollbackWorker(creds, site.deploy.workerName, id)
  else await cloudflare.rollback(creds, site.deploy.projectName, id)
  // Rolling back here is this folder's choice, so that version counts as published from here.
  await cloudflare.rememberPublished(root, id)
}
