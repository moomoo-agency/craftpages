import type { Translation } from '../types'

const messages: Translation['app'] = {
  viewPages: 'Сторінки',
  viewBlog: 'Блог',
  viewComponents: 'Спільні компоненти',
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
    one: 'Збережено {count} сторінку',
    few: 'Збережено {count} сторінки',
    many: 'Збережено {count} сторінок',
    other: 'Збережено {count} сторінки'
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
    one: '{count} зі спільних блоків',
    few: '{count} зі спільних блоків',
    many: '{count} зі спільних блоків',
    other: '{count} зі спільних блоків'
  },
  seoChanges: 'SEO',
  discardPage: 'Відкинути зміни на {page}',
  staleNote: 'Файли змінилися на диску, тому ці зміни буде відкинуто: {pages}',
  confirmDiscardAll: 'Відкинути всі незбережені зміни?',
  discardAll: 'Відкинути все',
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
  colFile: 'Файл',
  colSize: 'Розмір',
  badgeBlog: 'блог',
  generatedHint: 'Створено блогом: редагуйте допис у розділі «Блог»',
  editPageHint: 'Редагувати {title}',
  untitled: 'Без назви'
}

export default messages
