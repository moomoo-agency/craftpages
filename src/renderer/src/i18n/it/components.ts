import type { Translation } from '../types'

const messages: Translation['components'] = {
  title: 'Parti condivise',
  empty: 'Apri un progetto per trovare le parti ripetute nelle sue pagine.',
  scanning: 'Analisi delle pagine…',
  intro:
    'Le parti condivise compaiono su più di una pagina, come un’intestazione o un piè di pagina. Scegli <b>Modifica parte</b> o una pagina per aprire la parte nell’editor, poi fai clic su un testo al suo interno. La prima volta scegli se le modifiche valgono per <b>tutte le pagine</b> o <b>solo questa pagina</b>.',
  variantsNote:
    'Le varianti sono copie che differiscono in qualche punto: le modifiche le raggiungono solo dove il testo modificato corrisponde.',
  none: 'Nessuna parte ripetuta trovata.',
  editLabel: 'Modifica {name}',
  variants: { one: '{count} variante', other: '{count} varianti' },
  variant: 'Variante {n}',
  openPage: 'Apri {page} nell’editor',
  textLabel: 'Testo in questa parte',
  noText: 'Nessun testo: solo immagini, icone o link senza parole.',
  usedOn: 'Presente in',
  editAll: 'Modifica parte',
  kind_header: 'Intestazione',
  kind_footer: 'Piè di pagina',
  kind_nav: 'Navigazione',
  kind_aside: 'Barra laterale',
  kind_section: 'Sezione',
  kind_form: 'Modulo',
  kind_article: 'Articolo',
  kind_div: 'Blocco',
  named: '{kind} «{name}»'
}

export default messages
