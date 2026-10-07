import type { Translation } from '../types'

const messages: Translation['sync'] = {
  title: 'Sincronizzazione tra computer (beta)',
  description:
    'Lavora a questo progetto da più computer. Ognuno riceve le modifiche degli altri, le modifiche non salvate e la cronologia delle pubblicazioni, e vede chi ha aperto quale pagina. La sincronizzazione è nuova: tieni un backup della cartella (git, o la cronologia delle pubblicazioni) finché non si assesta.',
  where: 'Tieni i dati di sincronizzazione in',
  modeCloudflare: 'Cloudflare',
  modeServer: 'Server FTP / SFTP',
  modeCloudflareHint:
    'Il tuo account Cloudflare. Modifiche e chi sta lavorando arrivano sugli altri computer in pochi secondi.',
  modeServerHint:
    'Una cartella sul tuo hosting, cifrata con una passphrase. Gli altri computer vedono le modifiche entro circa un minuto.',
  connection: 'Connessione',
  noConnections:
    'Nessuna connessione adatta: aggiungila in Impostazioni app → Connessioni di deploy.',
  tokenCheckFailed:
    'Impossibile verificare cosa può fare questo token. Controlla la connessione, o prova la connessione nelle Impostazioni app.',
  folder: 'Cartella di sincronizzazione sul server',
  folderHint:
    'Meglio fuori dalla cartella del sito (accanto a public_html, non dentro). Più progetti possono condividerla.',
  passphrase: 'Passphrase di sincronizzazione',
  passphraseChooseHint:
    'Cifra tutto nella cartella di sincronizzazione. Serve anche agli altri computer; non si può recuperare, quindi conservala bene.',
  passphraseHint: 'La passphrase scelta quando è stata attivata la sincronizzazione.',
  passphraseRepeat: 'Ripeti la passphrase',
  passphraseMismatch: 'Le due passphrase non coincidono.',
  setupCloudflare:
    'Attivando la sincronizzazione viene creato in questo account un piccolo Worker craftpages-sync e un bucket R2 (entrambi nel piano gratuito). Il token API deve avere Workers Scripts · Edit e Workers R2 Storage · Edit.',
  setupServer:
    'Attivando la sincronizzazione la cartella viene creata se serve. Solo questa app può leggerla: tutto è cifrato.',
  turnOn: 'Attiva la sincronizzazione',
  settingUp: 'Configurazione…',
  enabled: 'Sincronizzazione attiva.',
  syncNow: 'Sincronizza ora',
  turnOff: 'Disattiva la sincronizzazione',
  turnOffConfirm:
    'Smettere di sincronizzare su questo computer? Non viene cancellato nulla, né qui né nei dati di sincronizzazione.',
  turnedOff: 'Sincronizzazione disattivata su questo computer.',
  factWhere: 'Dati di sincronizzazione',
  factLast: 'Ultima sincronizzazione qui',
  factLatest: 'Ultima sincronizzazione',
  factPeople: 'Aperto ora su',
  latest: '{device}, {date}',
  newer: 'Più recente di questa cartella',
  nobody: 'Nessun altro computer',
  personOn: '{device} ({page})',
  presenceNote:
    'Anche {names} ha questo progetto aperto. Le modifiche alla stessa pagina su due computer si uniscono quando sincronizzi; se entrambi hanno cambiato lo stesso file, scegli quale tenere.',
  neverSynced: 'Non ancora sincronizzato',
  lastSync: 'Ultima sincronizzazione {date}',
  resultPulled: {
    one: '{count} modifica arrivata da {device}.',
    other: '{count} modifiche arrivate da {device}.'
  },
  resultPushed: 'Le modifiche di questa cartella sono state inviate.',
  resultConflicts: {
    one: '{count} file è stato cambiato su entrambi i computer: vedi sotto.',
    other: '{count} file sono stati cambiati su entrambi i computer: vedi sotto.'
  },
  resultNothing: 'Già allineato: niente da sincronizzare.',
  conflictsTitle: 'Cambiati su entrambi i computer',
  conflictsHelp:
    'Questa cartella ha tenuto la propria versione di questi file; la copia dell’altro computer è in .sitecms/conflicts. Tieni la tua (non fare nulla e sincronizza) o usa la loro.',
  useTheirs: 'Usa la loro',
  tookTheirs: 'Ora usi {path} dell’altro computer. Sincronizza per condividerlo.',
  pillOk: 'Sincronizzato',
  pillBusy: 'Sincronizzazione…',
  pillBehind: 'Ricevi le modifiche da {device}',
  pillAhead: 'Sincronizza le tue modifiche',
  pillConflicts: {
    one: '{count} conflitto da controllare',
    other: '{count} conflitti da controllare'
  },
  pillError: 'Sincronizzazione non riuscita: riprova',
  alsoOpen: 'Aperto anche su {names}',
  alsoEditing:
    'Aperta anche su {names}. Salva spesso e sincronizza, così le modifiche non si scontrano.',
  openThere: 'Aperta ora su {device}',
  getButton: 'Da un altro computer (beta)…',
  getIntro:
    'Prendi un progetto che un altro computer sincronizza: scegli dove sono i suoi dati, poi scaricalo in una cartella vuota qui.',
  find: 'Trova progetti',
  noProjects: 'Ancora nessun progetto sincronizzato lì.',
  download: 'Scarica…',
  downloading: 'Download…'
}

export default messages
