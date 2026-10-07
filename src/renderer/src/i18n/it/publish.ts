import type { Translation } from '../types'

const messages: Translation['publish'] = {
  // Deploy
  emptyTitle: 'Niente da pubblicare',
  titleWorker: 'Pubblica su {name} in Cloudflare',
  titleAnyWorker: 'Pubblica su Cloudflare',
  titlePages: 'Pubblica sul progetto Pages «{name}»',
  titleAnyPages: 'Pubblica su Cloudflare Pages',
  titleCloudflare: 'Pubblica su Cloudflare',
  titleServer: 'Pubblica nella cartella del server {dir}',
  checking: 'Controllo dei file…',
  deployPreview: 'Deploy di anteprima',
  publishProduction: 'Pubblica sul sito online',
  hintWorker:
    'Vengono caricati solo i file con contenuto modificato. Ogni pubblicazione resta come versione a cui puoi tornare.',
  hintPages:
    'Vengono caricati solo i file con contenuto modificato. Un deploy di anteprima ha un suo URL e non tocca il sito online.',
  hintServer:
    'Vengono caricati solo i file cambiati dall’ultima pubblicazione, poi rimossi quelli che hai eliminato. I file sul server che CraftPages non ha caricato restano dove sono.',
  progressLabel: 'Avanzamento del deploy',
  deployedTo: 'Deploy completato su {url}',
  rolledBack: 'Produzione riportata a {id}.',
  openSettings: 'Apri Impostazioni',
  foreignTitle: 'Il sito online è stato pubblicato da un’altra parte',
  foreignBody:
    'La versione online è stata pubblicata il {date}{by} da un altro computer, un altro strumento o dalla dashboard di Cloudflare. Pubblicare sostituisce tutto il sito con questa cartella, quindi le modifiche fatte lì andranno perse. Cloudflare non può restituire i file: copia prima in questa cartella i file più recenti (da chi ha pubblicato o dal tuo repository git).',
  foreignBy: ' da {author}',
  foreignVia: ' ({source})',
  foreignBodyServer:
    'La versione sul server è stata pubblicata il {date}{by}. Pubblicando carichi questa cartella sopra, quindi le modifiche fatte là andranno perse. Prima porta qui i file più recenti.',
  occupiedTitle: 'La cartella sul server contiene già dei file',
  occupiedBody:
    '{dir} contiene file non pubblicati con CraftPages, forse un sito precedente. Pubblicando carichi lì il tuo sito: i file con lo stesso nome vengono sostituiti, gli altri restano. Controlla la cartella in Impostazioni progetto → Deploy se non sei sicuro.',
  foreignPublish: 'Pubblica comunque',

  // Deployments
  deployments: 'Su Cloudflare',
  deploymentsDescription:
    'Le versioni che Cloudflare conserva. Il ripristino qui cambia il sito online senza toccare la tua cartella.',
  noDeployments: 'Ancora nessun deploy.',
  colWhen: 'Quando',
  colEnvironment: 'Dove',
  colBranch: 'Etichetta',
  colComputer: 'Pubblicato da',
  colStatus: 'Stato',
  colActions: 'Azioni',
  envProduction: 'Sito online',
  envPreview: 'Link di anteprima',
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
    '«Ritira comunque» riporta quelle pagine esattamente com’erano prima e le modifiche fatte nel frattempo vanno perse.',
  unsavedTitle: {
    one: 'Modifiche non salvate su {count} pagina',
    other: 'Modifiche non salvate su {count} pagine'
  },
  unsavedBody:
    'Non sono ancora nella cartella del sito, quindi pubblicando ora resterebbero fuori. Scegli Salva tutto e pubblica per includerle.',
  saveAndPublish: 'Salva tutto e pubblica',
  publishSavedOnly: 'Pubblica senza di esse',
  liveTitle: 'Il tuo sito è online',
  liveBody:
    'I visitatori ora vedono la versione appena pubblicata. Per tornare indietro, scegli una versione precedente nella Cronologia pubblicazioni qui sotto.',
  viewSite: 'Apri il sito',
  pagesChange: {
    one: '{count} pagina cambia con la prossima pubblicazione',
    other: '{count} pagine cambiano con la prossima pubblicazione'
  },
  filesOnly: {
    one: 'Cambia {count} file (nessuna pagina)',
    other: 'Cambiano {count} file (nessuna pagina)'
  },
  upToDate: 'Il sito online è aggiornato',
  plusFiles: { one: 'più {count} file', other: 'più {count} file' },
  lastPublished: 'ultima pubblicazione {date}',
  pagesChangeLabel: 'Pagine che cambiano',
  pageRemoved: '{page} (rimossa)',
  morePages: 'e altre {count}',
  noWebAddress:
    'L’indirizzo web del sito non è ancora impostato, quindi sitemap e anteprime social non possono usare link completi. Aggiungilo in {settings}.',
  openProjectSettings: 'Impostazioni progetto'
}

export default messages
