import type { Translation } from '../types'

const messages: Translation['updates'] = {
  title: 'È uscita la versione {version}',
  whatsNew: 'Novità',
  dismiss: 'Nascondi fino alla prossima versione',
  download: 'Scarica',
  downloadHint: 'Installala sopra questa: impostazioni e siti restano.',
  downloading: 'Download dell’aggiornamento',
  downloadingPercent: 'Download… {percent}%',
  restart: 'Riavvia per aggiornare',
  section: 'Aggiornamenti',
  sectionHint: 'Hai CraftPages {version}.',
  checkNow: 'Controlla ora',
  unsupported: 'Questa è una build di sviluppo: non si aggiorna da sola.',
  checking: 'Controllo aggiornamenti…',
  current: 'Hai l’ultima versione (controllato {date}).',
  available: 'È disponibile CraftPages {version}.',
  downloadingVersion: 'Download di CraftPages {version}… {percent}%',
  ready: 'CraftPages {version} è scaricato e si installa al riavvio.',
  error: 'Impossibile controllare gli aggiornamenti: {error}',
  allReleases: 'Tutte le versioni'
}

export default messages
