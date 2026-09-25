import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, Animated } from 'react-native'
import { useLocalSearchParams, useNavigation, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { readDeckFile, writeDeckFile } from '../../lib/workspace'
import {
  SRS_DUE_KEY,
  SRS_INTERVAL_KEY,
  SRS_EASE_KEY,
  SRS_CORRECT_KEY,
  SRS_INCORRECT_KEY,
  DEFAULT_SRS,
  isCardDue,
  nextSrsState
} from '../../lib/srs'
import { useTheme, type Theme } from '../../lib/theme'
import { MetalButton, MetalCard } from '../../components/Metal'
import type { DatabaseFile, DatabaseRow } from '../../lib/types'

export default function StudyScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const insets = useSafeAreaInsets()
  const { deckId } = useLocalSearchParams<{ deckId: string }>()
  const uri = decodeURIComponent(deckId ?? '')
  const navigation = useNavigation()

  const [db, setDb] = useState<DatabaseFile | null>(null)
  const [queue, setQueue] = useState<DatabaseRow[]>([])
  const [showBack, setShowBack] = useState(false)
  const flip = useRef(new Animated.Value(1)).current
  const pop = useRef(new Animated.Value(0.6)).current

  // Card flip: squash the card to nothing on its horizontal axis, swap sides at the midpoint,
  // then expand it back out.
  function reveal(): void {
    if (showBack) return
    Animated.timing(flip, { toValue: 0, duration: 110, useNativeDriver: true }).start(() => {
      setShowBack(true)
      Animated.timing(flip, { toValue: 1, duration: 110, useNativeDriver: true }).start()
    })
  }
  const [gradedCount, setGradedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  function load(): void {
    if (!uri) return
    readDeckFile(uri)
      .then((file) => {
        setDb(file)
        navigation.setOptions({ title: file.title })
        setQueue(file.rows.filter((r) => isCardDue(r.properties[SRS_DUE_KEY])))
      })
      .catch(() => setError('Could not open this deck.'))
  }

  const finished = !!db && queue.length === 0
  useEffect(() => {
    if (finished) {
      pop.setValue(0.6)
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start()
    }
  }, [finished, pop])

  useEffect(() => {
    load()
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
                [SRS_DUE_KEY]: next.dueDate,
                [SRS_CORRECT_KEY]: (Number(r.properties[SRS_CORRECT_KEY]) || 0) + (gotIt ? 1 : 0),
                [SRS_INCORRECT_KEY]: (Number(r.properties[SRS_INCORRECT_KEY]) || 0) + (gotIt ? 0 : 1)
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
        <MetalButton label="Back" colors={theme.btnGrad} onPress={() => router.back()} style={{ marginTop: 16 }} />
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
        <Animated.Text style={[styles.title, { transform: [{ scale: pop }] }]}>
          {gradedCount > 0 ? 'All done for now 🎉' : 'Nothing due right now'}
        </Animated.Text>
        <Text style={styles.subtitle}>
          {gradedCount > 0
            ? `Studied ${gradedCount} card${gradedCount === 1 ? '' : 's'}. Come back later for more.`
            : 'Check back once some cards are due.'}
        </Text>
        <MetalButton label="Back to decks" colors={theme.btnGrad} onPress={() => router.back()} style={{ marginTop: 16 }} />
      </View>
    )
  }

  const current = queue[0]
  const front = (current.properties.front as string) || '(empty)'
  const back = (current.properties.back as string) || '(empty)'

  return (
    // Flipping used to require tapping the card itself, forcing a thumb-stretch up the screen
    // on top of reaching the buttons below - the whole screen now flips (while the back is
    // hidden), so any tap gets you there. Grading still needs its own two distinct buttons
    // once flipped, so this only fires while !showBack; the grade buttons below claim their
    // own touches as nested Pressables regardless.
    <Pressable style={styles.container} onPress={reveal}>
      <Text style={styles.progress}>{queue.length} left</Text>
      <ScrollView contentContainerStyle={styles.cardScroll}>
        <Animated.View style={[styles.cardStack, { transform: [{ scaleX: flip }] }]}>
          <View style={styles.cardShadowLayer2} />
          <View style={styles.cardShadowLayer1} />
          <MetalCard theme={theme} radius={16} style={styles.card}>
            <Text style={styles.cardText}>{showBack ? back : front}</Text>
            {!showBack && <Text style={styles.tapHint}>Tap anywhere to reveal the other side</Text>}
          </MetalCard>
        </Animated.View>
      </ScrollView>
      {showBack ? (
        <View style={[styles.gradeRow, { marginBottom: insets.bottom }]}>
          <MetalButton label="Still learning" colors={theme.dangerGrad} onPress={() => grade(false)} style={{ flex: 1 }} />
          <MetalButton label="Got it" colors={theme.successGrad} onPress={() => grade(true)} style={{ flex: 1 }} />
        </View>
      ) : (
        <MetalButton
          label="Show answer"
          colors={theme.btnGrad}
          onPress={reveal}
          style={{ marginTop: 16, marginBottom: insets.bottom }}
        />
      )}
    </Pressable>
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
