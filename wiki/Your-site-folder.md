# Your site folder

CraftPages edits files on your computer, not a live website. Your site is a folder with
an `index.html` (and the rest of its pages, CSS, images and so on), and that folder is what
you open in CraftPages.

**The folder is the master copy.** Whatever is in it is what gets published, and each
publish replaces the whole site on Cloudflare with it. Cloudflare can't give the files back,
so keep the folder backed up.

## Where to keep it

Anywhere on your computer. Good options:

- **A git repository** (GitHub, GitLab, Bitbucket). Every save in CraftPages is a plain file
  change, so `git diff` shows exactly what was edited and you can always go back.
- **A synced folder** (Dropbox, iCloud Drive, OneDrive, Google Drive), for a backup and to
  use the site from several computers.

If more than one person edits the site, read [[Working with others]].

## What gets published

Everything in the folder, except:

- anything whose name starts with a dot: `.git/`, `.gitignore`, `.github/`, `.DS_Store` and
  CraftPages' own `.sitecms/` folder (drafts, backups and this site's settings).
  `.well-known/` is the one dot-folder that is published;
- `node_modules/`;
- the patterns in **Project settings → Deploy → Never upload** (by default `.DS_Store`,
  `Thumbs.db` and `*.bak*`). One pattern per line: `*` matches within a folder, `**` across
  folders.

Other files next to your pages _are_ published: a `README.md`, `package.json`,
`wrangler.jsonc` and so on. If your repository holds more than the site, open the subfolder
that is the site itself (e.g. `site/`, `public/` or `dist/`), or add those files to
**Never upload**.

## Limits

Cloudflare sets these:

|                  | Limit                                            |
| ---------------- | ------------------------------------------------ |
| Files per site   | 20,000 on the free plan, 100,000 on Workers Paid |
| Size of one file | 25 MiB                                           |

CraftPages checks the file size before uploading and names any file that is too big. Large
videos are better on YouTube, Vimeo or Cloudflare Stream, embedded in your page.

## The `.sitecms` folder

CraftPages creates `.sitecms/` inside your site folder. It holds unsaved drafts, backups for
undo, scheduled changes, this site's settings and a record of what was published. It is
never published. Keep it with the folder (commit it to git if you use git) so drafts,
history and the [overwrite check](Working-with-others) travel with the site. If you also
deploy with `wrangler`, add `.sitecms` to a `.assetsignore` file in the site folder.
