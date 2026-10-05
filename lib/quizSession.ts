import AsyncStorage from '@react-native-async-storage/async-storage'

// An unfinished quiz run, kept per deck so backing out midway (or the app being closed) picks up
// at the same question with the same score instead of throwing the attempt away. Phone-local,
// like quiz scores - it never touches the deck file.
export interface SavedQuestion {
  id: string
  promptText: string
  answerText: string
  answerField: 'front' | 'back'
}

export interface QuizSession {
  questions: SavedQuestion[]
  index: number
  score: { correct: number; total: number }
  promptSide: string
}

const KEY = 'jmsnote.quizSessions'

async function loadAll(): Promise<Record<string, QuizSession>> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export async function loadQuizSession(deckUri: string): Promise<QuizSession | null> {
  return (await loadAll())[deckUri] ?? null
}

export async function saveQuizSession(deckUri: string, session: QuizSession): Promise<void> {
  const all = await loadAll()
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...all, [deckUri]: session }))
}

export async function clearQuizSession(deckUri: string): Promise<void> {
  const all = await loadAll()
  if (!(deckUri in all)) return
  delete all[deckUri]
  await AsyncStorage.setItem(KEY, JSON.stringify(all))
}
