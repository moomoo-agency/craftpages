import { useEffect, useId, useRef, useState } from 'react'

export interface MenuItem {
  label: string
  onSelect: () => void
  /** Shown under the label; for a disabled item, the reason. */
  hint?: string
  disabled?: boolean
  danger?: boolean
  /** Draws a divider above the item. */
  separated?: boolean
}

interface Props {
  /** The button's accessible name (it may show only an icon). */
  label: string
  children: React.ReactNode
  items: MenuItem[]
  className?: string
}

/**
 * A button that opens a menu of actions. Arrow keys move between items, Home / End jump,
 * Escape or a click elsewhere closes it and gives focus back to the button.
 */
export default function MenuButton({
  label,
  children,
  items,
  className
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)

  const entries = (): HTMLButtonElement[] =>
    // Disabled items stay reachable: their hint says why they're off.
    Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])

  useEffect(() => {
    if (!open) return
    entries()[0]?.focus()
    const onDown = (event: MouseEvent): void => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  const close = (): void => {
    setOpen(false)
    button.current?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const all = entries()
    const index = all.indexOf(document.activeElement as HTMLButtonElement)
    const move = (to: number): void => {
      event.preventDefault()
      all[(to + all.length) % all.length]?.focus()
    }
    if (event.key === 'ArrowDown') move(index + 1)
    else if (event.key === 'ArrowUp') move(index - 1)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(all.length - 1)
    else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') setOpen(false)
  }

  return (
    <div className="menu-button" ref={root}>
      <button
        ref={button}
        className={className ?? 'btn btn--ghost btn--icon'}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        {children}
      </button>
      {open && (
        <div
          className="menu"
          role="menu"
          id={id}
          aria-label={label}
          ref={list}
          onKeyDown={onKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              className={`menu__item${item.danger ? ' menu__item--danger' : ''}${item.separated ? ' menu__item--separated' : ''}`}
              aria-disabled={item.disabled || undefined}
              onClick={() => {
                if (item.disabled) return
                close()
                item.onSelect()
              }}
            >
              {/* No "…" on an item that can't open anything. */}
              <span>{item.disabled ? item.label.replace(/…$/, '') : item.label}</span>
              {item.hint && <small>{item.hint}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
