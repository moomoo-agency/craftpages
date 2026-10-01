import type { ScheduledRun } from './types'

/** One line about what the scheduler just did, for the in-app message and OS notifications. */
export function describeRun(run: ScheduledRun): string {
  const list = (items: string[]): string => items.join(', ')
  const changed = run.posts.length + run.released.length + run.ended.length > 0
  return [
    run.posts.length && `Now on the site: ${list(run.posts)}.`,
    run.released.length && `Scheduled changes live: ${list(run.released)}.`,
    run.ended.length && `Taken down as scheduled: ${list(run.ended)}.`,
    run.blocked.length &&
      `Held back (the page changed in the same place): ${list(run.blocked)}. See Publish.`,
    run.deployed && 'Deployed to production.',
    changed && !run.deployed && !run.error && 'Publish the site to put it online.',
    run.error
  ]
    .filter(Boolean)
    .join(' ')
}
