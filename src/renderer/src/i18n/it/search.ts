import type { Translation } from '../types'

const messages: Translation['search'] = {
  title: 'Ricerca nel sito',

  nothingChanged: 'Nessuna modifica.',
  pagesUpdated: {
    one: '{count} pagina aggiornata.',
    other: '{count} pagine aggiornate.'
  },
  skipped: 'Saltate: {list}',
  undone: 'Annullato.',
  iconsRestyled: 'Aspetto delle icone aggiornato.',
  iconAdded: 'Icona aggiunta.',
  searchAdded: 'Ricerca aggiunta.',
  searchRemoved: 'Ricerca rimossa: script, icone e indice.',
  boxSaved: 'Casella di ricerca salvata.',
  pageSearchable: '{path} ora è incluso nella ricerca.',
  pageLeftOut: '{path} ora è escluso dalla ricerca.',

  introTitle: 'Ricerca per i tuoi visitatori',
  introText:
    'Un’icona di ricerca sulle tue pagine apre una casella di ricerca pulita e fluttuante, che mostra i risultati da tutte le pagine mentre i visitatori digitano. Ha lo stesso aspetto su qualsiasi sito, quindi non c’è niente da progettare: scegli solo dove va l’icona e che aspetto ha.',
  introServerless:
    'Funziona senza server: l’indice viene creato dalle tue pagine a ogni salvataggio.',
  introKeyboard:
    'Si apre anche con ⌘K / Ctrl+K e «/». Funziona con la tastiera e con gli screen reader.',
  introClean: 'Tutto resta nel tuo HTML, e disattivando la ricerca viene rimosso in modo pulito.',
  introAdd: 'Aggiungi la ricerca al sito…',

  onTitle: 'La ricerca nel sito è attiva',
  installedOn: {
    one: 'Installata su {with} di {count} pagina.',
    other: 'Installata su {with} di {count} pagine.'
  },
  indexInfo: {
    one: 'L’indice ({count} pagina, {size}) viene ricreato a ogni salvataggio, pubblicazione del blog e deploy.',
    other:
      'L’indice ({count} pagine, {size}) viene ricreato a ogni salvataggio, pubblicazione del blog e deploy.'
  },
  rebuiltAlways: 'L’indice viene ricreato a ogni salvataggio, pubblicazione del blog e deploy.',
  tryIt: 'Provala',
  rebuildIndex: 'Ricrea l’indice',
  indexRebuilt: {
    one: 'Indice ricreato: {count} pagina, {size}.',
    other: 'Indice ricreato: {count} pagine, {size}.'
  },
  turnOff: 'Disattiva',
  missing: {
    one: '{count} pagina non ha ancora la ricerca (una pagina nuova?). <link>Aggiungila</link>',
    other: '{count} pagine non hanno ancora la ricerca (pagine nuove?). <link>Aggiungila</link>'
  },
  indexLarge:
    'L’indice pesa {size} e i visitatori lo scaricano alla prima ricerca. Con una connessione veloce resta rapido, ma su mobile rallenta. Escludi le pagine lunghe o d’archivio (“Cosa si può cercare”, qui sotto) o segna i blocchi ripetuti con data-craftpages-search-ignore.',
  tryHelp:
    'La tua home page con i suoi script attivi. Premi Esc per chiudere la casella; fai clic sull’icona o premi ⌘K / Ctrl+K nell’anteprima per riaprirla. Nell’editor di pagina la ricerca funziona in modalità Interagisci (la modalità Modifica disattiva gli script del sito).',
  closePreview: 'Chiudi anteprima',
  tryFrame: 'Anteprima della ricerca nella home page',

  iconTitle: 'Icona di ricerca',
  triggersSummary: {
    one: 'Icone o pulsanti che aprono la ricerca: {triggers}, su {count} pagina.',
    other: 'Icone o pulsanti che aprono la ricerca: {triggers}, su {count} pagine.'
  },
  noTriggers: 'Sulle tue pagine non c’è ancora nulla che apra la ricerca, a parte ⌘K / Ctrl+K.',
  addAnotherIcon: 'Aggiungi un’altra icona…',
  addIcon: 'Aggiungi un’icona…',
  changeLook: 'Cambia l’aspetto…',
  iconPreview: 'Icona di ricerca su sfondo chiaro e scuro',
  iconOwn:
    'Ti serve in un punto che lo strumento non raggiunge, o nel tuo design? Aggiungi l’attributo {attr} a qualsiasi pulsante o link, oppure incolla il markup dell’icona.',
  copyMarkup: 'Copia il markup dell’icona',

  boxTitle: 'Casella di ricerca',
  boxDescription:
    'Un design minimale proprio, uguale su ogni sito, chiaro o scuro in base al sistema del visitatore.',
  accent: 'Colore di evidenziazione',
  accentHint:
    'Evidenzia il risultato selezionato e le parole trovate. Lascia vuoto per un grigio neutro.',
  theme: 'Tema',
  themeAuto: 'Come il sistema',
  themeLight: 'Chiaro',
  themeDark: 'Scuro',
  themeHint: 'Come il sistema segue l’impostazione di ogni visitatore.',
  placeholder: 'Testo segnaposto',
  placeholderHint: 'Lascia vuoto per «{text}», nella lingua della pagina.',
  emptyText: 'Testo senza risultati',
  emptyTextHint: 'Lascia vuoto per «{text}», nella lingua della pagina.',
  shortcut: 'Apri con ⌘K / Ctrl+K e «/»',
  suggested: 'Pagine suggerite',
  suggestedHint:
    'Mostrate all’apertura della casella, prima di digitare. Non selezionarne nessuna per una casella vuota.',

  indexedTitle: 'Cosa si può cercare',
  indexedDescription:
    'Il contenuto principale di ogni pagina, diviso in base alle intestazioni; i risultati portano all’intestazione o alla sezione. Intestazione, navigazione, piè di pagina, moduli e tutto ciò che è marcato con {attr} vengono ignorati.',
  colPage: 'Pagina',
  colInSearch: 'Nella ricerca',
  colTriggers: 'Attivatori',
  excludedNo: 'No · {reason}',
  excluded404: 'Pagina non trovata',
  excludedMeta: 'Esclusa',
  leaveOutHelp:
    'Escludere una pagina aggiunge il meta tag {meta}. Articoli ed elenchi del blog seguono la loro pagina di layout.',

  positionAfter: 'Dopo',
  positionBefore: 'Prima',
  positionEnd: 'Dentro, alla fine',
  positionStart: 'Dentro, all’inizio',
  markLabel: 'L’icona di ricerca va qui',
  applyAll: 'Applica a tutte le icone',
  placeIcon: 'Inserisci l’icona',
  addSearchSite: 'Aggiungi la ricerca al sito',
  pageSelect: 'Pagina',
  screenSize: 'Dimensione dello schermo',
  desktop: 'Desktop',
  mobile: 'Mobile',
  setupFrame: 'Anteprima della pagina: {page}',
  opening: 'Apertura di {page}…',
  setupRestyle: 'Cambia l’aspetto dell’icona',
  setupAddIcon: 'Aggiungi un’icona di ricerca',
  setupAdd: 'Aggiungi la ricerca',
  steps: 'Passaggi',
  stepWhere: '1 · Dove',
  stepLook: '2 · Aspetto',
  stepDone: '(fatto)',
  whereTitle: 'Fai clic dove deve andare l’icona di ricerca',
  whereHint: 'Di solito nell’intestazione, accanto al menu. L’icona compare subito lì.',
  selectParent: 'Seleziona l’elemento che lo contiene',
  positionLegend: 'Posizione dell’icona',
  scopeLegend: 'Aggiungila a',
  scopeAll: 'Tutte le pagine con questa intestazione',
  scopePage: 'Solo questa pagina',
  ownTrigger:
    'Usi un tuo attivatore? <link>Attiva la ricerca senza icona</link> e aggiungi l’attributo {attr} a qualsiasi pulsante o link.',
  noIconsYet: 'Nessuna icona inserita; questo aspetto verrà usato per la prossima.',
  nextLook: 'Avanti: l’aspetto',

  icon: 'Icona',
  iconCustom: 'SVG personalizzato',
  iconSearch: 'Lente',
  iconTextSearch: 'Righe',
  iconScanSearch: 'Cornice',
  iconSearchCircle: 'Cerchio',
  iconSearchSquare: 'Quadrato',
  iconCommand: 'Comando',
  svgMarkup: 'Markup SVG',
  svgHint: 'Script, link e gestori di eventi vengono rimossi.',
  size: 'Dimensione (px)',
  lineWidth: 'Spessore linea',
  padding: 'Spaziatura interna (px)',
  radius: 'Raggio angoli (px)',
  color: 'Colore',
  colorHint: '{current} segue il testo circostante; funziona anche {variable}.',
  background: 'Sfondo',
  backgroundHint: 'Usa {transparent} per nessuno sfondo.',
  label: 'Etichetta',
  labelHint: 'Letta dagli screen reader e mostrata al passaggio del mouse.',
  pickColor: '{label}: scegli un colore'
}

export default messages
