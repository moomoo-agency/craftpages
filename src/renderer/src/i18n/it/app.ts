import type { Translation } from '../types'

const messages: Translation['app'] = {
  viewPages: 'Pagine',
  viewBlog: 'Blog',
  viewComponents: 'Componenti condivisi',
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

  savedPages: { one: '{count} pagina salvata', other: '{count} pagine salvate' },
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
  fromShared: { one: '{count} da blocchi condivisi', other: '{count} da blocchi condivisi' },
  seoChanges: 'SEO',
  discardPage: 'Scarta le modifiche su {page}',
  staleNote: 'Modificate sul disco, quindi queste modifiche verranno scartate: {pages}',
  confirmDiscardAll: 'Scartare tutte le modifiche non salvate?',
  discardAll: 'Scarta tutto',
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
  colFile: 'File',
  colSize: 'Dimensione',
  badgeBlog: 'blog',
  generatedHint: 'Generata dal blog: modifica l’articolo in Blog',
  editPageHint: 'Modifica {title}',
  untitled: 'Senza titolo'
}

export default messages
