import { useEffect, useState } from 'react'
import { Explainer, Field, Notice, Section } from './Field'
import MediaPicker from './MediaPicker'
import { changeNote, useNotes } from '../lib/notes'
import { useT } from '../i18n'
import { errorMessage } from '../lib/api'
import type { FaviconState, ImageEntry, Workspace } from '../../../shared/types'

/** Below this, the 512 px icon (Android, installed sites) comes out blurry. */
const SMALL = 512

/** The site icon: one image becomes favicon.ico, the touch icon and the manifest icons. */
export default function FaviconSection({
  workspace
}: {
  workspace: Workspace
}): React.JSX.Element | null {
  const t = useT()
  const [state, setState] = useState<FaviconState | null>(null)
  const [picking, setPicking] = useState(false)
  const [image, setImage] = useState<ImageEntry | null>(null)
  const [background, setBackground] = useState('#ffffff')
  const [loadError, setLoadError] = useState<string | null>(null)

  const reload = async (): Promise<void> => setState(await window.api.getFavicon())
  const { busy, run, show } = useNotes(reload)

  useEffect(() => {
    window.api.getFavicon().then(setState, (e) => setLoadError(errorMessage(e)))
  }, [workspace])

  if (loadError) return <Notice kind="error">{loadError}</Notice>
  if (!state) return null

  const isSvg = image ? /\.svg$/i.test(image.path) : false
  const small = image && !isSvg && Math.min(image.width, image.height) < SMALL
  const notSquare = image && !isSvg && image.width !== image.height

  return (
    <Section
      title={t('tools.iconTitle')}
      state={state.icon ? (state.missing.length && state.ours ? 'improve' : 'done') : 'setup'}
      description={
        state.icon
          ? t(state.ours ? 'tools.iconOurs' : 'tools.iconTheirs', { icon: state.icon })
          : t('tools.iconNone')
      }
      actions={
        <button className="btn" disabled={busy} onClick={() => setPicking(true)}>
          {t(state.icon ? 'tools.iconChange' : 'tools.iconChoose')}
        </button>
      }
    >
      {state.ours && state.missing.length > 0 && (
        <Notice kind="info">
          {t.rich('tools.iconMissing', {
            count: state.missing.length,
            link: (chunk) => (
              <button
                className="link"
                disabled={busy}
                onClick={() =>
                  run('icon', async () =>
                    changeNote(await window.api.addFaviconToPages(), t('tools.iconAdded'))
                  )
                }
              >
                {chunk}
              </button>
            )
          })}
        </Notice>
      )}
      {image && (
        <div className="tool-form">
          <div className="favicon-preview">
            <img src={image.url} alt="" width={64} height={64} />
            <img src={image.url} alt="" width={32} height={32} />
            <img src={image.url} alt="" width={16} height={16} />
            <span className="mono small">{image.path}</span>
          </div>
          {small && (
            <Notice kind="warning">
              {t('tools.iconSmall', { width: image.width, height: image.height })}
            </Notice>
          )}
          {notSquare && <Notice kind="info">{t('tools.iconNotSquare')}</Notice>}
          <Field label={t('tools.iconBackground')} hint={t('tools.iconBackgroundHint')}>
            <input
              type="color"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
            />
          </Field>
          {!state.ours && state.icon && <Notice kind="info">{t('tools.iconReplaces')}</Notice>}
          <div className="tool-form__actions">
            <button
              className="btn btn--primary"
              disabled={busy}
              onClick={() =>
                run('icon', async () => {
                  const change = await window.api.setFavicon(image.path, background)
                  setImage(null)
                  return changeNote(change, t('tools.iconMade'))
                })
              }
            >
              {t('tools.iconMake')}
            </button>
            <button className="btn" onClick={() => setImage(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
      <Explainer>{t('tools.iconHelp')}</Explainer>
      {show('icon')}
      {picking && (
        <MediaPicker
          title={t('tools.iconChoose')}
          onClose={() => setPicking(false)}
          onPick={(picked) => {
            setImage(picked)
            setPicking(false)
          }}
        />
      )}
    </Section>
  )
}
