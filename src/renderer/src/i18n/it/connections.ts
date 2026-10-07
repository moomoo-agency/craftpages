import type { Translation } from '../types'

const messages: Translation['connections'] = {
  title: 'Connessioni di deploy',
  descriptionKeychain:
    'Dove vengono pubblicati i siti: account Cloudflare (tuoi o di clienti) e hosting via FTP o SFTP. Ogni progetto ne sceglie uno. Token e password sono salvati nel portachiavi del sistema, mai nella cartella del progetto.',
  descriptionMemory:
    'Dove vengono pubblicati i siti: account Cloudflare (tuoi o di clienti) e hosting via FTP o SFTP. Ogni progetto ne sceglie uno. Nessun portachiavi trovato: token e password restano solo in memoria e si perdono alla chiusura. Mai nella cartella del progetto.',
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
  syncReady: 'Sincronizzazione tra computer: pronta.',
  syncNeedsPermission:
    'La sincronizzazione tra computer richiede un permesso in più sul token (Workers R2 Storage · Edit).',
  syncR2Off: 'La sincronizzazione tra computer richiede R2, non ancora attivo in questo account.',
  capPublish: 'Pubblicazione',
  capSync: 'Sincronizzazione tra computer',
  capUpdateToken: 'Aggiorna il token per la sincronizzazione…',
  capTurnOnR2: 'Attiva R2 per la sincronizzazione…',
  createToken: 'Crea un token con i permessi giusti',
  upgradeTitle: 'Questo token può pubblicare, ma non sincronizzare',
  upgradeBody:
    'La pubblicazione continua a funzionare. La sincronizzazione tra computer tiene i dati nello storage R2 del tuo account Cloudflare, quindi il token deve avere anche <b>Account · Workers R2 Storage · Edit</b>.',
  upgradeStep1:
    'Crea un nuovo token con tutto ciò che usa CraftPages (oppure aggiungi quel permesso a questo in Cloudflare):',
  upgradeCreate: 'Crea il token in Cloudflare',
  upgradeStep2:
    'In quella pagina puoi limitarlo a questo account in Account Resources. Poi copia il token mostrato da Cloudflare e incollalo qui. Sostituisce il vecchio, nel portachiavi.',
  upgradePaste: 'Incolla il nuovo token',
  upgradeSave: 'Salva e verifica',
  upgradeDisabledTitle: 'Lo storage R2 non è attivo in questo account',
  upgradeDisabledBody:
    'La pubblicazione continua a funzionare. La sincronizzazione tra computer tiene i dati in Cloudflare R2, che ogni account attiva una volta (basta il piano gratuito; Cloudflare può chiedere un metodo di pagamento).',
  upgradeOpenR2: 'Apri R2 in Cloudflare',
  upgradeCheckAgain: 'Verifica di nuovo',
  upgradeStillMissing:
    'Il token non raggiunge ancora R2. Verifica che abbia Workers R2 Storage · Edit per questo account.',
  upgradeStillDisabled:
    'R2 risulta ancora spento per questo account. Può volerci un minuto dopo l’attivazione.',
  upgradeCantPublish:
    'Questo token non può pubblicare (nessun accesso ai Workers). Usa un token con Workers Scripts · Edit e Workers R2 Storage · Edit.',
  upgradeDone: '“{name}” ora può pubblicare e sincronizzare.',
  serverWorks: 'Connesso. L’accesso parte da {home}. Cartelle: {folders}.',
  serverNoFolders: 'nessuna',
  serverWorksNamed: '“{name}” funziona. L’accesso parte da {home}.',
  savedServer:
    '“{name}” salvata e accesso riuscito (parte da {home}). Scegli la cartella del sito in Impostazioni progetto → Deploy.',
  savedServerFailed: '“{name}” salvata, ma l’accesso non è riuscito: {error}',
  addCloudflare: 'Aggiungi Cloudflare…',
  addServer: 'Aggiungi server FTP / SFTP…',
  keyFile: 'File chiave {file}',
  passwordSaved: 'Password salvata',
  noPassword: 'Nessuna password',
  checking: 'Connessione…',
  // Form
  newConnection: 'Nuova connessione',
  editConnection: 'Modifica «{name}»',
  type: 'Tipo',
  name: 'Nome',
  namePlaceholder: 'Il mio Cloudflare',
  accountId: 'Account ID',
  accountIdHint: 'In Cloudflare: Workers & Pages, nella barra laterale destra.',
  accountIdPlaceholder: 'ID di 32 caratteri',
  token: 'API token',
  tokenHintWorkers:
    'Per pubblicare serve <b>Account · Workers Scripts · Edit</b>; per sincronizzare tra computer anche <b>Account · Workers R2 Storage · Edit</b>.',
  tokenHint:
    'Serve <b>Account · Workers Scripts · Edit</b> per pubblicare come Worker, o <b>Account · Cloudflare Pages · Edit</b> per Pages. Crealo in Cloudflare → My Profile → API Tokens.',
  tokenKeep: 'Lascia vuoto per tenere il token salvato',
  tokenPaste: 'Incolla il token',
  showToken: 'Mostra il token',
  type_cloudflare: 'Cloudflare (Workers)',
  type_sftp: 'SFTP (consigliato)',
  type_ftp: 'FTP / FTPS',
  namePlaceholderServer: 'Il mio hosting',
  host: 'Server',
  hostHint: 'Dal pannello del tuo hosting, es. ftp.example.com.',
  port: 'Porta',
  username: 'Nome utente',
  secure: 'Cifra (FTPS). Spegni solo se il server non lo supporta.',
  plainFtpWarning:
    'L’FTP semplice invia password e file leggibili da chiunque sulla rete. Usa FTPS o SFTP se il tuo hosting li offre.',
  signIn: 'Accedi con',
  signInPassword: 'Password',
  signInKey: 'File chiave',
  keyPath: 'File della chiave privata',
  keyPathHint:
    'Di solito in ~/.ssh, es. id_ed25519. Il file resta dov’è; viene salvata solo la posizione.',
  password: 'Password',
  passwordHint: 'Salvata nel portachiavi del sistema, mai nella cartella del progetto.',
  passphrase: 'Passphrase della chiave',
  passphraseHint: 'Lascia vuoto se la chiave non ne ha.',
  passwordKeep: 'Lascia vuoto per tenere la password salvata',
  testConnection: 'Prova connessione',
  hostKey:
    'Chiave del server {key}: d’ora in poi è fidata. Se cambia, CraftPages si ferma e chiede.',
  addConnection: 'Aggiungi connessione'
}

export default messages
