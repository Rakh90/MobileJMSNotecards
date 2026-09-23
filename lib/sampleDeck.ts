import AsyncStorage from '@react-native-async-storage/async-storage'
import type { DatabaseFile } from './types'

// A built-in deck so the Study screen's flip/grade/scheduling logic can be tried immediately,
// with no folder to pick and no real files involved — separate from a synced workspace entirely.
// Its own progress lives in AsyncStorage under this key, not a file, so it can be freely reset.
export const SAMPLE_DECK_URI = 'sample:test-deck'
const STORAGE_KEY = 'jmsnote.sampleDeck'

export function defaultSampleDeck(): DatabaseFile {
  const now = new Date().toISOString()
  return {
    id: 'sample-deck',
    title: 'Sample deck',
    folderId: null,
    favorite: false,
    order: 0,
    createdAt: now,
    updatedAt: now,
    properties: [
      { id: 'front', name: 'Front', type: 'text' },
      { id: 'back', name: 'Back', type: 'text' }
    ],
    views: [
      { id: 'study', name: 'Study', type: 'flashcards' },
      { id: 'table', name: 'Table', type: 'table' }
    ],
    rows: [
      { id: 'sample-1', properties: { front: 'What is the capital of France?', back: 'Paris' } },
      { id: 'sample-2', properties: { front: '2 + 2 = ?', back: '4' } },
      { id: 'sample-3', properties: { front: 'What language is this app written in?', back: 'TypeScript' } },
      { id: 'sample-4', properties: { front: 'SRS stands for…', back: 'Spaced Repetition System' } },
      { id: 'sample-5', properties: { front: 'SAF stands for… (the Android API this app uses)', back: 'Storage Access Framework' } }
    ]
  }
}

export async function readSampleDeck(): Promise<DatabaseFile> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      return JSON.parse(raw)
    } catch {
      // Fall through to the default below if the stored copy is somehow corrupt.
    }
  }
  return defaultSampleDeck()
}

export async function writeSampleDeck(db: DatabaseFile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

export async function resetSampleDeck(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY)
}
