import { useEffect, useState } from 'react'
import { Explainer, Field, Notice, Section } from './Field'
import { useT } from '../i18n'
import { errorMessage } from '../lib/api'
import type { ExternalFonts, SiteSettings } from '../../../shared/types'

interface Props {
  optimize: SiteSettings['optimize']
  /** A server can't read _headers: the year of caching needs Apache's mod_headers there. */
  onServer: boolean
  onSaved: (optimize: SiteSettings['optimize']) => void
}

type Message = { kind: 'error' | 'success'; text: string; undo?: string } | null

/** Inline budgets offered, in KB of gzipped CSS per page. */
const INLINE_CHOICES = [0, 15, 30, 50]

/**
 * Project settings → Speed: what publishing does to the uploaded copy (minify, cache,
 * inline styles), and fonts loaded from Google Fonts or Bunny Fonts, which can be
 * brought into the site.
 */
export default function SpeedSection({ optimize, onServer, onSaved }: Props): React.JSX.Element {
  const t = useT()
  // The saved settings only change through this section's own Save.
  const [value, setValue] = useState(optimize)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [fonts, setFonts] = useState<ExternalFonts[] | null>(null)
  const [hosting, setHosting] = useState<string | null>(null)
  const [fontMessage, setFontMessage] = useState<Message>(null)

  const loadFonts = (): void => {
    window.api.detectExternalFonts().then(setFonts, () => setFonts([]))
  }
  useEffect(loadFonts, [])

  const dirty = JSON.stringify(value) !== JSON.stringify(optimize)

  const save = async (): Promise<void> => {
    setSaving(true)
    setMessage(null)
    try {
      const next = await window.api.saveSiteSettings({ optimize: value })
      onSaved(next.optimize)
      setMessage({ kind: 'success', text: t('project.speedSaved') })
    } catch (e) {
      setMessage({ kind: 'error', text: errorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  const selfHost = async (entry: ExternalFonts): Promise<void> => {
    setHosting(entry.url)
    setFontMessage(null)
    try {
      const result = await window.api.selfHostFonts(entry.url)
      setFontMessage({
        kind: 'success',
        text: t('project.fontsHosted', {
          files: result.fontFiles,
          pages: result.pages,
          stylesheet: result.stylesheet
        }),
        undo: result.historyId
      })
      loadFonts()
    } catch (e) {
      setFontMessage({ kind: 'error', text: errorMessage(e) })
    } finally {
      setHosting(null)
    }
  }

  const undo = async (historyId: string): Promise<void> => {
    try {
      await window.api.revertHistory(historyId)
      setFontMessage({ kind: 'success', text: t('project.fontsUndone') })
      loadFonts()
    } catch (e) {
      setFontMessage({ kind: 'error', text: errorMessage(e) })
    }
  }

  return (
    <Section
      title={t('project.speed')}
      description={t('project.speedDescription')}
      actions={
        <>
          {dirty && (
            <span className="muted small settings__unsaved">{t('project.unsavedChanges')}</span>
          )}
          <button className="btn btn--primary" onClick={save} disabled={saving || !dirty}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <label className="check">
        <input
          type="checkbox"
          checked={value.minify}
          onChange={(e) => setValue({ ...value, minify: e.target.checked })}
        />
        <span>
          {t('project.minify')}
          <span className="field__hint check__hint">{t('project.minifyHint')}</span>
        </span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={value.cache}
          onChange={(e) => setValue({ ...value, cache: e.target.checked })}
        />
        <span>
          {t('project.longCache')}
          <span className="field__hint check__hint">
            {t(onServer ? 'project.longCacheHintServer' : 'project.longCacheHint')}
          </span>
        </span>
      </label>
      <Field label={t('project.inlineCss')} hint={t('project.inlineCssHint')}>
        <select
          value={value.inlineCssKb}
          onChange={(e) => setValue({ ...value, inlineCssKb: Number(e.target.value) })}
        >
          {INLINE_CHOICES.map((kb) => (
            <option key={kb} value={kb}>
              {kb ? t('project.inlineCssUpTo', { kb }) : t('project.inlineCssOff')}
            </option>
          ))}
        </select>
      </Field>
      {message && (
        <div role={message.kind === 'error' ? 'alert' : 'status'}>
          <Notice kind={message.kind}>{message.text}</Notice>
        </div>
      )}

      <h3 className="settings__subhead">{t('project.externalFonts')}</h3>
      {fonts === null ? (
        <p className="muted">{t('common.loading')}</p>
      ) : fonts.length === 0 ? (
        <p className="muted">{t('project.noExternalFonts')}</p>
      ) : (
        <>
          <Explainer>{t('project.externalFontsExplain')}</Explainer>
          <ul className="speed__fonts">
            {fonts.map((entry) => (
              <li key={entry.url} className="speed__font">
                <span>
                  <strong>{entry.families.join(', ') || entry.service}</strong>
                  <span className="muted small">
                    {' · '}
                    {t('project.fontsFrom', {
                      service: entry.service,
                      count: entry.pages.length + entry.stylesheets.length
                    })}
                  </span>
                </span>
                <button
                  className="btn btn--small"
                  disabled={hosting !== null}
                  onClick={() => selfHost(entry)}
                >
                  {hosting === entry.url ? t('project.fontsHosting') : t('project.fontsHost')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {fontMessage && (
        <div role={fontMessage.kind === 'error' ? 'alert' : 'status'}>
          <Notice kind={fontMessage.kind}>
            {fontMessage.text}{' '}
            {fontMessage.undo && (
              <button className="link" onClick={() => undo(fontMessage.undo!)}>
                {t('common.undo')}
              </button>
            )}
          </Notice>
        </div>
      )}
    </Section>
  )
}
