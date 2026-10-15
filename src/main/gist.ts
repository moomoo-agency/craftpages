import type { Gist } from '../shared/types'

/**
 * GitHub Gists for the Gist block. The editor fetches a gist once, through here (the
 * renderer may not reach the network), and the block saves the code as static HTML, so
 * published pages never load GitHub's embed script.
 */

const API = 'https://api.github.com/gists'
const TIMEOUT = 15_000

/**
 * gist.github.com/<user>/<id>[/<revision>], the raw-file form, or a bare id
 * (old gists have numeric ids).
 */
export function parseGistUrl(url: string): { id: string; revision?: string } | null {
  const text = url.trim()
  const bare = text.match(/^(\d+|[0-9a-f]{20,40})$/i)
  if (bare) return { id: bare[1].toLowerCase() }
  const match = text.match(
    /^(?:https?:\/\/)?gist\.(?:github|githubusercontent)\.com\/(?:[\w-]+\/)?([0-9a-f]{4,40})(?:\/(?:raw\/)?([0-9a-f]{40}))?/i
  )
  return match ? { id: match[1].toLowerCase(), revision: match[2]?.toLowerCase() } : null
}

async function get(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'CraftPages' },
    signal: AbortSignal.timeout(TIMEOUT)
  })
  if (response.ok) return response
  if (response.status === 404)
    throw new Error('GitHub has no gist at that link. Check the address, or the revision in it.')
  if (response.status === 403 || response.status === 429)
    throw new Error('GitHub is limiting requests from this network. Try again in a few minutes.')
  throw new Error(`GitHub answered ${response.status} ${response.statusText}.`)
}

interface ApiFile {
  filename: string
  language: string | null
  content?: string
  truncated?: boolean
  raw_url: string
}

export async function fetchGist(url: string): Promise<Gist> {
  const ref = parseGistUrl(url)
  if (!ref) throw new Error('That isn’t a GitHub Gist link (gist.github.com/…).')
  const data = (await (
    await get(`${API}/${ref.id}${ref.revision ? `/${ref.revision}` : ''}`)
  ).json()) as {
    html_url: string
    description: string | null
    owner?: { login: string }
    history?: { version: string }[]
    files: Record<string, ApiFile>
  }
  const files = await Promise.all(
    Object.values(data.files).map(async (file) => ({
      name: file.filename,
      language: file.language ?? '',
      // The API cuts content at 1 MB; the raw file has all of it.
      content:
        file.truncated || file.content === undefined
          ? await (await get(file.raw_url)).text()
          : file.content
    }))
  )
  return {
    id: ref.id,
    owner: data.owner?.login ?? '',
    revision: ref.revision ?? data.history?.[0]?.version ?? '',
    pinned: Boolean(ref.revision),
    url: data.html_url,
    description: data.description ?? '',
    files
  }
}
