import { useEffect, useState } from 'react'
import { Field, Notice, Section } from './Field'
import { useNotes } from '../lib/notes'
import { useT } from '../i18n'
import { errorMessage } from '../lib/api'
import type { NotFoundOptions, NotFoundState, Workspace } from '../../../shared/types'

/** The 404 page: made from one of the site's pages, then edited like any page. */
export default function NotFoundSection({
  workspace,
  onEditPage
}: {
  workspace: Workspace
  onEditPage: (path: string) => void
}): React.JSX.Element | null {
  const t = useT()
  const [state, setState] = useState<NotFoundState | null>(null)
  const [making, setMaking] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const pages = workspace.pages.filter((page) => !/(^|\/)404\.html$/.test(page.path))
  const [options, setOptions] = useState<NotFoundOptions>(() => ({
    from: pages.find((page) => page.path === 'index.html')?.path ?? pages[0]?.path ?? '',
    title: t('tools.notFoundDefaultTitle'),
    heading: t('tools.notFoundDefaultHeading'),
    message: t('tools.notFoundDefaultMessage'),
    linkText: t('tools.notFoundDefaultLink'),
    searchText: t('tools.notFoundDefaultSearch')
  }))

  const reload = async (): Promise<void> => setState(await window.api.getNotFound())
  const { busy, run, show } = useNotes(reload)

  useEffect(() => {
    window.api.getNotFound().then(setState, (e) => setLoadError(errorMessage(e)))
  }, [workspace])

  if (loadError) return <Notice kind="error">{loadError}</Notice>
  if (!state) return null

  const set = (field: keyof NotFoundOptions, value: string): void =>
    setOptions({ ...options, [field]: value })

  const create = (): Promise<void> =>
    run('notFound', async () => {
      const historyId = await window.api.createNotFound(options)
      setMaking(false)
      return { kind: 'success', text: t('tools.notFoundMade'), undo: historyId }
    })

  return (
    <Section
      title={t('tools.notFoundTitle')}
      state={state.exists ? (state.serverReady ? 'done' : 'setup') : 'setup'}
      description={
        state.exists
          ? t('tools.notFoundExists', { title: state.title || '404.html' })
          : t('tools.notFoundMissing')
      }
      actions={
        state.exists ? (
          <>
            <button className="btn btn--primary" onClick={() => onEditPage('404.html')}>
              {t('tools.notFoundEdit')}
            </button>
            <button className="btn" disabled={busy} onClick={() => setMaking(!making)}>
              {t('tools.notFoundRemake')}
            </button>
          </>
        ) : (
          !making && (
            <button className="btn btn--primary" disabled={busy} onClick={() => setMaking(true)}>
              {t('tools.notFoundMake')}
            </button>
          )
        )
      }
    >
      {state.exists && !state.serverReady && (
        <Notice kind="warning">
          {t('tools.notFoundServer')}{' '}
          <button
            className="link"
            disabled={busy}
            onClick={() =>
              run('notFound', async () => {
                // Saving the redirects writes .htaccess, with the 404 line.
                const historyId = await window.api.saveRedirects(
                  (await window.api.getRedirects()).rules
                )
                return {
                  kind: 'success',
                  text: t('tools.notFoundServerDone'),
                  undo: historyId ?? undefined
                }
              })
            }
          >
            {t('tools.notFoundServerFix')}
          </button>
        </Notice>
      )}
      {making && (
        <div className="tool-form">
          {state.exists && <Notice kind="warning">{t('tools.notFoundReplaces')}</Notice>}
          <div className="grid-2">
            <Field label={t('tools.notFoundFrom')} hint={t('tools.notFoundFromHint')}>
              <select value={options.from} onChange={(e) => set('from', e.target.value)}>
                {pages.map((page) => (
                  <option key={page.path} value={page.path}>
                    {page.title ? `${page.title} (${page.path})` : page.path}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('tools.notFoundTabTitle')}>
              <input value={options.title} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label={t('tools.notFoundHeading')}>
              <input value={options.heading} onChange={(e) => set('heading', e.target.value)} />
            </Field>
            <Field label={t('tools.notFoundLink')}>
              <input value={options.linkText} onChange={(e) => set('linkText', e.target.value)} />
            </Field>
          </div>
          <Field label={t('tools.notFoundMessage')}>
            <textarea
              rows={2}
              value={options.message}
              onChange={(e) => set('message', e.target.value)}
            />
          </Field>
          <Field label={t('tools.notFoundSearch')} hint={t('tools.notFoundSearchHint')}>
            <input value={options.searchText} onChange={(e) => set('searchText', e.target.value)} />
          </Field>
          <div className="tool-form__actions">
            <button
              className="btn btn--primary"
              disabled={busy || !options.from || !options.heading.trim()}
              onClick={create}
            >
              {t(state.exists ? 'tools.notFoundReplace' : 'tools.notFoundCreate')}
            </button>
            <button className="btn" onClick={() => setMaking(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
      {show('notFound')}
    </Section>
  )
}
