import { useId, useState } from 'react'
import { Notice } from './Field'
import { useT } from '../i18n'
import { errorMessage } from '../lib/api'
import type { DeployConnectionView, ServerCheck } from '../../../shared/types'

interface Props {
  connection: DeployConnectionView
  value: string
  onChange: (dir: string) => void
  /** Defaults: the site's folder (Project settings → Deploy). */
  label?: string
  hint?: string
  placeholder?: string
}

/** Folders web hosts usually serve the site from. */
const WEB_ROOTS = new Set(['public_html', 'www', 'htdocs', 'httpdocs', 'html', 'web', 'public'])

/** "Folder on the server", typed or picked by browsing the server. */
export default function RemoteFolder({
  connection,
  value,
  onChange,
  label,
  hint,
  placeholder = '/public_html'
}: Props): React.JSX.Element {
  const t = useT()
  const hintId = useId()
  const [listing, setListing] = useState<ServerCheck | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = async (dir?: string): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      setListing(await window.api.checkServer({ ...connection, token: '' }, dir))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const at = listing?.home ?? ''
  const parts = at.split('/').filter(Boolean)
  const pathTo = (index: number): string => '/' + parts.slice(0, index + 1).join('/')

  return (
    <div className="field">
      <label className="field__label" htmlFor={`${hintId}-input`}>
        {label ?? t('project.remoteDir')}
      </label>
      <span className="input-group">
        <input
          id={`${hintId}-input`}
          className="mono"
          aria-describedby={hintId}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => (listing ? setListing(null) : open(value || undefined))}
        >
          {busy ? t('connections.checking') : listing ? t('common.hide') : t('project.browse')}
        </button>
      </span>
      <span className="field__hint" id={hintId}>
        {hint ?? t('project.remoteDirHint')}
      </span>
      {error && (
        <div role="alert">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
      {listing && (
        <div className="folder-browser" role="group" aria-label={t('project.browseLabel')}>
          <nav className="folder-browser__path" aria-label={t('project.browsePath')}>
            <button type="button" onClick={() => open('/')}>
              /
            </button>
            {parts.map((part, index) => (
              <span key={index}>
                <button type="button" onClick={() => open(pathTo(index))}>
                  {part}
                </button>
                {index < parts.length - 1 && '/'}
              </span>
            ))}
          </nav>
          {listing.dirs.length ? (
            <ul className="folder-browser__list">
              {listing.dirs
                .filter((dir) => !dir.startsWith('.'))
                .map((dir) => (
                  <li key={dir}>
                    <button
                      type="button"
                      className={WEB_ROOTS.has(dir.toLowerCase()) ? 'is-suggested' : undefined}
                      title={WEB_ROOTS.has(dir.toLowerCase()) ? t('project.browseSuggested') : dir}
                      onClick={() => open(`${at.replace(/\/$/, '')}/${dir}`)}
                    >
                      📁 {dir}
                    </button>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="muted small">{t('project.browseEmpty')}</p>
          )}
          <div className="panel__actions">
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => {
                onChange(at)
                setListing(null)
              }}
            >
              {t('project.browseUse', { dir: at })}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
