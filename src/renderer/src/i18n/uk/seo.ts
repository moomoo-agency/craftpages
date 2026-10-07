import type { Translation } from '../types'

const messages: Translation['seo'] = {
  title: 'SEO',

  checkTitle: 'Перевірка сайту',
  checking: 'Перевіряємо всі сторінки…',
  checkingShort: 'Перевірка…',
  checkAgain: 'Перевірити знову',
  checkSummary: {
    one: 'Перевірено {count} сторінку. Проблеми: {error} · Покращити: {warning} · Примітки: {info}',
    few: 'Перевірено {count} сторінки. Проблеми: {error} · Покращити: {warning} · Примітки: {info}',
    many: 'Перевірено {count} сторінок. Проблеми: {error} · Покращити: {warning} · Примітки: {info}',
    other:
      'Перевірено {count} сторінки. Проблеми: {error} · Покращити: {warning} · Примітки: {info}'
  },
  severityFilter: 'Фільтр за важливістю',
  kindFilter: 'Фільтр за темою',
  filterError: 'Проблеми',
  filterWarning: 'Покращити',
  filterInfo: 'Примітки',
  tagError: 'Проблема',
  tagWarning: 'Покращити',
  tagInfo: 'Примітка',
  allKinds: 'Усі теми',
  kindTitle: 'Заголовки сторінок',
  kindDescription: 'Описи',
  kindHeadings: 'Заголовки',
  kindImages: 'Зображення',
  kindLinks: 'Посилання',
  kindCanonical: 'Canonical',
  kindSocial: 'Соцмережі',
  kindLanguage: 'Мова',
  kindIndexing: 'Індексація',
  nothingInFilter: 'За цим фільтром нічого немає.',
  noIssues: 'Проблем не знайдено.',
  openPage: 'Відкрити сторінку',
  openPageLabel: 'Відкрити сторінку {page}',

  defaultsTitle: 'Типові налаштування SEO',
  defaultsDescription:
    'Застосовуються до сторінок, які створює застосунок: дописів блогу, списків і сторінок тегів.',
  defaultsSaved: 'Збережено. Застосується під час наступної публікації блогу.',
  titlePattern: 'Шаблон заголовка',
  titlePatternHint:
    'Використовуйте {title} і {site}. Приклад: «{example}». Власний SEO-заголовок допису замінює шаблон.',
  titlePatternExample: 'Мій перший допис',
  defaultImage: 'Типове зображення для соцмереж',
  defaultImageHint: 'Для дописів без обкладинки. Найкраще — 1200 × 630 px.',
  sitemapAuto: 'Автоматично підтримувати sitemap.xml повною',
  sitemapAutoHint:
    'Створюється заново з усіх сторінок (крім 404 і noindex) під час публікації блогу та перед кожним розгортанням. Якщо вимкнено, до вашої sitemap додаються лише URL блогу.',
  sitemapExclude: 'Не додавати до sitemap',
  sitemapExcludeHint: 'Один шаблон на рядок, наприклад {a} або {b}',
  rebuildSitemap: 'Оновити sitemap',
  sitemapRebuilt: {
    one: 'sitemap.xml оновлено: {count} сторінка.',
    few: 'sitemap.xml оновлено: {count} сторінки.',
    many: 'sitemap.xml оновлено: {count} сторінок.',
    other: 'sitemap.xml оновлено: {count} сторінки.'
  },
  sitemapUpToDate: {
    one: 'sitemap.xml уже актуальний ({count} сторінка).',
    few: 'sitemap.xml уже актуальний ({count} сторінки).',
    many: 'sitemap.xml уже актуальний ({count} сторінок).',
    other: 'sitemap.xml уже актуальний ({count} сторінки).'
  },
  sitemapCreated: {
    one: 'sitemap.xml створено: {count} сторінка.',
    few: 'sitemap.xml створено: {count} сторінки.',
    many: 'sitemap.xml створено: {count} сторінок.',
    other: 'sitemap.xml створено: {count} сторінки.'
  },
  sitemapSettingsSaved: 'Збережено.',
  sitemapDescription:
    'Файл у корені сайту (/sitemap.xml) зі списком сторінок, щоб пошукові системи знайшли їх усі.',
  sitemapCurrent: 'Актуальна',
  sitemapStale: 'Застаріла',
  sitemapStatus: {
    one: 'На сайті є sitemap.xml: у ній {count} сторінка, востаннє змінено {date}.',
    few: 'На сайті є sitemap.xml: у ній {count} сторінки, востаннє змінено {date}.',
    many: 'На сайті є sitemap.xml: у ній {count} сторінок, востаннє змінено {date}.',
    other: 'На сайті є sitemap.xml: у ній {count} сторінки, востаннє змінено {date}.'
  },
  sitemapWouldList: {
    one: 'Після оновлення в ній буде {count} сторінка.',
    few: 'Після оновлення в ній буде {count} сторінки.',
    many: 'Після оновлення в ній буде {count} сторінок.',
    other: 'Після оновлення в ній буде {count} сторінки.'
  },
  sitemapMissing: 'На сайті ще немає sitemap.xml.',
  createSitemap: 'Створити sitemap.xml',
  fileMissing: 'Файлу немає',
  fileExists: 'Файл є',
  viewFile: 'Переглянути файл',
  robotsDescription:
    'Файл у корені сайту (/robots.txt), який каже пошуковим системам, які частини сайту можна сканувати.',
  robotsSaved: 'robots.txt збережено.',
  robotsCreated: 'robots.txt створено. Він з’явиться на сайті після наступної публікації.',
  robotsMissing:
    'На сайті немає robots.txt. Тоді пошукові системи сканують усе, і зазвичай це нормально, але саме цей файл стандартно вказує їм на sitemap.',
  robotsCreate: 'Створити стандартний robots.txt',
  robotsDefaultLabel: 'Стандартний robots.txt',
  robotsNoSitemap:
    'Немає рядка Sitemap, тож пошукові системи мають самі шукати sitemap.xml. <link>Додати рядок</link>',

  identityTitle: 'Ідентичність сайту (код в index.html)',
  identityDescription:
    'Це не окремий файл, а блок структурованих даних (JSON-LD) у <head> головної сторінки, що повідомляє пошуковим системам назву й логотип сайту.',
  identityLogo: 'логотип {logo}',
  identityFound: 'Знайдено в index.html. Дописи блогу вказують ці дані як видавця.',
  identityFoundWithWebsite:
    'Знайдено в index.html разом із даними WebSite. Дописи блогу вказують ці дані як видавця.',
  identityMissing: 'Головна сторінка ще не описує організацію. Додайте опис тут:',
  identityName: 'Назва',
  identityUrl: 'URL сайту',
  identityLogoLabel: 'Логотип',
  identityAdd: 'Додати на головну сторінку',
  identityAdded: 'Додано в index.html.',
  identityCode: 'Її описує цей код у {file} (відвідувачі його не бачать):',
  identityAddedCode: 'Цей код додано в {file}, перед {head}. Відвідувачі його не бачать:',
  identityPreview: 'Цей код буде додано в {file}, перед {head}. Відвідувачі його не бачать:'
}

export default messages
