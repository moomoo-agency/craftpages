import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { stampLabel, type SectionState } from '../lib/stamps'

interface Entry {
  element: HTMLElement
  title: string
  state?: SectionState
  /** A group inside a long section (its small heading), listed under the section. */
  sub?: boolean
}

/** States that ask for the reader: their word shows in the list, not only a mark. */
const NEEDS_YOU = new Set<SectionState>(['setup', 'improve', 'problem'])

/** Fewer sections than this and the page is short enough to need no list. */
const MIN_SECTIONS = 3

/** How far below the top of the scrolling area a section counts as the one being read. */
const READING_LINE = 96

/**
 * A page made of sections, with a list of them beside it: each section's title and state,
 * the one being read marked, a click to jump. The list is read from the page's own
 * `<Section>`s, so a page only wraps its content; sections that come and go (a feature
 * turned on, an account connected) appear and leave the list by themselves.
 */
export default function SectionPage({
  className,
  children
}: {
  className: string
  children: React.ReactNode
}): React.JSX.Element {
  const t = useT()
  const column = useRef<HTMLDivElement>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [current, setCurrent] = useState(0)

  const read = useCallback((): void => {
    const root = column.current
    if (!root) return
    const found: Entry[] = []
    for (const element of root.querySelectorAll<HTMLElement>('section.panel[data-section-title]')) {
      // A section inside another section belongs to that one, not to the page.
      const outer = element.parentElement?.closest('section.panel')
      if (outer && root.contains(outer)) continue
      found.push({
        element,
        title: element.dataset.sectionTitle ?? '',
        state: (element.dataset.sectionState || undefined) as SectionState | undefined
      })
      // The groups of a long section, so its lower half is one click away too.
      for (const group of element.querySelectorAll<HTMLElement>('.settings__subhead')) {
        if (group.closest('section.panel') !== element) continue
        found.push({ element: group, title: group.textContent ?? '', sub: true })
      }
    }
    setEntries((before) =>
      before.length === found.length &&
      before.every(
        (entry, i) =>
          entry.element === found[i].element &&
          entry.title === found[i].title &&
          entry.state === found[i].state &&
          entry.sub === found[i].sub
      )
        ? before
        : found
    )
  }, [])

  useLayoutEffect(() => {
    read()
    const root = column.current
    if (!root) return
    const observer = new MutationObserver(read)
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-section-title', 'data-section-state']
    })
    return () => observer.disconnect()
  }, [read])

  // The section being read: the last one whose top has passed the reading line, or the
  // last one when the page is scrolled to its end.
  useEffect(() => {
    const scroller = column.current?.closest<HTMLElement>('.content')
    if (!scroller || entries.filter((entry) => !entry.sub).length < MIN_SECTIONS) return
    const update = (): void => {
      const top = scroller.getBoundingClientRect().top + READING_LINE
      const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4
      let index = 0
      entries.forEach((entry, i) => {
        if (entry.element.getBoundingClientRect().top <= top) index = i
      })
      setCurrent(atEnd && scroller.scrollTop > 0 ? entries.length - 1 : index)
    }
    update()
    scroller.addEventListener('scroll', update, { passive: true })
    return () => scroller.removeEventListener('scroll', update)
  }, [entries])

  const jump = (index: number): void => {
    const target = entries[index]?.element
    if (!target) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
    // Keyboard users land in the section, not back on the list.
    const heading = target.matches('h2, h3') ? target : target.querySelector<HTMLElement>('h2')
    if (heading) {
      heading.setAttribute('tabindex', '-1')
      heading.focus({ preventScroll: true })
    }
    setCurrent(index)
  }

  const listed = entries.filter((entry) => !entry.sub).length >= MIN_SECTIONS

  return (
    <div className={`section-page${listed ? ' section-page--listed' : ''}`}>
      {listed && (
        <nav className="section-rail" aria-label={t('common.pageSections')}>
          <ol>
            {entries.map((entry, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={`section-rail__item${entry.sub ? ' section-rail__item--sub' : ''}${i === current ? ' is-current' : ''}`}
                  aria-current={i === current ? 'location' : undefined}
                  onClick={() => jump(i)}
                >
                  <span className="section-rail__title">{entry.title}</span>
                  {entry.state &&
                    (NEEDS_YOU.has(entry.state) || entry.state === 'beta' ? (
                      <span className={`section-rail__word section-rail__word--${entry.state}`}>
                        {t(stampLabel(entry.state))}
                      </span>
                    ) : (
                      <span
                        className={`section-rail__mark section-rail__mark--${entry.state}`}
                        role="img"
                        aria-label={t(stampLabel(entry.state))}
                      />
                    ))}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div ref={column} className={className}>
        {children}
      </div>
    </div>
  )
}
