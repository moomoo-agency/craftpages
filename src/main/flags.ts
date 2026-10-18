/**
 * Flags for the language switcher, drawn for small sizes: 3:2 (30×20), simplified the way
 * flag icons usually are (no coats of arms where the colors alone tell the flag apart).
 * Written to the site as files when a switcher shows them, so pages carry an <img>, not the SVG.
 */

const W = 30
const H = 20

const svg = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>`

/** Equal stripes across (top to bottom) or down (left to right). */
const across = (...colors: string[]): string =>
  colors
    .map(
      (color, i) =>
        `<rect y="${(H / colors.length) * i}" width="${W}" height="${H / colors.length + 0.01}" fill="${color}"/>`
    )
    .join('')
const down = (...colors: string[]): string =>
  colors
    .map(
      (color, i) =>
        `<rect x="${(W / colors.length) * i}" width="${W / colors.length + 0.01}" height="${H}" fill="${color}"/>`
    )
    .join('')

/** A five-pointed star centred on (cx, cy). */
function star(cx: number, cy: number, r: number, color: string, turn = 0): string {
  const points: string[] = []
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 ? r * 0.382 : r
    const angle = (Math.PI / 5) * i - Math.PI / 2 + turn
    points.push(
      `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`
    )
  }
  return `<polygon points="${points.join(' ')}" fill="${color}"/>`
}

/** A Nordic cross: the upright set towards the hoist. */
const nordic = (field: string, cross: string, inner?: string): string =>
  `<rect width="${W}" height="${H}" fill="${field}"/>` +
  `<rect x="8" width="5" height="${H}" fill="${cross}"/><rect y="7.5" width="${W}" height="5" fill="${cross}"/>` +
  (inner
    ? `<rect x="9.25" width="2.5" height="${H}" fill="${inner}"/><rect y="8.75" width="${W}" height="2.5" fill="${inner}"/>`
    : '')

/** The usual construction (60×30, counterchanged red saltire), stretched to 3:2 like the rest. */
const UNION_JACK =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" width="${W}" height="${H}" preserveAspectRatio="none">` +
  `<clipPath id="t"><path d="M30,15h30v15zv15h-30zh-30v-15zv-15h30z"/></clipPath>` +
  `<path d="M0,0v30h60v-30z" fill="#012169"/>` +
  `<path d="M0,0L60,30M60,0L0,30" stroke="#fff" stroke-width="6"/>` +
  `<path d="M0,0L60,30M60,0L0,30" clip-path="url(#t)" stroke="#C8102E" stroke-width="4"/>` +
  `<path d="M30,0v30M0,15h60" stroke="#fff" stroke-width="10"/>` +
  `<path d="M30,0v30M0,15h60" stroke="#C8102E" stroke-width="6"/></svg>`

function stars(cols: number, rows: number, x0: number, y0: number, dx: number, dy: number): string {
  let out = ''
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++)
      out += star(x0 + col * dx + (row % 2 ? dx / 2 : 0), y0 + row * dy, 0.55, '#fff')
  return out
}

export const FLAGS: Record<string, { name: string; svg: string }> = {
  at: { name: 'Austria', svg: svg(across('#C8102E', '#fff', '#C8102E')) },
  be: { name: 'Belgium', svg: svg(down('#000', '#FDDA24', '#EF3340')) },
  bg: { name: 'Bulgaria', svg: svg(across('#fff', '#00966E', '#D62612')) },
  br: {
    name: 'Brazil',
    svg: svg(
      `<rect width="30" height="20" fill="#009C3B"/><path d="M15 2.5L27.5 10L15 17.5L2.5 10Z" fill="#FFDF00"/>` +
        `<circle cx="15" cy="10" r="4.6" fill="#002776"/><path d="M10.6 9.2Q15 8.2 19.4 11" stroke="#fff" stroke-width="0.8" fill="none"/>`
    )
  },
  ca: {
    name: 'Canada',
    svg: svg(
      `<rect width="30" height="20" fill="#fff"/><rect width="7.5" height="20" fill="#D80621"/><rect x="22.5" width="7.5" height="20" fill="#D80621"/>` +
        `<path d="M15 4.2l1 2 1.6-.6-.5 3 1.9-1.6.4 1.1 1.9-.3-.8 2 .9.5-3 2.2.3 1h-3.2v2.3h-1v-2.3h-3.2l.3-1-3-2.2.9-.5-.8-2 1.9.3.4-1.1 1.9 1.6-.5-3 1.6.6z" fill="#D80621"/>`
    )
  },
  catalonia: {
    name: 'Catalonia',
    svg: svg(
      `<rect width="30" height="20" fill="#FCDD09"/>` +
        [0, 1, 2, 3]
          .map((i) => `<rect y="${2.22 + i * 4.44}" width="30" height="2.22" fill="#DA121A"/>`)
          .join('')
    )
  },
  ch: {
    name: 'Switzerland',
    svg: svg(
      `<rect width="30" height="20" fill="#DA291C"/><path d="M13.5 4h3v4.5h4.5v3h-4.5v4.5h-3v-4.5h-4.5v-3h4.5z" fill="#fff"/>`
    )
  },
  cn: {
    name: 'China',
    svg: svg(
      `<rect width="30" height="20" fill="#EE1C25"/>` +
        star(5, 5, 3, '#FFFF00') +
        star(10, 2, 1, '#FFFF00', 0.4) +
        star(12, 4, 1, '#FFFF00', 0.8) +
        star(12, 7, 1, '#FFFF00', -0.2) +
        star(10, 9, 1, '#FFFF00', 0.3)
    )
  },
  cz: {
    name: 'Czechia',
    svg: svg(`${across('#fff', '#D7141A')}<path d="M0 0L15 10L0 20Z" fill="#11457E"/>`)
  },
  de: { name: 'Germany', svg: svg(across('#000', '#DD0000', '#FFCE00')) },
  dk: { name: 'Denmark', svg: svg(nordic('#C8102E', '#fff')) },
  ee: { name: 'Estonia', svg: svg(across('#0072CE', '#000', '#fff')) },
  es: {
    name: 'Spain',
    svg: svg(
      `<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>`
    )
  },
  eu: {
    name: 'European Union',
    svg: svg(
      `<rect width="30" height="20" fill="#003399"/>` +
        Array.from({ length: 12 }, (_, i) =>
          star(
            15 + 6 * Math.cos((Math.PI / 6) * i),
            10 + 6 * Math.sin((Math.PI / 6) * i),
            0.9,
            '#FFCC00'
          )
        ).join('')
    )
  },
  fi: { name: 'Finland', svg: svg(nordic('#fff', '#002F6C')) },
  fr: { name: 'France', svg: svg(down('#0055A4', '#fff', '#EF4135')) },
  gb: { name: 'United Kingdom', svg: UNION_JACK },
  ge: {
    name: 'Georgia',
    svg: svg(
      `<rect width="30" height="20" fill="#fff"/><rect x="13" width="4" height="20" fill="#FF0000"/><rect y="8" width="30" height="4" fill="#FF0000"/>` +
        [
          [6.5, 4],
          [23.5, 4],
          [6.5, 16],
          [23.5, 16]
        ]
          .map(
            ([x, y]) =>
              `<rect x="${x - 0.5}" y="${y - 2}" width="1" height="4" fill="#FF0000"/><rect x="${x - 2}" y="${y - 0.5}" width="4" height="1" fill="#FF0000"/>`
          )
          .join('')
    )
  },
  gr: {
    name: 'Greece',
    svg: svg(
      Array.from(
        { length: 9 },
        (_, i) =>
          `<rect y="${(20 / 9) * i}" width="30" height="${20 / 9 + 0.01}" fill="${i % 2 ? '#fff' : '#0D5EAF'}"/>`
      ).join('') +
        `<rect width="11.11" height="11.11" fill="#0D5EAF"/><rect x="4.44" width="2.22" height="11.11" fill="#fff"/><rect y="4.44" width="11.11" height="2.22" fill="#fff"/>`
    )
  },
  hr: {
    name: 'Croatia',
    svg: svg(
      across('#FF0000', '#fff', '#171796') +
        `<path d="M12 5h6v6.5a3 3 0 0 1-6 0z" fill="#fff" stroke="#FF0000" stroke-width="0.4"/>` +
        [0, 1, 2]
          .flatMap((r) =>
            [0, 1, 2].map((c) =>
              (r + c) % 2
                ? ''
                : `<rect x="${12 + c * 2}" y="${5 + r * 2}" width="2" height="2" fill="#FF0000"/>`
            )
          )
          .join('')
    )
  },
  hu: { name: 'Hungary', svg: svg(across('#CD2A3E', '#fff', '#436F4D')) },
  id: { name: 'Indonesia', svg: svg(across('#FF0000', '#fff')) },
  ie: { name: 'Ireland', svg: svg(down('#169B62', '#fff', '#FF883E')) },
  il: {
    name: 'Israel',
    svg: svg(
      `<rect width="30" height="20" fill="#fff"/><rect y="2" width="30" height="3" fill="#0038B8"/><rect y="15" width="30" height="3" fill="#0038B8"/>` +
        `<path d="M15 6.6L18 11.8H12Z M15 13.4L12 8.2H18Z" fill="none" stroke="#0038B8" stroke-width="0.8"/>`
    )
  },
  in: {
    name: 'India',
    svg: svg(
      across('#FF9933', '#fff', '#138808') +
        `<circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" stroke-width="0.6"/><circle cx="15" cy="10" r="0.6" fill="#000080"/>`
    )
  },
  it: { name: 'Italy', svg: svg(down('#009246', '#fff', '#CE2B37')) },
  jp: {
    name: 'Japan',
    svg: svg(
      `<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/>`
    )
  },
  kr: {
    name: 'South Korea',
    svg: svg(
      `<rect width="30" height="20" fill="#fff"/>` +
        `<path d="M15 5a5 5 0 0 1 0 10a2.5 2.5 0 0 1 0-5a2.5 2.5 0 0 0 0-5z" fill="#CD2E3A" transform="rotate(-34 15 10)"/>` +
        `<path d="M15 15a5 5 0 0 1 0-10a2.5 2.5 0 0 1 0 5a2.5 2.5 0 0 0 0 5z" fill="#0047A0" transform="rotate(-34 15 10)"/>` +
        [
          [6, 4, 56],
          [24, 4, -56],
          [6, 16, -56],
          [24, 16, 56]
        ]
          .map(
            ([x, y, angle]) =>
              `<g transform="rotate(${angle} ${x} ${y})">` +
              [-1.2, 0, 1.2]
                .map(
                  (dy) =>
                    `<rect x="${x - 2}" y="${y + dy - 0.4}" width="4" height="0.8" fill="#000"/>`
                )
                .join('') +
              '</g>'
          )
          .join('')
    )
  },
  kz: {
    name: 'Kazakhstan',
    svg: svg(
      `<rect width="30" height="20" fill="#00AFCA"/><circle cx="15" cy="8.5" r="3.2" fill="#FEC50C"/>` +
        `<path d="M10.5 13.5Q15 16.5 19.5 13.5" stroke="#FEC50C" stroke-width="1" fill="none"/><rect x="2" y="2" width="1.2" height="16" fill="#FEC50C"/>`
    )
  },
  lt: { name: 'Lithuania', svg: svg(across('#FDB913', '#006A44', '#C1272D')) },
  lv: {
    name: 'Latvia',
    svg: svg(
      `<rect width="30" height="20" fill="#9E3039"/><rect y="8" width="30" height="4" fill="#fff"/>`
    )
  },
  mx: {
    name: 'Mexico',
    svg: svg(
      down('#006847', '#fff', '#CE1126') +
        `<circle cx="15" cy="10" r="2.4" fill="none" stroke="#8C5A2B" stroke-width="0.9"/>`
    )
  },
  nl: { name: 'Netherlands', svg: svg(across('#AE1C28', '#fff', '#21468B')) },
  no: { name: 'Norway', svg: svg(nordic('#BA0C2F', '#fff', '#00205B')) },
  pl: { name: 'Poland', svg: svg(across('#fff', '#DC143C')) },
  pt: {
    name: 'Portugal',
    svg: svg(
      `<rect width="30" height="20" fill="#FF0000"/><rect width="12" height="20" fill="#006600"/>` +
        `<circle cx="12" cy="10" r="3.6" fill="none" stroke="#FFE900" stroke-width="1"/><path d="M10.5 8h3v3a1.5 1.5 0 0 1-3 0z" fill="#FF0000" stroke="#fff" stroke-width="0.4"/>`
    )
  },
  ro: { name: 'Romania', svg: svg(down('#002B7F', '#FCD116', '#CE1126')) },
  rs: {
    name: 'Serbia',
    svg: svg(
      across('#C6363C', '#0C4076', '#fff') +
        `<path d="M8 4.5h4.5v5a2.25 2.25 0 0 1-4.5 0z" fill="#C6363C" stroke="#EDB92E" stroke-width="0.5"/><path d="M10.25 5.5v5M8.6 7.6h3.3" stroke="#fff" stroke-width="0.7"/>`
    )
  },
  ru: { name: 'Russia', svg: svg(across('#fff', '#0039A6', '#D52B1E')) },
  sa: {
    name: 'Saudi Arabia',
    svg: svg(
      `<rect width="30" height="20" fill="#006C35"/><path d="M8 8.5h14M9 10h12" stroke="#fff" stroke-width="0.9"/><path d="M8.5 13.5h12.5l1.2-.8" stroke="#fff" stroke-width="0.8" fill="none"/>`
    )
  },
  se: { name: 'Sweden', svg: svg(nordic('#006AA7', '#FECC00')) },
  si: {
    name: 'Slovenia',
    svg: svg(
      across('#fff', '#0000FF', '#FF0000') +
        `<path d="M6 3.5h5v5a2.5 2.5 0 0 1-5 0z" fill="#0000FF" stroke="#FF0000" stroke-width="0.4"/><path d="M6.6 9l1.9-2.6 1.9 2.6" fill="#fff"/>`
    )
  },
  sk: {
    name: 'Slovakia',
    svg: svg(
      across('#fff', '#0B4EA2', '#EE1C25') +
        `<path d="M6.5 4h6.5v6a3.25 3.25 0 0 1-6.5 0z" fill="#EE1C25" stroke="#fff" stroke-width="0.6"/>` +
        `<path d="M9.75 5.2v6.2M8.2 7h3.1M7.7 8.8h4.1" stroke="#fff" stroke-width="0.8"/><path d="M6.8 12.2Q9.75 10.5 12.7 12.2" stroke="#0B4EA2" stroke-width="1.1" fill="none"/>`
    )
  },
  th: {
    name: 'Thailand',
    svg: svg(
      `<rect width="30" height="20" fill="#A51931"/><rect y="3.33" width="30" height="13.34" fill="#F4F5F8"/><rect y="6.67" width="30" height="6.66" fill="#2D2A4A"/>`
    )
  },
  tr: {
    name: 'Türkiye',
    svg: svg(
      `<rect width="30" height="20" fill="#E30A17"/><circle cx="11" cy="10" r="5" fill="#fff"/><circle cx="12.25" cy="10" r="4" fill="#E30A17"/>` +
        star(17.6, 10, 2.2, '#fff', -Math.PI / 2 + Math.PI / 2)
    )
  },
  tw: {
    name: 'Taiwan',
    svg: svg(
      `<rect width="30" height="20" fill="#FE0000"/><rect width="15" height="10" fill="#000095"/><circle cx="7.5" cy="5" r="2.6" fill="#fff"/><circle cx="7.5" cy="5" r="1.7" fill="#000095"/><circle cx="7.5" cy="5" r="1.4" fill="#fff"/>`
    )
  },
  ua: { name: 'Ukraine', svg: svg(across('#0057B7', '#FFD700')) },
  us: {
    name: 'United States',
    svg: svg(
      Array.from(
        { length: 13 },
        (_, i) =>
          `<rect y="${(20 / 13) * i}" width="30" height="${20 / 13 + 0.01}" fill="${i % 2 ? '#fff' : '#B22234'}"/>`
      ).join('') +
        `<rect width="12" height="10.77" fill="#3C3B6E"/>` +
        stars(5, 4, 1.4, 1.5, 2.2, 2.6)
    )
  },
  vn: {
    name: 'Vietnam',
    svg: svg(`<rect width="30" height="20" fill="#DA251D"/>${star(15, 10.4, 5, '#FFFF00')}`)
  }
}

/** The flag a language shows unless one is chosen: by region, else the language's usual one. */
const BY_LANGUAGE: Record<string, string> = {
  ar: 'sa',
  bg: 'bg',
  ca: 'catalonia',
  cs: 'cz',
  da: 'dk',
  de: 'de',
  el: 'gr',
  en: 'gb',
  es: 'es',
  et: 'ee',
  fi: 'fi',
  fr: 'fr',
  he: 'il',
  hi: 'in',
  hr: 'hr',
  hu: 'hu',
  id: 'id',
  it: 'it',
  ja: 'jp',
  ka: 'ge',
  kk: 'kz',
  ko: 'kr',
  lt: 'lt',
  lv: 'lv',
  nb: 'no',
  nl: 'nl',
  nn: 'no',
  no: 'no',
  pl: 'pl',
  pt: 'pt',
  ro: 'ro',
  ru: 'ru',
  sk: 'sk',
  sl: 'si',
  sr: 'rs',
  sv: 'se',
  th: 'th',
  tr: 'tr',
  uk: 'ua',
  vi: 'vn',
  zh: 'cn',
  'zh-hant': 'tw'
}

export function defaultFlag(code: string): string | null {
  const lower = code.toLowerCase()
  if (BY_LANGUAGE[lower]) return BY_LANGUAGE[lower]
  const region = lower.split('-')[1]
  if (region && FLAGS[region]) return region
  return BY_LANGUAGE[lower.split('-')[0]] ?? null
}
