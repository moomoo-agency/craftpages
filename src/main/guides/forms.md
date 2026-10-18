# Forms (CraftForms)

Static sites have no backend; forms come from CraftForms. A form is either on
craftforms.app (hosted) or on the user's own WordPress with the CraftForms plugin
(self-hosted). CraftPages connects to craftforms.app accounts; a self-hosted form
is just a snippet the user pasted.

## The snippet

Every CraftForms form on a page is this snippet, whoever made it:

```html
<div
  data-craftforms-embed="EMBED_KEY">
</div>
<script src="https://SITE/wp-content/plugins/craftforms-premium/build/webcomponents/embed.js" defer></script>
```

- `data-craftforms-embed`: the embed key. Its first part (before the dot) is
  base64url of the CraftForms site's address, which is how the loader finds it.
- Optional: `data-lang` (e.g. `de-DE`; without it the form follows the page's
  `<html lang>`), `data-resource-id` and `data-resource-sig` (a catalog item for
  bookings and products, with its signature), `data-loader="off"` (no spinner),
  `data-loading-label`.
- The `<script>` (the loader) is needed once per page, whatever the number of forms.
- A key works only on the website it was made for (and `www.` + it). On any
  other address the form does not appear and cannot be submitted.

## How to add a form

1. Call `list_forms`. It returns the project's connected account (or none), the
   website its forms are made for and whether that website is authorised, the
   account's forms, and every embed already on the site.
2. If there is no account, or no form fits, tell the user to open **Forms** in
   CraftPages (they can connect or create a free account there). Do not invent
   embed keys.
3. Call `form_snippet` with the form's id. It returns the exact snippet for the
   project's website, and whether the page you want already loads the loader.
   It refuses when that would use a new website slot of the plan: ask the user
   to insert that first form from the Forms view, which asks them to confirm.
4. Put the snippet where it belongs with `propose_change` (an "edit" that inserts
   it next to the element it should follow). Add the `<script>` only when the page
   doesn't have it yet.

## Do not

- Build a form in HTML with an action pointing somewhere: a static site has
  nowhere to receive it.
- Change a key by hand to "fix" a website: the key is tied to its website on
  CraftForms. The user changes it in Forms (Edit → Made for website).
- Duplicate the loader script on a page.
