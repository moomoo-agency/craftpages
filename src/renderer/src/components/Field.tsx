import { cloneElement, isValidElement, useId } from 'react'
import { Icon, info } from '@wordpress/icons'

interface FieldProps {
  label: string
  hint?: React.ReactNode
  children: React.ReactNode
}

type ControlProps = { id?: string; 'aria-describedby'?: string }

const CONTROLS = new Set(['input', 'select', 'textarea'])

/**
 * A labelled form field. A single input / select / textarea gets the label by `for` and the
 * hint as its description; anything else (an input with buttons…) is wrapped by the label.
 */
export function Field({ label, hint, children }: FieldProps): React.JSX.Element {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const hintNode = hint && (
    <span id={hintId} className="field__hint">
      {hint}
    </span>
  )

  if (
    isValidElement<ControlProps>(children) &&
    typeof children.type === 'string' &&
    CONTROLS.has(children.type)
  ) {
    const controlId = children.props.id ?? id
    return (
      <div className="field">
        <label className="field__label" htmlFor={controlId}>
          {label}
        </label>
        {cloneElement(children, {
          id: controlId,
          'aria-describedby':
            [children.props['aria-describedby'], hintId].filter(Boolean).join(' ') || undefined
        })}
        {hintNode}
      </div>
    )
  }

  return (
    <div className="field">
      <label className="field__wrap">
        <span className="field__label">{label}</span>
        {children}
      </label>
      {hintNode}
    </div>
  )
}

interface SectionProps {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
}

export function Section({
  title,
  description,
  actions,
  children
}: SectionProps): React.JSX.Element {
  return (
    <section className="panel">
      <header className="panel__head">
        <div>
          <h2>{title}</h2>
          {description && <p className="muted">{description}</p>}
        </div>
        {actions && <div className="panel__actions">{actions}</div>}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  )
}

export function Notice({
  kind = 'info',
  children
}: {
  kind?: 'info' | 'error' | 'success' | 'warning'
  children: React.ReactNode
}): React.JSX.Element {
  return <div className={`notice notice--${kind}`}>{children}</div>
}

/**
 * A broader explanation: what a feature does, what it sets up or what happens next.
 * Field hints describe one field; notices report results; this explains.
 */
export function Explainer({
  title,
  children
}: {
  title?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="explainer">
      <Icon icon={info} size={20} className="explainer__icon" aria-hidden="true" />
      <div className="explainer__body">
        {title && <strong className="explainer__title">{title}</strong>}
        {children}
      </div>
    </div>
  )
}
