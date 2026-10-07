import type { Translation } from '../types'

const messages: Translation['connections'] = {
  title: 'Підключення для деплою',
  descriptionKeychain:
    'Куди публікуються сайти: акаунти Cloudflare (ваші чи клієнтів) і хостинги через FTP або SFTP. Кожен проєкт вибирає один. Токени й паролі зберігаються в системному сховищі ключів, ніколи в папці проєкту.',
  descriptionMemory:
    'Куди публікуються сайти: акаунти Cloudflare (ваші чи клієнтів) і хостинги через FTP або SFTP. Кожен проєкт вибирає один. Системного сховища ключів не знайдено, тож токени й паролі живуть лише в пам’яті до виходу. Ніколи в папці проєкту.',
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
  syncReady: 'Синхронізація між комп’ютерами: готова.',
  syncNeedsPermission:
    'Для синхронізації між комп’ютерами токену потрібен ще один дозвіл (Workers R2 Storage · Edit).',
  syncR2Off:
    'Для синхронізації між комп’ютерами потрібне сховище R2, яке ще не ввімкнено в цьому акаунті.',
  capPublish: 'Публікація',
  capSync: 'Синхронізація між комп’ютерами',
  capUpdateToken: 'Оновити токен для синхронізації…',
  capTurnOnR2: 'Увімкнути R2 для синхронізації…',
  createToken: 'Створити токен із потрібними дозволами',
  upgradeTitle: 'Цей токен може публікувати, але не синхронізувати',
  upgradeBody:
    'Публікація й далі працює. Синхронізація між комп’ютерами зберігає дані в сховищі R2 вашого акаунта Cloudflare, тож токену потрібен ще й дозвіл <b>Account · Workers R2 Storage · Edit</b>.',
  upgradeStep1:
    'Створіть новий токен з усім, що використовує CraftPages (або додайте цей дозвіл до поточного в Cloudflare):',
  upgradeCreate: 'Створити токен у Cloudflare',
  upgradeStep2:
    'На тій сторінці можна обмежити його цим акаунтом у розділі Account Resources. Потім скопіюйте токен, який покаже Cloudflare, і вставте сюди. Він замінить старий у сховищі ключів.',
  upgradePaste: 'Вставте новий токен',
  upgradeSave: 'Зберегти й перевірити',
  upgradeDisabledTitle: 'Сховище R2 не ввімкнено в цьому акаунті',
  upgradeDisabledBody:
    'Публікація й далі працює. Синхронізація між комп’ютерами зберігає дані в Cloudflare R2, яке кожен акаунт вмикає один раз (вистачає безплатного тарифу; Cloudflare може попросити спосіб оплати).',
  upgradeOpenR2: 'Відкрити R2 у Cloudflare',
  upgradeCheckAgain: 'Перевірити знову',
  upgradeStillMissing:
    'Токен досі не має доступу до R2. Перевірте, чи є в нього Workers R2 Storage · Edit для цього акаунта.',
  upgradeStillDisabled:
    'R2 досі вимкнено для цього акаунта. Після ввімкнення може знадобитися хвилина.',
  upgradeCantPublish:
    'Цей токен не може публікувати (немає доступу до Workers). Використайте токен із Workers Scripts · Edit і Workers R2 Storage · Edit.',
  upgradeDone: '«{name}» тепер може публікувати й синхронізувати.',
  serverWorks: 'Підключено. Після входу відкривається {home}. Папки там: {folders}.',
  serverNoFolders: 'немає',
  serverWorksNamed: '«{name}» працює. Після входу відкривається {home}.',
  savedServer:
    '«{name}» збережено, вхід успішний (відкривається {home}). Виберіть папку сайту в Налаштуваннях проєкту → Деплой.',
  savedServerFailed: '«{name}» збережено, але увійти не вдалося: {error}',
  addCloudflare: 'Додати Cloudflare…',
  addServer: 'Додати сервер FTP / SFTP…',
  keyFile: 'Файл ключа {file}',
  passwordSaved: 'Пароль збережено',
  noPassword: 'Немає пароля',
  checking: 'Підключення…',
  // Form
  newConnection: 'Нове підключення',
  editConnection: 'Редагування «{name}»',
  type: 'Тип',
  name: 'Назва',
  namePlaceholder: 'Мій Cloudflare',
  accountId: 'Account ID',
  accountIdHint: 'У Cloudflare: Workers & Pages, права бічна панель.',
  accountIdPlaceholder: 'ID із 32 символів',
  token: 'API token',
  tokenHintWorkers:
    'Для публікації потрібен <b>Account · Workers Scripts · Edit</b>; для синхронізації між комп’ютерами ще й <b>Account · Workers R2 Storage · Edit</b>.',
  tokenHint:
    'Потрібен дозвіл <b>Account · Workers Scripts · Edit</b> для публікації як Worker або <b>Account · Cloudflare Pages · Edit</b> для Pages. Створіть його в Cloudflare → My Profile → API Tokens.',
  tokenKeep: 'Залиште порожнім, щоб зберегти поточний токен',
  tokenPaste: 'Вставте токен',
  showToken: 'Показати токен',
  type_cloudflare: 'Cloudflare (Workers)',
  type_sftp: 'SFTP (рекомендовано)',
  type_ftp: 'FTP / FTPS',
  namePlaceholderServer: 'Мій хостинг',
  host: 'Сервер',
  hostHint: 'З панелі керування хостингом, напр. ftp.example.com.',
  port: 'Порт',
  username: 'Ім’я користувача',
  secure: 'Шифрувати (FTPS). Вимикайте, лише якщо сервер цього не підтримує.',
  plainFtpWarning:
    'Звичайний FTP передає пароль і файли так, що їх може прочитати будь-хто в мережі. Використовуйте FTPS або SFTP, якщо хостинг їх підтримує.',
  signIn: 'Вхід через',
  signInPassword: 'Пароль',
  signInKey: 'Файл ключа',
  keyPath: 'Файл приватного ключа',
  keyPathHint:
    'Зазвичай у ~/.ssh, напр. id_ed25519. Файл лишається на місці; зберігається лише шлях до нього.',
  password: 'Пароль',
  passwordHint: 'Зберігається в системному сховищі ключів, ніколи в папці проєкту.',
  passphrase: 'Парольна фраза ключа',
  passphraseHint: 'Залиште порожнім, якщо її немає.',
  passwordKeep: 'Залиште порожнім, щоб зберегти поточний пароль',
  testConnection: 'Перевірити підключення',
  hostKey:
    'Ключ сервера {key}: відтепер довірений. Якщо він зміниться, CraftPages зупиниться й запитає.',
  addConnection: 'Додати підключення'
}

export default messages
