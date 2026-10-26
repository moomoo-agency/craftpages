# Publishing

CraftPages publishes to **Cloudflare** (free static hosting, see [[Setting up Cloudflare]])
or to **any web host over FTP, FTPS or SFTP** (see [[Publishing to a web host]]). Once that's
set up, click **Publish site** at the bottom of the sidebar, then **Publish to the live
site**.

- **Only changed files are uploaded.** The Publish screen lists the pages that change with
  the next publish, then the other files (styles, scripts, images) by path. It follows your
  edits as you make them, in CraftPages or in another editor. The first publish uploads
  everything.
- **Before uploading,** CraftPages refreshes the sitemap (if automatic) and the site-search
  index.
- **Unsaved edits aren't published.** If some pages have unsaved edits, the Publish screen
  names them and offers **Save all and publish**, or **Publish without them**.
- **You can leave the Publish screen while it publishes.** The publish carries on, and coming
  back shows its progress, then the result. A publish the scheduler started shows the same way.
  One publish runs at a time.

## Speed

**Project settings → Speed** decides what publishing does to the copy it uploads, so pages show
sooner. The files in your folder stay exactly as they are, so nothing gets harder to edit.
Everything is off until you switch it on.

- **Minify CSS and JavaScript**: spaces and comments go. A file that can't be minified is sent
  as it is.
- **Let browsers keep styles, fonts and images for a year**: they're also published under an
  address that changes whenever the file does (`/_v/…`), and your pages point there, so visitors
  never see an old copy. The originals stay where they were. Scripts keep their address. On a
  web host, the year of caching needs Apache's `mod_headers`.
- **Put stylesheets into the pages**: a page then shows without waiting for its stylesheets.
  Best for small ones, since every page carries them. The size is measured gzipped, per page.
- **Fonts from other websites**: if the site loads fonts from Google Fonts or Bunny Fonts,
  **Self-host** copies them into `assets/fonts/` and links them from your site instead. They
  look the same, and the first visit saves two connections. You can undo it.

Changing a speed setting counts as a change: the Publish screen says the next publish sends
new optimized copies.

A good start for most sites: minify and long caching on, stylesheets into the pages up to
30 KB. If the site uses Google Fonts, self-host them first. Check the result with
[PageSpeed Insights](https://pagespeed.web.dev/) after publishing.

## Publish history

Every publish is kept as a version in the project folder (`.sitecms/store/`), with what
changed: new, changed and removed files, who published it and where. **Publish → Publish
history** lists them.

- **Restore…** puts the site files in the folder back as they were in that version. It can
  be undone. Publish afterwards to put it live.
- **Save as folder…** writes that version out as a complete, separate project.

Unchanged files are stored once, however many versions hold them, so history takes little
space.

## Rolling back on Cloudflare

**Publish → On Cloudflare** lists the versions Cloudflare keeps. **Roll back…** puts an
earlier one live again, immediately. Your folder isn't changed: the next publish sends what's
in the folder. (A web host keeps no versions: use **Restore…** in Publish history, then
publish.)

## "The live site was published from somewhere else"

CraftPages stops before publishing over a version that this folder didn't publish, because
that would wipe out someone else's changes. See [[Working with others]].
