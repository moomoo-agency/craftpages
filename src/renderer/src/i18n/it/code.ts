import type { Translation } from '../types'

const messages: Translation['code'] = {
  loading: 'Caricamento dell’editor di codice…',
  files: 'File di questa pagina',
  unsaved: 'Modifiche non salvate',
  wrap: 'A capo automatico',
  preview: 'Anteprima dal vivo',
  previewTitle: 'Anteprima del codice di {path}',
  revert: 'Annulla modifiche',
  saveTip:
    'Scrive subito il file, senza passare dalle bozze. Ogni salvataggio si può annullare dalla cronologia.',
  saveCount: { one: 'Scrivi il file ora', other: 'Scrivi {count} file ora' },
  saved: 'Salvato.',
  reload: 'Carica la versione su disco',
  blocked:
    'Questa pagina ha modifiche visive non salvate. Salvale o scartale prima di modificare il codice, così non si sovrascrivono a vicenda.',
  blockedSave: 'Salva tutte le modifiche',
  blockedDiscard: 'Scarta le modifiche di questa pagina',
  leaveUnsaved: {
    one: '{count} file ha modifiche al codice non salvate.',
    other: '{count} file hanno modifiche al codice non salvate.'
  },
  leaveSave: 'Salva e continua',
  leaveDiscard: 'Scarta le modifiche',
  footer:
    '{find} cerca · {format} formatta · L’anteprima mostra l’HTML non salvato; CSS e script cambiano dopo il salvataggio',
  sharedFile: { one: '{count} pagina', other: '{count} pagine' },
  sharedFileTip: {
    one: '{file} è usato da {count} pagina',
    other: '{file} è usato da {count} pagine: una modifica qui le cambia tutte'
  },
  shortcutWrites: '{shortcut} scrive il file'
}

export default messages
