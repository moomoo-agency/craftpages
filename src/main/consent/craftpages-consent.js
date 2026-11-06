/*!
 * CraftPages cookie consent. https://github.com/craftpages (GPL-3.0)
 *
 * Include once per page:
 *   <script src="/assets/craftpages-consent.js" data-categories="analytics marketing" defer></script>
 *
 * Scripts that wait for consent are written inert in the page:
 *   <script type="text/plain" data-craftpages-consent="analytics" src="…"></script>
 *   <iframe data-craftpages-src="…" data-craftpages-consent="embeds"></iframe>
 * Once the visitor allows a category, they run in page order. The choice is kept in
 * localStorage for a year, and asked again when the site starts using a new category.
 * Any element with `data-craftpages-consent-open` opens the choices again.
 *
 * Options, as attributes on this script tag:
 *   data-categories   the categories the site uses: analytics, marketing, embeds
 *   data-position     bar (default) | box
 *   data-button       "off" hides the small button that reopens the choices
 *   data-title, data-message, data-accept, data-reject, data-choose, data-save,
 *   data-privacy (address of the privacy page), data-privacy-text: the banner's words;
 *   by default in the page's language (<html lang>), English if it has none of its own.
 *
 * window.CraftPagesConsent: get(), allow(category), open(); the page gets a
 * "craftpages:consent" event whenever the choice changes.
 */
;(function () {
  'use strict'

  if (window.CraftPagesConsent) return

  var KEY = 'craftpages-consent'
  var YEAR = 365 * 24 * 60 * 60 * 1000
  var MARK = 'data-craftpages-consent'
  var script = document.currentScript
  var options = script ? script.dataset : {}
  var categories = (options.categories || '').split(/\s+/).filter(function (c) {
    return c === 'analytics' || c === 'marketing' || c === 'embeds'
  })

  var TEXTS = {
    en: {
      title: 'Cookies on this site',
      message:
        'We use cookies and similar tools for the things you allow below. The site works without them.',
      accept: 'Accept all',
      reject: 'Reject all',
      choose: 'Choose',
      save: 'Save choices',
      privacy: 'Privacy policy',
      settings: 'Cookie settings',
      necessary: ['Necessary', 'Needed for the site to work. Always on.'],
      analytics: ['Analytics', 'Counts visits and shows how the site is used.'],
      marketing: ['Marketing', 'Measures ads and shows ads that fit your interests.'],
      embeds: [
        'Embedded content',
        'Videos, maps and posts from other sites, which may set their own cookies.'
      ],
      blocked: 'This content is from another site and shows after you allow embedded content.',
      allow: 'Allow embedded content'
    },
    it: {
      title: 'Cookie su questo sito',
      message:
        'Usiamo cookie e strumenti simili per ciò che autorizzi qui sotto. Il sito funziona anche senza.',
      accept: 'Accetta tutti',
      reject: 'Rifiuta tutti',
      choose: 'Scegli',
      save: 'Salva le scelte',
      privacy: 'Informativa sulla privacy',
      settings: 'Impostazioni cookie',
      necessary: ['Necessari', 'Servono al funzionamento del sito. Sempre attivi.'],
      analytics: ['Statistiche', 'Contano le visite e mostrano come viene usato il sito.'],
      marketing: [
        'Marketing',
        'Misurano gli annunci e mostrano pubblicità in linea con i tuoi interessi.'
      ],
      embeds: [
        'Contenuti incorporati',
        'Video, mappe e post di altri siti, che possono impostare i propri cookie.'
      ],
      blocked:
        'Questo contenuto proviene da un altro sito e compare dopo che autorizzi i contenuti incorporati.',
      allow: 'Consenti i contenuti incorporati'
    },
    uk: {
      title: 'Файли cookie на цьому сайті',
      message:
        'Ми використовуємо cookie та подібні інструменти лише для того, що ви дозволите нижче. Сайт працює і без них.',
      accept: 'Прийняти всі',
      reject: 'Відхилити всі',
      choose: 'Вибрати',
      save: 'Зберегти вибір',
      privacy: 'Політика конфіденційності',
      settings: 'Налаштування cookie',
      necessary: ['Необхідні', 'Потрібні для роботи сайту. Завжди увімкнені.'],
      analytics: ['Аналітика', 'Рахує відвідування й показує, як користуються сайтом.'],
      marketing: ['Маркетинг', 'Вимірює рекламу й показує рекламу відповідно до ваших інтересів.'],
      embeds: [
        'Вбудований вміст',
        'Відео, мапи й дописи з інших сайтів, які можуть ставити власні cookie.'
      ],
      blocked: 'Цей вміст з іншого сайту. Він з’явиться, коли ви дозволите вбудований вміст.',
      allow: 'Дозволити вбудований вміст'
    },
    de: {
      title: 'Cookies auf dieser Website',
      message:
        'Wir verwenden Cookies und ähnliche Techniken für das, was Sie unten erlauben. Die Website funktioniert auch ohne sie.',
      accept: 'Alle akzeptieren',
      reject: 'Alle ablehnen',
      choose: 'Auswählen',
      save: 'Auswahl speichern',
      privacy: 'Datenschutzerklärung',
      settings: 'Cookie-Einstellungen',
      necessary: ['Notwendig', 'Für den Betrieb der Website nötig. Immer aktiv.'],
      analytics: ['Statistik', 'Zählt Besuche und zeigt, wie die Website genutzt wird.'],
      marketing: ['Marketing', 'Misst Werbung und zeigt Werbung passend zu Ihren Interessen.'],
      embeds: [
        'Eingebettete Inhalte',
        'Videos, Karten und Beiträge anderer Websites, die eigene Cookies setzen können.'
      ],
      blocked:
        'Dieser Inhalt stammt von einer anderen Website und erscheint, wenn Sie eingebettete Inhalte erlauben.',
      allow: 'Eingebettete Inhalte erlauben'
    },
    fr: {
      title: 'Cookies sur ce site',
      message:
        'Nous utilisons des cookies et des outils similaires pour ce que vous autorisez ci-dessous. Le site fonctionne sans eux.',
      accept: 'Tout accepter',
      reject: 'Tout refuser',
      choose: 'Choisir',
      save: 'Enregistrer mes choix',
      privacy: 'Politique de confidentialité',
      settings: 'Paramètres des cookies',
      necessary: ['Nécessaires', 'Indispensables au fonctionnement du site. Toujours actifs.'],
      analytics: ['Statistiques', 'Comptent les visites et montrent comment le site est utilisé.'],
      marketing: [
        'Marketing',
        'Mesurent les publicités et affichent des publicités adaptées à vos intérêts.'
      ],
      embeds: [
        'Contenus intégrés',
        'Vidéos, cartes et publications d’autres sites, qui peuvent déposer leurs propres cookies.'
      ],
      blocked:
        'Ce contenu vient d’un autre site et s’affiche une fois les contenus intégrés autorisés.',
      allow: 'Autoriser les contenus intégrés'
    },
    es: {
      title: 'Cookies en este sitio',
      message:
        'Usamos cookies y herramientas similares para lo que permitas abajo. El sitio funciona sin ellas.',
      accept: 'Aceptar todas',
      reject: 'Rechazar todas',
      choose: 'Elegir',
      save: 'Guardar elección',
      privacy: 'Política de privacidad',
      settings: 'Configuración de cookies',
      necessary: ['Necesarias', 'Imprescindibles para que el sitio funcione. Siempre activas.'],
      analytics: ['Analítica', 'Cuentan las visitas y muestran cómo se usa el sitio.'],
      marketing: ['Marketing', 'Miden los anuncios y muestran publicidad según tus intereses.'],
      embeds: [
        'Contenido incrustado',
        'Vídeos, mapas y publicaciones de otros sitios, que pueden usar sus propias cookies.'
      ],
      blocked: 'Este contenido es de otro sitio y aparece cuando permites el contenido incrustado.',
      allow: 'Permitir contenido incrustado'
    }
  }

  var lang = (document.documentElement.lang || 'en').toLowerCase().split('-')[0]
  var t = TEXTS[lang] || TEXTS.en
  var text = {
    title: options.title || t.title,
    message: options.message || t.message,
    accept: options.accept || t.accept,
    reject: options.reject || t.reject,
    choose: options.choose || t.choose,
    save: options.save || t.save,
    privacy: options.privacyText || t.privacy
  }

  // Cookies each category's usual tools set: cleared when the visitor takes consent back.
  var COOKIES = {
    analytics: /^(_ga|_gid|_gat|_hj|_clck|_clsk|_ym|_pk_|mp_|ph_|_hp2_)/,
    marketing: /^(_fbp|_fbc|_gcl|_uet|_ttp|_pin|li_|_li|_rdt|_scid|__hs|hubspot|intercom)/
  }

  // ---------- The choice ----------

  function read() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || 'null')
      if (!saved || typeof saved.c !== 'object' || Date.now() - saved.t > YEAR) return null
      return saved
    } catch {
      return null
    }
  }

  var saved = read()
  // Asked again when the site uses a category the visitor wasn't asked about.
  var decided =
    saved &&
    categories.every(function (c) {
      return c in saved.c
    })
  var choice = {}
  categories.forEach(function (c) {
    choice[c] = Boolean(saved && saved.c[c])
  })

  function store(next) {
    var before = choice
    choice = next
    try {
      var all = (saved && saved.c) || {}
      for (var c in next) all[c] = next[c]
      saved = { c: all, t: Date.now() }
      localStorage.setItem(KEY, JSON.stringify(saved))
    } catch {
      /* private mode: the choice lasts for this page */
    }
    decided = true
    consentMode()
    document.dispatchEvent(new CustomEvent('craftpages:consent', { detail: copy() }))
    var withdrawn = categories.filter(function (c) {
      return before[c] && !next[c]
    })
    if (withdrawn.length) {
      // What already ran can't be stopped: clear its cookies and start the page afresh.
      withdrawn.forEach(clearCookies)
      location.reload()
      return
    }
    activate()
  }

  function copy() {
    var out = { necessary: true }
    for (var c in choice) out[c] = choice[c]
    return out
  }

  function clearCookies(category) {
    var pattern = COOKIES[category]
    if (!pattern) return
    var host = location.hostname.split('.')
    document.cookie.split(';').forEach(function (pair) {
      var name = pair.split('=')[0].trim()
      if (!pattern.test(name)) return
      for (var i = 0; i < host.length - 1; i++) {
        var domain = host.slice(i).join('.')
        document.cookie = name + '=; Max-Age=0; path=/; domain=.' + domain
      }
      document.cookie = name + '=; Max-Age=0; path=/'
    })
  }

  /** Google's consent mode, for Google tags the site lets run without waiting. */
  function consentMode() {
    if (!document.querySelector('script[src*="googletagmanager.com"]')) return
    window.dataLayer = window.dataLayer || []
    var state = function (on) {
      return on ? 'granted' : 'denied'
    }
    // Google reads commands as `arguments` objects, the way gtag() pushes them.
    var gtag = function () {
      window.dataLayer.push(arguments)
    }
    gtag('consent', decided ? 'update' : 'default', {
      analytics_storage: state(choice.analytics),
      ad_storage: state(choice.marketing),
      ad_user_data: state(choice.marketing),
      ad_personalization: state(choice.marketing)
    })
  }

  // ---------- Bringing back what's allowed ----------

  var running = false

  function allowed(category) {
    return category === 'necessary' || Boolean(choice[category])
  }

  /** Scripts in page order: each one that loads a file is waited for before the next. */
  function activate() {
    if (running) return
    running = true
    var waiting = Array.prototype.slice.call(document.querySelectorAll('[' + MARK + ']'))
    ;(function next() {
      var element = waiting.shift()
      if (!element) {
        running = false
        return
      }
      var category = element.getAttribute(MARK)
      if (!allowed(category)) {
        if (element.tagName === 'IFRAME') placeholder(element)
        return next()
      }
      if (element.tagName === 'SCRIPT' && element.type === 'text/plain') return run(element, next)
      if (element.tagName === 'IFRAME' && element.hasAttribute('data-craftpages-src')) {
        element.removeAttribute('srcdoc')
        element.setAttribute('src', element.getAttribute('data-craftpages-src'))
        element.removeAttribute('data-craftpages-src')
      }
      next()
    })()
  }

  function run(element, next) {
    var fresh = document.createElement('script')
    for (var i = 0; i < element.attributes.length; i++) {
      var a = element.attributes[i]
      if (a.name === 'type' || a.name === MARK || a.name === 'data-craftpages-type') continue
      fresh.setAttribute(a.name, a.value)
    }
    var type = element.getAttribute('data-craftpages-type')
    if (type) fresh.type = type
    fresh.text = element.text
    var waits = fresh.src && !element.hasAttribute('async')
    if (fresh.src) fresh.async = element.hasAttribute('async')
    if (waits) fresh.onload = fresh.onerror = next
    element.parentNode.replaceChild(fresh, element)
    if (!waits) next()
  }

  function escape(value) {
    return String(value).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    })
  }

  /** An embed waiting for consent says so, with a button to allow it. */
  function placeholder(frame) {
    if (frame.hasAttribute('srcdoc')) return
    frame.setAttribute(
      'srcdoc',
      '<!doctype html><meta charset="utf-8"><style>html,body{height:100%;margin:0}body{display:grid;place-items:center;' +
        'font:15px/1.5 system-ui,sans-serif;background:#f2f2f2;color:#222;text-align:center;padding:16px;box-sizing:border-box}' +
        'button{font:inherit;margin-top:10px;padding:8px 14px;border-radius:6px;border:1px solid #222;background:#222;color:#fff;cursor:pointer}' +
        '@media (prefers-color-scheme:dark){body{background:#222;color:#eee}button{background:#eee;color:#111;border-color:#eee}}</style>' +
        '<div><div>' +
        escape(t.blocked) +
        '</div><button type="button" onclick="parent.CraftPagesConsent.allow(\'embeds\')">' +
        escape(t.allow) +
        '</button></div>'
    )
  }

  // ---------- The banner ----------

  var CSS =
    '.cpc{position:fixed;z-index:2147483000;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;' +
    '--cpc-bg:#fff;--cpc-fg:#1d1d1f;--cpc-muted:#5c5c63;--cpc-line:#d9d9de;--cpc-button:#1d1d1f;--cpc-button-fg:#fff;' +
    'color:var(--cpc-fg);background:var(--cpc-bg);box-shadow:0 8px 32px rgba(0,0,0,.18);box-sizing:border-box}' +
    '@media (prefers-color-scheme:dark){.cpc{--cpc-bg:#1f1f22;--cpc-fg:#f2f2f4;--cpc-muted:#b3b3ba;--cpc-line:#3a3a40;--cpc-button:#f2f2f4;--cpc-button-fg:#111}}' +
    '.cpc *{box-sizing:border-box}' +
    '.cpc--bar{left:0;right:0;bottom:0;padding:18px 20px;border-top:1px solid var(--cpc-line)}' +
    '.cpc--bar .cpc__inner{max-width:1100px;margin:0 auto;display:flex;flex-wrap:wrap;gap:12px 24px;align-items:flex-end}' +
    '.cpc--bar .cpc__body{flex:1 1 420px}' +
    '.cpc--box{left:16px;bottom:16px;width:min(400px,calc(100vw - 32px));padding:18px 20px;border-radius:12px;border:1px solid var(--cpc-line)}' +
    '.cpc__title{margin:0 0 4px;font-weight:650;font-size:16px}' +
    '.cpc__text{margin:0;color:var(--cpc-muted)}' +
    '.cpc__text a{color:inherit;text-decoration:underline}' +
    '.cpc__choices{margin:12px 0 0;padding:0;border:0;display:grid;gap:10px}' +
    '.cpc__choice{display:flex;gap:10px;align-items:flex-start}' +
    '.cpc__choice input{margin-top:4px;width:18px;height:18px;accent-color:var(--cpc-button)}' +
    '.cpc__choice small{display:block;color:var(--cpc-muted);font-size:13px}' +
    '.cpc__actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}' +
    '.cpc--bar .cpc__actions{margin-top:0}' +
    '.cpc__btn{font:inherit;font-weight:600;padding:9px 16px;border-radius:8px;cursor:pointer;' +
    'border:1px solid var(--cpc-button);background:var(--cpc-button);color:var(--cpc-button-fg)}' +
    '.cpc__btn--quiet{background:transparent;color:var(--cpc-fg);border-color:var(--cpc-line)}' +
    '.cpc__btn:focus-visible,.cpc-reopen:focus-visible,.cpc__choice input:focus-visible{outline:2px solid var(--cpc-fg);outline-offset:2px}' +
    '.cpc-reopen{position:fixed;left:16px;bottom:16px;z-index:2147482999;width:40px;height:40px;border-radius:50%;' +
    'border:1px solid rgba(0,0,0,.15);background:#fff;color:#1d1d1f;box-shadow:0 2px 10px rgba(0,0,0,.15);cursor:pointer;' +
    'display:grid;place-items:center;padding:0}' +
    '@media (prefers-color-scheme:dark){.cpc-reopen{background:#1f1f22;color:#f2f2f4;border-color:rgba(255,255,255,.2)}}' +
    '@media print{.cpc,.cpc-reopen{display:none}}'

  var banner = null
  var reopen = null

  function el(tag, attrs, children) {
    var node = document.createElement(tag)
    for (var name in attrs) {
      if (name === 'text') node.textContent = attrs[name]
      else if (name.slice(0, 2) === 'on') node.addEventListener(name.slice(2), attrs[name])
      else node.setAttribute(name, attrs[name])
    }
    ;(children || []).forEach(function (child) {
      if (child) node.appendChild(child)
    })
    return node
  }

  function close() {
    if (banner) banner.remove()
    banner = null
    showReopen()
  }

  function all(value) {
    var next = {}
    categories.forEach(function (c) {
      next[c] = value
    })
    return next
  }

  function open(showChoices) {
    if (!categories.length) return
    if (banner) banner.remove()
    if (reopen) reopen.hidden = true
    var position = options.position === 'box' ? 'box' : 'bar'
    var id = 'cpc-title-' + Math.random().toString(36).slice(2, 8)
    var boxes = {}
    var choices = el(
      'fieldset',
      { class: 'cpc__choices' },
      [
        el('label', { class: 'cpc__choice' }, [
          el('input', { type: 'checkbox', checked: '', disabled: '' }),
          el('span', {}, [
            el('strong', { text: t.necessary[0] }),
            el('small', { text: t.necessary[1] })
          ])
        ])
      ].concat(
        categories.map(function (c) {
          var input = el('input', { type: 'checkbox' })
          input.checked = Boolean(choice[c])
          boxes[c] = input
          return el('label', { class: 'cpc__choice' }, [
            input,
            el('span', {}, [el('strong', { text: t[c][0] }), el('small', { text: t[c][1] })])
          ])
        })
      )
    )
    choices.hidden = !showChoices
    var chooseButton = el('button', {
      type: 'button',
      class: 'cpc__btn cpc__btn--quiet',
      text: showChoices ? text.save : text.choose,
      onclick: function () {
        if (choices.hidden) {
          choices.hidden = false
          chooseButton.textContent = text.save
          var first = choices.querySelector('input:not([disabled])')
          if (first) first.focus()
          return
        }
        var next = {}
        categories.forEach(function (c) {
          next[c] = boxes[c].checked
        })
        close()
        store(next)
      }
    })
    var message = el('p', { class: 'cpc__text', text: text.message + ' ' })
    if (options.privacy) message.appendChild(el('a', { href: options.privacy, text: text.privacy }))
    banner = el(
      'section',
      { class: 'cpc cpc--' + position, role: 'region', 'aria-labelledby': id, lang: lang },
      [
        el('div', { class: 'cpc__inner' }, [
          el('div', { class: 'cpc__body' }, [
            el('p', { class: 'cpc__title', id: id, text: text.title }),
            message,
            choices
          ]),
          el('div', { class: 'cpc__actions' }, [
            // Rejecting is as easy as accepting: same size, same place.
            el('button', {
              type: 'button',
              class: 'cpc__btn',
              text: text.reject,
              onclick: function () {
                close()
                store(all(false))
              }
            }),
            chooseButton,
            el('button', {
              type: 'button',
              class: 'cpc__btn',
              text: text.accept,
              onclick: function () {
                close()
                store(all(true))
              }
            })
          ])
        ])
      ]
    )
    var styleTag = document.getElementById('cpc-style')
    if (!styleTag) document.head.appendChild(el('style', { id: 'cpc-style', text: CSS }))
    document.body.appendChild(banner)
    if (showChoices) {
      var first = choices.querySelector('input:not([disabled])')
      if (first) first.focus()
    }
  }

  function showReopen() {
    if (options.button === 'off' || !categories.length || banner) return
    if (!document.getElementById('cpc-style'))
      document.head.appendChild(el('style', { id: 'cpc-style', text: CSS }))
    if (!reopen) {
      reopen = el(
        'button',
        {
          type: 'button',
          class: 'cpc-reopen',
          'aria-label': t.settings,
          title: t.settings,
          onclick: function () {
            open(true)
          }
        },
        []
      )
      reopen.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
        '<path d="M21 12.5A9 9 0 1 1 11.5 3a3 3 0 0 0 4 3.5 3 3 0 0 0 5.5 6z"/><circle cx="8.5" cy="10" r="1"/><circle cx="12" cy="15.5" r="1"/><circle cx="16" cy="13" r="1"/></svg>'
      document.body.appendChild(reopen)
    }
    reopen.hidden = false
  }

  document.addEventListener('click', function (event) {
    var target = event.target.closest && event.target.closest('[data-craftpages-consent-open]')
    if (!target) return
    event.preventDefault()
    open(true)
  })

  window.CraftPagesConsent = {
    get: copy,
    open: function () {
      open(true)
    },
    allow: function (category) {
      var next = {}
      for (var c in choice) next[c] = choice[c]
      next[category] = true
      if (banner) close()
      store(next)
    }
  }

  function start() {
    consentMode()
    activate()
    if (!categories.length) return
    // CraftPages' "Try it" opens the page at #craftpages-consent: the choices, open.
    if (location.hash === '#craftpages-consent') open(true)
    else if (decided) showReopen()
    else open(false)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
