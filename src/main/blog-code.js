/* CraftPages code blocks: a Copy button on each code block that has one.
   Written by CraftPages on publish; edits here are replaced. */
;(function () {
  'use strict'
  var WORDS = {
    en: ['Copy', 'Copied', 'Copy code'],
    it: ['Copia', 'Copiato', 'Copia il codice'],
    uk: ['Копіювати', 'Скопійовано', 'Копіювати код']
  }
  var words = WORDS[(document.documentElement.lang || 'en').slice(0, 2).toLowerCase()] || WORDS.en

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text)
    var area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
    return Promise.resolve()
  }

  Array.prototype.forEach.call(document.querySelectorAll('.cp-code--copy'), function (block) {
    var code = block.querySelector('code')
    if (!code) return
    var button = document.createElement('button')
    button.type = 'button'
    button.className = 'cp-code__copy'
    button.textContent = words[0]
    button.setAttribute('aria-label', words[2])
    var timer
    button.addEventListener('click', function () {
      copy(code.textContent).then(function () {
        button.textContent = words[1]
        button.setAttribute('data-done', '')
        clearTimeout(timer)
        timer = setTimeout(function () {
          button.textContent = words[0]
          button.removeAttribute('data-done')
        }, 1500)
      })
    })
    block.appendChild(button)
  })
})()
