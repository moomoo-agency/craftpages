import type { Translation } from '../types'

const messages: Translation['seo'] = {
  title: 'SEO',

  checkTitle: 'Controllo del sito',
  checking: 'Controllo di tutte le pagine…',
  checkingShort: 'Controllo…',
  checkAgain: 'Controlla di nuovo',
  checkSummary: {
    one: '{count} pagina controllata. Problemi: {error} · Da migliorare: {warning} · Note: {info}',
    other: '{count} pagine controllate. Problemi: {error} · Da migliorare: {warning} · Note: {info}'
  },
  severityFilter: 'Filtra per gravità',
  kindFilter: 'Filtra per argomento',
  filterError: 'Problemi',
  filterWarning: 'Da migliorare',
  filterInfo: 'Note',
  tagError: 'Problema',
  tagWarning: 'Migliora',
  tagInfo: 'Nota',
  allKinds: 'Tutti gli argomenti',
  kindTitle: 'Titoli',
  kindDescription: 'Descrizioni',
  kindHeadings: 'Intestazioni',
  kindImages: 'Immagini',
  kindLinks: 'Link',
  kindCanonical: 'Canonical',
  kindSocial: 'Social',
  kindLanguage: 'Lingua',
  kindIndexing: 'Indicizzazione',
  nothingInFilter: 'Nessun risultato con questo filtro.',
  noIssues: 'Nessun problema trovato.',
  openPage: 'Apri pagina',
  openPageLabel: 'Apri pagina {page}',

  defaultsTitle: 'Impostazioni SEO predefinite',
  defaultsDescription:
    'Usate per le pagine generate dall’app: articoli del blog, elenchi e pagine dei tag.',
  defaultsSaved: 'Salvato. Verrà applicato alla prossima pubblicazione del blog.',
  titlePattern: 'Schema del titolo',
  titlePatternHint:
    'Usa {title} e {site}. Esempio: «{example}». Il titolo SEO di un articolo lo sostituisce.',
  titlePatternExample: 'Il mio primo articolo',
  defaultImage: 'Immagine social predefinita',
  defaultImageHint: 'Per gli articoli senza immagine di copertina. Ideale 1200 × 630 px.',
  sitemapAuto: 'Mantieni sitemap.xml sempre completa',
  sitemapAutoHint:
    'Viene ricreata da tutte le pagine (tranne 404 e noindex) quando pubblichi il blog e prima di ogni deploy. Se disattivata, alla tua sitemap vengono aggiunti solo gli URL del blog.',
  sitemapExclude: 'Escludi dalla sitemap',
  sitemapExcludeHint: 'Uno schema per riga, ad esempio {a} o {b}',
  rebuildSitemap: 'Ricrea la sitemap',
  sitemapRebuilt: {
    one: 'sitemap.xml ricreata con {count} pagina.',
    other: 'sitemap.xml ricreata con {count} pagine.'
  },
  sitemapUpToDate: {
    one: 'sitemap.xml è già aggiornata ({count} pagina).',
    other: 'sitemap.xml è già aggiornata ({count} pagine).'
  },

  robotsDescription: 'Indica ai motori di ricerca quali parti del sito possono scansionare.',
  robotsSaved: 'robots.txt salvato.',
  robotsNoSitemap:
    'Manca la riga Sitemap, quindi i motori di ricerca devono trovare sitemap.xml da soli. <link>Aggiungi la riga</link>',

  identityTitle: 'Identità del sito',
  identityDescription:
    'Dati strutturati nella home page che comunicano ai motori di ricerca il nome e il logo del sito.',
  identityLogo: 'logo {logo}',
  identityFound: 'Trovati in index.html. Gli articoli del blog li indicano come editore.',
  identityFoundWithWebsite:
    'Trovati in index.html, insieme ai dati WebSite. Gli articoli del blog li indicano come editore.',
  identityMissing: 'La home page non descrive ancora l’organizzazione. Aggiungila qui:',
  identityName: 'Nome',
  identityUrl: 'URL del sito',
  identityLogoLabel: 'Logo',
  identityAdd: 'Aggiungi alla home page',
  identityAdded: 'Aggiunto a index.html.'
}

export default messages
