# Publishing to a web host (FTP, FTPS, SFTP)

Any hosting that gives you an FTP or SFTP login can serve your site: shared hosting,
cPanel, Plesk, a VPS. CraftPages uploads the site folder there, the same way it publishes to
Cloudflare.

## 1. Add the server

1. **App settings → Deploy connections → Add FTP / SFTP server…**
2. **Type:** choose **SFTP** if your host offers it (most do), otherwise **FTP / FTPS**.
   Keep **Encrypt (FTPS)** on unless the server refuses it: plain FTP sends your password
   and files readable by anyone on the network.
3. **Server**, **Port** and **User name:** from your hosting control panel (e.g.
   `ftp.example.com`, port 22 for SFTP, 21 for FTP).
4. **Sign in with** a password, or for SFTP a key file (usually in `~/.ssh`). The password
   is kept in your system keychain, never in the site folder.
5. **Test connection.** For SFTP, the server's key is trusted the first time. If it ever
   changes, CraftPages stops and asks.

## 2. Pick the site's folder

In **Project settings → Deploy**, choose the server connection, then the **Folder on the
server**. Hosts usually serve sites from `public_html`, `www` or `htdocs`; you can browse the
server and pick it. Empty means the folder the login starts in.

## 3. Publish

Click **Publish site**. CraftPages:

- uploads only files that changed since the last publish, images and stylesheets before
  pages, so a page never points at a file that isn't there yet;
- then removes files you deleted from the folder;
- **never deletes files it didn't upload.** Anything else in the server folder (an old site,
  a `cgi-bin`, another app) is left alone.

To know what it uploaded, CraftPages keeps a small list on the server, in
`.craftpages/manifest.json` inside the site's folder.

If the server folder already holds files that CraftPages didn't publish, the first publish
says so and asks before uploading. Files with the same names are replaced, the others kept.

## Redirects and `.htaccess`

Most shared hosts run Apache, which reads redirects from `.htaccess`, not `_redirects`.
When you publish to a server, CraftPages writes the blog's redirects into a marked block in
`.htaccess` and leaves the rest of the file alone. `.htaccess` is the one dot-file that is
uploaded to a server.

## Going back

A server keeps no versions of its own. To put an older version live, open
**Publish → Publish history**, **Restore…** the version you want into the folder, then
publish. See [[Publishing]].
