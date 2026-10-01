import type { Translation } from '../types'

const messages: Translation['updates'] = {
  title: 'Вийшла версія {version}',
  whatsNew: 'Що нового',
  dismiss: 'Сховати до наступної версії',
  download: 'Завантажити',
  downloadHint: 'Встановіть поверх цієї: налаштування й сайти залишаться.',
  downloading: 'Завантаження оновлення',
  downloadingPercent: 'Завантаження… {percent}%',
  restart: 'Перезапустити й оновити',
  section: 'Оновлення',
  sectionHint: 'У вас CraftPages {version}.',
  checkNow: 'Перевірити',
  unsupported: 'Це збірка для розробки: вона не оновлюється сама.',
  checking: 'Перевірка оновлень…',
  current: 'У вас найновіша версія (перевірено {date}).',
  available: 'Доступний CraftPages {version}.',
  downloadingVersion: 'Завантаження CraftPages {version}… {percent}%',
  ready: 'CraftPages {version} завантажено, він встановиться після перезапуску.',
  error: 'Не вдалося перевірити оновлення: {error}',
  allReleases: 'Усі версії'
}

export default messages
