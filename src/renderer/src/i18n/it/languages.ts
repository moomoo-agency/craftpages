import type { Translation } from '../types'

const messages: Translation['languages'] = {
  title: 'Lingue',
  description:
    'La lingua predefinita è alla radice del sito; ogni altra lingua ha la sua cartella (/en/, /de/…), con pagine vere collegate a quelle che traducono.',
  oneLanguage:
    'Questo sito è in una lingua. Aggiungi una lingua per gestire le traduzioni: le sue pagine vanno nella loro cartella, collegate alle pagine che traducono.',
  detected: 'Sembra che questo sito sia in {languages}.',
  useDetected: 'Gestisci queste lingue',
  root: 'radice',
  default: 'Predefinita',
  colLanguage: 'Lingua',
  colCode: 'Codice',
  colFolder: 'Cartella',
  colPages: 'Pagine',
  colActions: 'Azioni',
  addLabel: 'Aggiungi una lingua…',
  add: 'Aggiungi',
  turnOff: 'Smetti di gestire le lingue',
  turnedOff: 'Le lingue non sono più gestite. Le pagine restano come sono.',
  saved: 'Lingue salvate.',
  rootNote:
    'Le pagine alla radice del sito sono nella prima lingua: è quella predefinita. Togliere una lingua qui non tocca le sue pagine.',
  outdated: {
    one: '{count} pagina deve aggiornare la lingua o i collegamenti alle traduzioni.',
    other: '{count} pagine devono aggiornare la lingua o i collegamenti alle traduzioni.'
  },
  update: 'Aggiorna le pagine',
  updated: {
    zero: 'Non c’era niente da cambiare.',
    one: '{count} pagina aggiornata. Puoi annullare in Versioni.',
    other: '{count} pagine aggiornate. Puoi annullare in Versioni.'
  },
  skipped: {
    one: '{count} pagina con modifiche non salvate è rimasta indietro: aggiorna di nuovo dopo Salva tutto.',
    other:
      '{count} pagine con modifiche non salvate sono rimaste indietro: aggiorna di nuovo dopo Salva tutto.'
  },
  unsavedNote: {
    one: '({count} ha modifiche non salvate e viene aggiornata dopo Salva tutto.)',
    other: '({count} hanno modifiche non salvate e vengono aggiornate dopo Salva tutto.)'
  },
  whichPages: 'Quali pagine',
  upToDate: {
    zero: 'Ogni pagina indica la sua lingua. Nessuna pagina è ancora collegata alle traduzioni.',
    other: 'Ogni pagina indica la sua lingua, e i collegamenti tra le traduzioni sono aggiornati.'
  },
  missing: {
    one: '{count} pagina non ha ancora la versione in {language}',
    other: '{count} pagine non hanno ancora la versione in {language}'
  },
  unmanaged: {
    one: '{count} pagina è nella cartella di una lingua che il sito non elenca ({folders}). Resta com’è: aggiungi di nuovo la lingua per gestirla, o elimina la cartella.',
    other:
      '{count} pagine sono in cartelle di lingue che il sito non elenca ({folders}). Restano come sono: aggiungi di nuovo la lingua per gestirle, o elimina la cartella.'
  },
  conflict: 'Due pagine in {language} sono collegate come traduzioni della stessa pagina:',
  needsBaseUrl:
    'I motori di ricerca vogliono indirizzi completi nei collegamenti tra traduzioni. Compila URL di base nella sezione Sito qui sopra, poi aggiorna le pagine.',
  versions: 'Versioni in altre lingue',
  tabPages: 'Pagine',
  tabTranslations: 'Traduzioni',
  viewLabel: 'Mostra',
  statusSource: 'Originale',
  statusTranslated: 'Tradotta',
  statusNeeds: 'Da tradurre',
  statusOutdated: 'Non aggiornata',
  create: 'Crea',
  creating: 'Creazione…',
  createTip:
    'Crea la versione in {language}: una copia di questa pagina nella sua cartella, da tradurre',
  markTranslated: 'Segna come tradotta',
  openTranslations: 'Apri le traduzioni',
  leftBehind: {
    one: '{count} pagina è in {folder}. Non si sposta con la cartella: dopo il salvataggio non è più gestita. Rimetti la cartella per tenerla.',
    other:
      '{count} pagine sono in {folder}. Non si spostano con la cartella: dopo il salvataggio non sono più gestite. Rimetti la cartella per tenerle.'
  },
  turnOffConfirm: {
    one: 'Smettere di gestire le lingue? La pagina ({count}) resta com’è; si dimentica solo l’elenco delle lingue qui.',
    other:
      'Smettere di gestire le lingue? Le {count} pagine restano come sono; si dimentica solo l’elenco delle lingue qui.'
  },
  turnOffYes: 'Smetti di gestirle',
  switcherRemoveConfirm: {
    one: 'Togliere il selettore della lingua da {count} pagina? Puoi annullare in Versioni.',
    other: 'Togliere il selettore della lingua da {count} pagine? Puoi annullare in Versioni.'
  },
  switcherRemoveYes: { one: 'Togli da {count} pagina', other: 'Togli da {count} pagine' },
  summaryNeeds: { one: '{count} da tradurre', other: '{count} da tradurre' },
  summaryOutdated: { one: '{count} non aggiornata', other: '{count} non aggiornate' },
  summaryMissing: { one: '{count} da creare', other: '{count} da creare' },
  summaryDone: 'tutto tradotto',
  onlyWork: 'Solo le pagine con qualcosa da fare',
  allDone: 'Ogni pagina è tradotta e aggiornata.',
  createFor: 'Crea la versione in {language} di {page}',
  whatChanged: {
    one: 'Cosa è cambiato ({count})',
    other: 'Cosa è cambiato ({count})'
  },
  changeText: 'Cambiato',
  changeNew: 'Nuovo',
  changeGone: 'Rimosso',
  changeTitle: 'Titolo della pagina',
  changeDescription: 'Descrizione',
  changeAlt: 'Testo dell’immagine',
  changeShow: 'Mostra',
  changesHidden:
    'Nessun testo visibile è cambiato: è cambiato un attributo o un testo nascosto. Controlla la pagina, poi segnala come aggiornata.',
  markUpToDate: 'Segna come aggiornata',
  outdatedHint: 'La pagina in {language} è cambiata dopo la traduzione di questa.',
  copyOpen: 'Copia in {language}…',
  copyTitle: 'Copia pagine in {language}',
  copyIntro:
    'Ogni pagina viene copiata in {folder}, collegata alla pagina che traduce, e segnata come da tradurre. I suoi link vanno alle pagine nella stessa lingua dove ci sono. Un solo salvataggio: puoi annullarlo in Versioni.',
  copyAll: { one: 'Tutte ({count} pagina)', other: 'Tutte ({count} pagine)' },
  copyButton: { one: 'Copia {count} pagina', other: 'Copia {count} pagine' },
  copied: {
    one: '{count} pagina copiata in {language}. Traducila, poi segnala come tradotta.',
    other: '{count} pagine copiate in {language}. Traducile, poi segnale come tradotte.'
  },
  switcherPosition: 'Posizione del selettore',
  switcherTitle: 'Selettore della lingua',
  switcherOn: { one: 'Su {count} pagina.', other: 'Su {count} pagine.' },
  switcherOff:
    'Non è ancora sul sito. È una fila di link, uno per lingua, ognuno alla stessa pagina in quella lingua.',
  switcherAddButton: 'Aggiungi al sito…',
  switcherAddMore: 'Aggiungi in un altro punto…',
  switcherLook: 'Cambia aspetto…',
  switcherRemoved: {
    one: 'Selettore tolto da {count} pagina.',
    other: 'Selettore tolto da {count} pagine.'
  },
  switcherDone: {
    one: '{count} pagina aggiornata. Puoi annullare in Versioni.',
    other: '{count} pagine aggiornate. Puoi annullare in Versioni.'
  },
  switcherAdd: 'Aggiungi il selettore della lingua',
  switcherRestyle: 'Aspetto del selettore della lingua',
  switcherApply: 'Applica a tutti i selettori',
  switcherPlace: 'Aggiungi il selettore',
  whereTitle: 'Fai clic dove va il selettore',
  whereHint:
    'Di solito nell’intestazione o nel menu. Scegli l’elemento, poi dove va rispetto a esso.',
  markLabel: 'Selettore',
  scopeAll: 'Ogni pagina con questa parte, in ogni lingua',
  layoutLegend: 'Disposizione',
  layoutRow: 'Tutte le lingue in fila',
  layoutDropdown: 'Menu a tendina: la lingua attuale, che apre le altre',
  missingLegend: 'Lingue in cui questa pagina non è tradotta',
  missingHide: 'Non mostrarle',
  missingHome: 'Link alla home di quella lingua',
  displayLegend: 'Mostra',
  displayText: 'Testo',
  displayFlag: 'Bandiera',
  displayBoth: 'Bandiera e testo',
  sizeLabel: 'Dimensione (px)',
  sizeHint: 'Lascia vuoto per usare la dimensione del testo del sito.',
  sizePlaceholder: 'Come il sito',
  gapLabel: 'Spazio tra le lingue (px)',
  labelCol: 'Etichetta',
  flagCol: 'Bandiera',
  labelFor: 'Etichetta per {language}',
  flagFor: 'Bandiera per {language}',
  flagDefault: 'Predefinita',
  switcherExplain:
    'Ogni link va alla stessa pagina in quella lingua. Una lingua in cui la pagina non è tradotta non viene mostrata o porta alla sua home, come scelto sopra; se non resta nessun’altra lingua, il selettore si nasconde su quella pagina. CraftPages tiene i link aggiornati man mano che le pagine vengono tradotte.',
  setInLanguages: 'La lingua predefinita: cambiala in Lingue qui sotto.'
}

export default messages
