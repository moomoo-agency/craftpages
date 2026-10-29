import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  BlockEditorProvider,
  BlockInspector,
  BlockList,
  BlockTools,
  WritingFlow,
  ObserveTyping
} from '@wordpress/block-editor'
import { createBlock, serialize, type Block } from '@wordpress/blocks'
import { Popover, SlotFillProvider } from '@wordpress/components'
import '@wordpress/format-library'
import { Field, Notice } from '../components/Field'
import MediaPicker from '../components/MediaPicker'
import StatusPill from '../components/StatusPill'
import { BREAK_BLOCK, COLUMNS_BLOCK, CORE_BLOCKS, parseBlocks, registerBlocks } from '../lib/blocks'
import { CODE_BLOCK } from '../lib/code-block'
import { GIST_BLOCK } from '../lib/gist-block'
import { FORM_BLOCK } from '../lib/form-block'
import { errorMessage, formatDate, toLocalInput } from '../lib/api'
import { useT } from '../i18n'
import { listPath, postPath, postPrefix, slugify } from '../../../shared/blog-urls'
import { folderLanguage, postGroup, siteForPost } from '../../../shared/languages'
import type { ImageEntry, PostRecord, PostSummary, SiteSettings } from '../../../shared/types'

registerBlocks()

/** Gutenberg's upload hook: files go through the app's image pipeline. */
function mediaUpload({
  filesList,
  onFileChange,
  onError
}: {
  filesList: File[]
  onFileChange: (media: { url: string; alt: string; width: number; height: number }[]) => void
  onError?: (message: string) => void
}): void {
  Promise.all(
    Array.from(filesList).map(async (file) => {
      const image = await window.api.importImageData(
        file.name,
        new Uint8Array(await file.arrayBuffer())
      )
      return { url: image.src, alt: '', width: image.width, height: image.height }
    })
  ).then(onFileChange, (error) => onError?.(errorMessage(error)))
}

interface Props {
  initial: PostRecord
  site: SiteSettings
  /** More than one article area: offer the banner-position block. */
  splitRegions: boolean
  previewOrigin: string
  /** Tags used by other posts, offered as suggestions. */
  knownTags: string[]
  /** Categories and authors of other posts, offered as suggestions. */
  knownCategories: string[]
  knownAuthors: string[]
  onSaved: (post: PostRecord, message: string) => void
  onDeleted: () => void
  onBack: () => void
  /** Every post (for this one's versions in other languages). */
  posts?: PostSummary[]
  /** Opens another post (a version in another language). */
  onOpenPost?: (id: string) => void
}

export default function PostEditor({
  initial,
  site,
  splitRegions,
  previewOrigin,
  knownTags,
  knownCategories,
  knownAuthors,
  onSaved,
  onDeleted,
  onBack,
  posts,
  onOpenPost
}: Props): React.JSX.Element {
  const t = useT()
  const uid = useId()
  const [post, setPost] = useState<PostRecord>(initial)
  // Compare against the editor's own serialization, so opening a post doesn't mark it changed.
  const normalize = (record: PostRecord): PostRecord => ({
    ...record,
    content: record.content ? serialize(parseBlocks(record.content)) : record.content
  })
  const [saved, setSaved] = useState<PostRecord>(() => normalize(initial))
  // An empty post starts with one empty paragraph so there's somewhere to type.
  const [blocks, setBlocks] = useState<Block[]>(() => {
    const parsed = parseBlocks(initial.content)
    return parsed.length ? parsed : [createBlock('core/paragraph')]
  })
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug))
  const [tab, setTab] = useState<'post' | 'block'>('post')
  const [picker, setPicker] = useState<'cover' | 'social' | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'error' | 'success' | 'info'; text: string } | null>(
    null
  )
  const [preview, setPreview] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'delete' | 'leave' | null>(null)

  const content = useMemo(() => serialize(blocks), [blocks])
  const current: PostRecord = { ...post, content }
  const dirty = JSON.stringify(current) !== JSON.stringify(saved)
  const wasPublished = saved.status === 'published'
  const slug = slugTouched ? post.slug : slugify(post.title || 'post')
  // A future date turns Publish into Schedule: the post goes live when the date comes.
  // (Compared with the time the editor opened, refreshed on each save.)
  const [openedAt, setOpenedAt] = useState(() => Date.now())
  const future = new Date(post.date).getTime() > openedAt
  const savedFuture = new Date(saved.date).getTime() > openedAt
  const [tagInput, setTagInput] = useState('')

  const settings = useMemo(
    () => ({
      allowedBlockTypes: [
        ...CORE_BLOCKS,
        COLUMNS_BLOCK,
        CODE_BLOCK,
        GIST_BLOCK,
        FORM_BLOCK,
        ...(splitRegions ? [BREAK_BLOCK] : [])
      ],
      // Images, galleries, tables, embeds and text columns may go wide or full width.
      alignWide: true,
      hasFixedToolbar: false,
      bodyPlaceholder: t('post.bodyPlaceholder'),
      mediaUpload
    }),
    [splitRegions, t]
  )

  const set = <K extends keyof PostRecord>(key: K, value: PostRecord[K]): void =>
    setPost((p) => ({ ...p, [key]: value }))

  const addTag = (raw: string): void => {
    const name = raw.replace(/\s+/g, ' ').trim()
    setTagInput('')
    if (!name) return
    const tags = post.tags ?? []
    if (tags.some((tag) => tag.toLowerCase() === name.toLowerCase())) return
    // Reuse the spelling of an existing tag ("Design" rather than "design").
    const known = knownTags.find((tag) => tag.toLowerCase() === name.toLowerCase())
    set('tags', [...tags, known ?? name])
  }

  /** Resolves to whether the post was saved (errors show in the notice). */
  const save = async (status: PostRecord['status'] = post.status): Promise<boolean> => {
    setBusy(true)
    setNotice(null)
    try {
      const result = await window.api.savePost({ ...current, slug, status })
      setPost(result.post)
      setSaved(normalize(result.post))
      setBlocks(parseBlocks(result.post.content))
      setSlugTouched(true)
      const g = result.generated
      const savedAt = Date.now()
      setOpenedAt(savedAt)
      const scheduledFor = new Date(result.post.date).getTime() > savedAt
      const path = postPath(siteForPost(site, result.post).blog.permalink, result.post.slug)
      const message =
        status === 'published' && scheduledFor
          ? t('post.scheduledFor', { date: formatDate(result.post.date), path })
          : status === 'published' && !wasPublished
            ? t('post.publishedAt', { path })
            : status === 'draft' && wasPublished
              ? t('post.unpublished')
              : g
                ? t('post.updated')
                : t('post.draftSaved')
      // Separate sentences, one message each.
      const detail = g
        ? [
            t('post.filesWritten', { count: g.written.length }),
            g.removed.length ? t('post.filesRemoved', { count: g.removed.length }) : '',
            t('post.deployHint', { action: t('app.publishSite') })
          ]
        : []
      setNotice({ kind: 'success', text: [message, ...detail].filter(Boolean).join(' ') })
      onSaved(result.post, message)
      return true
    } catch (error) {
      setNotice({ kind: 'error', text: errorMessage(error) })
      return false
    } finally {
      setBusy(false)
    }
  }

  // ⌘S saves (a published post is updated on the site; a draft stays a draft).
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        event.stopPropagation()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const showPreview = async (): Promise<void> => {
    try {
      setPreview(await window.api.previewPost({ ...current, slug }))
    } catch (error) {
      setNotice({ kind: 'error', text: errorMessage(error) })
    }
  }

  const remove = async (): Promise<void> => {
    try {
      await window.api.deletePost(post.id)
      onDeleted()
    } catch (error) {
      setNotice({ kind: 'error', text: errorMessage(error) })
    }
  }

  const pickImage = (image: ImageEntry): void => {
    const src = `/${image.path}`
    if (picker === 'social') set('socialImage', { src, alt: post.socialImage?.alt ?? '' })
    else set('cover', { src, alt: post.cover?.alt ?? '' })
    // A place on the old picture means nothing on the new one.
    if (picker === 'social' || !post.socialImage) set('shareFocus', null)
    setPicker(null)
  }
  // What a share shows: the post's own social image, else the cover, else the site's default.
  const shareImage = post.socialImage?.src || post.cover?.src || site.seo.defaultImage

  const autoExcerpt = content
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 32)
    .join(' ')
  const seoTitle = post.seoTitle || post.title
  const seoDescription = post.seoDescription || post.excerpt || autoExcerpt
  const isNew = !saved.slug
  // The blog this post belongs to: its language's addresses (/en/blog/…).
  const own = siteForPost(site, post)
  const multilingual = site.languages.length > 1
  const group = postGroup(post)
  const versions = (posts ?? []).filter((other) => other.group === group && other.id !== post.id)
  const translate = async (code: string): Promise<void> => {
    try {
      const record = await window.api.translatePost(post.id, code)
      onOpenPost?.(record.id)
    } catch (error) {
      setNotice({ kind: 'error', text: errorMessage(error) })
    }
  }

  const tags = post.tags ?? []
  const tabs = ['post', 'block'] as const
  const tabId = (id: (typeof tabs)[number]): string => `${uid}-tab-${id}`
  const panelId = `${uid}-panel`
  const tagsLabelId = `${uid}-tags-label`
  const tagsHintId = `${uid}-tags-hint`
  const coverLabelId = `${uid}-cover-label`
  const socialLabelId = `${uid}-social-label`
  const confirmTextId = `${uid}-confirm`

  // Tabs: arrow keys move between them (WAI-ARIA tabs pattern).
  const onTabKey = (event: React.KeyboardEvent): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = tab === 'post' ? 'block' : 'post'
    setTab(next)
    document.getElementById(tabId(next))?.focus()
  }

  const noticeBox = notice && (
    <Notice kind={notice.kind}>
      <span>{notice.text}</span>
      <button
        type="button"
        className="btn btn--ghost btn--small btn--icon"
        aria-label={t('common.dismiss')}
        title={t('common.dismiss')}
        onClick={() => setNotice(null)}
      >
        <span aria-hidden="true">×</span>
      </button>
    </Notice>
  )

  return (
    <div className="post-editor">
      <div className="post-editor__toolbar">
        <button className="link" onClick={() => (dirty ? setConfirm('leave') : onBack())}>
          <span aria-hidden="true">← </span>
          {t('post.back')}
        </button>
        <StatusPill status={saved.status} scheduled={savedFuture} />
        <span className="muted small">
          {dirty
            ? t('post.stateUnsaved')
            : isNew
              ? t('post.stateNew')
              : t('post.stateSaved', { date: formatDate(saved.modified) })}
        </span>
        <span className="post-editor__actions">
          <button className="btn" onClick={() => (preview ? setPreview(null) : showPreview())}>
            {preview ? t('post.backToEditor') : t('common.preview')}
          </button>
          {wasPublished ? (
            <>
              <button className="btn" disabled={busy} onClick={() => save('draft')}>
                {savedFuture ? t('post.unschedule') : t('post.unpublish')}
              </button>
              <button
                className="btn btn--primary"
                disabled={busy || !dirty}
                onClick={() => save('published')}
              >
                {t('post.update')}
              </button>
            </>
          ) : (
            <>
              <button
                className="btn"
                disabled={busy || (!dirty && !isNew)}
                onClick={() => save('draft')}
              >
                {t('post.saveDraft')}
              </button>
              <button
                className="btn btn--primary"
                disabled={busy}
                onClick={() => save('published')}
                title={future ? t('post.goesLive', { date: formatDate(post.date) }) : undefined}
              >
                {future ? t('post.schedule') : t('post.publish')}
              </button>
            </>
          )}
        </span>
      </div>

      {confirm && (
        <div className="confirm-bar" role="group" aria-labelledby={confirmTextId}>
          {confirm === 'leave' ? (
            <>
              <span id={confirmTextId}>{t('post.leaveMessage')}</span>
              <button className="btn btn--small" autoFocus onClick={() => setConfirm(null)}>
                {t('post.keepEditing')}
              </button>
              <button className="btn btn--small btn--danger-outline" onClick={onBack}>
                {t('post.discardChanges')}
              </button>
              <button
                className="btn btn--small btn--primary"
                onClick={async () => {
                  // Stay in the editor when saving fails, so the edits aren't lost.
                  if (await save()) onBack()
                }}
              >
                {t('post.saveAndLeave')}
              </button>
            </>
          ) : (
            <>
              <span id={confirmTextId}>
                {t(wasPublished ? 'post.confirmDeletePublished' : 'post.confirmDelete', {
                  title: post.title || t('post.untitled')
                })}
              </span>
              <button className="btn btn--small" autoFocus onClick={() => setConfirm(null)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn--small btn--danger" onClick={remove}>
                {t('post.deletePost')}
              </button>
            </>
          )}
        </div>
      )}
      {/* Both regions stay mounted so screen readers announce what lands in them. */}
      <div className="post-editor__notices">
        <div role="status">{notice && notice.kind !== 'error' && noticeBox}</div>
        <div role="alert">{notice?.kind === 'error' && noticeBox}</div>
      </div>

      {preview ? (
        <iframe
          className="post-editor__preview"
          src={preview}
          title={t('post.previewTitle')}
          sandbox="allow-scripts"
        />
      ) : (
        <SlotFillProvider>
          <BlockEditorProvider
            value={blocks}
            onInput={setBlocks}
            onChange={setBlocks}
            settings={settings}
          >
            <div className="post-editor__body">
              <div className="post-editor__main">
                <div className="editor-canvas">
                  <textarea
                    className="post-title"
                    aria-label={t('post.titleLabel')}
                    placeholder={t('post.titlePlaceholder')}
                    rows={1}
                    value={post.title}
                    onChange={(e) => set('title', e.target.value.replace(/\n/g, ' '))}
                  />
                  <BlockTools>
                    <WritingFlow>
                      <ObserveTyping>
                        <BlockList />
                      </ObserveTyping>
                    </WritingFlow>
                  </BlockTools>
                </div>
              </div>

              <aside className="post-sidebar" aria-label={t('post.tabsLabel')}>
                <div
                  className="segmented post-sidebar__tabs"
                  role="tablist"
                  aria-label={t('post.tabsLabel')}
                  onKeyDown={onTabKey}
                >
                  {tabs.map((id) => (
                    <button
                      key={id}
                      id={tabId(id)}
                      role="tab"
                      aria-selected={tab === id}
                      aria-controls={panelId}
                      tabIndex={tab === id ? 0 : -1}
                      className={tab === id ? 'is-active' : ''}
                      onClick={() => setTab(id)}
                    >
                      {id === 'post' ? t('post.tabPost') : t('post.tabBlock')}
                    </button>
                  ))}
                </div>

                {tab === 'block' ? (
                  <div
                    className="post-sidebar__inspector"
                    id={panelId}
                    role="tabpanel"
                    aria-labelledby={tabId('block')}
                  >
                    <BlockInspector />
                  </div>
                ) : (
                  <div
                    className="post-sidebar__fields"
                    id={panelId}
                    role="tabpanel"
                    aria-labelledby={tabId('post')}
                  >
                    {multilingual && (
                      <div className="field" role="group" aria-labelledby={`${uid}-language`}>
                        <span className="field__label" id={`${uid}-language`}>
                          {t('post.languageLabel')}
                        </span>
                        <select
                          aria-labelledby={`${uid}-language`}
                          value={folderLanguage(site.languages, post.lang)?.code ?? ''}
                          onChange={(e) => set('lang', e.target.value || undefined)}
                        >
                          {site.languages.map((language) => (
                            <option key={language.code} value={language.path ? language.code : ''}>
                              {language.name}
                            </option>
                          ))}
                        </select>
                        {!isNew && (
                          <div className="post-versions" aria-label={t('post.versions')}>
                            {site.languages
                              .filter(
                                (language) =>
                                  (language.path ? language.code : '') !==
                                  (folderLanguage(site.languages, post.lang)?.code ?? '')
                              )
                              .map((language) => {
                                const code = language.path ? language.code : ''
                                const version = versions.find((other) => other.lang === code)
                                return version ? (
                                  <button
                                    key={language.code}
                                    className="btn btn--small"
                                    title={version.title}
                                    onClick={() => onOpenPost?.(version.id)}
                                  >
                                    {language.code.toUpperCase()}
                                  </button>
                                ) : (
                                  <button
                                    key={language.code}
                                    className="btn btn--small btn--ghost translation-bar__missing"
                                    title={t('post.translateTip', { language: language.name })}
                                    onClick={() => translate(language.code)}
                                  >
                                    + {language.code.toUpperCase()}
                                  </button>
                                )
                              })}
                          </div>
                        )}
                        <span className="field__hint">
                          {isNew ? t('post.languageHintNew') : t('post.languageHint')}
                        </span>
                      </div>
                    )}

                    <Field
                      label={t('post.slugLabel')}
                      hint={
                        wasPublished
                          ? t('post.slugHintPublished')
                          : slugTouched
                            ? t('post.slugHintManual')
                            : t('post.slugHintAuto')
                      }
                    >
                      <div className="slug-input">
                        <span className="mono muted" aria-hidden="true">
                          {postPrefix(own.blog.permalink)}
                        </span>
                        <input
                          className="mono"
                          value={slug}
                          spellCheck={false}
                          onChange={(e) => {
                            setSlugTouched(true)
                            set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                          }}
                          onBlur={() => set('slug', slugify(slug))}
                        />
                        <span className="mono muted" aria-hidden="true">
                          /
                        </span>
                      </div>
                    </Field>

                    <Field
                      label={t('post.dateLabel')}
                      hint={future ? t('post.dateHintFuture') : undefined}
                    >
                      <input
                        type="datetime-local"
                        value={toLocalInput(post.date)}
                        onChange={(e) =>
                          e.target.value && set('date', new Date(e.target.value).toISOString())
                        }
                      />
                    </Field>

                    <div className="field">
                      <span className="field__label" id={tagsLabelId}>
                        {t('post.tagsLabel')}
                      </span>
                      <div className="tag-input">
                        {tags.map((tag) => (
                          <span key={tag} className="chip chip--tag">
                            {tag}
                            <button
                              type="button"
                              aria-label={t('post.removeTag', { tag })}
                              title={t('post.removeTag', { tag })}
                              onClick={() =>
                                set(
                                  'tags',
                                  tags.filter((other) => other !== tag)
                                )
                              }
                            >
                              <span aria-hidden="true">×</span>
                            </button>
                          </span>
                        ))}
                        <input
                          list="known-tags"
                          aria-labelledby={tagsLabelId}
                          aria-describedby={tagsHintId}
                          value={tagInput}
                          placeholder={tags.length ? '' : t('post.tagsPlaceholder')}
                          onChange={(e) => {
                            const value = e.target.value
                            // Picking a suggestion or typing a comma adds the tag.
                            if (value.endsWith(',') || knownTags.includes(value)) {
                              addTag(value.replace(/,$/, ''))
                            } else {
                              setTagInput(value)
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addTag(tagInput)
                            } else if (e.key === 'Backspace' && !tagInput && post.tags?.length) {
                              set('tags', post.tags.slice(0, -1))
                            }
                          }}
                          onBlur={() => tagInput && addTag(tagInput)}
                        />
                        <datalist id="known-tags">
                          {knownTags
                            .filter((tag) => !tags.includes(tag))
                            .map((tag) => (
                              <option key={tag} value={tag} />
                            ))}
                        </datalist>
                      </div>
                      <span className="field__hint" id={tagsHintId}>
                        {tags[0]
                          ? t('post.tagsHintExample', {
                              path: `${listPath(own.blog.listPath)}tag/${slugify(tags[0])}/`
                            })
                          : t('post.tagsHint')}
                      </span>
                    </div>

                    <Field
                      label={t('post.categoryLabel')}
                      hint={
                        post.category?.trim()
                          ? t('post.categoryHintExample', {
                              path: `${listPath(own.blog.listPath)}category/${slugify(post.category)}/`
                            })
                          : t('post.categoryHint')
                      }
                    >
                      <input
                        list={`${uid}-categories`}
                        value={post.category ?? ''}
                        onChange={(e) => set('category', e.target.value)}
                      />
                    </Field>
                    <datalist id={`${uid}-categories`}>
                      {knownCategories.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>

                    <Field label={t('post.authorLabel')} hint={t('post.authorHint')}>
                      <input
                        list={`${uid}-authors`}
                        value={post.author ?? ''}
                        onChange={(e) => set('author', e.target.value)}
                      />
                    </Field>
                    <datalist id={`${uid}-authors`}>
                      {knownAuthors.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>

                    <div className="field" role="group" aria-labelledby={coverLabelId}>
                      <span className="field__label" id={coverLabelId}>
                        {t('post.coverLabel')}
                      </span>
                      <div className="image-preview image-preview--social">
                        {post.cover ? (
                          <img src={previewOrigin + post.cover.src} alt="" />
                        ) : (
                          <span className="muted small">{t('post.noCover')}</span>
                        )}
                      </div>
                      <div className="input-group">
                        <button className="btn" onClick={() => setPicker('cover')}>
                          {post.cover ? t('post.changeCover') : t('post.chooseCover')}
                        </button>
                        {post.cover && (
                          <button className="btn btn--ghost" onClick={() => set('cover', null)}>
                            {t('common.remove')}
                          </button>
                        )}
                      </div>
                      <span className="field__hint">{t('post.coverHint')}</span>
                    </div>
                    {post.cover && (
                      <Field label={t('post.altLabel')} hint={t('post.altHint')}>
                        <input
                          placeholder={t('post.altPlaceholder')}
                          value={post.cover.alt}
                          onChange={(e) => set('cover', { ...post.cover!, alt: e.target.value })}
                        />
                      </Field>
                    )}

                    <Field
                      label={t('post.excerptLabel')}
                      hint={t('post.excerptHint', { count: (post.excerpt || autoExcerpt).length })}
                    >
                      <textarea
                        rows={3}
                        value={post.excerpt}
                        placeholder={autoExcerpt}
                        onChange={(e) => set('excerpt', e.target.value)}
                      />
                    </Field>

                    <h2 className="post-sidebar__heading">{t('post.seoHeading')}</h2>
                    <div className="snippet">
                      <span className="snippet__url">
                        {(site.baseUrl || '') + postPath(own.blog.permalink, slug)}
                      </span>
                      <span className="snippet__title">{seoTitle || t('post.untitled')}</span>
                      <span className="snippet__desc">
                        {seoDescription || t('post.noDescription')}
                      </span>
                    </div>
                    <Field
                      label={t('post.seoTitleLabel')}
                      hint={t('post.seoTitleHint', { count: seoTitle.length })}
                    >
                      <input
                        value={post.seoTitle ?? ''}
                        placeholder={post.title}
                        onChange={(e) => set('seoTitle', e.target.value)}
                      />
                    </Field>
                    <Field
                      label={t('post.seoDescriptionLabel')}
                      hint={t('post.seoDescriptionHint', { count: seoDescription.length })}
                    >
                      <textarea
                        rows={3}
                        value={post.seoDescription ?? ''}
                        placeholder={post.excerpt || autoExcerpt}
                        onChange={(e) => set('seoDescription', e.target.value)}
                      />
                    </Field>
                    <div className="field" role="group" aria-labelledby={socialLabelId}>
                      <span className="field__label" id={socialLabelId}>
                        {t('post.socialLabel')}
                      </span>
                      {shareImage?.startsWith('/') ? (
                        <ShareCrop
                          src={previewOrigin + shareImage}
                          focus={post.shareFocus ?? null}
                          label={t('post.shareCropLabel')}
                          onChange={(focus) => set('shareFocus', focus)}
                        />
                      ) : (
                        <div className="image-preview image-preview--social">
                          {shareImage ? (
                            <img src={shareImage} alt="" />
                          ) : (
                            <span className="muted small">{t('post.noSocial')}</span>
                          )}
                        </div>
                      )}
                      <div className="input-group">
                        <button className="btn" onClick={() => setPicker('social')}>
                          {post.socialImage ? t('post.changeCover') : t('post.chooseSocial')}
                        </button>
                        {post.socialImage && (
                          <button
                            className="btn btn--ghost"
                            onClick={() => {
                              set('socialImage', null)
                              set('shareFocus', null)
                            }}
                          >
                            {t(post.cover ? 'post.useCover' : 'common.remove')}
                          </button>
                        )}
                        {post.shareFocus && (
                          <button
                            className="btn btn--ghost"
                            onClick={() => set('shareFocus', null)}
                          >
                            {t('post.shareCropReset')}
                          </button>
                        )}
                      </div>
                      <span className="field__hint">
                        {post.socialImage
                          ? t('post.socialHint')
                          : post.cover
                            ? t('post.socialFromCover')
                            : shareImage
                              ? t('post.socialFromDefault')
                              : t('post.socialHint')}
                      </span>
                    </div>
                    {post.socialImage && (
                      <Field label={t('post.altLabel')} hint={t('post.altHint')}>
                        <input
                          placeholder={t('post.altPlaceholder')}
                          value={post.socialImage.alt}
                          onChange={(e) =>
                            set('socialImage', { ...post.socialImage!, alt: e.target.value })
                          }
                        />
                      </Field>
                    )}
                    {!isNew && (
                      <button
                        className="btn btn--block btn--danger-outline btn--spaced"
                        onClick={() => setConfirm('delete')}
                      >
                        {t('post.deletePostConfirm')}
                      </button>
                    )}
                  </div>
                )}
              </aside>
            </div>
            <Popover.Slot />
          </BlockEditorProvider>
        </SlotFillProvider>
      )}

      {picker && (
        <MediaPicker
          title={t(picker === 'social' ? 'post.socialLabel' : 'post.coverLabel')}
          current={(picker === 'social' ? post.socialImage : post.cover)?.src.replace(/^\//, '')}
          onPick={pickImage}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}

const clamp = (n: number): number => Math.min(1, Math.max(0, n))

/**
 * The share card's 1.91:1 crop of the image, moved by dragging the picture (or with the
 * arrow keys). The place is `object-position` as fractions, which is how the crop is cut.
 */
function ShareCrop({
  src,
  focus,
  label,
  onChange
}: {
  src: string
  focus: [number, number] | null
  label: string
  onChange: (focus: [number, number]) => void
}): React.JSX.Element {
  const image = useRef<HTMLImageElement>(null)
  const drag = useRef<{ x: number; y: number; from: [number, number] } | null>(null)
  const [x, y] = focus ?? [0.5, 0.5]
  // How far the picture overflows the card, in pixels: what a drag can move across.
  const room = (): [number, number] => {
    const img = image.current
    if (!img?.naturalWidth) return [0, 0]
    const box = img.getBoundingClientRect()
    const scale = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight)
    return [img.naturalWidth * scale - box.width, img.naturalHeight * scale - box.height]
  }
  const move = (dx: number, dy: number, from: [number, number]): void => {
    const [rx, ry] = room()
    if (rx < 1 && ry < 1) return
    onChange([
      rx >= 1 ? clamp(from[0] - dx / rx) : from[0],
      ry >= 1 ? clamp(from[1] - dy / ry) : from[1]
    ])
  }
  return (
    <div
      className="image-preview image-preview--social share-crop"
      tabIndex={0}
      role="group"
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, y: e.clientY, from: [x, y] }
      }}
      onPointerMove={(e) => {
        const start = drag.current
        if (start) move(e.clientX - start.x, e.clientY - start.y, start.from)
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.25 : 0.05
        const [rx, ry] = room()
        const keys: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step]
        }
        const delta = keys[e.key]
        if (!delta || (rx < 1 && ry < 1)) return
        e.preventDefault()
        onChange([clamp(x + (rx >= 1 ? delta[0] : 0)), clamp(y + (ry >= 1 ? delta[1] : 0))])
      }}
    >
      <img
        ref={image}
        src={src}
        alt=""
        draggable={false}
        style={{ objectPosition: `${x * 100}% ${y * 100}%` }}
      />
    </div>
  )
}
