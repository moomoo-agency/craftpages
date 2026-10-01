import { getWorkspace } from '../state'
import { startStaticServer, type StaticServer } from '../preview/server'
import { getProposal, onDecision } from './proposals'

/**
 * One throwaway static server per proposal, serving the site as it would look
 * after the proposal is accepted. Closed once the proposal is decided.
 */
const servers = new Map<string, Promise<StaticServer>>()

onDecision((proposal) => {
  const server = servers.get(proposal.id)
  servers.delete(proposal.id)
  server?.then((s) => s.close()).catch(() => {})
})

export async function proposalPreviewUrl(id: string, path: string): Promise<string> {
  const proposal = getProposal(id)
  let server = servers.get(id)
  if (!server) {
    const overlay = new Map(proposal.files.map((file) => [file.path, file.after]))
    server = startStaticServer({ getRoot: () => getWorkspace()?.root ?? null, overlay })
    servers.set(id, server)
  }
  const { origin } = await server
  return `${origin}/${encodeURI(path.replace(/^\/+/, '').replace(/(^|\/)index\.html$/, '$1'))}`
}
