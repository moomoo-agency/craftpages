import { useEffect, useState } from 'react'
import { Explainer, Notice, Section } from './Field'
import CopyPagesModal from './CopyPagesModal'
import { useT } from '../i18n'
import { errorMessage } from '../lib/api'
import { LANGUAGE_NAMES, languageName } from '../../../shared/languages'
import type { LanguagesState, SiteLanguage, SwitcherState } from '../../../shared/types'

interface Props {
  /** The site's language before languages are set up (its root language). */
  locale: string
  hasBaseUrl: boolean
  /** The site's languages were saved (the Site section shows the root one). */
  onSaved: (languages: SiteLanguage[]) => void
  /** Opens the language switcher's setup on the page (add one, or change their look). */
  onSwitcher: (mode: 'add' | 'restyle', state: SwitcherState) => void
  /** Pages → Translations, where the work on each page is listed. */
  onOpenTranslations: () => void
}

/** `translations`: the message is about pages to translate, so it links to them. */
type Status = { kind: 'error' | 'success'; text: string; translations?: boolean } | null

/** Project settings → Languages: one folder per language, the root one the default. */
export default function LanguagesSection({
  locale,
  hasBaseUrl,
  onSaved,
  onSwitcher,
  onOpenTranslations
}: Props): React.JSX.Element {
  const t = useT()
  const [state, setState] = useState<LanguagesState | null>(null)
  const [switcher, setSwitcher] = useState<SwitcherState | null>(null)
  const [draft, setDraft] = useState<SiteLanguage[] | null>(null)
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  /** The language pages are being copied to (the dialog is open). */
  const [copying, setCopying] = useState<SiteLanguage | null>(null)
  /** A site-wide action waiting for a second click. */
  const [confirming, setConfirming] = useState<'turnOff' | 'removeSwitcher' | null>(null)

  const load = (): Promise<void> =>
    Promise.all([window.api.languagesState(), window.api.switcherState()]).then(
      ([next, switchers]) => {
        setState(next)
        setSwitcher(switchers)
        setDraft(null)
      }
    )
  useEffect(() => {
    load().catch((error) => setStatus({ kind: 'error', text: errorMessage(error) }))
  }, [])

  const run = async (task: () => Promise<string | void>): Promise<void> => {
    setBusy(true)
    setStatus(null)
    try {
      const text = await task()
      if (text) setStatus({ kind: 'success', text })
    } catch (error) {
      setStatus({ kind: 'error', text: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  if (!state) return <Section title={t('languages.title')}>{null}</Section>

  const languages = draft ?? state.languages
  const editing = languages.length > 0
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(state.languages)

  const save = (list: SiteLanguage[]): Promise<void> =>
    run(async () => {
      const next = await window.api.saveLanguages(list)
      setState(next)
      setDraft(null)
      onSaved(next.languages)
      return list.length ? t('languages.saved') : t('languages.turnedOff')
    })

  const update = (): Promise<void> =>
    run(async () => {
      const result = await window.api.updateLanguagePages()
      await load()
      return [
        t('languages.updated', { count: result.changed.length }),
        result.skipped.length ? t('languages.skipped', { count: result.skipped.length }) : ''
      ]
        .filter(Boolean)
        .join(' ')
    })

  const setRow = (index: number, patch: Partial<SiteLanguage>): void =>
    setDraft(languages.map((language, i) => (i === index ? { ...language, ...patch } : language)))

  const used = new Set(languages.map((language) => language.code.toLowerCase()))
  const addable = Object.keys(LANGUAGE_NAMES).filter((code) => !used.has(code))
  const add = (): void => {
    if (!adding) return
    const base = languages.length
      ? languages
      : [{ code: locale || 'en', name: languageName(locale || 'en'), path: '' }]
    setDraft([
      ...base,
      { code: adding, name: languageName(adding), path: `${adding.toLowerCase()}/` }
    ])
    setAdding('')
  }

  const saved = state.languages.length > 0 && !dirty
  const missing = state.languages.filter((l) => l.path && state.missing[l.code]?.length)
  // Saved languages whose folder the draft no longer has: their pages don't move with it.
  const leftBehind = dirty
    ? state.languages.filter(
        (l) =>
          l.path &&
          (state.counts[l.code] ?? 0) > 0 &&
          !languages.some((d) => d.path.replace(/\/?$/, '/') === l.path)
      )
    : []
  const openTranslations = (
    <button className="link" onClick={onOpenTranslations}>
      {t('languages.openTranslations')}
    </button>
  )

  return (
    <Section
      title={t('languages.title')}
      description={t('languages.description')}
      actions={
        dirty && (
          <>
            <button className="btn btn--ghost" onClick={() => setDraft(null)} disabled={busy}>
              {t('common.cancel')}
            </button>
            <button className="btn btn--primary" onClick={() => save(draft!)} disabled={busy}>
              {busy ? t('common.saving') : t('common.save')}
            </button>
          </>
        )
      }
    >
      <div className="languages">
        {!editing && state.detected && (
          <Notice kind="info">
            {t('languages.detected', {
              languages: state.detected
                .map((l) =>
                  l.path ? `${l.name} (/${l.path})` : `${l.name} (${t('languages.root')})`
                )
                .join(', ')
            })}{' '}
            <button
              className="btn btn--small"
              onClick={() => save(state.detected!)}
              disabled={busy}
            >
              {t('languages.useDetected')}
            </button>
          </Notice>
        )}
        {!editing && !state.detected && <Explainer>{t('languages.oneLanguage')}</Explainer>}

        {editing && (
          <table className="list languages__table">
            <thead>
              <tr>
                <th scope="col">{t('languages.colLanguage')}</th>
                <th scope="col">{t('languages.colCode')}</th>
                <th scope="col">{t('languages.colFolder')}</th>
                <th scope="col" className="num">
                  {t('languages.colPages')}
                </th>
                <th scope="col">
                  <span className="visually-hidden">{t('languages.colActions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {languages.map((language, index) => (
                <tr key={index}>
                  <td>
                    <input
                      aria-label={`${t('languages.colLanguage')}: ${language.name || language.code}`}
                      value={language.name}
                      onChange={(e) => setRow(index, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="mono"
                      size={8}
                      aria-label={`${t('languages.colCode')}: ${language.name || language.code}`}
                      value={language.code}
                      onChange={(e) => setRow(index, { code: e.target.value })}
                    />
                  </td>
                  <td>
                    {/* The root language comes first: its pages are the site's root. */}
                    {index === 0 ? (
                      <span>
                        <span className="mono">/</span>{' '}
                        <span className="badge">{t('languages.default')}</span>
                      </span>
                    ) : (
                      <input
                        className="mono"
                        size={10}
                        aria-label={`${t('languages.colFolder')}: ${language.name || language.code}`}
                        value={language.path}
                        onChange={(e) => setRow(index, { path: e.target.value })}
                      />
                    )}
                  </td>
                  <td className="num">{state.counts[language.code] ?? 0}</td>
                  <td>
                    {index > 0 && (
                      <button
                        className="btn btn--small"
                        aria-label={`${t('common.remove')}: ${language.name || language.code}`}
                        onClick={() => setDraft(languages.filter((_, i) => i !== index))}
                      >
                        {t('common.remove')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="input-group languages__add">
          <select
            aria-label={t('languages.addLabel')}
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
          >
            <option value="">{t('languages.addLabel')}</option>
            {addable.map((code) => (
              <option key={code} value={code}>
                {LANGUAGE_NAMES[code]} ({code})
              </option>
            ))}
          </select>
          <button className="btn" onClick={add} disabled={!adding}>
            {t('languages.add')}
          </button>
        </div>
        {editing && !saved && <Explainer>{t('languages.rootNote')}</Explainer>}
        {leftBehind.map((language) => (
          <Notice key={language.code} kind="warning">
            {t('languages.leftBehind', {
              count: state.counts[language.code],
              folder: `/${language.path}`
            })}
          </Notice>
        ))}

        {saved && (
          <>
            {state.outdated.length > 0 ? (
              <Notice kind="warning">
                {t('languages.outdated', { count: state.outdated.length })}{' '}
                <button className="btn btn--small btn--primary" onClick={update} disabled={busy}>
                  {t('languages.update')}
                </button>
                {state.unsaved.length > 0 && (
                  <span className="muted small">
                    {' '}
                    {t('languages.unsavedNote', { count: state.unsaved.length })}
                  </span>
                )}
                <details>
                  <summary className="small">{t('languages.whichPages')}</summary>
                  <ul className="small mono">
                    {state.outdated.map((path) => (
                      <li key={path}>{path}</li>
                    ))}
                  </ul>
                </details>
              </Notice>
            ) : (
              <p className="status-line">
                <span className="dot dot--on" aria-hidden="true" />
                {t('languages.upToDate', {
                  count: state.groups.length,
                  groups: state.groups.length
                })}
                {state.groups.length > 0 && <> {openTranslations}</>}
              </p>
            )}
            {missing.map((language) => (
              <div key={language.code} className="languages__missing">
                <details>
                  <summary>
                    {t('languages.missing', {
                      count: state.missing[language.code].length,
                      language: language.name
                    })}
                  </summary>
                  <ul className="small mono">
                    {state.missing[language.code].map((path) => (
                      <li key={path}>{path}</li>
                    ))}
                  </ul>
                </details>
                <button className="btn btn--small" onClick={() => setCopying(language)}>
                  {t('languages.copyOpen', { language: language.name })}
                </button>
              </div>
            ))}
            {state.unmanaged.length > 0 && (
              <Explainer>
                {t('languages.unmanaged', {
                  count: state.unmanaged.length,
                  folders: [
                    ...new Set(state.unmanaged.map((path) => `/${path.split('/')[0]}/`))
                  ].join(', ')
                })}
              </Explainer>
            )}
            {state.conflicts.map((conflict) => (
              <Notice key={conflict.pages.join()} kind="error">
                {t('languages.conflict', { language: languageName(conflict.language) })}{' '}
                <span className="mono small">{conflict.pages.join(', ')}</span>
              </Notice>
            ))}
            {switcher && (
              <div className="languages__switcher">
                <h3 className="settings__subhead">{t('languages.switcherTitle')}</h3>
                <p className="muted small">
                  {switcher.pages.length
                    ? t('languages.switcherOn', { count: switcher.pages.length })
                    : t('languages.switcherOff')}
                </p>
                <div className="input-group">
                  <button className="btn" onClick={() => onSwitcher('add', switcher)}>
                    {switcher.pages.length
                      ? t('languages.switcherAddMore')
                      : t('languages.switcherAddButton')}
                  </button>
                  {switcher.pages.length > 0 && (
                    <>
                      <button className="btn" onClick={() => onSwitcher('restyle', switcher)}>
                        {t('languages.switcherLook')}
                      </button>
                      <button
                        className="btn"
                        disabled={busy || confirming === 'removeSwitcher'}
                        onClick={() => setConfirming('removeSwitcher')}
                      >
                        {t('common.remove')}
                      </button>
                    </>
                  )}
                </div>
                {confirming === 'removeSwitcher' && (
                  <div className="inline-confirm" role="group" aria-label={t('common.remove')}>
                    <span>
                      {t('languages.switcherRemoveConfirm', { count: switcher.pages.length })}
                    </span>
                    <button
                      className="btn btn--small btn--danger"
                      disabled={busy}
                      onClick={() => {
                        setConfirming(null)
                        run(async () => {
                          const result = await window.api.removeSwitchers()
                          await load()
                          return t('languages.switcherRemoved', { count: result.pages.length })
                        })
                      }}
                    >
                      {t('languages.switcherRemoveYes', { count: switcher.pages.length })}
                    </button>
                    <button className="btn btn--small" onClick={() => setConfirming(null)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                )}
              </div>
            )}
            {!hasBaseUrl && state.groups.length > 0 && (
              <Explainer>{t('languages.needsBaseUrl')}</Explainer>
            )}
          </>
        )}
        {status && (
          <div role={status.kind === 'error' ? 'alert' : 'status'}>
            <Notice kind={status.kind}>
              {status.text}
              {status.translations && <> {openTranslations}</>}
            </Notice>
          </div>
        )}
        {state.languages.length > 0 &&
          !dirty &&
          (confirming === 'turnOff' ? (
            <div className="inline-confirm" role="group" aria-label={t('languages.turnOff')}>
              <span>
                {t('languages.turnOffConfirm', {
                  count: Object.values(state.counts).reduce((a, b) => a + b, 0)
                })}
              </span>
              <button
                className="btn btn--small btn--danger"
                disabled={busy}
                onClick={() => {
                  setConfirming(null)
                  save([])
                }}
              >
                {t('languages.turnOffYes')}
              </button>
              <button className="btn btn--small" onClick={() => setConfirming(null)}>
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <p className="languages__footer">
              <button
                className="link link--quiet"
                onClick={() => setConfirming('turnOff')}
                disabled={busy}
              >
                {t('languages.turnOff')}
              </button>
            </p>
          ))}
      </div>
      {copying && (
        <CopyPagesModal
          language={copying}
          pages={state.missing[copying.code] ?? []}
          onClose={() => setCopying(null)}
          onDone={(result) => {
            setCopying(null)
            load()
            setStatus({
              kind: 'success',
              text: t('languages.copied', { count: result.created.length, language: copying.name }),
              translations: true
            })
          }}
        />
      )}
    </Section>
  )
}
