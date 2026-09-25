import { View, Text, Pressable, StyleSheet, Alert } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { MetalCard, Sheen } from './Metal'
import ProgressRing from './ProgressRing'
import { SRS_DUE_KEY, isCardDue } from '../lib/srs'
import type { Theme } from '../lib/theme'
import type { DatabaseFile } from '../lib/types'
import type { QuizScore } from '../lib/quizScores'
import { resetDeckProgress } from '../lib/resetProgress'

// "Learned" = not currently due, i.e. it's been graded correct at least once in study mode and
// is scheduled for a future review rather than sitting in the immediate queue.
function learnedCounts(rows: DatabaseFile['rows']): { learned: number; notLearned: number } {
  const notLearned = rows.filter((r) => isCardDue(r.properties[SRS_DUE_KEY])).length
  return { learned: rows.length - notLearned, notLearned }
}

function scoreColor(correct: number, total: number, theme: Theme): string {
  if (total === 0) return theme.textMuted
  const pct = (correct / total) * 100
  if (pct >= 100) return theme.success
  if (pct > 69) return theme.warning
  return theme.danger
}

export default function DeckRow({
  uri,
  file,
  theme,
  quizScore,
  onMove,
  onChanged
}: {
  uri: string
  file: DatabaseFile
  theme: Theme
  quizScore?: QuizScore
  // Omitted for the bundled sample deck, which isn't a real file and can't be organized.
  onMove?: (uri: string, title: string) => void
  onChanged?: () => void
}) {
  const styles = makeStyles(theme)
  const { learned, notLearned } = learnedCounts(file.rows)
  const masteryPct = file.rows.length === 0 ? 0 : (learned / file.rows.length) * 100
  // No quiz taken yet reads as 0 out of the deck's card count, rather than hiding the badge.
  const effectiveQuizScore = quizScore ?? { correct: 0, total: file.rows.length }

  function openMenu(): void {
    Alert.alert(file.title, undefined, [
      { text: 'Study all cards', onPress: () => router.push(`/study/${encodeURIComponent(uri)}?mode=all`) },
      { text: 'Study weak cards', onPress: () => router.push(`/study/${encodeURIComponent(uri)}?mode=weak`) },
      {
        text: 'Reset study progress…',
        onPress: () =>
          Alert.alert('Reset study progress?', 'Every card in this deck becomes due again and its scores are cleared.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Reset',
              style: 'destructive',
              onPress: async () => {
                await resetDeckProgress(uri)
                onChanged?.()
              }
            }
          ])
      },
      ...(onMove ? [{ text: 'Move to folder…', onPress: () => onMove(uri, file.title) }] : []),
      { text: 'Cancel', style: 'cancel' as const }
    ])
  }

  return (
    <MetalCard theme={theme} style={styles.deckRow}>
      <ProgressRing pct={masteryPct} theme={theme} />
      <Pressable
        style={{ flex: 1 }}
        onPress={() => router.push(`/study/${encodeURIComponent(uri)}`)}
        onLongPress={openMenu}
      >
        <Text style={styles.deckTitle} numberOfLines={1}>
          {file.title}
        </Text>
        <Text style={styles.statsLine}>
          <Text style={{ color: theme.success }}>{`✓${learned} learned`}</Text>
          {'   '}
          <Text style={{ color: theme.danger }}>{`✗${notLearned} to learn`}</Text>
        </Text>
      </Pressable>
      <View style={styles.quizColumn}>
        <Pressable style={styles.quizButton} onPress={() => router.push(`/quiz/${encodeURIComponent(uri)}`)}>
          <LinearGradient colors={theme.btnGrad} style={StyleSheet.absoluteFill} />
          <Sheen radius={8} height="50%" />
          <Text style={styles.quizButtonText}>Quiz</Text>
        </Pressable>
        <Text style={[styles.quizScoreText, { color: scoreColor(effectiveQuizScore.correct, effectiveQuizScore.total, theme) }]}>
          {`${effectiveQuizScore.correct}/${effectiveQuizScore.total}`}
        </Text>
      </View>
    </MetalCard>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    deckRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      marginBottom: 10,
      gap: 8
    },
    deckTitle: { fontSize: 16, fontWeight: '600', color: theme.text, paddingRight: 8 },
    statsLine: { fontSize: 12.5, fontWeight: '600', marginTop: 3, paddingRight: 8 },
    quizColumn: { alignItems: 'center', minWidth: 64 },
    quizScoreText: { fontWeight: '700', fontSize: 12.5, marginTop: 5, textAlign: 'center', paddingRight: 2 },
    quizButton: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8, overflow: 'hidden' },
    quizButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 }
  })
}
