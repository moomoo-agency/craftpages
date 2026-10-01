/* CraftPages lightbox: click an image in a gallery (or an image linked to its own file) to
   see it large. Arrow keys move through the gallery; Esc, the × or a click outside closes it.
   Written by CraftPages on publish; edits here are replaced. */
;(function () {
  'use strict'
  var IMAGE_LINK = /\.(jpe?g|png|webp|avif|gif)(\?.*)?$/i

  function sourceOf(img) {
    var link = img.closest('a')
    if (link && IMAGE_LINK.test(link.getAttribute('href') || '')) return link.href
    return img.currentSrc || img.src
  }

  function groupOf(img) {
    var gallery = img.closest('.wp-block-gallery')
    return gallery ? Array.prototype.slice.call(gallery.querySelectorAll('img')) : [img]
  }

  var style = document.createElement('style')
  style.textContent =
    '.cp-lb{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.88);padding:4vh 4vw}' +
    '.cp-lb img{max-width:100%;max-height:100%;object-fit:contain;box-shadow:0 10px 40px rgba(0,0,0,.5)}' +
    '.cp-lb button{position:absolute;border:0;background:rgba(255,255,255,.12);color:#fff;font:24px/1 sans-serif;width:44px;height:44px;border-radius:50%;cursor:pointer}' +
    '.cp-lb button:hover,.cp-lb button:focus-visible{background:rgba(255,255,255,.25);outline:none}' +
    '.cp-lb .cp-lb-close{top:16px;right:16px}.cp-lb .cp-lb-prev{left:16px}.cp-lb .cp-lb-next{right:16px}' +
    '.cp-lb figcaption{position:absolute;bottom:16px;left:0;right:0;text-align:center;color:#fff;font:14px/1.4 sans-serif;padding:0 60px}' +
    '.wp-block-gallery img,.cp-lb-zoom{cursor:zoom-in}'
  document.head.appendChild(style)

  var overlay = null
  var items = []
  var index = 0
  var opener = null

  function show() {
    var img = items[index]
    var big = overlay.querySelector('img')
    big.src = sourceOf(img)
    big.alt = img.alt || ''
    var caption = img.closest('figure') && img.closest('figure').querySelector('figcaption')
    overlay.querySelector('figcaption').textContent = caption ? caption.textContent : ''
    overlay.querySelector('.cp-lb-prev').hidden = items.length < 2
    overlay.querySelector('.cp-lb-next').hidden = items.length < 2
  }

  function close() {
    if (!overlay) return
    overlay.remove()
    overlay = null
    document.removeEventListener('keydown', onKey)
    if (opener) opener.focus()
  }

  function step(delta) {
    index = (index + delta + items.length) % items.length
    show()
  }

  function onKey(event) {
    if (event.key === 'Escape') close()
    else if (event.key === 'ArrowRight') step(1)
    else if (event.key === 'ArrowLeft') step(-1)
  }

  function open(img) {
    opener = img.closest('a') || img
    items = groupOf(img)
    index = Math.max(0, items.indexOf(img))
    overlay = document.createElement('div')
    overlay.className = 'cp-lb'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', 'Image')
    overlay.innerHTML =
      '<img alt=""><figcaption></figcaption>' +
      '<button class="cp-lb-prev" aria-label="Previous image">‹</button>' +
      '<button class="cp-lb-next" aria-label="Next image">›</button>' +
      '<button class="cp-lb-close" aria-label="Close">×</button>'
    overlay.addEventListener('click', function (event) {
      var target = event.target
      if (target.classList.contains('cp-lb-prev')) step(-1)
      else if (target.classList.contains('cp-lb-next')) step(1)
      else if (target.tagName !== 'IMG') close()
    })
    document.body.appendChild(overlay)
    document.addEventListener('keydown', onKey)
    show()
    overlay.querySelector('.cp-lb-close').focus()
  }

  document.addEventListener('click', function (event) {
    var img = event.target.closest && event.target.closest('img')
    if (!img) return
    var link = img.closest('a')
    var inGallery = img.closest('.wp-block-gallery')
    var linkedToFile = link && IMAGE_LINK.test(link.getAttribute('href') || '')
    // Gallery images, and single images linked to their own file; other links behave normally.
    if (!inGallery && !linkedToFile) return
    if (link && !linkedToFile) return
    event.preventDefault()
    open(img)
  })

  // Mark zoomable single images for the cursor.
  Array.prototype.forEach.call(document.querySelectorAll('.wp-block-image a img'), function (img) {
    if (IMAGE_LINK.test(img.closest('a').getAttribute('href') || ''))
      img.classList.add('cp-lb-zoom')
  })
})()
