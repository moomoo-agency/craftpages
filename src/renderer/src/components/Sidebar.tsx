import {
  Icon,
  page,
  post,
  symbol,
  image,
  seen,
  search,
  cog,
  settings as projectIcon,
  upload,
  plugins
} from '@wordpress/icons'
import wordmark from '../assets/brand/wordmark.svg?raw'
import { useT, type Key } from '../i18n'
import { shortcut } from '../lib/api'
import { VIEW_TITLES } from '../lib/views'
import { FEATURES } from '../../../shared/features'
import SyncPill from './SyncPill'
import UpdateCard from './UpdateCard'
import type { PendingPublish } from './DraftBar'
import type { McpStatus, SyncStatus, UpdateState, Workspace } from '../../../shared/types'

export type ViewId =
  | 'pages'
  | 'blog'
  | 'components'
  | 'media'
  | 'seo'
  | 'search'
  | 'ai'
  | 'publish'
  | 'project'
  | 'settings'

/**
 * Everyday content first, then what the site has (shared parts, search, AI). Settings sit at
 * the bottom by Publish: rarely needed by the people who edit content.
 */
const SETTINGS = [
  { id: 'project', icon: projectIcon },
  { id: 'settings', icon: cog }
] satisfies { id: ViewId; icon: React.JSX.Element }[]

const NAV_GROUPS = [
  {
    label: 'app.navContent',
    items: [
      { id: 'pages', icon: page },
      { id: 'blog', icon: post },
      { id: 'media', icon: image },
      { id: 'seo', icon: seen }
    ]
  },
  {
    label: 'app.navSite',
    items: [
      { id: 'components', icon: symbol },
      { id: 'search', icon: search },
      { id: 'ai', icon: plugins }
    ]
  }
] satisfies { label: Key; items: { id: ViewId; icon: React.JSX.Element }[] }[]

interface Props {
  workspace: Workspace | null
  view: ViewId
  mcp: McpStatus | null
  pendingProposals: number
  update: UpdateState | null
  sync: SyncStatus | null
  /** Pages with unsaved drafts: publishing leaves them out until they're saved. */
  unsaved: number
  /** Saved files not on the live site yet; null when unknown. */
  pendingPublish: PendingPublish | null
  onNavigate: (view: ViewId) => void
  onOpenProjects: () => void
}

export default function Sidebar({
  workspace,
  view,
  mcp,
  pendingProposals,
  update,
  sync,
  unsaved,
  pendingPublish,
  onNavigate,
  onOpenProjects
}: Props): React.JSX.Element {
  const t = useT()
  return (
    <aside className="sidebar">
      <div className="sidebar__drag" />
      <div
        className="brand"
        role="img"
        aria-label="CraftPages"
        dangerouslySetInnerHTML={{ __html: wordmark }}
      />
      <button
        className="site-switcher"
        onClick={onOpenProjects}
        title={t('app.switchProject', { shortcut: shortcut('O') })}
        aria-haspopup="dialog"
      >
        <span className="site-switcher__avatar" aria-hidden="true">
          {(workspace?.name ?? '?').charAt(0).toUpperCase()}
        </span>
        <span className="site-switcher__text">
          <strong>{workspace?.name ?? t('app.noProjectOpen')}</strong>
          <small>
            {workspace
              ? t('common.pages', { count: workspace.pages.length })
              : t('app.openAProject')}
          </small>
        </span>
        <span className="site-switcher__chevron" aria-hidden="true">
          ⌄
        </span>
      </button>

      <nav className="nav" aria-label={t('app.sections')}>
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => item.id !== 'blog' || FEATURES.blog)
          const labelId = `nav-${group.label}`
          return (
            <div key={group.label} className="nav__group" role="group" aria-labelledby={labelId}>
              <span className="nav__group-label" id={labelId}>
                {t(group.label)}
              </span>
              {items.map((item) => (
                <button
                  key={item.id}
                  className={`nav__item${view === item.id ? ' is-active' : ''}`}
                  aria-current={view === item.id ? 'page' : undefined}
                  onClick={() => onNavigate(item.id)}
                >
                  <Icon icon={item.icon} size={20} aria-hidden="true" />
                  <span>{t(VIEW_TITLES[item.id])}</span>
                  {item.id === 'ai' && pendingProposals > 0 && (
                    <span
                      className="nav__count"
                      title={t('app.proposalsWaiting', { count: pendingProposals })}
                    >
                      <span aria-hidden="true">{pendingProposals}</span>
                      <span className="visually-hidden">
                        {t('app.proposalsWaiting', { count: pendingProposals })}
                      </span>
                    </span>
                  )}
                  {item.id === 'ai' && pendingProposals === 0 && mcp?.clients.length ? (
                    <span
                      className="dot dot--on"
                      role="img"
                      aria-label={t('app.aiConnected', { clients: mcp.clients.join(', ') })}
                      title={t('app.aiConnected', { clients: mcp.clients.join(', ') })}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          )
        })}
      </nav>

      <div className="sidebar__footer">
        <UpdateCard update={update} />
        <SyncPill status={sync} onOpenSettings={() => onNavigate('project')} />
        <nav className="nav nav--settings" aria-label={t('app.navSettings')}>
          {SETTINGS.map((item) => (
            <button
              key={item.id}
              className={`nav__item${view === item.id ? ' is-active' : ''}`}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <Icon icon={item.icon} size={20} aria-hidden="true" />
              <span>{t(VIEW_TITLES[item.id])}</span>
            </button>
          ))}
        </nav>
        {/* Primary only when saved changes wait to go live; Save all leads while edits are unsaved. */}
        <button
          className={`btn btn--block${
            view !== 'publish' && unsaved === 0 && (pendingPublish?.files ?? 0) > 0
              ? ' btn--primary'
              : ''
          }`}
          disabled={!workspace}
          onClick={() => onNavigate('publish')}
          title={unsaved > 0 ? t('app.publishUnsaved', { count: unsaved }) : undefined}
        >
          <Icon icon={upload} size={18} aria-hidden="true" />
          {t('app.publishSite')}
          {unsaved > 0 && (
            <>
              <span className="dot dot--warn sidebar__publish-dot" aria-hidden="true" />
              <span className="visually-hidden">{t('app.publishUnsaved', { count: unsaved })}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
