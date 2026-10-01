# Setting up Cloudflare

CraftPages publishes your site to Cloudflare as a **Worker with static assets**: Cloudflare
serves your files from its network. Serving static files is free, including on the free
plan. You need three things: a Cloudflare account, its **Account ID** and an **API token**.
This takes about five minutes, once.

## 1. Create a Cloudflare account

Sign up at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) and confirm
your email. The free plan is enough.

The first time you open **Workers & Pages**, Cloudflare asks you to choose a
`workers.dev` subdomain (e.g. `my-studio`). Sites will first be reachable at
`site-name.my-studio.workers.dev`; you can add your own domain later (step 6).

> Setting up a site for a client? Create the account in _their_ name (or have them do it),
> so the site and the token belong to them. See [[Working with others]].

## 2. Find your Account ID

Any of these works:

- Open **Workers & Pages** in the dashboard. The Account ID is in the right-hand column,
  under **Account details**, with a copy button.
- Or click the **⋯** menu next to your account name on the account home page and choose
  **Copy account ID**.
- Or look at the address bar: in `https://dash.cloudflare.com/0123abcd…/home`, the 32
  characters after `dash.cloudflare.com/` are the Account ID.

It looks like `0123456789abcdef0123456789abcdef`. It isn't secret.

## 3. Create an API token

1. In the dashboard, click the person icon (top right) → **My Profile → API Tokens**, or go
   to [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens).
2. Click **Create Token**, then **Create Custom Token → Get started**.
3. **Token name:** something you'll recognise, e.g. `CraftPages`.
4. **Permissions:** one row: **Account** · **Workers Scripts** · **Edit**.
5. **Account Resources:** **Include** · your account (the one from step 2).
6. Leave **Zone Resources**, **Client IP Address Filtering** and **TTL** as they are.
7. Click **Continue to summary**, then **Create Token**.
8. **Copy the token now.** Cloudflare shows it only once. If you lose it, roll it or create a
   new one.

The token is a password for publishing: anyone who has it can change the Workers in that
account. Don't email it or put it in the site folder. CraftPages keeps it in your system
keychain.

A token can't be limited to one Worker. If you publish sites for several clients, give each
client their own Cloudflare account and token rather than sharing yours.

## 4. Add the connection in CraftPages

1. **App settings → Deploy connections → Add connection…**
2. **Name:** e.g. `My Cloudflare` or `Acme (client)`.
3. **Account ID** and **API token:** paste them.
4. Save. CraftPages tests the token right away and says how many Workers it sees. If it says
   the token can't publish Workers, check the permission in step 3.

You can add several connections (yours, each client's). Each project picks one.

## 5. Point the project at a Worker

1. Open the site, then **Project settings → Deploy**.
2. **Connection:** the one from step 4.
3. **Worker:** type a new name (e.g. `acme-site`, lowercase, dashes allowed) or click
   **List Workers** to pick an existing one. A new Worker is created on the first publish.
   Workers that run their own code aren't offered, so CraftPages never replaces an app.
4. **Save**, then **Publish site**.

The site is live at `https://acme-site.my-studio.workers.dev` within a few seconds.

## 6. Use your own domain

Your domain has to use Cloudflare's DNS (Cloudflare → **Add a domain**, then change the
nameservers at your registrar as shown).

1. **Workers & Pages** → your Worker → **Settings → Domains & Routes → Add → Custom
   domain**.
2. Enter `www.example.com` (and/or `example.com`) and confirm. Cloudflare creates the DNS
   record and the certificate.
3. To send `example.com` to `www.example.com` (or the other way round), add a **Redirect
   Rule** in the domain's **Rules** section.

## Already published with wrangler?

A site deployed with `wrangler deploy` (assets only, no Worker script) can be published from
CraftPages: pick the same Worker name in step 5. The first publish shows a warning that the
live version came from somewhere else; that is expected (see [[Working with others]]).
