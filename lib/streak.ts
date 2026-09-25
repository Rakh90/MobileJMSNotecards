import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { todayLocalDateString } from './srs'

// Phone-local study streak. A day counts once at least one card has been graded in study mode.
export interface StreakState {
  streak: number
  lastDay: string | null
  todayCount: number
}

const KEY = 'jmsnote.streak'
const EMPTY: StreakState = { streak: 0, lastDay: null, todayCount: 0 }

function yesterdayString(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function loadStreakRaw(): Promise<StreakState> {
  const raw = await AsyncStorage.getItem(KEY)
  return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
}

// What to display right now: a streak that wasn't extended yesterday or today has lapsed to 0,
// and today's count is 0 if nothing has been graded yet today.
export function effectiveStreak(s: StreakState): StreakState {
  const today = todayLocalDateString()
  if (s.lastDay === today) return s
  if (s.lastDay === yesterdayString()) return { ...s, todayCount: 0 }
  return EMPTY
}

// Records one graded card and returns the state from before it, so an undo can put it back.
export async function recordGrade(): Promise<StreakState> {
  const prev = await loadStreakRaw()
  const today = todayLocalDateString()
  let next: StreakState
  if (prev.lastDay === today) next = { ...prev, todayCount: prev.todayCount + 1 }
  else if (prev.lastDay === yesterdayString()) next = { streak: prev.streak + 1, lastDay: today, todayCount: 1 }
  else next = { streak: 1, lastDay: today, todayCount: 1 }
  await AsyncStorage.setItem(KEY, JSON.stringify(next))
  return prev
}

export async function restoreStreak(prev: StreakState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(prev))
}

export function useStreak(): StreakState {
  const [state, setState] = useState<StreakState>(EMPTY)
  const reload = useCallback(async () => setState(effectiveStreak(await loadStreakRaw())), [])
  useEffect(() => {
    reload()
  }, [reload])
  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload])
  )
  return state
}
