import type { Translation } from '../types'

const messages: Translation['publish'] = {
  // Deploy
  emptyTitle: 'Niente da pubblicare',
  titleWorker: 'Pubblica sul Worker «{name}»',
  titleAnyWorker: 'Pubblica su un Worker Cloudflare',
  titlePages: 'Pubblica sul progetto Pages «{name}»',
  titleAnyPages: 'Pubblica su Cloudflare Pages',
  titleCloudflare: 'Pubblica su Cloudflare',
  checking: 'Controllo dei file…',
  files: { one: '{count} file', other: '{count} file' },
  changed: {
    one: '{count} modificato dall’ultimo deploy',
    other: '{count} modificati dall’ultimo deploy'
  },
  changedSince: {
    one: '{count} modificato dall’ultimo deploy ({date}, {branch})',
    other: '{count} modificati dall’ultimo deploy ({date}, {branch})'
  },
  deployPreview: 'Deploy di anteprima',
  publishProduction: 'Pubblica in produzione',
  hintWorker:
    'Vengono caricati solo i file con contenuto modificato. Ogni pubblicazione resta come versione a cui puoi tornare.',
  hintPages:
    'Vengono caricati solo i file con contenuto modificato. Un deploy di anteprima ha un suo URL e non tocca il sito online.',
  progressLabel: 'Avanzamento del deploy',
  deployedTo: 'Deploy completato su {url}',
  rolledBack: 'Produzione riportata a {id}.',
  openSettings: 'Apri Impostazioni',
  foreignTitle: 'Il sito online è stato pubblicato da un’altra parte',
  foreignBody:
    'La versione online è stata pubblicata il {date}{by} da un altro computer, un altro strumento o dalla dashboard di Cloudflare. Pubblicare sostituisce tutto il sito con questa cartella, quindi le modifiche fatte lì andranno perse. Cloudflare non può restituire i file: copia prima in questa cartella i file più recenti (da chi ha pubblicato o dal tuo repository git).',
  foreignBy: ' da {author}',
  foreignVia: ' ({source})',
  foreignPublish: 'Pubblica comunque',

  // Deployments
  deployments: 'Deploy',
  noDeployments: 'Ancora nessun deploy.',
  colWhen: 'Quando',
  colEnvironment: 'Ambiente',
  colBranch: 'Branch',
  colStatus: 'Stato',
  colActions: 'Azioni',
  envProduction: 'Produzione',
  envPreview: 'Anteprima',
  live: 'Online',
  openDeployment: 'Apri questo deploy nel browser',
  rollBack: 'Ripristina…',
  rollBackConfirm: 'Rimettere online questa versione?',
  rollBackYes: 'Ripristina',

  // Scheduled changes
  scheduledTitle: 'Modifiche programmate',
  scheduledDescription:
    'Modifiche alle pagine e articoli che vanno online a un’ora stabilita. CraftPages li pubblica mentre è in esecuzione, anche in background, e recupera dopo lo stop o un riavvio.',
  nothingScheduled:
    'Niente di programmato. Per programmare modifiche alle pagine, scegli {schedule} accanto a {saveAll}. Per programmare un articolo, dagli una data futura.',
  deployRetry:
    'Un deploy programmato non riesce dal {date}. Viene ritentato ogni minuto. Errore: {error}',
  stateScheduled: 'Programmata',
  stateLive: 'Online',
  stateDone: 'Conclusa',
  stateBlocked: 'In sospeso',
  post: 'Articolo',
  wasLive: 'Online dal {from} al {to}',
  wentLive: 'Andata online il {date}',
  liveSince: 'Online dal {date}',
  goesLive: 'Va online il {date}',
  comesDown: 'ritiro il {date}',
  deploysToProduction: 'con deploy in produzione',
  publishNow: 'Pubblica ora',
  unschedule: 'Annulla programmazione',
  publishAnyway: 'Pubblica comunque…',
  takeDownAnyway: 'Ritira comunque…',
  takeDownNow: 'Ritira ora',
  keepLive: 'Lascia online',
  overwrite: 'Sì, sovrascrivi',
  helpBlocked:
    '«Pubblica comunque» sostituisce quelle pagine con la versione programmata e le altre modifiche su di esse vanno perse. «Annulla programmazione» trasforma le modifiche programmate di nuovo in modifiche non salvate; quelle sulle pagine cambiate nel frattempo vengono scartate.',
  helpLive:
    '«Ritira comunque» riporta quelle pagine esattamente com’erano prima e le modifiche fatte nel frattempo vanno perse.'
}

export default messages
