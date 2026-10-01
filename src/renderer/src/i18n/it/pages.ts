import type { Translation } from '../types'

const messages: Translation['pages'] = {
  backToPages: 'Torna alle pagine',
  modeLabel: 'Modalità dell’editor',
  modeEdit: 'Modifica',
  modeEditTip: 'Fai clic sul testo della pagina per modificarlo',
  modeInteract: 'Interagisci',
  modeInteractTip: 'Usa la pagina come un visitatore: pulsanti, menu e link funzionano',
  viewportLabel: 'Larghezza anteprima',
  viewportDesktop: 'Desktop',
  viewportTablet: 'Tablet',
  viewportMobile: 'Mobile',
  openInBrowser: 'Apri nel browser, con le modifiche non salvate',
  confirmDiscardPage: 'Scartare le modifiche non salvate di questa pagina?',
  discardPage: 'Scarta modifiche pagina',
  discardPageTip: 'Elimina le modifiche non salvate fatte su questa pagina',
  sharedBar: {
    one: '{name} compare in {count} pagina. Applica le modifiche a:',
    other: '{name} compare in {count} pagine. Applica le modifiche a:'
  },
  scopeLabel: 'Applica le modifiche a',
  scopeAll: { one: '{count} pagina', other: 'Tutte le {count} pagine' },
  scopePage: 'Solo questa pagina',
  scopeHint:
    'Le altre pagine ricevono una modifica solo dove la loro copia dell’elemento corrisponde a questa.',
  interactBar:
    'Modalità Interagisci: la pagina esegue i suoi script, con le modifiche non salvate applicate.',
  allowExternal: 'Consenti script esterni (analytics, pagamenti, embed)',
  frameEdit: 'Modifica di {path}',
  framePreview: 'Anteprima di {path}',
  imagePanel: 'Immagine',
  closePanel: 'Chiudi pannello',
  imageSize: '{width} × {height} px',
  changeImage: 'Cambia immagine…',
  chooseImage: 'Scegli immagine…',
  altText: 'Testo alternativo',
  altHint: 'Descrivi l’immagine per gli screen reader e i motori di ricerca.',
  untitled: 'Senza titolo',
  noDescription: 'Nessuna descrizione.',
  searchPreview: 'Anteprima nei risultati di ricerca',
  seoTitle: 'Titolo',
  charCount: {
    one: '{count} carattere (ideale {min}–{max})',
    other: '{count} caratteri (ideale {min}–{max})'
  },
  metaDescription: 'Meta description',
  canonical: 'URL canonico',
  robots: 'Robots',
  robotsHint:
    'Ad esempio “noindex, nofollow”. Lascia vuoto per far indicizzare la pagina dai motori di ricerca.',
  ogTitle: 'Titolo social (og:title)',
  ogDescription: 'Descrizione social (og:description)',
  ogImage: 'Immagine social',
  ogImageExternal: 'Immagine su un altro sito',
  ogImageNone: 'Nessuna immagine',
  ogImageSize: 'La misura ideale è 1200 × 630 px.',
  ogImageBaseUrl: 'Imposta l’URL di base in Impostazioni progetto per avere un URL completo.',
  seoDraftNote: 'Anche le modifiche SEO sono bozze: Salva tutto le scrive nella cartella del sito.',
  footer: {
    one: '{count} elemento modificabile · Fai clic sul testo per modificarlo o su un’immagine per cambiarla · Maiusc+Invio va a capo · Le modifiche restano bozze finché non usi Salva tutto (⌘S)',
    other:
      '{count} elementi modificabili · Fai clic sul testo per modificarlo o su un’immagine per cambiarla · Maiusc+Invio va a capo · Le modifiche restano bozze finché non usi Salva tutto (⌘S)'
  },
  pickerSocial: 'Immagine social',
  pickerChange: 'Cambia immagine'
}

export default messages
