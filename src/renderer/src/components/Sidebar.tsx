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
import { useT } from '../i18n'
import { shortcut } from '../lib/api'
import { VIEW_TITLES } from '../lib/views'
import { FEATURES } from '../../../shared/features'
import UpdateCard from './UpdateCard'
import type { McpStatus, UpdateState, Workspace } from '../../../shared/types'

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

const NAV = (
  [
    { id: 'pages', icon: page },
    { id: 'blog', icon: post },
    { id: 'components', icon: symbol },
    { id: 'media', icon: image },
    { id: 'seo', icon: seen },
    { id: 'search', icon: search },
    { id: 'ai', icon: plugins },
    { id: 'project', icon: projectIcon },
    { id: 'settings', icon: cog }
  ] satisfies { id: ViewId; icon: React.JSX.Element }[]
).filter((item) => item.id !== 'blog' || FEATURES.blog)

interface Props {
  workspace: Workspace | null
  view: ViewId
  mcp: McpStatus | null
  pendingProposals: number
  update: UpdateState | null
  onNavigate: (view: ViewId) => void
  onOpenProjects: () => void
}

export default function Sidebar({
  workspace,
  view,
  mcp,
  pendingProposals,
  update,
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
        {NAV.map((item) => (
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
      </nav>

      <div className="sidebar__footer">
        <UpdateCard update={update} />
        <button
          className={`btn btn--block${view === 'publish' ? '' : ' btn--primary'}`}
          disabled={!workspace}
          onClick={() => onNavigate('publish')}
        >
          <Icon icon={upload} size={18} aria-hidden="true" />
          {t('app.publishSite')}
        </button>
      </div>
    </aside>
  )
}
