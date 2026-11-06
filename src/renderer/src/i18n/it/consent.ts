import type { Translation } from '../types'

const messages: Translation['consent'] = {
  title: 'Tracciamento e consenso',
  searchItems: 'Cerca script',

  // Off
  offTitle: 'Il consenso cookie è disattivato',
  offNeeds: {
    one: 'Le tue pagine caricano {count} elemento che nell’UE e nel Regno Unito richiede prima il consenso dei visitatori: {names}.',
    other:
      'Le tue pagine caricano {count} elementi che nell’UE e nel Regno Unito richiedono prima il consenso dei visitatori: {names}.'
  },
  offNothing:
    'Al momento niente nelle tue pagine richiede il consenso. Attivalo comunque se pensi di aggiungere analytics o contenuti incorporati: aspetteranno il consenso fin dall’inizio.',
  turnOn: 'Attiva il consenso cookie',
  pointScan:
    'CraftPages trova analytics, pixel pubblicitari e contenuti incorporati in ogni pagina, e blocca ciascuno finché il visitatore non accetta.',
  pointFair:
    'Il banner mostra Accetta e Rifiuta uno accanto all’altro, e i visitatori possono cambiare idea in seguito.',
  pointFiles:
    'Tutto resta nelle tue pagine: un piccolo script e un segno su ogni tag bloccato. Disattivandolo, ogni tag torna com’era.',
  turnedOn: 'Il consenso cookie è attivo.',

  // On
  onTitle: 'Il consenso cookie è attivo',
  onSummary: 'Il banner è su {with} pagine su {count}. In attesa del consenso: {held}.',
  turnOff: 'Disattiva',
  turnedOff: 'Il consenso cookie è disattivato: ogni tag è tornato com’era.',
  unknownNotice: {
    one: 'CraftPages non riconosce {names}. Viene eseguito senza chiedere finché non scegli qui sotto di cosa si tratta.',
    other:
      'CraftPages non riconosce {count} script ({names}). Vengono eseguiti senza chiedere finché non scegli qui sotto di cosa si tratta.'
  },
  missing: {
    one: '{count} pagina non ha ancora il banner (aggiunta dopo l’attivazione). <link>Aggiungilo</link>',
    other:
      '{count} pagine non hanno ancora il banner (aggiunte dopo l’attivazione). <link>Aggiungilo</link>'
  },
  tryHelp:
    'La tua home page, con le scelte aperte. Quello che scegli qui resta solo in questa anteprima.',
  tryFrame: 'Anteprima del banner cookie',

  // What the pages load
  itemsTitle: 'Cosa caricano le tue pagine',
  itemsDescription:
    'Script e contenuti incorporati da altri siti, trovati in ogni pagina. Ciascuno resta bloccato finché il visitatore non ne consente la categoria, oppure viene eseguito come parte del sito.',
  itemsNone: 'Le tue pagine non caricano niente da altri siti che CraftPages possa vedere.',
  colWhat: 'Script o contenuto incorporato',
  colStatus: 'Ora',
  colCategory: 'Categoria',
  onPages: {
    one: 'Su {count} pagina',
    other: 'Su {count} pagine'
  },
  notRecognised: 'non riconosciuto',
  statusHeld: 'Aspetta il consenso',
  statusPartly: 'Aspetta su alcune pagine, eseguito su altre',
  statusRuns: 'Eseguito senza chiedere',
  statusNecessary: 'Eseguito: necessario al sito',
  statusUnknown: 'Eseguito: non ancora classificato',
  statusCookieless: 'Eseguito: non imposta cookie',
  noneNeeded: 'Nessun consenso necessario',
  unknown: 'Non riconosciuto',
  choose: 'Scegli…',
  catNecessary: 'Necessari',
  catAnalytics: 'Statistiche',
  catMarketing: 'Marketing',
  catEmbeds: 'Contenuti incorporati',
  categorySet: '{name}: {category}.',
  howTitle: 'Come funziona',
  howHeld:
    'Uno script bloccato viene scritto con {code} e un segno con il nome della sua categoria, così i browser lo saltano. Dopo che il visitatore accetta, lo script del banner lo esegue, nell’ordine della pagina. Fino ad allora, i contenuti incorporati mostrano una breve nota con un pulsante Consenti.',
  howNecessary:
    '“Necessari” fa eseguire uno script per tutti (protezione dallo spam, pagamenti, il codice del sito stesso). La scelta viene scritta nel tag, quindi resta.',
  howNew:
    'Prima di ogni pubblicazione, anche gli script riconosciuti aggiunti nel frattempo (a mano, dalla tua IA, su una nuova pagina) vengono bloccati.',

  // Banner
  bannerTitle: 'Banner',
  bannerDescription:
    'Dove appare e cosa dice. I campi vuoti usano il testo integrato nella lingua della pagina.',
  bannerSaved: 'Banner salvato.',
  position: 'Posizione',
  positionBar: 'Barra in basso',
  positionBox: 'Riquadro nell’angolo',
  language: 'Testo per',
  languageHint: 'Le pagine di ogni lingua hanno i propri testi.',
  reopenButton: 'Mostra un piccolo pulsante che riapre le scelte',
  reopenOwn:
    'Oppure aggiungi l’attributo {attr} a un tuo link o pulsante, come “Impostazioni cookie” nel footer.',
  textTitle: 'Titolo',
  textMessage: 'Messaggio',
  textAccept: 'Pulsante Accetta',
  textReject: 'Pulsante Rifiuta',
  textChoose: 'Pulsante Scegli',
  textSave: 'Pulsante Salva',
  textPrivacy: 'Testo del link privacy',
  textPrivacyUrl: 'Pagina privacy',
  privacyUrlHint: 'La pagina che spiega quali dati raccogli. Appare come link nel banner.',
  builtIn: 'Testo integrato',
  builtInHelp:
    'Il testo integrato esiste in inglese, italiano, ucraino, tedesco, francese e spagnolo, scelto in base all’attributo lang della pagina. Le altre lingue mostrano l’inglese, a meno che tu non compili i campi.'
}

export default messages
