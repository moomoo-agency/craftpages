import type { Key, Translator } from '../i18n'

/** A readable kind for a shared block, from its element. */
export const COMPONENT_KINDS: Record<string, Key> = {
  header: 'components.kind_header',
  footer: 'components.kind_footer',
  nav: 'components.kind_nav',
  aside: 'components.kind_aside',
  section: 'components.kind_section',
  form: 'components.kind_form',
  article: 'components.kind_article',
  div: 'components.kind_div'
}

/** Header, footer and nav need no more than their kind. */
const SELF_NAMED = new Set(['header', 'footer', 'nav'])

/**
 * What people call a shared block: "Navigation", "Footer", or for a generic section its
 * kind and first heading ("Section “About me”"). Never its CSS selector.
 */
export function componentName(t: Translator, component: { tag: string; heading?: string }): string {
  const kind = t(COMPONENT_KINDS[component.tag] ?? 'components.kind_div')
  if (SELF_NAMED.has(component.tag) || !component.heading) return kind
  return t('components.named', { kind, name: component.heading })
}
