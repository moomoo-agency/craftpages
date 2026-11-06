import type { Translation } from '../types'

const messages: Translation['tracking'] = {
  title: 'Аналітика і відстеження',
  description:
    'Виберіть сервіс і вставте його ID: CraftPages додасть його тег на кожну сторінку, а також на ті, що з’являться пізніше.',
  none: 'Аналітики ще немає.',
  colService: 'Сервіс',
  colStatus: 'Зараз',
  waits: 'Чекає на згоду',
  waitsOff: 'Працює без запиту (згоду на cookie вимкнено)',
  runs: 'Працює для всіх',
  cookieless: 'Працює: не ставить cookie',
  missing: {
    one: 'Ще немає на {count} сторінці',
    few: 'Ще немає на {count} сторінках',
    many: 'Ще немає на {count} сторінках',
    other: 'Ще немає на {count} сторінки'
  },
  onPages: {
    one: 'На {count} сторінці',
    few: 'На {count} сторінках',
    many: 'На {count} сторінках',
    other: 'На {count} сторінки'
  },
  edit: 'Змінити',
  remove: 'Прибрати',
  removed: '{name} прибрано з усіх сторінок.',
  added: '{name} додано.',
  changed: '{name} змінено.',
  byHand:
    'Ваші сторінки вже завантажують {name}, доданий вручну (сторінок: {count}). Якщо додати його ще й тут, кожен візит рахуватиметься двічі: спершу приберіть вставлений код або залиште все як є.',

  addTitle: 'Додати сервіс',
  editTitle: 'Змінити {name}',
  service: 'Сервіс',
  chooseService: 'Виберіть сервіс…',
  groupAnalytics: 'Аналітика',
  groupMarketing: 'Реклама і маркетинг',
  groupCookieless: 'Аналітика без cookie',
  groupOther: 'Інше',
  add: 'Додати на кожну сторінку',
  save: 'Зберегти',
  cancel: 'Скасувати',
  categoryLabel: 'Що він робить',
  categoryHint: 'Визначає, яку згоду має дати відвідувач, перш ніж скрипт запуститься.',
  needsConsentOff:
    'У ЄС і Великій Британії {name} потребує згоди відвідувачів перед запуском, а згоду на cookie вимкнено.',
  alsoConsent: 'Також увімкнути згоду на cookie (рекомендовано)',
  needsConsentOn: 'Чекає на згоду: запускається лише для тих, хто дозволить {category}.',
  noConsentNeeded: '{name} не ставить cookie, тож працює без запиту. Банер не потрібен.',

  field_id: 'ID',
  field_domain: 'Домен',
  field_script: 'Адреса скрипта',
  field_name: 'Назва',
  field_code: 'Код',
  scriptHint: 'Лише якщо ви розміщуєте його самі. Порожнє поле: використовується скрипт сервісу.',
  domainHint: 'Як налаштовано в Plausible. Порожнє поле: адреса сайту.',
  nameHint: 'Як він показується тут і в списку згоди.',
  codeHint: 'Код, який дав сервіс. Додаються лише теги <script>; частина <noscript> пропускається.',
  hint_ga4:
    'Ідентифікатор показника з Google Analytics → Адміністратор → Потоки даних → ваш сайт. Починається з G-.',
  hint_gtm: 'Ідентифікатор контейнера, угорі в Tag Manager. Починається з GTM-.',
  'hint_meta-pixel': 'ID пікселя (цифри) з Meta Events Manager → Джерела даних.',
  hint_clarity: 'ID проєкту з Clarity → Settings → Overview.',
  hint_linkedin: 'Partner ID (цифри) з Campaign Manager → Analyze → Insight Tag.',
  hint_tiktok: 'ID пікселя з TikTok Ads Manager → Assets → Events → Web events.',
  hint_plausible: '',
  hint_umami: 'Website ID з Umami → Settings → Websites → Edit.',
  'hint_cloudflare-analytics':
    'Токен з Cloudflare → Analytics & Logs → Web Analytics → Manage site → токен у фрагменті коду.',
  hint_custom: '',

  excludedTitle: 'Сторінки без відстеження',
  excludedDescription:
    'Сторінку подяки чи приватну сторінку можна залишити без нього. Позначка стоїть у самій сторінці.',
  excludedNone: 'Він є на всіх сторінках.',
  excludePick: 'Залишити сторінку без нього…',
  exclude: 'Без відстеження',
  include: 'Повернути',
  excludedSet: '{path} тепер без відстеження.',
  includedSet: '{path} знову з відстеженням.',

  howTitle: 'Як це працює',
  howTags:
    'Кожен тег записується в <head> сторінки з позначкою сервісу, тож CraftPages може змінити чи прибрати його, не чіпаючи нічого іншого. ID зберігається в самому тегу.',
  howConsent:
    'Коли згоду на cookie ввімкнено, теги, яким вона потрібна, записуються вже в очікуванні: вони не запускаються, доки відвідувач не погодиться.',
  howPublish: 'Перед кожною публікацією теги отримують і сторінки, додані після цього.'
}

export default messages
