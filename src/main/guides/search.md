# Site search (CraftPages)

Use this when the user asks for search on their site ("add search", "I need searching").
CraftPages ships the search itself; your job is only markup in the site's pages.

## How it works

- `/assets/craftpages-search.js` is a small loader, included once per page.
- Any element with the attribute `data-craftpages-search` opens a floating search box
  (the `<craftpages-search>` custom element, vanilla JS, loaded on first use). ⌘K / Ctrl+K
  and "/" open it too.
- Results come from `/search-index.json`, which **CraftPages rebuilds from the pages** on
  save, blog publish and deploy. Never write or edit the index yourself.
- The box has its own minimal design on every site. It doesn't try to match the site;
  only the trigger does.

## Turning search on

The user normally does this in CraftPages → Search → "Turn on" (it writes the script tag
on every page, the assets and the index). If search is already on (the script is in
`<head>` of index.html), don't add it again.

If you are asked to add it to pages yourself (for example to a page you are creating),
put this before `</head>`, copying the attributes from the tag already on index.html so
every page has the same options:

```html
<script src="/assets/craftpages-search.js" defer></script>
```

Options, as attributes on that script tag (all optional):

| Attribute          | Meaning                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `data-accent`      | Highlight color, any CSS color (default: neutral grey)             |
| `data-theme`       | `auto` (default, follows the OS), `light`, `dark`                  |
| `data-placeholder` | Input placeholder (default: in the page's `lang`)                  |
| `data-empty`       | "No results" text                                                  |
| `data-suggest`     | Comma-separated page URLs listed before typing, e.g. `/,/pricing/` |
| `data-shortcut`    | `off` disables ⌘K / Ctrl+K and "/"                                 |
| `data-index`       | Index URL (default `/search-index.json`)                           |

If the assets are missing (`/assets/craftpages-search.js` doesn't exist), tell the user to
turn search on in CraftPages → Search instead of writing those files.

## The trigger

Anything can open search: add `data-craftpages-search` to a button or link.
Prefer a real `<button type="button">` with an accessible name:

```html
<button type="button" class="site-search" data-craftpages-search aria-label="Search">
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
</button>
```

- Match the site: style the trigger with the site's own classes and CSS (color, size,
  hover). Using `currentColor` in the SVG lets it follow the text color.
- Put it where visitors look for it, usually in the header next to the nav. The header is
  repeated on every page, so the same change belongs on every page that has it (see
  `list_components`).
- Several triggers per page are fine, e.g. one in the desktop nav and one in the mobile
  menu, shown and hidden with the site's own `@media` rules.
- A link that already says "Search" can simply get the attribute:
  `<a href="#" data-craftpages-search>Search</a>`.
- Any link to `#craftpages-search` (e.g. `/#craftpages-search` from another site or an email)
  opens search when the page loads.
- Buttons CraftPages inserts itself have `class="craftpages-search-icon"` and inline styles.
  Don't edit those by hand; the user restyles them in CraftPages → Search.

## What gets indexed

- Every HTML page except 404, pages with `<meta name="robots" content="noindex">`, and
  pages with `<meta name="craftpages:search" content="exclude">`.
- The text of `<main>` (or `<body>` without header, nav, footer and aside when there is no
  `<main>`), split at `h1`–`h4`. A result links to `page#id` when the heading, or the
  `<section>`/`<article>` around it, has an `id`. **Give sections and headings ids** for
  good deep links.
- Skipped: scripts, forms, buttons, `hidden` or `aria-hidden="true"` elements, and
  anything marked `data-craftpages-search-ignore` (use it for cookie banners, repeated
  CTAs, testimonials carousels…).
- The page title is the `<title>` without the " · Site name" suffix; the description is
  the meta description.

## Styling the box (optional)

The box uses no shadow DOM. Tune it only through CSS variables on the element, in the
site's stylesheet:

```css
craftpages-search {
  --craftpages-search-accent: var(--brand);
  --craftpages-search-radius: 12px;
  --craftpages-search-font: var(--font-sans);
  --craftpages-search-top: 12vh; /* distance from the top */
  --craftpages-search-width: 680px;
}
```

Also available: `--craftpages-search-bg`, `--craftpages-search-fg`,
`--craftpages-search-muted`, `--craftpages-search-border`, `--craftpages-search-backdrop`.
Don't restyle its internal classes (`.cps-*`); they may change.

## JavaScript API

`window.CraftPagesSearch.open()`, `.close()`. The event `craftpages.search.ready` fires on
`document` when the loader has run.
