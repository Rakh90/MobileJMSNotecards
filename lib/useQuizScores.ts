import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { loadQuizScores, type QuizScore } from './quizScores'

export function useQuizScores() {
  const [scores, setScores] = useState<Record<string, QuizScore>>({})

  const reload = useCallback(async () => {
    setScores(await loadQuizScores())
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload])
  )

  return { scores, reload }
}
