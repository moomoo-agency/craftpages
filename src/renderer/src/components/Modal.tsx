import { useEffect, useRef } from 'react'

interface Props {
  /** Accessible name; usually the same text as the visible heading. */
  label: string
  /** Extra classes on `.modal`, e.g. `modal--narrow modal--auto`. */
  className?: string
  onClose: () => void
  children: React.ReactNode
}

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * A modal dialog: Escape and a click on the backdrop close it, Tab stays inside, and focus
 * goes back to whatever opened it. The content brings its own `.modal__head` / body / foot.
 */
export default function Modal({ label, className, onClose, children }: Props): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const dialog = ref.current!
    // Respect an autoFocus field inside; otherwise start on the dialog itself.
    if (!dialog.contains(document.activeElement)) dialog.focus()

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeRef.current()
      } else if (event.key === 'Tab') {
        const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
          (el) => el.offsetParent !== null
        )
        if (!items.length) return event.preventDefault()
        const first = items[0]
        const last = items[items.length - 1]
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === dialog)
        ) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && closeRef.current()}
    >
      <div
        ref={ref}
        className={`modal${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  )
}
