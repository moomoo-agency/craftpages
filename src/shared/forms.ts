/**
 * CraftForms embeds, shared by the main process and the editor
 * (unfinished/CRAFTFORMS.md).
 */

/**
 * A website address the way embed keys store it: bare host, lowercase, no
 * scheme, port, path or leading "www." (a key for example.com also renders on
 * www.example.com). '' when it isn't a plausible host name. Mirrors
 * storedDomain() in the CraftForms app.
 */
export function storedDomain(input: string): string {
  const domain = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^www\./, '')
    .replace(/\.+$/, '')
  const valid =
    domain.length <= 253 &&
    (domain === 'localhost' ||
      /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(domain))
  return valid ? domain : ''
}

/**
 * Addresses that work while testing but use up a website slot and won't be the
 * real site: Cloudflare previews, localhost, IP addresses.
 */
export const isStagingDomain = (domain: string): boolean =>
  /(^|\.)(pages\.dev|workers\.dev)$/.test(domain) ||
  domain === 'localhost' ||
  /^\d{1,3}(\.\d{1,3}){3}$/.test(domain)

/**
 * The snippet the CraftForms dashboard gives out, in the same shape
 * (Snippet.js buildSnippet), minus data-lang: on a site, the form follows the
 * page's own <html lang>.
 */
export const embedDiv = (key: string): string =>
  `<div\n  data-craftforms-embed="${key.replace(/[^A-Za-z0-9._-]/g, '')}">\n</div>`

export const loaderTag = (loaderUrl: string): string =>
  `<script src="${loaderUrl.replace(/"/g, '&quot;')}" defer></script>`

export const embedSnippet = (key: string, loaderUrl: string): string =>
  `${embedDiv(key)}\n${loaderTag(loaderUrl)}`

/** Any CraftForms embed in HTML, whoever put it there. */
export const EMBED_KEY = /data-craftforms-embed\s*=\s*["']([A-Za-z0-9._-]+)["']/g
/** The loader script of any CraftForms site. */
export const LOADER_SRC =
  /<script\b[^>]*\bsrc\s*=\s*["']([^"']*\/build\/webcomponents\/embed\.js)["']/gi

/**
 * The CraftForms site an embed key belongs to: its first part is
 * base64url(site URL), which is how the loader finds it too.
 */
export function siteOfKey(key: string): string {
  try {
    const part = key.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    const text = atob(part + '='.repeat((4 - (part.length % 4)) % 4))
    return /^https?:\/\//.test(text) ? text.replace(/\/+$/, '') : ''
  } catch {
    return ''
  }
}
