/*!
 * CraftPages site search: loader. https://github.com/craftpages (GPL-3.0)
 *
 * Include once per page:
 *   <script src="/assets/craftpages-search.js" defer></script>
 * Any element with the `data-craftpages-search` attribute opens the search box
 * (so does ⌘K / Ctrl+K and "/"). The box itself (a <craftpages-search> custom
 * element) and its stylesheet load on first use, from the same folder.
 *
 * Options, as attributes on this script tag:
 *   data-index        index URL (default /search-index.json)
 *   data-accent       highlight color, any CSS color (default: neutral)
 *   data-theme        auto | light | dark (default auto)
 *   data-placeholder  input placeholder
 *   data-empty        "no results" text
 *   data-suggest      comma-separated page URLs shown before typing
 *   data-shortcut     "off" disables ⌘K / Ctrl+K and "/"
 */
;(function () {
  'use strict'

  if (window.CraftPagesSearch) return

  var TRIGGER = '[data-craftpages-search]'
  var script = document.currentScript
  var base = script && script.src ? script.src.replace(/[^/?#]*([?#].*)?$/, '') : '/assets/'
  var options = script ? script.dataset : {}
  var loading = null
  var box = null

  // Keyboard focus ring for triggers (their own look is inline, set in CraftPages).
  var style = document.createElement('style')
  style.textContent =
    TRIGGER +
    ':focus-visible{outline:2px solid currentColor;outline-offset:2px}' +
    TRIGGER +
    '{cursor:pointer}'
  document.head.appendChild(style)

  function supported() {
    return 'customElements' in window && typeof window.customElements.define === 'function'
  }

  function load() {
    if (loading) return loading
    loading = new Promise(function (resolve, reject) {
      if (!supported()) return reject(new Error('Custom elements are not supported here'))
      if (window.customElements.get('craftpages-search')) return resolve()
      var css = document.createElement('link')
      css.rel = 'stylesheet'
      css.href = base + 'craftpages-search.css'
      document.head.appendChild(css)
      var code = document.createElement('script')
      code.src = base + 'craftpages-search-box.js'
      code.async = true
      code.onerror = function () {
        loading = null
        reject(new Error('Could not load ' + code.src))
      }
      document.head.appendChild(code)
      window.customElements.whenDefined('craftpages-search').then(function () {
        resolve()
      })
    })
    return loading
  }

  function element() {
    if (!box) {
      box = document.createElement('craftpages-search')
      for (var key in options) {
        if (Object.prototype.hasOwnProperty.call(options, key)) box.dataset[key] = options[key]
      }
      document.body.appendChild(box)
    }
    return box
  }

  function open(trigger) {
    return load().then(
      function () {
        element().open(trigger || document.activeElement)
      },
      function (error) {
        console.warn('CraftPages search:', error.message)
      }
    )
  }

  function close() {
    if (box) box.close()
  }

  /** Loads the box and the index ahead of the first click. */
  function warm() {
    load().then(
      function () {
        element().prefetch()
      },
      function () {}
    )
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target && event.target.closest && event.target.closest(TRIGGER)
    if (!trigger) return
    event.preventDefault()
    open(trigger)
  })

  function onApproach(event) {
    if (event.target && event.target.closest && event.target.closest(TRIGGER)) {
      document.removeEventListener('pointerover', onApproach)
      document.removeEventListener('focusin', onApproach)
      warm()
    }
  }
  document.addEventListener('pointerover', onApproach)
  document.addEventListener('focusin', onApproach)

  function typing(target) {
    return (
      target &&
      (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName || ''))
    )
  }

  if (options.shortcut !== 'off') {
    document.addEventListener('keydown', function (event) {
      var combo =
        (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k'
      var slash = event.key === '/' && !event.metaKey && !event.ctrlKey && !typing(event.target)
      if (!combo && !slash) return
      if (box && box.isOpen && box.isOpen()) return
      event.preventDefault()
      open(document.activeElement)
    })
  }

  // A link to #craftpages-search opens search (on this page or after navigating).
  function fromHash() {
    if (window.location.hash === '#craftpages-search') open(document.activeElement)
  }
  window.addEventListener('hashchange', fromHash)
  fromHash()

  window.CraftPagesSearch = Object.freeze({ open: open, close: close, load: load })
  document.dispatchEvent(new CustomEvent('craftpages.search.ready'))
})()
