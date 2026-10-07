import type { Translation } from '../types'

const messages: Translation['media'] = {
  title: 'Immagini',
  summary: {
    one: '{count} immagine, {size} in totale.',
    other: '{count} immagini, {size} in totale.'
  },
  scanning: 'Ricerca delle immagini…',
  addSizes: {
    one: 'Aggiungi dimensione mancante ({count})',
    other: 'Aggiungi dimensioni mancanti ({count})'
  },
  addSizesTip:
    'Alcuni tag <img> nelle pagine non hanno larghezza e altezza, quindi la pagina salta durante il caricamento. Questo scrive in quei tag la dimensione reale di ogni immagine.',
  addSizesNoneTip: 'Niente da sistemare: ogni tag <img> nelle pagine ha già larghezza e altezza.',
  optimizeSelected: {
    one: 'Ottimizza {count} selezionata…',
    other: 'Ottimizza {count} selezionate…'
  },
  optimizeShown: 'Ottimizza quelle mostrate…',
  optimizeNone: 'Ottimizza selezionate…',
  optimizeHint: 'Prima spunta le immagini da ottimizzare.',
  selectShown: 'Seleziona tutte quelle mostrate ({count})',
  filterLabel: 'Mostra',
  filterAll: 'Tutte',
  filterUnused: 'Non usate',
  filterLarge: 'Oltre 400 KB',
  filterWide: 'Più larghe di {width} px',
  filterUnsized: 'Senza dimensioni',
  folder: 'Cartella',
  allFolders: 'Tutte le cartelle',
  allFoldersCount: 'Tutte le cartelle ({count})',
  search: 'Cerca per nome file',
  selectedCount: { one: '{count} selezionata', other: '{count} selezionate' },
  clearSelection: 'Deseleziona tutto',
  nothingToGain: 'Niente da guadagnare: queste immagini sono già ben compresse.',
  optimized: {
    one: '{count} immagine ottimizzata, {size} risparmiati. Ogni riferimento ora punta al nuovo file.',
    other:
      '{count} immagini ottimizzate, {size} risparmiati. Ogni riferimento ora punta ai nuovi file.'
  },
  replaced: 'Sostituita con {path}.',
  replacedIn: 'Sostituita con {path} in {files}.',
  deleted: '{path} eliminata.',
  sizesAdded: {
    one: 'Larghezza e altezza aggiunte a {count} immagine.',
    other: 'Larghezza e altezza aggiunte a {count} immagini.'
  },
  sizesPages: 'Pagine aggiornate: {count}.',
  sizesSkipped: 'Saltate {files}: hanno modifiche non salvate.',
  sizesNone: 'Niente da sistemare: ogni tag <img> ha già larghezza e altezza.',
  undone: 'Annullato.',
  planTitle: {
    one: '{count} immagine può essere ottimizzata, risparmiando {size}.',
    other: '{count} immagini possono essere ottimizzate, risparmiando {size}.'
  },
  planNote:
    'I file ottimizzati ricevono nuovi nomi e pagine, fogli di stile e manifest vengono aggiornati di conseguenza. Gli originali restano in {folder}.',
  optimize: 'Ottimizza',
  optimizing: 'Ottimizzazione…',
  noImages: 'Questo progetto non ha ancora immagini.',
  noMatches: 'Nessuna immagine corrisponde ai filtri.',
  select: 'Seleziona {name}',
  unused: 'Non usata',
  large: 'oltre 400 KB',
  details: 'Dettagli immagine',
  closeDetails: 'Chiudi dettagli',
  usedIn: 'Usata in',
  notUsed: 'Non usata da nessuna pagina, foglio di stile o manifest.',
  replace: 'Sostituisci ovunque…',
  optimizeOne: 'Ottimizza…',
  deleteInUse: 'Puoi eliminare solo le immagini non usate.',
  upload: 'Carica immagine…',
  uploadMany: 'Carica immagini…',
  uploadedMany: {
    one: '{count} immagine caricata: {before} → {after}.',
    other: '{count} immagini caricate: {before} → {after}.'
  },
  noSize: 'Senza dimensioni nell’HTML',
  uploaded: '{name} caricata: {before} → {after}.',
  uploadedSmaller: '{name} caricata: {before} → {after} ({percent}% in meno).',
  pickerUsedIn: '{path} · Usata in {files}',
  pickerHint:
    'Scegli un’immagine o caricane una nuova: viene ridimensionata e compressa durante il caricamento.',
  useImage: 'Usa immagine'
}

export default messages
