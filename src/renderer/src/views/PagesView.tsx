import { useEffect, useMemo, useState } from 'react'
import PageViewer from '../components/PageViewer'
import { addressOfFile, fileOfPath } from '../../../shared/blog-urls'
import { ListSearch, NoMatches, Pagination } from '../components/ListControls'
import { useFilteredList } from '../lib/list'
import { useT } from '../i18n'
import type { SyncPresence, Workspace } from '../../../shared/types'

/**
 * The site-name endings page titles repeat (" | Inkwell", " · inkwell"): any " | X" ending,
 * with separators |, ·, –, — or -, that two or more titles share.
 */
function siteSuffixes(titles: string[]): string[] {
  const counts = new Map<string, number>()
  for (const title of titles) {
    const match = title.match(/\s[|·–—-]\s[^|·–—]+$/)
    if (match) counts.set(match[0], (counts.get(match[0]) ?? 0) + 1)
  }
  return [...counts].filter(([, count]) => count >= 2).map(([suffix]) => suffix)
}

const isHome = (path: string): boolean => /^index\.html?$/i.test(path)

interface Props {
  workspace: Workspace | null
  onOpenWorkspace: () => void
  onEditPage: (path: string) => void
  /** Pages with unsaved drafts. */
  unsaved: Set<string>
  /** Opens the Blog screen for generated pages; without it they open in the page editor. */
  onOpenBlog?: () => void
  /** Other computers with the project open (sync), to mark the pages they're on. */
  people?: SyncPresence[]
}

export default function PagesView({
  workspace,
  onOpenWorkspace,
  onEditPage,
  unsaved,
  onOpenBlog,
  people = []
}: Props): React.JSX.Element {
  const t = useT()
  const [generated, setGenerated] = useState<Set<string>>(new Set())
  const [layouts, setLayouts] = useState<{ post: string | null; list: string | null }>({
    post: null,
    list: null
  })
  const [unpublished, setUnpublished] = useState<Record<string, string>>({})
  /** A generated page shown as visitors see it. */
  const [viewing, setViewing] = useState<string | null>(null)
  /** Files of posts' pages, to tell a post from a list page. */
  const [postFiles, setPostFiles] = useState<Set<string>>(new Set())
  // The home page first: it's the page people come to edit most.
  const pages = useMemo(
    () =>
      [...(workspace?.pages ?? [])].sort((a, b) => Number(isHome(b.path)) - Number(isHome(a.path))),
    [workspace?.pages]
  )
  const list = useFilteredList(`pages:${workspace?.folder}`, pages, (entry) => [
    entry.title,
    entry.path
  ])
  useEffect(() => {
    if (!workspace) return
    window.api.generatedPages().then(
      (paths) => setGenerated(new Set(paths)),
      () => {}
    )
    window.api.blogLayoutPages().then(setLayouts, () => {})
    window.api.getUnpublished().then(setUnpublished, () => {})
    if (onOpenBlog)
      window.api.listPosts().then(
        (posts) => setPostFiles(new Set(posts.map((post) => fileOfPath(post.url)))),
        () => {}
      )
  }, [workspace, onOpenBlog])

  if (!workspace) {
    return (
      <div className="empty">
        <h2>{t('app.openSiteTitle')}</h2>
        <p>{t('app.openSiteBody')}</p>
        <button className="btn btn--primary btn--large" onClick={onOpenWorkspace}>
          {t('app.openProjectButton')}
        </button>
      </div>
    )
  }

  if (viewing && onOpenBlog) {
    const template = postFiles.has(viewing) ? layouts.post : layouts.list
    return (
      <PageViewer path={viewing} onBack={() => setViewing(null)} backLabel={t('pages.backToPages')}>
        {template && (
          <button className="btn btn--small" onClick={() => onEditPage(template)}>
            {t(postFiles.has(viewing) ? 'pages.editPostTemplate' : 'pages.editListTemplate')}
          </button>
        )}
        <button className="btn btn--small" onClick={onOpenBlog}>
          {t('pages.managePosts')}
        </button>
      </PageViewer>
    )
  }

  if (!workspace.pages.length) return <p className="muted">{t('app.noPages')}</p>

  // Titles often end in the site's name ("About | Inkwell"): shown once is enough.
  const suffixes = siteSuffixes(pages.map((page) => page.title))
  const pageName = (title: string): string => {
    const suffix = suffixes.find((end) => title.endsWith(end) && title.length > end.length)
    return suffix ? title.slice(0, -suffix.length) : title
  }

  // Pages the blog builds or uses as templates live in their own folded section, so the
  // list starts with the site's own pages.
  const isBlogPage = (path: string): boolean =>
    !!onOpenBlog && (generated.has(path) || layouts.list === path || layouts.post === path)
  const sitePages = list.rows.filter((entry) => !isBlogPage(entry.path))
  const blogPages = list.rows.filter((entry) => isBlogPage(entry.path))

  const row = (entry: (typeof list.rows)[number]): React.JSX.Element => {
    const isGenerated = !!onOpenBlog && generated.has(entry.path)
    // One page can be both (a site whose list and posts share a layout).
    const layoutBadges = onOpenBlog
      ? [
          ...(layouts.list === entry.path ? (['list'] as const) : []),
          ...(layouts.post === entry.path ? (['post'] as const) : [])
        ]
      : []
    const layoutHint = layoutBadges.length
      ? t(layoutBadges[0] === 'list' ? 'app.templateHint' : 'app.postTemplateHint')
      : null
    const title = pageName(entry.title) || t('app.untitled')
    const open = (): void => (isGenerated ? setViewing(entry.path) : onEditPage(entry.path))
    return (
      <tr
        key={entry.path}
        onClick={open}
        className={entry.path in unpublished ? 'is-unpublished' : undefined}
      >
        <td className="list__title">
          {/* The row is clickable with the mouse; the button makes it reachable by keyboard. */}
          <button
            className="list__open"
            onClick={(e) => {
              e.stopPropagation()
              open()
            }}
            title={
              isGenerated
                ? t('app.generatedHint')
                : (layoutHint ?? t('app.editPageHint', { title }))
            }
          >
            {title}
          </button>
          {unsaved.has(entry.path) && (
            <span className="badge badge--warn">{t('common.unsaved')}</span>
          )}
          {isGenerated && <span className="badge">{t('app.badgeBlog')}</span>}
          {layoutBadges.map((kind) => (
            <span
              key={kind}
              className="badge badge--muted"
              title={t(kind === 'list' ? 'app.templateHint' : 'app.postTemplateHint')}
            >
              {t(kind === 'list' ? 'app.badgeTemplate' : 'app.badgePostTemplate')}
            </span>
          ))}
          {people
            .filter((person) => person.page === entry.path)
            .map((person) => (
              <span
                key={person.device}
                className="badge badge--presence"
                title={t('sync.openThere', { device: person.device })}
              >
                {person.device}
              </span>
            ))}
          {isHome(entry.path) && <span className="badge badge--muted">{t('pages.homeBadge')}</span>}
          {entry.path in unpublished && (
            <span className="badge badge--muted" title={t('pages.publishOffTip')}>
              {t('pages.publishOff')}
            </span>
          )}
        </td>
        <td className="muted list__address" title={entry.path}>
          {addressOfFile(entry.path)}
        </td>
      </tr>
    )
  }

  const table = (rows: typeof list.rows): React.JSX.Element => (
    <table className="list list--clickable">
      <thead>
        <tr>
          <th scope="col">{t('app.colTitle')}</th>
          <th scope="col">{t('app.colAddress')}</th>
        </tr>
      </thead>
      <tbody>{rows.map(row)}</tbody>
    </table>
  )

  return (
    <>
      {list.searchable && (
        <ListSearch value={list.query} onChange={list.setQuery} label={t('pages.searchPages')} />
      )}
      {list.matched === 0 ? (
        <NoMatches query={list.query} onClear={() => list.setQuery('')} />
      ) : (
        <>
          {sitePages.length > 0 && table(sitePages)}
          {blogPages.length > 0 && (
            <details className="pages-blog" open={!!list.query}>
              <summary>
                {t('pages.builtByBlog', { count: blogPages.length })}
                <span className="muted"> · {t('pages.builtByBlogHint')}</span>
              </summary>
              {table(blogPages)}
            </details>
          )}
        </>
      )}
      <Pagination page={list.page} pages={list.pages} total={list.matched} onPage={list.setPage} />
    </>
  )
}
