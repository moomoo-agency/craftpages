import { useT, type Key } from '../i18n'
import type { PostStatus } from '../../../shared/types'

/** Draft / Scheduled (published with a future date) / Published. */
export default function StatusPill({
  status,
  scheduled
}: {
  status: PostStatus
  scheduled: boolean
}): React.JSX.Element {
  const t = useT()
  const [tone, label]: [string, Key] =
    status === 'draft'
      ? ['pending', 'post.statusDraft']
      : scheduled
        ? ['scheduled', 'post.statusScheduled']
        : ['accepted', 'post.statusPublished']
  return <span className={`pill pill--${tone}`}>{t(label)}</span>
}
