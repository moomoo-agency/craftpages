import type { Translation } from '../types'

const messages: Translation['schedule'] = {
  title: 'Programma queste modifiche',
  introOne:
    'Le modifiche su {page} vengono messe da parte. Il sito resta com’è fino all’ora che scegli.',
  introMany: {
    one: 'Le modifiche su {count} pagina ({pages}) vengono messe da parte. Il sito resta com’è fino all’ora che scegli.',
    other:
      'Le modifiche su {count} pagine ({pages}) vengono messe da parte. Il sito resta com’è fino all’ora che scegli.'
  },
  name: 'Nome',
  nameHint: 'Compare in Pubblica e nelle notifiche.',
  namePlaceholder: 'es. Lancio saldi di primavera',
  goesLive: 'Va online',
  zoneHint: 'Nel fuso orario del computer ({zone}).',
  takeDown: 'Ritira di nuovo le modifiche più tardi',
  comesDown: 'Viene ritirato',
  comesDownHint: 'Le pagine tornano come sono adesso.',
  deploy: 'Pubblica in produzione quando va online',
  deployBoth: 'Pubblica in produzione quando va online e quando viene ritirato',
  noDeploy:
    'Per pubblicare in automatico, configura la pubblicazione in Impostazioni progetto. Senza, le pagine cambiano nella cartella e le pubblichi tu.',
  backgroundMac:
    'CraftPages lo fa su questo computer e resta attivo nella barra dei menu quando chiudi la finestra. Se a quell’ora il computer è in stop o spento, le modifiche escono appena si riaccende.',
  backgroundOther:
    'CraftPages lo fa su questo computer e resta attivo nell’area di notifica quando chiudi la finestra. Se a quell’ora il computer è in stop o spento, le modifiche escono appena si riaccende.',
  submit: 'Programma',
  submitting: 'Programmazione…',

  runPosts: 'Ora sul sito: {items}.',
  runReleased: 'Modifiche programmate online: {items}.',
  runEnded: 'Ritirate come previsto: {items}.',
  runBlocked: 'Trattenute perché la pagina è cambiata nello stesso punto: {items}. Vedi Pubblica.',
  runDeployed: 'Pubblicato in produzione.',
  runPublishHint: 'Pubblica il sito per metterlo online.'
}

export default messages
