import { useCallback, useEffect, useState } from 'react'
import { Explainer, Notice, Section } from '../components/Field'
import { useT } from '../i18n'
import { copyText, errorMessage } from '../lib/api'
import FormPlacer from './FormPlacer'
import FormEmbedPanel from '../components/FormEmbedPanel'
import { isStagingDomain, storedDomain } from '../../../shared/forms'
import type {
  FormsEmbed,
  FormsForm,
  FormsList,
  FormsProject,
  FormsUsage,
  Workspace
} from '../../../shared/types'

const SOURCE_BADGE = {
  account: 'forms.badgeAccount',
  hosted: 'forms.badgeHosted',
  self: 'forms.badgeSelf',
  unknown: 'forms.badgeUnknown'
} as const

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

interface Props {
  workspace: Workspace | null
  onEditPage: (path: string) => void
  /** Opened from a page: list that page's forms first. */
  focusPath?: string
}

type Status = { kind: 'error' | 'success'; text: string } | null

/**
 * Forms from CraftForms (unfinished/CRAFTFORMS.md): pick the project's account
 * and the website the forms are for, then insert a form at a spot on a page or
 * copy its snippet. Also lists every CraftForms embed already on the site.
 * Entirely optional; nothing here is needed to use CraftPages.
 */
export default function FormsView({ workspace, onEditPage, focusPath }: Props): React.JSX.Element {
  const t = useT()
  const [project, setProject] = useState<FormsProject | null>(null)
  const [list, setList] = useState<FormsList | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [connecting, setConnecting] = useState(false)
  const [editingDomain, setEditingDomain] = useState(false)
  const [domainInput, setDomainInput] = useState('')
  const [alsoSite, setAlsoSite] = useState(true)
  /** A form waiting for "this uses your last website" to be confirmed, and what to do then. */
  const [confirm, setConfirm] = useState<{ form: FormsForm; then: 'insert' | 'copy' } | null>(null)
  const [placing, setPlacing] = useState<FormsForm | null>(null)
  /** The live preview: which form, styled by which page's CSS (or the form's own). */
  const [previewing, setPreviewing] = useState<{
    title: string
    formId?: string
    key?: string
  } | null>(null)
  /** The embed whose settings are open ("path:index"). */
  const [editingEmbed, setEditingEmbed] = useState<string | null>(null)
  const [onlyPage, setOnlyPage] = useState<string | null>(focusPath ?? null)
  const [removingWebsite, setRemovingWebsite] = useState<string | null>(null)
  const [previewPage, setPreviewPage] = useState('')
  const [previewStyles, setPreviewStyles] = useState<'site' | 'form'>('site')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewNonce, setPreviewNonce] = useState(0)

  const loadList = useCallback(async (domain: string) => {
    setLoadingList(true)
    setListError(null)
    try {
      setList(await window.api.formsList(domain || undefined))
      // Embeds on pages resolve through the keys the list just cached.
      setProject(await window.api.formsProject())
    } catch (error) {
      setList(null)
      setListError(errorMessage(error))
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    if (!workspace) return
    let live = true
    window.api.formsProject().then(
      (next) => {
        if (!live) return
        setProject(next)
        if (next.account) void loadList(next.domain)
      },
      (error) => live && setStatus({ kind: 'error', text: errorMessage(error) })
    )
    return () => {
      live = false
    }
  }, [workspace, loadList])

  useEffect(() => {
    if (!previewing || !previewPage) return
    let live = true
    window.api
      .formPreviewUrl(
        { formId: previewing.formId, key: previewing.key },
        previewPage,
        previewStyles
      )
      .then(
        (url) => live && setPreviewUrl(url),
        (error) => live && setStatus({ kind: 'error', text: errorMessage(error) })
      )
    return () => {
      live = false
    }
  }, [previewing, previewPage, previewStyles])

  if (!workspace) {
    return (
      <div className="empty">
        <h2>{t('forms.title')}</h2>
        <p>{t('common.noProject')}</p>
      </div>
    )
  }
  if (!project) return <div className="muted">{t('common.loading')}</div>

  const domain = project.domain
  const requested = list?.requested
  const websites = list?.quota.websites

  if (placing) {
    return (
      <FormPlacer
        form={placing}
        domain={domain}
        pages={workspace.pages.map((page) => page.path)}
        onCancel={() => setPlacing(null)}
        onDone={async (result) => {
          setPlacing(null)
          setStatus({
            kind: 'success',
            text: t('forms.inserted', { form: placing.title, page: result.path })
          })
          await loadList(domain)
        }}
      />
    )
  }

  const connect = async (): Promise<void> => {
    setConnecting(true)
    setStatus(null)
    try {
      const account = await window.api.connectFormsAccount()
      const next = await window.api.setFormsProject({ account: account.id })
      setProject(next)
      await loadList(next.domain)
    } catch (error) {
      const text = errorMessage(error)
      if (!/cancelled/i.test(text)) setStatus({ kind: 'error', text })
    } finally {
      setConnecting(false)
    }
  }

  const chooseAccount = async (account: string): Promise<void> => {
    setStatus(null)
    setList(null)
    const next = await window.api.setFormsProject({ account })
    setProject(next)
    if (next.account) await loadList(next.domain)
  }

  const saveDomain = async (): Promise<void> => {
    const wanted = storedDomain(domainInput)
    if (!wanted) {
      setStatus({ kind: 'error', text: t('forms.websiteInvalid') })
      return
    }
    try {
      const next = await window.api.setFormsProject({
        domain: wanted,
        siteAddress: !project.siteDomain && alsoSite
      })
      setProject(next)
      setEditingDomain(false)
      setStatus(null)
      if (next.account) await loadList(next.domain)
    } catch (error) {
      setStatus({ kind: 'error', text: errorMessage(error) })
    }
  }

  /** Embedding uses the last free website: ask first. */
  const lastSlot = (): boolean =>
    requested?.status === 'available' &&
    !!websites &&
    websites.limit > 0 &&
    websites.used + 1 >= websites.limit

  const act = async (
    form: FormsForm,
    then: 'insert' | 'copy',
    confirmed = false
  ): Promise<void> => {
    if (!confirmed && !requested?.keys[form.id] && lastSlot()) {
      setConfirm({ form, then })
      return
    }
    setConfirm(null)
    setStatus(null)
    if (then === 'insert') {
      setPlacing(form)
      return
    }
    try {
      const ensured = await window.api.ensureFormEmbed(form.id, domain)
      await copyText(ensured.snippet)
      setStatus({ kind: 'success', text: t('forms.copied', { form: form.title }) })
      if (ensured.created) await loadList(domain)
    } catch (error) {
      setStatus({ kind: 'error', text: errorMessage(error) })
    }
  }

  const openPreview = (form: FormsForm): void => {
    // Styled by the page it's already on, else the home page.
    const on = project.embeds.find((embed) => embed.formId === form.id)?.path
    const pages = workspace.pages.map((page) => page.path)
    setPreviewPage(on ?? (pages.includes('index.html') ? 'index.html' : (pages[0] ?? '')))
    setPreviewUrl(null)
    setPreviewing({ title: form.title, formId: form.id })
  }

  /** Any embed with a key: through the account when it's the account's form, else from its own site. */
  const openEmbedPreview = (embed: FormsEmbed): void => {
    setPreviewPage(embed.path)
    setPreviewUrl(null)
    setPreviewing({
      title: embed.title || t('forms.unknownForm'),
      key: embed.key,
      ...(embed.source === 'account' && embed.formId ? { formId: embed.formId } : {})
    })
    window.scrollTo({ top: 0 })
  }

  const afterEmbedChange = async (message: string): Promise<void> => {
    setEditingEmbed(null)
    setStatus({ kind: 'success', text: message })
    if (project.account) await loadList(domain)
    else setProject(await window.api.formsProject())
  }

  const removeWebsite = async (website: string): Promise<void> => {
    setRemovingWebsite(null)
    try {
      const { released } = await window.api.releaseFormsWebsite(website)
      setStatus({
        kind: 'success',
        text: t('forms.websiteRemoved', { domain: website, count: released })
      })
      await loadList(domain)
    } catch (error) {
      setStatus({ kind: 'error', text: errorMessage(error) })
    }
  }

  const usage = (key: 'forms.usageForms' | 'forms.usageWebsites', value: FormsUsage): string =>
    t(key, { used: value.used, limit: value.limit === 0 ? t('forms.unlimited') : value.limit })

  const account = project.accounts.find((a) => a.id === project.account)
  const shownEmbeds = onlyPage ? project.embeds.filter((e) => e.path === onlyPage) : project.embeds
  // Where the pages are published: an embed for any other website won't load on them.
  const home = project.siteDomain || domain
  const askDomain = !domain || editingDomain

  return (
    <div className="settings">
      <p className="muted">{t('forms.intro')}</p>
      {status && <Notice kind={status.kind}>{status.text}</Notice>}

      {/* ---------- Account ---------- */}
      <Section
        title={t('forms.accountTitle')}
        description={project.accounts.length ? t('forms.chooseAccount') : t('forms.noAccounts')}
        actions={
          connecting ? (
            <span className="muted small">{t('forms.connecting')}</span>
          ) : (
            !account && (
              <button className="btn btn--accent" onClick={connect}>
                {t('forms.connect')}
              </button>
            )
          )
        }
      >
        {project.accounts.length > 0 && (
          <label className="field">
            <span className="field__label">{t('forms.accountLabel')}</span>
            <select value={project.account} onChange={(e) => chooseAccount(e.target.value)}>
              <option value="">{t('forms.accountNone')}</option>
              {project.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email}
                </option>
              ))}
            </select>
          </label>
        )}
        {account && list && (
          <p className="muted small">
            {usage('forms.usageForms', list.quota.forms)} ·{' '}
            {usage('forms.usageWebsites', list.quota.websites)}
            {' · '}
            <button className="link" onClick={() => window.open(list.urls.dashboard)}>
              {t('forms.dashboard')}
            </button>
          </p>
        )}
        {account && list && list.websites.length > 0 && (
          <ul className="forms-websites">
            {list.websites.map((site) => {
              const pages = project.embeds
                .filter((e) => e.domain === site.domain)
                .map((e) => e.path)
              return (
                <li key={site.domain}>
                  <span className="mono">{site.domain}</span>
                  <span className="muted small">
                    {' '}
                    ·{' '}
                    {t('forms.websiteForms', {
                      count: new Set(site.keys.map((k) => k.formId)).size
                    })}
                  </span>
                  {removingWebsite === site.domain ? (
                    <span className="forms-websites__confirm">
                      <span className="small">
                        {pages.length
                          ? t('forms.websiteRemoveUsed', { pages: [...new Set(pages)].join(', ') })
                          : t('forms.websiteRemoveConfirm', { domain: site.domain })}
                      </span>
                      <button
                        className="btn btn--small btn--danger"
                        onClick={() => removeWebsite(site.domain)}
                      >
                        {t('forms.websiteRemove')}
                      </button>
                      <button className="btn btn--small" onClick={() => setRemovingWebsite(null)}>
                        {t('common.cancel')}
                      </button>
                    </span>
                  ) : (
                    <button className="link small" onClick={() => setRemovingWebsite(site.domain)}>
                      {t('forms.websiteRemove')}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {account && listError && <Notice kind="error">{listError}</Notice>}
      </Section>

      {/* ---------- Website ---------- */}
      {account && (
        <Section title={t('forms.websiteTitle')} description={t('forms.websiteHint')}>
          {askDomain ? (
            <form
              className="forms-domain"
              onSubmit={(e) => {
                e.preventDefault()
                void saveDomain()
              }}
            >
              <label className="field">
                <span className="field__label">{t('forms.websiteAsk')}</span>
                <input
                  value={domainInput}
                  placeholder={t('forms.websitePlaceholder')}
                  onChange={(e) => setDomainInput(e.target.value)}
                  autoFocus
                />
              </label>
              {!project.siteDomain && (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={alsoSite}
                    onChange={(e) => setAlsoSite(e.target.checked)}
                  />
                  {t('forms.websiteAlsoSite')}
                </label>
              )}
              <div className="panel__actions">
                <button
                  className="btn btn--primary"
                  type="submit"
                  disabled={!storedDomain(domainInput)}
                >
                  {t('forms.websiteSave')}
                </button>
                {domain && (
                  <button className="btn" type="button" onClick={() => setEditingDomain(false)}>
                    {t('common.cancel')}
                  </button>
                )}
              </div>
            </form>
          ) : (
            <>
              <div className="forms-domain__current">
                <strong className="mono">{domain}</strong>
                <button
                  className="btn btn--small"
                  onClick={() => {
                    setDomainInput(domain)
                    setEditingDomain(true)
                  }}
                >
                  {t('forms.websiteChange')}
                </button>
              </div>
              {requested?.status === 'authorised' && (
                <p className="small">{t('forms.statusAuthorised', { domain })}</p>
              )}
              {requested?.status === 'available' && websites && (
                <p className="small">
                  {websites.limit === 0
                    ? t('forms.statusAvailableUnlimited')
                    : lastSlot()
                      ? t('forms.statusAvailableLast', { domain })
                      : t('forms.statusAvailable', { limit: websites.limit })}
                </p>
              )}
              {requested?.status === 'over_limit' && list && (
                <Notice kind="warning">
                  {t('forms.statusOver', { domain })}{' '}
                  <button className="link" onClick={() => window.open(list.urls.upgrade)}>
                    {t('forms.upgrade')}
                  </button>
                </Notice>
              )}
              {project.siteDomain && project.siteDomain !== domain && (
                <Notice kind="warning">
                  {t('forms.mismatch', { domain, site: project.siteDomain })}
                </Notice>
              )}
              {isStagingDomain(domain) && <Explainer>{t('forms.staging', { domain })}</Explainer>}
            </>
          )}
        </Section>
      )}

      {/* ---------- Forms ---------- */}
      {account && domain && !editingDomain && (
        <Section
          title={t('forms.formsTitle')}
          actions={
            <button
              className="btn btn--small"
              disabled={loadingList}
              onClick={() => loadList(domain)}
            >
              {loadingList ? t('common.loading') : t('forms.refresh')}
            </button>
          }
        >
          {list && list.forms.length === 0 && <p className="muted">{t('forms.formsEmpty')}</p>}
          {list && list.forms.length > 0 && (
            <ul className="connections">
              {list.forms.map((form) => {
                const onSite = Boolean(requested?.keys[form.id])
                const blocked = !form.embeddable || (requested?.status === 'over_limit' && !onSite)
                return (
                  <li key={form.id}>
                    <div className="connections__info">
                      <div className="connections__name">
                        <strong>{form.title}</strong>
                        {!form.published && (
                          <span className="badge badge--muted">{t('forms.draft')}</span>
                        )}
                        {onSite && (
                          <span className="badge badge--ok">
                            {t('forms.onWebsite', { domain })}
                          </span>
                        )}
                      </div>
                      {!form.published && <div className="muted small">{t('forms.draftHint')}</div>}
                    </div>
                    {confirm?.form.id === form.id ? (
                      <div className="connections__confirm" role="group">
                        <span className="small">{t('forms.confirmLast', { domain })}</span>
                        <div className="panel__actions">
                          <button
                            className="btn btn--small btn--accent"
                            onClick={() => act(form, confirm.then, true)}
                          >
                            {t('forms.confirmYes')}
                          </button>
                          <button className="btn btn--small" onClick={() => setConfirm(null)}>
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="panel__actions">
                        <button
                          className="btn btn--small"
                          disabled={!form.published}
                          aria-pressed={previewing?.formId === form.id}
                          onClick={() => openPreview(form)}
                        >
                          {t('forms.preview')}
                        </button>
                        <button
                          className="btn btn--small"
                          disabled={blocked}
                          onClick={() => act(form, 'copy')}
                        >
                          {t('forms.copy')}
                        </button>
                        <button
                          className="btn btn--small btn--accent"
                          disabled={blocked || workspace.pages.length === 0}
                          onClick={() => act(form, 'insert')}
                        >
                          {t('forms.insert')}
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
      )}

      {/* ---------- Preview ---------- */}
      {previewing && (
        <Section
          title={t('forms.previewTitle', { form: previewing.title })}
          description={t('forms.previewHint')}
          actions={
            <button className="btn btn--small" onClick={() => setPreviewing(null)}>
              {t('forms.previewClose')}
            </button>
          }
        >
          <div className="forms-preview__controls">
            <label className="field">
              <span className="field__label">{t('forms.previewStylesFrom')}</span>
              <select
                value={previewPage}
                disabled={previewStyles === 'form'}
                onChange={(e) => setPreviewPage(e.target.value)}
              >
                {workspace.pages.map((page) => (
                  <option key={page.path} value={page.path}>
                    {page.path}
                  </option>
                ))}
              </select>
            </label>
            <div className="segmented" role="radiogroup" aria-label={t('forms.previewStylesLabel')}>
              {(['site', 'form'] as const).map((value) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={previewStyles === value}
                  className={previewStyles === value ? 'is-active' : ''}
                  onClick={() => setPreviewStyles(value)}
                >
                  {t(value === 'site' ? 'forms.previewSite' : 'forms.previewOwn')}
                </button>
              ))}
            </div>
            <button className="btn btn--small" onClick={() => setPreviewNonce((n) => n + 1)}>
              {t('forms.refresh')}
            </button>
          </div>
          {previewUrl && (
            <iframe
              key={`${previewUrl}#${previewNonce}`}
              className="forms-preview__frame"
              src={previewUrl}
              title={t('forms.previewTitle', { form: previewing.title })}
              // Like Site search's preview: the form's scripts need storage, and the page is
              // on the preview server's own origin, never the app's.
              sandbox="allow-scripts allow-same-origin"
            />
          )}
        </Section>
      )}

      {/* ---------- On this site ---------- */}
      <Section
        title={onlyPage ? t('forms.onPageTitle', { page: onlyPage }) : t('forms.onSiteTitle')}
        description={t('forms.onSiteHint')}
        actions={
          onlyPage && (
            <button className="btn btn--small" onClick={() => setOnlyPage(null)}>
              {t('forms.showAll')}
            </button>
          )
        }
      >
        {shownEmbeds.length === 0 ? (
          <p className="muted">{t('forms.onSiteEmpty')}</p>
        ) : (
          <ul className="connections">
            {shownEmbeds.map((embed) => {
              const id = `${embed.path}:${embed.index}`
              return (
                <li key={id} className={editingEmbed === id ? 'is-open' : ''}>
                  <div className="connections__info">
                    <div className="connections__name">
                      <strong>
                        {embed.title ||
                          t(embed.source === 'account' ? 'forms.unknownForm' : 'forms.formGeneric')}
                      </strong>
                      <span className={`badge${embed.source === 'unknown' ? ' badge--warn' : ''}`}>
                        {t(SOURCE_BADGE[embed.source], { site: hostOf(embed.site) })}
                      </span>
                      <span className="mono small">{embed.path}</span>
                    </div>
                    <div className="connections__meta muted small">
                      {embed.domain && t('forms.loadsOn', { domain: embed.domain })}
                    </div>
                    {embed.domain && home && embed.domain !== home && (
                      <b className="connections__warn small">
                        {t('forms.wrongDomain', { domain: embed.domain, site: home })}
                      </b>
                    )}
                    {!embed.hasLoader && (
                      <b className="connections__warn small">{t('forms.noLoader')}</b>
                    )}
                    {editingEmbed === id && (
                      <FormEmbedPanel
                        embed={embed}
                        list={embed.source === 'account' ? list : null}
                        accountEmail={account?.email ?? ''}
                        onChanged={(message) => void afterEmbedChange(message)}
                        onPreview={() => openEmbedPreview(embed)}
                      />
                    )}
                  </div>
                  <div className="panel__actions">
                    <button
                      className="btn btn--small"
                      aria-expanded={editingEmbed === id}
                      onClick={() => setEditingEmbed(editingEmbed === id ? null : id)}
                    >
                      {t(editingEmbed === id ? 'forms.close' : 'forms.edit')}
                    </button>
                    <button className="btn btn--small" onClick={() => onEditPage(embed.path)}>
                      {t('forms.openPage')}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}
