import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { loadFolders, loadAssignments, type DeckFolder } from './deckFolders'

export function useDeckFolders() {
  const [folders, setFolders] = useState<DeckFolder[]>([])
  const [assignments, setAssignments] = useState<Record<string, string>>({})

  const reload = useCallback(async () => {
    const [f, a] = await Promise.all([loadFolders(), loadAssignments()])
    setFolders(f)
    setAssignments(a)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload])
  )

  return { folders, assignments, reload }
}
