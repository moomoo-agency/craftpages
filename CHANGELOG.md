# Changelog

## 1.4.2 (2026-10-29)

- Blog: images in a post show in the editor. The editor's page is the app itself, so a site
  path such as `/assets/blog/cover.jpg` pointed at the disk (or the dev server) and every
  image in a post appeared broken, uploads included. Those requests now go to the preview
  server, which serves the open site; the post keeps its site paths.
- A smaller app: about 75 MB less on a Mac (395 MB to 322 MB installed), 20 to 30 MB less
  elsewhere. Chromium's own translations are kept only for the app's languages (English,
  Italian, Ukrainian); each Mac app carries only its own CPU's image library; the WebAssembly
  image fallback and Gutenberg's unused in-browser image processing are left out.

## 1.4.1 (2026-10-29)

- Blog: a post made outside the editor (a hand-written draft, an import, an older Gutenberg)
  no longer opens with "This block contains unexpected or invalid content" on its blocks. Each
  such block is rebuilt from its attributes when the post opens, as WordPress's "Attempt Block
  Recovery" does. Unknown blocks and classic HTML stay as they are.
- Blog: images in a published post get their file's width and height and `loading="lazy"`
  where the tag has none, so the page doesn't jump while they load. The image block itself
  writes neither, and the saved post keeps the editor's markup.

## 1.4.0 (2026-10-26)

- **Speed** (Project settings): what publishing does to the copy it uploads; the folder's
  files stay as written. All off until switched on.
  - **Minify CSS and JavaScript** (csso with the structure kept, terser). A file that can't be
    minified goes up as it is.
  - **A year of browser caching for styles, fonts and images**: each one a page or stylesheet
    points at also goes up as `_v/<hash>/<path>`, an address that changes with the file, and
    pages and stylesheets point there (`_headers` on Cloudflare, `.htaccess` with mod_headers on
    a server). Originals stay where they were. Scripts keep their address, since some find their
    sibling files from it.
  - **Put stylesheets into the pages**, up to a gzipped budget per page, so the first paint
    doesn't wait for them. Their `url()`s are rebased onto each page.
  - **Fonts from other websites**: finds Google Fonts and Bunny Fonts stylesheets the site
    links and, on request, copies the fonts into `assets/fonts/` with a stylesheet declaring
    them, and links that instead (preconnect hints go too). One step, with Undo.
- Publish: lists every file that changes, not only pages: styles, scripts and images by path,
  marked new or removed. A change to the speed settings counts as something to publish.
- Publish and the sidebar's "ready to publish" follow changes to the site's files as they happen
  (the code editor, media, SEO, a sync, an undo, an editor outside the app), instead of only
  after saving or publishing.
- Change detection reuses a file's hash while its size and modification time stay the same.
- Publish keeps running when you leave the Publish screen, and coming back shows it running
  (also one the scheduler started) and then its result. Asking whether the live site came from
  elsewhere while this folder is publishing no longer warns about its own new version.
- "Ready to publish" no longer shows the count from before a publish that just finished.

## 1.3.1 (2026-10-23)

- Blog setup: pointing at a card's parts looks through a link stretched over the whole card
  (a title link's `::after`, or an empty link laid on top), so the image, excerpt, date and
  tags can be picked. On the card link step, clicking anywhere on the card still picks the link.

## 1.3.0 (2026-10-23)

- Language switcher: a **dropdown** layout. It shows the current language only (text, flag or
  both, as before) and opens a list of the others. Works without JavaScript; a few lines of
  script close it on a click elsewhere or Escape and open it towards the middle of the screen.
  It undoes the accordion styles some sites give every `<details>`.
- Language switcher: languages a page isn't translated into are **left out** by default,
  instead of linking to that language's home page (still available as an option). A page with
  no translation shows no switcher until one exists. Blog posts link only to their own
  translations, and each blog's list to the other languages' lists. Switchers placed before
  1.3.0 keep linking to home pages until their look is changed.
- Language switcher: default labels are the short code (EN, not EN-US), unless two languages
  share it.
- Language switcher: the look screen's button says "Apply to every switcher".

## 1.2.3 (2026-10-22)

- Previews: embedded YouTube and Vimeo videos show their thumbnail and a play button instead of
  a black box.

## 1.2.2 (2026-10-19)

- Blog: tags, categories and new post slugs in Cyrillic are transliterated (they used to
  collapse into /tag/post/).
- Blog: a post without a cover no longer shows the layout's sample image, on its page or its
  card.

## 1.2.1 (2026-10-18)

- Posts: pasted file:/// links become site paths on save.

## 1.1.5 (2026-10-09)

- Diagnostic log (App settings → Diagnostics), with passwords, tokens and passphrases redacted.
- Posts get their own meta description, falling back to the excerpt.
- Blog setup moves a layout page aside when the blog needs its address.
- Card link pointing takes every link that opens the post.
- Sync and publish fixes.

## 1.1.1 – 1.1.4 (2026-10-07 – 08)

- Mac builds signed with Developer ID and notarized (1.1.4 is the first signed release), with
  updates installed in the background on macOS too.
