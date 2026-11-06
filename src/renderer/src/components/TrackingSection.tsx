import { useEffect, useId, useState } from 'react'
import { Explainer, Field, Notice, Section } from './Field'
import { changeNote, useNotes } from '../lib/notes'
import { useT, type Key } from '../i18n'
import { errorMessage } from '../lib/api'
import {
  TRACKING_PROVIDERS,
  trackingProvider,
  type TrackingFieldKey,
  type TrackingKind,
  type TrackingState,
  type TrackingTag
} from '../../../shared/tracking'
import type { ConsentCategory, SiteChange } from '../../../shared/types'

interface Props {
  /** Cookie consent is on (changes here come back through `consentOn`). */
  consentOn: boolean
  /** Turns cookie consent on with the current banner settings. */
  enableConsent: () => Promise<SiteChange>
  /** After any change: the consent screen reloads what its pages load. */
  onChanged: () => Promise<void>
}

const CATEGORY: Record<ConsentCategory, Key> = {
  necessary: 'consent.catNecessary',
  analytics: 'consent.catAnalytics',
  marketing: 'consent.catMarketing',
  embeds: 'consent.catEmbeds'
}

const GROUPS: { label: Key; category: string }[] = [
  { label: 'tracking.groupAnalytics', category: 'analytics' },
  { label: 'tracking.groupMarketing', category: 'marketing' },
  { label: 'tracking.groupCookieless', category: 'cookieless' },
  { label: 'tracking.groupOther', category: 'chosen' }
]

const fieldLabel = (key: TrackingFieldKey): Key => `tracking.field_${key}` as Key
const kindHint = (kind: TrackingKind): Key => `tracking.hint_${kind}` as Key

interface Draft {
  kind: TrackingKind | ''
  values: Partial<Record<TrackingFieldKey, string>>
  category: ConsentCategory
  /** The tag being changed, if any. */
  key?: string
}

const EMPTY_DRAFT: Draft = { kind: '', values: {}, category: 'analytics' }

/** Analytics and ads tags from an ID, on the Tracking & consent screen. */
export default function TrackingSection({
  consentOn,
  enableConsent,
  onChanged
}: Props): React.JSX.Element {
  const t = useT()
  const id = useId()
  const [state, setState] = useState<TrackingState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [alsoConsent, setAlsoConsent] = useState(true)
  const [excludePick, setExcludePick] = useState('')

  const reload = async (): Promise<void> => {
    setState(await window.api.getTracking())
    await onChanged()
  }
  const { busy, run, show } = useNotes(reload)

  useEffect(() => {
    window.api.getTracking().then(setState, (e) => setLoadError(errorMessage(e)))
  }, [consentOn])

  if (loadError) return <Notice kind="error">{loadError}</Notice>
  if (!state) return <div className="muted">{t('common.loading')}</div>

  const provider = draft.kind ? trackingProvider(draft.kind) : undefined
  const category: ConsentCategory | null = !provider
    ? null
    : provider.category === 'chosen'
      ? draft.category
      : provider.category === 'cookieless'
        ? null
        : provider.category
  const needsConsent = category !== null && category !== 'necessary'
  const byHand = state.byHand.filter((hand) => !state.tags.some((tag) => tag.kind === hand.kind))
  const taken = new Set(state.tags.filter((tag) => tag.kind !== 'custom').map((tag) => tag.kind))
  const draftName =
    provider?.kind === 'custom' ? draft.values.name || provider.name : provider?.name

  const save = (): void => {
    if (!provider) return
    const editing = Boolean(draft.key)
    const name = draftName ?? ''
    run('add', async () => {
      const change = await window.api.saveTracking({
        kind: provider.kind,
        values: draft.values,
        category: provider.kind === 'custom' ? draft.category : undefined,
        key: draft.key
      })
      let text = t(editing ? 'tracking.changed' : 'tracking.added', { name })
      if (!editing && needsConsent && !consentOn && alsoConsent) {
        await enableConsent()
        text = `${text} ${t('consent.turnedOn')}`
      }
      setDraft(EMPTY_DRAFT)
      return changeNote(change, text)
    })
  }

  const startEdit = (tag: TrackingTag): void =>
    setDraft({
      kind: tag.kind,
      values: { ...tag.values },
      category: tag.category ?? 'analytics',
      key: tag.key
    })

  const statusOf = (tag: TrackingTag): string => {
    if (tag.category === null) {
      const kind = trackingProvider(tag.kind)?.category
      return t(kind === 'cookieless' ? 'tracking.cookieless' : 'tracking.runs')
    }
    if (tag.category === 'necessary') return t('tracking.runs')
    return t(consentOn ? 'tracking.waits' : 'tracking.waitsOff')
  }

  const pickable = state.pages.filter((path) => !state.excluded.includes(path))

  return (
    <Section
      title={t('tracking.title')}
      state={state.tags.length ? 'on' : undefined}
      description={t('tracking.description')}
    >
      {byHand.map((hand) => (
        <Notice key={hand.kind} kind="info">
          {t('tracking.byHand', { name: hand.name, count: hand.pages })}
        </Notice>
      ))}

      {state.tags.length === 0 ? (
        <p className="muted">{t('tracking.none')}</p>
      ) : (
        <table className="list">
          <thead>
            <tr>
              <th scope="col">{t('tracking.colService')}</th>
              <th scope="col">{t('tracking.colStatus')}</th>
              <th scope="col">
                <span className="visually-hidden">{t('tracking.edit')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {state.tags.map((tag, i) => (
              <tr key={tag.key}>
                <td id={`${id}-tag-${i}`}>
                  {tag.name}
                  <div className="muted small">
                    {tag.values.id ?? tag.values.domain ?? ''}
                    {(tag.values.id || tag.values.domain) && ' · '}
                    {t('tracking.onPages', { count: tag.pages })}
                  </div>
                </td>
                <td>
                  {statusOf(tag)}
                  {tag.category && tag.category !== 'necessary' && (
                    <div className="muted small">{t(CATEGORY[tag.category])}</div>
                  )}
                  {tag.missing.length > 0 && (
                    <div className="muted small" title={tag.missing.join(', ')}>
                      {t('tracking.missing', { count: tag.missing.length })}
                    </div>
                  )}
                </td>
                <td className="num">
                  <button
                    className="btn btn--small"
                    disabled={busy}
                    aria-describedby={`${id}-tag-${i}`}
                    onClick={() => startEdit(tag)}
                  >
                    {t('tracking.edit')}
                  </button>{' '}
                  <button
                    className="btn btn--small btn--danger-outline"
                    disabled={busy}
                    aria-describedby={`${id}-tag-${i}`}
                    onClick={() =>
                      run('list', async () =>
                        changeNote(
                          await window.api.removeTracking(tag.key),
                          t('tracking.removed', { name: tag.name })
                        )
                      )
                    }
                  >
                    {t('tracking.remove')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {show('list')}

      <h3 className="tracking__subtitle">
        {draft.key ? t('tracking.editTitle', { name: draftName ?? '' }) : t('tracking.addTitle')}
      </h3>
      <div className="grid-2">
        <Field label={t('tracking.service')}>
          <select
            value={draft.kind}
            disabled={busy || Boolean(draft.key)}
            onChange={(e) =>
              setDraft({ ...EMPTY_DRAFT, kind: e.target.value as TrackingKind | '' })
            }
          >
            <option value="">{t('tracking.chooseService')}</option>
            {GROUPS.map((group) => (
              <optgroup key={group.category} label={t(group.label)}>
                {TRACKING_PROVIDERS.filter((p) => p.category === group.category).map((p) => (
                  <option
                    key={p.kind}
                    value={p.kind}
                    disabled={taken.has(p.kind) && p.kind !== draft.kind}
                  >
                    {p.kind === 'custom' ? t('tracking.groupOther') : p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        {provider?.kind === 'custom' && (
          <Field label={t('tracking.categoryLabel')} hint={t('tracking.categoryHint')}>
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as ConsentCategory })}
            >
              {(Object.keys(CATEGORY) as ConsentCategory[]).map((c) => (
                <option key={c} value={c}>
                  {t(CATEGORY[c])}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      {provider && (
        <>
          <div className={provider.kind === 'custom' ? '' : 'grid-2'}>
            {provider.fields.map((field) => {
              const hint =
                field.key === 'id'
                  ? t(kindHint(provider.kind))
                  : field.key === 'script'
                    ? t('tracking.scriptHint')
                    : field.key === 'domain'
                      ? t('tracking.domainHint')
                      : field.key === 'name'
                        ? t('tracking.nameHint')
                        : t('tracking.codeHint')
              const value = draft.values[field.key] ?? ''
              const set = (next: string): void =>
                setDraft({ ...draft, values: { ...draft.values, [field.key]: next } })
              return (
                <Field key={field.key} label={t(fieldLabel(field.key))} hint={hint || undefined}>
                  {field.long ? (
                    <textarea
                      rows={6}
                      className="mono"
                      spellCheck={false}
                      value={value}
                      placeholder={field.placeholder}
                      onChange={(e) => set(e.target.value)}
                    />
                  ) : (
                    <input
                      value={value}
                      spellCheck={false}
                      placeholder={field.placeholder}
                      onChange={(e) => set(e.target.value)}
                    />
                  )}
                </Field>
              )
            })}
          </div>
          {!draft.key && needsConsent && !consentOn && (
            <Notice kind="warning">
              {t('tracking.needsConsentOff', { name: draftName ?? '' })}
              <label className="check">
                <input
                  type="checkbox"
                  checked={alsoConsent}
                  onChange={(e) => setAlsoConsent(e.target.checked)}
                />
                {t('tracking.alsoConsent')}
              </label>
            </Notice>
          )}
          {needsConsent && consentOn && category && (
            <p className="field__hint">
              {t('tracking.needsConsentOn', { category: t(CATEGORY[category]).toLowerCase() })}
            </p>
          )}
          {provider.category === 'cookieless' && (
            <p className="field__hint">{t('tracking.noConsentNeeded', { name: provider.name })}</p>
          )}
          <div className="tracking__actions">
            <button className="btn btn--primary" disabled={busy} onClick={save}>
              {draft.key ? t('tracking.save') : t('tracking.add')}
            </button>
            <button className="btn" disabled={busy} onClick={() => setDraft(EMPTY_DRAFT)}>
              {t('tracking.cancel')}
            </button>
          </div>
        </>
      )}
      {show('add')}

      {state.tags.length > 0 && (
        <>
          <h3 className="tracking__subtitle">{t('tracking.excludedTitle')}</h3>
          <p className="field__hint">{t('tracking.excludedDescription')}</p>
          {state.excluded.length === 0 ? (
            <p className="muted small">{t('tracking.excludedNone')}</p>
          ) : (
            <ul className="tracking__excluded">
              {state.excluded.map((path) => (
                <li key={path}>
                  <span className="mono">{path}</span>{' '}
                  <button
                    className="link"
                    disabled={busy}
                    onClick={() =>
                      run('excluded', async () =>
                        changeNote(
                          await window.api.setTrackingExcluded(path, false),
                          t('tracking.includedSet', { path })
                        )
                      )
                    }
                  >
                    {t('tracking.include')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="tracking__exclude">
            <select
              value={excludePick}
              aria-label={t('tracking.excludePick')}
              onChange={(e) => setExcludePick(e.target.value)}
            >
              <option value="">{t('tracking.excludePick')}</option>
              {pickable.map((path) => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
            </select>
            <button
              className="btn"
              disabled={busy || !excludePick}
              onClick={() => {
                const path = excludePick
                setExcludePick('')
                run('excluded', async () =>
                  changeNote(
                    await window.api.setTrackingExcluded(path, true),
                    t('tracking.excludedSet', { path })
                  )
                )
              }}
            >
              {t('tracking.exclude')}
            </button>
          </div>
          {show('excluded')}
        </>
      )}

      <Explainer title={t('tracking.howTitle')}>
        <p>{t('tracking.howTags')}</p>
        <p>{t('tracking.howConsent')}</p>
        <p>{t('tracking.howPublish')}</p>
      </Explainer>
    </Section>
  )
}
