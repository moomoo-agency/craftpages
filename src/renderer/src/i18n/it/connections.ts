import type { Translation } from '../types'

const messages: Translation['connections'] = {
  title: 'Connessioni di deploy',
  descriptionKeychain:
    'Gli account su cui i tuoi siti fanno il deploy, ad es. il tuo account Cloudflare e quello di un cliente. Ogni progetto ne sceglie uno. I token sono salvati nel portachiavi del sistema, mai nella cartella di un progetto.',
  descriptionMemory:
    'Gli account su cui i tuoi siti fanno il deploy, ad es. il tuo account Cloudflare e quello di un cliente. Ogni progetto ne sceglie uno. Non è stato trovato un portachiavi di sistema, quindi i token restano solo in memoria e si perdono alla chiusura. Non vengono mai salvati nella cartella di un progetto.',
  add: 'Aggiungi connessione…',
  empty: 'Ancora nessuna connessione. Aggiungine una per pubblicare i tuoi progetti.',
  tokenSaved: 'Token salvato',
  noToken: 'Nessun token',
  usedBy: 'Usata da {projects}',
  notUsed: 'Non usata dai progetti recenti',
  test: 'Verifica',
  testLabel: 'Verifica «{name}»',
  editLabel: 'Modifica «{name}»',
  removeLabel: 'Rimuovi «{name}»',
  remove: 'Rimuovi…',
  confirmRemove: 'Rimuovere «{name}» e il suo token?',
  confirmRemoveUsed:
    'Rimuovere «{name}» e il suo token? A {projects} servirà un’altra connessione.',
  removeYes: 'Rimuovi',

  // Results
  workers: { one: '{count} Worker', other: '{count} Worker' },
  pagesProjects: { one: '{count} progetto Pages', other: '{count} progetti Pages' },
  seesBoth: 'Il token vede {workers} e {pages}.',
  seesWorkersOnly: 'Il token funziona: vede {workers}.',
  seesWorkers:
    'Il token vede {workers}. Non ha accesso a Pages, il che va bene se non pubblichi lì.',
  seesPages:
    'Il token vede {pages}. Non può pubblicare Worker: aggiungigli Account · Workers Scripts · Edit.',
  seesNothing: 'Il token non può pubblicare Worker: aggiungigli Account · Workers Scripts · Edit.',
  saved: '«{name}» salvata. {details}',
  savedBadTokenWorkers:
    '«{name}» salvata, ma il token non ha funzionato. Serve Account · Workers Scripts · Edit.',
  savedBadToken:
    '«{name}» salvata, ma il token non ha funzionato. Serve Account · Workers Scripts · Edit (per pubblicare come Worker) o Account · Cloudflare Pages · Edit.',
  works: '«{name}» funziona. {details}',
  removed: '«{name}» e il suo token sono stati rimossi.',

  // Form
  newConnection: 'Nuova connessione',
  editConnection: 'Modifica «{name}»',
  type: 'Tipo',
  typeHint: 'Netlify, GitHub Pages e SFTP sono in programma.',
  name: 'Nome',
  namePlaceholder: 'Il mio Cloudflare',
  accountId: 'Account ID',
  accountIdHint: 'In Cloudflare: Workers & Pages, nella barra laterale destra.',
  accountIdPlaceholder: 'ID di 32 caratteri',
  token: 'API token',
  tokenHintWorkers:
    'Serve <b>Account · Workers Scripts · Edit</b>. Crealo in Cloudflare → My Profile → API Tokens.',
  tokenHint:
    'Serve <b>Account · Workers Scripts · Edit</b> per pubblicare come Worker, o <b>Account · Cloudflare Pages · Edit</b> per Pages. Crealo in Cloudflare → My Profile → API Tokens.',
  tokenKeep: 'Lascia vuoto per tenere il token salvato',
  tokenPaste: 'Incolla il token',
  showToken: 'Mostra il token',
  addConnection: 'Aggiungi connessione'
}

export default messages
