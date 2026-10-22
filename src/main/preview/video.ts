/**
 * Video embeds in previews.
 *
 * Preview iframes are sandboxed without allow-same-origin, and a nested iframe inherits
 * that sandbox: YouTube and Vimeo players then load with an opaque origin and no storage,
 * and render as a black box. Served pages point those embeds at a local stand-in instead
 * (thumbnail, play button, a link out). Only the `src` attribute changes, so the editor's
 * numbering of elements stays exactly as instrumented, and nothing reaches the saved file.
 */

export const VIDEO_PATH = '/__cms/video'

const EMBED =
  /(<iframe\b[^>]*?\bsrc\s*=\s*)(["'])(https?:\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,})|player\.vimeo\.com\/video\/(\d+))[^"']*)\2/gi

/** Rewrites YouTube/Vimeo embed iframes in a served page to the local stand-in. */
export function withVideoStandIns(html: string, origin: string): string {
  if (!/youtube(?:-nocookie)?\.com\/embed\/|player\.vimeo\.com\/video\//i.test(html)) return html
  return html.replace(
    EMBED,
    (_match, before: string, quote: string, _src: string, yt?: string, vimeo?: string) => {
      const params = new URLSearchParams(yt ? { yt } : { vimeo: vimeo ?? '' })
      // A title before src (WordPress oEmbed order) labels the stand-in.
      const title = /\btitle\s*=\s*(["'])(.*?)\1/i.exec(before)?.[2]
      if (title) params.set('title', decodeEntities(title))
      return `${before}${quote}${origin}${VIDEO_PATH}?${params.toString().replace(/&/g, '&amp;')}${quote}`
    }
  )
}

const decodeEntities = (text: string): string =>
  text
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

const escape = (text: string): string => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** The stand-in page for one video. */
export function videoStandIn(url: URL): string | null {
  const yt = url.searchParams.get('yt')
  const vimeo = url.searchParams.get('vimeo')
  if (!(yt && /^[\w-]{6,}$/.test(yt)) && !(vimeo && /^\d+$/.test(vimeo))) return null
  const title = url.searchParams.get('title') ?? ''
  const watch = yt ? `https://www.youtube.com/watch?v=${yt}` : `https://vimeo.com/${vimeo}`
  const thumb = yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : ''
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#111;font:500 14px/1.4 system-ui,sans-serif;color:#fff}
a{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:inherit;text-decoration:none;
background:#111 ${thumb ? `url("${thumb}") center/cover no-repeat` : ''}}
.play{width:68px;height:48px;border-radius:12px;background:${yt ? '#f00' : '#1ab7ea'};display:grid;place-items:center}
.play::after{content:"";border-style:solid;border-width:10px 0 10px 17px;border-color:transparent transparent transparent #fff;margin-left:4px}
.bar{position:absolute;left:0;right:0;padding:10px 14px;background:rgba(0,0,0,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.top{top:0}.bottom{bottom:0;font-size:12px;color:#ddd}
</style></head><body><a href="${escape(watch)}" target="_blank" rel="noopener">
${title ? `<span class="bar top">${escape(title)}</span>` : ''}<span class="play" aria-hidden="true"></span>
<span class="bar bottom">${yt ? 'YouTube' : 'Vimeo'} video · plays on the published site</span></a></body></html>`
}
