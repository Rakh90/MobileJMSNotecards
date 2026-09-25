// A deliberately simple SM-2-style scheduler: enough to make "Study" mean "what's actually due
// today" across days, without pretending to be a full spaced-repetition engine. State lives
// directly on the flashcard row's own properties bag under these reserved keys, alongside the
// user-visible Front/Back columns — never declared in the database's own property list, so the
// Table view never renders them.
export const SRS_INTERVAL_KEY = '__srsInterval'
export const SRS_EASE_KEY = '__srsEase'
export const SRS_DUE_KEY = '__srsDue'
export const SRS_CORRECT_KEY = '__srsCorrect'
export const SRS_INCORRECT_KEY = '__srsIncorrect'
// ISO timestamp of the last time this card was graded - lets offline progress merge keep the
// newest grade per card when the same deck was studied on two devices.
export const SRS_LAST_KEY = '__srsLastGraded'

export interface SrsState {
  interval: number
  ease: number
}

export const DEFAULT_SRS: SrsState = { interval: 0, ease: 2.5 }

export function todayLocalDateString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function nextSrsState(current: SrsState, gotIt: boolean): SrsState & { dueDate: string } {
  let interval = current.interval
  let ease = current.ease
  if (gotIt) {
    interval = interval <= 0 ? 1 : Math.round(interval * ease)
    ease = Math.min(3, ease + 0.1)
  } else {
    interval = 0
    ease = Math.max(1.3, ease - 0.2)
  }
  const due = new Date()
  due.setDate(due.getDate() + interval)
  const y = due.getFullYear()
  const m = String(due.getMonth() + 1).padStart(2, '0')
  const day = String(due.getDate()).padStart(2, '0')
  return { interval, ease, dueDate: `${y}-${m}-${day}` }
}

// A card with no due date yet has never been studied, so it's due immediately.
export function isCardDue(dueDate: unknown): boolean {
  if (typeof dueDate !== 'string' || !dueDate) return true
  return dueDate <= todayLocalDateString()
}
