import { readFile } from 'fs/promises'
import { posix } from 'path'
import { readTemplates } from './blog'
import { generatedFiles } from './blog-generate'
import { isPublished } from './deploy/exclude'
import { hasDraft } from './drafts'
import { writeFiles, type FileWrite } from './history'
import { applyPatches, attr, attrPatches, parseWithLocations, walk, type Patch } from './html/dom'
import { APP_DIR, getSiteSettings } from './settings'
import { listFiles, resolveInWorkspace } from './workspace'
import { fileOfPath, listPath } from '../shared/blog-urls'
import type { LayoutLinks, LayoutLinksFix, SiteSettings } from '../shared/types'

/**
 * Links on the site's own pages to the blog's layout pages once those are off the site
 * (blog.html → /blog/). The live site redirects them anyway; this points them straight at
 * the blog, in the page files, keeping each link's style (relative stays relative).
 */

const ORIGIN = 'http://craftpages.local'

/** /blog/, /blog/index.html and /blog all compare as /blog/. */
const normalize = (pathname: string): string =>
  pathname.replace(/index\.html?$/, '').replace(/([^/])$/, '$1/')

interface Scope {
  site: SiteSettings
  blogHome: string
  /** Normalized addresses of the layout pages that are off the site. */
  addresses: Set<string>
  layouts: string[]
  /** Pages to leave alone: the blog's own (rewritten on every publish) and the layouts. */
  skip: Set<string>
}

/**
 * `planned`: before the blog is created, the layout pages creating it will take off the
 * site (all but ones switched back on after an earlier creation), for the "Create" step.
 */
async function scope(root: string, planned = false): Promise<Scope | null> {
  const templates = await readTemplates(root)
  const site = await getSiteSettings(root)
  const layouts = [...new Set([templates?.post, templates?.list])].filter(
    (path): path is string =>
      !!path &&
      path !== 'index.html' &&
      (!isPublished(site, path) || (planned && !templates?.unpublished?.includes(path)))
  )
  if (!layouts.length) return null
  const blogHome = listPath(site.blog.listPath)
  const generated = await generatedFiles(root)
  // Only once the blog's list page exists: before that, the layout page is the only blog there is.
  if (!planned && !generated.includes(fileOfPath(blogHome))) return null
  const addresses = new Set(layouts.map((path) => normalize('/' + path)))
  for (const path of layouts) {
    if (path.endsWith('.html')) addresses.add(normalize('/' + path.slice(0, -'.html'.length)))
  }
  addresses.delete(blogHome)
  return { site, blogHome, addresses, layouts, skip: new Set([...generated, ...layouts]) }
}

/** The new href for a link to a layout page, or null when it links elsewhere. */
function retarget(href: string, page: string, s: Scope): string | null {
  const trimmed = href.trim()
  if (!trimmed || /^(#|mailto:|tel:|javascript:|data:)/i.test(trimmed)) return null
  const base = s.site.baseUrl || ORIGIN
  let url: URL
  try {
    url = new URL(trimmed, new URL('/' + page, ORIGIN))
    if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(trimmed)) {
      const absolute = new URL(trimmed)
      if (absolute.origin !== new URL(base).origin) return null
      url = absolute
    }
  } catch {
    return null
  }
  let pathname: string
  try {
    pathname = decodeURI(url.pathname)
  } catch {
    pathname = url.pathname
  }
  if (!s.addresses.has(normalize(pathname))) return null
  const rest = url.search + url.hash
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(trimmed)) return base + s.blogHome + rest
  if (trimmed.startsWith('/')) return s.blogHome + rest
  const from = posix.dirname('/' + page)
  const relative = posix.relative(from, s.blogHome)
  return (relative ? relative + '/' : './') + rest
}

interface PageFix {
  path: string
  source: string
  patches: Patch[]
}

async function scan(root: string, s: Scope): Promise<PageFix[]> {
  const fixes: PageFix[] = []
  for (const file of await listFiles(root)) {
    if (!/\.html?$/.test(file.path) || file.path.startsWith(APP_DIR) || s.skip.has(file.path))
      continue
    const source = await readFile(resolveInWorkspace(root, file.path), 'utf8').catch(() => null)
    if (source === null) continue
    const patches: Patch[] = []
    walk(parseWithLocations(source), (element) => {
      if (element.tagName !== 'a' && element.tagName !== 'area') return true
      const href = attr(element, 'href')
      const next = href !== undefined && retarget(href, file.path, s)
      if (next && element.sourceCodeLocation?.startTag)
        patches.push(...attrPatches(source, element, { href: next }))
      return true
    })
    if (patches.length) fixes.push({ path: file.path, source, patches })
  }
  return fixes
}

export async function layoutLinks(root: string, planned = false): Promise<LayoutLinks | null> {
  const s = await scope(root, planned)
  if (!s) return null
  const fixes = await scan(root, s)
  if (!fixes.length) return null
  return {
    layouts: s.layouts,
    blogHome: s.blogHome,
    pages: fixes.map((fix) => ({
      path: fix.path,
      links: fix.patches.length,
      unsaved: hasDraft(fix.path)
    }))
  }
}

export async function fixLayoutLinks(root: string): Promise<LayoutLinksFix> {
  const s = await scope(root)
  const fixes = s ? await scan(root, s) : []
  // A page with unsaved edits would lose them, or overwrite these, when it's saved.
  const skipped = fixes.filter((fix) => hasDraft(fix.path)).map((fix) => fix.path)
  const writes: FileWrite[] = fixes
    .filter((fix) => !skipped.includes(fix.path))
    .map((fix) => ({ path: fix.path, content: applyPatches(fix.source, fix.patches) }))
  const historyId = writes.length ? await writeFiles(root, writes, 'Blog: links to the blog') : null
  return {
    pages: writes.map((write) => write.path),
    links: fixes
      .filter((fix) => !skipped.includes(fix.path))
      .reduce((sum, fix) => sum + fix.patches.length, 0),
    skipped,
    historyId
  }
}
