# Forms

A static site has no server to receive a contact form. CraftPages can add forms from
[CraftForms](https://craftforms.app), a separate service by the same team: contact, booking
and order forms that send submissions to you. It's optional. CraftPages works the same
without it, and recognises CraftForms forms already on your pages (also ones pasted by hand,
from another account, or from a self-hosted CraftForms site).

Open **Forms** in the sidebar.

## Connect an account

**Connect or create a free account** finishes in your browser. The connection belongs to this
project, so a client's site can use the client's own account. CraftForms' free plan is one
form on one website, with unlimited submissions.

## The website

A CraftForms form loads only on the website it's made for. Tell CraftPages which address the
site runs on (it can also become the site's **Base URL**). It shows how many of your account's
websites that uses, and warns when:

- it would use your last free website;
- the forms are made for one address but the site's address is another (they wouldn't load);
- the address looks like a test address.

Choosing a website doesn't lock anything: you can change it any time, and free a website
you no longer use.

## Add a form to a page

Your forms are listed with **Preview**: the real form, loaded the way your site loads it,
with the site's styles. Submissions are off in previews.

- **Insert in page…**: pick a page, click where the form goes, choose before, after or
  inside, and **Insert form**. The loader script is added to the page when it's missing.
- **Copy snippet**: paste it yourself.
- In a blog post, use the **Form** block.

Nothing is written until you insert, and each insert can be undone like any save.

## Forms on this site

Lists every CraftForms embed on the site's pages. **Edit** a form to swap it for another,
change the website it's made for, its language or loading label, or remove it. Removing a
form from a page gives back the page exactly as it was before.

A form speaks the language of the page it's on (the page's `<html lang>`), so on a site in
several languages ([[Sites in several languages]]) the same form shows Italian buttons and
messages on `/it/` and German on `/de/`. Set a language in **Edit** only when a page says the
wrong language, or none. Your own questions stay as you wrote them.

Forms in blog posts are changed in the post's **Form** block.

## For your AI

An AI connected to CraftPages ([[Connect an AI]]) can list your forms and get a snippet for a
page. It never uses a new website on your account by itself.
