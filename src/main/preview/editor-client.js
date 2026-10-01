/**
 * Runs inside the page-editor iframe (the only script allowed there). Makes
 * text elements editable on click, keeps a mini toolbar for bold / italic /
 * link, and talks to the app through postMessage:
 *
 *   → parent: ready, draft (every change, live), select, image, component, shortcut
 *   ← parent: apply (saved drafts on load), set-image, deselect, focus-component
 *
 * Repeating lists (cards, team members…) are marked by the app: their items
 * can be moved, duplicated and deleted. A duplicate is a new item: its text
 * and images are edited in place, and the whole item is sent as HTML.
 *
 * Edits are reported as they happen; the app keeps them as drafts until Save all.
 */
;(function () {
  'use strict'

  const ATTR = 'data-cms-id'
  const CHANGED = 'data-cms-changed'
  const INHERITED = 'data-cms-inherited'
  const COMPONENT = 'data-cms-component'
  const COMPONENT_ACTIVE = 'data-cms-comp-active'
  /** A <details> the editor opened so its content can be edited; closed again in saved HTML. */
  const OPENED = 'data-cms-opened'
  const LIST = 'data-cms-list'
  const ITEM = 'data-cms-item' // original item: its index in the file
  const NEW = 'data-cms-new' // new item: the index of the item it was copied from
  const ITEM_ACTIVE = 'data-cms-item-active'
  const COUNT = 'data-cms-count' // items the list has in the file
  let activeItem = null
  let cloneIds = 0
  const originals = new Map() // id → clean innerHTML of the file
  const attrChanges = new Map() // id → { name: value | null }
  const inherited = new Map() // id → html applied from a shared-component edit on another page
  const drafts = new Map() // id → this page's own change
  let active = null
  let activeComponent = null

  const post = (message) => window.parent.postMessage({ source: 'sitecms', ...message }, '*')

  // ---------- Serialization ----------

  const INTERNAL = [
    ATTR,
    CHANGED,
    INHERITED,
    COMPONENT,
    COMPONENT_ACTIVE,
    'data-cms-flash',
    OPENED,
    LIST,
    ITEM,
    NEW,
    ITEM_ACTIVE,
    COUNT,
    'contenteditable',
    'spellcheck'
  ]
  function cleanHtml(element) {
    const clone = element.cloneNode(true)
    for (const node of clone.querySelectorAll(`[${OPENED}]`)) node.removeAttribute('open')
    for (const node of clone.querySelectorAll('*'))
      INTERNAL.forEach((name) => node.removeAttribute(name))
    return clone.innerHTML
  }

  /** An element's own HTML without editor markers (a new list item, as it will be saved). */
  function cleanOuter(element) {
    const clone = element.cloneNode(true)
    for (const node of clone.querySelectorAll(`[${OPENED}]`)) node.removeAttribute('open')
    for (const node of [clone, ...clone.querySelectorAll('*')])
      INTERNAL.forEach((name) => node.removeAttribute(name))
    return clone.outerHTML
  }

  function selectorOf(element) {
    const parts = []
    for (
      let node = element;
      node && node.nodeType === 1 && node !== document.documentElement;
      node = node.parentElement
    ) {
      if (node.id) {
        parts.unshift(`#${CSS.escape(node.id)}`)
        break
      }
      let part = node.tagName.toLowerCase()
      const parent = node.parentElement
      if (parent) {
        const same = Array.from(parent.children).filter((child) => child.tagName === node.tagName)
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`
      }
      parts.unshift(part)
    }
    return parts.join(' > ')
  }

  function describe(element) {
    const clone = element.cloneNode(true)
    for (const node of [clone, ...clone.querySelectorAll('*')])
      INTERNAL.forEach((name) => node.removeAttribute(name))
    const html = clone.outerHTML
    return {
      selector: selectorOf(element),
      tag: element.tagName.toLowerCase(),
      text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500),
      html: html.length > 4000 ? html.slice(0, 4000) + '…' : html
    }
  }

  // ---------- Styles ----------

  const style = document.createElement('style')
  style.textContent = `
    [${ATTR}]:not(img) { cursor: text; }
    [${ATTR}]:hover { outline: 1px dashed rgba(61, 90, 254, .7); outline-offset: 2px; }
    [${ATTR}][contenteditable="true"] { outline: 2px solid #3d5afe !important; outline-offset: 2px; }
    [${CHANGED}] { outline: 1px solid #f5a623; outline-offset: 2px; }
    [${INHERITED}] { outline: 1px dashed #f5a623; outline-offset: 2px; }
    [${COMPONENT_ACTIVE}] { outline: 2px dashed #f5a623 !important; outline-offset: -2px; }
    @keyframes cms-flash { from { box-shadow: inset 0 0 0 9999px rgba(245, 166, 35, .25); } }
    [data-cms-flash] { animation: cms-flash 1.2s ease-out; }
    img[${ATTR}] { cursor: pointer; }
    #cms-toolbar { position: fixed; z-index: 2147483647; display: none; gap: 2px; padding: 4px;
      background: #1b1c1f; border-radius: 8px; box-shadow: 0 6px 24px rgba(0,0,0,.25);
      font: 13px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #fff; }
    #cms-toolbar button { all: unset; min-width: 28px; height: 28px; padding: 0 6px; box-sizing: border-box;
      display: inline-grid; place-items: center; border-radius: 5px; cursor: pointer; color: #fff; }
    #cms-toolbar button:hover { background: rgba(255,255,255,.14); }
    #cms-toolbar button.is-on { background: #3d5afe; }
    #cms-toolbar button[data-tip]:hover::after { content: attr(data-tip); position: absolute; top: calc(100% + 6px);
      left: 50%; transform: translateX(-50%); padding: 4px 8px; border-radius: 5px; background: #1b1c1f;
      color: #fff; font-size: 12px; white-space: nowrap; pointer-events: none; }
    #cms-toolbar button { position: relative; }
    #cms-toolbar input { all: unset; width: 220px; height: 28px; padding: 0 8px; box-sizing: border-box;
      background: #2c2e33; border-radius: 5px; color: #fff; }
    #cms-toolbar [hidden] { display: none !important; }
    #cms-toolbar .cms-sep { width: 1px; margin: 4px 2px; background: rgba(255,255,255,.2); }
    [${ITEM_ACTIVE}] { outline: 2px dashed rgba(61, 90, 254, .8) !important; outline-offset: 4px; }
    [${NEW}] { box-shadow: 0 0 0 1px #1e8e3e; }
    #cms-itembar { position: fixed; z-index: 2147483646; display: none; gap: 2px; padding: 3px;
      background: #fff; border: 1px solid #d9dbe1; border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,.18);
      font: 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1b1c1f; }
    #cms-itembar button { all: unset; position: relative; display: inline-grid; place-items: center;
      width: 26px; height: 26px; border-radius: 5px; cursor: pointer; color: #1b1c1f; }
    #cms-itembar button:hover:not(:disabled) { background: #eef0f4; }
    #cms-itembar button:disabled { opacity: .35; cursor: default; }
    #cms-itembar button[data-act="delete"]:hover:not(:disabled) { background: #fce8e6; color: #d93025; }
    #cms-itembar button[data-tip]:hover::after { content: attr(data-tip); position: absolute; top: calc(100% + 6px);
      right: 0; padding: 4px 8px; border-radius: 5px; background: #1b1c1f; color: #fff; font-size: 12px;
      white-space: nowrap; pointer-events: none; }
  `
  document.documentElement.appendChild(style)

  // ---------- Toolbar ----------

  const toolbar = document.createElement('div')
  toolbar.id = 'cms-toolbar'
  // Icons: Material Symbols (Apache 2.0). Each button also has a text tooltip (data-tip).
  const svg = (path) =>
    `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="${path}"/></svg>`
  toolbar.innerHTML = `
    <button data-cmd="bold" data-tip="Bold · ⌘B" aria-label="Bold">${svg('M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z')}</button>
    <button data-cmd="italic" data-tip="Italic · ⌘I" aria-label="Italic">${svg('M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z')}</button>
    <button data-cmd="link" data-tip="Link" aria-label="Link">${svg('M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z')}</button>
    <input data-role="href" placeholder="https://… or /page/" hidden>
    <button data-cmd="apply-link" hidden data-tip="Apply link · Enter" aria-label="Apply link">${svg('M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z')}</button>
    <span class="cms-sep"></span>
    <button data-cmd="clear" data-tip="Clear formatting" aria-label="Clear formatting">${svg('M3.27 5 2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.55 5.27 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z')}</button>
  `
  const hrefInput = toolbar.querySelector('[data-role="href"]')
  const applyLink = toolbar.querySelector('[data-cmd="apply-link"]')
  let savedRange = null
  let linkMode = 'inline' // 'inline' = link on the selection; 'self' = href of the edited <a> itself

  // Keep the text selection when the toolbar is clicked (except in the URL field).
  toolbar.addEventListener('mousedown', (event) => {
    if (event.target !== hrefInput) event.preventDefault()
  })

  function placeToolbar() {
    if (!active) return
    const rect = active.getBoundingClientRect()
    toolbar.style.display = 'flex'
    const top = rect.top - toolbar.offsetHeight - 10
    toolbar.style.top = `${top < 8 ? rect.bottom + 10 : top}px`
    toolbar.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - toolbar.offsetWidth - 8))}px`
  }

  function showLinkField(show, value) {
    hrefInput.hidden = !show
    applyLink.hidden = !show
    if (show) {
      hrefInput.value = value || ''
      hrefInput.focus()
      hrefInput.select()
    }
    placeToolbar()
  }

  function restoreSelection() {
    if (!savedRange) return
    const selection = getSelection()
    selection.removeAllRanges()
    selection.addRange(savedRange)
  }

  function commitLink() {
    const url = hrefInput.value.trim()
    if (linkMode === 'self') {
      setAttr(active, 'href', url || null)
    } else {
      active.focus()
      restoreSelection()
      if (url) document.execCommand('createLink', false, url)
      else document.execCommand('unlink')
    }
    showLinkField(false)
    markDirty(active)
    active.focus()
  }

  /** With just a caret (no selection), formatting applies to the word the caret is in. */
  function selectWordIfCollapsed() {
    const selection = getSelection()
    if (!selection.rangeCount || !selection.isCollapsed) return
    selection.modify('move', 'backward', 'word')
    selection.modify('extend', 'forward', 'word')
  }

  /** Lights up Bold / Italic / Link when the caret or selection already has them. */
  function updateToolbarState() {
    if (!active) return
    const selection = getSelection()
    const node = selection.anchorNode
    const inside = node && active.contains(node)
    const anchor = inside && (node.nodeType === 1 ? node : node.parentElement).closest('a')
    toolbar
      .querySelector('[data-cmd="bold"]')
      .classList.toggle('is-on', Boolean(inside && document.queryCommandState('bold')))
    toolbar
      .querySelector('[data-cmd="italic"]')
      .classList.toggle('is-on', Boolean(inside && document.queryCommandState('italic')))
    toolbar
      .querySelector('[data-cmd="link"]')
      .classList.toggle('is-on', Boolean(active.tagName === 'A' || anchor))
  }
  document.addEventListener('selectionchange', updateToolbarState)

  toolbar.addEventListener('click', (event) => {
    const button = event.target.closest('button')
    if (!button || !active) return
    const cmd = button.dataset.cmd
    if (cmd === 'bold' || cmd === 'italic') {
      selectWordIfCollapsed()
      document.execCommand(cmd)
      markDirty(active)
      updateToolbarState()
    } else if (cmd === 'clear') {
      selectWordIfCollapsed()
      document.execCommand('removeFormat')
      document.execCommand('unlink')
      markDirty(active)
      updateToolbarState()
    } else if (cmd === 'link') {
      if (!hrefInput.hidden) return showLinkField(false)
      if (active.tagName === 'A') {
        linkMode = 'self'
        return showLinkField(true, active.getAttribute('href'))
      }
      const selection = getSelection()
      const node = selection.anchorNode
      const anchor = node && (node.nodeType === 1 ? node : node.parentElement).closest('a')
      if (anchor && active.contains(anchor)) {
        // Editing an existing link: act on the whole link.
        const range = document.createRange()
        range.selectNodeContents(anchor)
        selection.removeAllRanges()
        selection.addRange(range)
      } else {
        selectWordIfCollapsed()
      }
      savedRange = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null
      linkMode = 'inline'
      showLinkField(true, anchor && active.contains(anchor) ? anchor.getAttribute('href') : '')
    } else if (cmd === 'apply-link') {
      commitLink()
    }
  })

  hrefInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitLink()
    } else if (event.key === 'Escape') {
      showLinkField(false)
      active && active.focus()
    }
  })

  // ---------- Repeating lists ----------

  const itembar = document.createElement('div')
  itembar.id = 'cms-itembar'
  itembar.innerHTML = `
    <button data-act="up" data-tip="Move up" aria-label="Move up">${svg('M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z')}</button>
    <button data-act="down" data-tip="Move down" aria-label="Move down">${svg('M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z')}</button>
    <button data-act="duplicate" data-tip="Duplicate: add one like this" aria-label="Duplicate">${svg('M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z')}</button>
    <button data-act="delete" data-tip="Delete" aria-label="Delete">${svg('M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z')}</button>
  `
  itembar.addEventListener('mousedown', (event) => event.preventDefault())

  const isItem = (node) =>
    node.nodeType === 1 &&
    (node.hasAttribute(ITEM) || node.hasAttribute(NEW)) &&
    node.parentElement &&
    node.parentElement.hasAttribute(LIST)
  const itemsOf = (list) => Array.from(list.children).filter(isItem)

  /** The innermost list item around an element (itself included). */
  function itemOf(element) {
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      if (isItem(node)) return node
    }
    return null
  }

  /** Inside a new item: edits there travel with the item's HTML, not as node changes. */
  const inNewItem = (element) => Boolean(element && element.closest(`[${NEW}]`))

  function placeItembar() {
    if (!activeItem || !activeItem.isConnected) {
      itembar.style.display = 'none'
      return
    }
    const rect = activeItem.getBoundingClientRect()
    itembar.style.display = 'flex'
    const top = rect.top - itembar.offsetHeight - 6
    itembar.style.top = `${Math.max(8, top)}px`
    itembar.style.left = `${Math.max(8, Math.min(rect.right - itembar.offsetWidth, window.innerWidth - itembar.offsetWidth - 8))}px`
    const items = itemsOf(activeItem.parentElement)
    const index = items.indexOf(activeItem)
    itembar.querySelector('[data-act="up"]').disabled = index <= 0
    itembar.querySelector('[data-act="down"]').disabled = index >= items.length - 1
    itembar.querySelector('[data-act="delete"]').disabled = items.length <= 1
  }

  function setItem(item) {
    if (activeItem === item) return placeItembar()
    if (activeItem) activeItem.removeAttribute(ITEM_ACTIVE)
    activeItem = item
    if (item) item.setAttribute(ITEM_ACTIVE, '')
    placeItembar()
  }

  /** Gives the editable elements of a new item their own ids (so text and images can be edited). */
  function renumber(item) {
    for (const node of [item, ...item.querySelectorAll(`[${ATTR}]`)]) {
      if (!node.hasAttribute(ATTR)) continue
      node.setAttribute(ATTR, `n${++cloneIds}`)
      node.removeAttribute(CHANGED)
      node.removeAttribute(INHERITED)
    }
  }

  /** Same whitespace between items as in the file, so inline layouts don't shift. */
  function gapBefore(item) {
    const previous = item.previousSibling
    return previous && previous.nodeType === 3 && !previous.textContent.trim() ? previous : null
  }

  /** Every list whose items differ from the file: new order, with new items as HTML. */
  function listEdits() {
    const edits = {}
    for (const list of document.querySelectorAll(`[${LIST}]`)) {
      const items = itemsOf(list).map((item) =>
        item.hasAttribute(NEW)
          ? { from: Number(item.getAttribute(NEW)), html: cleanOuter(item) }
          : { from: Number(item.getAttribute(ITEM)) }
      )
      const same =
        items.length === Number(list.getAttribute(COUNT)) &&
        items.every((item, i) => item.from === i && item.html === undefined)
      if (!same) edits[list.getAttribute(LIST)] = items
    }
    return edits
  }

  itembar.addEventListener('click', (event) => {
    const button = event.target.closest('button')
    if (!button || button.disabled || !activeItem) return
    const item = activeItem
    const list = item.parentElement
    const items = itemsOf(list)
    const index = items.indexOf(item)
    deactivate()
    const act = button.dataset.act
    if (act === 'up' && index > 0) {
      const gap = gapBefore(item)
      list.insertBefore(item, items[index - 1])
      if (gap) list.insertBefore(gap, items[index - 1])
    } else if (act === 'down' && index < items.length - 1) {
      const next = items[index + 1]
      const gap = gapBefore(next)
      list.insertBefore(next, item)
      if (gap) list.insertBefore(gap, item)
    } else if (act === 'duplicate') {
      const copy = item.cloneNode(true)
      copy.setAttribute(NEW, item.getAttribute(NEW) ?? item.getAttribute(ITEM))
      copy.removeAttribute(ITEM)
      copy.removeAttribute(ITEM_ACTIVE)
      renumber(copy)
      const gap = gapBefore(item) || (items[1] && gapBefore(items[1]))
      item.after(copy)
      if (gap) item.after(gap.cloneNode())
      setItem(copy)
      copy.scrollIntoView({ block: 'nearest' })
      sendDraft()
      return
    } else if (act === 'delete' && items.length > 1) {
      // Edits inside a deleted item go with it.
      for (const node of [item, ...item.querySelectorAll(`[${ATTR}]`)]) {
        const id = node.getAttribute(ATTR)
        if (id) drafts.delete(id)
      }
      const gap = gapBefore(item)
      if (gap) gap.remove()
      item.remove()
      setItem(null)
      sendDraft()
      return
    }
    placeItembar()
    item.scrollIntoView({ block: 'nearest' })
    sendDraft()
  })

  /** Rebuilds a list from saved edits (on load). */
  function applyList(list, order) {
    const originals = new Map(itemsOf(list).map((item) => [Number(item.getAttribute(ITEM)), item]))
    const gap = (itemsOf(list)[1] && gapBefore(itemsOf(list)[1])) || null
    const next = order.map((entry) => {
      if (entry.html === undefined) return originals.get(entry.from)
      const template = document.createElement('template')
      template.innerHTML = entry.html
      const item = template.content.firstElementChild
      // Editable spots sit where they sit in the item it was copied from.
      const source = originals.get(entry.from)
      if (source) {
        for (const node of [source, ...source.querySelectorAll(`[${ATTR}]`)]) {
          if (!node.hasAttribute(ATTR)) continue
          const path = []
          for (let n = node; n !== source; n = n.parentElement)
            path.unshift(Array.from(n.parentElement.children).indexOf(n))
          let target = item
          for (const i of path) target = target && target.children[i]
          if (target) target.setAttribute(ATTR, 'x')
        }
      }
      item.setAttribute(NEW, String(entry.from))
      renumber(item)
      return item
    })
    for (const item of itemsOf(list)) {
      const g = gapBefore(item)
      if (g) g.remove()
      item.remove()
    }
    const anchor = list.lastChild // whitespace before the closing tag stays last
    next.forEach((item, i) => {
      if (!item) return
      if (i > 0 && gap)
        list.insertBefore(gap.cloneNode(), anchor && anchor.nodeType === 3 ? anchor : null)
      list.insertBefore(item, anchor && anchor.nodeType === 3 ? anchor : null)
    })
  }

  // ---------- Editing ----------

  function sendDraft() {
    post({ type: 'draft', changes: Array.from(drafts.values()), lists: listEdits() })
    placeItembar()
  }

  /** This element's edit relative to the file, or null when it matches the file (or what another page's edit put there). */
  function changeFor(element) {
    const id = element.getAttribute(ATTR)
    const change = { id }
    if (originals.has(id)) {
      let html = cleanHtml(element)
      // contenteditable turns typed boundary spaces into &nbsp;; keep plain spaces unless the
      // original text used non-breaking ones itself.
      if (!originals.get(id).includes('&nbsp;')) {
        html = html.replace(/&nbsp;/g, ' ')
        if (!/ {2}/.test(originals.get(id))) html = html.replace(/ {2,}/g, ' ')
      }
      if (html !== originals.get(id) && html !== inherited.get(id)) change.html = html
    }
    if (attrChanges.has(id)) change.attrs = attrChanges.get(id)
    return change.html !== undefined || change.attrs ? change : null
  }

  function markDirty(element) {
    if (!element) return
    if (inNewItem(element)) return sendDraft()
    const id = element.getAttribute(ATTR)
    const change = changeFor(element)
    if (change) {
      drafts.set(id, change)
      element.setAttribute(CHANGED, '')
      element.removeAttribute(INHERITED)
    } else {
      drafts.delete(id)
      element.removeAttribute(CHANGED)
      if (inherited.has(id)) element.setAttribute(INHERITED, '')
    }
    sendDraft()
  }

  function setComponent(element) {
    const component = element ? element.closest(`[${COMPONENT}]`) : null
    if (component === activeComponent) return
    if (activeComponent) activeComponent.removeAttribute(COMPONENT_ACTIVE)
    activeComponent = component
    if (component) component.setAttribute(COMPONENT_ACTIVE, '')
    post({ type: 'component', id: component ? component.getAttribute(COMPONENT) : null })
  }

  function setAttr(element, name, value) {
    if (inNewItem(element)) {
      if (value === null) element.removeAttribute(name)
      else element.setAttribute(name, value)
      return sendDraft()
    }
    const id = element.getAttribute(ATTR)
    const changes = attrChanges.get(id) || {}
    changes[name] = value
    attrChanges.set(id, changes)
    if (value === null) element.removeAttribute(name)
    else element.setAttribute(name, value)
    markDirty(element)
  }

  function activate(element) {
    if (active === element) return
    deactivate()
    active = element
    setComponent(element)
    element.setAttribute('contenteditable', 'true')
    element.setAttribute('spellcheck', 'true')
    element.focus()
    placeToolbar()
  }

  function deactivate() {
    if (!active) return
    active.removeAttribute('contenteditable')
    active.removeAttribute('spellcheck')
    markDirty(active)
    active = null
    toolbar.style.display = 'none'
    showLinkField(false)
  }

  document.addEventListener(
    'click',
    (event) => {
      if (toolbar.contains(event.target)) return
      // Links, buttons and forms must not navigate or submit while editing.
      if (event.target.closest('a, button, label, summary, [type="submit"]')) event.preventDefault()

      if (itembar.contains(event.target)) return
      const target = event.target.closest(`[${ATTR}]`)
      const select = target || event.target.closest('body *')
      if (select) post({ type: 'select', ...describe(select) })
      setItem(itemOf(event.target))

      if (!target) {
        setComponent(null)
        return deactivate()
      }
      if (target.tagName === 'IMG') {
        deactivate()
        setComponent(target)
        return post({
          type: 'image',
          id: target.getAttribute(ATTR),
          src: target.getAttribute('src') || '',
          alt: target.getAttribute('alt') || '',
          width: target.naturalWidth,
          height: target.naturalHeight
        })
      }
      activate(target)
    },
    true
  )

  document.addEventListener('submit', (event) => event.preventDefault(), true)

  document.addEventListener('input', (event) => {
    if (active && active.contains(event.target)) markDirty(active)
  })

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      deactivate()
      return post({ type: 'shortcut', key: 'save' })
    }
    if (!active || !active.contains(event.target)) return
    if (event.key === 'Escape') return deactivate()
    if (event.key === 'Enter') {
      // No new paragraphs in v1 (structure stays as it is); Shift+Enter = line break.
      event.preventDefault()
      if (event.shiftKey) document.execCommand('insertLineBreak')
    }
  })

  // Paste keeps text plus bold / italic / links / line breaks.
  const KEEP = { B: 'b', STRONG: 'strong', I: 'i', EM: 'em', BR: 'br', A: 'a' }
  function sanitizePaste(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const out = document.createElement('div')
    const copy = (from, to) => {
      for (const node of from.childNodes) {
        if (node.nodeType === 3) to.appendChild(document.createTextNode(node.textContent))
        else if (node.nodeType === 1) {
          const tag = KEEP[node.tagName]
          if (!tag) {
            copy(node, to)
            if (/^(P|DIV|LI|H[1-6])$/.test(node.tagName))
              to.appendChild(document.createTextNode(' '))
            continue
          }
          const element = document.createElement(tag)
          const href = node.getAttribute('href')
          if (tag === 'a' && href && /^(https?:|mailto:|tel:|\/|#)/i.test(href))
            element.setAttribute('href', href)
          copy(node, element)
          to.appendChild(element)
        }
      }
    }
    copy(doc.body, out)
    return out.innerHTML.replace(/\s+/g, ' ').trim()
  }

  document.addEventListener('paste', (event) => {
    if (!active || !active.contains(event.target)) return
    event.preventDefault()
    const html = event.clipboardData.getData('text/html')
    if (html) document.execCommand('insertHTML', false, sanitizePaste(html))
    else
      document.execCommand(
        'insertText',
        false,
        event.clipboardData.getData('text/plain').replace(/\s+/g, ' ')
      )
  })

  // Nothing but text may be dropped into the page.
  document.addEventListener('drop', (event) => event.preventDefault(), true)

  window.addEventListener('scroll', placeToolbar, { passive: true })
  window.addEventListener('resize', placeToolbar)
  window.addEventListener('scroll', placeItembar, { passive: true })
  window.addEventListener('resize', placeItembar)

  // ---------- Messages from the app ----------

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || !event.data || event.data.target !== 'sitecms') return
    const message = event.data
    if (message.type === 'apply') {
      // Saved drafts: lists first (they add and remove elements), then this page's own edits,
      // then edits to shared components made elsewhere.
      for (const [id, order] of Object.entries(message.lists || {})) {
        const list = document.querySelector(`[${LIST}="${CSS.escape(id)}"]`)
        if (list) applyList(list, order)
      }
      const find = (id) => document.querySelector(`[${ATTR}="${CSS.escape(id)}"]`)
      for (const change of message.inherited || []) {
        const element = find(change.id)
        if (!element) continue
        if (change.html !== undefined) element.innerHTML = change.html
        for (const [name, value] of Object.entries(change.attrs || {})) {
          if (value === null) element.removeAttribute(name)
          else element.setAttribute(name, value)
        }
        inherited.set(change.id, cleanHtml(element))
        element.setAttribute(INHERITED, '')
      }
      for (const change of message.own || []) {
        const element = find(change.id)
        if (!element) continue
        if (change.html !== undefined) element.innerHTML = change.html
        for (const [name, value] of Object.entries(change.attrs || {})) {
          const changes = attrChanges.get(change.id) || {}
          changes[name] = value
          attrChanges.set(change.id, changes)
          if (value === null) element.removeAttribute(name)
          else element.setAttribute(name, value)
        }
        const now = changeFor(element)
        if (now) {
          drafts.set(change.id, now)
          element.setAttribute(CHANGED, '')
          element.removeAttribute(INHERITED)
        }
      }
    } else if (message.type === 'focus-component') {
      const component = document.querySelector(`[${COMPONENT}="${CSS.escape(message.id)}"]`)
      if (!component) return
      component.scrollIntoView({ block: 'center' })
      component.setAttribute('data-cms-flash', '')
      setTimeout(() => component.removeAttribute('data-cms-flash'), 1300)
    } else if (message.type === 'set-image') {
      const element = document.querySelector(`img[${ATTR}="${CSS.escape(message.id)}"]`)
      if (!element) return
      for (const [name, value] of Object.entries(message.attrs)) setAttr(element, name, value)
    } else if (message.type === 'deselect') {
      deactivate()
      setComponent(null)
      setItem(null)
    }
  })

  // ---------- Start ----------

  function start() {
    // FAQ answers and other collapsed content: shown, since clicking a summary doesn't toggle it here.
    for (const details of document.querySelectorAll('details:not([open])')) {
      details.setAttribute(OPENED, '')
      details.open = true
    }
    document.body.appendChild(toolbar)
    document.body.appendChild(itembar)
    for (const list of document.querySelectorAll(`[${LIST}]`))
      list.setAttribute(COUNT, String(itemsOf(list).length))
    const editable = document.querySelectorAll(`[${ATTR}]`)
    for (const element of editable) {
      if (element.tagName !== 'IMG') originals.set(element.getAttribute(ATTR), cleanHtml(element))
    }
    post({ type: 'ready', editable: editable.length })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
