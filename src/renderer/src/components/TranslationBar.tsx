import { useEffect, useId, useState } from 'react'
import { useT } from '../i18n'
import { errorMessage } from '../lib/api'
import type { PageLanguage, TextChange } from '../../../shared/types'

interface Props {
  path: string
  /** Changes when the page was saved or reloaded. */
  reloadToken: number
  /** What was last clicked in the page (its selector and text). */
  selection: { selector: string; text: string } | null
  onOpenPage: (path: string) => void
  /** Scrolls the page to an element and makes it flash (an editor selector). */
  onReveal: (selector: string) => void
  onError: (text: string) => void
}

/**
 * Under the editor's toolbar on a site with languages: the page's other versions, where this
 * translation stands, and the original text of what you clicked.
 */
export default function TranslationBar({
  path,
  reloadToken,
  selection,
  onOpenPage,
  onReveal,
  onError
}: Props): React.JSX.Element | null {
  const t = useT()
  const [info, setInfo] = useState<PageLanguage | null>(null)
  /** The original text, with the selection it's for (a newer click makes it stale). */
  const [original, setOriginal] = useState<{ selector: string; text: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  /** An outdated page: what changed in the original (null: not known), for the page it's for. */
  const [loaded, setLoaded] = useState<{ path: string; list: TextChange[] | null } | null>(null)
  /** The page whose list of changes is open (another page starts closed). */
  const [openFor, setOpenFor] = useState<string | null>(null)
  const changesId = useId()
  const outdated = info?.status === 'outdated'

  useEffect(() => {
    if (!outdated) return
    let live = true
    window.api.sourceChanges(path).then(
      (list) => live && setLoaded({ path, list }),
      () => {}
    )
    return () => {
      live = false
    }
  }, [path, outdated, reloadToken])
  const changes = outdated && loaded?.path === path ? loaded.list : null
  const showChanges = openFor === path

  useEffect(() => {
    let live = true
    window.api.pageLanguage(path).then(
      (next) => live && setInfo(next),
      () => live && setInfo(null)
    )
    return () => {
      live = false
    }
  }, [path, reloadToken])

  useEffect(() => {
    if (!selection || !info?.source) return
    let live = true
    window.api.originalText(path, selection.selector).then(
      (text) => live && setOriginal({ selector: selection.selector, text }),
      () => {}
    )
    return () => {
      live = false
    }
  }, [path, selection, info?.source])

  if (!info) return null
  const source = info.languages.find((language) => !language.path)!

  const create = async (code: string): Promise<void> => {
    setBusy(true)
    try {
      const from = info.source ?? path
      const result = await window.api.copyToLanguage(code, [from])
      if (result.created[0]) onOpenPage(result.created[0])
    } catch (error) {
      onError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const mark = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.markTranslated([path])
      setInfo(await window.api.pageLanguage(path))
    } catch (error) {
      onError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  // Shown only when it differs from what's on the page: an untranslated line needs no hint.
  const text = original && original.selector === selection?.selector ? original.text : null
  const hint = text && text !== selection?.text ? text : null

  const changeLabel = (change: TextChange): string =>
    change.key === '@title'
      ? t('languages.changeTitle')
      : change.key === '@description'
        ? t('languages.changeDescription')
        : change.key.endsWith('@alt')
          ? t('languages.changeAlt')
          : change.before === null
            ? t('languages.changeNew')
            : change.now === null
              ? t('languages.changeGone')
              : t('languages.changeText')

  return (
    <>
      <div className="translation-bar">
        <div
          className="translation-bar__versions"
          role="group"
          aria-label={t('languages.versions')}
        >
          {info.languages.map((language) => {
            const page = info.pages[language.code]
            const current = language.code === info.code
            return page ? (
              <button
                key={language.code}
                className={`btn btn--small${current ? ' is-active' : ''}`}
                aria-current={current ? 'page' : undefined}
                aria-label={language.name}
                title={language.name}
                onClick={() => !current && onOpenPage(page)}
              >
                {language.code.toUpperCase()}
              </button>
            ) : (
              <button
                key={language.code}
                className="btn btn--small btn--ghost translation-bar__missing"
                title={t('languages.createTip', { language: language.name })}
                aria-label={t('languages.createTip', { language: language.name })}
                disabled={busy}
                onClick={() => create(language.code)}
              >
                + {language.code.toUpperCase()}
              </button>
            )
          })}
        </div>
        {info.status === 'needs' && (
          <>
            <span className="badge badge--warn">{t('languages.statusNeeds')}</span>
            <button className="btn btn--small" onClick={mark} disabled={busy}>
              {t('languages.markTranslated')}
            </button>
          </>
        )}
        {info.status === 'outdated' && (
          <>
            <span className="badge badge--outdated">{t('languages.statusOutdated')}</span>
            <span className="muted small">
              {t('languages.outdatedHint', { language: source.name })}
            </span>
            {changes && (
              <button
                className="btn btn--small"
                aria-expanded={showChanges}
                aria-controls={changesId}
                onClick={() => setOpenFor(showChanges ? null : path)}
              >
                {t('languages.whatChanged', { count: changes.length })}
              </button>
            )}
            <button className="btn btn--small" onClick={mark} disabled={busy}>
              {t('languages.markUpToDate')}
            </button>
          </>
        )}
        {hint && (
          <span className="translation-bar__original" title={hint}>
            <span className="muted">{source.name}:</span> {hint}
          </span>
        )}
      </div>
      {showChanges && changes && info.status === 'outdated' && (
        <div className="translation-changes" id={changesId}>
          {changes.length === 0 ? (
            <p className="muted small">{t('languages.changesHidden')}</p>
          ) : (
            <ol className="translation-changes__list">
              {changes.map((change) => {
                const selector = change.key.startsWith('@') ? null : change.key.replace(/@alt$/, '')
                return (
                  <li key={change.key} className="translation-changes__item">
                    <span className="translation-changes__kind">{changeLabel(change)}</span>
                    <div className="translation-changes__texts">
                      {change.before !== null && (
                        <del className="translation-changes__before">{change.before}</del>
                      )}
                      {change.now !== null && (
                        <ins className="translation-changes__now">{change.now}</ins>
                      )}
                    </div>
                    {selector && change.now !== null && (
                      <button
                        className="btn btn--small btn--ghost"
                        onClick={() => onReveal(selector)}
                      >
                        {t('languages.changeShow')}
                      </button>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </>
  )
}
