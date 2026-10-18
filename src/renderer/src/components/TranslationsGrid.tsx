import { useEffect, useState } from 'react'
import { Notice } from './Field'
import { useT, type Key } from '../i18n'
import { errorMessage } from '../lib/api'
import { addressOfFile } from '../../../shared/blog-urls'
import type {
  SiteLanguage,
  TranslationRow,
  TranslationStatus,
  Workspace
} from '../../../shared/types'

interface Props {
  workspace: Workspace
  languages: SiteLanguage[]
  /** A page's title as the Pages tab shows it (without the site name it repeats). */
  pageName: (title: string) => string
  onEditPage: (path: string) => void
}

const STATUS: Record<TranslationStatus, { label: Key; badge: string }> = {
  source: { label: 'languages.statusSource', badge: 'badge--muted' },
  translated: { label: 'languages.statusTranslated', badge: 'badge--ok' },
  needs: { label: 'languages.statusNeeds', badge: 'badge--warn' },
  outdated: { label: 'languages.statusOutdated', badge: 'badge--outdated' }
}

/** Pages → Translations: each page and its version in every language, with where it stands. */
export default function TranslationsGrid({
  workspace,
  languages,
  pageName,
  onEditPage
}: Props): React.JSX.Element {
  const t = useT()
  const [rows, setRows] = useState<TranslationRow[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Only rows with something to do (a version missing, to translate or outdated). */
  const [onlyWork, setOnlyWork] = useState(false)

  const load = (): Promise<void> =>
    window.api.translationsGrid().then(setRows, (e) => setError(errorMessage(e)))
  useEffect(() => {
    load()
  }, [workspace])

  if (!rows) return <p className="muted">{t('common.loading')}</p>

  const create = async (code: string, from: string): Promise<void> => {
    setBusy(`${code}:${from}`)
    setError(null)
    try {
      const result = await window.api.copyToLanguage(code, [from])
      // The workspace refreshes too (new page); open the copy to translate it.
      if (result.created[0]) onEditPage(result.created[0])
      else await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const root = languages.find((language) => !language.path)!
  const others = languages.filter((language) => language !== root)
  const needsWork = (row: TranslationRow): boolean =>
    others.some((language) => {
      const cell = row.pages[language.code]
      return !cell || cell.status === 'needs' || cell.status === 'outdated'
    })
  // Per language: how many pages are missing, to translate and outdated.
  const summary = others.map((language) => {
    const count = (test: (row: TranslationRow) => boolean): number => rows.filter(test).length
    return {
      language,
      missing: count((row) => !row.pages[language.code]),
      needs: count((row) => row.pages[language.code]?.status === 'needs'),
      outdated: count((row) => row.pages[language.code]?.status === 'outdated')
    }
  })
  const shown = onlyWork ? rows.filter(needsWork) : rows
  return (
    <>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="translations__summary">
        <ul className="translations__counts">
          {summary.map(({ language, missing, needs, outdated }) => (
            <li key={language.code}>
              <strong>{language.name}</strong>{' '}
              {missing + needs + outdated === 0
                ? t('languages.summaryDone')
                : [
                    needs ? t('languages.summaryNeeds', { count: needs }) : '',
                    outdated ? t('languages.summaryOutdated', { count: outdated }) : '',
                    missing ? t('languages.summaryMissing', { count: missing }) : ''
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </li>
          ))}
        </ul>
        <label className="check check--inline">
          <input
            type="checkbox"
            checked={onlyWork}
            onChange={(e) => setOnlyWork(e.target.checked)}
          />
          {t('languages.onlyWork')}
        </label>
      </div>
      {shown.length === 0 && <p className="muted">{t('languages.allDone')}</p>}
      {shown.length > 0 && (
        <table className="list translations">
          <thead>
            <tr>
              <th scope="col">{t('app.colTitle')}</th>
              {languages.map((language) => (
                <th key={language.code} scope="col">
                  {language.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              // A version to copy from: the root language's, else any.
              const from = row.pages[root.code]?.path ?? Object.values(row.pages)[0].path
              return (
                <tr key={from}>
                  <td className="list__title">
                    {pageName(row.title)}
                    <div className="muted small mono">{addressOfFile(from)}</div>
                  </td>
                  {languages.map((language) => {
                    const cell = row.pages[language.code]
                    if (!cell)
                      return (
                        <td key={language.code}>
                          <button
                            className="btn btn--small"
                            disabled={busy !== null}
                            onClick={() => create(language.code, from)}
                            title={t('languages.createTip', { language: language.name })}
                            aria-label={t('languages.createFor', {
                              language: language.name,
                              page: pageName(row.title)
                            })}
                          >
                            {busy === `${language.code}:${from}`
                              ? t('languages.creating')
                              : t('languages.create')}
                          </button>
                        </td>
                      )
                    const status = STATUS[cell.status]
                    return (
                      <td key={language.code}>
                        <button
                          className="link translations__cell"
                          onClick={() => onEditPage(cell.path)}
                          title={cell.path}
                          aria-label={`${pageName(row.title)}, ${language.name}: ${t(status.label)}`}
                        >
                          <span className={`badge ${status.badge}`}>{t(status.label)}</span>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </>
  )
}
