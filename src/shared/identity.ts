/**
 * The structured data that tells search engines a site's name and logo: an
 * Organization (plus a WebSite when the page has none) in a JSON-LD script.
 * Shared so the SEO screen can show exactly what will be added to index.html.
 */
export function identityScript(
  identity: { name: string; url: string; logo: string },
  withWebsite: boolean
): string {
  const url = identity.url.trim().replace(/\/+$/, '') + '/'
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${url}#org`,
        name: identity.name.trim(),
        url,
        ...(identity.logo.trim() ? { logo: identity.logo.trim() } : {})
      },
      ...(withWebsite
        ? [
            {
              '@type': 'WebSite',
              '@id': `${url}#website`,
              name: identity.name.trim(),
              url,
              publisher: { '@id': `${url}#org` }
            }
          ]
        : [])
    ]
  }
  const json = JSON.stringify(graph, null, 2).replace(/</g, '\\u003c')
  return `<script type="application/ld+json">\n${json}\n</script>`
}

/** A robots.txt that lets every crawler in and points them at the sitemap. */
export function defaultRobots(baseUrl: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl ? `${baseUrl}/sitemap.xml` : '/sitemap.xml'}\n`
}
