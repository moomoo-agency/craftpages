# Troubleshooting

**macOS: "CraftPages can't be opened" / "is damaged".** Versions before 1.1.2 weren't
signed. Install the [latest release](https://github.com/moomoo-agency/craftpages/releases/latest),
or run `xattr -cr /Applications/CraftPages.app` (see [Installing](Installing#macos)).

**Windows: "Windows protected your PC".** Click **More info → Run anyway**.

**Linux: the AppImage doesn't start.** Make it executable (`chmod +x`) and install FUSE
(`libfuse2`, or `libfuse2t64` on Ubuntu 24.04).

**"The token can't publish Workers."** The token needs **Account · Workers Scripts · Edit**
for the right account. See [[Setting up Cloudflare]], step 3.

**"The account has no workers.dev subdomain yet."** Open **Workers & Pages** in the
Cloudflare dashboard once and choose a subdomain, or add a custom domain to the Worker.

**"… is over Cloudflare's 25 MiB file limit."** Make the file smaller, host it elsewhere
(videos: YouTube, Vimeo, Cloudflare Stream), or add it to **Never upload**.

**A Worker isn't listed in Project settings.** Workers that run their own code are hidden,
because publishing a site to them would replace that code. Use a new name.

**FTP / SFTP: can't log in or connect.** Check the server, port and user name in your
hosting control panel (SFTP is usually port 22, FTP 21). If FTPS fails, the server may not
support it: turn off **Encrypt (FTPS)** only if your host says so.

**SFTP: "The server … identifies itself with a different key than before".** CraftPages
trusts a server's key the first time and stops if it changes later. If your host moved you to
a new server, that's expected: edit the connection in **App settings → Deploy connections**
to trust the new key. Otherwise ask your host before continuing.

**The site is on the server but shows the host's default page.** The files went to the
wrong folder. Set **Project settings → Deploy → Folder on the server** to the one your host
serves (often `public_html`, `www` or `htdocs`) and publish again.

**Sync: "This token can publish, but not sync".** Sync on Cloudflare also needs
**Workers R2 Storage · Edit**, and R2 turned on for the account. The message links to both.
See [[Sync between computers]].

**"The live site was published from somewhere else."** Someone published from another
copy of the folder. See [[Working with others]].

**"Port 7424 is already in use."** Another app (or a second CraftPages) uses the AI port.
Pick another one in **App settings**.

**Files I didn't expect are online.** Everything in the folder is published except
dot-files, `node_modules` and **Never upload** patterns. See [[Your site folder]].

Still stuck? [Open an issue](https://github.com/moomoo-agency/craftpages/issues) with what
you did, what happened and your system.
