import type { Translation } from '../types'

const messages: Translation['blog'] = {
  looking: 'Ricerca delle pagine del blog…',

  chooseTitle: 'Configura il blog · Passo 1: scegli i layout',
  chooseDescription:
    'Gli articoli riprendono l’aspetto di una delle tue pagine, l’elenco degli articoli quello di un’altra. Poi indicherai dove vanno il testo e le schede.',
  statusBoth:
    'Questo sito ha già pagine che sembrano un blog. Controlla i suggerimenti e continua.',
  statusPostOnly:
    'C’è una pagina che sembra un articolo, ma nessuna che elenca articoli. Per l’elenco, scegli una pagina qualsiasi di cui riprendere l’aspetto.',
  statusListOnly:
    'C’è una pagina che elenca articoli, ma nessuna pagina di articolo. Per gli articoli, scegli una pagina qualsiasi di cui riprendere l’aspetto.',
  statusNone:
    'Questo sito non ha ancora pagine di blog, e va bene così. Scegli le pagine di cui vuoi riprendere l’aspetto (per gli articoli va bene una pagina di testo come la Privacy). Articoli ed elenco vengono creati come nuove pagine in /blog/; le pagine che scegli restano invariate.',
  postLayout: 'Layout degli articoli',
  postLayoutHint:
    'Una pagina con un’area di testo: un titolo, magari una data, e il corpo del testo. Intestazione, piè di pagina e barre laterali fanno da cornice a ogni articolo.',
  listLayout: 'Layout dell’elenco articoli',
  listLayoutHint:
    'Una pagina con un’area per le schede degli articoli (la pagina /blog/). L’ideale è una pagina che elenca già articoli; va bene qualsiasi pagina con una sezione di contenuto.',
  latestLayout: 'Ultimi articoli',
  noCandidates: 'Nessuna pagina del sito somiglia ancora a questa.',
  whySuggested: 'Suggerita per: {reasons}.',
  openCandidate: 'Apri {page}',
  otherPage: 'Oppure usa un’altra pagina',
  existingPage: 'Usa una pagina esistente come layout',
  choosePage: 'Scegli una pagina…',

  reasonArticleData: 'dati strutturati Article',
  reasonOgArticle: 'og:type “article”',
  reasonArticle: '<article> con testo',
  reasonDate: 'data di pubblicazione',
  reasonUnder: 'si trova in {dir}',
  reasonLongText: 'testo lungo',
  reasonAddress: 'indirizzo {path}',
  reasonCardsPosts: {
    one: '{count} scheda con link ad articoli',
    other: '{count} schede con link ad articoli'
  },
  reasonCardsDated: {
    one: '{count} scheda con link a pagine datate',
    other: '{count} schede con link a pagine datate'
  },
  reasonCardsPages: {
    one: '{count} scheda ripetuta con link a pagine',
    other: '{count} schede ripetute con link a pagine'
  },
  reasonPagination: 'paginazione',

  aiTitle: 'Preferisci pagine di blog dedicate? Falle creare alla tua IA',
  aiDescription:
    'La tua IA connessa le crea con il design del sito. Rivedi la proposta (modifiche e anteprima) prima che venga scritto qualcosa, poi torna qui e sceglile.',
  aiConnected: 'Connessa: {clients}',
  aiNotConnected: 'Nessuna IA ancora connessa. Configurala in {view}.',
  copyPrompt: 'Copia il prompt',

  backToBlog: 'Torna al blog',
  samplePost: 'Articolo di esempio',
  postList: 'Elenco articoli',
  sampleNote: 'Contenuto di esempio, non scritto nel sito.',
  adjustPostLayout: 'Modifica il layout degli articoli…',
  adjustListLayout: 'Modifica il layout dell’elenco…',
  previewFrame: 'Anteprima del blog',

  postDeleted: 'Articolo eliminato.',
  latestUpdated: 'Ultimi articoli aggiornati in {pages}.',
  savedNotice: 'Salvato.',
  republished:
    'Salvato e ripubblicato. File scritti: {written}. Rimossi: {removed}. Reindirizzamenti in _redirects: {redirects}.',

  setupTitle: 'Configurazione',
  setupTitleTodo: 'Configura il blog',
  setupDone: 'Fatto. Puoi modificare ogni parte in qualsiasi momento.',
  setupTodo: 'Indica dove vanno gli articoli e le schede, poi controlla l’anteprima.',
  stepChoose: 'Scegli i layout',
  stepChooseSummary: 'Gli articoli sono come {post}; l’elenco è come {list}.',
  changeLayouts: 'Cambia i layout',
  stepPost: 'Indica le parti dell’articolo',
  stepPostTodo:
    'Dove va il testo dell’articolo, più titolo, data e immagine di copertina se il layout li prevede.',
  stepList: 'Indica le parti dell’elenco',
  stepListTodo:
    'Dove vanno le schede, una scheda esistente con i suoi campi (se la pagina ne ha una) e la paginazione.',
  startPointing: 'Inizia a indicare…',
  adjust: 'Modifica…',
  stepPreview: 'Anteprima con articoli di esempio',
  stepPreviewHint:
    'Guarda un articolo e la pagina dell’elenco creati dai tuoi layout. Nel sito non viene scritto nulla.',
  stepLatest: 'Ultimi articoli su altre pagine (facoltativo)',
  stepLatestHint:
    'Per esempio, i tre articoli più recenti nella home page. Quando pubblichi, cambia solo l’area che indichi.',
  stepDone: 'fatto',
  sumAreas: { one: '{count} area articolo', other: '{count} aree articolo' },
  sumTitle: 'titolo',
  sumDate: 'data',
  sumCover: 'immagine di copertina',
  sumTags: 'tag',
  sumListArea: 'area elenco',
  sumCard: { one: 'la tua scheda ({count} campo)', other: 'la tua scheda ({count} campi)' },
  sumSimpleCard: 'scheda semplice',
  sumPagination: 'la tua paginazione',
  sumSimplePagination: 'paginazione semplice',
  sumHeading: 'titolo dell’elenco',

  latestCount: 'Articoli mostrati',
  latestCountOn: 'Articoli mostrati in {page}',
  adjustLatest: 'Modifica gli ultimi articoli in {page}',
  removeLatest: 'Rimuovi gli ultimi articoli da {page}',
  removeLatestHint: 'L’area mantiene le schede attuali, che però non si aggiornano più.',
  latestPage: 'Pagina per gli ultimi articoli',
  pointArea: 'Indica l’area…',
  finishLayoutsFirst: 'Completa prima i layout degli articoli e dell’elenco.',

  posts: 'Articoli',
  newPost: 'Nuovo articolo',
  noPosts: 'Ancora nessun articolo',
  noPostsReady: 'Scegli Nuovo articolo per scrivere il primo.',
  noPostsSetup: 'Completa la configurazione per iniziare a scrivere.',
  colTitle: 'Titolo',
  colUrl: 'URL',
  colTags: 'Tag',
  colStatus: 'Stato',
  colDate: 'Data',
  untitled: 'Senza titolo',

  urlTitle: 'URL degli articoli',
  urlDescription:
    'Dove si trovano gli articoli e il loro elenco. Lo slug di ogni articolo si imposta nell’editor.',
  saveRepublish: 'Salva e ripubblica',
  presets: 'Schemi di URL',
  presetWordPress: '{path} (come WordPress)',
  permalink: 'Schema URL degli articoli',
  permalinkHint: 'Deve contenere %postname%.',
  listAddress: 'Indirizzo dell’elenco',
  listAddressHint: 'Gli articoli si trovano in {prefix}.',
  perPage: 'Articoli per pagina dell’elenco',
  urlExample: 'Articolo di esempio: {post} · Elenco: {list} · Pagina 2: {page2}',
  blogTitle: 'Titolo del blog',
  blogTitleHint:
    'Titolo e intestazione della pagina dell’elenco. Le pagine dei tag mostrano “Blog: tag”.',
  scheduleDeploy: 'Pubblica in produzione quando un articolo programmato va online',
  scheduleDeployHint:
    'Usa le impostazioni Cloudflare di questo progetto. CraftPages deve essere aperto in quel momento; altrimenti la pubblicazione avviene al prossimo avvio.',
  urlsMove:
    'Gli articoli pubblicati passano ai nuovi URL. I vecchi URL ricevono reindirizzamenti 301 in _redirects, così link e risultati di ricerca continuano a funzionare.',

  opening: 'Apertura di {page}…',
  layoutFrame: 'Layout di {page}',
  pointSteps: 'Parti da indicare',
  markNumbered: '{label} {n}',
  noImage: 'Questa parte non contiene immagini. Fai clic su un’immagine.',
  wider: 'Più ampio',
  widerHint: 'Seleziona l’elemento che contiene questo',
  removePick: 'Rimuovi {part}',
  addAnother: 'Fai clic su un’altra parte della pagina per aggiungere l’area {n}.',
  keepOnly: 'Mantieni solo le parti indicate del contenuto principale',
  keepOnlyHint:
    'Le sezioni di {page} senza parti indicate vengono omesse; intestazione, piè di pagina e navigazione restano.',
  skip: 'Salta',
  saveLayout: 'Salva il layout',
  saveHintOptional: 'I passi facoltativi che salti restano vuoti.',
  saveHintRequired: 'Indica prima le parti obbligatorie.',

  regions: 'Area articolo',
  regionsPrompt: 'Fai clic sull’area dove va il testo dell’articolo.',
  regionsHelp:
    'Scegli il riquadro che contiene il testo principale della pagina; tutto ciò che contiene viene sostituito dall’articolo. Se è evidenziato solo un paragrafo, usa “Più ampio”. Se un banner divide l’articolo, aggiungi una seconda area dopo il banner.',
  title: 'Titolo',
  titlePrompt: 'Fai clic sul titolo che deve mostrare il titolo dell’articolo.',
  titleHelp:
    'Di solito il grande H1 della pagina. Se lo salti, il titolo va in cima all’area articolo.',
  titleSkip: 'Salta: il titolo va nell’area articolo',
  date: 'Data',
  datePrompt: 'Fai clic dove deve comparire la data di pubblicazione.',
  dateHelp:
    'Un testo piccolo vicino al titolo, come “Ultimo aggiornamento…”. Il suo testo diventa la data dell’articolo.',
  dateSkip: 'Salta: nessuna data nella pagina',
  image: 'Immagine di copertina',
  imagePrompt: 'Fai clic sull’immagine che deve mostrare la copertina dell’articolo.',
  imageHelp: 'Saltala se il layout non ha un’immagine principale.',
  imageSkip: 'Salta: nessuna immagine di copertina',
  tags: 'Tag',
  tagsPrompt: 'Fai clic dove devono comparire i tag dell’articolo.',
  tagsHelp:
    'Va bene una riga piccola vicino al titolo o sotto l’articolo. Mostra i tag come link alle loro pagine e resta vuota per gli articoli senza tag.',
  tagsSkip: 'Salta: non mostrare i tag',
  remove: 'Escludi',
  removePrompt: 'Fai clic su qualsiasi altra cosa che non deve comparire nelle pagine generate.',
  removeHelp:
    'Per esempio un’etichetta o un banner. Le sezioni intere vengono rimosse; le parti più piccole vengono svuotate, così il layout intorno mantiene la sua forma. Con “Mantieni solo le parti indicate” attivo, le sezioni senza parti indicate sono già escluse.',
  removeSkip: 'Nient’altro',

  container: 'Area elenco',
  containerPrompt: 'Fai clic sull’area dove va l’elenco degli articoli.',
  containerHelp:
    'Tutto ciò che contiene viene sostituito dalle schede degli articoli in ogni pagina dell’elenco. Il riquadro del contenuto di una sezione funziona bene.',
  card: 'Scheda',
  cardPrompt: 'Fai clic su una scheda nell’area elenco, se la pagina ne ha già una.',
  cardHelp:
    'Il suo design viene copiato per ogni articolo. Nessuna scheda nella pagina? Salta: verrà usata una scheda semplice con i caratteri del sito.',
  cardSkip: 'Salta: usa una scheda semplice',
  cardTitle: 'Scheda · titolo',
  cardTitlePrompt: 'Nella scheda, fai clic sul titolo.',
  cardTitleHelp: 'Sostituito dal titolo dell’articolo.',
  cardDate: 'Scheda · data',
  cardDatePrompt: 'Nella scheda, fai clic sulla data (se c’è).',
  cardDateHelp: 'Sostituita dalla data dell’articolo.',
  cardExcerpt: 'Scheda · estratto',
  cardExcerptPrompt: 'Nella scheda, fai clic sul testo breve.',
  cardExcerptHelp: 'Sostituito dall’estratto dell’articolo.',
  cardImage: 'Scheda · immagine',
  cardImagePrompt: 'Nella scheda, fai clic sull’immagine.',
  cardImageHelp: 'Sostituita dall’immagine di copertina dell’articolo.',
  cardLink: 'Scheda · link',
  cardLinkPrompt: 'Nella scheda, fai clic sul link o sul pulsante che apre l’articolo.',
  cardLinkHelp: 'Ogni link della scheda che porta alla stessa destinazione punterà all’articolo.',
  pagination: 'Paginazione',
  paginationPrompt: 'Fai clic sulla paginazione (Precedente / Successiva), se la pagina ne ha una.',
  paginationHelp:
    'Se la salti, sotto le schede vengono aggiunti semplici link “Articoli più recenti / meno recenti” quando c’è più di una pagina.',
  paginationSkip: 'Salta: aggiungi link semplici',
  heading: 'Titolo dell’elenco',
  headingPrompt: 'Fai clic sul titolo che deve dare il nome all’elenco.',
  headingHelp:
    'Mostra il titolo del blog (impostato in URL degli articoli) o “Blog: tag” nelle pagine dei tag. Saltalo se l’area elenco non ha un titolo proprio.',
  headingSkip: 'Salta: nessun titolo',
  latestArea: 'Area',
  latestAreaPrompt: 'Fai clic sull’area dove devono comparire gli ultimi articoli.',
  latestAreaHelp:
    'Quando pubblichi cambia solo quest’area; il resto della pagina resta esattamente com’è. Se la pagina mostra già alcune schede, fai clic sulla loro griglia e poi su una scheda.'
}

export default messages
