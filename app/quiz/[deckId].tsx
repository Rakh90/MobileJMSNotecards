import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Animated,
  Keyboard
} from 'react-native'
import { useLocalSearchParams, useNavigation, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { readDeckFile } from '../../lib/workspace'
import { readSampleDeck, SAMPLE_DECK_URI } from '../../lib/sampleDeck'
import { loadQuizSettings, saveQuizSettings, DEFAULT_QUIZ_SETTINGS, type QuizSettings, type PromptSide } from '../../lib/quizSettings'
import { saveQuizScore } from '../../lib/quizScores'
import { useTheme, type Theme } from '../../lib/theme'
import type { DatabaseFile, DatabaseRow } from '../../lib/types'

interface Question {
  id: string
  promptText: string
  answerText: string
  answerField: 'front' | 'back'
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function buildQuestions(rows: DatabaseRow[], promptSide: PromptSide): Question[] {
  const out: Question[] = []
  for (const row of rows) {
    const front = ((row.properties.front as string) || '').trim()
    const back = ((row.properties.back as string) || '').trim()
    if (!front || !back) continue
    if (promptSide === 'both') {
      out.push({ id: `${row.id}:A`, promptText: front, answerText: back, answerField: 'back' })
      out.push({ id: `${row.id}:B`, promptText: back, answerText: front, answerField: 'front' })
    } else {
      const dir: 'A' | 'B' = promptSide === 'random' ? (Math.random() < 0.5 ? 'A' : 'B') : promptSide
      if (dir === 'A') out.push({ id: row.id, promptText: front, answerText: back, answerField: 'back' })
      else out.push({ id: row.id, promptText: back, answerText: front, answerField: 'front' })
    }
  }
  return shuffle(out)
}

function buildChoices(question: Question, rows: DatabaseRow[]): string[] {
  const pool = rows
    .map((r) => ((r.properties[question.answerField] as string) || '').trim())
    .filter((t) => t && t !== question.answerText)
  const distractors = shuffle(Array.from(new Set(pool))).slice(0, 3)
  return shuffle([question.answerText, ...distractors])
}

export default function QuizScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const insets = useSafeAreaInsets()
  const { deckId } = useLocalSearchParams<{ deckId: string }>()
  const uri = decodeURIComponent(deckId ?? '')
  const isSample = uri === SAMPLE_DECK_URI
  const navigation = useNavigation()

  const [db, setDb] = useState<DatabaseFile | null>(null)
  const [settings, setSettings] = useState<QuizSettings>(DEFAULT_QUIZ_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [choices, setChoices] = useState<string[]>([])
  const [typedAnswer, setTypedAnswer] = useState('')
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const flashAnim = useRef(new Animated.Value(0)).current
  const [flashKind, setFlashKind] = useState<'correct' | 'incorrect' | null>(null)

  // Records this attempt as the deck's "most recent quiz score" once the run actually finishes -
  // guarded on questions.length so it can't fire on the initial index===0 render before any
  // questions have loaded.
  useEffect(() => {
    if (uri && questions.length > 0 && index >= questions.length && score.total > 0) {
      saveQuizScore(uri, { correct: score.correct, total: score.total })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, questions.length])

  useEffect(() => {
    if (!uri) return
    const read = isSample ? readSampleDeck() : readDeckFile(uri)
    Promise.all([read, loadQuizSettings()])
      .then(([file, loadedSettings]) => {
        setDb(file)
        setSettings(loadedSettings)
        navigation.setOptions({
          title: `Quiz — ${file.title}`,
          headerRight: () => (
            <Pressable onPress={() => setSettingsOpen(true)} hitSlop={10}>
              <Text style={{ color: theme.accent, fontSize: 20 }}>⚙</Text>
            </Pressable>
          )
        })
        setQuestions(buildQuestions(file.rows, loadedSettings.promptSide))
      })
      .catch(() => setError('Could not open this deck.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri])

  useEffect(() => {
    if (!db) return
    if (settings.difficulty === 'easy' && questions[index]) {
      setChoices(buildChoices(questions[index], db.rows))
    }
  }, [db, questions, index, settings.difficulty])

  async function updateSettings(next: QuizSettings): Promise<void> {
    setSettings(next)
    await saveQuizSettings(next)
    if (db && next.promptSide !== settings.promptSide) {
      setQuestions(buildQuestions(db.rows, next.promptSide))
      setIndex(0)
      setScore({ correct: 0, total: 0 })
      resetAnswerState()
    }
  }

  function resetAnswerState(): void {
    setFeedback(null)
    setSelectedChoice(null)
    setTypedAnswer('')
  }

  function flash(kind: 'correct' | 'incorrect'): void {
    setFlashKind(kind)
    flashAnim.setValue(1)
    Animated.timing(flashAnim, { toValue: 0, duration: 700, useNativeDriver: true }).start(() => setFlashKind(null))
  }

  function recordAnswer(correct: boolean): void {
    setFeedback(correct ? 'correct' : 'incorrect')
    flash(correct ? 'correct' : 'incorrect')
    setScore((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }))
  }

  function answerChoice(choice: string): void {
    if (feedback) return
    setSelectedChoice(choice)
    recordAnswer(choice === questions[index].answerText)
  }

  function submitTyped(): void {
    if (feedback || !typedAnswer.trim()) return
    Keyboard.dismiss()
    const correct = typedAnswer.trim().toLowerCase() === questions[index].answerText.trim().toLowerCase()
    recordAnswer(correct)
  }

  function nextQuestion(): void {
    resetAnswerState()
    setIndex((i) => i + 1)
  }

  function restart(): void {
    if (!db) return
    setQuestions(buildQuestions(db.rows, settings.promptSide))
    setIndex(0)
    setScore({ correct: 0, total: 0 })
    resetAnswerState()
  }

  const settingsModal = settingsOpen && (
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>Quiz settings</Text>
        <Text style={styles.modalLabel}>Difficulty</Text>
        <View style={styles.segmentRow}>
          <SegmentButton
            label="Easy — select"
            theme={theme}
            active={settings.difficulty === 'easy'}
            onPress={() => updateSettings({ ...settings, difficulty: 'easy' })}
          />
          <SegmentButton
            label="Hard — type"
            theme={theme}
            active={settings.difficulty === 'hard'}
            onPress={() => updateSettings({ ...settings, difficulty: 'hard' })}
          />
        </View>
        <Text style={styles.modalLabel}>Ask using</Text>
        <View style={[styles.segmentRow, { flexWrap: 'wrap' }]}>
          {(['A', 'B', 'random', 'both'] as const).map((s) => (
            <SegmentButton
              key={s}
              label={s === 'A' ? 'Side A' : s === 'B' ? 'Side B' : s === 'random' ? 'Random' : 'Both'}
              theme={theme}
              active={settings.promptSide === s}
              onPress={() => updateSettings({ ...settings, promptSide: s })}
            />
          ))}
        </View>
        <Pressable style={styles.button} onPress={() => setSettingsOpen(false)}>
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </View>
    </View>
  )

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.subtitle}>{error}</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back</Text>
        </Pressable>
      </View>
    )
  }

  if (!db || questions.length === 0) {
    return (
      <View style={styles.center}>
        {db ? (
          <>
            <Text style={styles.subtitle}>Need at least one card with both sides filled in to quiz.</Text>
            <Pressable style={styles.button} onPress={() => router.back()}>
              <Text style={styles.buttonText}>Back to decks</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={theme.accent} />
        )}
      </View>
    )
  }

  if (index >= questions.length) {
    const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
    return (
      <View style={[styles.center, { paddingBottom: 24 + insets.bottom }]}>
        <Text style={styles.title}>Quiz complete 🎉</Text>
        <Text style={styles.subtitle}>
          {score.correct} / {score.total} correct ({pct}%)
        </Text>
        <Pressable style={styles.button} onPress={restart}>
          <Text style={styles.buttonText}>Quiz again</Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={() => router.back()}>
          <Text style={styles.linkButtonText}>Back to decks</Text>
        </Pressable>
        {settingsModal}
      </View>
    )
  }

  const question = questions[index]

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {index + 1} / {questions.length} · {score.correct} correct
      </Text>

      <ScrollView contentContainerStyle={styles.cardScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.cardStack}>
          <View style={styles.cardShadowLayer2} />
          <View style={styles.cardShadowLayer1} />
          <View style={styles.card}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.flashOverlay,
                {
                  opacity: flashAnim,
                  backgroundColor: flashKind === 'correct' ? theme.success : theme.danger
                }
              ]}
            />
            <Text style={styles.cardText}>{question.promptText}</Text>
          </View>
        </View>

        {settings.difficulty === 'easy' ? (
          <View style={styles.choices}>
            {choices.map((choice) => {
              const isSelected = selectedChoice === choice
              const isCorrectChoice = choice === question.answerText
              const showState = feedback && (isSelected || isCorrectChoice)
              return (
                <Pressable
                  key={choice}
                  style={[
                    styles.choiceButton,
                    showState && isCorrectChoice && styles.choiceCorrect,
                    showState && isSelected && !isCorrectChoice && styles.choiceIncorrect
                  ]}
                  onPress={() => answerChoice(choice)}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      showState && (isCorrectChoice || isSelected) && { color: '#fff', fontWeight: '600' }
                    ]}
                  >
                    {choice}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ) : (
          <View style={styles.typedRow}>
            <TextInput
              style={[
                styles.textInput,
                feedback === 'correct' && { borderColor: theme.success },
                feedback === 'incorrect' && { borderColor: theme.danger }
              ]}
              value={typedAnswer}
              onChangeText={setTypedAnswer}
              placeholder="Type your answer…"
              placeholderTextColor={theme.textMuted}
              editable={!feedback}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={submitTyped}
              returnKeyType="done"
            />
            {feedback && (
              <Text style={[styles.answerReveal, { color: feedback === 'correct' ? theme.success : theme.danger }]}>
                {feedback === 'correct' ? 'Correct!' : `Answer: ${question.answerText}`}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      <View style={{ marginBottom: insets.bottom }}>
        {settings.difficulty === 'hard' && !feedback ? (
          <Pressable style={styles.button} onPress={submitTyped}>
            <Text style={styles.buttonText}>Check</Text>
          </Pressable>
        ) : feedback ? (
          <Pressable style={styles.button} onPress={nextQuestion}>
            <Text style={styles.buttonText}>{index + 1 < questions.length ? 'Next' : 'See results'}</Text>
          </Pressable>
        ) : null}
      </View>
      {settingsModal}
    </View>
  )
}

function SegmentButton({
  label,
  active,
  onPress,
  theme
}: {
  label: string
  active: boolean
  onPress: () => void
  theme: Theme
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: active ? theme.accent : theme.border,
        backgroundColor: active ? theme.bgActive : 'transparent',
        marginRight: 8,
        marginBottom: 8
      }}
    >
      <Text style={{ color: active ? theme.accent : theme.text, fontWeight: active ? '600' : '400', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg, padding: 16 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
    progress: { textAlign: 'center', color: theme.textMuted, fontSize: 13, marginBottom: 8 },
    cardScroll: { flexGrow: 1, justifyContent: 'center' },
    cardStack: { position: 'relative', marginBottom: 20 },
    cardShadowLayer1: {
      position: 'absolute',
      top: 6,
      left: 6,
      right: -6,
      bottom: -6,
      borderRadius: 16,
      backgroundColor: theme.border,
      opacity: 0.6
    },
    cardShadowLayer2: {
      position: 'absolute',
      top: 12,
      left: 12,
      right: -12,
      bottom: -12,
      borderRadius: 16,
      backgroundColor: theme.border,
      opacity: 0.3
    },
    card: {
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 28,
      minHeight: 160,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: theme.dark ? 0.4 : 0.12,
      shadowRadius: 10
    },
    flashOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16 },
    cardText: { fontSize: 20, textAlign: 'center', color: theme.text, fontWeight: '500' },
    choices: { gap: 10 },
    choiceButton: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      borderRadius: 10,
      padding: 14
    },
    choiceCorrect: { backgroundColor: theme.success, borderColor: theme.success },
    choiceIncorrect: { backgroundColor: theme.danger, borderColor: theme.danger },
    choiceText: { fontSize: 15.5, color: theme.text, textAlign: 'center' },
    typedRow: { gap: 12 },
    textInput: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: theme.text
    },
    answerReveal: { textAlign: 'center', fontSize: 15, fontWeight: '600' },
    title: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: theme.text },
    subtitle: { fontSize: 14, color: theme.textMuted, textAlign: 'center' },
    button: { backgroundColor: theme.accent, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
    buttonText: { color: theme.accentContrast, fontWeight: '600', fontSize: 15 },
    linkButton: { padding: 12, marginTop: 4 },
    linkButtonText: { color: theme.accent, fontSize: 13.5 },
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    },
    modalCard: {
      backgroundColor: theme.bg,
      borderRadius: 14,
      padding: 20,
      width: '100%',
      maxWidth: 360
    },
    modalTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 14 },
    modalLabel: { fontSize: 12.5, color: theme.textMuted, marginBottom: 8, marginTop: 6, fontWeight: '600' },
    segmentRow: { flexDirection: 'row', flexWrap: 'wrap' }
  })
}
