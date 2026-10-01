import { useEffect, useId, useState } from 'react'
import { Field, Notice, Section } from '../components/Field'
import PostEditor from './PostEditor'
import LayoutPointer from './LayoutPointer'
import StatusPill from '../components/StatusPill'
import { copyText, errorMessage, formatDate } from '../lib/api'
import { useT, type Key, type Translator } from '../i18n'
import { listPath, postPath, postPrefix } from '../../../shared/blog-urls'
import type {
  LatestLayout,
  PostRecord,
  PostSummary,
  SiteSettings,
  BlogPreview,
  BlogSetup,
  BlogTemplates,
  McpStatus,
  TemplateCandidate,
  Workspace
} from '../../../shared/types'

interface Props {
  workspace: Workspace | null
  mcp: McpStatus | null
  onOpenPage: (path: string) => void
  onOpenAi: () => void
}

function aiPrompt(project: string, hasPost: boolean, hasList: boolean): string {
  const wanted = [
    !hasPost &&
      '- blog/hello-world/index.html: a sample post. Inside <main>, an <article> with the title (h1), a <time datetime> publish date, the author, a cover image and a few sections of body text. Add BlogPosting JSON-LD and correct <title>, meta description, canonical and og tags.',
    !hasList &&
      '- blog/index.html: the list of posts. A grid of cards (image, title, date, excerpt, link to the post) with the sample post as the first card, plus pagination links (previous / 1 / 2 / next).'
  ]
    .filter(Boolean)
    .join('\n')
  return `Use the craftpages MCP tools on the project "${project}".
Create the blog pages this site is missing, reusing the site's existing header, footer, CSS classes and design so they look native:
${wanted}
Add a "Blog" link to the main navigation on every page that has it, and add the new URLs to sitemap.xml.
Put everything in one propose_change.`
}

/**
 * The scan in the main process explains each suggestion with short English phrases;
 * map the known ones to translated text (anything unknown is shown as is).
 */
function reasonText(reason: string, t: Translator): string {
  const fixed: Record<string, Key> = {
    'has Article structured data': 'blog.reasonArticleData',
    'og:type is article': 'blog.reasonOgArticle',
    'has an <article> with body text': 'blog.reasonArticle',
    'shows a date': 'blog.reasonDate',
    'long-form text': 'blog.reasonLongText',
    'has pagination': 'blog.reasonPagination'
  }
  if (fixed[reason]) return t(fixed[reason])
  let match = /^lives under (\S+)$/.exec(reason)
  if (match) return t('blog.reasonUnder', { dir: match[1] })
  match = /^is (\S+)$/.exec(reason)
  if (match) return t('blog.reasonAddress', { path: match[1] })
  match = /^lists (\d+) cards linking to (posts|dated pages)$/.exec(reason)
  if (match)
    return t(match[2] === 'posts' ? 'blog.reasonCardsPosts' : 'blog.reasonCardsDated', {
      count: Number(match[1])
    })
  match = /^repeats (\d+) cards linking to pages$/.exec(reason)
  if (match) return t('blog.reasonCardsPages', { count: Number(match[1]) })
  return reason
}

function CandidatePicker({
  label,
  description,
  candidates,
  value,
  pages,
  onChange,
  onPreview
}: {
  label: string
  description: string
  candidates: TemplateCandidate[]
  value: string
  pages: string[]
  onChange: (path: string) => void
  onPreview: (path: string) => void
}): React.JSX.Element {
  const t = useT()
  const id = useId()
  const others = pages.filter((page) => !candidates.some((c) => c.path === page))
  return (
    <div className="template-pick">
      <h3 id={`${id}-title`}>{label}</h3>
      <p className="muted small">{description}</p>
      {candidates.length === 0 && <p className="template-pick__none">{t('blog.noCandidates')}</p>}
      {candidates.length > 0 && (
        <div role="radiogroup" aria-labelledby={`${id}-title`}>
          {candidates.map((candidate) => (
            <label
              key={candidate.path}
              className={`candidate${value === candidate.path ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name={`${id}-candidate`}
                checked={value === candidate.path}
                onChange={() => onChange(candidate.path)}
              />
              <span className="candidate__text">
                <strong>{candidate.title || t('blog.untitled')}</strong>
                <small className="mono">{candidate.path}</small>
                <small className="muted">
                  {t('blog.whySuggested', {
                    reasons: candidate.reasons.map((reason) => reasonText(reason, t)).join(', ')
                  })}
                </small>
              </span>
              <button
                type="button"
                className="btn btn--small"
                onClick={() => onPreview(candidate.path)}
                aria-label={t('blog.openCandidate', { page: candidate.path })}
              >
                {t('common.open')}
              </button>
            </label>
          ))}
        </div>
      )}
      <label className="field">
        <span className="field__label">
          {candidates.length ? t('blog.otherPage') : t('blog.existingPage')}
        </span>
        <select
          value={candidates.some((c) => c.path === value) ? '' : value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{t('blog.choosePage')}</option>
          {others.map((page) => (
            <option key={page} value={page}>
              {page}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

/**
 * "Blog" section. Setup has three parts: choose the pages whose layout posts and
 * the post list reuse (or have the AI create them), point at the parts of each
 * layout, and preview with sample posts. After that it lists posts.
 */
export default function BlogView({
  workspace,
  mcp,
  onOpenPage,
  onOpenAi
}: Props): React.JSX.Element {
  const t = useT()
  const [setup, setSetup] = useState<BlogSetup | null>(null)
  const [post, setPost] = useState('')
  const [list, setList] = useState('')
  const [mode, setMode] = useState<
    'overview' | 'choose' | 'point-post' | 'point-list' | 'point-latest' | 'preview' | 'editor'
  >('overview')
  const [preview, setPreview] = useState<BlogPreview | null>(null)
  const [previewTab, setPreviewTab] = useState<'post' | 'list'>('post')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [posts, setPosts] = useState<PostSummary[] | null>(null)
  const [editing, setEditing] = useState<PostRecord | null>(null)
  const [site, setSite] = useState<SiteSettings | null>(null)
  const [origin, setOrigin] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  /** The latest-posts block being pointed at (a new one has no saved parts yet). */
  const [latestEdit, setLatestEdit] = useState<LatestLayout | null>(null)
  const [latestPage, setLatestPage] = useState('')
  /** Pages the blog writes; never offered as layouts or latest-posts pages. */
  const [generated, setGenerated] = useState<Set<string>>(new Set())

  const loadPosts = (): Promise<void> =>
    window.api.listPosts().then(setPosts, (e) => setError(errorMessage(e)))

  useEffect(() => {
    if (!workspace) return
    loadPosts()
    window.api.generatedPages().then(
      (paths) => setGenerated(new Set(paths)),
      () => {}
    )
    window.api.getSiteSettings().then(setSite)
    window.api.previewUrl('').then((url) => setOrigin(new URL(url).origin))
    window.api.getBlogSetup().then(
      (next) => {
        setSetup(next)
        setPost(next.templates?.post ?? next.candidates.post[0]?.path ?? '')
        setList(next.templates?.list ?? next.candidates.list[0]?.path ?? '')
      },
      (e) => setError(errorMessage(e))
    )
  }, [workspace])

  if (!workspace) {
    return (
      <div className="empty">
        <h2>{t('app.viewBlog')}</h2>
        <p>{t('common.noProject')}</p>
      </div>
    )
  }
  if (error && !setup)
    return (
      <div role="alert">
        <Notice kind="error">{error}</Notice>
      </div>
    )
  if (!setup)
    return (
      <p className="muted" role="status">
        {t('blog.looking')}
      </p>
    )

  const templates: BlogTemplates = setup.templates ?? {}
  const pagesChosen = Boolean(templates.post && templates.list)
  const layoutsDone = Boolean(templates.postLayout && templates.listLayout)

  /** Resolves to whether it saved; a failure shows in the error notice. */
  const save = async (update: BlogTemplates): Promise<boolean> => {
    setError(null)
    try {
      setSetup(await window.api.saveBlogTemplates(update))
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    }
  }

  const showPreview = async (): Promise<void> => {
    setError(null)
    try {
      setPreview(await window.api.previewBlog())
      setMode('preview')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const latestBlocks = templates.latest ?? []
  const saveLatest = async (next: LatestLayout[]): Promise<void> => {
    try {
      if (!(await save({ latest: next }))) return
      // Blocks update on the next publish; do it now when posts are already live.
      if (posts?.some((p) => p.status === 'published' && !p.scheduled)) {
        const result = await window.api.regenerateBlog()
        const where = next
          .map((block) => block.page)
          .filter((page) => result.written.includes(page))
        setFlash(
          where.length
            ? t('blog.latestUpdated', { pages: where.join(', ') })
            : t('blog.savedNotice')
        )
      }
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  // ---------- Pointing ----------

  if (mode === 'point-latest' && latestEdit) {
    return (
      <LayoutPointer
        key={latestEdit.id}
        kind="latest"
        page={latestEdit.page}
        latest={latestEdit.container ? latestEdit : null}
        onCancel={() => {
          setLatestEdit(null)
          setMode('overview')
        }}
        onSave={async ({ latest }) => {
          if (!latest) return
          const block = { ...latestEdit, ...latest }
          const exists = latestBlocks.some((b) => b.id === block.id)
          await saveLatest(
            exists
              ? latestBlocks.map((b) => (b.id === block.id ? block : b))
              : [...latestBlocks, block]
          )
          setLatestEdit(null)
          setMode('overview')
        }}
      />
    )
  }

  if (mode === 'point-post' || mode === 'point-list') {
    const kind = mode === 'point-post' ? 'post' : 'list'
    return (
      <LayoutPointer
        kind={kind}
        page={kind === 'post' ? templates.post! : templates.list!}
        postLayout={templates.postLayout}
        listLayout={templates.listLayout}
        onCancel={() => setMode('overview')}
        onSave={async ({ postLayout, listLayout }) => {
          // Only the layout that was pointed at; the other one stays as saved.
          await save(postLayout ? { postLayout } : listLayout ? { listLayout } : {})
          setMode('overview')
        }}
      />
    )
  }

  // ---------- Preview ----------

  if (mode === 'preview' && preview) {
    return (
      <div className="blog blog--wide">
        <div className="blog__bar">
          <button className="link" onClick={() => setMode('overview')}>
            <span aria-hidden="true">← </span>
            {t('blog.backToBlog')}
          </button>
          <div className="segmented" role="radiogroup" aria-label={t('common.preview')}>
            {(['post', 'list'] as const).map((tab) => (
              <button
                key={tab}
                role="radio"
                aria-checked={previewTab === tab}
                className={previewTab === tab ? 'is-active' : ''}
                onClick={() => setPreviewTab(tab)}
              >
                {tab === 'post' ? t('blog.samplePost') : t('blog.postList')}
              </button>
            ))}
          </div>
          <span className="muted small">{t('blog.sampleNote')}</span>
          <span className="blog__bar-actions">
            <button className="btn btn--small" onClick={() => setMode('point-post')}>
              {t('blog.adjustPostLayout')}
            </button>
            <button className="btn btn--small" onClick={() => setMode('point-list')}>
              {t('blog.adjustListLayout')}
            </button>
          </span>
        </div>
        <iframe
          key={previewTab}
          className="blog__preview"
          src={previewTab === 'post' ? preview.post : preview.list}
          title={t('blog.previewFrame')}
          sandbox="allow-scripts"
        />
      </div>
    )
  }

  if (mode === 'editor' && editing && site) {
    return (
      <PostEditor
        key={editing.id}
        initial={editing}
        site={site}
        splitRegions={(templates.postLayout?.regions.length ?? 1) > 1}
        previewOrigin={origin}
        knownTags={[...new Set((posts ?? []).flatMap((p) => p.tags))].sort()}
        onSaved={() => loadPosts()}
        onDeleted={() => {
          setFlash(t('blog.postDeleted'))
          setEditing(null)
          setMode('overview')
          loadPosts()
        }}
        onBack={() => {
          setEditing(null)
          setMode('overview')
          loadPosts()
        }}
      />
    )
  }

  const openPost = async (id: string | null): Promise<void> => {
    try {
      setEditing(id ? await window.api.getPost(id) : await window.api.newPost())
      setMode('editor')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  // ---------- Choosing pages ----------

  const pages = workspace.pages
    .map((page) => page.path)
    .filter((path) => path !== '404.html' && !generated.has(path))
  const found = setup.candidates

  if (!pagesChosen || mode === 'choose') {
    const status =
      found.post.length && found.list.length
        ? t('blog.statusBoth')
        : found.post.length
          ? t('blog.statusPostOnly')
          : found.list.length
            ? t('blog.statusListOnly')
            : t('blog.statusNone')
    const prompt = aiPrompt(workspace.name, found.post.length > 0, found.list.length > 0)
    const aiConnected = Boolean(mcp?.clients.length)
    return (
      <div className="blog">
        <Section title={t('blog.chooseTitle')} description={t('blog.chooseDescription')}>
          <Notice kind="info">{status}</Notice>
          <div className="grid-2 template-grid">
            <CandidatePicker
              label={t('blog.postLayout')}
              description={t('blog.postLayoutHint')}
              candidates={found.post}
              value={post}
              pages={pages}
              onChange={setPost}
              onPreview={onOpenPage}
            />
            <CandidatePicker
              label={t('blog.listLayout')}
              description={t('blog.listLayoutHint')}
              candidates={found.list}
              value={list}
              pages={pages}
              onChange={setList}
              onPreview={onOpenPage}
            />
          </div>
          {error && (
            <div role="alert">
              <Notice kind="error">{error}</Notice>
            </div>
          )}
          <div className="panel__actions panel__actions--end">
            {pagesChosen && (
              <button className="btn" onClick={() => setMode('overview')}>
                {t('common.cancel')}
              </button>
            )}
            <button
              className="btn btn--primary"
              disabled={!post || !list}
              onClick={async () => {
                await save({ post, list })
                setMode('overview')
              }}
            >
              {t('common.continue')}
            </button>
          </div>
        </Section>

        {(found.post.length === 0 || found.list.length === 0) && (
          <Section
            title={t('blog.aiTitle')}
            description={t('blog.aiDescription')}
            actions={
              <button className="btn" onClick={onOpenAi}>
                {t('app.viewAi')}
              </button>
            }
          >
            <p className="status-line">
              <span className={`dot ${aiConnected ? 'dot--on' : ''}`} aria-hidden="true" />
              {aiConnected
                ? t('blog.aiConnected', { clients: mcp!.clients.join(', ') })
                : t('blog.aiNotConnected', { view: t('app.viewAi') })}
            </p>
            <pre className="prompt">{prompt}</pre>
            <button
              className="btn btn--accent"
              onClick={async () => {
                await copyText(prompt)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              <span aria-live="polite">{copied ? t('common.copied') : t('blog.copyPrompt')}</span>
            </button>
          </Section>
        )}
      </div>
    )
  }

  // ---------- Overview ----------

  const postSummary = templates.postLayout
    ? [
        t('blog.sumAreas', { count: templates.postLayout.regions.length }),
        templates.postLayout.title ? t('blog.sumTitle') : null,
        templates.postLayout.date ? t('blog.sumDate') : null,
        templates.postLayout.image ? t('blog.sumCover') : null,
        templates.postLayout.tags ? t('blog.sumTags') : null
      ]
        .filter(Boolean)
        .join(' · ')
    : null
  const listSummary = templates.listLayout
    ? [
        t('blog.sumListArea'),
        templates.listLayout.card
          ? t('blog.sumCard', {
              count: Object.values(templates.listLayout.card.fields).filter(Boolean).length
            })
          : t('blog.sumSimpleCard'),
        templates.listLayout.pagination ? t('blog.sumPagination') : t('blog.sumSimplePagination'),
        templates.listLayout.heading ? t('blog.sumHeading') : null
      ]
        .filter(Boolean)
        .join(' · ')
    : null

  const setupSection = (
    <Section
      title={layoutsDone ? t('blog.setupTitle') : t('blog.setupTitleTodo')}
      description={layoutsDone ? t('blog.setupDone') : t('blog.setupTodo')}
    >
      <ol className="steps">
        <li className="is-done">
          <strong>
            {t('blog.stepChoose')}
            <span className="visually-hidden"> ({t('blog.stepDone')})</span>
          </strong>
          <span className="muted small">
            {t.rich('blog.stepChooseSummary', {
              post: (
                <button className="link mono" onClick={() => onOpenPage(templates.post!)}>
                  {templates.post}
                </button>
              ),
              list: (
                <button className="link mono" onClick={() => onOpenPage(templates.list!)}>
                  {templates.list}
                </button>
              )
            })}{' '}
            <button
              className="link"
              onClick={() => setMode('choose')}
              aria-label={t('blog.changeLayouts')}
            >
              {t('common.change')}
            </button>
          </span>
        </li>
        <li className={postSummary ? 'is-done' : ''}>
          <strong>
            {t('blog.stepPost')}
            {postSummary && <span className="visually-hidden"> ({t('blog.stepDone')})</span>}
          </strong>
          <span className="muted small">{postSummary ?? t('blog.stepPostTodo')}</span>
          <span>
            <button
              className={`btn btn--small${postSummary ? '' : ' btn--primary'}`}
              onClick={() => setMode('point-post')}
            >
              {postSummary ? t('blog.adjust') : t('blog.startPointing')}
            </button>
          </span>
        </li>
        <li className={listSummary ? 'is-done' : ''}>
          <strong>
            {t('blog.stepList')}
            {listSummary && <span className="visually-hidden"> ({t('blog.stepDone')})</span>}
          </strong>
          <span className="muted small">{listSummary ?? t('blog.stepListTodo')}</span>
          <span>
            <button
              className={`btn btn--small${!listSummary && postSummary ? ' btn--primary' : ''}`}
              onClick={() => setMode('point-list')}
            >
              {listSummary ? t('blog.adjust') : t('blog.startPointing')}
            </button>
          </span>
        </li>
        <li>
          <strong>{t('blog.stepPreview')}</strong>
          <span className="muted small">{t('blog.stepPreviewHint')}</span>
          <span>
            <button
              className={`btn btn--small${layoutsDone ? ' btn--primary' : ''}`}
              disabled={!layoutsDone}
              onClick={showPreview}
            >
              {t('common.preview')}
            </button>
          </span>
        </li>
        <li className={latestBlocks.length ? 'is-done' : ''}>
          <strong>
            {t('blog.stepLatest')}
            {latestBlocks.length > 0 && (
              <span className="visually-hidden"> ({t('blog.stepDone')})</span>
            )}
          </strong>
          <span className="muted small">{t('blog.stepLatestHint')}</span>
          {latestBlocks.map((block) => (
            <span key={block.id} className="latest-row">
              <span className="mono">{block.page}</span>
              <label className="latest-row__count">
                {t('blog.latestCount')}
                <input
                  aria-label={t('blog.latestCountOn', { page: block.page })}
                  type="number"
                  min={1}
                  max={24}
                  value={block.count}
                  onChange={(e) =>
                    saveLatest(
                      latestBlocks.map((b) =>
                        b.id === block.id
                          ? { ...b, count: Math.max(1, Number(e.target.value) || 1) }
                          : b
                      )
                    )
                  }
                />
              </label>
              <button
                className="btn btn--small"
                aria-label={t('blog.adjustLatest', { page: block.page })}
                onClick={() => {
                  setLatestEdit(block)
                  setMode('point-latest')
                }}
              >
                {t('blog.adjust')}
              </button>
              <button
                className="btn btn--small btn--danger-outline"
                aria-label={t('blog.removeLatest', { page: block.page })}
                onClick={() => saveLatest(latestBlocks.filter((b) => b.id !== block.id))}
                title={t('blog.removeLatestHint')}
              >
                {t('common.remove')}
              </button>
            </span>
          ))}
          <span className="latest-row">
            <select
              value={latestPage}
              onChange={(e) => setLatestPage(e.target.value)}
              aria-label={t('blog.latestPage')}
            >
              <option value="">{t('blog.choosePage')}</option>
              {pages.map((page) => (
                <option key={page} value={page}>
                  {page}
                </option>
              ))}
            </select>
            <button
              className="btn btn--small"
              disabled={!latestPage || !layoutsDone}
              title={layoutsDone ? undefined : t('blog.finishLayoutsFirst')}
              onClick={() => {
                setLatestEdit({
                  id: Math.random().toString(36).slice(2, 10),
                  page: latestPage,
                  container: null as never,
                  card: null,
                  count: 3
                })
                setLatestPage('')
                setMode('point-latest')
              }}
            >
              {t('blog.pointArea')}
            </button>
          </span>
        </li>
      </ol>
      {error && (
        <div role="alert">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
    </Section>
  )

  const postsSection = (
    <Section
      title={t('blog.posts')}
      actions={
        <button className="btn btn--primary" disabled={!layoutsDone} onClick={() => openPost(null)}>
          {t('blog.newPost')}
        </button>
      }
    >
      <div role="status">
        {flash && (
          <Notice kind="success">
            <span className="blog__flash">
              {flash}
              <button className="link" onClick={() => setFlash(null)}>
                {t('common.dismiss')}
              </button>
            </span>
          </Notice>
        )}
      </div>
      {!posts || posts.length === 0 ? (
        <div className="empty empty--inline">
          <h3>{t('blog.noPosts')}</h3>
          <p>{layoutsDone ? t('blog.noPostsReady') : t('blog.noPostsSetup')}</p>
        </div>
      ) : (
        <table className="list list--clickable">
          <thead>
            <tr>
              <th>{t('blog.colTitle')}</th>
              <th>{t('blog.colUrl')}</th>
              <th>{t('blog.colTags')}</th>
              <th>{t('blog.colStatus')}</th>
              <th>{t('blog.colDate')}</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((item) => (
              <tr key={item.id} onClick={() => openPost(item.id)}>
                <td className="list__title">
                  {/* The row is clickable with the mouse; this button makes it reachable by keyboard. */}
                  <button
                    className="link blog__post-link"
                    onClick={(e) => {
                      e.stopPropagation()
                      openPost(item.id)
                    }}
                  >
                    {item.title || t('blog.untitled')}
                  </button>
                </td>
                <td className="muted mono">{item.url}</td>
                <td className="muted small">{item.tags.join(', ')}</td>
                <td>
                  <StatusPill status={item.status} scheduled={item.scheduled} />
                </td>
                <td className="muted">{formatDate(item.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )

  const urlSection = site && (
    <UrlSettings
      site={site}
      hasPublished={Boolean(posts?.some((p) => p.status === 'published'))}
      onSaved={(next) => {
        setSite(next)
        loadPosts()
      }}
    />
  )

  return (
    <div className="blog">
      {layoutsDone ? (
        <>
          {postsSection}
          {urlSection}
          {setupSection}
        </>
      ) : (
        <>
          {setupSection}
          {postsSection}
        </>
      )}
    </div>
  )
}

const PRESETS = [
  { path: '/blog/post-name/', permalink: '/blog/%postname%/', list: '/blog/' },
  { path: '/post-name/', permalink: '/%postname%/', list: '/blog/', wordpress: true },
  { path: '/articles/post-name/', permalink: '/articles/%postname%/', list: '/articles/' }
]

/** Post URL pattern and the list's address. Changing them re-publishes with redirects. */
function UrlSettings({
  site,
  hasPublished,
  onSaved
}: {
  site: SiteSettings
  hasPublished: boolean
  onSaved: (site: SiteSettings) => void
}): React.JSX.Element {
  const t = useT()
  const [permalink, setPermalink] = useState(site.blog.permalink)
  const [list, setList] = useState(site.blog.listPath)
  const [perPage, setPerPage] = useState(site.blog.postsPerPage)
  const [title, setTitle] = useState(site.blog.title)
  const [scheduleDeploy, setScheduleDeploy] = useState(site.blog.scheduleDeploy)
  const [status, setStatus] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const changed =
    permalink !== site.blog.permalink ||
    list !== site.blog.listPath ||
    perPage !== site.blog.postsPerPage ||
    title !== site.blog.title ||
    scheduleDeploy !== site.blog.scheduleDeploy

  const save = async (): Promise<void> => {
    setStatus(null)
    try {
      const next = await window.api.saveSiteSettings({
        blog: { permalink, listPath: list, postsPerPage: perPage, title, scheduleDeploy }
      })
      setPermalink(next.blog.permalink)
      setList(next.blog.listPath)
      let text = t('blog.savedNotice')
      if (hasPublished) {
        const result = await window.api.regenerateBlog()
        text = t('blog.republished', {
          written: result.written.length,
          removed: result.removed.length,
          redirects: result.redirects
        })
      }
      setStatus({ kind: 'success', text })
      onSaved(next)
    } catch (e) {
      setStatus({ kind: 'error', text: errorMessage(e) })
    }
  }

  let example = ''
  try {
    example = t('blog.urlExample', {
      post: postPath(permalink, 'my-first-post'),
      list: listPath(list),
      page2: listPath(list, 2)
    })
  } catch {
    example = ''
  }
  return (
    <Section
      title={t('blog.urlTitle')}
      description={t('blog.urlDescription')}
      actions={
        <button className="btn btn--primary" disabled={!changed} onClick={save}>
          {hasPublished ? t('blog.saveRepublish') : t('common.save')}
        </button>
      }
    >
      <div className="url-presets" role="radiogroup" aria-label={t('blog.presets')}>
        {PRESETS.map((preset) => (
          <label
            key={preset.permalink}
            className={`candidate${permalink === preset.permalink ? ' is-selected' : ''}`}
          >
            <input
              type="radio"
              name="blog-url-preset"
              checked={permalink === preset.permalink}
              onChange={() => {
                setPermalink(preset.permalink)
                setList(preset.list)
              }}
            />
            <span className="mono">
              {preset.wordpress ? t('blog.presetWordPress', { path: preset.path }) : preset.path}
            </span>
          </label>
        ))}
      </div>
      <div className="grid-3">
        <Field label={t('blog.permalink')} hint={t('blog.permalinkHint')}>
          <input
            className="mono"
            value={permalink}
            onChange={(e) => setPermalink(e.target.value)}
          />
        </Field>
        <Field
          label={t('blog.listAddress')}
          hint={t('blog.listAddressHint', {
            prefix: postPrefix(permalink.includes('%postname%') ? permalink : '/blog/%postname%/')
          })}
        >
          <input className="mono" value={list} onChange={(e) => setList(e.target.value)} />
        </Field>
        <Field label={t('blog.perPage')}>
          <input
            type="number"
            min={1}
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value))}
          />
        </Field>
      </div>
      {example && <p className="muted small mono">{example}</p>}
      <div className="grid-3">
        <Field label={t('blog.blogTitle')} hint={t('blog.blogTitleHint')}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={scheduleDeploy}
          onChange={(e) => setScheduleDeploy(e.target.checked)}
        />
        <span>
          {t('blog.scheduleDeploy')}
          <small className="muted field__hint"> {t('blog.scheduleDeployHint')}</small>
        </span>
      </label>
      {hasPublished && changed && <Notice kind="info">{t('blog.urlsMove')}</Notice>}
      <div role={status?.kind === 'error' ? 'alert' : 'status'}>
        {status && <Notice kind={status.kind}>{status.text}</Notice>}
      </div>
    </Section>
  )
}
