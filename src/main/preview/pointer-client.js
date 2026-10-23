/**
 * Runs inside the pointing-mode iframe (blog template setup). Every element in
 * <body> carries data-cms-el="n". Hover outlines the element under the mouse;
 * a click reports it to the app. The app draws already-picked parts with labels.
 *
 *   → parent: ready, picked { n }
 *   ← parent: marks { marks: [{ n, label, tone }] }, scope { n | null, links }, focus { n }
 *
 * Cards often make the whole card a link with an empty layer over it: the title link's
 * ::after stretched over the card, or an empty absolutely positioned <a>. Pointing looks
 * through those layers, so the image, excerpt and date under them can be picked, except
 * while picking links (scope { links: true }), where clicking anywhere on the card picks it.
 */
;(function () {
  'use strict'

  const ATTR = 'data-cms-el'
  let scope = null // when set, only elements inside it can be picked
  let links = false // picking links: whole-card link layers stay in the way
  let hovered = null

  const post = (message) => window.parent.postMessage({ source: 'sitecms', ...message }, '*')
  const byNumber = (n) => document.querySelector(`[${ATTR}="${n}"]`)

  const style = document.createElement('style')
  style.textContent = `
    html.cms-pointing, html.cms-pointing * { cursor: crosshair !important; }
    #cms-hover, .cms-mark { position: absolute; z-index: 2147483646; pointer-events: none; box-sizing: border-box; }
    #cms-hover { border: 2px dashed #3d5afe; background: rgba(61, 90, 254, .08); }
    #cms-hover span, .cms-mark span { position: absolute; left: -2px; top: -22px; padding: 2px 6px; border-radius: 4px 4px 0 0;
      font: 600 11px/16px -apple-system, BlinkMacSystemFont, sans-serif; white-space: nowrap; color: #fff; }
    #cms-hover span { background: #3d5afe; }
    .cms-mark { border: 2px solid #1e8e3e; background: rgba(30, 142, 62, .10); }
    .cms-mark span { background: #1e8e3e; }
    .cms-mark.tone-scope { border-color: #f5a623; background: rgba(245, 166, 35, .08); }
    .cms-mark.tone-scope span { background: #f5a623; }
    .cms-dim { position: absolute; z-index: 2147483645; pointer-events: none; background: rgba(0, 0, 0, .35); }
    html.cms-pointing:not(.cms-links) *::before, html.cms-pointing:not(.cms-links) *::after { pointer-events: none !important; }
  `
  document.documentElement.appendChild(style)
  document.documentElement.classList.add('cms-pointing')

  const hoverBox = document.createElement('div')
  hoverBox.id = 'cms-hover'
  hoverBox.innerHTML = '<span></span>'
  let marks = []

  function fromHtml(html) {
    const template = document.createElement('template')
    template.innerHTML = html || ''
    return template.content.firstElementChild
  }

  function place(box, element) {
    const rect = element.getBoundingClientRect()
    box.style.left = `${rect.left + window.scrollX}px`
    box.style.top = `${rect.top + window.scrollY}px`
    box.style.width = `${rect.width}px`
    box.style.height = `${rect.height}px`
  }

  function label(element) {
    const cls = element.classList[0] ? `.${element.classList[0]}` : ''
    const rect = element.getBoundingClientRect()
    return `${element.tagName.toLowerCase()}${cls} · ${Math.round(rect.width)}×${Math.round(rect.height)}`
  }

  const MEDIA = 'img, svg, video, picture, canvas, iframe, input, select, textarea, button'

  /** An empty layer laid over other content, like a card's whole-card link. */
  function isOverlay(element) {
    if (element === document.body || element === document.documentElement) return false
    if (element.textContent.trim() || element.matches(MEDIA) || element.querySelector(MEDIA))
      return false
    const position = getComputedStyle(element).position
    return position === 'absolute' || position === 'fixed'
  }

  /** The element under the pointer, looking through empty overlays unless picking links. */
  function hitAt(x, y) {
    const stack = document.elementsFromPoint(x, y)
    if (links) return stack[0] || null
    return stack.find((node) => !isOverlay(node)) || stack[0] || null
  }

  function pickable(element) {
    const target = element && element.closest(`[${ATTR}]`)
    if (!target) return null
    if (scope && !(scope.contains(target) && scope !== target)) return null
    return target
  }

  function drawMarks() {
    document.querySelectorAll('.cms-mark, .cms-dim').forEach((node) => node.remove())
    for (const mark of marks) {
      const element = byNumber(mark.n)
      if (!element) continue
      const box = document.createElement('div')
      box.className = `cms-mark tone-${mark.tone || 'done'}`
      box.innerHTML = '<span></span>'
      box.querySelector('span').textContent = mark.label
      place(box, element)
      document.body.appendChild(box)
    }
  }

  document.addEventListener(
    'mousemove',
    (event) => {
      const target = pickable(hitAt(event.clientX, event.clientY))
      if (target === hovered) return
      hovered = target
      if (!target) return hoverBox.remove()
      hoverBox.querySelector('span').textContent = label(target)
      place(hoverBox, target)
      if (!hoverBox.isConnected) document.body.appendChild(hoverBox)
    },
    true
  )

  document.addEventListener(
    'click',
    (event) => {
      event.preventDefault()
      event.stopPropagation()
      const target = pickable(hitAt(event.clientX, event.clientY))
      if (target) post({ type: 'picked', n: Number(target.getAttribute(ATTR)) })
    },
    true
  )
  document.addEventListener('submit', (event) => event.preventDefault(), true)
  window.addEventListener('resize', drawMarks)

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || !event.data || event.data.target !== 'sitecms') return
    const message = event.data
    if (message.type === 'marks') {
      marks = message.marks || []
      drawMarks()
    } else if (message.type === 'preview-insert') {
      // Shows markup the app is about to insert (e.g. the search icon), next to element n.
      document.querySelectorAll('[data-cms-preview]').forEach((node) => node.remove())
      const target = message.n ? byNumber(message.n) : null
      const node = target && fromHtml(message.html)
      if (node) {
        node.setAttribute('data-cms-preview', '')
        if (message.position === 'before') target.before(node)
        else if (message.position === 'start') target.prepend(node)
        else if (message.position === 'end') target.append(node)
        else target.after(node)
      }
      drawMarks()
    } else if (message.type === 'restyle') {
      // Previews a new look for elements already on the page (matched by selector).
      document.querySelectorAll(message.selector).forEach((element) => {
        const node = fromHtml(message.html)
        if (!node) return
        const n = element.getAttribute(ATTR)
        if (n) node.setAttribute(ATTR, n)
        element.replaceWith(node)
      })
      drawMarks()
    } else if (message.type === 'scope') {
      scope = message.n ? byNumber(message.n) : null
      links = Boolean(message.links)
      document.documentElement.classList.toggle('cms-links', links)
      hovered = null
      hoverBox.remove()
    } else if (message.type === 'focus') {
      const element = byNumber(message.n)
      if (element) element.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  })

  function start() {
    post({ type: 'ready' })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
