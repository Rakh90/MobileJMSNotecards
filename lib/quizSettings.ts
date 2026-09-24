import AsyncStorage from '@react-native-async-storage/async-storage'

export type Difficulty = 'easy' | 'hard'
// Which side of the card gets shown as the question. 'random' picks a direction per question;
// 'both' queues every card twice, once asked each direction, so a full pass covers everything.
export type PromptSide = 'A' | 'B' | 'random' | 'both'

export interface QuizSettings {
  difficulty: Difficulty
  promptSide: PromptSide
}

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = { difficulty: 'easy', promptSide: 'random' }

const STORAGE_KEY = 'jmsnote.quizSettings'

export async function loadQuizSettings(): Promise<QuizSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_QUIZ_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_QUIZ_SETTINGS
}

export async function saveQuizSettings(settings: QuizSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
