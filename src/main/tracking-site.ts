import { readFile } from 'fs/promises'
import { join } from 'path'
import { hasDraft } from './drafts'
import { writeFiles } from './history'
import {
  applyPatches,
  attr,
  attrPatches,
  escapeAttr,
  find,
  parseWithLocations,
  walk,
  type Element,
  type Patch
} from './html/dom'
import { getSiteSettings } from './settings'
import { listFiles } from './workspace'
import { consentEnabled, withConsent } from './consent-site'
import { matchInline, matchSource } from './consent/signatures'
import {
  TRACKING_PROVIDERS,
  trackingProvider,
  type TrackingFieldKey,
  type TrackingInput,
  type TrackingKind,
  type TrackingState,
  type TrackingTag
} from '../shared/tracking'
import type { ConsentCategory, SiteChange } from '../shared/types'

/**
 * Analytics and ads tags from an ID, on every page:
 * - each provider's tags carry `data-craftpages-tracking="<kind>"`, so they're found,
 *   changed and removed without touching the site's own scripts;
 * - the IDs live in the tags themselves; nothing is kept elsewhere;
 * - tags that need consent carry its mark (`data-craftpages-consent`), and with consent
 *   on they're written held (`type="text/plain"`), so they never run before the visitor
 *   agrees, not even once;
 * - a page with `<meta name="craftpages:tracking" content="exclude">` gets none;
 * - <noscript> fallbacks are left out on purpose: they only reach visitors without
 *   JavaScript, who can never be asked for consent.
 */

const MARKER = 'data-craftpages-tracking'
const NAME = 'data-craftpages-name'
const MARK = 'data-craftpages-consent'
const LOADER_SRC = /(^|\/)craftpages-consent\.js([?#]|$)/
const EXCLUDE_META = '<meta name="craftpages:tracking" content="exclude">'

type Values = Partial<Record<TrackingFieldKey, string>>

interface Config {
  key: string
  kind: TrackingKind
  values: Values
  category: ConsentCategory | null
}

// ---------- The tags each provider needs ----------

const js = (value: string): string =>
  value.replace(/[\\'"<>]/g, (c) => `\\x${c.charCodeAt(0).toString(16)}`)

/** Each tag as [attributes, inline code]; the marker and consent attributes come later. */
function tagsFor(config: Config): [string, string][] {
  const v = config.values
  const id = js(v.id ?? '')
  switch (config.kind) {
    case 'ga4':
      return [
        [`async src="https://www.googletagmanager.com/gtag/js?id=${escapeAttr(v.id ?? '')}"`, ''],
        [
          '',
          `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${id}');`
        ]
      ]
    case 'gtm':
      return [
        [
          '',
          `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`
        ]
      ]
    case 'meta-pixel':
      return [
        [
          '',
          `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js'); fbq('init', '${id}'); fbq('track', 'PageView');`
        ]
      ]
    case 'clarity':
      return [
        [
          '',
          `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${id}");`
        ]
      ]
    case 'linkedin':
      return [
        [
          '',
          `window._linkedin_partner_id = "${id}"; window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || []; window._linkedin_data_partner_ids.push(window._linkedin_partner_id);`
        ],
        ['async src="https://snap.licdn.com/li.lms-analytics/insight.min.js"', '']
      ]
    case 'tiktok':
      return [
        [
          '',
          `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};n=d.createElement("script");n.type="text/javascript";n.async=!0;n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${id}');ttq.page();}(window,document,'ttq');`
        ]
      ]
    case 'plausible':
      return [
        [
          `defer data-domain="${escapeAttr(v.domain ?? '')}" src="${escapeAttr(v.script ?? '')}"`,
          ''
        ]
      ]
    case 'umami':
      return [
        [
          `defer src="${escapeAttr(v.script ?? '')}" data-website-id="${escapeAttr(v.id ?? '')}"`,
          ''
        ]
      ]
    case 'cloudflare-analytics':
      return [
        [
          `defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon="${escapeAttr(JSON.stringify({ token: v.id ?? '' }))}"`,
          ''
        ]
      ]
    case 'custom':
      return []
  }
}

/** The pasted snippet's scripts, each with its own attributes and code, as written. */
function customTags(code: string): string[] {
  const document = parseWithLocations(code)
  const out: string[] = []
  walk(document, (element) => {
    if (element.tagName !== 'script') return true
    const location = element.sourceCodeLocation
    if (location) out.push(code.slice(location.startOffset, location.endOffset))
    return false
  })
  return out
}

/** The attributes CraftPages adds to every tag of a provider. */
function ownAttrs(config: Config, consent: boolean, first: boolean): Record<string, string | null> {
  const held = consent && config.category !== null && config.category !== 'necessary'
  return {
    [MARKER]: config.key,
    [NAME]: config.kind === 'custom' && first ? (config.values.name ?? null) : null,
    [MARK]: config.category,
    ...(held ? { type: 'text/plain' } : {})
  }
}

/** Adds attributes to one tag's source (a whole `<script …>…</script>`). */
function withAttrs(tag: string, values: Record<string, string | null>): string {
  const document = parseWithLocations(tag)
  const element = find(document, (e) => e.tagName === 'script')
  if (!element) return tag
  const original = attr(element, 'type')
  const extra: Record<string, string | null> = { ...values }
  if (values.type && original && original.toLowerCase() !== 'text/plain')
    extra['data-craftpages-type'] = original
  return applyPatches(tag, attrPatches(tag, element, extra))
}

function block(config: Config, consent: boolean, indent: string): string {
  const tags =
    config.kind === 'custom'
      ? customTags(config.values.code ?? '')
      : tagsFor(config).map(
          ([attrs, code]) => `<script${attrs ? ` ${attrs}` : ''}>${code}</script>`
        )
  return tags
    .map((tag, i) => withAttrs(tag, ownAttrs(config, consent, i === 0)))
    .join(`\n${indent}`)
}

// ---------- Reading the pages ----------

interface Page {
  path: string
  source: string
  head: Element | null
  loader: Element | null
  excluded: Element | null
  /** CraftPages' tags, by marker, in page order. */
  tags: Map<string, Element[]>
  /** Recognised providers on the page that CraftPages didn't add. */
  byHand: Set<TrackingKind>
}

const KINDS = new Set(TRACKING_PROVIDERS.map((provider) => provider.kind))

function kindOf(key: string): TrackingKind | null {
  const kind = key.split(':')[0] as TrackingKind
  return KINDS.has(kind) ? kind : null
}

const inner = (source: string, element: Element): string => {
  const location = element.sourceCodeLocation
  if (!location?.startTag || !location.endTag) return ''
  return source.slice(location.startTag.endOffset, location.endTag.startOffset)
}

function readPage(path: string, source: string): Page {
  const document = parseWithLocations(source)
  const page: Page = {
    path,
    source,
    head: find(document, (e) => e.tagName === 'head'),
    loader: null,
    excluded: null,
    tags: new Map(),
    byHand: new Set()
  }
  walk(document, (element) => {
    if (
      element.tagName === 'meta' &&
      attr(element, 'name') === 'craftpages:tracking' &&
      attr(element, 'content') === 'exclude'
    ) {
      page.excluded = element
      return false
    }
    if (element.tagName !== 'script') return true
    const src = attr(element, 'src') ?? ''
    if (LOADER_SRC.test(src)) {
      page.loader = element
      return false
    }
    const marker = attr(element, MARKER)
    if (marker && kindOf(marker)) {
      page.tags.set(marker, [...(page.tags.get(marker) ?? []), element])
      return false
    }
    const signature = src ? matchSource(src) : matchInline(inner(source, element))
    if (signature && KINDS.has(signature.id as TrackingKind))
      page.byHand.add(signature.id as TrackingKind)
    return false
  })
  return page
}

async function readPages(root: string): Promise<Page[]> {
  const files = (await listFiles(root)).filter((file) => /\.html?$/i.test(file.path))
  return Promise.all(
    files.map(async (file) => readPage(file.path, await readFile(join(root, file.path), 'utf8')))
  )
}

const match = (text: string, pattern: RegExp): string | undefined => pattern.exec(text)?.[1]

/** A provider's settings, read back from its tags on one page. */
function readConfig(page: Page, key: string): Config | null {
  const kind = kindOf(key)
  const elements = page.tags.get(key)
  if (!kind || !elements?.length) return null
  const code = elements.map((element) => inner(page.source, element)).join('\n')
  const srcs = elements.map((element) => attr(element, 'src') ?? '')
  const first = elements[0]
  const mark = attr(first, MARK) as ConsentCategory | undefined
  const values: Values = {}
  switch (kind) {
    case 'ga4':
      values.id = srcs.map((src) => match(src, /[?&]id=([^&]+)/)).find(Boolean)
      values.id ??= match(code, /gtag\('config', '([^']+)'\)/)
      break
    case 'gtm':
      values.id = match(code, /'dataLayer','([^']+)'\)/)
      break
    case 'meta-pixel':
      values.id = match(code, /fbq\('init', '([^']+)'\)/)
      break
    case 'clarity':
      values.id = match(code, /"clarity","script","([^"]+)"\)/)
      break
    case 'linkedin':
      values.id = match(code, /_linkedin_partner_id = "([^"]+)"/)
      break
    case 'tiktok':
      values.id = match(code, /ttq\.load\('([^']+)'\)/)
      break
    case 'plausible':
      values.domain = attr(first, 'data-domain')
      values.script = attr(first, 'src')
      break
    case 'umami':
      values.id = attr(first, 'data-website-id')
      values.script = attr(first, 'src')
      break
    case 'cloudflare-analytics':
      try {
        values.id = JSON.parse(attr(first, 'data-cf-beacon') ?? '{}').token
      } catch {
        values.id = undefined
      }
      break
    case 'custom':
      values.name = attr(first, NAME) ?? key.slice('custom:'.length)
      values.code = elements.map((element) => cleanTag(page.source, element)).join('\n')
      break
  }
  return { key, kind, values, category: mark ?? null }
}

/** A pasted tag as it was pasted: CraftPages' own attributes taken off. */
function cleanTag(source: string, element: Element): string {
  const location = element.sourceCodeLocation!
  const tag = source.slice(location.startOffset, location.endOffset)
  const shifted = (patches: Patch[]): Patch[] =>
    patches.map((p) => ({
      ...p,
      start: p.start - location.startOffset,
      end: p.end - location.startOffset
    }))
  const original = attr(element, 'data-craftpages-type')
  const held = (attr(element, 'type') ?? '').toLowerCase() === 'text/plain' && attr(element, MARK)
  return applyPatches(
    tag,
    shifted(
      attrPatches(source, element, {
        [MARKER]: null,
        [NAME]: null,
        [MARK]: null,
        'data-craftpages-type': null,
        ...(held ? { type: original ?? null } : {})
      })
    )
  )
}

/** The site's providers: each one as the home page (or else the first page with it) has it. */
function configs(pages: Page[]): Map<string, Config> {
  const ordered = [...pages].sort(
    (a, b) => Number(b.path === 'index.html') - Number(a.path === 'index.html')
  )
  const out = new Map<string, Config>()
  for (const page of ordered)
    for (const key of page.tags.keys()) {
      if (out.has(key)) continue
      const config = readConfig(page, key)
      if (config) out.set(key, config)
    }
  return out
}

export async function trackingState(root: string): Promise<TrackingState> {
  const pages = await readPages(root)
  const current = configs(pages)
  const included = pages.filter((page) => !page.excluded)
  const tags: TrackingTag[] = [...current.values()].map((config) => ({
    key: config.key,
    kind: config.kind,
    name:
      config.kind === 'custom'
        ? (config.values.name ?? config.key)
        : (trackingProvider(config.kind)?.name ?? config.kind),
    values: config.values,
    category: config.category,
    pages: pages.filter((page) => page.tags.has(config.key)).length,
    missing: included.filter((page) => !page.tags.has(config.key)).map((page) => page.path)
  }))
  const byHand = new Map<TrackingKind, number>()
  for (const page of pages)
    for (const kind of page.byHand) byHand.set(kind, (byHand.get(kind) ?? 0) + 1)
  return {
    consent: await consentEnabled(root),
    pages: pages.map((page) => page.path).sort(),
    excluded: pages
      .filter((page) => page.excluded)
      .map((page) => page.path)
      .sort(),
    tags,
    byHand: [...byHand].map(([kind, count]) => ({
      kind,
      name: trackingProvider(kind)?.name ?? kind,
      pages: count
    }))
  }
}

// ---------- Writing ----------

function removePatch(source: string, element: Element): Patch {
  const location = element.sourceCodeLocation!
  let start = location.startOffset
  while (start > 0 && /[ \t]/.test(source[start - 1])) start--
  const end =
    source[location.endOffset] === '\n' && source[start - 1] === '\n'
      ? location.endOffset + 1
      : location.endOffset
  return { start, end, text: '' }
}

function indentBefore(source: string, offset: number): string {
  let start = offset
  while (start > 0 && /[ \t]/.test(source[start - 1])) start--
  return source.slice(start, offset)
}

/** The patches that bring one page to `wanted` (nothing at all when it's excluded). */
function pagePatches(
  page: Page,
  wanted: Map<string, Config>,
  consent: boolean,
  exclude: boolean
): Patch[] {
  const patches: Patch[] = []
  const inserts: string[] = []
  for (const [key, elements] of page.tags) {
    const config = exclude ? undefined : wanted.get(key)
    if (!config) {
      for (const element of elements) patches.push(removePatch(page.source, element))
      continue
    }
    const first = elements[0].sourceCodeLocation!
    const last = elements[elements.length - 1].sourceCodeLocation!
    const text = block(config, consent, indentBefore(page.source, first.startOffset))
    if (page.source.slice(first.startOffset, last.endOffset) === text) continue
    patches.push({ start: first.startOffset, end: first.endOffset, text })
    for (const element of elements.slice(1)) patches.push(removePatch(page.source, element))
  }
  if (!exclude)
    for (const [key, config] of wanted)
      if (!page.tags.has(key)) inserts.push(block(config, consent, '  '))
  // New tags go before the consent script, or at the end of <head>.
  const loader = page.loader?.sourceCodeLocation
  const head = page.head?.sourceCodeLocation
  if (inserts.length && loader) {
    const indent = indentBefore(page.source, loader.startOffset)
    patches.push({
      start: loader.startOffset,
      end: loader.startOffset,
      text: `${inserts.map((text) => text.replace(/\n {2}/g, `\n${indent}`)).join(`\n${indent}`)}\n${indent}`
    })
  } else if (inserts.length && head?.endTag) {
    patches.push({
      start: head.endTag.startOffset,
      end: head.endTag.startOffset,
      text: `${inserts.map((text) => `  ${text}\n`).join('')}`
    })
  }
  return patches
}

/** Every page brought to `wanted`, with consent kept in step, as one saved change. */
async function apply(
  root: string,
  pages: Page[],
  wanted: Map<string, Config>,
  label: string,
  excludeChange?: { path: string; excluded: boolean }
): Promise<SiteChange> {
  const consent = await consentEnabled(root)
  const contents = new Map<string, string>()
  const skipped: SiteChange['skipped'] = []
  for (const page of pages) {
    const patches: Patch[] = []
    let exclude = Boolean(page.excluded)
    if (excludeChange?.path === page.path && excludeChange.excluded !== exclude) {
      exclude = excludeChange.excluded
      if (exclude) {
        const head = page.head?.sourceCodeLocation
        if (!head?.endTag) throw new Error(`${page.path} has no <head>.`)
        patches.push({
          start: head.endTag.startOffset,
          end: head.endTag.startOffset,
          text: `  ${EXCLUDE_META}\n`
        })
      } else if (page.excluded) {
        patches.push(removePatch(page.source, page.excluded))
      }
    }
    patches.push(...pagePatches(page, wanted, consent, exclude))
    if (!patches.length) continue
    if (hasDraft(page.path)) {
      skipped.push({ path: page.path, reason: 'Unsaved edits: save or discard them first.' })
      continue
    }
    contents.set(page.path, applyPatches(page.source, patches))
  }
  if (!contents.size) return { pages: [], skipped, historyId: null }
  const writes = await withConsent(root, contents)
  const historyId = await writeFiles(root, writes, label)
  return {
    pages: writes.filter((write) => /\.html?$/i.test(write.path)).map((write) => write.path),
    skipped,
    historyId
  }
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'script'
  )
}

/** Checks the fields and fills the defaults; throws a message the screen can show. */
async function normalise(root: string, input: TrackingInput): Promise<Values> {
  const provider = trackingProvider(input.kind)
  if (!provider) throw new Error(`Unknown provider: ${input.kind}`)
  const values: Values = {}
  for (const field of provider.fields) {
    let value = (input.values[field.key] ?? '').trim()
    if (!value && field.fallback === 'site-host') {
      const { baseUrl } = await getSiteSettings(root)
      try {
        value = baseUrl ? new URL(baseUrl).host.replace(/^www\./, '') : ''
      } catch {
        value = ''
      }
    } else if (!value && field.fallback) {
      value = field.fallback
    }
    if (!value && !field.optional) throw new Error(`${provider.name}: the ${field.key} is missing.`)
    if (value && field.pattern && !field.pattern.test(value))
      throw new Error(`${provider.name}: “${value}” doesn’t look like a ${field.key}.`)
    if (value) values[field.key] = value
  }
  if (input.kind === 'custom' && !customTags(values.code ?? '').length)
    throw new Error('The snippet has no <script> tag. Paste the code the service gave you.')
  return values
}

/** Adds a provider to every page, or changes one already there. */
export async function saveTracking(root: string, input: TrackingInput): Promise<SiteChange> {
  const values = await normalise(root, input)
  const provider = trackingProvider(input.kind)!
  const pages = await readPages(root)
  const wanted = configs(pages)
  let key =
    input.key ?? (input.kind === 'custom' ? `custom:${slug(values.name ?? '')}` : input.kind)
  if (!input.key && wanted.has(key)) {
    if (input.kind !== 'custom') throw new Error(`${provider.name} is already on the site.`)
    let n = 2
    while (wanted.has(`${key}-${n}`)) n++
    key = `${key}-${n}`
  }
  const existing = wanted.get(key)
  // A category changed on the consent list is kept; new tags get the provider's.
  const category: ConsentCategory | null =
    input.kind === 'custom'
      ? (input.category ?? existing?.category ?? 'analytics')
      : existing
        ? existing.category
        : provider.category === 'cookieless' || provider.category === 'chosen'
          ? null
          : provider.category
  wanted.set(key, { key, kind: input.kind, values, category })
  return apply(
    root,
    pages,
    wanted,
    existing ? `Tracking: ${provider.name} changed` : `Tracking: ${provider.name} added`
  )
}

/** Takes a provider's tags off every page. */
export async function removeTracking(root: string, key: string): Promise<SiteChange> {
  const pages = await readPages(root)
  const wanted = configs(pages)
  const name = wanted.get(key)?.values.name ?? trackingProvider(kindOf(key) ?? 'custom')?.name
  wanted.delete(key)
  return apply(root, pages, wanted, `Tracking: ${name} removed`)
}

/** A page without tracking (a thank-you or private page), or back with it. */
export async function setTrackingExcluded(
  root: string,
  path: string,
  excluded: boolean
): Promise<SiteChange> {
  const pages = await readPages(root)
  if (!pages.some((page) => page.path === path)) throw new Error(`No page ${path}.`)
  return apply(
    root,
    pages,
    configs(pages),
    excluded ? `Tracking: off on ${path}` : `Tracking: back on ${path}`,
    { path, excluded }
  )
}

/** Before publishing: pages added since get the tags too. Runs before refreshConsent. */
export async function refreshTracking(root: string): Promise<void> {
  const pages = await readPages(root)
  const wanted = configs(pages)
  if (!wanted.size) return
  const pending = pages.some(
    (page) => !page.excluded && [...wanted.keys()].some((key) => !page.tags.has(key))
  )
  if (pending) await apply(root, pages, wanted, 'Tracking: added to new pages')
}
