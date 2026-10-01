import type { Translation } from '../types'

const messages: Translation['components'] = {
  title: 'Componenti condivisi',
  empty: 'Apri un progetto per trovare i blocchi ripetuti nelle sue pagine.',
  scanning: 'Analisi delle pagine…',
  intro:
    'I componenti condivisi sono blocchi presenti in più pagine, come un’intestazione o un piè di pagina. Scegli <b>Modifica</b> o una pagina per aprire il blocco nell’editor, poi fai clic su un testo al suo interno. Una barra sopra la pagina ti permette di applicare le modifiche a <b>tutte le pagine</b> o <b>solo a questa pagina</b>.',
  variantsNote:
    'Le varianti sono copie che differiscono in qualche punto: le modifiche le raggiungono solo dove il testo modificato corrisponde.',
  none: 'Nessun blocco ripetuto trovato.',
  editLabel: 'Modifica {name}',
  variants: { one: '{count} variante', other: '{count} varianti' },
  variant: 'Variante {n}',
  openPage: 'Apri {page} nell’editor'
}

export default messages
