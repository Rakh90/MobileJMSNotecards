import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { useLocalSearchParams, useNavigation, router } from 'expo-router'
import { readDeckFile, writeDeckFile } from '../../lib/workspace'
import { SRS_DUE_KEY, SRS_INTERVAL_KEY, SRS_EASE_KEY, DEFAULT_SRS, isCardDue, nextSrsState } from '../../lib/srs'
import type { DatabaseFile, DatabaseRow } from '../../lib/types'

export default function StudyScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>()
  const uri = decodeURIComponent(deckId ?? '')
  const navigation = useNavigation()

  const [db, setDb] = useState<DatabaseFile | null>(null)
  const [queue, setQueue] = useState<DatabaseRow[]>([])
  const [showBack, setShowBack] = useState(false)
  const [gradedCount, setGradedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uri) return
    readDeckFile(uri)
      .then((file) => {
        setDb(file)
        navigation.setOptions({ title: file.title })
        setQueue(file.rows.filter((r) => isCardDue(r.properties[SRS_DUE_KEY])))
      })
      .catch(() => setError('Could not open this deck.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri])

  async function grade(gotIt: boolean): Promise<void> {
    if (!db || queue.length === 0) return
    const current = queue[0]
    const currentState = {
      interval: (current.properties[SRS_INTERVAL_KEY] as number) ?? DEFAULT_SRS.interval,
      ease: (current.properties[SRS_EASE_KEY] as number) ?? DEFAULT_SRS.ease
    }
    const next = nextSrsState(currentState, gotIt)
    const nextDb: DatabaseFile = {
      ...db,
      rows: db.rows.map((r) =>
        r.id === current.id
          ? {
              ...r,
              properties: {
                ...r.properties,
                [SRS_INTERVAL_KEY]: next.interval,
                [SRS_EASE_KEY]: next.ease,
                [SRS_DUE_KEY]: next.dueDate
              }
            }
          : r
      )
    }
    setDb(nextDb)
    setQueue((q) => q.slice(1))
    setGradedCount((c) => c + 1)
    setShowBack(false)
    try {
      await writeDeckFile(uri, nextDb)
    } catch {
      setError('Studied, but saving progress failed — check the folder still has write access.')
    }
  }

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

  if (!db) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }

  if (queue.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{gradedCount > 0 ? 'All done for now 🎉' : 'Nothing due right now'}</Text>
        <Text style={styles.subtitle}>
          {gradedCount > 0
            ? `Studied ${gradedCount} card${gradedCount === 1 ? '' : 's'}. Come back later for more.`
            : 'Check back once some cards are due.'}
        </Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back to decks</Text>
        </Pressable>
      </View>
    )
  }

  const current = queue[0]
  const front = (current.properties.front as string) || '(empty)'
  const back = (current.properties.back as string) || '(empty)'

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>{queue.length} left</Text>
      <ScrollView contentContainerStyle={styles.cardScroll}>
        <Pressable style={styles.card} onPress={() => setShowBack((v) => !v)}>
          <Text style={styles.cardLabel}>{showBack ? 'SIDE B' : 'SIDE A'}</Text>
          <Text style={styles.cardText}>{showBack ? back : front}</Text>
          {!showBack && <Text style={styles.tapHint}>Tap to reveal the other side</Text>}
        </Pressable>
      </ScrollView>
      {showBack ? (
        <View style={styles.gradeRow}>
          <Pressable style={[styles.gradeButton, styles.gradeBad]} onPress={() => grade(false)}>
            <Text style={styles.gradeButtonText}>Still learning</Text>
          </Pressable>
          <Pressable style={[styles.gradeButton, styles.gradeGood]} onPress={() => grade(true)}>
            <Text style={styles.gradeButtonText}>Got it</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.button} onPress={() => setShowBack(true)}>
          <Text style={styles.buttonText}>Show answer</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  progress: { textAlign: 'center', color: '#888', fontSize: 13, marginBottom: 8 },
  cardScroll: { flexGrow: 1, justifyContent: 'center' },
  card: {
    borderWidth: 1,
    borderColor: '#e3e2e0',
    borderRadius: 14,
    padding: 24,
    minHeight: 220,
    justifyContent: 'center',
    alignItems: 'center'
  },
  cardLabel: { fontSize: 11, fontWeight: '700', color: '#5b4cf0', marginBottom: 10 },
  cardText: { fontSize: 20, textAlign: 'center' },
  tapHint: { fontSize: 12, color: '#999', marginTop: 16 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
  button: { backgroundColor: '#5b4cf0', paddingVertical: 14, borderRadius: 10, marginTop: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  gradeRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  gradeButton: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  gradeBad: { backgroundColor: '#d1453b' },
  gradeGood: { backgroundColor: '#2b8a3e' },
  gradeButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 }
})
