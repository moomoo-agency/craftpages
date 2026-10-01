import * as cloudflare from './deploy/cloudflare'
import * as workers from './deploy/workers'
import { refreshSearch } from './search-site'
import { writeSitemap } from './seo-site'
import { connectionById, getSiteSettings } from './settings'
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

/**
 * The version live in production now, when this folder didn't put it there: someone
 * published from another computer, with wrangler, or from the Cloudflare dashboard.
 * Publishing over it would replace their changes, since Cloudflare can't give files back.
 */
export async function checkLive(root: string): Promise<ForeignDeploy | null> {
  const site = await getSiteSettings(root)
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
    if ((await getSiteSettings(root)).seo.sitemapAuto) await writeSitemap(root)
    await refreshSearch(root)
    const site = await getSiteSettings(root)
    const onProgress = (progress: Parameters<typeof report>[0]['progress']): void =>
      report({ type: 'deploy', progress })
    if (site.deploy.target === 'workers' && target === 'preview')
      throw new Error(
        'Preview deploys are for Pages projects for now. Publish to production instead.'
      )
    if (target === 'production' && !force) {
      const foreign = await checkLive(root)
      if (foreign)
        throw new Error(
          `Not published: the live site was published from somewhere else on ${new Date(foreign.createdOn).toLocaleString()}` +
            `${foreign.source ? ` (${foreign.source})` : ''}. Publishing would replace it with this folder, ` +
            'and changes made there would be lost. Get the latest files into this folder first, ' +
            'or publish from the Publish screen and choose “Publish anyway”.'
        )
    }
    const result =
      site.deploy.target === 'workers'
        ? await workers.deployWorker(root, site, await credentialsFor(root), onProgress)
        : await cloudflare.deployPages(root, site, await credentialsFor(root), target, onProgress)
    if (target === 'production') await cloudflare.rememberPublished(root, result.id)
    return result
  } catch (error) {
    report({ type: 'deploy', progress: { phase: 'error', message: (error as Error).message } })
    throw error
  } finally {
    deploying = null
  }
}

/** The project's recent deployments, newest first. */
export async function listDeploymentsFor(root: string): Promise<Deployment[]> {
  const site = await getSiteSettings(root)
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
  const creds = await credentialsFor(root)
  if (site.deploy.target === 'workers')
    await workers.rollbackWorker(creds, site.deploy.workerName, id)
  else await cloudflare.rollback(creds, site.deploy.projectName, id)
  // Rolling back here is this folder's choice, so that version counts as published from here.
  await cloudflare.rememberPublished(root, id)
}
