import { useCallback, useEffect, useState } from 'react'
import { Explainer, Notice, Section } from '../components/Field'
import { errorMessage, formatBytes } from '../lib/api'
import { translate, useT, type Key } from '../i18n'
import type { ImageEntry, OptimizeResult, Workspace } from '../../../shared/types'

interface Props {
  workspace: Workspace | null
  onEditPage: (path: string) => void
}

/** Images over this size are flagged (same threshold as the SEO check). */
const LARGE = 400 * 1024

type Filter = 'all' | 'unused' | 'large' | 'wide' | 'unsized'
type Status = { kind: 'error' | 'success' | 'info'; text: string; undo?: string } | null

const FILTERS: [Filter, Key][] = [
  ['all', 'media.filterAll'],
  ['unused', 'media.filterUnused'],
  ['large', 'media.filterLarge'],
  ['wide', 'media.filterWide'],
  ['unsized', 'media.filterUnsized']
]

const nameOf = (path: string): string => path.split('/').pop() ?? path
const folderOf = (path: string): string => path.split('/').slice(0, -1).join('/') || '/'

/** Every image of the site: upload, usage, size, optimise, replace everywhere, delete unused. */
export default function MediaView({ workspace, onEditPage }: Props): React.JSX.Element {
  const t = useT()
  const [images, setImages] = useState<ImageEntry[] | null>(null)
  const [maxWidth, setMaxWidth] = useState(2400)
  const [filter, setFilter] = useState<Filter>('all')
  const [folder, setFolder] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [focus, setFocus] = useState<string | null>(null)
  const [plan, setPlan] = useState<OptimizeResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const reload = useCallback(
    (): Promise<void> =>
      window.api.listImages().then(
        (next) => {
          setImages(next.sort((a, b) => a.path.localeCompare(b.path)))
          const paths = new Set(next.map((image) => image.path))
          setSelected((current) => new Set([...current].filter((path) => paths.has(path))))
          setFocus((current) => (current && paths.has(current) ? current : null))
        },
        (e) => setStatus({ kind: 'error', text: errorMessage(e) })
      ),
    []
  )

  useEffect(() => {
    if (!workspace) return
    reload()
    window.api.getSiteSettings().then((site) => setMaxWidth(site.images.maxWidth))
  }, [workspace, reload])

  if (!workspace) {
    return (
      <div className="empty">
        <h2>{t('media.title')}</h2>
        <p>{t('common.noProject')}</p>
      </div>
    )
  }

  const run = async (task: () => Promise<Status>): Promise<void> => {
    setBusy(true)
    try {
      setStatus(await task())
    } catch (e) {
      setStatus({ kind: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const all = images ?? []
  const matches = (image: ImageEntry): boolean =>
    (filter === 'all' ||
      (filter === 'unused' && image.usedIn.length === 0) ||
      (filter === 'large' && image.bytes > LARGE) ||
      (filter === 'wide' && image.width > maxWidth) ||
      (filter === 'unsized' && image.unsized > 0)) &&
    (!folder || folderOf(image.path) === folder) &&
    (!query || image.path.toLowerCase().includes(query.toLowerCase()))
  const visible = all.filter(matches)
  const folders = [...new Set(all.map((image) => folderOf(image.path)))].sort()
  const counts = {
    all: all.length,
    unused: all.filter((i) => i.usedIn.length === 0).length,
    large: all.filter((i) => i.bytes > LARGE).length,
    wide: all.filter((i) => i.width > maxWidth).length,
    unsized: all.filter((i) => i.unsized > 0).length
  }
  const total = all.reduce((sum, image) => sum + image.bytes, 0)
  const chosen = all.find((image) => image.path === focus) ?? null
  // Sizes are fixed for the selected images, or for every image missing them.
  const sizeTargets = (selected.size ? all.filter((i) => selected.has(i.path)) : all).filter(
    (image) => image.unsized > 0
  )

  const toggle = (path: string): void =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  // Status texts are built when the task finishes, in the language shown at that moment.
  const preview = (paths: string[]): Promise<void> =>
    run(async () => {
      const result = await window.api.optimizeImages(paths, false)
      setPlan(result)
      return result.items.length ? null : { kind: 'info', text: translate('media.nothingToGain') }
    })

  const apply = (): Promise<void> =>
    run(async () => {
      if (!plan) return null
      const result = await window.api.optimizeImages(
        plan.items.map((item) => item.path),
        true
      )
      setPlan(null)
      await reload()
      return {
        kind: 'success',
        text: translate('media.optimized', {
          count: result.items.length,
          size: formatBytes(result.saved)
        }),
        undo: result.historyId ?? undefined
      }
    })

  const replace = (path: string): Promise<void> =>
    run(async () => {
      const result = await window.api.replaceImage(path)
      if (!result) return null
      await reload()
      setFocus(result.path)
      return {
        kind: 'success',
        text: result.files.length
          ? translate('media.replacedIn', { path: result.path, files: result.files.join(', ') })
          : translate('media.replaced', { path: result.path }),
        undo: result.historyId
      }
    })

  const remove = (path: string): Promise<void> =>
    run(async () => {
      const result = await window.api.deleteImage(path)
      await reload()
      return { kind: 'success', text: translate('media.deleted', { path }), undo: result.historyId }
    })

  const upload = (): Promise<void> =>
    run(async () => {
      const uploaded = await window.api.uploadImages()
      if (!uploaded.length) return null
      await reload()
      const paths = uploaded.map((image) => image.src.replace(/^\//, ''))
      setFilter('all')
      setFolder('')
      setQuery('')
      setSelected(new Set(paths))
      setFocus(paths[paths.length - 1])
      const before = uploaded.reduce((sum, image) => sum + image.originalBytes, 0)
      const after = uploaded.reduce((sum, image) => sum + image.bytes, 0)
      return {
        kind: 'success',
        text:
          uploaded.length === 1
            ? translate('media.uploaded', {
                name: nameOf(paths[0]),
                before: formatBytes(before),
                after: formatBytes(after)
              })
            : translate('media.uploadedMany', {
                count: uploaded.length,
                before: formatBytes(before),
                after: formatBytes(after)
              })
      }
    })

  const addSizes = (): Promise<void> =>
    run(async () => {
      const result = await window.api.addImageDimensions(sizeTargets.map((image) => image.path))
      await reload()
      const skipped = result.skipped.length
        ? ` ${translate('media.sizesSkipped', { files: result.skipped.join(', ') })}`
        : ''
      return result.images
        ? {
            kind: 'success',
            text: `${translate('media.sizesAdded', { count: result.images })} ${translate('media.sizesPages', { count: result.pages.length })}${skipped}`
          }
        : { kind: 'info', text: `${translate('media.sizesNone')}${skipped}` }
    })

  const undo = (id: string): Promise<void> =>
    run(async () => {
      await window.api.revertHistory(id)
      await reload()
      return { kind: 'info', text: translate('media.undone') }
    })

  return (
    <div className="media">
      <Section
        title={t('media.title')}
        description={
          images
            ? t('media.summary', { count: all.length, size: formatBytes(total) })
            : t('media.scanning')
        }
        actions={
          <>
            <button className="btn btn--accent" onClick={upload} disabled={busy}>
              {t('media.uploadMany')}
            </button>
            <button
              className="btn"
              onClick={addSizes}
              disabled={busy || sizeTargets.length === 0}
              title={t(sizeTargets.length ? 'media.addSizesTip' : 'media.addSizesNoneTip')}
            >
              {t('media.addSizes', { count: sizeTargets.length })}
            </button>
            <button
              className="btn btn--primary"
              onClick={() => preview([...selected])}
              disabled={busy || selected.size === 0}
              title={selected.size ? undefined : t('media.optimizeHint')}
            >
              {selected.size
                ? t('media.optimizeSelected', { count: selected.size })
                : t('media.optimizeNone')}
            </button>
          </>
        }
      >
        <div className="media__filters">
          <div className="segmented" role="radiogroup" aria-label={t('media.filterLabel')}>
            {FILTERS.map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={filter === value}
                className={filter === value ? 'is-active' : ''}
                onClick={() => setFilter(value)}
              >
                {t(label, { width: maxWidth })}
                {images && <span className="media__count">{counts[value]}</span>}
              </button>
            ))}
          </div>
          <select
            value={folder}
            aria-label={t('media.folder')}
            onChange={(e) => setFolder(e.target.value)}
          >
            <option value="">{t('media.allFolders')}</option>
            {folders.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder={t('media.search')}
            aria-label={t('media.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="media__selection">
            {selected.size > 0 && <span>{t('media.selectedCount', { count: selected.size })}</span>}
            {visible.some((image) => !selected.has(image.path)) && (
              <button
                className="link"
                onClick={() =>
                  setSelected(new Set([...selected, ...visible.map((image) => image.path)]))
                }
              >
                {t('media.selectShown', { count: visible.length })}
              </button>
            )}
            {selected.size > 0 && (
              <button className="link" onClick={() => setSelected(new Set())}>
                {t('media.clearSelection')}
              </button>
            )}
          </span>
        </div>

        <div role={status?.kind === 'error' ? 'alert' : 'status'}>
          {status && (
            <Notice kind={status.kind}>
              {status.text}{' '}
              {status.undo && (
                <button className="link" onClick={() => undo(status.undo!)}>
                  {t('common.undo')}
                </button>
              )}
            </Notice>
          )}
        </div>

        {plan && plan.items.length > 0 && (
          <div className="media-plan">
            <header>
              <strong>
                {t('media.planTitle', { count: plan.items.length, size: formatBytes(plan.saved) })}
              </strong>
            </header>
            <Explainer>
              {t.rich('media.planNote', { folder: <code>.sitecms/media/originals</code> })}
            </Explainer>
            <ul>
              {plan.items.map((item) => (
                <li key={item.path}>
                  <span className="mono">{item.path}</span>
                  <span className="muted">
                    {formatBytes(item.before)} → {formatBytes(item.after)} · {item.width}×
                    {item.height}
                  </span>
                </li>
              ))}
              {plan.skipped.map((item) => (
                <li key={item.path} className="muted">
                  <span className="mono">{item.path}</span>
                  <span>{item.reason}</span>
                </li>
              ))}
            </ul>
            <div className="panel__actions">
              <button className="btn" onClick={() => setPlan(null)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn--primary" onClick={apply} disabled={busy}>
                {busy ? t('media.optimizing') : t('media.optimize')}
              </button>
            </div>
          </div>
        )}

        <div className={`media__body${chosen ? ' has-detail' : ''}`}>
          <div className="media-grid">
            {!images && <p className="muted">{t('common.loading')}</p>}
            {images && visible.length === 0 && (
              <p className="muted">{t(all.length ? 'media.noMatches' : 'media.noImages')}</p>
            )}
            {visible.map((image) => {
              const name = nameOf(image.path)
              const checked = selected.has(image.path)
              return (
                <div
                  key={image.path}
                  className={`media-card${image.path === focus ? ' is-selected' : ''}${
                    checked ? ' is-checked' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    className="media-card__check"
                    aria-label={t('media.select', { name })}
                    checked={checked}
                    onChange={() => toggle(image.path)}
                  />
                  <button
                    className="media-card__open"
                    aria-pressed={image.path === focus}
                    title={image.path}
                    onClick={() => setFocus(image.path)}
                  >
                    <span className="media-card__thumb">
                      <img src={image.url} alt="" loading="lazy" />
                    </span>
                    <span className="media-card__name">{name}</span>
                    <span className="media-card__meta mono">{folderOf(image.path)}</span>
                    <span className="media-card__meta">
                      {image.width ? `${image.width}×${image.height} · ` : ''}
                      {image.bytes > LARGE ? (
                        <span className="media-card__warn">
                          {formatBytes(image.bytes)}
                          <span className="visually-hidden"> ({t('media.large')})</span>
                        </span>
                      ) : (
                        formatBytes(image.bytes)
                      )}
                    </span>
                    {image.usedIn.length === 0 && (
                      <span className="media-card__tag">{t('media.unused')}</span>
                    )}
                    {image.unsized > 0 && (
                      <span className="media-card__tag" title={t('media.addSizesTip')}>
                        {t('media.noSize')}
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>

          {chosen && (
            <aside className="media-detail" aria-label={t('media.details')}>
              <div className="media-detail__head">
                <p className="mono">{chosen.path}</p>
                <button
                  className="btn btn--ghost btn--icon btn--small"
                  aria-label={t('media.closeDetails')}
                  title={t('media.closeDetails')}
                  onClick={() => setFocus(null)}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              <img src={chosen.url} alt={nameOf(chosen.path)} />
              <p className="muted small">
                {chosen.width ? `${chosen.width} × ${chosen.height} px · ` : ''}
                {formatBytes(chosen.bytes)}
              </p>
              <h3>{t('media.usedIn')}</h3>
              {chosen.usedIn.length ? (
                <ul>
                  {chosen.usedIn.map((file) => (
                    <li key={file}>
                      {/\.html?$/.test(file) ? (
                        <button className="link mono" onClick={() => onEditPage(file)}>
                          {file}
                        </button>
                      ) : (
                        <span className="mono">{file}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">{t('media.notUsed')}</p>
              )}
              <div className="media-detail__actions">
                <button
                  className="btn btn--accent"
                  onClick={() => replace(chosen.path)}
                  disabled={busy}
                >
                  {t('media.replace')}
                </button>
                <button className="btn" onClick={() => preview([chosen.path])} disabled={busy}>
                  {t('media.optimizeOne')}
                </button>
                <button
                  className="btn btn--danger-outline"
                  onClick={() => remove(chosen.path)}
                  disabled={busy || chosen.usedIn.length > 0}
                >
                  {t('common.delete')}
                </button>
              </div>
              {chosen.usedIn.length > 0 && <p className="muted small">{t('media.deleteInUse')}</p>}
            </aside>
          )}
        </div>
      </Section>
    </div>
  )
}
