import type { Translation } from '../types'

const messages: Translation['tools'] = {
  // Redirects
  redirectsTitle: 'Reindirizzamenti',
  redirectsWhereCloudflare:
    'Manda un vecchio indirizzo a uno nuovo, così link e risultati di ricerca continuano a funzionare dopo che una pagina si sposta. Salvati in _redirects, che Cloudflare legge.',
  redirectsWhereServer:
    'Manda un vecchio indirizzo a uno nuovo, così link e risultati di ricerca continuano a funzionare dopo che una pagina si sposta. Salvati in _redirects e .htaccess (server Apache; i server che usano solo nginx lo ignorano).',
  redirectsNone: 'Ancora nessun reindirizzamento.',
  redirectsSearch: 'Cerca reindirizzamenti',
  redirectAdd: 'Aggiungi reindirizzamento',
  redirectFrom: 'Vecchio indirizzo',
  redirectTo: 'Nuovo indirizzo',
  redirectKind: 'Tipo',
  redirect301: 'Spostato per sempre (301)',
  redirect302: 'Per ora (302)',
  redirectRemove: 'Rimuovi',
  redirectRemoveLabel: 'Rimuovi il reindirizzamento da {from}',
  redirectsSaved: 'Reindirizzamenti salvati. Funzionano dopo la pubblicazione del sito.',
  redirectsUnsaved: 'Modifiche non salvate.',
  redirectsBlog: {
    one: 'Il blog ha {count} reindirizzamento proprio per gli articoli spostati.',
    other: 'Il blog ha {count} reindirizzamenti propri per gli articoli spostati.'
  },
  redirectsOther: {
    one: '_redirects contiene anche {count} regola scritta a mano; resta com’è.',
    other: '_redirects contiene anche {count} regole scritte a mano; restano come sono.'
  },
  redirectsHowTitle: 'Come scrivere gli indirizzi',
  redirectsHowFolder:
    'Gli indirizzi iniziano con una barra: /vecchia-pagina, /vecchia-cartella/. Per tutto il contenuto di una cartella, termina il vecchio indirizzo con {a} e usa {b} nel nuovo dove va il resto.',
  redirectsHowKinds:
    '“Spostato per sempre” dice ai motori di ricerca di mostrare invece il nuovo indirizzo. Usa “Per ora” solo per una pagina che tornerà.',
  warnPageExists:
    'A questo indirizzo c’è ancora una pagina ({detail}). Rimuovila o spostala, altrimenti il reindirizzamento potrebbe non funzionare.',
  warnTargetMissing: 'Il nuovo indirizzo non è una pagina di questo sito.',
  warnChain:
    'Il nuovo indirizzo reindirizza di nuovo ({detail}). Punta direttamente alla pagina finale.',

  // 404 page
  notFoundTitle: 'Pagina 404',
  notFoundMissing:
    'Quello che i visitatori vedono a un indirizzo che non esiste: un link scritto male, una pagina rimossa. Senza questa pagina, vedono la semplice pagina di errore dell’hosting.',
  notFoundExists:
    'Il tuo sito ha una pagina 404: “{title}”. Modificala come qualsiasi altra pagina.',
  notFoundMake: 'Crea una pagina 404',
  notFoundRemake: 'Ricreala…',
  notFoundEdit: 'Modificala',
  notFoundFrom: 'Basata su',
  notFoundFromHint:
    'La pagina da cui prende header, footer e stili. Il suo contenuto viene sostituito dal messaggio.',
  notFoundTabTitle: 'Titolo (scheda del browser)',
  notFoundHeading: 'Intestazione',
  notFoundMessage: 'Messaggio',
  notFoundLink: 'Link alla home page',
  notFoundSearch: 'Pulsante di ricerca',
  notFoundSearchHint:
    'Aggiunto quando la ricerca nel sito è attiva. Lascia vuoto per non mostrarlo.',
  notFoundCreate: 'Crea la pagina',
  notFoundReplace: 'Sostituisci la pagina',
  notFoundReplaces:
    'Questo sostituisce 404.html, comprese le modifiche fatte. Con Annulla torna com’era.',
  notFoundMade: 'Pagina 404 creata: 404.html. Va online con la prossima pubblicazione.',
  notFoundServer: 'Il tuo server non conosce ancora la pagina.',
  notFoundServerFix: 'Aggiungila a .htaccess',
  notFoundServerDone: '.htaccess ora punta alla pagina 404.',
  notFoundDefaultTitle: 'Pagina non trovata',
  notFoundDefaultHeading: 'Questa pagina non c’è',
  notFoundDefaultMessage:
    'Potrebbe essere stata spostata, o l’indirizzo potrebbe contenere un errore.',
  notFoundDefaultLink: 'Vai alla home page',
  notFoundDefaultSearch: 'Cerca nel sito',

  // Site icon
  iconTitle: 'Icona del sito',
  iconNone:
    'Ancora nessuna icona: schede del browser, segnalibri e risultati di ricerca ne mostrano una vuota. Scegli un’immagine e CraftPages crea tutte le dimensioni.',
  iconOurs: 'Tutte le dimensioni sono create da un’unica immagine ({icon} e le altre).',
  iconTheirs:
    'Le tue pagine puntano a {icon}. Scegli un’immagine per creare invece il set completo a partire da essa.',
  iconChoose: 'Scegli un’immagine…',
  iconChange: 'Cambia…',
  iconSmall:
    'L’immagine è di {width}×{height} px. Usane una di almeno 512×512 (o un SVG), altrimenti l’icona più grande risulta sfocata.',
  iconNotSquare:
    'L’immagine non è quadrata: viene inserita in un quadrato con spazio vuoto intorno.',
  iconBackground: 'Sfondo nella schermata Home',
  iconBackgroundHint:
    'I telefoni mostrano un’icona trasparente su sfondo nero; questo colore riempie lo spazio dietro l’icona nella schermata Home.',
  iconReplaces: 'I tag dell’icona già presenti nelle tue pagine vengono sostituiti.',
  iconMake: 'Crea l’icona',
  iconMade: 'Icona del sito creata.',
  iconAdded: 'Icona aggiunta.',
  iconMissing: {
    one: '{count} pagina non ha ancora l’icona. <link>Aggiungila</link>',
    other: '{count} pagine non hanno ancora l’icona. <link>Aggiungila</link>'
  },
  iconHelp:
    'Scritti nella cartella principale del sito: favicon.ico (16, 32 e 48 px), apple-touch-icon.png, icon-192.png, icon-512.png e site.webmanifest, più favicon.svg quando l’immagine è un SVG. Il <head> di ogni pagina riceve i tag.'
}

export default messages
