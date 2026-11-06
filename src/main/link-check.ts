/**
 * Checks links to other sites, on request (it reaches out to every site linked to).
 * Only clear failures are reported: 404/410, and sites that aren't there (no such
 * domain, connection refused, a broken certificate). Sites that turn automated checks
 * away (403, 429, LinkedIn's 999), slow ones and server errors are taken as working:
 * a person following the link may well get through.
 */

const TIMEOUT = 10_000
const PARALLEL = 6
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; CraftPages link check; +https://craftpages.app)',
  Accept: 'text/html,*/*;q=0.8'
}

const GONE = new Set([404, 410])

function failure(error: unknown): string | null {
  const cause = (error as { cause?: { code?: string } }).cause
  const code = cause?.code ?? ''
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'site not found'
  if (code === 'ECONNREFUSED') return 'connection refused'
  if (/CERT|SSL|TLS/.test(code)) return 'certificate problem'
  return null
}

async function request(url: string, method: 'HEAD' | 'GET'): Promise<number> {
  const response = await fetch(url, {
    method,
    redirect: 'follow',
    headers: HEADERS,
    signal: AbortSignal.timeout(TIMEOUT)
  })
  await response.body?.cancel().catch(() => null)
  return response.status
}

/** null: works (or couldn't tell); otherwise why it doesn't. */
async function checkOne(url: string): Promise<string | null> {
  try {
    let status = await request(url, 'HEAD')
    // Some servers answer HEAD badly; ask again the way a browser does.
    if (status >= 400) status = await request(url, 'GET')
    return GONE.has(status) ? String(status) : null
  } catch (error) {
    return failure(error)
  }
}

export async function checkLinks(
  urls: string[],
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>()
  let next = 0
  let done = 0
  const worker = async (): Promise<void> => {
    while (next < urls.length) {
      const url = urls[next++]
      results.set(url, await checkOne(url))
      onProgress?.(++done, urls.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, urls.length) }, worker))
  return results
}
