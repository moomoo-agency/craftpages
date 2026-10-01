import type { Translation } from '../types'

const messages: Translation['connections'] = {
  title: 'Підключення для деплою',
  descriptionKeychain:
    'Акаунти, у які деплояться ваші сайти, напр. ваш власний акаунт Cloudflare і акаунт клієнта. Кожен проєкт вибирає одне. Токени зберігаються у сховищі ключів ОС, ніколи — у папці проєкту.',
  descriptionMemory:
    'Акаунти, у які деплояться ваші сайти, напр. ваш власний акаунт Cloudflare і акаунт клієнта. Кожен проєкт вибирає одне. Сховище ключів ОС не знайдено, тому токени зберігаються лише в пам’яті й зникають після виходу. У папці проєкту вони не зберігаються ніколи.',
  add: 'Додати підключення…',
  empty: 'Підключень ще немає. Додайте одне, щоб публікувати проєкти.',
  tokenSaved: 'Токен збережено',
  noToken: 'Немає токена',
  usedBy: 'Використовують: {projects}',
  notUsed: 'Не використовується в нещодавніх проєктах',
  test: 'Перевірити',
  testLabel: 'Перевірити «{name}»',
  editLabel: 'Редагувати «{name}»',
  removeLabel: 'Видалити «{name}»',
  remove: 'Видалити…',
  confirmRemove: 'Видалити «{name}» разом із токеном?',
  confirmRemoveUsed:
    'Видалити «{name}» разом із токеном? Проєктам {projects} знадобиться інше підключення.',
  removeYes: 'Видалити',

  // Results
  workers: {
    one: '{count} Worker',
    few: '{count} Workers',
    many: '{count} Workers',
    other: '{count} Workers'
  },
  pagesProjects: {
    one: '{count} проєкт Pages',
    few: '{count} проєкти Pages',
    many: '{count} проєктів Pages',
    other: '{count} проєкту Pages'
  },
  seesBoth: 'Токен бачить: {workers} і {pages}.',
  seesWorkersOnly: 'Токен працює: бачить {workers}.',
  seesWorkers:
    'Токен бачить: {workers}. Доступу до Pages немає — це не проблема, якщо ви там не публікуєте.',
  seesPages:
    'Токен бачить: {pages}. Він не може публікувати Workers: додайте йому Account · Workers Scripts · Edit.',
  seesNothing: 'Токен не може публікувати Workers: додайте йому Account · Workers Scripts · Edit.',
  saved: '«{name}» збережено. {details}',
  savedBadTokenWorkers:
    '«{name}» збережено, але токен не спрацював. Потрібен дозвіл Account · Workers Scripts · Edit.',
  savedBadToken:
    '«{name}» збережено, але токен не спрацював. Потрібен дозвіл Account · Workers Scripts · Edit (для публікації як Worker) або Account · Cloudflare Pages · Edit.',
  works: '«{name}» працює. {details}',
  removed: '«{name}» і його токен видалено.',

  // Form
  newConnection: 'Нове підключення',
  editConnection: 'Редагування «{name}»',
  type: 'Тип',
  typeHint: 'Netlify, GitHub Pages і SFTP заплановано.',
  name: 'Назва',
  namePlaceholder: 'Мій Cloudflare',
  accountId: 'Account ID',
  accountIdHint: 'У Cloudflare: Workers & Pages, права бічна панель.',
  accountIdPlaceholder: 'ID із 32 символів',
  token: 'API token',
  tokenHintWorkers:
    'Потрібен дозвіл <b>Account · Workers Scripts · Edit</b>. Створіть його в Cloudflare → My Profile → API Tokens.',
  tokenHint:
    'Потрібен дозвіл <b>Account · Workers Scripts · Edit</b> для публікації як Worker або <b>Account · Cloudflare Pages · Edit</b> для Pages. Створіть його в Cloudflare → My Profile → API Tokens.',
  tokenKeep: 'Залиште порожнім, щоб зберегти поточний токен',
  tokenPaste: 'Вставте токен',
  showToken: 'Показати токен',
  addConnection: 'Додати підключення'
}

export default messages
