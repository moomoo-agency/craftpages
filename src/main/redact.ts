/**
 * Keeps secrets out of the diagnostic log. Three layers: every secret the app holds is
 * registered and replaced wherever it appears; fields whose name says "secret" are
 * dropped; credentials in URLs and auth headers are scrubbed. No Electron imports, so
 * it can be tested with plain Node.
 */

const REDACTED = '[redacted]'

const secrets = new Set<string>()

/** Very short values would redact ordinary words; secrets the app uses are longer. */
export function registerSecret(value: unknown): void {
  if (typeof value === 'string' && value.trim().length >= 6) secrets.add(value.trim())
}

/** Registers every string inside a value (e.g. the decrypted keychain contents). */
export function registerSecrets(value: unknown): void {
  if (typeof value === 'string') registerSecret(value)
  else if (Array.isArray(value)) value.forEach(registerSecrets)
  else if (value && typeof value === 'object') Object.values(value).forEach(registerSecrets)
}

/** Field names whose values are never logged. `key` alone, or as a suffix of a secret name. */
const SECRET_FIELDS = new Set([
  'token',
  'password',
  'passphrase',
  'secret',
  'key',
  'apikey',
  'authorization',
  'cookie',
  'privatekey',
  'accesskeyid',
  'secretaccesskey',
  'credentials',
  'mcptoken'
])
const SECRET_PATTERN = /pass(word|phrase)?$|token$|secret|cookie|credential|private/i

export function isSecretField(name: string): boolean {
  const plain = name.replace(/[-_]/g, '').toLowerCase()
  return SECRET_FIELDS.has(plain) || SECRET_PATTERN.test(name)
}

function scrubString(text: string, home?: string): string {
  let out = text
  for (const secret of secrets) out = out.split(secret).join(REDACTED)
  out = out
    // scheme://user:pass@host
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, `$1${REDACTED}@`)
    .replace(/(authorization["']?\s*[:=]\s*["']?)[^\s"',}]+(\s+[^\s"',}]+)?/gi, `$1${REDACTED}`)
    .replace(/\bbearer\s+[\w.~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(/([?&](?:token|key|secret|password|sig|signature)=)[^&\s"']+/gi, `$1${REDACTED}`)
  if (home && home.length > 1) out = out.split(home).join('~')
  return out
}

function errorFields(error: Error, home?: string, depth = 0): Record<string, unknown> {
  const fields: Record<string, unknown> = { name: error.name, message: error.message }
  const code = (error as { code?: unknown }).code
  if (code !== undefined) fields.code = code
  if (error.stack)
    fields.stack = error.stack
      .split('\n')
      .slice(1, 7)
      .map((line) => line.trim())
      .join(' | ')
  if (error.cause !== undefined && depth < 2)
    fields.cause = redactValue(error.cause, home, depth + 1)
  return fields
}

function redactValue(value: unknown, home: string | undefined, depth: number): unknown {
  if (typeof value === 'string') return scrubString(value, home)
  if (value instanceof Error) return redactValue(errorFields(value, home, depth), home, depth)
  if (depth > 5) return '…'
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactValue(v, home, depth + 1))
  if (value && typeof value === 'object') {
    if (Buffer.isBuffer(value)) return `<${value.length} bytes>`
    const out: Record<string, unknown> = {}
    for (const [name, field] of Object.entries(value)) {
      out[name] =
        isSecretField(name) && field !== undefined && field !== null && field !== ''
          ? REDACTED
          : redactValue(field, home, depth + 1)
    }
    return out
  }
  return value
}

/** A copy of `value` safe to log; `home` is replaced with `~` in strings. */
export function redact(value: unknown, home?: string): unknown {
  return redactValue(value, home, 0)
}
