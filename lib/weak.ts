import { SRS_CORRECT_KEY, SRS_INCORRECT_KEY } from './srs'
import type { DatabaseRow } from './types'

const MAX_WEAK_CARDS = 30

function counts(row: DatabaseRow): { correct: number; incorrect: number } {
  return {
    correct: Number(row.properties[SRS_CORRECT_KEY]) || 0,
    incorrect: Number(row.properties[SRS_INCORRECT_KEY]) || 0
  }
}

// A "weak" card has been missed at least once and is wrong at least 40% of the time it's been
// graded. Worst first, capped so a session stays a reasonable size.
export function missRatio(row: DatabaseRow): number {
  const { correct, incorrect } = counts(row)
  return incorrect + correct === 0 ? 0 : incorrect / (incorrect + correct)
}

export function isWeak(row: DatabaseRow): boolean {
  return counts(row).incorrect > 0 && missRatio(row) >= 0.4
}

export function weakestFirst<T extends { row: DatabaseRow }>(items: T[]): T[] {
  return items
    .filter((i) => isWeak(i.row))
    .sort((a, b) => missRatio(b.row) - missRatio(a.row) || counts(b.row).incorrect - counts(a.row).incorrect)
    .slice(0, MAX_WEAK_CARDS)
}

export function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
