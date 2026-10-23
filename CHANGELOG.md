# Changelog

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
