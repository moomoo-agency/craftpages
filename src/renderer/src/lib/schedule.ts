import type { Translator } from '../i18n'
import type { ScheduledRun } from '../../../shared/types'

/**
 * What the scheduler just did, in the app language. OS notifications use the English
 * `describeRun` in src/shared, since the main process has no translations.
 */
export function describeRun(run: ScheduledRun, t: Translator): string {
  const list = (items: string[]): string => items.join(', ')
  const changed = run.posts.length + run.released.length + run.ended.length > 0
  return [
    run.posts.length && t('schedule.runPosts', { items: list(run.posts) }),
    run.released.length && t('schedule.runReleased', { items: list(run.released) }),
    run.ended.length && t('schedule.runEnded', { items: list(run.ended) }),
    run.blocked.length && t('schedule.runBlocked', { items: list(run.blocked) }),
    run.deployed && t('schedule.runDeployed'),
    changed && !run.deployed && !run.error && t('schedule.runPublishHint'),
    run.error
  ]
    .filter(Boolean)
    .join(' ')
}
