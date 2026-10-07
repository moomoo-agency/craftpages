/**
 * Runs inside the page-editor iframe (the only script allowed there). Makes
 * text elements editable on click, keeps a mini toolbar for bold / italic /
 * link, and talks to the app through postMessage:
 *
 *   → parent: ready, draft (every change, live), select, image, component, shortcut
 *   ← parent: apply (saved drafts on load), set-image, select-image, deselect, focus-component,
 *             strings (the app's language and the OS shortcut modifier)
 *
 * Keyboard: Tab moves between editable elements, Enter edits (or opens an image), Escape
 * stops editing and keeps focus there. Each focus is reported so the app can announce it.
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
  /** tabindex the editor added so an element can be reached by keyboard; removed when saved. */
  const TAB = 'data-cms-tab'
  /** A <details> the editor opened so its content can be edited; closed again in saved HTML. */
  const OPENED = 'data-cms-opened'
  const LIST = 'data-cms-list'
  const ITEM = 'data-cms-item' // original item: its index in the file
  const NEW = 'data-cms-new' // new item: the index of the item it was copied from
  const ITEM_ACTIVE = 'data-cms-item-active'
  const COUNT = 'data-cms-count' // items the list has in the file
  /** A hidden slide (stacked or scrolled away) shown while its image is being edited. */
  const PEEK = 'data-cms-peek'
  /**
   * Not a real attribute: the href of the link around an image (a gallery's full-size
   * version). Changing the image changes the link too; the app saves it on the <a>.
   */
  const LINK_HREF = 'link:href'
  let activeItem = null
  let cloneIds = 0
  const originals = new Map() // id → clean innerHTML of the file
  const attrChanges = new Map() // id → { name: value | null }
  const inherited = new Map() // id → html applied from a shared-component edit on another page
  const drafts = new Map() // id → this page's own change
  let active = null
  let activeComponent = null

  const post = (message) => window.parent.postMessage({ source: 'sitecms', ...message }, '*')

  /** Texts in the app's language, sent by the app once the page is ready; English until then. */
  let strings = {
    bold: 'Bold',
    italic: 'Italic',
    link: 'Link',
    applyLink: 'Apply link',
    clear: 'Clear formatting',
    moveUp: 'Move up',
    moveDown: 'Move down',
    duplicate: 'Duplicate: add one like this',
    remove: 'Delete',
    noPage: 'No page of this site has this address.',
    home: 'Home',
    edited: 'Edited · not saved yet',
    linkPlaceholder: 'https://… or /page/',
    deleted: 'Item deleted',
    moved: 'Item moved',
    revertShort: 'Revert',
    enterToEdit: 'Enter to edit',
    enterToChange: 'Enter to change',
    revert: 'Revert this element',
    duplicated: 'Item added',
    undo: 'Undo'
  }
  /** ⌘ on macOS, Ctrl+ elsewhere. */
  let mod = /Mac/.test(navigator.userAgent) ? '⌘' : 'Ctrl+'
  const isMac = /Mac/.test(navigator.userAgent)

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
    PEEK,
    'contenteditable',
    'spellcheck'
  ]
  /** Removes the editor's markers from a node (and the tabindex it added, never the page's own). */
  function strip(node) {
    if (node.hasAttribute(TAB)) node.removeAttribute('tabindex')
    node.removeAttribute(TAB)
    INTERNAL.forEach((name) => node.removeAttribute(name))
  }

  function cleanHtml(element) {
    const clone = element.cloneNode(true)
    for (const node of clone.querySelectorAll(`[${OPENED}]`)) node.removeAttribute('open')
    for (const node of clone.querySelectorAll('*')) strip(node)
    return clone.innerHTML
  }

  /** An element's own HTML without editor markers (a new list item, as it will be saved). */
  function cleanOuter(element) {
    const clone = element.cloneNode(true)
    for (const node of clone.querySelectorAll(`[${OPENED}]`)) node.removeAttribute('open')
    for (const node of [clone, ...clone.querySelectorAll('*')]) strip(node)
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
    for (const node of [clone, ...clone.querySelectorAll('*')]) strip(node)
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
    [${ATTR}]:hover { outline: 1px dashed rgba(54, 81, 232, .7); outline-offset: 2px; }
    [${ATTR}][contenteditable="true"] { outline: 2px solid #3651e8 !important; outline-offset: 2px;
      box-shadow: 0 0 0 4px #fff !important; }
    [${ATTR}]:focus { outline: none; }
    /* Two tones (cobalt on a white halo): visible on light and dark sites alike. */
    [${ATTR}]:focus-visible,
    [${ATTR}] :is(a, button):focus-visible { outline: 2px solid #3651e8; outline-offset: 2px; box-shadow: 0 0 0 4px #fff; }
    #cms-undo { position: fixed; z-index: 2147483647; left: 50%; bottom: 16px; transform: translateX(-50%);
      display: none; align-items: center; gap: 12px; padding: 6px 6px 6px 14px; background: #fff;
      border-radius: 8px; box-shadow: 0 0 0 1px rgba(16,18,24,.10), 0 4px 12px rgba(16,18,24,.12); color: #17181b;
      font: 13px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    #cms-undo button { all: unset; padding: 6px 10px; border-radius: 5px; color: #3651e8; font-weight: 600;
      cursor: pointer; }
    #cms-undo button:hover { background: #e8ecff; }
    #cms-undo button:focus-visible { outline: 2px solid #3651e8; outline-offset: 1px; }
    [${CHANGED}] { outline: 2px solid #c77700; outline-offset: 2px; }
    [${INHERITED}] { outline: 2px dashed #c77700; outline-offset: 2px; }
    /* A selected shared part: cobalt, like selection. Amber stays for edits. */
    [${COMPONENT_ACTIVE}] { outline: 2px dashed rgba(54, 81, 232, .65) !important; outline-offset: -2px; }
    @keyframes cms-flash { from { box-shadow: inset 0 0 0 9999px rgba(199, 119, 0, .22); } }
    [data-cms-flash] { animation: cms-flash 1.2s ease-out; }
    img[${ATTR}] { cursor: pointer; }
    #cms-toolbar { position: fixed; z-index: 2147483647; display: none; flex-wrap: wrap; align-items: center;
      max-width: calc(100vw - 16px); box-sizing: border-box; gap: 2px; padding: 4px;
      background: #fff; border-radius: 8px; box-shadow: 0 0 0 1px rgba(16,18,24,.10), 0 4px 12px rgba(16,18,24,.12);
      font: 13px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #17181b; }
    #cms-toolbar button { all: unset; min-width: 28px; height: 28px; padding: 0 6px; box-sizing: border-box;
      display: inline-flex; align-items: center; justify-content: center; gap: 4px; border-radius: 5px;
      cursor: pointer; color: #17181b; }
    #cms-toolbar button:hover { background: #f0f1f4; }
    #cms-toolbar button.is-on { background: #e8ecff; color: #3651e8; }
    #cms-toolbar .cms-btn-label { font-size: 12px; font-weight: 500; }
    #cms-toolbar button[data-tip]:is(:hover, :focus-visible)::after { content: attr(data-tip); position: absolute; top: calc(100% + 6px);
      left: 50%; transform: translateX(-50%); padding: 4px 8px; border-radius: 5px; background: #1b1c1f;
      color: #fff; font-size: 12px; white-space: nowrap; pointer-events: none; }
    #cms-toolbar button { position: relative; }
    #cms-toolbar input { all: unset; width: 220px; height: 28px; padding: 0 8px; box-sizing: border-box;
      background: #f0f1f4; border-radius: 5px; color: #17181b; }
    #cms-toolbar [hidden] { display: none !important; }
    #cms-toolbar .cms-sep { width: 1px; margin: 4px 2px; background: rgba(16,18,24,.12); }
    #cms-toolbar input.is-unknown { box-shadow: inset 0 0 0 1px #9a5200; }
    /* A shared part shows itself on hover: its whole outline, and a small tag with its reach. */
    [${COMPONENT}]:hover { outline: 1px dashed rgba(54, 81, 232, .4); outline-offset: -1px; }
    #cms-shared-tag { position: fixed; z-index: 2147483644; display: none; padding: 2px 8px; border-radius: 999px;
      background: #fff; color: #5b606b; box-shadow: 0 0 0 1px rgba(16,18,24,.10), 0 2px 6px rgba(16,18,24,.10);
      font: 500 11.5px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; pointer-events: none;
      white-space: nowrap; }
    #cms-key-hint { position: fixed; z-index: 2147483645; display: none; padding: 2px 8px; border-radius: 5px;
      background: #1b1c1f; color: #fff; font: 600 11.5px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      pointer-events: none; white-space: nowrap; }
    #cms-scope-chip { all: unset; position: fixed; z-index: 2147483646; display: none; align-items: center;
      box-sizing: border-box; max-width: calc(100vw - 16px); padding: 3px 10px; border-radius: 999px;
      background: #fff; color: #2b43cc; box-shadow: 0 0 0 1px rgba(54, 81, 232, .55), 0 2px 6px rgba(16,18,24,.10);
      font: 600 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
    #cms-scope-chip:hover { background: #e8ecff; }
    /* While text is being edited the chip leads the toolbar, so the two never overlap. */
    #cms-scope-chip.is-docked { position: relative; margin-right: 4px; max-width: 100%; }
    #cms-scope-chip:focus-visible { outline: 2px solid #3651e8; outline-offset: 2px; }
    #cms-scope-pop { position: fixed; z-index: 2147483647; box-sizing: border-box; width: max-content;
      max-width: min(340px, calc(100vw - 16px)); padding: 12px; border-radius: 10px; background: #fff;
      color: #17181b; box-shadow: 0 0 0 1px rgba(16,18,24,.10), 0 4px 12px rgba(16,18,24,.12);
      font: 13px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    #cms-scope-pop[hidden] { display: none; }
    #cms-scope-pop .cms-scope__text { margin: 0 0 10px; font-weight: 600; }
    #cms-scope-pop .cms-scope__hint { margin: 10px 0 0; color: #5b606b; font-size: 12px; }
    #cms-scope-pop .cms-scope__choice { display: flex; gap: 2px; padding: 2px; border-radius: 8px;
      background: #f0f1f4; }
    #cms-scope-pop .cms-scope__choice button { all: unset; flex: 1; box-sizing: border-box; padding: 6px 10px;
      border-radius: 6px; text-align: center; color: #5b606b; cursor: pointer; white-space: nowrap; }
    #cms-scope-pop .cms-scope__choice button[aria-checked="true"] { background: #fff; color: #3651e8;
      font-weight: 600; box-shadow: 0 1px 2px rgba(16,18,24,.12); }
    #cms-scope-pop .cms-scope__choice button:focus-visible { outline: 2px solid #3651e8; outline-offset: 1px; }
    /* The first-edit question: two plain answers side by side, neither highlighted. */
    #cms-scope-pop .cms-scope__choice.is-ask { gap: 8px; padding: 0; background: none; }
    #cms-scope-pop .cms-scope__choice.is-ask button { background: #fff; color: #17181b; font-weight: 500;
      box-shadow: 0 0 0 1px rgba(16,18,24,.18); }
    #cms-scope-pop .cms-scope__choice.is-ask button:hover { background: #e8ecff; color: #2b43cc; }
    #cms-toolbar .cms-state { display: none; align-items: center; padding: 0 8px 0 6px; color: #9a5200;
      font-size: 12px; font-weight: 600; white-space: nowrap; }
    #cms-toolbar.is-changed .cms-state { display: inline-flex; }
    #cms-toolbar button:focus-visible, #cms-itembar button:focus-visible, #cms-link-menu button:focus-visible {
      outline: 2px solid #3651e8; outline-offset: 1px; }
    #cms-link-menu { position: fixed; z-index: 2147483647; display: none; width: 320px; max-height: 280px;
      overflow: auto; padding: 4px; box-sizing: border-box; background: #fff; border-radius: 8px;
      box-shadow: 0 0 0 1px rgba(16,18,24,.10), 0 4px 12px rgba(16,18,24,.12); font: 13px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #17181b; }
    #cms-link-menu button { all: unset; display: block; width: 100%; padding: 6px 8px; box-sizing: border-box;
      border-radius: 5px; cursor: pointer; }
    #cms-link-menu button.is-on, #cms-link-menu button:hover { background: #e8ecff; color: #2b43cc; }
    #cms-link-menu .cms-title { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #cms-link-menu .cms-path { display: block; font: 11px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
      opacity: .7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #cms-link-menu .cms-note { padding: 6px 8px; color: #9a5200; }
    [${ITEM_ACTIVE}] { outline: 2px dashed rgba(54, 81, 232, .8) !important; outline-offset: 4px; }
    [${NEW}] { box-shadow: 0 0 0 1px #177a34; }
    [${PEEK}] { opacity: 1 !important; visibility: visible !important; }
    #cms-itembar { position: fixed; z-index: 2147483646; display: none; gap: 2px; padding: 3px;
      background: #fff; border-radius: 8px; box-shadow: 0 0 0 1px rgba(16,18,24,.10), 0 4px 12px rgba(16,18,24,.12);
      font: 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1b1c1f; }
    #cms-itembar button { all: unset; position: relative; display: inline-grid; place-items: center;
      width: 26px; height: 26px; border-radius: 5px; cursor: pointer; color: #1b1c1f; }
    #cms-itembar button:hover:not(:disabled) { background: #eef0f4; }
    #cms-itembar button:disabled { opacity: .35; cursor: default; }
    #cms-itembar button[data-act="delete"]:hover:not(:disabled) { background: #fce8e6; color: #c5221f; }
    #cms-itembar button[data-tip]:is(:hover, :focus-visible)::after { content: attr(data-tip); position: absolute; top: calc(100% + 6px);
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
    <span class="cms-state" role="status"></span>
    <button data-cmd="bold">${svg('M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z')}</button>
    <button data-cmd="italic">${svg('M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z')}</button>
    <button data-cmd="link">${svg('M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z')}</button>
    <input data-role="href" hidden>
    <button data-cmd="apply-link" hidden>${svg('M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z')}</button>
    <span class="cms-sep"></span>
    <button data-cmd="revert" hidden>${svg('M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62A7.95 7.95 0 0 1 12.5 10c3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 10.53 17.15 8 12.5 8z')}<span class="cms-btn-label"></span></button>
    <button data-cmd="clear">${svg('M3.27 5 2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.55 5.27 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z')}</button>
  `
  toolbar.setAttribute('role', 'toolbar')
  const hrefInput = toolbar.querySelector('[data-role="href"]')
  const stateChip = toolbar.querySelector('.cms-state')

  // Shared part (header, nav…): a quiet chip on its outline says where edits go and opens
  // the choice. The text toolbar stays for formatting only.
  const scopeChip = document.createElement('button')
  scopeChip.id = 'cms-scope-chip'
  scopeChip.type = 'button'
  scopeChip.setAttribute('aria-haspopup', 'dialog')
  scopeChip.setAttribute('aria-expanded', 'false')
  scopeChip.setAttribute('aria-keyshortcuts', 'Alt+Shift+S')
  const scopePop = document.createElement('div')
  scopePop.id = 'cms-scope-pop'
  scopePop.setAttribute('role', 'dialog')
  const scopeText = document.createElement('p')
  scopeText.className = 'cms-scope__text'
  scopeText.id = 'cms-scope-text'
  const scopeChoice = document.createElement('div')
  scopeChoice.className = 'cms-scope__choice'
  scopeChoice.setAttribute('role', 'radiogroup')
  scopeChoice.setAttribute('aria-describedby', 'cms-scope-text')
  const scopeAll = document.createElement('button')
  scopeAll.dataset.scope = 'all'
  const scopePage = document.createElement('button')
  scopePage.dataset.scope = 'page'
  for (const button of [scopeAll, scopePage]) {
    button.type = 'button'
    button.setAttribute('role', 'radio')
  }
  scopeChoice.append(scopeAll, scopePage)
  const scopeHint = document.createElement('p')
  scopeHint.className = 'cms-scope__hint'
  scopePop.append(scopeText, scopeChoice, scopeHint)
  scopePop.hidden = true
  // Arrow keys move between the two choices (one Tab stop for the group).
  scopeChoice.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const next = document.activeElement === scopeAll ? scopePage : scopeAll
    next.focus()
    // While the first-edit question is open, arrows only move between the two answers.
    if (!asking) next.click()
  })
  /** Sent by the app for the shared part being edited: names, notes and the current scope. */
  let componentInfo = null
  /** Where focus was before the popover opened, to return there. */
  let scopeReturn = null

  const scopeInfo = () => {
    const id = activeComponent && activeComponent.getAttribute(COMPONENT)
    return componentInfo && componentInfo.id === id ? componentInfo : null
  }

  function setScope(info, scope) {
    info.scope = scope
    renderScope()
    post({ type: 'scope', id: info.id, scope })
  }

  function renderScope() {
    const info = scopeInfo()
    scopeChip.style.display = info ? 'inline-flex' : 'none'
    // Docked: the chip leads the text toolbar while text is edited, so they never overlap.
    const docked = !!(info && active)
    if (docked && scopeChip.parentNode !== toolbar) toolbar.prepend(scopeChip)
    if (!docked && scopeChip.parentNode === toolbar) document.body.appendChild(scopeChip)
    scopeChip.classList.toggle('is-docked', docked)
    // Docked, it flows in the toolbar: no leftover offsets from its spot on the outline.
    if (docked) {
      scopeChip.style.left = ''
      scopeChip.style.top = ''
      scopeChip.style.visibility = ''
    }
    if (!info) return closeScope(false)
    const all = info.scope !== 'page'
    // Keyboard focus on a shared part: the chip carries "Enter to edit", so nothing covers it.
    scopeChip.textContent = `${chipHint ? `${strings.enterToEdit} · ` : ''}${info.name} · ${
      all ? info.chipAll : info.chipPage
    } ▾`
    scopeChip.setAttribute('aria-label', `${info.name}: ${all ? info.allNote : info.pageNote}`)
    scopeChip.title = info.keyHint
    scopePop.setAttribute('aria-label', info.label)
    scopeChoice.setAttribute('aria-label', info.label)
    scopeText.textContent = asking
      ? info.ask
      : `${info.name} · ${all ? info.allNote : info.pageNote}`
    scopeHint.textContent = info.hint
    scopeAll.textContent = info.all
    scopePage.textContent = info.page
    // Asked on a first edit: two plain answers, neither chosen yet. Otherwise a radio choice.
    scopeChoice.classList.toggle('is-ask', asking)
    scopeChoice.setAttribute('role', asking ? 'group' : 'radiogroup')
    for (const [button, on] of [
      [scopeAll, all],
      [scopePage, !all]
    ]) {
      button.setAttribute('role', asking ? 'button' : 'radio')
      if (asking) button.removeAttribute('aria-checked')
      else button.setAttribute('aria-checked', String(on))
      button.tabIndex = asking || on ? 0 : -1
    }
    placeScope()
  }

  /** The chip sits on the part's outline (above it, or below when there's no room). */
  function placeScope() {
    if (!scopeInfo() || !activeComponent || !activeComponent.isConnected) return
    if (scopeChip.classList.contains('is-docked')) return placeScopePop()
    const rect = activeComponent.getBoundingClientRect()
    const width = document.documentElement.clientWidth
    const visible = rect.bottom > 0 && rect.top < window.innerHeight
    scopeChip.style.visibility = visible ? 'visible' : 'hidden'
    const chipW = scopeChip.offsetWidth
    const chipH = scopeChip.offsetHeight
    const left = Math.max(8, Math.min(rect.right - chipW, width - chipW - 8))
    const above = rect.top - chipH - 4
    const top = above >= 8 ? above : Math.min(rect.bottom + 4, window.innerHeight - chipH - 8)
    scopeChip.style.left = `${left}px`
    scopeChip.style.top = `${Math.max(8, top)}px`
    placeScopePop()
  }

  function placeScopePop() {
    const width = document.documentElement.clientWidth
    if (scopePop.hidden) return
    const popW = scopePop.offsetWidth
    const popH = scopePop.offsetHeight
    const chip = scopeChip.getBoundingClientRect()
    const below = chip.bottom + 6
    scopePop.style.left = `${Math.max(8, Math.min(chip.right - popW, width - popW - 8))}px`
    scopePop.style.top = `${below + popH <= window.innerHeight - 8 ? below : Math.max(8, chip.top - popH - 6)}px`
  }

  /** Text the first edit in a shared part waits for, until where edits go is chosen. */
  let pendingEdit = null
  let asking = false
  let pendingTimer = null

  /** First edit in a shared part on this page: ask where edits go before anything changes. */
  function askScope() {
    asking = true
    renderScope()
    openScope()
  }

  /** The question is answered (or kept with Escape): edit the text that was waiting. */
  function answerScope(info, scope) {
    asking = false
    info.decided = true
    setScope(info, scope)
    closeScope(false)
    const element = pendingEdit
    pendingEdit = null
    if (element && element.isConnected) activate(element)
  }

  function openScope() {
    if (!scopeInfo()) return
    scopeReturn = document.activeElement
    scopePop.hidden = false
    scopeChip.setAttribute('aria-expanded', 'true')
    placeScope()
    ;(asking || scopeInfo().scope === 'page' ? scopePage : scopeAll).focus()
  }

  function closeScope(returnFocus = true) {
    if (scopePop.hidden) return
    scopePop.hidden = true
    scopeChip.setAttribute('aria-expanded', 'false')
    if (returnFocus && scopeReturn && scopeReturn.isConnected) scopeReturn.focus()
    scopeReturn = null
    if (asking) {
      // Closed without an answer (a click elsewhere): nothing was edited, nothing is kept.
      asking = false
      pendingEdit = null
      renderScope()
    }
  }

  scopeChip.addEventListener('mousedown', (event) => event.preventDefault())
  scopeChip.addEventListener('click', () => (scopePop.hidden ? openScope() : closeScope()))
  scopePop.addEventListener('mousedown', (event) => {
    if (event.target.closest('button') === null) event.preventDefault()
  })
  scopePop.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      // Asked on a first edit, Escape is "never mind": nothing is chosen and nothing edited.
      closeScope()
    }
  })
  scopeChoice.addEventListener('click', (event) => {
    const button = event.target.closest('button')
    const info = scopeInfo()
    if (!button || !info) return
    const before = info.scope || 'all'
    const scope = button.dataset.scope
    if (asking) {
      answerScope(info, scope)
      if (scope === 'page') offerUndo(info.forked, () => setScope(info, before))
      return
    }
    if (scope === before) return
    setScope(info, scope)
    // Leaving the shared version is a real decision: say what it means, and offer the way back.
    if (scope === 'page') offerUndo(info.forked, () => setScope(info, before))
    else hideUndo()
  })
  // "Enter to edit": shown next to an editable element that keyboard focus lands on (screen
  // readers hear it from the app; this is the same hint for the eye).
  const keyHint = document.createElement('div')
  keyHint.id = 'cms-key-hint'
  keyHint.setAttribute('aria-hidden', 'true')
  // Hovering a shared part: a quiet tag says it's shared and how far, before any click.
  /** Labels of the page's shared parts by id ("Navigation · shared by 10 pages"), from the app. */
  let sharedTags = {}
  const sharedTag = document.createElement('div')
  sharedTag.id = 'cms-shared-tag'
  sharedTag.setAttribute('aria-hidden', 'true')
  let hoveredPart = null
  function showSharedTag(part) {
    hoveredPart = part
    const label = part && part !== activeComponent && sharedTags[part.getAttribute(COMPONENT)]
    if (!label) return (sharedTag.style.display = 'none')
    sharedTag.textContent = label
    sharedTag.style.display = 'block'
    const rect = part.getBoundingClientRect()
    const width = sharedTag.offsetWidth
    const height = sharedTag.offsetHeight
    const above = rect.top - height - 4
    sharedTag.style.top = `${above >= 4 ? above : Math.max(4, rect.top + 4)}px`
    sharedTag.style.left = `${Math.max(4, Math.min(rect.right - width, document.documentElement.clientWidth - width - 4))}px`
  }
  document.addEventListener('mouseover', (event) => {
    const part = event.target.nodeType === 1 ? event.target.closest(`[${COMPONENT}]`) : null
    if (part !== hoveredPart) showSharedTag(part)
  })
  document.addEventListener('mouseleave', () => showSharedTag(null))

  /** The hint shown inside the scope chip instead (a shared part in keyboard focus). */
  let chipHint = false
  function showKeyHint(element) {
    if (element.closest(`[${COMPONENT}]`) && element.tagName !== 'IMG') {
      chipHint = true
      keyHint.style.display = 'none'
      return
    }
    keyHint.textContent = element.tagName === 'IMG' ? strings.enterToChange : strings.enterToEdit
    keyHint.style.display = 'block'
    const rect = element.getBoundingClientRect()
    const height = keyHint.offsetHeight
    const top = rect.top - height - 8
    keyHint.style.top = `${top >= 4 ? top : rect.bottom + 8}px`
    keyHint.style.left = `${Math.max(4, Math.min(rect.left, document.documentElement.clientWidth - keyHint.offsetWidth - 4))}px`
  }
  function hideKeyHint() {
    keyHint.style.display = 'none'
    if (!chipHint) return
    chipHint = false
    renderScope()
  }

  /** Screen elements of the editor itself (not the page): clicks there keep the selection. */
  const isEditorUi = (node) =>
    toolbar.contains(node) || scopeChip.contains(node) || scopePop.contains(node)

  const applyLink = toolbar.querySelector('[data-cmd="apply-link"]')
  let savedRange = null
  let linkMode = 'inline' // 'inline' = link on the selection; 'self' = href of the edited <a> itself

  // Keep the text selection when the toolbar is clicked (except in the URL field).
  toolbar.addEventListener('mousedown', (event) => {
    if (event.target !== hrefInput) event.preventDefault()
  })

  /** How much other editable content a strip of the page holds (what the toolbar would hide). */
  function covered(top, left, width, height) {
    let hits = 0
    // The scope chip of a shared part counts as content not to cover.
    if (scopeChip.style.display !== 'none') {
      const chip = scopeChip.getBoundingClientRect()
      if (
        chip.left < left + width &&
        chip.right > left &&
        chip.top < top + height &&
        chip.bottom > top
      )
        hits += 9
    }
    for (const y of [top + 4, top + height / 2, top + height - 4]) {
      for (const x of [left + 8, left + width / 2, left + width - 8]) {
        const hit = document
          .elementsFromPoint(x, y)
          .some(
            (node) =>
              !toolbar.contains(node) &&
              node.hasAttribute(ATTR) &&
              node !== active &&
              !node.contains(active) &&
              !active.contains(node)
          )
        if (hit) hits++
      }
    }
    return hits
  }

  function placeToolbar() {
    if (!active) return
    const rect = active.getBoundingClientRect()
    toolbar.style.display = 'flex'
    // Measure at the left edge: a fixed element shrinks to the room left of its position.
    toolbar.style.left = '0px'
    toolbar.style.top = '0px'
    toolbar.style.maxWidth = `${document.documentElement.clientWidth - 16}px`
    const height = toolbar.offsetHeight
    const width = toolbar.offsetWidth
    // clientWidth: the visible width, without the page's scrollbar.
    const clampX = (x) => Math.max(8, Math.min(x, document.documentElement.clientWidth - width - 8))
    const above = rect.top - height - 10
    const below = rect.bottom + 10
    // Candidates in order of preference: above-left, above-right, below-left, below-right.
    // The first that hides the least other text wins; off-screen spots don't count.
    const spots = []
    for (const top of [above, below]) {
      if (top < 8 || top + height > window.innerHeight - 8) continue
      for (const left of [clampX(rect.left), clampX(rect.right - width)]) spots.push({ top, left })
    }
    let best = spots[0] || { top: rect.bottom + 10, left: clampX(rect.left) }
    let fewest = Infinity
    for (const spot of spots) {
      const hits = covered(spot.top, spot.left, width, height)
      if (hits < fewest) {
        fewest = hits
        best = spot
      }
      if (hits === 0) break
    }
    toolbar.style.top = `${best.top}px`
    toolbar.style.left = `${best.left}px`
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
    renderLinkMenu(show)
  }

  // ---------- Link suggestions: the site's pages ----------

  /** Pages a link can point to, sent by the app: { path: 'about/index.html', title }. */
  let sitePages = []
  /** This page's site path, to write links relative to it. */
  let currentPath = ''
  let menuItems = []
  let menuIndex = -1
  const linkMenu = document.createElement('div')
  linkMenu.id = 'cms-link-menu'
  linkMenu.setAttribute('role', 'listbox')
  linkMenu.addEventListener('mousedown', (event) => event.preventDefault())

  /** How a page is linked: folders end in a slash (about/), files keep their name. */
  const addressOf = (path) => path.replace(/(^|\/)index\.html?$/, '$1')

  /** The link to a page, in the style of what's typed: /about/ stays rooted, else relative. */
  function hrefTo(path, rooted) {
    const target = addressOf(path)
    if (rooted) return '/' + target
    const from = currentPath.split('/').slice(0, -1)
    const to = target.split('/')
    let same = 0
    while (same < from.length && same < to.length - 1 && from[same] === to[same]) same++
    const href = '../'.repeat(from.length - same) + to.slice(same).join('/')
    return href || './'
  }

  /** The page an internal href points to, or undefined when it's another site, a file or an anchor. */
  function pageOfHref(href) {
    if (!href || /^(#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return undefined
    let url
    try {
      url = new URL(href, 'http://site.local/' + currentPath)
    } catch {
      return undefined
    }
    if (url.origin !== 'http://site.local') return undefined
    const path = decodeURI(url.pathname).replace(/^\//, '')
    // Not a page (an image, a PDF…): nothing to check.
    if (path && !/(\.html?$|\/$)/.test(path) && /\.[a-z0-9]+$/i.test(path)) return undefined
    const want = addressOf(path).replace(/\/$/, '')
    return sitePages.find((page) => addressOf(page.path).replace(/\/$/, '') === want) || null
  }

  function placeLinkMenu() {
    const rect = toolbar.getBoundingClientRect()
    const below = rect.bottom + 4
    const height = Math.min(280, linkMenu.scrollHeight)
    linkMenu.style.top = `${below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 4) : below}px`
    linkMenu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 328))}px`
  }

  function renderLinkMenu(show = !hrefInput.hidden) {
    const value = hrefInput.value.trim()
    const external = /^(#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)
    const query = value.toLowerCase()
    menuItems =
      show && !external
        ? sitePages.filter(
            (page) =>
              !query ||
              page.title.toLowerCase().includes(query) ||
              addressOf(page.path)
                .toLowerCase()
                .includes(query.replace(/^(\.\.\/|\.\/|\/)+/, ''))
          )
        : []
    // What's typed is already a page's address: nothing to suggest but that page.
    const exact = value && pageOfHref(value)
    if (exact) menuItems = [exact]
    menuIndex = Math.min(menuIndex, menuItems.length - 1)
    const unknown = Boolean(show && value && !external && exact === null)
    hrefInput.classList.toggle('is-unknown', unknown)
    hrefInput.title = unknown ? strings.noPage : ''
    linkMenu.replaceChildren(
      ...menuItems.slice(0, 50).map((page, i) => {
        const item = document.createElement('button')
        item.type = 'button'
        item.setAttribute('role', 'option')
        if (i === menuIndex) item.className = 'is-on'
        const title = document.createElement('span')
        title.className = 'cms-title'
        title.textContent = page.title || addressOf(page.path) || strings.home
        const path = document.createElement('span')
        path.className = 'cms-path'
        path.textContent = '/' + addressOf(page.path)
        item.append(title, path)
        item.addEventListener('click', () => pickPage(page))
        return item
      })
    )
    if (unknown && !menuItems.length) {
      const note = document.createElement('div')
      note.className = 'cms-note'
      note.textContent = strings.noPage
      linkMenu.append(note)
    }
    linkMenu.style.display = show && linkMenu.childNodes.length ? 'block' : 'none'
    if (linkMenu.style.display === 'block') placeLinkMenu()
  }

  function pickPage(page) {
    hrefInput.value = hrefTo(page.path, hrefInput.value.trim().startsWith('/'))
    commitLink()
  }

  hrefInput.addEventListener('input', () => {
    menuIndex = -1
    renderLinkMenu()
  })
  hrefInput.addEventListener('blur', () => {
    linkMenu.style.display = 'none'
  })
  hrefInput.addEventListener('focus', () => renderLinkMenu())

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
    renderScope()
    // Headings are bold by design: Bold would show as on and mean nothing.
    const heading = /^H[1-6]$/.test(active.tagName)
    toolbar.querySelector('[data-cmd="bold"]').hidden = heading
    toolbar.querySelector('[data-cmd="italic"]').hidden = heading
    toolbar.classList.toggle('is-changed', active.hasAttribute(CHANGED))
    toolbar.querySelector('[data-cmd="revert"]').hidden =
      !active.hasAttribute(CHANGED) || inNewItem(active)
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
    } else if (cmd === 'revert') {
      revertElement(active)
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
    const open = linkMenu.style.display === 'block' && menuItems.length > 0
    if (open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      const count = Math.min(menuItems.length, 50)
      menuIndex = (menuIndex + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
      renderLinkMenu()
      linkMenu.children[menuIndex]?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (open && menuIndex >= 0) pickPage(menuItems[menuIndex])
      else commitLink()
    } else if (event.key === 'Escape') {
      if (open && menuIndex >= 0) {
        menuIndex = -1
        linkMenu.style.display = 'none'
        return
      }
      showLinkField(false)
      active && active.focus()
    }
  })

  // ---------- Repeating lists ----------

  const itembar = document.createElement('div')
  itembar.id = 'cms-itembar'
  itembar.innerHTML = `
    <button data-act="up">${svg('M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z')}</button>
    <button data-act="down">${svg('M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z')}</button>
    <button data-act="duplicate">${svg('M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z')}</button>
    <button data-act="delete">${svg('M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z')}</button>
  `
  itembar.addEventListener('mousedown', (event) => event.preventDefault())

  /** Puts the current language and shortcut modifier on every button. */
  function label(button, text, keys, aria) {
    button.setAttribute('aria-label', text)
    button.dataset.tip = keys ? `${text} · ${keys}` : text
    if (keys) button.setAttribute('aria-keyshortcuts', aria || keys.replace('⌘', 'Meta+'))
  }
  // A short-lived "Item deleted · Undo" bar after deleting or adding a list item.
  const undoBar = document.createElement('div')
  undoBar.id = 'cms-undo'
  undoBar.setAttribute('role', 'status')
  const undoText = document.createElement('span')
  const undoButton = document.createElement('button')
  undoButton.type = 'button'
  undoBar.append(undoText, undoButton)
  let undoAction = null
  /** Offers to undo the last structural change until the next one (no timer to race). */
  function offerUndo(text, action) {
    undoAction = action
    undoText.textContent = text
    undoBar.style.display = 'flex'
  }
  function hideUndo() {
    undoAction = null
    undoBar.style.display = 'none'
  }
  undoButton.addEventListener('click', () => {
    const action = undoAction
    hideUndo()
    if (action) action()
  })

  /** Alt+Shift item shortcuts as the OS writes them (⌥⇧ on macOS). */
  const itemKeys = (key) => (isMac ? `⌥⇧${key}` : `Alt+Shift+${key}`)
  function applyStrings() {
    const q = (root, selector) => root.querySelector(selector)
    label(q(toolbar, '[data-cmd="bold"]'), strings.bold, `${mod}B`)
    label(q(toolbar, '[data-cmd="italic"]'), strings.italic, `${mod}I`)
    label(q(toolbar, '[data-cmd="link"]'), strings.link)
    label(q(toolbar, '[data-cmd="apply-link"]'), strings.applyLink, 'Enter')
    label(q(toolbar, '[data-cmd="clear"]'), strings.clear)
    label(q(toolbar, '[data-cmd="revert"]'), strings.revert)
    q(toolbar, '[data-cmd="revert"] .cms-btn-label').textContent = strings.revertShort
    label(q(itembar, '[data-act="up"]'), strings.moveUp, itemKeys('↑'), 'Alt+Shift+ArrowUp')
    label(q(itembar, '[data-act="down"]'), strings.moveDown, itemKeys('↓'), 'Alt+Shift+ArrowDown')
    label(q(itembar, '[data-act="duplicate"]'), strings.duplicate, itemKeys('D'), 'Alt+Shift+D')
    label(q(itembar, '[data-act="delete"]'), strings.remove, itemKeys('⌫'), 'Alt+Shift+Backspace')
    undoButton.textContent = strings.undo
    hrefInput.placeholder = strings.linkPlaceholder
    hrefInput.setAttribute('aria-label', strings.link)
    stateChip.textContent = strings.edited
  }
  applyStrings()

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

  /** Moves, duplicates or deletes a list item; deleting and adding can be undone. */
  /** `quiet`: an undo itself, which doesn't offer another undo. */
  function itemAction(act, item, quiet = false) {
    const list = item.parentElement
    const items = itemsOf(list)
    const index = items.indexOf(item)
    if (!quiet) hideUndo()
    deactivate()
    if (act === 'up' && index > 0) {
      const gap = gapBefore(item)
      list.insertBefore(item, items[index - 1])
      if (gap) list.insertBefore(gap, items[index - 1])
    } else if (act === 'down' && index < items.length - 1) {
      const next = items[index + 1]
      const gap = gapBefore(next)
      list.insertBefore(next, item)
      if (gap) list.insertBefore(gap, item)
    }
    if ((act === 'up' && index > 0) || (act === 'down' && index < items.length - 1)) {
      if (!quiet)
        offerUndo(strings.moved, () => {
          itemAction(act === 'up' ? 'down' : 'up', item, true)
          setItem(item)
        })
    } else if (act === 'duplicate') {
      const copy = item.cloneNode(true)
      copy.setAttribute(NEW, item.getAttribute(NEW) ?? item.getAttribute(ITEM))
      copy.removeAttribute(ITEM)
      copy.removeAttribute(ITEM_ACTIVE)
      renumber(copy)
      const gap = gapBefore(item) || (items[1] && gapBefore(items[1]))
      item.after(copy)
      const copyGap = gap ? gap.cloneNode() : null
      if (copyGap) item.after(copyGap)
      setItem(copy)
      copy.scrollIntoView({ block: 'nearest' })
      sendDraft()
      offerUndo(strings.duplicated, () => {
        if (copyGap) copyGap.remove()
        copy.remove()
        setItem(item.isConnected ? item : null)
        sendDraft()
      })
      return copy
    } else if (act === 'delete' && items.length > 1) {
      // Edits inside a deleted item go with it (and come back with an undo).
      const removed = new Map()
      for (const node of [item, ...item.querySelectorAll(`[${ATTR}]`)]) {
        const id = node.getAttribute(ATTR)
        if (id && drafts.has(id)) removed.set(id, drafts.get(id))
        if (id) drafts.delete(id)
      }
      const gap = gapBefore(item)
      const anchor = item.nextSibling
      if (gap) gap.remove()
      item.remove()
      setItem(null)
      sendDraft()
      offerUndo(strings.deleted, () => {
        list.insertBefore(item, anchor && anchor.parentNode === list ? anchor : null)
        if (gap) list.insertBefore(gap, item)
        for (const [id, change] of removed) drafts.set(id, change)
        setItem(item)
        item.scrollIntoView({ block: 'nearest' })
        sendDraft()
      })
      return null
    } else return item
    placeItembar()
    item.scrollIntoView({ block: 'nearest' })
    sendDraft()
    return item
  }

  itembar.addEventListener('click', (event) => {
    const button = event.target.closest('button')
    if (!button || button.disabled || !activeItem) return
    itemAction(button.dataset.act, activeItem)
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
    if (element === active) toolbar.classList.toggle('is-changed', element.hasAttribute(CHANGED))
    sendDraft()
  }

  function setComponent(element) {
    const component = element ? element.closest(`[${COMPONENT}]`) : null
    if (component === activeComponent) return
    if (activeComponent) activeComponent.removeAttribute(COMPONENT_ACTIVE)
    activeComponent = component
    if (component) component.setAttribute(COMPONENT_ACTIVE, '')
    renderScope()
    if (hoveredPart) showSharedTag(hoveredPart)
    post({ type: 'component', id: component ? component.getAttribute(COMPONENT) : null })
  }

  /** Sets an attribute in the page; the link pseudo attribute goes on the surrounding <a>. */
  function applyAttr(element, name, value) {
    const target = name === LINK_HREF ? element.parentElement : element
    const real = name === LINK_HREF ? 'href' : name
    if (!target) return
    if (value === null) target.removeAttribute(real)
    else target.setAttribute(real, value)
  }

  /** The <a> around an image when it opens the image itself (lightbox galleries). */
  function imageLink(element) {
    const link = element.parentElement
    if (!link || link.tagName !== 'A' || link.querySelectorAll('img').length !== 1) return null
    const href = link.getAttribute('href') || ''
    return /\.(jpe?g|png|gif|webp|avif|svg)([?#].*)?$/i.test(href) ? link : null
  }

  /** Attribute values as they are in the file, kept before the first change. */
  const originalAttrs = new Map() // id → { name: value | null }
  function rememberAttr(element, name) {
    const id = element.getAttribute(ATTR)
    const saved = originalAttrs.get(id) || {}
    if (!(name in saved)) {
      const target = name === LINK_HREF ? element.parentElement : element
      const real = name === LINK_HREF ? 'href' : name
      saved[name] = target ? target.getAttribute(real) : null
      originalAttrs.set(id, saved)
    }
  }

  /** Puts one element back as it is in the file (or as a shared edit from another page left it). */
  function revertElement(element) {
    const id = element.getAttribute(ATTR)
    if (originals.has(id)) element.innerHTML = inherited.get(id) ?? originals.get(id)
    for (const [name, value] of Object.entries(originalAttrs.get(id) || {}))
      applyAttr(element, name, value)
    attrChanges.delete(id)
    markDirty(element)
    updateToolbarState()
    placeToolbar()
  }

  function setAttr(element, name, value) {
    if (!inNewItem(element)) rememberAttr(element, name)
    if (inNewItem(element)) {
      applyAttr(element, name, value)
      return sendDraft()
    }
    const id = element.getAttribute(ATTR)
    const changes = attrChanges.get(id) || {}
    changes[name] = value
    attrChanges.set(id, changes)
    applyAttr(element, name, value)
    markDirty(element)
  }

  // ---------- Images that are hidden or share a spot (sliders, galleries) ----------

  /** Whether an element can be seen: page scripts don't run here, so sliders stay stacked. */
  function isShown(element) {
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (style.display === 'none' || style.visibility === 'hidden') return false
      if (Number(style.opacity) < 0.05) return false
    }
    return true
  }

  /**
   * The editable element the user actually sees under the pointer. Fade sliders put every
   * slide in the same place and the invisible last one on top, so the click lands on it.
   */
  function shownTarget(event, target) {
    if (isShown(target)) return target
    const under = document
      .elementsFromPoint(event.clientX, event.clientY)
      .find((node) => node.hasAttribute(ATTR) && !toolbar.contains(node) && isShown(node))
    return under || target
  }

  /**
   * The images of the slider or gallery an image belongs to, in page order: the nearest
   * ancestor with at least two children of the same shape (tag and class) holding one
   * image each.
   */
  function imageGroup(image) {
    let branch = image
    for (let depth = 0; depth < 6 && branch.parentElement; depth++) {
      const container = branch.parentElement
      if (container === document.body) break
      const images = []
      for (const child of container.children) {
        if (child.tagName !== branch.tagName || child.className !== branch.className) continue
        const found = child.matches(`img[${ATTR}]`)
          ? [child]
          : Array.from(child.querySelectorAll(`img[${ATTR}]`))
        if (found.length === 1) images.push({ image: found[0], branch: child })
        else if (child === branch && found.length !== 1) return null
      }
      if (images.length >= 2) return images
      branch = container
    }
    return null
  }

  let peeked = null
  function peek(branch) {
    if (peeked === branch) return
    if (peeked) peeked.removeAttribute(PEEK)
    peeked = branch
    if (!branch) return
    if (!isShown(branch)) branch.setAttribute(PEEK, '')
    // Sliding carousels keep later slides out of view inside an overflow: hidden track.
    branch.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  function selectImage(image, reveal) {
    deactivate()
    setComponent(image)
    const group = imageGroup(image)
    const own = group && group.find((entry) => entry.image === image)
    if (reveal) peek(own ? own.branch : image)
    else if (peeked && !(own && peeked === own.branch)) peek(null)
    post({
      type: 'image',
      id: image.getAttribute(ATTR),
      src: image.getAttribute('src') || '',
      alt: image.getAttribute('alt') || '',
      width: image.naturalWidth,
      height: image.naturalHeight,
      group: group
        ? group.map((entry) => ({
            id: entry.image.getAttribute(ATTR),
            src: entry.image.getAttribute('src') || ''
          }))
        : []
    })
  }

  function activate(element) {
    if (active === element) return
    hideUndo()
    hideKeyHint()
    // A shared part not decided on this page yet: ask where edits go before any typing.
    const part = !inNewItem(element) && element.closest(`[${COMPONENT}]`)
    if (part) {
      const id = part.getAttribute(COMPONENT)
      const info = componentInfo && componentInfo.id === id ? componentInfo : null
      if (!info || !info.decided) {
        deactivate()
        setComponent(element)
        pendingEdit = element
        clearTimeout(pendingTimer)
        if (info) askScope()
        // The app answers with the part's details; without them (an error), edit as before.
        else
          pendingTimer = setTimeout(() => {
            if (pendingEdit !== element || (componentInfo && componentInfo.id === id)) return
            pendingEdit = null
            activateNow(element)
          }, 1500)
        return
      }
    }
    activateNow(element)
  }

  function activateNow(element) {
    deactivate()
    active = element
    setComponent(element)
    element.setAttribute('contenteditable', 'true')
    element.setAttribute('spellcheck', 'true')
    element.focus()
    placeToolbar()
    updateToolbarState()
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
      if (isEditorUi(event.target) || undoBar.contains(event.target)) return
      closeScope(false)
      // Links, buttons and forms must not navigate or submit while editing.
      if (event.target.closest('a, button, label, summary, [type="submit"]')) event.preventDefault()

      if (itembar.contains(event.target)) return
      const hit = event.target.closest(`[${ATTR}]`)
      const target = hit && shownTarget(event, hit)
      const select = target || event.target.closest('body *')
      if (select) post({ type: 'select', ...describe(select) })
      setItem(itemOf(event.target))

      if (!target) {
        setComponent(null)
        return deactivate()
      }
      if (target.tagName === 'IMG') return selectImage(target, false)
      peek(null)
      activate(target)
    },
    true
  )

  document.addEventListener('submit', (event) => event.preventDefault(), true)

  // Keyboard focus: moving away from the element being edited ends the edit; landing on an
  // editable element is reported, so the app can say what it is and how to edit it.
  /**
   * The editable element keyboard focus stands for: the element itself, or the editable
   * element around a focused link or button (a nav item's <a>).
   */
  function editableOf(node) {
    if (!node || node.nodeType !== 1 || isEditorUi(node) || undoBar.contains(node)) return null
    if (node.hasAttribute(ATTR)) return node
    return node.matches('a, button') ? node.closest(`[${ATTR}]`) : null
  }

  document.addEventListener('focusin', (event) => {
    const target = event.target
    if (active && !active.contains(target) && !isEditorUi(target) && !linkMenu.contains(target))
      deactivate()
    const editable = editableOf(target)
    hideKeyHint()
    if (!editable || editable === active || active?.contains(target)) return
    if (target.matches(':focus-visible')) showKeyHint(editable)
    // Keyboard focus selects the shared part too: its chip shows and ⌥⇧S reaches the choice.
    setComponent(editable)
    // Keyboard users see the item's buttons too (and can use their shortcuts).
    setItem(itemOf(editable))
    const tag = target.tagName === 'A' ? 'A' : editable.tagName
    post({
      type: 'focus',
      kind:
        tag === 'IMG' ? 'image' : /^H[1-6]$/.test(tag) ? 'heading' : tag === 'A' ? 'link' : 'text',
      text: (tag === 'IMG' ? editable.getAttribute('alt') || '' : editable.textContent || '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^(.{0,80})\s.*$/, '$1…')
    })
  })

  document.addEventListener('input', (event) => {
    if (active && active.contains(event.target)) markDirty(active)
  })

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      deactivate()
      return post({ type: 'shortcut', key: 'save' })
    }
    // Alt+Shift+S: where edits to the shared part in focus go.
    if (event.altKey && event.shiftKey && event.code === 'KeyS' && scopeInfo()) {
      event.preventDefault()
      return openScope()
    }
    // Alt+Shift+↑ / ↓ / D / Backspace: move, duplicate or delete the list item in focus.
    const ITEM_KEYS = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      KeyD: 'duplicate',
      Backspace: 'delete',
      Delete: 'delete'
    }
    if (event.altKey && event.shiftKey && !active && ITEM_KEYS[event.code]) {
      const item = event.target.nodeType === 1 && itemOf(event.target)
      if (item) {
        event.preventDefault()
        const focus = document.activeElement
        const after = itemAction(ITEM_KEYS[event.code], item)
        // Focus follows the item (a moved node loses it; a copy takes it).
        if (after === item && focus && item.contains(focus)) focus.focus()
        else if (after && after !== item) (after.querySelector('[tabindex]') || after).focus?.()
        else if (!after) undoButton.focus()
        return
      }
    }
    // A focused (not yet edited) element: Enter or F2 starts editing, or opens an image.
    const focused = editableOf(event.target)
    if (focused && focused !== active && (event.key === 'Enter' || event.key === 'F2')) {
      event.preventDefault()
      setItem(itemOf(focused))
      post({ type: 'select', ...describe(focused) })
      if (focused.tagName === 'IMG') return selectImage(focused, false)
      return activate(focused)
    }
    if (!active || !active.contains(event.target)) return
    if (event.key === 'Escape') {
      const element = active
      deactivate()
      // Focus stays on the element (or its link), so Tab carries on from here.
      const stop = element.hasAttribute('tabindex')
        ? element
        : element.querySelector('a[href], button, [tabindex]')
      if (stop) stop.focus()
      return
    }
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
  window.addEventListener('scroll', placeScope, { passive: true })
  window.addEventListener('scroll', hideKeyHint, { passive: true })
  window.addEventListener('scroll', () => showSharedTag(null), { passive: true })
  document.addEventListener('focusout', hideKeyHint)
  window.addEventListener('resize', placeScope)
  window.addEventListener('resize', placeItembar)

  // ---------- Messages from the app ----------

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || !event.data || event.data.target !== 'sitecms') return
    const message = event.data
    if (message.type === 'shared-tags') {
      sharedTags = message.tags || {}
      return
    }
    if (message.type === 'component-info') {
      componentInfo = message
      const waiting =
        pendingEdit && pendingEdit.closest(`[${COMPONENT}]`)?.getAttribute(COMPONENT) === message.id
      if (waiting && !asking) {
        if (!message.decided) askScope()
        else {
          const element = pendingEdit
          pendingEdit = null
          activateNow(element)
        }
        return
      }
      renderScope()
      placeToolbar()
      return
    }
    if (message.type === 'strings') {
      strings = { ...strings, ...(message.strings || {}) }
      if (message.mod) mod = message.mod
      applyStrings()
      return
    }
    if (message.type === 'pages') {
      sitePages = Array.isArray(message.pages) ? message.pages : []
      currentPath = message.current || ''
      return
    }
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
        for (const [name, value] of Object.entries(change.attrs || {}))
          applyAttr(element, name, value)
        inherited.set(change.id, cleanHtml(element))
        element.setAttribute(INHERITED, '')
      }
      for (const change of message.own || []) {
        const element = find(change.id)
        if (!element) continue
        if (change.html !== undefined) element.innerHTML = change.html
        for (const [name, value] of Object.entries(change.attrs || {})) {
          rememberAttr(element, name)
          const changes = attrChanges.get(change.id) || {}
          changes[name] = value
          attrChanges.set(change.id, changes)
          applyAttr(element, name, value)
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
      // A gallery thumbnail that opens its full-size image: the link follows the new image.
      if (message.attrs.src && imageLink(element)) setAttr(element, LINK_HREF, message.attrs.src)
      for (const [name, value] of Object.entries(message.attrs)) setAttr(element, name, value)
    } else if (message.type === 'select-image') {
      const element = document.querySelector(`img[${ATTR}="${CSS.escape(message.id)}"]`)
      if (element) selectImage(element, true)
    } else if (message.type === 'deselect') {
      peek(null)
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
    document.body.appendChild(linkMenu)
    document.body.appendChild(itembar)
    document.body.appendChild(undoBar)
    document.body.appendChild(scopeChip)
    document.body.appendChild(scopePop)
    document.body.appendChild(keyHint)
    document.body.appendChild(sharedTag)
    for (const list of document.querySelectorAll(`[${LIST}]`))
      list.setAttribute(COUNT, String(itemsOf(list).length))
    const editable = document.querySelectorAll(`[${ATTR}]`)
    for (const element of editable) {
      if (element.tagName !== 'IMG') originals.set(element.getAttribute(ATTR), cleanHtml(element))
      // Reachable with Tab, unless the page already made it, or something inside it, focusable
      // (a nav item's link): one stop per element.
      if (
        element.tabIndex < 0 &&
        !element.hasAttribute('tabindex') &&
        !element.querySelector('a[href], button, input, select, textarea, [tabindex]')
      ) {
        element.setAttribute('tabindex', '0')
        element.setAttribute(TAB, '')
      }
    }
    post({ type: 'ready', editable: editable.length })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
