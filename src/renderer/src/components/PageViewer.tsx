import { useEffect, useState } from 'react'
import { Notice } from './Field'
import { errorMessage } from '../lib/api'
import { useT } from '../i18n'

interface Props {
  /** Site path of the page, e.g. blog/index.html. */
  path: string
  onBack: () => void
  backLabel?: string
  /** Shown in the bar, e.g. what the page is and where to change it. */
  children?: React.ReactNode
}

/**
 * A page as visitors see it, without the editor: for pages the blog writes, which are
 * rebuilt on every save and can't be edited themselves. Links work, so the whole blog
 * can be browsed from here.
 */
export default function PageViewer({
  path,
  onBack,
  backLabel,
  children
}: Props): React.JSX.Element {
  const t = useT()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.blogViewUrl(path).then(setUrl, (e) => setError(errorMessage(e)))
  }, [path])

  return (
    <div className="blog blog--wide">
      <div className="blog__bar">
        <button className="link" onClick={onBack}>
          <span aria-hidden="true">← </span>
          {backLabel ?? t('blog.backToBlog')}
        </button>
        <span className="mono small">/{path.replace(/(^|\/)index\.html$/, '$1')}</span>
        <span className="muted small">{t('blog.viewerNote')}</span>
        {children && <span className="blog__bar-actions">{children}</span>}
      </div>
      {error && (
        <div role="alert">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
      {url && (
        <iframe
          className="blog__preview"
          src={url}
          title={t('blog.viewerFrame')}
          sandbox="allow-scripts allow-same-origin"
        />
      )}
    </div>
  )
}
