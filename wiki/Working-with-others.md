# Working with others

Cloudflare keeps only the published site, not its source files, and there is no way to
download them back: no token permission allows it. A web host does keep the files, but
nothing there says which copy is the latest. Each publish replaces the **whole** site
with the folder it was published from.

So if two copies of the site folder exist (two people, two computers, or CraftPages and
`wrangler deploy`), whoever publishes last wipes out the other's changes, silently.

## What CraftPages does about it

CraftPages remembers, in the site's `.sitecms/` folder, every version it put live from that
folder. Before each publish it asks Cloudflare what is live now. If that version came from
somewhere else, it stops and shows:

> **The live site was published from somewhere else.** The version online now was published
> on 3 Oct 2026, 14:05 by anna@example.com (wrangler)…

You can then **Cancel** and get the latest files first, or **Publish anyway** if you know
your folder is up to date.

The check tells you that two copies have drifted apart. It can't merge them. That part is
up to how you share the folder.

## Sharing one site

**Sync (beta, new in 1.1).** CraftPages can keep the project in step between computers
itself, through your Cloudflare account or your web host: changes, unsaved edits, publish
history, and who has which page open. Publishing with sync on publishes on top of what the
other computers have, never over it. See [[Sync between computers]].

**Git (best for teams).** Keep the site folder in a repository on GitHub, GitLab or
Bitbucket, including `.sitecms/`.

1. Before editing: pull (`git pull`, or **Fetch/Pull** in GitHub Desktop).
2. Edit and publish in CraftPages.
3. After publishing: commit and push.

Git merges changes to different pages and shows a conflict when two people changed the same
lines.

**A synced folder (one person, several computers).** Dropbox, iCloud Drive, OneDrive or
Google Drive work well if only one computer has the site open in CraftPages at a time. Let
the sync finish before opening it on the other computer.

**Handing a site over (e.g. to a client).**

1. Make sure the folder has the latest version and publish it once from CraftPages.
2. Send the whole folder (zip it), including `.sitecms/`.
3. The client opens it in CraftPages with their own connection
   ([[Setting up Cloudflare]]). From then on **their copy is the master**.
4. Need to change something later? Ask for their current folder first, or use git together.

## The first publish from a folder

Publishing from a folder for the first time to a site that is already live (for example one
set up with `wrangler`, or published from another computer) shows the warning once. If the
folder holds the latest files, choose **Publish anyway**. After that, publishes from this
folder go through without asking.
