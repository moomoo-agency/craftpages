import type { Translation } from '../types'

const messages: Translation['post'] = {
  back: 'Tutti gli articoli',
  stateUnsaved: 'Modifiche non salvate',
  stateNew: 'Non ancora salvato',
  stateSaved: 'Salvato il {date}',
  backToEditor: 'Torna all’editor',
  unschedule: 'Annulla programmazione',
  unpublish: 'Annulla pubblicazione',
  update: 'Aggiorna',
  saveDraft: 'Salva bozza',
  schedule: 'Programma',
  publish: 'Pubblica',
  goesLive: 'Va online il {date}',

  leaveMessage: 'Hai modifiche non salvate.',
  keepEditing: 'Continua a modificare',
  discardChanges: 'Scarta modifiche',
  saveAndLeave: 'Salva ed esci',
  confirmDelete: 'Eliminare “{title}”? Il file dell’articolo resta in .sitecms/trash.',
  confirmDeletePublished:
    'Eliminare “{title}”? La sua pagina viene rimossa dal sito e il suo URL reindirizza all’elenco degli articoli. Il file dell’articolo resta in .sitecms/trash.',
  untitled: 'Senza titolo',
  deletePost: 'Elimina articolo',
  deletePostConfirm: 'Elimina articolo…',

  scheduledFor:
    'Programmato per il {date} su {path}. CraftPages lo pubblica a quell’ora mentre l’app è in esecuzione, anche a finestra chiusa. Se il computer è spento o in stop, esce appena si riaccende.',
  publishedAt: 'Pubblicato su {path}',
  unpublished:
    'Pubblicazione annullata: la pagina è stata rimossa dal sito e il suo URL ora reindirizza all’elenco degli articoli.',
  updated: 'Aggiornato sul sito.',
  draftSaved: 'Bozza salvata.',
  filesWritten: { one: '{count} file scritto.', other: '{count} file scritti.' },
  filesRemoved: { one: '{count} file rimosso.', other: '{count} file rimossi.' },
  deployHint: 'Per metterlo online, usa “{action}”.',

  previewTitle: 'Anteprima dell’articolo',
  titleLabel: 'Titolo dell’articolo',
  titlePlaceholder: 'Aggiungi un titolo',
  bodyPlaceholder: 'Inizia a scrivere o digita / per scegliere un blocco',

  tabsLabel: 'Impostazioni articolo',
  tabPost: 'Articolo',
  tabBlock: 'Blocco',
  slugLabel: 'URL',
  slugHintPublished: 'Se lo cambi, la pagina si sposta e il vecchio URL reindirizza al nuovo.',
  slugHintManual: 'Lettere minuscole, cifre e trattini.',
  slugHintAuto: 'Segue il titolo finché non lo modifichi.',
  dateLabel: 'Data di pubblicazione',
  dateHintFuture:
    'Data futura: “Pubblica” diventa “Programma” e l’articolo va online in quel momento.',
  tagsLabel: 'Tag',
  tagsPlaceholder: 'Aggiungi un tag e premi Invio',
  removeTag: 'Rimuovi il tag {tag}',
  tagsHint: 'Ogni tag ha una pagina che elenca i suoi articoli.',
  tagsHintExample: 'Ogni tag ha una pagina che elenca i suoi articoli, ad es. {path}.',
  coverLabel: 'Immagine di copertina',
  noCover: 'Nessuna copertina',
  chooseCover: 'Scegli immagine…',
  changeCover: 'Cambia immagine…',
  coverHint: 'Appare nella scheda dell’articolo e come immagine per i social.',
  altLabel: 'Testo alternativo',
  altPlaceholder: 'Descrivi l’immagine',
  altHint: 'Viene letto a chi non può vedere l’immagine.',
  excerptLabel: 'Estratto',
  excerptHint: {
    one: '{count} carattere (ideale 70–160). Appare nella scheda, nel feed e come meta description. Se è vuoto, si usano le prime parole dell’articolo.',
    other:
      '{count} caratteri (ideale 70–160). Appare nella scheda, nel feed e come meta description. Se è vuoto, si usano le prime parole dell’articolo.'
  },
  seoHeading: 'Ricerca e social',
  noDescription: 'Nessuna descrizione.',
  seoTitleLabel: 'Titolo SEO',
  seoTitleHint: {
    one: '{count} carattere. Se è vuoto, si usa il titolo dell’articolo.',
    other: '{count} caratteri. Se è vuoto, si usa il titolo dell’articolo.'
  },

  statusDraft: 'Bozza',
  statusScheduled: 'Programmato',
  statusPublished: 'Pubblicato',

  breakTitle: 'Posizione del banner',
  breakDescription: 'Il punto in cui l’articolo si divide attorno al banner del layout.',
  breakNote: 'Qui c’è il banner del layout; l’articolo continua sotto.',
  columnsTitle: 'Colonne di testo',
  columnsDescription: 'Paragrafi distribuiti su 2 o 3 colonne, come in un giornale.',
  columnsPlaceholder: 'Testo che scorre tra le colonne…',
  columnsPanel: 'Colonne',
  columnsCount: 'Numero di colonne',
  columnsOption: { one: '{count} colonna', other: '{count} colonne' },
  columnsHelp: 'Sui telefoni il testo diventa una sola colonna.',
  categoryLabel: 'Categoria',
  categoryHint:
    'Una per articolo, mostrata dove il layout ha un badge di categoria. Ognuna ha una pagina con i suoi articoli.',
  categoryHintExample: 'La sua pagina: {path}',
  authorLabel: 'Autore',
  authorHint: 'Lascia vuoto per mantenere il nome già presente nel layout.'
}

export default messages
