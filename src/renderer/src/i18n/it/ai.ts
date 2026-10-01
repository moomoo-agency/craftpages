import type { Translation } from '../types'

const messages: Translation['ai'] = {
  // Connect
  connectTitle: 'Collega la tua IA',
  connectDescription:
    'CraftPages non ha un’IA propria. Collega lo strumento di IA che usi già: legge il sito e propone modifiche che rivedi qui.',
  openSettings: 'Apri Impostazioni',
  connected: 'Collegato: {clients}',
  waiting: 'In attesa di una connessione su {url}',
  off: 'La connessione IA è disattivata nelle Impostazioni.',
  command: 'Comando che aggiunge CraftPages a Claude Code',
  copyCommand: 'Copia il comando',
  stepOpen:
    'Apri in CraftPages il sito su cui vuoi lavorare, anche una cartella vuota. Tieni l’app aperta mentre l’IA lavora.',
  stepCommand: 'Copia questo comando, incollalo nel Terminale e premi Invio:',
  stepCommandHint:
    'Basta farlo una volta. Ripetilo solo se cambi la porta o rigeneri il token. Contiene il token, quindi tienilo riservato.',
  stepStart:
    'Avvia Claude Code: nel Terminale scrivi «claude» e premi Invio. Quando si collega, lo stato qui sopra indica «Collegato».',
  stepStartHint:
    'Claude Code era già aperto? Chiudilo e riavvialo, perché si collega solo all’avvio. Scrivi «/mcp» per verificare che craftpages sia collegato.',
  stepAsk:
    'Di’ a Claude cosa vuoi, per esempio «crea un layout di base con intestazione e piè di pagina, più le pagine Home, Chi siamo e Contatti». Puoi anche selezionare un elemento nell’editor di pagina e chiedergli di cambiare lo stile della «sezione selezionata». Le sue modifiche compaiono qui sotto come proposte: controlla l’anteprima, poi fai clic su Accetta o Rifiuta.',
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
