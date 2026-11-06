import { useEffect, useId, useRef, useState } from 'react'
import { Explainer, Field, Notice, Section } from '../components/Field'
import SectionPage from '../components/SectionPage'
import TrackingSection from '../components/TrackingSection'
import { ListSearch, NoMatches, Pagination } from '../components/ListControls'
import { useFilteredList } from '../lib/list'
import { changeNote, useNotes } from '../lib/notes'
import { useT, type Key } from '../i18n'
import { errorMessage } from '../lib/api'
import type {
  ConsentBanner,
  ConsentCategory,
  ConsentItem,
  ConsentState,
  ConsentTexts,
  SiteLanguage,
  Workspace
} from '../../../shared/types'

interface Props {
  workspace: Workspace | null
}

const CATEGORY: Record<ConsentCategory, Key> = {
  necessary: 'consent.catNecessary',
  analytics: 'consent.catAnalytics',
  marketing: 'consent.catMarketing',
  embeds: 'consent.catEmbeds'
}

const TEXT_FIELDS: { field: keyof ConsentTexts; label: Key; long?: boolean }[] = [
  { field: 'title', label: 'consent.textTitle' },
  { field: 'message', label: 'consent.textMessage', long: true },
  { field: 'accept', label: 'consent.textAccept' },
  { field: 'reject', label: 'consent.textReject' },
  { field: 'choose', label: 'consent.textChoose' },
  { field: 'save', label: 'consent.textSave' },
  { field: 'privacyText', label: 'consent.textPrivacy' },
  { field: 'privacyUrl', label: 'consent.textPrivacyUrl' }
]

const EMPTY: ConsentTexts = {
  title: '',
  message: '',
  accept: '',
  reject: '',
  choose: '',
  save: '',
  privacyText: '',
  privacyUrl: ''
}

/** What waits for consent right now, as one line per item. */
function statusOf(item: ConsentItem): Key {
  if (item.suggested === 'cookieless' && !item.category) return 'consent.statusCookieless'
  if (item.category === 'necessary' || (!item.category && item.suggested === 'necessary'))
    return 'consent.statusNecessary'
  if (item.open && item.held) return 'consent.statusPartly'
  if (item.held) return 'consent.statusHeld'
  if (!item.category && item.suggested === null) return 'consent.statusUnknown'
  return 'consent.statusRuns'
}

/** Cookie consent: what the pages load, what waits for consent, the banner. */
export default function ConsentView({ workspace }: Props): React.JSX.Element {
  const t = useT()
  const id = useId()
  const [state, setState] = useState<ConsentState | null>(null)
  const [banner, setBanner] = useState<ConsentBanner | null>(null)
  const [languages, setLanguages] = useState<SiteLanguage[]>([])
  const [language, setLanguage] = useState('')
  const [tryUrl, setTryUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const tryRef = useRef<HTMLDivElement>(null)

  const reload = async (): Promise<void> => {
    const next = await window.api.getConsent()
    setState(next)
    setBanner(next.banner)
  }
  const { busy, run, show } = useNotes(reload)

  useEffect(() => {
    if (!workspace) return
    window.api.getConsent().then(
      (next) => {
        setState(next)
        setBanner(next.banner)
      },
      (e) => setLoadError(errorMessage(e))
    )
    window.api.getSiteSettings().then((site) => {
      setLanguages(site.languages)
      setLanguage(site.languages.find((l) => !l.path)?.code ?? site.languages[0]?.code ?? '')
    })
  }, [workspace])

  useEffect(() => {
    if (tryUrl) tryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [tryUrl])

  const itemList = useFilteredList(
    `consent:${workspace?.folder}`,
    state?.items ?? [],
    (item) => [item.name, item.key],
    10
  )

  if (!workspace) {
    return (
      <div className="empty">
        <h2>{t('consent.title')}</h2>
        <p>{t('common.noProject')}</p>
      </div>
    )
  }
  if (loadError) return <Notice kind="error">{loadError}</Notice>
  if (!state || !banner) return <div className="muted">{t('common.loading')}</div>

  const needConsent = state.items.filter(
    (item) =>
      item.category !== 'necessary' &&
      (item.category ||
        (item.suggested && item.suggested !== 'necessary' && item.suggested !== 'cookieless'))
  )
  const unknown = state.items.filter((item) => !item.category && item.suggested === null)
  const open = state.items.filter(
    (item) =>
      item.category !== 'necessary' &&
      item.open > 0 &&
      (item.category ||
        (item.suggested && item.suggested !== 'cookieless' && item.suggested !== 'necessary'))
  )
  const held = state.items.reduce((sum, item) => sum + item.held, 0)

  const textsKey = languages.length > 1 ? language : ''
  const texts = { ...EMPTY, ...(banner.texts[textsKey] ?? {}) }
  const setText = (field: keyof ConsentTexts, value: string): void =>
    setBanner({ ...banner, texts: { ...banner.texts, [textsKey]: { ...texts, [field]: value } } })

  const tryIt = async (): Promise<void> => {
    setTryUrl(`${await window.api.interactUrl('index.html')}#craftpages-consent`)
  }

  const itemsSection = (
    <Section
      title={t('consent.itemsTitle')}
      state={
        state.enabled ? (unknown.length ? 'setup' : open.length ? 'improve' : 'done') : undefined
      }
      description={t('consent.itemsDescription')}
    >
      {state.items.length === 0 ? (
        <p className="muted">{t('consent.itemsNone')}</p>
      ) : (
        <>
          {itemList.searchable && (
            <ListSearch
              value={itemList.query}
              onChange={itemList.setQuery}
              label={t('consent.searchItems')}
            />
          )}
          {itemList.query && itemList.matched === 0 && (
            <NoMatches query={itemList.query} onClear={() => itemList.setQuery('')} />
          )}
          <table className="list">
            <thead>
              <tr>
                <th scope="col">{t('consent.colWhat')}</th>
                <th scope="col">{t('consent.colStatus')}</th>
                <th scope="col">{t('consent.colCategory')}</th>
              </tr>
            </thead>
            <tbody>
              {itemList.rows.map((item, i) => {
                const current =
                  item.category ??
                  (item.suggested && item.suggested !== 'cookieless' ? item.suggested : '')
                return (
                  <tr key={item.key}>
                    <td id={`${id}-item-${i}`}>
                      {item.name}
                      <div className="muted small">
                        {t('consent.onPages', { count: item.pages.length })}
                        {item.key.startsWith('host:') && ` · ${t('consent.notRecognised')}`}
                      </div>
                    </td>
                    <td>{t(statusOf(item))}</td>
                    <td>
                      {item.suggested === 'cookieless' && !item.category ? (
                        <span className="muted">{t('consent.noneNeeded')}</span>
                      ) : state.enabled ? (
                        <select
                          value={current}
                          disabled={busy}
                          aria-describedby={`${id}-item-${i}`}
                          aria-label={t('consent.colCategory')}
                          onChange={(e) =>
                            run('items', async () =>
                              changeNote(
                                await window.api.setConsentCategory(
                                  item.key,
                                  e.target.value as ConsentCategory
                                ),
                                t('consent.categorySet', {
                                  name: item.name,
                                  category: t(CATEGORY[e.target.value as ConsentCategory])
                                })
                              )
                            )
                          }
                        >
                          {!current && <option value="">{t('consent.choose')}</option>}
                          {(Object.keys(CATEGORY) as ConsentCategory[]).map((category) => (
                            <option key={category} value={category}>
                              {t(CATEGORY[category])}
                            </option>
                          ))}
                        </select>
                      ) : current ? (
                        t(CATEGORY[current])
                      ) : (
                        <span className="muted">{t('consent.unknown')}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Pagination
            page={itemList.page}
            pages={itemList.pages}
            total={itemList.matched}
            onPage={itemList.setPage}
            pageSize={itemList.pageSize}
          />
        </>
      )}
      <Explainer title={t('consent.howTitle')}>
        <p>{t.rich('consent.howHeld', { code: <code>type=&quot;text/plain&quot;</code> })}</p>
        <p>{t('consent.howNecessary')}</p>
        <p>{t('consent.howNew')}</p>
      </Explainer>
      {show('items')}
    </Section>
  )

  const trackingSection = (
    <TrackingSection
      consentOn={state.enabled}
      enableConsent={() => window.api.enableConsent(banner)}
      onChanged={reload}
    />
  )

  if (!state.enabled) {
    return (
      <SectionPage className="consent-view">
        <Section
          lead
          title={t('consent.offTitle')}
          state="off"
          description={
            needConsent.length
              ? t('consent.offNeeds', {
                  count: needConsent.length,
                  names: needConsent.map((item) => item.name).join(', ')
                })
              : t('consent.offNothing')
          }
          actions={
            <button
              className="btn btn--primary"
              disabled={busy}
              onClick={() =>
                run('lead', async () =>
                  changeNote(await window.api.enableConsent(banner), t('consent.turnedOn'))
                )
              }
            >
              {t('consent.turnOn')}
            </button>
          }
        >
          <ul className="search-intro__points">
            <li>{t('consent.pointScan')}</li>
            <li>{t('consent.pointFair')}</li>
            <li>{t('consent.pointFiles')}</li>
          </ul>
          {show('lead')}
        </Section>
        {trackingSection}
        {itemsSection}
      </SectionPage>
    )
  }

  const missing = state.pages - state.withScript

  return (
    <SectionPage className="consent-view">
      <Section
        lead
        title={t('consent.onTitle')}
        state="on"
        description={t('consent.onSummary', { with: state.withScript, count: state.pages, held })}
        actions={
          <>
            <button className="btn btn--primary" onClick={tryIt}>
              {t('search.tryIt')}
            </button>
            <button
              className="btn btn--danger-outline"
              disabled={busy}
              onClick={() =>
                run('lead', async () =>
                  changeNote(await window.api.disableConsent(), t('consent.turnedOff'))
                )
              }
            >
              {t('consent.turnOff')}
            </button>
          </>
        }
      >
        {unknown.length > 0 && (
          <Notice kind="warning">
            {t('consent.unknownNotice', {
              count: unknown.length,
              names: unknown.map((item) => item.name).join(', ')
            })}
          </Notice>
        )}
        {missing > 0 && (
          <Notice kind="info">
            {t.rich('consent.missing', {
              count: missing,
              link: (chunk) => (
                <button
                  className="link"
                  disabled={busy}
                  onClick={() =>
                    run('lead', async () =>
                      changeNote(
                        await window.api.saveConsentBanner(banner),
                        t('consent.bannerSaved')
                      )
                    )
                  }
                >
                  {chunk}
                </button>
              )
            })}
          </Notice>
        )}
        {show('lead')}
        {tryUrl && (
          <div className="search-try" ref={tryRef}>
            <div className="search-try__bar">
              <span className="muted small">{t('consent.tryHelp')}</span>
              <button className="link" onClick={() => setTryUrl(null)}>
                {t('search.closePreview')}
              </button>
            </div>
            <iframe
              key={tryUrl}
              src={tryUrl}
              title={t('consent.tryFrame')}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        )}
      </Section>

      {trackingSection}

      {itemsSection}

      <Section
        title={t('consent.bannerTitle')}
        description={t('consent.bannerDescription')}
        actions={
          <button
            className="btn btn--primary"
            disabled={busy}
            onClick={() =>
              run('banner', async () => {
                const note = changeNote(
                  await window.api.saveConsentBanner(banner),
                  t('consent.bannerSaved')
                )
                if (tryUrl) await tryIt()
                return note
              })
            }
          >
            {t('common.save')}
          </button>
        }
      >
        <div className="grid-2">
          <div className="field">
            <span className="field__label" id={`${id}-position`}>
              {t('consent.position')}
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby={`${id}-position`}>
              {(['bar', 'box'] as const).map((position) => (
                <button
                  key={position}
                  role="radio"
                  aria-checked={banner.position === position}
                  className={banner.position === position ? 'is-active' : ''}
                  onClick={() => setBanner({ ...banner, position })}
                >
                  {t(position === 'bar' ? 'consent.positionBar' : 'consent.positionBox')}
                </button>
              ))}
            </div>
          </div>
          {languages.length > 1 && (
            <Field label={t('consent.language')} hint={t('consent.languageHint')}>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={banner.button}
            onChange={(e) => setBanner({ ...banner, button: e.target.checked })}
          />
          {t('consent.reopenButton')}
        </label>
        <p className="field__hint">
          {t.rich('consent.reopenOwn', { attr: <code>data-craftpages-consent-open</code> })}
        </p>
        <div className="grid-2">
          {TEXT_FIELDS.map(({ field, label, long }) => (
            <Field
              key={field}
              label={t(label)}
              hint={field === 'privacyUrl' ? t('consent.privacyUrlHint') : undefined}
            >
              {long ? (
                <textarea
                  rows={3}
                  value={texts[field]}
                  placeholder={t('consent.builtIn')}
                  onChange={(e) => setText(field, e.target.value)}
                />
              ) : (
                <input
                  value={texts[field]}
                  placeholder={field === 'privacyUrl' ? '/privacy/' : t('consent.builtIn')}
                  onChange={(e) => setText(field, e.target.value)}
                />
              )}
            </Field>
          ))}
        </div>
        <Explainer>{t('consent.builtInHelp')}</Explainer>
        {show('banner')}
      </Section>
    </SectionPage>
  )
}
