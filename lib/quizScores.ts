import AsyncStorage from '@react-native-async-storage/async-storage'

// Phone-local, like deck folders - quiz mode has always been a practice/cram mode that never
// wrote back to the deck file itself, and this just remembers your most recent attempt per
// deck so the dashboard can show it, without turning every repeated quiz run into a growing
// cross-device sync write.
export interface QuizScore {
  correct: number
  total: number
}

const KEY = 'jmsnote.quizScores'

export async function loadQuizScores(): Promise<Record<string, QuizScore>> {
  const raw = await AsyncStorage.getItem(KEY)
  return raw ? JSON.parse(raw) : {}
}

export async function saveQuizScore(deckUri: string, score: QuizScore): Promise<void> {
  const all = await loadQuizScores()
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...all, [deckUri]: score }))
}
