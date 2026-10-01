/**
 * Runs inside the pointing-mode iframe (blog template setup). Every element in
 * <body> carries data-cms-el="n". Hover outlines the element under the mouse;
 * a click reports it to the app. The app draws already-picked parts with labels.
 *
 *   → parent: ready, picked { n }
 *   ← parent: marks { marks: [{ n, label, tone }] }, scope { n | null }, focus { n }
 */
;(function () {
  'use strict'

  const ATTR = 'data-cms-el'
  let scope = null // when set, only elements inside it can be picked
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
      const target = pickable(event.target)
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
      const target = pickable(event.target)
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
