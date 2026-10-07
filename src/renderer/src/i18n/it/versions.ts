import type { Translation } from '../types'

const messages: Translation['versions'] = {
  title: 'Cronologia pubblicazioni',
  description:
    'Ogni pubblicazione resta come versione nella cartella del progetto, con ciò che è cambiato. Rimetti una versione precedente o salvala come cartella a parte.',
  empty: 'Ancora nessuna versione. La prossima pubblicazione sarà qui.',
  live: 'Online',
  from: 'da {device}',
  firstVersion: { one: 'prima versione, {count} file', other: 'prima versione, {count} file' },
  changes: '+{added} nuovi · {changed} modificati · −{removed} rimossi',
  keptOff: { one: '{count} file fuori dal sito', other: '{count} file fuori dal sito' },
  restore: 'Ripristina…',
  restoreConfirm:
    'Riportare i file del sito in questa cartella com’erano in questa versione? Puoi annullare.',
  restoreYes: 'Ripristina',
  export: 'Salva come cartella…',
  restored: {
    one: 'Ripristinato {count} file alla versione del {date}. Pubblica per metterla online.',
    other: 'Ripristinati {count} file alla versione del {date}. Pubblica per metterla online.'
  },
  alreadyThere: 'La cartella corrisponde già a questa versione.',
  exported: 'Salvata come progetto completo in {folder}.',
  undone: 'Annullato.',
  added: 'Nuovi',
  changed: 'Modificati',
  removed: 'Rimossi',
  unpublishedList: 'Fuori dal sito',
  noChanges: 'Nessun file cambiato rispetto alla versione precedente.',
  more: { one: '…e altri {count}', other: '…e altri {count}' }
}

export default messages
