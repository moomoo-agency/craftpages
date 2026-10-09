import { useEffect, useRef, useState } from 'react'
import { Explainer, Notice } from '../components/Field'
import { errorMessage } from '../lib/api'
import { useT, type Key } from '../i18n'
import type {
  CardFields,
  ElementLocator,
  LatestLayout,
  ListLayout,
  PickedElement,
  PointSession,
  PostLayout
} from '../../../shared/types'

type StepId =
  | 'regions'
  | 'title'
  | 'date'
  | 'image'
  | 'container'
  | 'card'
  | 'card-title'
  | 'card-date'
  | 'card-excerpt'
  | 'card-image'
  | 'card-link'
  | 'card-category'
  | 'card-tags'
  | 'card-author'
  | 'pagination'
  | 'tags'
  | 'category'
  | 'author'
  | 'heading'
  | 'remove'

interface Step {
  id: StepId
  label: Key
  prompt: Key
  help: Key
  optional: boolean
  multiple?: boolean
  /** Picks must be inside this earlier step's pick. */
  within?: StepId
  needsImage?: boolean
  skipLabel?: Key
  /** Tags or a category: the panel says how the pick will repeat. */
  badges?: boolean
}

const POST_STEPS: Step[] = [
  {
    id: 'regions',
    label: 'blog.regions',
    prompt: 'blog.regionsPrompt',
    help: 'blog.regionsHelp',
    optional: false,
    multiple: true
  },
  {
    id: 'title',
    label: 'blog.title',
    prompt: 'blog.titlePrompt',
    help: 'blog.titleHelp',
    optional: true,
    skipLabel: 'blog.titleSkip'
  },
  {
    id: 'date',
    label: 'blog.date',
    prompt: 'blog.datePrompt',
    help: 'blog.dateHelp',
    optional: true,
    skipLabel: 'blog.dateSkip'
  },
  {
    id: 'image',
    label: 'blog.image',
    prompt: 'blog.imagePrompt',
    help: 'blog.imageHelp',
    optional: true,
    needsImage: true,
    skipLabel: 'blog.imageSkip'
  },
  {
    id: 'category',
    label: 'blog.category',
    prompt: 'blog.categoryPrompt',
    help: 'blog.categoryHelp',
    optional: true,
    skipLabel: 'blog.categorySkip',
    badges: true
  },
  {
    id: 'tags',
    label: 'blog.tags',
    prompt: 'blog.tagsPrompt',
    help: 'blog.tagsHelp',
    optional: true,
    skipLabel: 'blog.tagsSkip',
    badges: true
  },
  {
    id: 'author',
    label: 'blog.author',
    prompt: 'blog.authorPrompt',
    help: 'blog.authorHelp',
    optional: true,
    multiple: true,
    skipLabel: 'blog.authorSkip'
  },
  {
    id: 'remove',
    label: 'blog.remove',
    prompt: 'blog.removePrompt',
    help: 'blog.removeHelp',
    optional: true,
    multiple: true,
    skipLabel: 'blog.removeSkip'
  }
]

const LIST_STEPS: Step[] = [
  {
    id: 'container',
    label: 'blog.container',
    prompt: 'blog.containerPrompt',
    help: 'blog.containerHelp',
    optional: false
  },
  {
    id: 'card',
    label: 'blog.card',
    prompt: 'blog.cardPrompt',
    help: 'blog.cardHelp',
    optional: true,
    within: 'container',
    skipLabel: 'blog.cardSkip'
  },
  {
    id: 'card-title',
    label: 'blog.cardTitle',
    prompt: 'blog.cardTitlePrompt',
    help: 'blog.cardTitleHelp',
    optional: true,
    within: 'card'
  },
  {
    id: 'card-date',
    label: 'blog.cardDate',
    prompt: 'blog.cardDatePrompt',
    help: 'blog.cardDateHelp',
    optional: true,
    within: 'card'
  },
  {
    id: 'card-excerpt',
    label: 'blog.cardExcerpt',
    prompt: 'blog.cardExcerptPrompt',
    help: 'blog.cardExcerptHelp',
    optional: true,
    within: 'card'
  },
  {
    id: 'card-image',
    label: 'blog.cardImage',
    prompt: 'blog.cardImagePrompt',
    help: 'blog.cardImageHelp',
    optional: true,
    within: 'card',
    needsImage: true
  },
  {
    id: 'card-link',
    label: 'blog.cardLink',
    prompt: 'blog.cardLinkPrompt',
    help: 'blog.cardLinkHelp',
    optional: true,
    multiple: true,
    within: 'card'
  },
  {
    id: 'card-category',
    label: 'blog.cardCategory',
    prompt: 'blog.cardCategoryPrompt',
    help: 'blog.cardCategoryHelp',
    optional: true,
    within: 'card',
    badges: true
  },
  {
    id: 'card-tags',
    label: 'blog.cardTags',
    prompt: 'blog.cardTagsPrompt',
    help: 'blog.cardTagsHelp',
    optional: true,
    within: 'card',
    badges: true
  },
  {
    id: 'card-author',
    label: 'blog.cardAuthor',
    prompt: 'blog.cardAuthorPrompt',
    help: 'blog.cardAuthorHelp',
    optional: true,
    within: 'card'
  },
  {
    id: 'pagination',
    label: 'blog.pagination',
    prompt: 'blog.paginationPrompt',
    help: 'blog.paginationHelp',
    optional: true,
    skipLabel: 'blog.paginationSkip'
  },
  {
    id: 'heading',
    label: 'blog.heading',
    prompt: 'blog.headingPrompt',
    help: 'blog.headingHelp',
    optional: true,
    skipLabel: 'blog.headingSkip'
  },
  {
    id: 'remove',
    label: 'blog.remove',
    prompt: 'blog.removePrompt',
    help: 'blog.removeHelp',
    optional: true,
    multiple: true,
    skipLabel: 'blog.removeSkip'
  }
]

/** A "latest posts" block on an existing page: just the area and (optionally) its card. */
const LATEST_STEPS: Step[] = LIST_STEPS.filter((step) =>
  [
    'container',
    'card',
    'card-title',
    'card-date',
    'card-excerpt',
    'card-image',
    'card-link',
    'card-category',
    'card-tags',
    'card-author'
  ].includes(step.id)
).map((step) =>
  step.id === 'container'
    ? {
        ...step,
        label: 'blog.latestArea',
        prompt: 'blog.latestAreaPrompt',
        help: 'blog.latestAreaHelp'
      }
    : step
)

type LatestParts = Pick<LatestLayout, 'container' | 'card'>

const CARD_FIELD: Partial<Record<StepId, keyof CardFields>> = {
  'card-title': 'title',
  'card-date': 'date',
  'card-excerpt': 'excerpt',
  'card-image': 'image',
  'card-link': 'link',
  'card-category': 'category',
  'card-tags': 'tags',
  'card-author': 'author'
}

interface Props {
  kind: 'post' | 'list' | 'latest'
  page: string
  postLayout?: PostLayout | null
  listLayout?: ListLayout | null
  latest?: LatestParts | null
  onSave: (layout: {
    postLayout?: PostLayout
    listLayout?: ListLayout
    latest?: LatestParts
  }) => Promise<void>
  onCancel: () => void
}

type Picks = Partial<Record<StepId, PickedElement[]>>

/** Pointing mode: the layout page with a crosshair; the panel asks for one part at a time. */
export default function LayoutPointer({
  kind,
  page,
  postLayout,
  listLayout,
  latest,
  onSave,
  onCancel
}: Props): React.JSX.Element {
  const t = useT()
  const frame = useRef<HTMLIFrameElement>(null)
  const [session, setSession] = useState<PointSession | null>(null)
  const [picks, setPicks] = useState<Picks>({})
  const [index, setIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [keepOnly, setKeepOnly] = useState(
    (kind === 'post' ? postLayout?.keepOnly : listLayout?.keepOnly) ?? true
  )

  const allSteps = kind === 'post' ? POST_STEPS : kind === 'list' ? LIST_STEPS : LATEST_STEPS
  // The card-based layout being adjusted (list page or latest-posts block).
  const cardLayout = kind === 'list' ? listLayout : kind === 'latest' ? latest : null
  // Card field steps only apply when a card was picked.
  const steps = allSteps.filter((step) => !step.id.startsWith('card-') || picks.card?.length)
  const step = steps[Math.min(index, steps.length - 1)]

  // Start the session and bring back what was pointed at before.
  useEffect(() => {
    let cancelled = false
    const start = async (): Promise<void> => {
      const next = await window.api.startPointing(page)
      if (cancelled) return
      const saved: [StepId, ElementLocator][] =
        kind === 'post'
          ? [
              ...(postLayout?.regions ?? []).map((r): [StepId, ElementLocator] => ['regions', r]),
              ...(['title', 'date', 'image', 'category', 'tags'] as const)
                .filter((id) => postLayout?.[id])
                .map((id): [StepId, ElementLocator] => [id, postLayout![id]!]),
              ...(postLayout?.author ?? []).map((l): [StepId, ElementLocator] => ['author', l])
            ]
          : [
              ...(cardLayout?.container
                ? [['container', cardLayout.container] as [StepId, ElementLocator]]
                : []),
              ...(cardLayout?.card
                ? [['card', cardLayout.card.element] as [StepId, ElementLocator]]
                : []),
              ...(kind === 'list' && listLayout?.pagination
                ? [['pagination', listLayout.pagination] as [StepId, ElementLocator]]
                : []),
              ...(kind === 'list' && listLayout?.heading
                ? [['heading', listLayout.heading] as [StepId, ElementLocator]]
                : [])
            ]
      const removed =
        (kind === 'post' ? postLayout?.remove : kind === 'list' ? listLayout?.remove : []) ?? []
      saved.push(...removed.map((l): [StepId, ElementLocator] => ['remove', l]))
      const numbers = await window.api.resolveLocators(
        next.key,
        saved.map(([, l]) => l)
      )
      const restored: Picks = {}
      for (let i = 0; i < saved.length; i++) {
        const n = numbers[i]
        if (n === null) continue
        const picked = await window.api.pointAt(next.key, n)
        restored[saved[i][0]] = [...(restored[saved[i][0]] ?? []), picked]
      }
      // The card's parts are saved as paths inside the card.
      const card = restored.card?.[0]
      const fields = cardLayout?.card?.fields
      if (card && fields) {
        const parts: [StepId, number[]][] = []
        for (const [id, field] of Object.entries(CARD_FIELD) as [StepId, keyof CardFields][]) {
          if (field === 'link') {
            const links = fields.links?.length ? fields.links : fields.link ? [fields.link] : []
            parts.push(...links.map((path): [StepId, number[]] => [id, path]))
          } else {
            const path = fields[field] as number[] | null | undefined
            if (path) parts.push([id, path])
          }
        }
        const within = await window.api.numbersWithin(
          next.key,
          card.n,
          parts.map(([, path]) => path)
        )
        for (let i = 0; i < parts.length; i++) {
          const n = within[i]
          if (n === null) continue
          const picked = await window.api.pointAt(next.key, n)
          restored[parts[i][0]] = [...(restored[parts[i][0]] ?? []), picked]
        }
      }
      if (cancelled) return
      setPicks(restored)
      setSession(next)
    }
    start().catch((e) => setError(errorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [page, kind]) // eslint-disable-line react-hooks/exhaustive-deps

  const post = (message: Record<string, unknown>): void =>
    frame.current?.contentWindow?.postMessage({ target: 'sitecms', ...message }, '*')

  // Draw what's picked, and limit clicks to the card / list area when a step asks for it.
  const sync = (): void => {
    const marks = steps.flatMap((s) =>
      (picks[s.id] ?? []).map((p, i) => ({
        n: p.n,
        label: s.multiple ? t('blog.markNumbered', { label: t(s.label), n: i + 1 }) : t(s.label),
        tone: s.id === step.within ? 'scope' : 'done'
      }))
    )
    post({ type: 'marks', marks })
    post({ type: 'scope', n: step.within ? (picks[step.within]?.[0]?.n ?? null) : null })
  }
  const syncRef = useRef(sync)
  useEffect(() => {
    syncRef.current = sync
    sync()
  })

  const stepRef = useRef(step)
  const picksRef = useRef(picks)
  useEffect(() => {
    stepRef.current = step
    picksRef.current = picks
  })

  const choose = async (n: number): Promise<void> => {
    if (!session) return
    const current = stepRef.current
    try {
      const picked = await window.api.pointAt(session.key, n)
      if (current.needsImage && !picked.hasImage) {
        setError(t('blog.noImage'))
        return
      }
      setError(null)
      setPicks((all) => {
        const next = { ...all }
        next[current.id] = current.multiple ? [...(all[current.id] ?? []), picked] : [picked]
        // A new card invalidates the card's fields.
        if (current.id === 'card')
          for (const id of Object.keys(CARD_FIELD)) delete next[id as StepId]
        return next
      })
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (event.source !== frame.current?.contentWindow) return
      const data = event.data as { source?: string; type?: string; n?: number }
      if (data?.source !== 'sitecms') return
      if (data.type === 'ready') syncRef.current()
      if (data.type === 'picked' && typeof data.n === 'number') choose(data.n)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  })

  const widen = async (at: number): Promise<void> => {
    const current = picks[step.id]?.[at]
    if (!session || current?.parent == null) return
    const parent = await window.api.pointAt(session.key, current.parent)
    setPicks((all) => ({
      ...all,
      [step.id]: (all[step.id] ?? []).map((p, i) => (i === at ? parent : p))
    }))
  }

  const remove = (at: number): void =>
    setPicks((all) => ({ ...all, [step.id]: (all[step.id] ?? []).filter((_, i) => i !== at) }))

  const save = async (): Promise<void> => {
    if (!session) return
    setSaving(true)
    try {
      const one = (id: StepId): ElementLocator | null => picks[id]?.[0]?.locator ?? null
      if (kind === 'post') {
        await onSave({
          postLayout: {
            regions: (picks.regions ?? []).map((p) => p.locator),
            title: one('title'),
            date: one('date'),
            image: one('image'),
            category: one('category'),
            tags: one('tags'),
            author: (picks.author ?? []).map((p) => p.locator),
            keepOnly,
            remove: (picks.remove ?? []).map((p) => p.locator)
          }
        })
      } else {
        const card = picks.card?.[0]
        const fields: CardFields = {}
        if (card) {
          // The saved parts are brought back as picks when the pointer opens, so the picks
          // are the whole card: a part taken off here is gone from the layout too.
          for (const [id, field] of Object.entries(CARD_FIELD) as [StepId, keyof CardFields][]) {
            const paths = (
              await Promise.all(
                (picks[id] ?? []).map((pick) => window.api.pathWithin(session.key, card.n, pick.n))
              )
            ).filter((path): path is number[] => Boolean(path))
            if (!paths.length) continue
            if (field === 'link') {
              fields.links = paths
              fields.link = paths[0]
            } else {
              ;(fields as Record<string, number[]>)[field] = paths[0]
            }
          }
        }
        const parts = {
          container: one('container')!,
          card: card ? { element: card.locator, fields } : null
        }
        if (kind === 'latest') {
          await onSave({ latest: parts })
        } else {
          await onSave({
            listLayout: {
              ...parts,
              pagination: one('pagination'),
              heading: one('heading'),
              keepOnly,
              remove: (picks.remove ?? []).map((p) => p.locator)
            }
          })
        }
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const current = picks[step.id] ?? []
  const requiredDone = steps.every((s) => s.optional || (picks[s.id]?.length ?? 0) > 0)
  const last = index >= steps.length - 1

  const kindLabel =
    kind === 'post'
      ? t('blog.postLayout')
      : kind === 'list'
        ? t('blog.listLayout')
        : t('blog.latestLayout')

  return (
    <div className="pointer">
      <div className="pointer__stage">
        {session ? (
          <iframe
            ref={frame}
            src={session.url}
            title={t('blog.layoutFrame', { page })}
            sandbox="allow-scripts"
          />
        ) : (
          <p className="muted" role="status">
            {t('blog.opening', { page })}
          </p>
        )}
      </div>

      <aside className="pointer__panel" aria-label={kindLabel}>
        <header>
          <span className="pointer__kind">
            <span className="small">{kindLabel}</span>
            <span className="mono small">{page}</span>
          </span>
          <button className="btn btn--small btn--ghost" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        </header>

        <ol className="pointer__steps" aria-label={t('blog.pointSteps')}>
          {steps.map((s, i) => {
            const done = Boolean(picks[s.id]?.length)
            return (
              <li
                key={s.id}
                className={`${i === index ? 'is-current' : ''} ${done ? 'is-done' : ''}`}
              >
                <button
                  className="link"
                  aria-current={i === index ? 'step' : undefined}
                  onClick={() => setIndex(i)}
                >
                  {t(s.label)}
                  {done && <span className="visually-hidden"> ({t('blog.stepDone')})</span>}
                </button>
                {!s.optional && <span className="muted small"> · {t('common.required')}</span>}
              </li>
            )
          })}
        </ol>

        <div aria-live="polite">
          <div className="pointer__prompt">
            <strong>{t(step.prompt)}</strong>
          </div>
          <Explainer>{t(step.help)}</Explainer>
        </div>

        {current.map((pick, i) => (
          <div key={`${pick.n}-${i}`} className="pointer__pick">
            <span className="mono small">
              {step.multiple ? `${i + 1}. ` : ''}
              {pick.locator.hint}
              {step.badges && (
                <span className="pointer__pick-note">
                  {pick.badges > 1
                    ? t('blog.badgesGroup', { count: pick.badges })
                    : t(step.id.endsWith('category') ? 'blog.badgeOneCategory' : 'blog.badgeOne')}
                </span>
              )}
            </span>
            <span className="pointer__pick-actions">
              <button
                className="btn btn--small"
                disabled={pick.parent == null}
                onClick={() => widen(i)}
                title={t('blog.widerHint')}
              >
                {t('blog.wider')}
              </button>
              <button
                className="btn btn--small btn--danger-outline"
                onClick={() => remove(i)}
                aria-label={t('blog.removePick', { part: pick.locator.hint })}
              >
                {t('common.remove')}
              </button>
            </span>
          </div>
        ))}
        {step.multiple && current.length > 0 && (
          <p className="muted small">{t('blog.addAnother', { n: current.length + 1 })}</p>
        )}
        {error && (
          <div role="alert">
            <Notice kind="error">{error}</Notice>
          </div>
        )}

        {kind !== 'latest' && (
          <label className="check pointer__keep">
            <input
              type="checkbox"
              checked={keepOnly}
              onChange={(e) => setKeepOnly(e.target.checked)}
            />
            <span>
              {t('blog.keepOnly')}
              <small className="muted">{t('blog.keepOnlyHint', { page })}</small>
            </span>
          </label>
        )}

        <footer className="pointer__nav">
          {!requiredDone && <p className="muted small">{t('blog.saveHintRequired')}</p>}
          <div className="pointer__nav-buttons">
            <button className="btn" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              {t('common.back')}
            </button>
            {!last && current.length === 0 && step.optional && (
              <button className="btn" onClick={() => setIndex(index + 1)}>
                {step.skipLabel ? t(step.skipLabel) : t('blog.skip')}
              </button>
            )}
            {!last && current.length > 0 && (
              <button className="btn btn--primary" onClick={() => setIndex(index + 1)}>
                {t('common.next')}
              </button>
            )}
            <button
              className={`btn${last ? ' btn--primary' : ''}`}
              disabled={!requiredDone || saving}
              onClick={save}
              title={requiredDone ? t('blog.saveHintOptional') : undefined}
            >
              {saving ? t('common.saving') : t('blog.saveLayout')}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  )
}
