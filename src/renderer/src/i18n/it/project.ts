import type { Translation } from '../types'

const messages: Translation['project'] = {
  title: 'Impostazioni progetto',

  // Site
  site: 'Sito',
  siteDescription: 'Salvate insieme al sito in {path}.',
  siteName: 'Nome del sito',
  baseUrl: 'URL di base',
  baseUrlHint: 'Usato per i link canonici, la sitemap e l’RSS.',
  language: 'Lingua',
  languageHint: 'Codice lingua, ad es. en, en-US, it, uk.',
  images: 'Immagini',
  maxWidth: 'Larghezza massima (px)',
  quality: 'Qualità JPEG / WebP',
  qualityHint: 'Da 30 a 100.',
  folder: 'Cartella',
  folderHint: 'Relativa alla radice del sito.',
  pngToJpeg: 'Converti in JPEG le foto PNG senza trasparenza',
  blog: 'Blog',
  blogNote:
    'Gli URL dei post, l’indirizzo dell’elenco dei post e i post per pagina si impostano in Blog → URL dei post.',
  savedSite: 'Salvato in .sitecms/site.json.',

  // Deploy
  deploy: 'Deploy',
  deployDescription:
    'Dove viene pubblicato questo progetto. Scegli una delle tue connessioni di deploy (la tua, quella di un cliente…). Aggiungi le connessioni in {settings}.',
  listWorkers: 'Elenca i Worker',
  listPages: 'Elenca i progetti Pages',
  savedDeploy: 'Impostazioni di deploy salvate per questo progetto.',
  connection: 'Connessione',
  noConnections: 'Ancora nessuna connessione: aggiungine una in {settings}.',
  noToken: 'Questa connessione non ha ancora un API token.',
  choose: '— Scegli —',
  unknownConnection: 'Connessione sconosciuta (configurata su un altro computer?)',
  servers: 'Server (FTP / SFTP)',
  noPassword: 'Questa connessione non ha ancora una password.',
  remoteDir: 'Cartella sul server',
  remoteDirHint:
    'Dove vanno i file del sito, di solito public_html, www o htdocs. Vuoto = la cartella in cui parte l’accesso. CraftPages elimina solo file che ha caricato lui.',
  browse: 'Sfoglia…',
  browseLabel: 'Cartelle sul server',
  browsePath: 'Cartella attuale',
  browseSuggested: 'Gli hosting di solito servono i siti da una cartella con questo nome',
  browseEmpty: 'Nessuna cartella qui.',
  browseUse: 'Usa {dir}',
  publishAs: 'Pubblica come',
  targetWorkers: 'Worker (consigliato)',
  targetPages: 'Progetto Pages',
  workersHint:
    'Ciò che Cloudflare crea di default per i nuovi progetti: un Worker serve i file del sito. I file statici sono serviti gratis.',
  pagesHint:
    'Per progetti che sono già su Cloudflare Pages. Aggiunge i deploy di anteprima con un loro URL.',
  worker: 'Worker',
  workerHint: 'Scegline uno o scrivi un nuovo nome.',
  workerExplain:
    'Il nuovo Worker viene creato alla prima pubblicazione, su nome.tuo-sottodominio.workers.dev. Per usare un tuo dominio, aggiungilo al Worker in Cloudflare.',
  workersHidden: 'Non elencati perché pubblicare sostituirebbe il loro codice: {names}.',
  workerPlaceholder: 'mio-sito',
  pagesProject: 'Progetto Pages',
  pagesProjectPlaceholder: 'Elenca i progetti Pages per sceglierne uno',
  productionBranch: 'Branch di produzione',
  previewBranch: 'Branch di anteprima',
  previewBranchHint: 'I deploy di anteprima hanno un loro URL.',
  neverUpload: 'Non caricare mai',
  neverUploadHint:
    'Un pattern per riga. * vale dentro una cartella, ** attraverso le cartelle. .sitecms e i file che iniziano con un punto sono sempre esclusi (tranne .htaccess quando pubblichi su un server).',
  newProjectName: 'Nome del nuovo progetto Pages',
  newProjectPlaceholder: 'nome-nuovo-progetto',
  createProject: 'Crea progetto Pages',
  created: 'Creato {name} ({subdomain}).',

  // Results of listing projects and Workers
  pagesFound: {
    one: '{count} progetto Pages in questo account.',
    other: '{count} progetti Pages in questo account.'
  },
  noPagesButWorkers: {
    one: 'Nessun progetto Pages in questo account. Contiene {count} Worker ({names}), che è un altro tipo di progetto. Crea un progetto Pages qui sotto o pubblica come Worker.',
    other:
      'Nessun progetto Pages in questo account. Contiene {count} Worker ({names}), che sono un altro tipo di progetto. Crea un progetto Pages qui sotto o pubblica come Worker.'
  },
  noPages:
    'Nessun progetto Pages in questo account. I progetti creati come Worker (il default della dashboard Cloudflare) non compaiono qui. Crea un progetto Pages qui sotto o pubblica come Worker.',
  workersNoAccess:
    'Il token non può leggere i Worker. In Cloudflare → My Profile → API Tokens, dagli il permesso Account · Workers Scripts · Edit.',
  workersFound: {
    one: '{count} Worker in questo account; CraftPages può pubblicare su {usable}. Scegline uno o scrivi un nuovo nome.',
    other:
      '{count} Worker in questo account; CraftPages può pubblicare su {usable}. Scegline uno o scrivi un nuovo nome.'
  },
  noWorkers:
    'Ancora nessun Worker. Scrivi un nome: il Worker viene creato alla prima pubblicazione.',
  editing: 'Modifica',
  codeEditor: 'Mostra l’editor di codice',
  codeEditorHint:
    'Aggiunge Codice accanto a Modifica e Anteprima, per cambiare HTML, CSS e JavaScript della pagina. Lascialo disattivato per chi modifica solo i contenuti.',
  unsavedChanges: 'Modifiche non salvate',
  // Velocità
  speed: 'Velocità',
  speedDescription:
    'Cosa fa la pubblicazione alla copia che carica, perché le pagine si mostrino prima. I file nella tua cartella restano esattamente come sono.',
  speedSaved: 'Impostazioni di velocità salvate. Valgono dalla prossima pubblicazione.',
  minify: 'Minimizza CSS e JavaScript',
  minifyHint:
    'Toglie spazi e commenti da fogli di stile e script. Un file che non si riesce a minimizzare viene caricato così com’è.',
  longCache: 'Fai conservare ai browser stili, font e immagini per un anno',
  longCacheHint:
    'Vengono pubblicati a indirizzi che cambiano ogni volta che cambia il file (/_v/…), quindi nessuno vede una copia vecchia. Gli script mantengono il loro indirizzo.',
  longCacheHintServer:
    'Vengono pubblicati a indirizzi che cambiano ogni volta che cambia il file (/_v/…), quindi nessuno vede una copia vecchia. L’anno di cache richiede mod_headers di Apache sul server; senza, le copie funzionano come gli originali.',
  inlineCss: 'Inserisci i fogli di stile nelle pagine',
  inlineCssHint:
    'Così una pagina si mostra senza aspettare i suoi fogli di stile. Meglio per quelli piccoli: ogni pagina diventa più pesante di quanto contiene, e non resta in cache tra una pagina e l’altra. Misurato compresso (gzip), per pagina.',
  inlineCssOff: 'No',
  inlineCssUpTo: 'Fino a {kb} KB per pagina',
  externalFonts: 'Font da altri siti',
  noExternalFonts: 'Questo sito non carica font da Google Fonts o Bunny Fonts.',
  externalFontsExplain:
    'Ogni servizio di font costa alla prima visita due connessioni in più prima che appaia il testo. Ospitarli copia i font in assets/fonts e li collega dal tuo sito. Hanno lo stesso aspetto e si possono ospitare gratis. È un solo passaggio, annullabile. Funziona bene insieme ai fogli di stile nelle pagine.',
  fontsFrom: {
    one: 'da {service}, collegato da {count} pagina',
    other: 'da {service}, collegato da {count} pagine'
  },
  fontsHost: 'Ospita sul sito',
  fontsHosting: 'Download…',
  fontsHosted:
    'Fatto: {files} file di font, dichiarati in {stylesheet}, ora collegati da {pages} pagine e fogli di stile. Va online con la prossima pubblicazione.',
  fontsUndone: 'Annullato: le pagine tornano a collegare il servizio di font.'
}

export default messages
