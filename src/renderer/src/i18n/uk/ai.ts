import type { Translation } from '../types'

const messages: Translation['ai'] = {
  // Connect
  openSettings: 'Налаштування підключення ШІ',
  conceptTitle: 'Редагування шаблонів за допомогою ШІ',
  concept:
    'Сьогодні ефективно змінювати шаблони сайту чи створювати нові можна з ШІ. Ваш інструмент ШІ (підключається в Налаштуваннях застосунку) читає сайт і надсилає сюди зміни як пропозиції: перегляньте відмінності й попередній перегляд, потім прийміть або відхиліть кожну. Прийняті зміни можна скасувати.',
  conceptCode:
    'Для окремого виправлення на одній сторінці чи в шаблоні відкрийте сторінку й перейдіть у режим «Код».',
  notConnected:
    'Готово, але ШІ не підключено. Налаштуйте його в Налаштуваннях застосунку → Підключення ШІ.',
  connected: 'Під’єднано: {clients}',
  off: 'Під’єднання ШІ вимкнено в налаштуваннях.',
  autoAccept: 'Автоматично приймати пропозиції до виходу із застосунку',
  autoAcceptHint: 'Кожну зміну все одно можна скасувати нижче.',

  // Proposals
  proposals: 'Пропозиції',
  waitingCount: {
    one: '{count} очікує',
    few: '{count} очікують',
    many: '{count} очікують',
    other: '{count} очікує'
  },
  empty:
    'Пропозицій ще немає. Зміни, які пропонує ваш ШІ, з’являться тут із порівнянням і живим попереднім переглядом.',
  files: {
    one: '{count} файл',
    few: '{count} файли',
    many: '{count} файлів',
    other: '{count} файлу'
  },
  statusPending: 'Чекає на вас',
  statusAccepted: 'Прийнято',
  statusRejected: 'Відхилено',
  statusReverted: 'Скасовано',
  statusFailed: 'Помилка',
  accept: 'Прийняти',
  reject: 'Відхилити',
  reason: 'Причина відхилення',
  reasonPlaceholder: 'Чому? Буде надіслано ШІ (необов’язково)',
  previewAfter: 'Перегляд результату:',
  hidePreview: 'Сховати перегляд',
  previewTitle: 'Перегляд {path} із запропонованими змінами',

  // Diff
  newFile: 'Новий файл',
  deletedFile: 'Видалено',
  linesAdded: {
    one: 'додано {count} рядок',
    few: 'додано {count} рядки',
    many: 'додано {count} рядків',
    other: 'додано {count} рядка'
  },
  linesRemoved: {
    one: 'видалено {count} рядок',
    few: 'видалено {count} рядки',
    many: 'видалено {count} рядків',
    other: 'видалено {count} рядка'
  },
  changesIn: 'Зміни в {path}'
}

export default messages
