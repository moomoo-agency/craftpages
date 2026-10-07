import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Notice } from '../components/Field'
import { errorMessage, shortcut } from '../lib/api'
import monaco, { followTheme, languageOf } from '../lib/monaco'
import { useT } from '../i18n'
import type { SaveResult, SourceFile } from '../../../shared/types'

/** What the page editor asks of code mode before leaving it. */
export interface CodeEditorHandle {
  /** Saves every changed file; false when one couldn't be saved. */
  saveAll: () => Promise<boolean>
  discardAll: () => void
}

interface Props {
  /** The page; its stylesheets and scripts open as more tabs. */
  path: string
  /** Changes when files were saved elsewhere; unchanged files reload. */
  reloadToken: number
  /** The page has unsaved visual edits: the code can't be edited until they're resolved. */
  blocked: boolean
  onSaveDrafts: () => void
  onDiscardDrafts: () => void
  onDirtyChange: (files: number) => void
  /** Files written: reported like Save all, so the top bar and Undo save cover them too. */
  onSaved?: (result: SaveResult) => void
  ref?: React.Ref<CodeEditorHandle>
}

interface OpenFile {
  /** As last read or saved. */
  saved: SourceFile
  model: monaco.editor.ITextModel
}

const nameOf = (path: string): string => path.split('/').pop() ?? path
const PREVIEW_DELAY = 400

/**
 * Code mode: Monaco with the page's HTML and its own CSS / JS in tabs, and a live
 * preview of the unsaved HTML next to it. ⌘S saves the file in front.
 */
export default function CodeEditor({
  path,
  reloadToken,
  blocked,
  onSaveDrafts,
  onDiscardDrafts,
  onDirtyChange,
  onSaved,
  ref
}: Props): React.JSX.Element {
  const t = useT()
  const host = useRef<HTMLDivElement>(null)
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const files = useRef(new Map<string, OpenFile>())
  const [tabs, setTabs] = useState<string[]>([])
  const [active, setActive] = useState(path)
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState(true)
  const [wrap, setWrap] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [message, setMessage] = useState<{
    kind: 'error' | 'success' | 'info'
    text: string
    reload?: string
  } | null>(null)
  const [saving, setSaving] = useState(false)
  /** Pages using each asset: shared files are marked, since an edit there changes them all. */
  const [usage, setUsage] = useState<Record<string, number>>({})

  // A confirmation goes away by itself; errors stay until dismissed.
  useEffect(() => {
    if (message?.kind !== 'success') return
    const timer = setTimeout(() => setMessage(null), 2500)
    return () => clearTimeout(timer)
  }, [message])

  const refreshDirty = useCallback(() => {
    const next = new Set(
      [...files.current]
        .filter(([, file]) => file.model.getValue() !== file.saved.text)
        .map(([p]) => p)
    )
    setDirty(next)
    onDirtyChange(next.size)
  }, [onDirtyChange])

  // ---------- Preview of the unsaved HTML ----------

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const schedulePreview = useCallback(
    (delay = PREVIEW_DELAY) => {
      if (previewTimer.current) clearTimeout(previewTimer.current)
      previewTimer.current = setTimeout(() => {
        const page = files.current.get(path)
        if (!page) return
        window.api.previewSource(path, page.model.getValue()).then(setPreviewUrl, () => null)
      }, delay)
    },
    [path]
  )

  // ---------- Opening files ----------

  const open = useCallback(
    async (file: string, keepChanges: boolean): Promise<void> => {
      const read = await window.api.readSource(file)
      const current = files.current.get(file)
      if (current) {
        if (!keepChanges || current.model.getValue() === current.saved.text)
          current.model.setValue(read.text)
        current.saved = read
        return
      }
      const model = monaco.editor.createModel(
        read.text,
        languageOf(file),
        monaco.Uri.parse(`file:///${encodeURI(file)}`)
      )
      model.onDidChangeContent(() => {
        refreshDirty()
        if (file === path) schedulePreview()
      })
      files.current.set(file, { saved: read, model })
    },
    [path, refreshDirty, schedulePreview]
  )

  // The page and its assets; on a reload token, files without changes are read again.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await open(path, true)
        const assets = await window.api.pageAssets(path).catch(() => [] as string[])
        for (const asset of assets) await open(asset, true).catch(() => null)
        if (cancelled) return
        setTabs([path, ...assets.filter((asset) => files.current.has(asset))])
        window.api.assetUsage(assets).then(
          (counts) => !cancelled && setUsage(counts),
          () => null
        )
        refreshDirty()
        schedulePreview(0)
      } catch (error) {
        if (!cancelled) setMessage({ kind: 'error', text: errorMessage(error) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path, reloadToken, open, refreshDirty, schedulePreview])

  // Models belong to this page: disposed when it closes.
  useEffect(() => {
    const opened = files.current
    return () => {
      for (const file of opened.values()) file.model.dispose()
      opened.clear()
      if (previewTimer.current) clearTimeout(previewTimer.current)
    }
  }, [path])

  // ---------- Saving ----------

  /** History entries of the files written by the current save, for Undo save. */
  const written = useRef<{ file: string; historyId: string }[]>([])
  const save = useCallback(
    async (file: string): Promise<boolean> => {
      const open = files.current.get(file)
      if (!open) return true
      const text = open.model.getValue()
      if (text === open.saved.text) return true
      try {
        const result = await window.api.saveSource(file, text, open.saved.hash)
        written.current.push({ file, historyId: result.historyId })
        open.saved = { path: file, text, hash: result.hash }
        refreshDirty()
        // A saved stylesheet or script shows up in the preview once it's on disk.
        schedulePreview(0)
        return true
      } catch (error) {
        setMessage({ kind: 'error', text: errorMessage(error), reload: file })
        return false
      }
    },
    [refreshDirty, schedulePreview]
  )

  const saveAll = useCallback(async (): Promise<boolean> => {
    setSaving(true)
    written.current = []
    try {
      let ok = true
      for (const file of files.current.keys()) ok = (await save(file)) && ok
      if (ok) setMessage({ kind: 'success', text: t('code.saved') })
      const done = written.current
      // One file: Undo save puts it back. Several: each is in the history on its own.
      if (done.length)
        onSaved?.({
          pages: done.map((entry) => entry.file),
          historyId: done.length === 1 ? done[0].historyId : null,
          skipped: [],
          code: true
        })
      return ok
    } finally {
      setSaving(false)
    }
  }, [save, t, onSaved])

  const discardAll = useCallback((): void => {
    for (const file of files.current.values()) file.model.setValue(file.saved.text)
    refreshDirty()
  }, [refreshDirty])

  useImperativeHandle(ref, () => ({ saveAll, discardAll }), [saveAll, discardAll])

  const saveRef = useRef(saveAll)
  useEffect(() => {
    saveRef.current = saveAll
  })

  // ⌘S / Ctrl+S saves the code from anywhere while code mode is open (before the app's
  // own ⌘S, which saves visual edits).
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

  // ---------- The editor ----------

  useEffect(() => {
    if (!host.current) return
    const instance = monaco.editor.create(host.current, {
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      tabSize: 2,
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      stickyScroll: { enabled: true },
      linkedEditing: true
    })
    editor.current = instance
    const stop = followTheme()
    return () => {
      stop()
      instance.dispose()
      editor.current = null
    }
  }, [])

  useEffect(() => {
    const model = files.current.get(active)?.model ?? null
    editor.current?.setModel(model)
  }, [active, tabs])

  useEffect(() => {
    editor.current?.updateOptions({ readOnly: blocked, wordWrap: wrap ? 'on' : 'off' })
  }, [blocked, wrap])

  const reloadFromDisk = async (file: string): Promise<void> => {
    setMessage(null)
    await open(file, false)
    refreshDirty()
    schedulePreview(0)
  }

  return (
    <div className={`code-editor${preview ? ' has-preview' : ''}`}>
      <div className="code-editor__bar">
        <div className="code-tabs" role="tablist" aria-label={t('code.files')}>
          {tabs.map((file) => (
            <button
              key={file}
              role="tab"
              aria-selected={file === active}
              className={`code-tabs__tab${file === active ? ' is-active' : ''}`}
              title={
                (usage[file] ?? 0) > 1
                  ? t('code.sharedFileTip', { file, count: usage[file] })
                  : file
              }
              onClick={() => setActive(file)}
            >
              {nameOf(file)}
              {(usage[file] ?? 0) > 1 && (
                <span className="code-tabs__shared">
                  {t('code.sharedFile', { count: usage[file] })}
                </span>
              )}
              {dirty.has(file) && (
                <span
                  className="code-tabs__dot"
                  aria-label={t('code.unsaved')}
                  title={t('code.unsaved')}
                />
              )}
            </button>
          ))}
        </div>
        <div className="code-editor__actions">
          <label className="check check--inline small">
            <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} />
            {t('code.wrap')}
          </label>
          <label className="check check--inline small">
            <input
              type="checkbox"
              checked={preview}
              onChange={(e) => setPreview(e.target.checked)}
            />
            {t('code.preview')}
          </label>
          <button className="btn btn--small" disabled={!dirty.size} onClick={discardAll}>
            {t('code.revert')}
          </button>
          <button
            className="btn btn--small btn--primary"
            disabled={!dirty.size || saving || blocked}
            title={t('code.saveTip')}
            onClick={saveAll}
          >
            {t('code.saveCount', { count: dirty.size || 1 })}
          </button>
          {/* ⌘S means "Save all" (drafts) in Edit; here it writes the file: say so. */}
          <span className="code-editor__key muted small">
            {t('code.shortcutWrites', { shortcut: shortcut('S') })}
          </span>
        </div>
      </div>

      {blocked && (
        <div className="code-editor__notice" role="alert">
          <Notice kind="info">
            <span>{t('code.blocked')}</span>{' '}
            <button className="btn btn--small btn--primary" onClick={onSaveDrafts}>
              {t('code.blockedSave')}
            </button>{' '}
            <button className="btn btn--small" onClick={onDiscardDrafts}>
              {t('code.blockedDiscard')}
            </button>
          </Notice>
        </div>
      )}
      {message && (
        <div className="code-editor__notice" role={message.kind === 'error' ? 'alert' : 'status'}>
          <Notice kind={message.kind}>
            <span>{message.text}</span>{' '}
            {message.reload && (
              <button className="link" onClick={() => reloadFromDisk(message.reload!)}>
                {t('code.reload')}
              </button>
            )}{' '}
            <button className="link" onClick={() => setMessage(null)}>
              {t('common.dismiss')}
            </button>
          </Notice>
        </div>
      )}

      <div className="code-editor__body">
        <div className="code-editor__monaco" ref={host} />
        {preview && (
          <div className="code-editor__preview">
            {previewUrl && (
              <iframe
                src={previewUrl}
                title={t('code.previewTitle', { path })}
                // No scripts run here (and the server blocks them too), so the page may load
                // its own files, such as SVG sprites, which an opaque origin would refuse.
                sandbox="allow-same-origin"
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
