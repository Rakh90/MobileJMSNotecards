import { View, Text, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { SRS_DUE_KEY, SRS_CORRECT_KEY, SRS_INCORRECT_KEY, isCardDue } from '../lib/srs'
import type { Theme } from '../lib/theme'
import type { DatabaseFile } from '../lib/types'

function dueCount(rows: DatabaseFile['rows']): number {
  return rows.filter((r) => isCardDue(r.properties[SRS_DUE_KEY])).length
}

function score(rows: DatabaseFile['rows']): { correct: number; incorrect: number } {
  let correct = 0
  let incorrect = 0
  for (const r of rows) {
    correct += Number(r.properties[SRS_CORRECT_KEY]) || 0
    incorrect += Number(r.properties[SRS_INCORRECT_KEY]) || 0
  }
  return { correct, incorrect }
}

export default function DeckRow({
  uri,
  file,
  theme,
  onMove
}: {
  uri: string
  file: DatabaseFile
  theme: Theme
  // Omitted for the bundled sample deck, which isn't a real file and can't be organized.
  onMove?: (uri: string, title: string) => void
}) {
  const styles = makeStyles(theme)
  const due = dueCount(file.rows)
  const { correct, incorrect } = score(file.rows)

  return (
    <View style={styles.deckRow}>
      <Pressable style={{ flex: 1 }} onPress={() => router.push(`/study/${encodeURIComponent(uri)}`)}>
        <Text style={styles.deckTitle}>{file.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <Text style={styles.deckMeta}>
            {file.rows.length} card{file.rows.length === 1 ? '' : 's'}
          </Text>
          {(correct > 0 || incorrect > 0) && (
            <Text style={styles.scoreText}>
              <Text style={{ color: theme.success }}>✓{correct}</Text>{' '}
              <Text style={{ color: theme.danger }}>✗{incorrect}</Text>
            </Text>
          )}
        </View>
      </Pressable>
      {due > 0 && (
        <View style={styles.dueBadge}>
          <Text style={styles.dueBadgeText}>{due} due</Text>
        </View>
      )}
      <Pressable style={styles.quizButton} onPress={() => router.push(`/quiz/${encodeURIComponent(uri)}`)}>
        <Text style={styles.quizButtonText}>Quiz</Text>
      </Pressable>
      {onMove && (
        <Pressable style={styles.moveButton} onPress={() => onMove(uri, file.title)} hitSlop={8}>
          <Text style={styles.moveButtonText}>📁</Text>
        </Pressable>
      )}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    deckRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      marginBottom: 10,
      gap: 8
    },
    deckTitle: { fontSize: 16, fontWeight: '600', color: theme.text },
    deckMeta: { fontSize: 13, color: theme.textMuted },
    scoreText: { fontSize: 12.5, fontWeight: '600' },
    dueBadge: { backgroundColor: theme.bgActive, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
    dueBadgeText: { color: theme.accent, fontWeight: '600', fontSize: 12.5 },
    quizButton: { borderWidth: 1, borderColor: theme.accent, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
    quizButtonText: { color: theme.accent, fontWeight: '600', fontSize: 13 },
    moveButton: { padding: 4 },
    moveButtonText: { fontSize: 17 }
  })
}
