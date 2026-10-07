import { useEffect, useState } from 'react'
import { Explainer, Notice } from '../components/Field'
import { errorMessage } from '../lib/api'
import { useT } from '../i18n'
import { componentName } from '../lib/components'
import type { ComponentGroup, Workspace } from '../../../shared/types'

/** The scan keeps the first 120 characters of the block's text. */
const PREVIEW_LENGTH = 120

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
      <Explainer>
        <p>{t.rich('components.intro', { b: bold })}</p>
        <p>{t('components.variantsNote')}</p>
      </Explainer>
      {groups.length === 0 && <p className="muted">{t('components.none')}</p>}
      {groups.map((group) => {
        const varied = group.variants.length > 1
        return (
          <article
            key={group.id}
            className="component-card"
            aria-labelledby={`component-${group.id}`}
          >
            <header className="component-card__head">
              <div className="component-card__heading">
                <h2 id={`component-${group.id}`} className="component-card__title">
                  {componentName(t, group)}
                </h2>
                <code className="component-card__selector">{group.label}</code>
                {varied && (
                  <span className="badge badge--warn">
                    {t('components.variants', { count: group.variants.length })}
                  </span>
                )}
              </div>
              <button
                className="btn btn--accent btn--small"
                aria-label={t('components.editLabel', { name: componentName(t, group) })}
                onClick={() => onEditPage(group.pages[0], group.id)}
              >
                {t('components.editAll')}
              </button>
            </header>

            <figure className="component-card__content">
              <figcaption>{t('components.textLabel')}</figcaption>
              {group.preview ? (
                <blockquote>
                  {group.preview}
                  {group.preview.length >= PREVIEW_LENGTH && '…'}
                </blockquote>
              ) : (
                <p className="muted">{t('components.noText')}</p>
              )}
            </figure>

            <div className="component-card__usage">
              {group.variants.map((variant, index) => (
                <div
                  key={variant.hash}
                  className="component-card__variant"
                  role={varied ? 'group' : undefined}
                  aria-label={varied ? t('components.variant', { n: index + 1 }) : undefined}
                >
                  <span className="component-card__label">
                    {varied
                      ? `${t('components.variant', { n: index + 1 })} · ${t('common.pages', { count: variant.pages.length })}`
                      : `${t('components.usedOn')} ${t('common.pages', { count: variant.pages.length })}`}
                  </span>
                  <div className="component-card__pages">
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
                </div>
              ))}
            </div>
          </article>
        )
      })}
    </div>
  )
}
