import search from './search.md?raw'

/**
 * How CraftPages features work, for the user's AI client (MCP get_guide).
 * App-wide, not per project: the AI reads one before adding a feature.
 */
export const GUIDES: Record<string, { title: string; summary: string; text: string }> = {
  search: {
    title: 'Site search',
    summary:
      'Add search to the site: the data-craftpages-search trigger attribute, the loader script and its options, what gets indexed, styling the box.',
    text: search
  }
}
