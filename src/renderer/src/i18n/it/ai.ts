import type { Translation } from '../types'

const messages: Translation['ai'] = {
  // Connect
  openSettings: 'Impostazioni connessione IA',
  conceptTitle: 'Modifica dei template con l’IA',
  concept:
    'Oggi il modo efficace di modificare i template di un sito, o di crearne di nuovi, è con un’IA. Il tuo strumento di IA (collegato nelle Impostazioni app) legge il sito e invia qui le modifiche come proposte: controlla differenze e anteprima, poi accetta o rifiuta ciascuna. Le modifiche accettate si possono annullare.',
  conceptCode:
    'Per una correzione puntuale su una pagina o un template, apri la pagina e passa alla modalità Codice.',
  notConnected:
    'Pronto, ma nessuna IA è collegata. Configurala in Impostazioni app → Connessione IA.',
  connected: 'Collegato: {clients}',
  off: 'La connessione IA è disattivata nelle Impostazioni.',
  autoAccept: 'Accetta le proposte automaticamente fino alla chiusura dell’app',
  autoAcceptHint: 'Ogni modifica si può comunque annullare qui sotto.',

  // Proposals
  proposals: 'Proposte',
  waitingCount: { one: '{count} in attesa', other: '{count} in attesa' },
  empty:
    'Ancora nessuna proposta. Le modifiche suggerite dalla tua IA compaiono qui con un diff e un’anteprima dal vivo.',
  files: { one: '{count} file', other: '{count} file' },
  statusPending: 'In attesa di te',
  statusAccepted: 'Accettata',
  statusRejected: 'Rifiutata',
  statusReverted: 'Annullata',
  statusFailed: 'Non riuscita',
  accept: 'Accetta',
  reject: 'Rifiuta',
  reason: 'Motivo del rifiuto',
  reasonPlaceholder: 'Perché? Viene inviato all’IA (facoltativo)',
  previewAfter: 'Anteprima del risultato:',
  hidePreview: 'Nascondi anteprima',
  previewTitle: 'Anteprima di {path} con le modifiche proposte',

  // Diff
  newFile: 'Nuovo file',
  deletedFile: 'Eliminato',
  linesAdded: { one: '{count} riga aggiunta', other: '{count} righe aggiunte' },
  linesRemoved: { one: '{count} riga rimossa', other: '{count} righe rimosse' },
  changesIn: 'Modifiche in {path}'
}

export default messages
