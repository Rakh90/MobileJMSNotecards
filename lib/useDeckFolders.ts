import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { loadFolders, loadAssignments, loadTrashedFolders, type DeckFolder } from './deckFolders'

export function useDeckFolders() {
  const [folders, setFolders] = useState<DeckFolder[]>([])
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [trashedCount, setTrashedCount] = useState(0)

  const reload = useCallback(async () => {
    const [f, a, t] = await Promise.all([loadFolders(), loadAssignments(), loadTrashedFolders()])
    setFolders(f)
    setAssignments(a)
    setTrashedCount(t.length)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload])
  )

  return { folders, assignments, trashedCount, reload }
}
