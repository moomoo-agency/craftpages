import type { Translation } from '../types'

const messages: Translation['project'] = {
  title: 'Налаштування проєкту',

  // Site
  site: 'Сайт',
  siteDescription: 'Зберігаються разом із сайтом у {path}.',
  siteName: 'Назва сайту',
  baseUrl: 'Базовий URL',
  baseUrlHint: 'Для канонічних посилань, карти сайту та RSS.',
  language: 'Мова',
  languageHint: 'Код мови, напр. en, en-US, it, uk.',
  images: 'Зображення',
  maxWidth: 'Макс. ширина (px)',
  quality: 'Якість JPEG / WebP',
  qualityHint: 'Від 30 до 100.',
  folder: 'Папка',
  folderHint: 'Відносно кореня сайту.',
  pngToJpeg: 'Перетворювати PNG-фото без прозорості на JPEG',
  blog: 'Блог',
  blogNote:
    'URL дописів, адреса списку дописів і кількість дописів на сторінці задаються в розділі Блог → URL дописів.',
  savedSite: 'Збережено в .sitecms/site.json.',

  // Deploy
  deploy: 'Деплой',
  deployDescription:
    'Куди публікується цей проєкт. Виберіть одне з ваших підключень для деплою (ваше, клієнта…). Підключення додаються в розділі {settings}.',
  listWorkers: 'Показати Workers',
  listPages: 'Показати проєкти Pages',
  savedDeploy: 'Налаштування деплою для цього проєкту збережено.',
  connection: 'Підключення',
  noConnections: 'Підключень ще немає: додайте його в розділі {settings}.',
  noToken: 'Для цього підключення ще немає API token.',
  choose: '— Виберіть —',
  unknownConnection: 'Невідоме підключення (налаштоване на іншому комп’ютері?)',
  servers: 'Сервери (FTP / SFTP)',
  noPassword: 'Для цього підключення ще немає пароля.',
  remoteDir: 'Папка на сервері',
  remoteDirHint:
    'Куди йдуть файли сайту, зазвичай public_html, www або htdocs. Порожньо = папка, що відкривається після входу. CraftPages видаляє лише ті файли, які завантажив сам.',
  browse: 'Огляд…',
  browseLabel: 'Папки на сервері',
  browsePath: 'Поточна папка',
  browseSuggested: 'Хостинги зазвичай віддають сайти з папки з такою назвою',
  browseEmpty: 'Тут немає папок.',
  browseUse: 'Використати {dir}',
  publishAs: 'Публікувати як',
  targetWorkers: 'Worker (рекомендовано)',
  targetPages: 'Проєкт Pages',
  workersHint:
    'Те, що Cloudflare типово створює для нових проєктів: Worker роздає файли сайту. Статичні файли роздаються безкоштовно.',
  pagesHint:
    'Для проєктів, які вже працюють на Cloudflare Pages. Додає деплої попереднього перегляду з власним URL.',
  worker: 'Worker',
  workerHint: 'Виберіть наявний або введіть нову назву.',
  workerExplain:
    'Новий Worker буде створено під час першої публікації за адресою назва.ваш-піддомен.workers.dev. Щоб використати власний домен, додайте його до Worker у Cloudflare.',
  workersHidden: 'Не показано, бо публікація замінила б їхній код: {names}.',
  workerPlaceholder: 'my-site',
  pagesProject: 'Проєкт Pages',
  pagesProjectPlaceholder: 'Покажіть проєкти Pages, щоб вибрати',
  productionBranch: 'Гілка продакшну',
  previewBranch: 'Гілка перегляду',
  previewBranchHint: 'Деплої попереднього перегляду отримують власний URL.',
  neverUpload: 'Ніколи не завантажувати',
  neverUploadHint:
    'Один шаблон на рядок. * діє в межах папки, ** — через папки. .sitecms і файли, що починаються з крапки, завжди пропускаються (крім .htaccess під час публікації на сервер).',
  newProjectName: 'Назва нового проєкту Pages',
  newProjectPlaceholder: 'new-project-name',
  createProject: 'Створити проєкт Pages',
  created: 'Створено {name} ({subdomain}).',

  // Results of listing projects and Workers
  pagesFound: {
    one: 'У цьому акаунті {count} проєкт Pages.',
    few: 'У цьому акаунті {count} проєкти Pages.',
    many: 'У цьому акаунті {count} проєктів Pages.',
    other: 'У цьому акаунті {count} проєкту Pages.'
  },
  noPagesButWorkers: {
    one: 'У цьому акаунті немає проєктів Pages. Є {count} Worker ({names}) — це інший тип проєкту. Створіть проєкт Pages нижче або публікуйте як Worker.',
    few: 'У цьому акаунті немає проєктів Pages. Є {count} Workers ({names}) — це інший тип проєктів. Створіть проєкт Pages нижче або публікуйте як Worker.',
    many: 'У цьому акаунті немає проєктів Pages. Є {count} Workers ({names}) — це інший тип проєктів. Створіть проєкт Pages нижче або публікуйте як Worker.',
    other:
      'У цьому акаунті немає проєктів Pages. Є {count} Workers ({names}) — це інший тип проєктів. Створіть проєкт Pages нижче або публікуйте як Worker.'
  },
  noPages:
    'У цьому акаунті немає проєктів Pages. Проєкти, створені як Workers (типовий варіант у панелі Cloudflare), тут не показуються. Створіть проєкт Pages нижче або публікуйте як Worker.',
  workersNoAccess:
    'Токен не може читати Workers. У Cloudflare → My Profile → API Tokens надайте йому дозвіл Account · Workers Scripts · Edit.',
  workersFound: {
    one: 'У цьому акаунті {count} Worker; CraftPages може публікувати в {usable}. Виберіть наявний або введіть нову назву.',
    few: 'У цьому акаунті {count} Workers; CraftPages може публікувати в {usable}. Виберіть наявний або введіть нову назву.',
    many: 'У цьому акаунті {count} Workers; CraftPages може публікувати в {usable}. Виберіть наявний або введіть нову назву.',
    other:
      'У цьому акаунті {count} Workers; CraftPages може публікувати в {usable}. Виберіть наявний або введіть нову назву.'
  },
  noWorkers: 'Workers ще немає. Введіть назву: Worker буде створено під час першої публікації.',
  editing: 'Редагування',
  codeEditor: 'Показувати редактор коду',
  codeEditorHint:
    'Додає «Код» поруч із «Редагування» та «Перегляд», щоб змінювати HTML, CSS і JavaScript сторінки. Залиште вимкненим для тих, хто лише редагує вміст.',
  unsavedChanges: 'Незбережені зміни'
}

export default messages
