import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { formatBytes } from '../lib/api'
import type { Workspace } from '../../../shared/types'

interface Props {
  workspace: Workspace | null
  onOpenWorkspace: () => void
  onEditPage: (path: string) => void
  /** Pages with unsaved drafts. */
  unsaved: Set<string>
  /** Opens the Blog screen for generated pages; without it they open in the page editor. */
  onOpenBlog?: () => void
}

export default function PagesView({
  workspace,
  onOpenWorkspace,
  onEditPage,
  unsaved,
  onOpenBlog
}: Props): React.JSX.Element {
  const t = useT()
  const [generated, setGenerated] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (workspace)
      window.api.generatedPages().then(
        (paths) => setGenerated(new Set(paths)),
        () => {}
      )
  }, [workspace])

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

  if (!workspace.pages.length) return <p className="muted">{t('app.noPages')}</p>

  return (
    <table className="list list--clickable">
      <thead>
        <tr>
          <th scope="col">{t('app.colTitle')}</th>
          <th scope="col">{t('app.colFile')}</th>
          <th scope="col" className="num">
            {t('app.colSize')}
          </th>
        </tr>
      </thead>
      <tbody>
        {workspace.pages.map((entry) => {
          const isGenerated = !!onOpenBlog && generated.has(entry.path)
          const title = entry.title || t('app.untitled')
          const open = (): void => (isGenerated ? onOpenBlog!() : onEditPage(entry.path))
          return (
            <tr key={entry.path} onClick={open}>
              <td className="list__title">
                {/* The row is clickable with the mouse; the button makes it reachable by keyboard. */}
                <button
                  className="list__open"
                  onClick={(e) => {
                    e.stopPropagation()
                    open()
                  }}
                  title={isGenerated ? t('app.generatedHint') : t('app.editPageHint', { title })}
                >
                  {title}
                </button>
                {unsaved.has(entry.path) && (
                  <span className="badge badge--warn">{t('common.unsaved')}</span>
                )}
                {isGenerated && <span className="badge">{t('app.badgeBlog')}</span>}
              </td>
              <td className="muted mono">{entry.path}</td>
              <td className="muted num">{formatBytes(entry.bytes)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
