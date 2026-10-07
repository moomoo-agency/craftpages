import { useEffect, useId, useState } from 'react'
import { Field, Notice, Section } from '../components/Field'
import MediaPicker from '../components/MediaPicker'
import { useT, type Key } from '../i18n'
import { errorMessage } from '../lib/api'
import { defaultRobots, identityScript } from '../../../shared/identity'
import type {
  SeoIssue,
  SeoReport,
  SiteIdentity,
  SitemapStatus,
  SiteSettings,
  Workspace
} from '../../../shared/types'

interface Props {
  workspace: Workspace | null
  onEditPage: (path: string) => void
}

/** The tag on each issue. */
const SEVERITY: Record<SeoIssue['severity'], Key> = {
  error: 'seo.tagError',
  warning: 'seo.tagWarning',
  info: 'seo.tagInfo'
}

/** The severity filter's buttons. */
const SEVERITY_FILTER: Record<SeoIssue['severity'], Key> = {
  error: 'seo.filterError',
  warning: 'seo.filterWarning',
  info: 'seo.filterInfo'
}

const KINDS: Record<SeoIssue['kind'], Key> = {
  title: 'seo.kindTitle',
  description: 'seo.kindDescription',
  headings: 'seo.kindHeadings',
  images: 'seo.kindImages',
  links: 'seo.kindLinks',
  canonical: 'seo.kindCanonical',
  social: 'seo.kindSocial',
  language: 'seo.kindLanguage',
  indexing: 'seo.kindIndexing'
}

type Status = { kind: 'error' | 'success' | 'info'; text: string } | null

/** Site-wide SEO: the check panel, defaults, sitemap, robots.txt and site identity. */
export default function SeoView({ workspace, onEditPage }: Props): React.JSX.Element {
  const t = useT()
  const id = useId()
  const [report, setReport] = useState<SeoReport | null>(null)
  const [checking, setChecking] = useState(false)
  const [severity, setSeverity] = useState<'all' | SeoIssue['severity']>('all')
  const [kind, setKind] = useState<'all' | SeoIssue['kind']>('all')
  const [site, setSite] = useState<SiteSettings | null>(null)
  /** The text being edited; null when the site has no robots.txt (undefined: loading). */
  const [robots, setRobots] = useState<string | null | undefined>(undefined)
  const [sitemap, setSitemap] = useState<SitemapStatus | null>(null)
  const [identity, setIdentity] = useState<SiteIdentity | null>(null)
  const [addedCode, setAddedCode] = useState<string | null>(null)
  const [newIdentity, setNewIdentity] = useState({ name: '', url: '', logo: '' })
  const [picker, setPicker] = useState<'default' | 'logo' | null>(null)
  const [status, setStatus] = useState<Record<string, Status>>({})

  const note = (section: string, value: Status): void =>
    setStatus((s) => ({ ...s, [section]: value }))

  const check = async (): Promise<void> => {
    setChecking(true)
    try {
      setReport(await window.api.auditSeo())
    } catch (e) {
      note('check', { kind: 'error', text: errorMessage(e) })
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    if (!workspace) return
    window.api
      .auditSeo()
      .then(setReport, (e) => note('check', { kind: 'error', text: errorMessage(e) }))
    window.api.getSiteSettings().then((next) => {
      setSite(next)
      setNewIdentity({ name: next.siteName, url: next.baseUrl, logo: '' })
    })
    window.api.getRobots().then(setRobots)
    window.api.getSitemapStatus().then(setSitemap)
    window.api.getSiteIdentity().then((next) => {
      setIdentity(next)
      setAddedCode(null)
    })
  }, [workspace])

  if (!workspace) {
    return (
      <div className="empty">
        <h2>{t('seo.title')}</h2>
        <p>{t('common.noProject')}</p>
      </div>
    )
  }

  /** Saves the SEO settings; `section` is where the confirmation is shown. */
  const saveSeo = async (section: 'defaults' | 'sitemap'): Promise<void> => {
    if (!site) return
    try {
      setSite(await window.api.saveSiteSettings({ seo: site.seo }))
      setSitemap(await window.api.getSitemapStatus())
      note(section, {
        kind: 'success',
        text: t(section === 'defaults' ? 'seo.defaultsSaved' : 'seo.sitemapSettingsSaved')
      })
    } catch (e) {
      note(section, { kind: 'error', text: errorMessage(e) })
    }
  }

  const rebuildSitemap = async (): Promise<void> => {
    try {
      const existed = sitemap?.exists
      const result = await window.api.rebuildSitemap()
      setSitemap(await window.api.getSitemapStatus())
      note('sitemap', {
        kind: 'success',
        text: t(
          !existed
            ? 'seo.sitemapCreated'
            : result.changed
              ? 'seo.sitemapRebuilt'
              : 'seo.sitemapUpToDate',
          { count: result.urls }
        )
      })
    } catch (e) {
      note('sitemap', { kind: 'error', text: errorMessage(e) })
    }
  }

  const saveRobots = async (text: string, created = false): Promise<void> => {
    try {
      await window.api.saveRobots(text)
      setRobots(await window.api.getRobots())
      note('robots', {
        kind: 'success',
        text: t(created ? 'seo.robotsCreated' : 'seo.robotsSaved')
      })
    } catch (e) {
      note('robots', { kind: 'error', text: errorMessage(e) })
    }
  }

  const addIdentity = async (): Promise<void> => {
    try {
      const result = await window.api.addSiteIdentity(newIdentity)
      setIdentity(result.identity)
      setAddedCode(result.added)
      note('identity', { kind: 'success', text: t('seo.identityAdded') })
    } catch (e) {
      note('identity', { kind: 'error', text: errorMessage(e) })
    }
  }

  const viewFile = async (path: string): Promise<void> =>
    window.api.openExternal(await window.api.previewUrl(path))

  const show = (section: string): React.ReactNode => {
    const current = status[section]
    return (
      current && (
        <div role={current.kind === 'error' ? 'alert' : 'status'}>
          <Notice kind={current.kind}>{current.text}</Notice>
        </div>
      )
    )
  }

  const visible = (report?.issues ?? []).filter(
    (issue) =>
      (severity === 'all' || issue.severity === severity) && (kind === 'all' || issue.kind === kind)
  )
  const byPage = new Map<string, SeoIssue[]>()
  for (const issue of visible) byPage.set(issue.page, [...(byPage.get(issue.page) ?? []), issue])
  const sitemapLine = site?.baseUrl
    ? `Sitemap: ${site.baseUrl}/sitemap.xml`
    : 'Sitemap: /sitemap.xml'
  const patternExample = site
    ? site.seo.titlePattern
        .replace(/%title%/g, t('seo.titlePatternExample'))
        .replace(/%site%/g, site.siteName)
    : ''

  return (
    <div className="seo">
      <Section
        title={t('seo.checkTitle')}
        description={
          report
            ? t('seo.checkSummary', { count: report.pages, ...report.counts })
            : t('seo.checking')
        }
        actions={
          <button className="btn" onClick={check} disabled={checking}>
            {checking ? t('seo.checkingShort') : t('seo.checkAgain')}
          </button>
        }
      >
        <div className="seo__filters">
          <div className="segmented" role="radiogroup" aria-label={t('seo.severityFilter')}>
            {(['all', 'error', 'warning', 'info'] as const).map((value) => (
              <button
                key={value}
                role="radio"
                aria-checked={severity === value}
                className={severity === value ? 'is-active' : ''}
                onClick={() => setSeverity(value)}
              >
                {value === 'all' ? t('common.all') : t(SEVERITY_FILTER[value])}
                {report && value !== 'all' && (
                  <span className="seo__count">{report.counts[value]}</span>
                )}
              </button>
            ))}
          </div>
          <select
            value={kind}
            aria-label={t('seo.kindFilter')}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="all">{t('seo.allKinds')}</option>
            {Object.entries(KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </select>
        </div>
        {show('check')}
        {report && visible.length === 0 && (
          <p className="muted seo__empty">
            {report.issues.length ? (
              t('seo.nothingInFilter')
            ) : (
              <>
                {t('seo.noIssues')} <span aria-hidden="true">🎉</span>
              </>
            )}
          </p>
        )}
        {[...byPage].map(([page, issues]) => (
          <div key={page} className="seo-page">
            <header>
              <h3 className="mono seo-page__path">{page}</h3>
              <button
                className="btn btn--small"
                aria-label={t('seo.openPageLabel', { page })}
                onClick={() => onEditPage(page)}
              >
                {t('seo.openPage')}
              </button>
            </header>
            <ul>
              {issues.map((issue, i) => (
                <li key={i} className={`seo-issue seo-issue--${issue.severity}`}>
                  <span className="seo-issue__tag">{t(SEVERITY[issue.severity])}</span>
                  <span>
                    {issue.message}
                    {issue.detail && (
                      <small className="mono muted seo-issue__detail">
                        {issue.detail.join(' · ')}
                      </small>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      {site && (
        <Section
          title={t('seo.defaultsTitle')}
          description={t('seo.defaultsDescription')}
          actions={
            <button className="btn btn--primary" onClick={() => saveSeo('defaults')}>
              {t('common.save')}
            </button>
          }
        >
          <div className="grid-2">
            <Field
              label={t('seo.titlePattern')}
              hint={t.rich('seo.titlePatternHint', {
                title: <code>%title%</code>,
                site: <code>%site%</code>,
                example: patternExample
              })}
            >
              <input
                value={site.seo.titlePattern}
                onChange={(e) =>
                  setSite({ ...site, seo: { ...site.seo, titlePattern: e.target.value } })
                }
              />
            </Field>
            <div className="field">
              <label className="field__label" htmlFor={`${id}-image`}>
                {t('seo.defaultImage')}
              </label>
              <div className="input-group">
                <input
                  id={`${id}-image`}
                  className="mono"
                  aria-describedby={`${id}-image-hint`}
                  value={site.seo.defaultImage}
                  placeholder="/assets/og-image.jpg"
                  onChange={(e) =>
                    setSite({ ...site, seo: { ...site.seo, defaultImage: e.target.value } })
                  }
                />
                <button className="btn" onClick={() => setPicker('default')}>
                  {t('common.choose')}
                </button>
              </div>
              <span className="field__hint" id={`${id}-image-hint`}>
                {t('seo.defaultImageHint')}
              </span>
            </div>
          </div>
          {show('defaults')}
        </Section>
      )}

      {site && (
        <Section
          title="sitemap.xml"
          description={t('seo.sitemapDescription')}
          actions={
            <button className="btn btn--primary" onClick={() => saveSeo('sitemap')}>
              {t('common.save')}
            </button>
          }
        >
          {sitemap && (
            <div className="file-status">
              <span
                className={`badge${sitemap.exists ? (sitemap.upToDate ? ' badge--ok' : ' badge--warn') : ''}`}
              >
                {t(
                  !sitemap.exists
                    ? 'seo.fileMissing'
                    : sitemap.upToDate
                      ? 'seo.sitemapCurrent'
                      : 'seo.sitemapStale'
                )}
              </span>
              <span>
                {sitemap.exists
                  ? t('seo.sitemapStatus', {
                      count: sitemap.urls,
                      date: new Date(sitemap.modified!).toLocaleString()
                    })
                  : t('seo.sitemapMissing')}{' '}
                {sitemap.exists &&
                  !sitemap.upToDate &&
                  t('seo.sitemapWouldList', { count: sitemap.pages })}
              </span>
              <span className="file-status__actions">
                {sitemap.exists && (
                  <button
                    className="btn btn--small btn--ghost"
                    onClick={() => viewFile('sitemap.xml')}
                  >
                    {t('seo.viewFile')}
                  </button>
                )}
                <button className="btn btn--small" onClick={rebuildSitemap}>
                  {t(sitemap.exists ? 'seo.rebuildSitemap' : 'seo.createSitemap')}
                </button>
              </span>
            </div>
          )}
          <div className="seo-check">
            <label className="check check--inline">
              <input
                type="checkbox"
                aria-describedby={`${id}-sitemap-hint`}
                checked={site.seo.sitemapAuto}
                onChange={(e) =>
                  setSite({ ...site, seo: { ...site.seo, sitemapAuto: e.target.checked } })
                }
              />
              <span>{t('seo.sitemapAuto')}</span>
            </label>
            <p className="field__hint" id={`${id}-sitemap-hint`}>
              {t('seo.sitemapAutoHint')}
            </p>
          </div>
          <Field
            label={t('seo.sitemapExclude')}
            hint={t.rich('seo.sitemapExcludeHint', {
              a: <code>thank-you/**</code>,
              b: <code>drafts/*.html</code>
            })}
          >
            <textarea
              className="mono"
              rows={2}
              value={site.seo.sitemapExclude.join('\n')}
              onChange={(e) =>
                setSite({
                  ...site,
                  seo: { ...site.seo, sitemapExclude: e.target.value.split('\n') }
                })
              }
            />
          </Field>
          {show('sitemap')}
        </Section>
      )}

      <Section
        title="robots.txt"
        description={t('seo.robotsDescription')}
        actions={
          typeof robots === 'string' && (
            <button className="btn btn--primary" onClick={() => saveRobots(robots)}>
              {t('common.save')}
            </button>
          )
        }
      >
        {robots === null && (
          <div className="file-status">
            <span className="badge">{t('seo.fileMissing')}</span>
            <span>{t('seo.robotsMissing')}</span>
            <span className="file-status__actions">
              <button
                className="btn btn--small btn--primary"
                onClick={() => saveRobots(defaultRobots(site?.baseUrl ?? ''), true)}
              >
                {t('seo.robotsCreate')}
              </button>
            </span>
          </div>
        )}
        {robots === null && (
          <pre className="code" aria-label={t('seo.robotsDefaultLabel')}>
            {defaultRobots(site?.baseUrl ?? '')}
          </pre>
        )}
        {typeof robots === 'string' && (
          <>
            <div className="file-status">
              <span className="badge badge--ok">{t('seo.fileExists')}</span>
              <span className="file-status__actions">
                <button
                  className="btn btn--small btn--ghost"
                  onClick={() => viewFile('robots.txt')}
                >
                  {t('seo.viewFile')}
                </button>
              </span>
            </div>
            <textarea
              className="mono"
              rows={6}
              aria-label="robots.txt"
              value={robots}
              placeholder={'User-agent: *\nAllow: /'}
              onChange={(e) => setRobots(e.target.value)}
            />
            {!/^\s*sitemap:/im.test(robots) && (
              <Notice kind="info">
                {t.rich('seo.robotsNoSitemap', {
                  link: (chunk) => (
                    <button
                      className="link"
                      onClick={() => setRobots(`${robots.replace(/\s*$/, '\n')}\n${sitemapLine}\n`)}
                    >
                      {chunk}
                    </button>
                  )
                })}
              </Notice>
            )}
          </>
        )}
        {show('robots')}
      </Section>

      <Section title={t('seo.identityTitle')} description={t('seo.identityDescription')}>
        {!identity ? null : identity.organization ? (
          <p>
            <strong>{identity.organization.name}</strong> ·{' '}
            <span className="mono muted">{identity.organization.url}</span>
            {identity.organization.logo && (
              <>
                {' '}
                ·{' '}
                {t.rich('seo.identityLogo', {
                  logo: <span className="mono muted">{identity.organization.logo}</span>
                })}
              </>
            )}
            <br />
            <span className="muted small">
              {t(identity.website ? 'seo.identityFoundWithWebsite' : 'seo.identityFound')}
            </span>
          </p>
        ) : (
          <>
            <p className="muted small">{t('seo.identityMissing')}</p>
            <div className="grid-3">
              <Field label={t('seo.identityName')}>
                <input
                  value={newIdentity.name}
                  onChange={(e) => setNewIdentity({ ...newIdentity, name: e.target.value })}
                />
              </Field>
              <Field label={t('seo.identityUrl')}>
                <input
                  value={newIdentity.url}
                  onChange={(e) => setNewIdentity({ ...newIdentity, url: e.target.value })}
                />
              </Field>
              <div className="field">
                <label className="field__label" htmlFor={`${id}-logo`}>
                  {t('seo.identityLogoLabel')}
                </label>
                <div className="input-group">
                  <input
                    id={`${id}-logo`}
                    className="mono"
                    value={newIdentity.logo}
                    onChange={(e) => setNewIdentity({ ...newIdentity, logo: e.target.value })}
                  />
                  <button className="btn" onClick={() => setPicker('logo')}>
                    {t('common.choose')}
                  </button>
                </div>
              </div>
            </div>
            <button
              className="btn btn--primary"
              disabled={!newIdentity.name || !newIdentity.url}
              onClick={addIdentity}
            >
              {t('seo.identityAdd')}
            </button>
          </>
        )}
        {identity?.organization && (addedCode ?? identity.code) && (
          <>
            <p className="small">
              {t.rich(addedCode ? 'seo.identityAddedCode' : 'seo.identityCode', {
                file: <code>index.html</code>,
                head: <code>{'</head>'}</code>
              })}
            </p>
            <pre className="code">{addedCode ?? identity.code}</pre>
          </>
        )}
        {identity && !identity.organization && (
          <>
            <p className="small">
              {t.rich('seo.identityPreview', {
                file: <code>index.html</code>,
                head: <code>{'</head>'}</code>
              })}
            </p>
            <pre className="code">{identityScript(newIdentity, !identity.website)}</pre>
          </>
        )}
        {show('identity')}
      </Section>

      {picker && (
        <MediaPicker
          title={picker === 'default' ? t('seo.defaultImage') : t('seo.identityLogoLabel')}
          onClose={() => setPicker(null)}
          onPick={(image) => {
            const path = `/${image.path}`
            if (picker === 'default' && site)
              setSite({ ...site, seo: { ...site.seo, defaultImage: path } })
            if (picker === 'logo')
              setNewIdentity({ ...newIdentity, logo: (site?.baseUrl ?? '') + path })
            setPicker(null)
          }}
        />
      )}
    </div>
  )
}
