import type { Translation } from '../types'

const messages: Translation['app'] = {
  viewPages: 'Сторінки',
  viewBlog: 'Блог',
  viewComponents: 'Спільні частини',
  viewMedia: 'Медіа',
  viewSeo: 'SEO',
  viewSearch: 'Пошук на сайті',
  viewAi: 'Редагування шаблону (ШІ)',
  viewPublish: 'Публікація',
  viewProject: 'Налаштування проєкту',
  viewSettings: 'Налаштування застосунку',
  sections: 'Розділи',

  switchProject: 'Змінити проєкт ({shortcut})',
  noProjectOpen: 'Проєкт не відкрито',
  openAProject: 'Відкрийте проєкт',
  aiConnected: 'ШІ під’єднано: {clients}',
  proposalsWaiting: {
    one: '{count} пропозиція чекає',
    few: '{count} пропозиції чекають',
    many: '{count} пропозицій чекають',
    other: '{count} пропозиції чекають'
  },
  publishSite: 'Опублікувати сайт',

  dismissError: 'Закрити цю помилку',
  scheduledToast: '«{label}» з’явиться на сайті {at}. Стежте за цим у розділі «Публікація».',
  scheduledToastUntil:
    '«{label}» з’явиться на сайті {at} і буде знято {until}. Стежте за цим у розділі «Публікація».',
  scheduledOtherProject: '{project}: {message}',

  savedPages: {
    one: '{count} сторінку збережено в теці сайту · ще не онлайн',
    few: '{count} сторінки збережено в теці сайту · ще не онлайн',
    many: '{count} сторінок збережено в теці сайту · ще не онлайн',
    other: '{count} сторінки збережено в теці сайту · ще не онлайн'
  },
  nothingToSave: 'Нічого зберігати',
  skippedShared: {
    one: '{count} спільну зміну пропущено: там інший вміст',
    few: '{count} спільні зміни пропущено: там інший вміст',
    many: '{count} спільних змін пропущено: там інший вміст',
    other: '{count} спільної зміни пропущено: там інший вміст'
  },
  skippedDetail: '{component} на {page}: відрізняється від {from}',
  undoSave: 'Скасувати збереження',
  unsavedSummary: {
    one: 'Незбережені зміни на {count} сторінці',
    few: 'Незбережені зміни на {count} сторінках',
    many: 'Незбережені зміни на {count} сторінках',
    other: 'Незбережені зміни на {count} сторінки'
  },
  editsCount: {
    one: '{count} зміна',
    few: '{count} зміни',
    many: '{count} змін',
    other: '{count} зміни'
  },
  fromShared: {
    one: '{count} зі спільних частин',
    few: '{count} зі спільних частин',
    many: '{count} зі спільних частин',
    other: '{count} зі спільних частин'
  },
  seoChanges: 'SEO',
  discardPage: 'Відкинути зміни на {page}',
  staleNote: 'Файли змінилися на диску, тому ці зміни буде відкинуто: {pages}',
  confirmDiscardAll: 'Відкинути всі незбережені зміни?',
  schedule: 'Запланувати…',
  scheduleHint: 'Зберегти ці зміни у визначений час, а не зараз',
  saveAll: 'Зберегти все',
  saveAllHint: 'Записати всі зміни в теку сайту ({shortcut})',

  projects: 'Проєкти',
  addProject: 'Додати проєкт…',
  searchProjects: 'Шукати серед останніх проєктів',
  noMatch: 'Жоден проєкт не відповідає «{query}».',
  noRecent: 'Ще немає останніх проєктів. Додайте теку сайту, щоб почати.',
  currentBadge: 'відкрито',
  unsavedBadge: {
    one: '{count} не збережено',
    few: '{count} не збережено',
    many: '{count} не збережено',
    other: '{count} не збережено'
  },
  deploysTo: 'Публікується в {name}',
  removeFromList: 'Прибрати {name} зі списку (теку не буде змінено)',

  openSiteTitle: 'Відкрийте сайт',
  openSiteBody:
    'Виберіть теку з HTML-файлами сайту. Вона залишається джерелом істини: CraftPages редагує файли на місці.',
  openProjectButton: 'Відкрити проєкт…',
  noPages: 'У цій теці ще немає HTML-сторінок.',
  colTitle: 'Назва',
  badgeBlog: 'блог',
  generatedHint: 'Створено блогом: відкрийте, як її бачать відвідувачі',
  badgeTemplate: 'шаблон блогу',
  badgePostTemplate: 'шаблон статті',
  postTemplateHint:
    'Кожен допис будується з цієї сторінки: змініть її, щоб змінити вигляд усіх дописів. Щойно блог опубліковано, вона не потрапляє на сайт, а посилання на неї ведуть до блогу.',
  templateHint:
    'Блог будується з цієї сторінки: змініть її, щоб змінити вигляд списку дописів. Щойно блог опубліковано, вона не потрапляє на сайт, а посилання на неї ведуть до блогу.',
  editPageHint: 'Редагувати {title}',
  untitled: 'Без назви',
  publishUnsaved: {
    one: '{count} сторінка має незбережені зміни: збережіть їх, щоб опублікувати',
    few: '{count} сторінки мають незбережені зміни: збережіть їх, щоб опублікувати',
    many: '{count} сторінок мають незбережені зміни: збережіть їх, щоб опублікувати',
    other: '{count} сторінки має незбережені зміни: збережіть їх, щоб опублікувати'
  },
  saveFailed: 'Не вдалося зберегти: {error}',
  skippedExplain:
    'Ці сторінки мають власну версію спільної частини, тож зміну там не застосовано. Відкрийте сторінку, щоб змінити її вручну.',
  colAddress: 'Адреса',
  discardAllAction: 'Відкинути всі зміни…',
  navContent: 'Вміст',
  navSite: 'Сайт',
  allLive: 'Усе збережено · робочий сайт актуальний',
  navSettings: 'Налаштування',
  unsavedShort: {
    one: '{count} незбережена',
    few: '{count} незбережені',
    many: '{count} незбережених',
    other: '{count} незбереженої'
  },
  savedFiles: {
    one: 'Записано {count} файл · ще не онлайн',
    few: 'Записано {count} файли · ще не онлайн',
    many: 'Записано {count} файлів · ще не онлайн',
    other: 'Записано {count} файлу · ще не онлайн'
  },
  readyToPublish: 'Зміни готові до публікації',
  changesHere: {
    one: '{count} зміна на цій сторінці',
    few: '{count} зміни на цій сторінці',
    many: '{count} змін на цій сторінці',
    other: '{count} зміни на цій сторінці'
  },
  pagesUnsaved: {
    one: '{count} сторінка не збережена',
    few: '{count} сторінки не збережені',
    many: '{count} сторінок не збережено',
    other: '{count} сторінки не збережено'
  },
  confirmDiscardPage: 'Відкинути зміни на {page}?',
  pagesReady: {
    one: '{count} сторінка готова до публікації',
    few: '{count} сторінки готові до публікації',
    many: '{count} сторінок готові до публікації',
    other: '{count} сторінки готові до публікації'
  }
}

export default messages
