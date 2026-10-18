import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import { Explainer, Notice } from './Field'
import { useT } from '../i18n'
import { errorMessage } from '../lib/api'
import type { LanguagesCopy, SiteLanguage } from '../../../shared/types'

interface Props {
  language: SiteLanguage
  /** Pages with no version in that language yet. */
  pages: string[]
  onDone: (result: LanguagesCopy) => void
  onClose: () => void
}

/** Copies pages into a language's folder, to translate them there. */
export default function CopyPagesModal({
  language,
  pages,
  onDone,
  onClose
}: Props): React.JSX.Element {
  const t = useT()
  const [chosen, setChosen] = useState(new Set(pages))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** "All" shows a dash when only some pages are ticked. */
  const all = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (all.current) all.current.indeterminate = chosen.size > 0 && chosen.size < pages.length
  }, [chosen, pages.length])

  const toggle = (path: string, on: boolean): void => {
    const next = new Set(chosen)
    if (on) next.add(path)
    else next.delete(path)
    setChosen(next)
  }

  const copy = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      onDone(await window.api.copyToLanguage(language.code, [...chosen]))
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Modal
      label={t('languages.copyTitle', { language: language.name })}
      className="modal--narrow modal--auto"
      onClose={onClose}
    >
      <form
        className="modal__form"
        onSubmit={(e) => {
          e.preventDefault()
          copy()
        }}
      >
        <header className="modal__head">
          <h2>{t('languages.copyTitle', { language: language.name })}</h2>
        </header>
        <div className="modal__body">
          <Explainer>{t('languages.copyIntro', { folder: `/${language.path}` })}</Explainer>
          <label className="check">
            <input
              ref={all}
              type="checkbox"
              checked={chosen.size === pages.length}
              onChange={(e) => setChosen(new Set(e.target.checked ? pages : []))}
            />
            {t('languages.copyAll', { count: pages.length })}
          </label>
          <ul className="copy-pages">
            {pages.map((path) => (
              <li key={path}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={chosen.has(path)}
                    onChange={(e) => toggle(path, e.target.checked)}
                  />
                  <span className="mono small">{path}</span>
                  <span className="muted small"> → {language.path + path}</span>
                </label>
              </li>
            ))}
          </ul>
          {error && <Notice kind="error">{error}</Notice>}
        </div>
        <footer className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy || !chosen.size}>
            {busy ? t('languages.creating') : t('languages.copyButton', { count: chosen.size })}
          </button>
        </footer>
      </form>
    </Modal>
  )
}
