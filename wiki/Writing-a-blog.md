# Writing a blog

CraftPages adds a blog to your site in its own design: posts and the post list are built
from pages you already have, so they look like the rest of the site. There are no themes and
no templates to write.

## Set it up once

Open **Blog** in the sidebar.

1. **Choose layouts.** Pick a page for posts and one for the list of posts. CraftPages
   suggests pages that look like an article or a list of cards, and says why. Any page can be
   borrowed as a layout. Prefer dedicated blog pages? **Copy prompt** gives your AI
   ([[Connect an AI]]) a prompt to create them.
2. **Point at the post parts:** where the article goes, the title, date, cover image and
   tags.
3. **Point at the list parts:** the area with cards, one existing card and its fields, the
   pagination and the heading. If the page has no card or pagination, a simple one is used.
4. **Preview with sample posts.** Nothing is written to your site yet.
5. **Latest posts on other pages** (optional): point at a spot on the home page, for
   example, and it keeps showing the newest posts.

You can adjust any part later.

## Write posts

Posts are written in the WordPress block editor (Gutenberg): text, headings, lists, quotes,
images, galleries, tables, embeds and text columns. Pasting from Google Docs keeps the
formatting and drops the clutter. Images go through the same pipeline as everywhere else (resized,
location data removed).

Give a post a future date and **Publish** becomes **Schedule**: the post joins the blog at
that time, as long as CraftPages is running on this computer. Then publish the site, or tick
**Deploy to production when a scheduled post goes live** in the blog settings.

## What CraftPages writes

- A page per post, plus the paginated list, tag pages, `feed.xml` and sitemap entries.
- Posts are plain HTML pages in your folder. Drafts stay in `.sitecms/drafts/` until they
  are published.
- Changing a post's address adds a redirect from the old one.
- Pages the blog builds are rebuilt on every save. They can't be edited themselves: open them
  from **Pages** to see them as visitors do, and change the layout pages instead.
- Once the blog is published, the layout pages are left off the site, and links to them on
  your other pages point at the blog.

CraftPages never overwrites a page it didn't create.
