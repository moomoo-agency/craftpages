import { useEffect, useMemo, useState } from 'react'
import { Notice } from './Field'
import Modal from './Modal'
import { errorMessage, formatBytes } from '../lib/api'
import { translate, useT } from '../i18n'
import type { ImageEntry } from '../../../shared/types'

interface Props {
  title: string
  /** Path of the image currently in use, highlighted in the grid. */
  current?: string
  onPick: (image: ImageEntry) => void
  onClose: () => void
}

const folderOf = (path: string): string =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '/'
const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/** Every image in the site, by folder, plus upload (runs the optimisation pipeline). */
export default function MediaPicker({ title, current, onPick, onClose }: Props): React.JSX.Element {
  const t = useT()
  const [images, setImages] = useState<ImageEntry[] | null>(null)
  const [folder, setFolder] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(current ?? null)
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [uploading, setUploading] = useState(false)

  const load = (): Promise<void> =>
    window.api
      .listImages()
      .then(setImages, (e) => setNotice({ kind: 'error', text: errorMessage(e) }))

  useEffect(() => {
    load()
  }, [])

  const folders = useMemo(
    () => [...new Set((images ?? []).map((image) => folderOf(image.path)))].sort(),
    [images]
  )
  const visible = (images ?? []).filter(
    (image) =>
      (folder === 'all' || folderOf(image.path) === folder) &&
      image.path.toLowerCase().includes(query.trim().toLowerCase())
  )
  const chosen = images?.find((image) => image.path === selected)

  const upload = async (): Promise<void> => {
    setUploading(true)
    setNotice(null)
    try {
      const processed = await window.api.importImage()
      if (!processed) return
      await load()
      const path = processed.src.replace(/^\//, '')
      setSelected(path)
      setFolder('all')
      setQuery('')
      const saved = processed.originalBytes - processed.bytes
      const sizes = {
        name: nameOf(path),
        before: formatBytes(processed.originalBytes),
        after: formatBytes(processed.bytes)
      }
      setNotice({
        kind: 'success',
        text:
          saved > 0
            ? translate('media.uploadedSmaller', {
                ...sizes,
                percent: Math.round((saved / processed.originalBytes) * 100)
              })
            : translate('media.uploaded', sizes)
      })
    } catch (e) {
      setNotice({ kind: 'error', text: errorMessage(e) })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal label={title} onClose={onClose}>
      <header className="modal__head">
        <h2>{title}</h2>
        <button className="btn btn--accent" onClick={upload} disabled={uploading}>
          {uploading ? t('media.optimizing') : t('media.upload')}
        </button>
      </header>

      <div className="modal__filters">
        <select
          value={folder}
          aria-label={t('media.folder')}
          onChange={(e) => setFolder(e.target.value)}
        >
          <option value="all">{t('media.allFoldersCount', { count: images?.length ?? 0 })}</option>
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
      </div>
      <div role={notice?.kind === 'error' ? 'alert' : 'status'}>
        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      </div>

      <div className="media-grid">
        {!images && <p className="muted">{t('common.loading')}</p>}
        {images && visible.length === 0 && (
          <p className="muted">{t(images.length ? 'media.noMatches' : 'media.noImages')}</p>
        )}
        {visible.map((image) => (
          <button
            key={image.path}
            className={`media-card${image.path === selected ? ' is-selected' : ''}`}
            aria-pressed={image.path === selected}
            onClick={() => setSelected(image.path)}
            onDoubleClick={() => onPick(image)}
            title={image.path}
          >
            {image.path === selected && (
              <span className="media-card__tick" aria-hidden="true">
                ✓
              </span>
            )}
            <span className="media-card__thumb">
              <img src={image.url} alt="" loading="lazy" />
            </span>
            <span className="media-card__name">{nameOf(image.path)}</span>
            <span className="media-card__meta mono">{folderOf(image.path)}</span>
            <span className="media-card__meta">
              {image.width ? `${image.width}×${image.height} · ` : ''}
              {formatBytes(image.bytes)}
            </span>
            {image.usedIn.length === 0 && (
              <span className="media-card__tag">{t('media.unused')}</span>
            )}
          </button>
        ))}
      </div>

      <footer className="modal__foot">
        <span className="media-picker__status muted small" title={chosen?.path}>
          {chosen
            ? chosen.usedIn.length
              ? t('media.pickerUsedIn', { path: chosen.path, files: chosen.usedIn.join(', ') })
              : chosen.path
            : t('media.pickerHint')}
        </span>
        <div className="panel__actions">
          <button className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn--primary"
            disabled={!chosen}
            onClick={() => chosen && onPick(chosen)}
          >
            {t('media.useImage')}
          </button>
        </div>
      </footer>
    </Modal>
  )
}
