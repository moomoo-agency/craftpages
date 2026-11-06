import type { Key } from '../i18n'

/** A section's condition, shown as a stamp by its title and as a mark in the page's section list. */
export type SectionState = 'on' | 'off' | 'setup' | 'improve' | 'problem' | 'beta' | 'done'

const STAMP: Record<SectionState, Key> = {
  on: 'common.stampOn',
  off: 'common.stampOff',
  setup: 'common.stampSetup',
  improve: 'common.stampImprove',
  problem: 'common.stampProblem',
  beta: 'common.stampBeta',
  done: 'common.stampDone'
}

/** The word for a state, as the stamp and the section list say it. */
export const stampLabel = (state: SectionState): Key => STAMP[state]
