# Sites in several languages

Each language lives in its own folder, with real HTML pages: `/about/` in English,
`/it/about/` in Italian, `/de/about/` in German. Whatever is at the root of the site is the
**default language**, and its addresses never move. It doesn't have to be English: a site can
be Italian at the root and keep English in `/en/`.

What makes it work is in the pages themselves, so it keeps working without CraftPages:

- `<html lang="it">` on every page;
- `<link rel="alternate" hreflang="…">` links between the versions of a page, plus
  `x-default`. Search engines use them to show each visitor the right language, and
  CraftPages uses them to know which pages translate each other. Translated addresses
  (`/it/chi-siamo/` for `/about/`) work too.

## Add a language

Open **Project settings → Languages**.

1. **Add a language…**, pick it and press **Add**. The first row is the default language
   (the root); the new one gets a folder, e.g. `it/`. You can rename the language or change
   its folder before you save.
2. **Save.** The pages now say their language, and the links between translations are added.
3. **Copy to Italiano…** copies pages into the new folder, with the language set, the links
   between them added and their own links pointing at pages in the same language where there
   are some. Each copy is marked **Needs translation**. Untick pages you don't want yet.

The copy is one save: **Versions** can take it back.

If the site already has language folders (made by hand or by an AI), CraftPages detects them
and offers **Manage these languages**: nothing has to be converted.

## Translate

**Pages → Translations** lists every page with its version in each language:
**Original**, **Needs translation**, **Translated** or **Outdated**. Click a status to open
that version, or **Create** to copy a page that doesn't have one yet.

In the page editor, the bar above the page shows the versions (**EN**, **IT**, **+ DE** for one
that doesn't exist yet) and where this one stands:

- Click text and type the translation, as with any edit. Click something already translated and
  the bar shows the original text next to it.
- Shared parts (header, footer, menu) are shared per language: translate the Italian menu once
  and choose **All N pages** to put it on every Italian page. The English pages keep theirs.
- When you're done, **Mark as translated**.

When the original page changes later, its translations become **Outdated** ("The English page
changed since this one was translated"). Update the translation, then **Mark as up to date**.

## The site's address

Search engines want full addresses in the links between translations. Fill in **Base URL** in
**Project settings → Site**; Languages then offers **Update pages** to rewrite the links.

## Language switcher

**Project settings → Languages → Add to the site…** puts a row of links on your pages, one
per language, each going to the same page in that language (or to the language's home page
when the page has no version there).

1. **Where:** click where it goes in your header or menu, then choose before, after or inside.
   Add it to every page with that part, in every language, or to this page only.
2. **Look:** text, flag, or flag and text, with your own labels.

The switcher is plain HTML with its styles inline, and the flags are small files in
`assets/craftpages-flags/`. It updates itself when you add a page or a language. **Change
look…** restyles every switcher; **Remove** takes them all off.

## Blog and search

With languages set up, each language with posts gets its own blog in its folder (lists, tags,
feed, dates in that language). In the post editor, pick a post's language, or open its version
in another one. Site search keeps one index per language, so visitors search the pages in the
language they're reading.

## Remove a language

Remove its row in **Languages** and save. Its pages stay where they are, untouched, and
CraftPages says they're in the folder of a language the site doesn't list. The links from
other pages to them are removed on **Update pages**. Add the language again to manage them,
or delete the folder.

**Stop managing languages** forgets the list; no page is changed.
