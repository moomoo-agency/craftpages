/**
 * Search icons for the trigger button: SVG bodies on a 24×24 grid, drawn with
 * `stroke="currentColor"`. From Lucide (https://lucide.dev), ISC licence.
 */
export const SEARCH_ICONS: Record<string, { label: string; body: string }> = {
  search: {
    label: 'Magnifier',
    body: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'
  },
  'text-search': {
    label: 'Lines',
    body: '<path d="M21 6H3"/><path d="M10 12H3"/><path d="M10 18H3"/><circle cx="17" cy="15" r="3"/><path d="m21 19-1.9-1.9"/>'
  },
  'scan-search': {
    label: 'Frame',
    body: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/><path d="m16 16-1.9-1.9"/>'
  },
  'search-circle': {
    label: 'Circle',
    body: '<circle cx="12" cy="12" r="10"/><circle cx="11" cy="11" r="4"/><path d="m16.5 16.5-2.6-2.6"/>'
  },
  'search-square': {
    label: 'Square',
    body: '<rect width="18" height="18" x="3" y="3" rx="4"/><circle cx="11" cy="11" r="3.5"/><path d="m16 16-2.5-2.5"/>'
  },
  command: {
    label: 'Command',
    body: '<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>'
  }
}
