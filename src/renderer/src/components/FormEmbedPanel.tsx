import { useState } from 'react'
import { Notice } from './Field'
import { useT } from '../i18n'
import { errorMessage } from '../lib/api'
import { storedDomain } from '../../../shared/forms'
import type { FormsEmbed, FormsList } from '../../../shared/types'

interface Props {
  embed: FormsEmbed
  /** The connected account's live list, when this embed is from it. */
  list: FormsList | null
  accountEmail: string
  /** Called after any change, with a message for the user. */
  onChanged: (message: string) => void
  onPreview: () => void
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/**
 * An embed's settings as fields, whoever made it (craftforms.app or a self-hosted
 * CraftForms): the snippet is the same, so its key, language, catalog item and
 * loader options can be edited without the code editor. For the connected
 * account's embeds, it also swaps the form or the website.
 */
export default function FormEmbedPanel({
  embed,
  list,
  accountEmail,
  onChanged,
  onPreview
}: Props): React.JSX.Element {
  const t = useT()
  const [key, setKey] = useState(embed.key)
  const [lang, setLang] = useState(embed.settings.lang)
  const [resourceId, setResourceId] = useState(embed.settings.resourceId)
  const [resourceSig, setResourceSig] = useState(embed.settings.resourceSig)
  const [spinner, setSpinner] = useState(embed.settings.spinner)
  const [loadingLabel, setLoadingLabel] = useState(embed.settings.loadingLabel)
  const [website, setWebsite] = useState(embed.domain ?? '')
  const [loaderUrl, setLoaderUrl] = useState(
    list?.loaderUrl ||
      (embed.site ? `${embed.site}/wp-content/plugins/craftforms/build/webcomponents/embed.js` : '')
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  /** After a website change: the old website's key isn't used any more, so its slot can go. */
  const [freeOld, setFreeOld] = useState<{ formId: string; domain: string } | null>(null)

  const run = async (task: () => Promise<string>): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      onChanged(await task())
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const host = hostOf(embed.site)
  const sourceText =
    embed.source === 'account'
      ? t('forms.sourceAccount', { email: accountEmail })
      : embed.source === 'hosted'
        ? t('forms.sourceHosted', { site: host })
        : embed.source === 'self'
          ? t('forms.sourceSelf', { site: host })
          : t('forms.sourceUnknown')
  const fromAccount = embed.source === 'account' && list !== null
  const changed =
    key !== embed.key ||
    lang !== embed.settings.lang ||
    resourceId !== embed.settings.resourceId ||
    resourceSig !== embed.settings.resourceSig ||
    spinner !== embed.settings.spinner ||
    loadingLabel !== embed.settings.loadingLabel

  if (embed.inPost) {
    return (
      <div className="form-embed-panel">
        <p className="small">{sourceText}</p>
        <Notice kind="info">{t('forms.panelInPost')}</Notice>
        {embed.source !== 'unknown' && (
          <div className="panel__actions">
            <button className="btn btn--small" onClick={onPreview}>
              {t('forms.preview')}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="form-embed-panel">
      <p className="small">{sourceText}</p>
      {error && <Notice kind="error">{error}</Notice>}

      {fromAccount && (
        <div className="form-embed-panel__row">
          <label className="field">
            <span className="field__label">{t('forms.panelForm')}</span>
            <select
              value={embed.formId ?? ''}
              disabled={busy}
              onChange={(e) =>
                run(async () => {
                  await window.api.changeEmbedForm(embed.path, embed.index, e.target.value)
                  return t('forms.panelFormChanged')
                })
              }
            >
              {!embed.formId && <option value="">{t('forms.unknownForm')}</option>}
              {list.forms
                .filter((form) => form.embeddable || form.id === embed.formId)
                .map((form) => (
                  <option key={form.id} value={form.id}>
                    {form.title}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">{t('forms.panelWebsite')}</span>
            <span className="form-embed-panel__inline">
              <input value={website} onChange={(e) => setWebsite(e.target.value)} />
              <button
                className="btn btn--small"
                disabled={busy || !storedDomain(website) || storedDomain(website) === embed.domain}
                onClick={() =>
                  run(async () => {
                    const result = await window.api.changeEmbedWebsite(
                      embed.path,
                      embed.index,
                      website
                    )
                    if (result.oldDomain && !result.oldStillUsed && embed.formId) {
                      setFreeOld({ formId: embed.formId, domain: result.oldDomain })
                    }
                    return t('forms.panelWebsiteChanged', { domain: storedDomain(website) })
                  })
                }
              >
                {t('forms.websiteChange')}
              </button>
            </span>
          </label>
        </div>
      )}
      {freeOld && (
        <Notice kind="info">
          {t('forms.panelFreeOld', { domain: freeOld.domain })}{' '}
          <button
            className="link"
            onClick={() =>
              run(async () => {
                await window.api.releaseFormEmbed(freeOld.formId, freeOld.domain)
                setFreeOld(null)
                return t('forms.panelFreed', { domain: freeOld.domain })
              })
            }
          >
            {t('forms.panelFreeOldYes')}
          </button>
        </Notice>
      )}

      <details className="form-embed-panel__settings" open={!fromAccount}>
        <summary>{t('forms.panelSettings')}</summary>
        <label className="field">
          <span className="field__label">{t('forms.panelKey')}</span>
          <input
            className="mono"
            value={key}
            spellCheck={false}
            onChange={(e) => setKey(e.target.value)}
          />
          <span className="field__hint">{t('forms.panelKeyHint')}</span>
        </label>
        <div className="form-embed-panel__row">
          <label className="field">
            <span className="field__label">{t('forms.panelLang')}</span>
            <input
              value={lang}
              placeholder={t('forms.panelLangPlaceholder')}
              onChange={(e) => setLang(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">{t('forms.panelLoadingLabel')}</span>
            <input
              value={loadingLabel}
              placeholder="Loading form"
              onChange={(e) => setLoadingLabel(e.target.value)}
            />
          </label>
        </div>
        <div className="form-embed-panel__row">
          <label className="field">
            <span className="field__label">{t('forms.panelResourceId')}</span>
            <input
              value={resourceId}
              inputMode="numeric"
              onChange={(e) => setResourceId(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">{t('forms.panelResourceSig')}</span>
            <input
              className="mono"
              value={resourceSig}
              spellCheck={false}
              onChange={(e) => setResourceSig(e.target.value)}
            />
          </label>
        </div>
        <p className="field__hint">{t('forms.panelResourceHint')}</p>
        <label className="check">
          <input type="checkbox" checked={spinner} onChange={(e) => setSpinner(e.target.checked)} />
          {t('forms.panelSpinner')}
        </label>
        <div className="panel__actions">
          <button
            className="btn btn--primary btn--small"
            disabled={busy || !changed}
            onClick={() =>
              run(async () => {
                await window.api.updateFormEmbed(embed.path, embed.index, {
                  ...(key !== embed.key ? { key } : {}),
                  lang,
                  resourceId,
                  resourceSig,
                  spinner,
                  loadingLabel
                })
                return t('forms.panelSaved')
              })
            }
          >
            {t('forms.panelSave')}
          </button>
        </div>
      </details>

      {!embed.hasLoader && (
        <div className="form-embed-panel__loader">
          <Notice kind="warning">{t('forms.noLoader')}</Notice>
          <label className="field">
            <span className="field__label">{t('forms.panelLoader')}</span>
            <span className="form-embed-panel__inline">
              <input
                className="mono"
                value={loaderUrl}
                spellCheck={false}
                onChange={(e) => setLoaderUrl(e.target.value)}
              />
              <button
                className="btn btn--small"
                disabled={busy || !loaderUrl}
                onClick={() =>
                  run(async () => {
                    await window.api.addFormLoader(embed.path, loaderUrl)
                    return t('forms.panelLoaderAdded')
                  })
                }
              >
                {t('forms.panelLoaderAdd')}
              </button>
            </span>
            <span className="field__hint">{t('forms.panelLoaderHint')}</span>
          </label>
        </div>
      )}

      <div className="panel__actions">
        {embed.source !== 'unknown' && (
          <button className="btn btn--small" onClick={onPreview}>
            {t('forms.preview')}
          </button>
        )}
        {confirmRemove ? (
          <>
            <span className="small">{t('forms.panelRemoveConfirm')}</span>
            <button
              className="btn btn--small btn--danger"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await window.api.removeFormEmbed(embed.path, embed.index)
                  return t('forms.panelRemoved', { page: embed.path })
                })
              }
            >
              {t('forms.panelRemoveYes')}
            </button>
            <button className="btn btn--small" onClick={() => setConfirmRemove(false)}>
              {t('common.cancel')}
            </button>
          </>
        ) : (
          <button className="btn btn--small" onClick={() => setConfirmRemove(true)}>
            {t('forms.panelRemove')}
          </button>
        )}
      </div>
    </div>
  )
}
