import type { Translation } from '../types'

const messages: Translation['tracking'] = {
  title: 'Analytics e tracciamento',
  description:
    'Scegli un servizio e incolla il suo ID: CraftPages aggiunge il suo tag a ogni pagina, anche a quelle che aggiungerai dopo.',
  none: 'Ancora nessun analytics.',
  colService: 'Servizio',
  colStatus: 'Ora',
  waits: 'Attende il consenso',
  waitsOff: 'Parte senza chiedere (il consenso cookie è spento)',
  runs: 'Parte per tutti',
  cookieless: 'Parte: non usa cookie',
  missing: {
    one: 'Non ancora su {count} pagina',
    other: 'Non ancora su {count} pagine'
  },
  onPages: {
    one: 'Su {count} pagina',
    other: 'Su {count} pagine'
  },
  edit: 'Modifica',
  remove: 'Rimuovi',
  removed: '{name} rimosso da ogni pagina.',
  added: '{name} aggiunto.',
  changed: '{name} modificato.',
  byHand:
    'Le tue pagine caricano già {name}, aggiunto a mano ({count} pagine). Aggiungerlo anche qui conterebbe ogni visita due volte: prima togli il codice incollato, oppure lascialo com’è.',

  addTitle: 'Aggiungi un servizio',
  editTitle: 'Modifica {name}',
  service: 'Servizio',
  chooseService: 'Scegli un servizio…',
  groupAnalytics: 'Analytics',
  groupMarketing: 'Pubblicità e marketing',
  groupCookieless: 'Analytics senza cookie',
  groupOther: 'Altro',
  add: 'Aggiungi a ogni pagina',
  save: 'Salva',
  cancel: 'Annulla',
  categoryLabel: 'Che cosa fa',
  categoryHint: 'Decide quale consenso serve al visitatore prima che parta.',
  needsConsentOff:
    'Nell’UE e nel Regno Unito {name} richiede il consenso dei visitatori prima di partire, e il consenso cookie è spento.',
  alsoConsent: 'Attiva anche il consenso cookie (consigliato)',
  needsConsentOn: 'Attende il consenso: parte solo per chi accetta {category}.',
  noConsentNeeded: '{name} non usa cookie, quindi parte senza chiedere. Nessun banner necessario.',

  field_id: 'ID',
  field_domain: 'Dominio',
  field_script: 'Indirizzo dello script',
  field_name: 'Nome',
  field_code: 'Codice',
  scriptHint: 'Solo se lo ospiti tu. Vuoto usa quello del servizio.',
  domainHint: 'Come impostato in Plausible. Vuoto usa l’indirizzo del sito.',
  nameHint: 'Come appare qui e nell’elenco del consenso.',
  codeHint:
    'Il codice che ti ha dato il servizio. Vengono aggiunti solo i tag <script>; un’eventuale parte <noscript> viene lasciata fuori.',
  hint_ga4:
    'ID di misurazione, da Google Analytics → Amministrazione → Stream di dati → il tuo sito. Inizia con G-.',
  hint_gtm: 'ID del contenitore, in alto in Tag Manager. Inizia con GTM-.',
  'hint_meta-pixel': 'ID del pixel (cifre), da Meta Gestione eventi → Origini dati.',
  hint_clarity: 'ID progetto, da Clarity → Impostazioni → Panoramica.',
  hint_linkedin: 'ID partner (cifre), da Campaign Manager → Analizza → Insight Tag.',
  hint_tiktok: 'ID del pixel, da TikTok Ads Manager → Risorse → Eventi → Eventi web.',
  hint_plausible: '',
  hint_umami: 'ID del sito, da Umami → Impostazioni → Siti web → Modifica.',
  'hint_cloudflare-analytics':
    'Token, da Cloudflare → Analytics e log → Web Analytics → Gestisci sito → il token nello snippet.',
  hint_custom: '',

  excludedTitle: 'Pagine senza tracciamento',
  excludedDescription:
    'Una pagina di ringraziamento o una pagina privata si può escludere. Il segno resta nella pagina stessa.',
  excludedNone: 'Ce l’hanno tutte le pagine.',
  excludePick: 'Escludi una pagina…',
  exclude: 'Escludi',
  include: 'Rimetti',
  excludedSet: '{path} è esclusa.',
  includedSet: '{path} ce l’ha di nuovo.',

  howTitle: 'Come funziona',
  howTags:
    'Ogni tag viene scritto nell’<head> della pagina con un segno che indica il servizio, così CraftPages può modificarlo o toglierlo senza toccare altro. L’ID sta nel tag stesso.',
  howConsent:
    'Con il consenso cookie attivo, i tag che lo richiedono vengono scritti già in attesa: non partono mai prima che il visitatore accetti.',
  howPublish: 'Prima di ogni pubblicazione, anche le pagine aggiunte nel frattempo ricevono i tag.'
}

export default messages
