import type { Translation } from '../types'

const messages: Translation['app'] = {
  viewPages: 'Pagine',
  viewBlog: 'Blog',
  viewComponents: 'Parti condivise',
  viewMedia: 'Media',
  viewSeo: 'SEO',
  viewSearch: 'Ricerca nel sito',
  viewAi: 'Modifica template (IA)',
  viewPublish: 'Pubblica',
  viewProject: 'Impostazioni progetto',
  viewSettings: 'Impostazioni app',
  sections: 'Sezioni',

  switchProject: 'Cambia progetto ({shortcut})',
  noProjectOpen: 'Nessun progetto aperto',
  openAProject: 'Apri un progetto',
  aiConnected: 'IA connessa: {clients}',
  proposalsWaiting: { one: '{count} proposta in attesa', other: '{count} proposte in attesa' },
  publishSite: 'Pubblica il sito',

  dismissError: 'Chiudi questo errore',
  scheduledToast: '“{label}” va online {at}. Puoi seguirlo in Pubblica.',
  scheduledToastUntil:
    '“{label}” va online {at} e viene ritirato {until}. Puoi seguirlo in Pubblica.',
  scheduledOtherProject: '{project}: {message}',

  savedPages: {
    one: '{count} pagina salvata nella cartella del sito · non ancora online',
    other: '{count} pagine salvate nella cartella del sito · non ancora online'
  },
  nothingToSave: 'Niente da salvare',
  skippedShared: {
    one: '{count} modifica condivisa saltata: lì il contenuto è diverso',
    other: '{count} modifiche condivise saltate: lì il contenuto è diverso'
  },
  skippedDetail: '{component} in {page}: diverso da {from}',
  undoSave: 'Annulla salvataggio',
  unsavedSummary: {
    one: 'Modifiche non salvate su {count} pagina',
    other: 'Modifiche non salvate su {count} pagine'
  },
  editsCount: { one: '{count} modifica', other: '{count} modifiche' },
  fromShared: { one: '{count} da parti condivise', other: '{count} da parti condivise' },
  seoChanges: 'SEO',
  discardPage: 'Scarta le modifiche su {page}',
  staleNote: 'Modificate sul disco, quindi queste modifiche verranno scartate: {pages}',
  confirmDiscardAll: 'Scartare tutte le modifiche non salvate?',
  schedule: 'Programma…',
  scheduleHint: 'Salva queste modifiche a un’ora stabilita invece che adesso',
  saveAll: 'Salva tutto',
  saveAllHint: 'Scrivi tutte le modifiche nella cartella del sito ({shortcut})',

  projects: 'Progetti',
  addProject: 'Aggiungi progetto…',
  searchProjects: 'Cerca tra i progetti recenti',
  noMatch: 'Nessun progetto corrisponde a “{query}”.',
  noRecent: 'Ancora nessun progetto recente. Aggiungi la cartella di un sito per iniziare.',
  currentBadge: 'aperto',
  unsavedBadge: { one: '{count} non salvata', other: '{count} non salvate' },
  deploysTo: 'Pubblica su {name}',
  removeFromList: 'Rimuovi {name} dall’elenco (la cartella non viene toccata)',

  openSiteTitle: 'Apri un sito',
  openSiteBody:
    'Scegli la cartella con i file HTML del sito. Resta la fonte originale: CraftPages modifica i file direttamente.',
  openProjectButton: 'Apri progetto…',
  noPages: 'Ancora nessuna pagina HTML in questa cartella.',
  colTitle: 'Titolo',
  badgeBlog: 'blog',
  generatedHint: 'Costruita dal blog: aprila come la vedono i visitatori',
  badgeTemplate: 'modello del blog',
  badgePostTemplate: 'modello articolo',
  postTemplateHint:
    'Ogni articolo è costruito da questa pagina: modificala per cambiare l’aspetto di tutti gli articoli. Una volta pubblicato il blog, resta fuori dal sito e i link verso di essa portano al blog.',
  templateHint:
    'Il blog è costruito da questa pagina: modificala per cambiare l’aspetto dell’elenco degli articoli. Una volta pubblicato il blog, resta fuori dal sito e i link verso di essa portano al blog.',
  editPageHint: 'Modifica {title}',
  untitled: 'Senza titolo',
  publishUnsaved: {
    one: '{count} pagina ha modifiche non salvate: salvale per pubblicarle',
    other: '{count} pagine hanno modifiche non salvate: salvale per pubblicarle'
  },
  saveFailed: 'Salvataggio non riuscito: {error}',
  skippedExplain:
    'Queste pagine hanno una propria versione della parte condivisa, quindi la modifica non è stata applicata. Aprine una per modificarla a mano.',
  colAddress: 'Indirizzo',
  discardAllAction: 'Scarta tutte le modifiche…',
  navContent: 'Contenuti',
  navSite: 'Sito',
  allLive: 'Tutto salvato · sito online aggiornato',
  navSettings: 'Impostazioni',
  unsavedShort: { one: '{count} non salvata', other: '{count} non salvate' },
  savedFiles: {
    one: '{count} file scritto · non ancora online',
    other: '{count} file scritti · non ancora online'
  },
  readyToPublish: 'Modifiche pronte da pubblicare',
  changesHere: {
    one: '{count} modifica su questa pagina',
    other: '{count} modifiche su questa pagina'
  },
  pagesUnsaved: { one: '{count} pagina non salvata', other: '{count} pagine non salvate' },
  confirmDiscardPage: 'Scartare le modifiche su {page}?',
  pagesReady: {
    one: '{count} pagina pronta da pubblicare',
    other: '{count} pagine pronte da pubblicare'
  }
}

export default messages
