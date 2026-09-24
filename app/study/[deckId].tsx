import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { useLocalSearchParams, useNavigation, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { readDeckFile, writeDeckFile } from '../../lib/workspace'
import { readSampleDeck, writeSampleDeck, resetSampleDeck, SAMPLE_DECK_URI } from '../../lib/sampleDeck'
import { SRS_DUE_KEY, SRS_INTERVAL_KEY, SRS_EASE_KEY, DEFAULT_SRS, isCardDue, nextSrsState } from '../../lib/srs'
import { useTheme, type Theme } from '../../lib/theme'
import type { DatabaseFile, DatabaseRow } from '../../lib/types'

export default function StudyScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const insets = useSafeAreaInsets()
  const { deckId } = useLocalSearchParams<{ deckId: string }>()
  const uri = decodeURIComponent(deckId ?? '')
  const isSample = uri === SAMPLE_DECK_URI
  const navigation = useNavigation()

  const [db, setDb] = useState<DatabaseFile | null>(null)
  const [queue, setQueue] = useState<DatabaseRow[]>([])
  const [showBack, setShowBack] = useState(false)
  const [gradedCount, setGradedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  function load(): void {
    if (!uri) return
    const read = isSample ? readSampleDeck() : readDeckFile(uri)
    read
      .then((file) => {
        setDb(file)
        navigation.setOptions({ title: file.title })
        setQueue(file.rows.filter((r) => isCardDue(r.properties[SRS_DUE_KEY])))
      })
      .catch(() => setError('Could not open this deck.'))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri])

  async function resetSample(): Promise<void> {
    await resetSampleDeck()
    setGradedCount(0)
    setShowBack(false)
    setError(null)
    load()
  }

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
      if (isSample) await writeSampleDeck(nextDb)
      else await writeDeckFile(uri, nextDb)
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
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }

  if (queue.length === 0) {
    return (
      <View style={[styles.center, { paddingBottom: 24 + insets.bottom }]}>
        <Text style={styles.title}>{gradedCount > 0 ? 'All done for now 🎉' : 'Nothing due right now'}</Text>
        <Text style={styles.subtitle}>
          {gradedCount > 0
            ? `Studied ${gradedCount} card${gradedCount === 1 ? '' : 's'}. Come back later for more.`
            : 'Check back once some cards are due.'}
        </Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back to decks</Text>
        </Pressable>
        {isSample && (
          <Pressable style={styles.linkButton} onPress={resetSample}>
            <Text style={styles.linkButtonText}>Reset sample deck progress</Text>
          </Pressable>
        )}
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
        <View style={styles.cardStack}>
          <View style={styles.cardShadowLayer2} />
          <View style={styles.cardShadowLayer1} />
          <Pressable style={styles.card} onPress={() => setShowBack((v) => !v)}>
            <Text style={styles.cardText}>{showBack ? back : front}</Text>
            {!showBack && <Text style={styles.tapHint}>Tap to reveal the other side</Text>}
          </Pressable>
        </View>
      </ScrollView>
      {showBack ? (
        <View style={[styles.gradeRow, { marginBottom: insets.bottom }]}>
          <Pressable style={[styles.gradeButton, styles.gradeBad]} onPress={() => grade(false)}>
            <Text style={styles.gradeButtonText}>Still learning</Text>
          </Pressable>
          <Pressable style={[styles.gradeButton, styles.gradeGood]} onPress={() => grade(true)}>
            <Text style={styles.gradeButtonText}>Got it</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={[styles.button, { marginBottom: insets.bottom }]} onPress={() => setShowBack(true)}>
          <Text style={styles.buttonText}>Show answer</Text>
        </Pressable>
      )}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg, padding: 16 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
    progress: { textAlign: 'center', color: theme.textMuted, fontSize: 13, marginBottom: 8 },
    cardScroll: { flexGrow: 1, justifyContent: 'center' },
    cardStack: { position: 'relative' },
    cardShadowLayer1: {
      position: 'absolute',
      top: 8,
      left: 8,
      right: -8,
      bottom: -8,
      borderRadius: 16,
      backgroundColor: theme.border,
      opacity: 0.6
    },
    cardShadowLayer2: {
      position: 'absolute',
      top: 16,
      left: 16,
      right: -16,
      bottom: -16,
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
      minHeight: 220,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: theme.dark ? 0.4 : 0.12,
      shadowRadius: 10
    },
    cardText: { fontSize: 21, textAlign: 'center', color: theme.text, fontWeight: '500' },
    tapHint: { fontSize: 12, color: theme.textMuted, marginTop: 18 },
    title: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: theme.text },
    subtitle: { fontSize: 14, color: theme.textMuted, textAlign: 'center' },
    button: { backgroundColor: theme.accent, paddingVertical: 14, borderRadius: 10, marginTop: 16, alignItems: 'center' },
    buttonText: { color: theme.accentContrast, fontWeight: '600', fontSize: 15 },
    gradeRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
    gradeButton: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
    gradeBad: { backgroundColor: theme.danger },
    gradeGood: { backgroundColor: theme.success },
    gradeButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    linkButton: { padding: 12, marginTop: 4 },
    linkButtonText: { color: theme.accent, fontSize: 13.5 }
  })
}
