/**
 * Features that are built but switched off for this release. Off means hidden in the
 * UI; the code, IPC handlers and any `.sitecms` data stay as they are.
 */
export const FEATURES = {
  /** Blog setup, posts (Gutenberg) and blog generation. */
  blog: false,
  /**
   * Publishing to Cloudflare Pages. Off: new projects publish as Workers (Cloudflare's
   * default) and Pages isn't offered; a project already set to Pages keeps working and
   * can switch to Workers.
   */
  pages: false,
  /**
   * Scheduling: the Schedule… button next to Save all, Publish → Scheduled changes and
   * App settings → Scheduled changes (background mode). Off: hidden; the scheduler still
   * runs, so anything already scheduled goes out as planned.
   */
  scheduling: false
} as const
