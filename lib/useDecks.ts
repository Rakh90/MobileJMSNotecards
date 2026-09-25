import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { loadWorkspaceUri, listFlashcardDecksWithStatus, pendingCount, type DeckEntry } from './workspace'

// Shared by the main dashboard and each folder's drill-down screen - both need the same
// workspace/decks data, just filtered differently, so the loading and refresh-on-focus logic
// lives here once instead of being copied per screen.
export function useDecks() {
  const [workspaceUri, setWorkspaceUri] = useState<string | null>(null)
  const [decks, setDecks] = useState<DeckEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [pending, setPending] = useState(0)

  const refresh = useCallback(async (uri: string | null) => {
    setLoading(true)
    setError(null)
    try {
      if (uri) {
        const result = await listFlashcardDecksWithStatus(uri)
        setDecks(result.decks)
        setOffline(result.offline)
        setPending(await pendingCount())
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      setError(`Could not read that folder (${detail}). It may have moved or lost permission — try choosing it again.`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWorkspaceUri().then((uri) => {
      setWorkspaceUri(uri)
      refresh(uri)
    })
  }, [refresh])

  // Decks write progress straight back to their own file, so re-scan whenever a screen using
  // this hook regains focus to pick up fresh due-counts/scores after studying or quizzing.
  useFocusEffect(
    useCallback(() => {
      refresh(workspaceUri)
    }, [workspaceUri, refresh])
  )

  return { workspaceUri, setWorkspaceUri, decks, loading, error, setError, refresh, offline, pending }
}
