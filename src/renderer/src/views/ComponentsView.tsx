import { useEffect, useState } from 'react'
import { Notice } from '../components/Field'
import { errorMessage } from '../lib/api'
import { useT } from '../i18n'
import type { ComponentGroup, Workspace } from '../../../shared/types'

interface Props {
  workspace: Workspace | null
  onEditPage: (path: string, focusComponent?: string) => void
}

export default function ComponentsView({ workspace, onEditPage }: Props): React.JSX.Element {
  const t = useT()
  const [groups, setGroups] = useState<ComponentGroup[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspace) return
    window.api.scanComponents().then(setGroups, (e) => setError(errorMessage(e)))
  }, [workspace])

  if (!workspace) {
    return (
      <div className="empty">
        <h2>{t('components.title')}</h2>
        <p>{t('components.empty')}</p>
      </div>
    )
  }
  if (error) {
    return (
      <div role="alert">
        <Notice kind="error">{error}</Notice>
      </div>
    )
  }
  if (!groups) {
    return (
      <p className="muted" role="status">
        {t('components.scanning')}
      </p>
    )
  }

  const bold = (chunk: string): React.ReactNode => <strong>{chunk}</strong>

  return (
    <div className="components">
      <div className="components__intro">
        <p>{t.rich('components.intro', { b: bold })}</p>
        <p className="muted">{t('components.variantsNote')}</p>
      </div>
      {groups.length === 0 && <p className="muted">{t('components.none')}</p>}
      {groups.map((group) => (
        <article
          key={group.id}
          className="component-card"
          aria-labelledby={`component-${group.id}`}
        >
          <header>
            <h2 id={`component-${group.id}`} className="component-card__title mono">
              {group.label}
            </h2>
            <span className="badge">{t('common.pages', { count: group.pages.length })}</span>
            {group.variants.length > 1 && (
              <span className="badge badge--warn">
                {t('components.variants', { count: group.variants.length })}
              </span>
            )}
            <button
              className="btn btn--accent btn--small component-card__edit"
              aria-label={t('components.editLabel', { name: group.label })}
              onClick={() => onEditPage(group.pages[0], group.id)}
            >
              {t('common.edit')}
            </button>
          </header>
          <p className="component-card__preview">{group.preview}</p>
          {group.variants.map((variant, index) => (
            <div
              key={variant.hash}
              className="component-card__variant"
              role={group.variants.length > 1 ? 'group' : undefined}
              aria-label={
                group.variants.length > 1 ? t('components.variant', { n: index + 1 }) : undefined
              }
            >
              {group.variants.length > 1 && (
                <span className="component-card__variant-label">
                  {t('components.variant', { n: index + 1 })}
                </span>
              )}
              {variant.pages.map((page) => (
                <button
                  key={page}
                  className="chip"
                  title={t('components.openPage', { page })}
                  onClick={() => onEditPage(page, group.id)}
                >
                  {page}
                </button>
              ))}
            </div>
          ))}
        </article>
      ))}
    </div>
  )
}
