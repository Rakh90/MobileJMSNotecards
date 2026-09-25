import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'
import { SRS_DUE_KEY, isCardDue } from './srs'
import type { DeckEntry } from './workspace'
import type { QuizScore } from './quizScores'

export type SortMode = 'name' | 'due' | 'score'

export const SORT_LABELS: Record<SortMode, string> = {
  name: 'Name',
  due: 'Due',
  score: 'Score'
}

const KEY = 'jmsnote.sortMode'

export function useSortMode(): [SortMode, (m: SortMode) => void] {
  const [mode, setModeState] = useState<SortMode>('name')

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'name' || v === 'due' || v === 'score') setModeState(v)
    })
  }, [])

  const setMode = useCallback((m: SortMode) => {
    setModeState(m)
    AsyncStorage.setItem(KEY, m)
  }, [])

  return [mode, setMode]
}

function dueCount(d: DeckEntry): number {
  return d.file.rows.filter((r) => isCardDue(r.properties[SRS_DUE_KEY])).length
}

// A deck that has never been quizzed sorts as the lowest score, so it surfaces first.
function scorePct(d: DeckEntry, scores: Record<string, QuizScore>): number {
  const s = scores[d.uri]
  return s && s.total > 0 ? s.correct / s.total : -1
}

export function sortDecks(decks: DeckEntry[], mode: SortMode, scores: Record<string, QuizScore>): DeckEntry[] {
  const byName = (a: DeckEntry, b: DeckEntry) => a.file.title.localeCompare(b.file.title)
  const copy = [...decks]
  if (mode === 'due') return copy.sort((a, b) => dueCount(b) - dueCount(a) || byName(a, b))
  if (mode === 'score') return copy.sort((a, b) => scorePct(a, scores) - scorePct(b, scores) || byName(a, b))
  return copy.sort(byName)
}
