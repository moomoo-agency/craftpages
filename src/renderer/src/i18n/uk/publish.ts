import type { Translation } from '../types'

const messages: Translation['publish'] = {
  // Deploy
  emptyTitle: 'Нічого публікувати',
  titleWorker: 'Публікація у Worker «{name}»',
  titleAnyWorker: 'Публікація у Cloudflare Worker',
  titlePages: 'Публікація в проєкт Pages «{name}»',
  titleAnyPages: 'Публікація в Cloudflare Pages',
  titleCloudflare: 'Публікація в Cloudflare',
  checking: 'Перевірка файлів…',
  files: {
    one: '{count} файл',
    few: '{count} файли',
    many: '{count} файлів',
    other: '{count} файлу'
  },
  changed: {
    one: '{count} змінено після останнього деплою',
    few: '{count} змінено після останнього деплою',
    many: '{count} змінено після останнього деплою',
    other: '{count} змінено після останнього деплою'
  },
  changedSince: {
    one: '{count} змінено після останнього деплою ({date}, {branch})',
    few: '{count} змінено після останнього деплою ({date}, {branch})',
    many: '{count} змінено після останнього деплою ({date}, {branch})',
    other: '{count} змінено після останнього деплою ({date}, {branch})'
  },
  deployPreview: 'Деплой попереднього перегляду',
  publishProduction: 'Опублікувати в продакшн',
  hintWorker:
    'Завантажуються лише файли зі зміненим вмістом. Кожна публікація зберігається як версія, до якої можна повернутися.',
  hintPages:
    'Завантажуються лише файли зі зміненим вмістом. Деплой попереднього перегляду отримує власний URL і не змінює робочий сайт.',
  progressLabel: 'Перебіг деплою',
  deployedTo: 'Розгорнуто на {url}',
  rolledBack: 'Продакшн повернуто до {id}.',
  openSettings: 'Відкрити налаштування',
  foreignTitle: 'Сайт онлайн опубліковано з іншого місця',
  foreignBody:
    'Версію, що зараз онлайн, опубліковано {date}{by} з іншого комп’ютера, іншого інструмента або з панелі Cloudflare. Публікація замінить увесь сайт вмістом цієї папки, тож зроблені там зміни буде втрачено. Cloudflare не може повернути файли: спершу перенесіть у цю папку найновіші файли (від того, хто публікував, або з вашого git-репозиторію).',
  foreignBy: ' ({author})',
  foreignVia: ' ({source})',
  foreignPublish: 'Усе одно опублікувати',

  // Deployments
  deployments: 'Деплої',
  noDeployments: 'Деплоїв ще немає.',
  colWhen: 'Коли',
  colEnvironment: 'Середовище',
  colBranch: 'Гілка',
  colStatus: 'Статус',
  colActions: 'Дії',
  envProduction: 'Продакшн',
  envPreview: 'Перегляд',
  live: 'Онлайн',
  openDeployment: 'Відкрити це розгортання в браузері',
  rollBack: 'Повернути…',
  rollBackConfirm: 'Знову зробити цю версію робочою?',
  rollBackYes: 'Повернути',

  // Scheduled changes
  scheduledTitle: 'Заплановані зміни',
  scheduledDescription:
    'Зміни сторінок і дописи, що публікуються у визначений час. CraftPages публікує їх, поки працює (зокрема у фоні), і наздоганяє пропущене після сну чи перезапуску.',
  nothingScheduled:
    'Нічого не заплановано. Щоб запланувати зміни сторінок, виберіть {schedule} поруч із {saveAll}. Щоб запланувати допис, укажіть для нього майбутню дату.',
  deployRetry:
    'Заплановане розгортання не вдається з {date}. Повторна спроба щохвилини. Помилка: {error}',
  stateScheduled: 'Заплановано',
  stateLive: 'Онлайн',
  stateDone: 'Завершено',
  stateBlocked: 'Затримано',
  post: 'Допис',
  wasLive: 'Було онлайн {from} – {to}',
  wentLive: 'Опубліковано {date}',
  liveSince: 'Онлайн з {date}',
  goesLive: 'Публікація {date}',
  comesDown: 'зняття {date}',
  deploysToProduction: 'розгортання в продакшн',
  publishNow: 'Опублікувати зараз',
  unschedule: 'Скасувати планування',
  publishAnyway: 'Усе одно опублікувати…',
  takeDownAnyway: 'Усе одно зняти…',
  takeDownNow: 'Зняти зараз',
  keepLive: 'Залишити онлайн',
  overwrite: 'Так, перезаписати',
  helpBlocked:
    '«Усе одно опублікувати» замінює ці сторінки запланованою версією, а інші зміни на них буде втрачено. «Скасувати планування» повертає заплановані зміни до незбережених; зміни на сторінках, що встигли змінитися, буде відкинуто.',
  helpLive:
    '«Усе одно зняти» повертає ці сторінки точно в попередній стан, а зміни, внесені відтоді, буде втрачено.'
}

export default messages
