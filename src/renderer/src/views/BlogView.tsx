import { useEffect, useId, useState } from 'react'
import { Explainer, Field, Notice, Section } from '../components/Field'
import PostEditor from './PostEditor'
import PageViewer from '../components/PageViewer'
import LayoutPointer from './LayoutPointer'
import StatusPill from '../components/StatusPill'
import { ListSearch, NoMatches, Pagination } from '../components/ListControls'
import { useFilteredList } from '../lib/list'
import { copyText, errorMessage, formatDate } from '../lib/api'
import { useT, type Key, type Translator } from '../i18n'
import { fileOfPath, listPath, postPath, postPrefix } from '../../../shared/blog-urls'
import type {
  LatestLayout,
  LayoutLinks,
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
    | 'overview'
    | 'choose'
    | 'point-post'
    | 'point-list'
    | 'point-latest'
    | 'preview'
    | 'editor'
    | 'view'
  >('overview')
  /** The generated page shown as visitors see it (mode 'view'). */
  const [viewing, setViewing] = useState<string | null>(null)
  /** Links that creating the blog would leave pointing at the templates. */
  const [plannedLinks, setPlannedLinks] = useState<LayoutLinks | null>(null)
  const [fixLinks, setFixLinks] = useState(true)
  const [creating, setCreating] = useState(false)
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
  const postList = useFilteredList(`posts:${workspace?.folder}`, posts ?? [], (item) => [
    item.title,
    item.url,
    ...item.tags
  ])

  // Saving a post rewrites the blog's pages, so the generated list is reloaded with posts.
  const loadPosts = (): Promise<void> =>
    Promise.all([
      window.api.listPosts().then(setPosts, (e) => setError(errorMessage(e))),
      loadGenerated()
    ]).then(() => {})
  const loadGenerated = (): Promise<void> =>
    window.api.generatedPages().then(
      (paths) => setGenerated(new Set(paths)),
      () => {}
    )

  useEffect(() => {
    if (!workspace) return
    window.api.listPosts().then(setPosts, (e) => setError(errorMessage(e)))
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

  useEffect(() => {
    if (!workspace || !setup?.templates?.postLayout || !setup.templates.listLayout) return
    window.api.getLayoutLinks(true).then(setPlannedLinks, () => setPlannedLinks(null))
  }, [workspace, setup, generated])

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
  const blogHome = site ? listPath(site.blog.listPath) : '/blog/'
  /** The blog exists once its list page does, with or without posts. */
  const created = generated.has(fileOfPath(blogHome))

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

  const plannedCount = plannedLinks?.pages.reduce((sum, page) => sum + page.links, 0) ?? 0

  const createBlog = async (): Promise<void> => {
    setError(null)
    setCreating(true)
    try {
      const result = await window.api.createBlog(fixLinks && plannedCount > 0)
      await loadGenerated()
      const links = result.links
      setFlash(
        [
          t('blog.createdNotice', { blog: blogHome }),
          links?.links ? t('blog.layoutLinksDone', { count: links.links }) : '',
          links?.skipped.length
            ? t('blog.layoutLinksSkipped', { list: links.skipped.join(', ') })
            : ''
        ]
          .filter(Boolean)
          .join(' ')
      )
    } catch (e) {
      setError(errorMessage(e))
    }
    setCreating(false)
  }

  const view = (path: string): void => {
    setViewing(path)
    setMode('view')
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

  if (mode === 'view' && viewing) {
    return (
      <PageViewer
        path={viewing}
        onBack={() => {
          setViewing(null)
          setMode('overview')
        }}
      />
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
        knownCategories={[...new Set((posts ?? []).map((p) => p.category).filter(Boolean))].sort()}
        knownAuthors={[...new Set((posts ?? []).map((p) => p.author).filter(Boolean))].sort()}
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
          <Explainer>{status}</Explainer>
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
                : t('blog.aiNotConnected')}
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
      title={layoutsDone && created ? t('blog.setupTitle') : t('blog.setupTitleTodo')}
      description={layoutsDone && created ? t('blog.setupDone') : t('blog.setupTodo')}
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
        <li className={created ? 'is-done' : ''}>
          <strong>
            {t('blog.stepCreate')}
            {created && <span className="visually-hidden"> ({t('blog.stepDone')})</span>}
          </strong>
          {created ? (
            <span className="muted small">
              {t.rich('blog.createdSummary', {
                blog: <span className="mono">{blogHome}</span>
              })}
            </span>
          ) : (
            <>
              <span className="muted small">{t('blog.stepCreateHint')}</span>
              <ul className="create-plan small">
                <li>
                  {t.rich('blog.createList', {
                    blog: <span className="mono">{blogHome}</span>,
                    list: <span className="mono">{templates.list}</span>
                  })}
                </li>
                <li>
                  {t.rich('blog.createPosts', {
                    post: <span className="mono">{templates.post}</span>
                  })}
                </li>
                {plannedLinks && plannedLinks.layouts.length > 0 && (
                  <li>
                    {t.rich('blog.createRetire', {
                      pages: <span className="mono">{plannedLinks.layouts.join(', ')}</span>
                    })}
                  </li>
                )}
              </ul>
              {plannedCount > 0 && (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={fixLinks}
                    onChange={(e) => setFixLinks(e.target.checked)}
                  />
                  <span>
                    {t('blog.createLinks', { count: plannedCount, blog: blogHome })}
                    <span className="check__hint">
                      {plannedLinks!.pages
                        .map((page) =>
                          page.unsaved
                            ? `${page.path} (${t('blog.layoutLinksUnsaved')})`
                            : page.path
                        )
                        .join(', ')}
                    </span>
                  </span>
                </label>
              )}
            </>
          )}
          <span>
            {created ? (
              <button className="btn btn--small" onClick={() => view(fileOfPath(blogHome))}>
                {t('blog.openBlog', { blog: blogHome })}
              </button>
            ) : (
              <button
                className="btn btn--small btn--primary"
                disabled={!layoutsDone || creating}
                title={layoutsDone ? undefined : t('blog.finishLayoutsFirst')}
                onClick={createBlog}
              >
                {t('blog.createButton')}
              </button>
            )}
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
          {latestBlocks.length > 0 && (
            <ul className="latest-blocks">
              {latestBlocks.map((block) => (
                <LatestBlockRow
                  key={block.id}
                  block={block}
                  title={workspace.pages.find((page) => page.path === block.page)?.title}
                  onOpen={() => onOpenPage(block.page)}
                  onCount={(count) =>
                    saveLatest(latestBlocks.map((b) => (b.id === block.id ? { ...b, count } : b)))
                  }
                  onAdjust={() => {
                    setLatestEdit(block)
                    setMode('point-latest')
                  }}
                  onRemove={() => saveLatest(latestBlocks.filter((b) => b.id !== block.id))}
                />
              ))}
            </ul>
          )}
          <div className="latest-add">
            <label className="latest-add__label" htmlFor="latest-add-page">
              {t(latestBlocks.length ? 'blog.latestAddAnother' : 'blog.latestAdd')}
            </label>
            <select
              id="latest-add-page"
              value={latestPage}
              onChange={(e) => setLatestPage(e.target.value)}
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
          </div>
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
        <>
          {postList.searchable && (
            <ListSearch
              value={postList.query}
              onChange={postList.setQuery}
              label={t('blog.searchPosts')}
            />
          )}
          {postList.matched === 0 ? (
            <NoMatches query={postList.query} onClear={() => postList.setQuery('')} />
          ) : (
            <table className="list list--clickable">
              <thead>
                <tr>
                  <th scope="col">{t('blog.colTitle')}</th>
                  <th scope="col">{t('blog.colUrl')}</th>
                  <th scope="col">{t('blog.colTags')}</th>
                  <th scope="col">{t('blog.colStatus')}</th>
                  <th scope="col">{t('blog.colDate')}</th>
                </tr>
              </thead>
              <tbody>
                {postList.rows.map((item) => (
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
          <Pagination
            page={postList.page}
            pages={postList.pages}
            total={postList.matched}
            onPage={postList.setPage}
          />
        </>
      )}
    </Section>
  )

  const urlSection = site && (
    <UrlSettings
      site={site}
      hasPublished={created || Boolean(posts?.some((p) => p.status === 'published'))}
      onSaved={(next) => {
        setSite(next)
        loadPosts()
      }}
    />
  )

  return (
    <div className="blog">
      {layoutsDone && created ? (
        <>
          {postsSection}
          <LayoutLinksCard refresh={generated} onOpenPage={onOpenPage} />
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

/**
 * Links on the site's pages to layout pages the blog took off the site (the site's
 * "Blog" link to blog.html…), with one button to point them at the blog. Shown only
 * while there are some.
 */
function LayoutLinksCard({
  refresh,
  onOpenPage
}: {
  /** Reloads when it changes (the blog's pages were just written). */
  refresh: unknown
  onOpenPage: (path: string) => void
}): React.JSX.Element | null {
  const t = useT()
  const [links, setLinks] = useState<LayoutLinks | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{
    kind: 'error' | 'success' | 'info'
    text: string
    undo?: string
  } | null>(null)

  const load = (): Promise<void> => window.api.getLayoutLinks().then(setLinks, () => setLinks(null))
  useEffect(() => {
    load()
  }, [refresh])

  const fix = async (): Promise<void> => {
    setBusy(true)
    setStatus(null)
    try {
      const result = await window.api.fixLayoutLinks()
      const text = [
        result.links ? t('blog.layoutLinksDone', { count: result.links }) : '',
        result.skipped.length
          ? t('blog.layoutLinksSkipped', { list: result.skipped.join(', ') })
          : ''
      ]
        .filter(Boolean)
        .join(' ')
      setStatus({
        kind: result.links ? 'success' : 'info',
        text,
        undo: result.historyId ?? undefined
      })
    } catch (e) {
      setStatus({ kind: 'error', text: errorMessage(e) })
    }
    setBusy(false)
    await load()
  }

  const undo = async (id: string): Promise<void> => {
    try {
      await window.api.revertHistory(id)
      setStatus({ kind: 'info', text: t('blog.layoutLinksUndone') })
    } catch (e) {
      setStatus({ kind: 'error', text: errorMessage(e) })
    }
    await load()
  }

  if (!links && !status) return null
  const count = links?.pages.reduce((sum, page) => sum + page.links, 0) ?? 0
  return (
    <Section
      title={t('blog.layoutLinksTitle')}
      actions={
        links && (
          <button
            className="btn btn--primary"
            disabled={busy || links.pages.every((page) => page.unsaved)}
            onClick={fix}
          >
            {t('blog.layoutLinksFix')}
          </button>
        )
      }
    >
      {links && (
        <>
          <p className="muted">
            {t('blog.layoutLinksBody', {
              count,
              layouts: links.layouts.join(', '),
              blog: links.blogHome
            })}
          </p>
          <ul className="layout-links">
            {links.pages.map((page) => (
              <li key={page.path}>
                <button className="link mono" onClick={() => onOpenPage(page.path)}>
                  {page.path}
                </button>{' '}
                <span className="muted small">
                  ({page.links}
                  {page.unsaved && `, ${t('blog.layoutLinksUnsaved')}`})
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div role="status">
        {status && status.kind !== 'error' && (
          <Notice kind={status.kind}>
            <span className="blog__flash">
              {status.text}
              {status.undo && (
                <button className="link" onClick={() => undo(status.undo!)}>
                  {t('common.undo')}
                </button>
              )}
            </span>
          </Notice>
        )}
      </div>
      <div role="alert">
        {status?.kind === 'error' && <Notice kind="error">{status.text}</Notice>}
      </div>
    </Section>
  )
}

/** One "latest posts" block: where it is, how many posts it shows, adjust / remove. */
function LatestBlockRow({
  block,
  title,
  onOpen,
  onCount,
  onAdjust,
  onRemove
}: {
  block: LatestLayout
  title?: string
  onOpen: () => void
  onCount: (count: number) => void
  onAdjust: () => void
  onRemove: () => void
}): React.JSX.Element {
  const t = useT()
  const id = useId()
  // Saving re-publishes the blog: only when the number is done (blur or Enter), not per key.
  const [count, setCount] = useState(String(block.count))
  const commit = (): void => {
    const next = Math.min(24, Math.max(1, Number(count) || 1))
    setCount(String(next))
    if (next !== block.count) onCount(next)
  }
  return (
    <li className="latest-block">
      <div className="latest-block__where">
        <button className="link latest-block__page" onClick={onOpen}>
          {title || block.page}
        </button>
        <span className="latest-block__meta">
          {title && <span className="mono">{block.page}</span>}
          <span>{t('blog.latestShows', { count: block.count })}</span>
        </span>
      </div>
      <label className="latest-block__count" htmlFor={id}>
        {t('blog.latestCount')}
        <input
          id={id}
          aria-label={t('blog.latestCountOn', { page: block.page })}
          type="number"
          min={1}
          max={24}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
      </label>
      <div className="latest-block__actions">
        <button
          className="btn btn--small"
          aria-label={t('blog.adjustLatest', { page: block.page })}
          onClick={onAdjust}
        >
          {t('blog.adjust')}
        </button>
        <button
          className="btn btn--small btn--danger-outline"
          aria-label={t('blog.removeLatest', { page: block.page })}
          title={t('blog.removeLatestHint')}
          onClick={onRemove}
        >
          {t('common.remove')}
        </button>
      </div>
    </li>
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
  const [emptyText, setEmptyText] = useState(site.blog.emptyText)
  const [status, setStatus] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const changed =
    permalink !== site.blog.permalink ||
    list !== site.blog.listPath ||
    perPage !== site.blog.postsPerPage ||
    title !== site.blog.title ||
    scheduleDeploy !== site.blog.scheduleDeploy ||
    emptyText !== site.blog.emptyText

  const save = async (): Promise<void> => {
    setStatus(null)
    try {
      const next = await window.api.saveSiteSettings({
        blog: { permalink, listPath: list, postsPerPage: perPage, title, scheduleDeploy, emptyText }
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
        <Field label={t('blog.emptyTextLabel')} hint={t('blog.emptyTextHint')}>
          <input value={emptyText} onChange={(e) => setEmptyText(e.target.value)} />
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
          <span className="check__hint">{t('blog.scheduleDeployHint')}</span>
        </span>
      </label>
      {hasPublished && changed && (
        <Explainer>
          {t(site.deploy.target === 'server' ? 'blog.urlsMoveServer' : 'blog.urlsMove')}
        </Explainer>
      )}
      <div role={status?.kind === 'error' ? 'alert' : 'status'}>
        {status && <Notice kind={status.kind}>{status.text}</Notice>}
      </div>
    </Section>
  )
}
