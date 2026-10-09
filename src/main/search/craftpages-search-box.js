/*!
 * CraftPages site search: the <craftpages-search> element. https://github.com/craftpages (GPL-3.0)
 * Loaded by craftpages-search.js on first use. Vanilla JS, no dependencies.
 *
 * Styling: craftpages-search.css. Override with CSS variables on the element,
 * e.g. craftpages-search { --craftpages-search-accent: var(--brand); }
 */
;(function () {
  'use strict'

  if (!('customElements' in window) || window.customElements.get('craftpages-search')) return

  var MAX_RESULTS = 20
  var SNIPPET = 160

  var STRINGS = {
    en: { search: 'Search', placeholder: 'Search this site', empty: 'No results for', suggested: 'Suggested', navigate: 'navigate', open: 'open', close: 'close', results: 'results', loading: 'Loading…', error: 'Search is unavailable right now.' },
    de: { search: 'Suche', placeholder: 'Website durchsuchen', empty: 'Keine Ergebnisse für', suggested: 'Vorschläge', navigate: 'auswählen', open: 'öffnen', close: 'schließen', results: 'Ergebnisse', loading: 'Lädt…', error: 'Die Suche ist gerade nicht verfügbar.' },
    fr: { search: 'Rechercher', placeholder: 'Rechercher sur le site', empty: 'Aucun résultat pour', suggested: 'Suggestions', navigate: 'naviguer', open: 'ouvrir', close: 'fermer', results: 'résultats', loading: 'Chargement…', error: 'La recherche est indisponible pour le moment.' },
    es: { search: 'Buscar', placeholder: 'Buscar en el sitio', empty: 'Sin resultados para', suggested: 'Sugerencias', navigate: 'navegar', open: 'abrir', close: 'cerrar', results: 'resultados', loading: 'Cargando…', error: 'La búsqueda no está disponible ahora.' },
    it: { search: 'Cerca', placeholder: 'Cerca nel sito', empty: 'Nessun risultato per', suggested: 'Suggeriti', navigate: 'naviga', open: 'apri', close: 'chiudi', results: 'risultati', loading: 'Caricamento…', error: 'La ricerca non è disponibile al momento.' },
    nl: { search: 'Zoeken', placeholder: 'Zoek op deze site', empty: 'Geen resultaten voor', suggested: 'Suggesties', navigate: 'navigeren', open: 'openen', close: 'sluiten', results: 'resultaten', loading: 'Laden…', error: 'Zoeken is nu niet beschikbaar.' },
    pt: { search: 'Pesquisar', placeholder: 'Pesquisar no site', empty: 'Sem resultados para', suggested: 'Sugestões', navigate: 'navegar', open: 'abrir', close: 'fechar', results: 'resultados', loading: 'A carregar…', error: 'A pesquisa não está disponível agora.' },
    pl: { search: 'Szukaj', placeholder: 'Szukaj w serwisie', empty: 'Brak wyników dla', suggested: 'Polecane', navigate: 'wybierz', open: 'otwórz', close: 'zamknij', results: 'wyniki', loading: 'Ładowanie…', error: 'Wyszukiwanie jest teraz niedostępne.' },
    uk: { search: 'Пошук', placeholder: 'Пошук на сайті', empty: 'Нічого не знайдено для', suggested: 'Рекомендовані', navigate: 'вибір', open: 'відкрити', close: 'закрити', results: 'результатів', loading: 'Завантаження…', error: 'Пошук зараз недоступний.' }
  } // prettier-ignore

  var WORD = /[\p{L}\p{N}]/u

  /**
   * Lowercase without accents, keeping the length: offsets into the folded
   * text are offsets into the original, which makes highlighting simple.
   */
  var PLAIN = /^[ -~\s]*$/
  var folded = Object.create(null)

  function fold(text) {
    if (PLAIN.test(text)) return text.toLowerCase()
    var out = ''
    for (var i = 0; i < text.length; i++) {
      var ch = text[i]
      var base = folded[ch]
      if (base === undefined) {
        base = ch.normalize('NFD')[0].toLowerCase()
        base = folded[ch] = base.length === 1 ? base : ch
      }
      out += base
    }
    return out
  }

  function terms(query) {
    return fold(query)
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
  }

  /** Positions where `term` starts a word in `text` (both folded). */
  function hits(text, term, limit) {
    var found = []
    var at = text.indexOf(term)
    while (at !== -1 && found.length < limit) {
      if (at === 0 || !WORD.test(text[at - 1])) found.push(at)
      at = text.indexOf(term, at + 1)
    }
    return found
  }

  function wholeWord(text, at, term) {
    var next = text[at + term.length]
    return !next || !WORD.test(next)
  }

  /** Levenshtein distance, capped: returns 2 as soon as it can't be ≤ 1. */
  function nearlyEqual(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false
    var i = 0
    while (i < a.length && a[i] === b[i]) i++
    if (i === a.length && i === b.length) return true
    var restA = a.slice(i + 1)
    var restB = b.slice(i + 1)
    return (
      restA === restB || // substitution
      a.slice(i) === b.slice(i + 1) || // insertion
      a.slice(i + 1) === b.slice(i) || // deletion
      (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)) // swap
    )
  }

  function strings(element) {
    var lang = (document.documentElement.lang || 'en').toLowerCase().split('-')[0]
    var s = Object.assign({}, STRINGS.en, STRINGS[lang] || {})
    if (element.dataset.placeholder) s.placeholder = element.dataset.placeholder
    if (element.dataset.empty) s.empty = element.dataset.empty
    return s
  }

  function el(tag, className, text) {
    var node = document.createElement(tag)
    if (className) node.className = className
    if (text) node.textContent = text
    return node
  }

  var ICON =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>'

  var uid = 0

  class CraftPagesSearchBox extends HTMLElement {
    constructor() {
      super()
      this._index = null
      this._loading = null
      this._results = []
      this._active = -1
      this._trigger = null
      this._timer = 0
      this._built = false
      this._onKey = this._onKey.bind(this)
    }

    connectedCallback() {
      if (this._built) return
      this._built = true
      this._id = 'craftpages-search-' + ++uid
      this._s = strings(this)
      this.classList.add('cps')
      if (!this.dataset.theme) this.dataset.theme = 'auto'
      if (this.dataset.accent)
        this.style.setProperty('--craftpages-search-accent', this.dataset.accent)
      this.hidden = true

      var backdrop = el('div', 'cps-backdrop')
      backdrop.addEventListener('click', this.close.bind(this))

      var panel = el('div', 'cps-panel')
      panel.setAttribute('role', 'dialog')
      panel.setAttribute('aria-modal', 'true')
      panel.setAttribute('aria-label', this._s.search)

      var bar = el('div', 'cps-bar')
      var icon = el('span', 'cps-icon')
      icon.innerHTML = ICON
      var input = el('input', 'cps-input')
      input.type = 'search'
      input.placeholder = this._s.placeholder
      input.autocomplete = 'off'
      input.spellcheck = false
      input.setAttribute('enterkeyhint', 'go')
      input.setAttribute('role', 'combobox')
      input.setAttribute('aria-autocomplete', 'list')
      input.setAttribute('aria-expanded', 'false')
      input.setAttribute('aria-controls', this._id + '-list')
      input.addEventListener('input', this._onInput.bind(this))
      var esc = el('button', 'cps-esc', 'esc')
      esc.type = 'button'
      esc.setAttribute('aria-label', this._s.close)
      esc.addEventListener('click', this.close.bind(this))
      bar.append(icon, input, esc)

      var list = el('ul', 'cps-list')
      list.id = this._id + '-list'
      list.setAttribute('role', 'listbox')
      list.setAttribute('aria-label', this._s.results)
      list.addEventListener('mousemove', this._onHover.bind(this))

      var status = el('div', 'cps-status')
      status.setAttribute('aria-live', 'polite')

      var foot = el('div', 'cps-foot')
      foot.append(
        this._hint(['↑', '↓'], this._s.navigate),
        this._hint(['↵'], this._s.open),
        this._hint(['esc'], this._s.close)
      )

      panel.append(bar, list, status, foot)
      this.append(backdrop, panel)
      this._input = input
      this._list = list
      this._status = status
      this._panel = panel
    }

    _hint(keys, label) {
      var span = el('span', 'cps-hint')
      keys.forEach(function (key) {
        span.append(el('kbd', 'cps-kbd', key))
      })
      span.append(document.createTextNode(' ' + label))
      return span
    }

    isOpen() {
      return !this.hidden
    }

    /** Fetches the index; revalidated on every page load so a deploy is seen at once. */
    prefetch() {
      if (this._index) return Promise.resolve(this._index)
      if (this._loading) return this._loading
      var self = this
      var url = this.dataset.index || '/search-index.json'
      this._loading = fetch(url, { cache: 'no-cache' })
        .then(function (response) {
          if (!response.ok) throw new Error(url + ': HTTP ' + response.status)
          return response.json()
        })
        .then(function (data) {
          self._index = self._prepare(data)
          return self._index
        })
        .catch(function (error) {
          self._loading = null
          throw error
        })
      return this._loading
    }

    _prepare(data) {
      var pages = (data && data.pages ? data.pages : []).map(function (page) {
        var sections = (page.s || []).map(function (section) {
          return {
            id: section[0],
            heading: section[1],
            text: section[2],
            fh: fold(section[1]),
            ft: fold(section[2])
          }
        })
        var entry = {
          url: page.u,
          title: page.t || page.u,
          description: page.d || '',
          crumb: page.c || '',
          sections: sections,
          ftitle: fold(page.t || ''),
          fdesc: fold(page.d || '')
        }
        // Everything at once, to rule a page out with one lookup per word.
        entry.all = [entry.ftitle, entry.fdesc]
          .concat(
            sections.map(function (s) {
              return s.fh + '\n' + s.ft
            })
          )
          .join('\n')
        return entry
      })
      return { pages: pages, vocabulary: null }
    }

    /** Words for near spellings, gathered on the first query that finds nothing. */
    _vocabulary() {
      var index = this._index
      if (index.vocabulary) return index.vocabulary
      var words = new Set()
      index.pages.forEach(function (page) {
        page.all.split(/[^\p{L}\p{N}]+/u).forEach(function (word) {
          if (word.length > 3) words.add(word)
        })
      })
      index.vocabulary = Array.from(words)
      return index.vocabulary
    }

    open(trigger) {
      this._trigger = trigger && trigger !== document.body ? trigger : null
      this.hidden = false
      document.documentElement.classList.add('cps-lock')
      document.addEventListener('keydown', this._onKey, true)
      this._input.value = ''
      this._render([], '')
      this._input.focus()
      var self = this
      if (!this._index) this._status.textContent = this._s.loading
      this.prefetch().then(
        function () {
          self._status.textContent = ''
          self._search()
        },
        function (error) {
          console.warn('CraftPages search:', error.message)
          self._status.textContent = self._s.error
        }
      )
    }

    close() {
      if (this.hidden) return
      this.hidden = true
      document.documentElement.classList.remove('cps-lock')
      document.removeEventListener('keydown', this._onKey, true)
      if (window.location.hash === '#craftpages-search') {
        // Opened from a link: drop the hash so the same link opens search again.
        history.replaceState(null, '', window.location.pathname + window.location.search)
      }
      if (this._trigger && this._trigger.isConnected && this._trigger.focus) this._trigger.focus()
    }

    _onInput() {
      clearTimeout(this._timer)
      this._timer = setTimeout(this._search.bind(this), 60)
    }

    _onHover(event) {
      var item = event.target.closest('.cps-item')
      if (item) this._select(Number(item.dataset.index), false)
    }

    _onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        this.close()
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        var count = this._results.length
        if (!count) return
        var step = event.key === 'ArrowDown' ? 1 : -1
        this._select((this._active + step + count) % count, true)
      } else if (event.key === 'Enter' && event.target === this._input) {
        var result = this._results[this._active]
        if (result) {
          event.preventDefault()
          this._go(result.href, event.metaKey || event.ctrlKey)
        }
      } else if (event.key === 'Tab') {
        // Focus stays in the dialog: input, then the result links, then back.
        var focusable = [this._input].concat(
          Array.prototype.slice.call(this._list.querySelectorAll('a'))
        )
        var at = focusable.indexOf(document.activeElement)
        event.preventDefault()
        var next = focusable[(at + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length]
        next.focus()
      }
    }

    _go(href, newTab) {
      if (newTab) {
        window.open(href, '_blank', 'noopener')
        return
      }
      this.close()
      window.location.href = href
    }

    _select(index, scroll) {
      var items = this._list.querySelectorAll('.cps-item')
      if (this._active >= 0 && items[this._active])
        items[this._active].setAttribute('aria-selected', 'false')
      this._active = index
      var item = items[index]
      if (!item) return this._input.removeAttribute('aria-activedescendant')
      item.setAttribute('aria-selected', 'true')
      this._input.setAttribute('aria-activedescendant', item.id)
      if (scroll) item.scrollIntoView({ block: 'nearest' })
    }

    _search() {
      if (!this._index) return
      var query = this._input.value.trim()
      var words = terms(query)
      if (!words.length) return this._render(this._suggested(), '')
      var self = this
      var variants = words.map(function (term) {
        return self._variants(term)
      })
      var scored = []
      this._index.pages.forEach(function (page) {
        var match = self._score(page, variants)
        if (match) scored.push(match)
      })
      scored.sort(function (a, b) {
        return b.score - a.score
      })
      this._render(scored.slice(0, MAX_RESULTS), query)
    }

    /** The term, plus near spellings when the term itself is found nowhere. */
    _variants(term) {
      var pages = this._index.pages
      if (term.length < 4) return [term]
      var found = pages.some(function (page) {
        return hits(page.all, term, 1).length > 0
      })
      if (found) return [term]
      var near = this._vocabulary().filter(function (word) {
        return (
          nearlyEqual(term, word) ||
          (word.length > term.length && nearlyEqual(term, word.slice(0, term.length)))
        )
      })
      return near.length ? near.slice(0, 8) : [term]
    }

    _score(page, variants) {
      for (var w = 0; w < variants.length; w++) {
        var anywhere = variants[w].some(function (term) {
          return page.all.indexOf(term) !== -1
        })
        if (!anywhere) return null // every word must match somewhere
      }
      var score = 0
      var best = null
      for (var i = 0; i < variants.length; i++) {
        var options = variants[i]
        var termScore = 0
        for (var v = 0; v < options.length; v++) {
          var term = options[v]
          var t = 0
          var inTitle = hits(page.ftitle, term, 1)
          if (inTitle.length) t += wholeWord(page.ftitle, inTitle[0], term) ? 20 : 12
          if (hits(page.fdesc, term, 1).length) t += 3
          for (var s = 0; s < page.sections.length; s++) {
            var section = page.sections[s]
            var h = hits(section.fh, term, 1).length ? 6 : 0
            var b = hits(section.ft, term, 5).length
            if (h || b) t += h + (b ? 1 + (b - 1) * 0.2 : 0)
          }
          termScore = Math.max(termScore, t)
        }
        if (!termScore) return null // every word must match somewhere
        score += termScore
      }
      // The section that covers the most words, preferring headings.
      var flat = []
      variants.forEach(function (options) {
        flat.push.apply(flat, options)
      })
      page.sections.forEach(function (section) {
        var cover = 0
        flat.forEach(function (term) {
          if (hits(section.fh, term, 1).length) cover += 2
          if (hits(section.ft, term, 1).length) cover += 1
        })
        if (cover && (!best || cover > best.cover)) best = { section: section, cover: cover }
      })
      var chosen = best && best.section
      var inHeading = chosen && flat.some(function (term) { return hits(chosen.fh, term, 1).length }) // prettier-ignore
      return {
        page: page,
        score: score,
        terms: flat,
        section: chosen,
        href:
          page.url + (chosen && chosen.id && (inHeading || best.cover > 1) ? '#' + chosen.id : ''),
        heading: chosen && inHeading && page.ftitle.indexOf(chosen.fh) === -1 ? chosen.heading : ''
      }
    }

    _suggested() {
      var wanted = (this.dataset.suggest || '').split(',').map(function (u) { return u.trim() }).filter(Boolean) // prettier-ignore
      var pages = this._index ? this._index.pages : []
      return wanted
        .map(function (url) {
          var page = pages.find(function (p) {
            return p.url === url
          })
          return (
            page && {
              page: page,
              terms: [],
              section: null,
              href: page.url,
              heading: '',
              suggested: true
            }
          )
        })
        .filter(Boolean)
    }

    _render(results, query) {
      this._results = results
      this._active = -1
      this._input.removeAttribute('aria-activedescendant')
      this._list.textContent = ''
      var self = this
      if (results.length && results[0].suggested)
        this._list.append(el('li', 'cps-group', this._s.suggested))
      results.forEach(function (result, index) {
        self._list.append(self._item(result, index))
      })
      this.toggleAttribute('data-has-results', results.length > 0)
      this._input.setAttribute('aria-expanded', results.length ? 'true' : 'false')
      if (query && !results.length) {
        this._status.textContent = this._s.empty + ' “' + query + '”'
      } else if (this._index) {
        this._status.textContent = query ? results.length + ' ' + this._s.results : ''
      }
      this._status.classList.toggle('cps-status--visible', Boolean(query && !results.length))
      if (results.length && query) this._select(0, false)
    }

    _item(result, index) {
      var li = el('li', 'cps-item')
      li.id = this._id + '-' + index
      li.dataset.index = index
      li.setAttribute('role', 'option')
      li.setAttribute('aria-selected', 'false')
      var a = el('a', 'cps-link')
      a.href = result.href
      a.tabIndex = -1
      var self = this
      a.addEventListener('click', function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return
        event.preventDefault()
        self._go(result.href, false)
      })

      var title = el('span', 'cps-title')
      this._highlight(title, result.page.title, result.terms)
      a.append(title)

      var where = el('span', 'cps-where')
      where.textContent =
        [result.page.crumb, result.heading].filter(Boolean).join(' › ') || result.page.url
      a.append(where)

      // A heading-only section (e.g. the h1) borrows the text that follows it.
      var sections = result.page.sections
      var at = result.section ? sections.indexOf(result.section) : -1
      var next = at >= 0 ? sections.slice(at).find(function (s) { return s.text }) : null // prettier-ignore
      var source = (next && next.text) || result.page.description
      if (source) {
        var snippet = el('span', 'cps-snippet')
        this._highlight(snippet, this._excerpt(source, result.terms), result.terms)
        a.append(snippet)
      }
      li.append(a)
      return li
    }

    _excerpt(text, words) {
      if (text.length <= SNIPPET) return text
      var folded = fold(text)
      var at = -1
      words.some(function (term) {
        var found = hits(folded, term, 1)
        if (found.length) at = found[0]
        return found.length
      })
      if (at < 0) return text.slice(0, SNIPPET).replace(/\s+\S*$/, '') + '…'
      var start = Math.max(0, at - 50)
      if (start > 0) start = text.indexOf(' ', start) + 1 || start
      var end = Math.min(text.length, start + SNIPPET)
      if (end < text.length)
        end = text.lastIndexOf(' ', end) > at ? text.lastIndexOf(' ', end) : end
      return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
    }

    /** Fills `node` with `text`, wrapping the matched word starts in <mark>. */
    _highlight(node, text, words) {
      var folded = fold(text)
      var ranges = []
      words.forEach(function (term) {
        hits(folded, term, 20).forEach(function (at) {
          ranges.push([at, at + term.length])
        })
      })
      ranges.sort(function (a, b) {
        return a[0] - b[0]
      })
      var last = 0
      ranges.forEach(function (range) {
        if (range[0] < last) return
        node.append(document.createTextNode(text.slice(last, range[0])))
        node.append(el('mark', 'cps-mark', text.slice(range[0], range[1])))
        last = range[1]
      })
      node.append(document.createTextNode(text.slice(last)))
    }
  }

  window.customElements.define('craftpages-search', CraftPagesSearchBox)
})()
