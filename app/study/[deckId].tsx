import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Animated, PanResponder } from 'react-native'
import { useLocalSearchParams, useNavigation, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { readDeckFile, writeDeckFile } from '../../lib/workspace'
import {
  SRS_DUE_KEY,
  SRS_INTERVAL_KEY,
  SRS_EASE_KEY,
  SRS_CORRECT_KEY,
  SRS_INCORRECT_KEY,
  SRS_LAST_KEY,
  DEFAULT_SRS,
  isCardDue,
  nextSrsState
} from '../../lib/srs'
import { useTheme, type Theme } from '../../lib/theme'
import { MetalButton, MetalCard } from '../../components/Metal'
import { recordGrade, restoreStreak, type StreakState } from '../../lib/streak'
import { weakestFirst, shuffled } from '../../lib/weak'
import type { DatabaseFile, DatabaseRow } from '../../lib/types'

// A card in the current session, tagged with the deck file it belongs to so grading a mixed
// session still writes each card's progress back to its own deck.
interface StudyItem {
  uri: string
  row: DatabaseRow
}

export default function StudyScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const insets = useSafeAreaInsets()
  const { deckId, uris: urisParam, mode } = useLocalSearchParams<{ deckId: string; uris?: string; mode?: string }>()
  const uris: string[] = urisParam ? JSON.parse(urisParam) : [decodeURIComponent(deckId ?? '')]
  const weakMode = mode === 'weak'
  const allMode = mode === 'all'
  const isMixed = uris.length > 1
  const sessionKey = uris.join('|') + '#' + (mode ?? 'due')
  const navigation = useNavigation()

  const [dbs, setDbs] = useState<Record<string, DatabaseFile> | null>(null)
  const [queue, setQueue] = useState<StudyItem[]>([])
  const [showBack, setShowBack] = useState(false)
  const flip = useRef(new Animated.Value(1)).current
  const revealRef = useRef<() => void>(() => {})
  const pop = useRef(new Animated.Value(0.6)).current

  // Card flip: squash the card to nothing on its horizontal axis, swap sides at the midpoint,
  // then expand it back out. Tapping again flips back, so a card can be turned over and over
  // until it's graded (by swipe or button).
  const flipping = useRef(false)
  function reveal(): void {
    if (flipping.current) return
    flipping.current = true
    Animated.timing(flip, { toValue: 0, duration: 110, useNativeDriver: true }).start(() => {
      setShowBack((b) => !b)
      Animated.timing(flip, { toValue: 1, duration: 110, useNativeDriver: true }).start(() => {
        flipping.current = false
      })
    })
  }
  revealRef.current = reveal
  const [gradedCount, setGradedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [lastGrade, setLastGrade] = useState<{ uri: string; prevRow: DatabaseRow; prevStreak: StreakState } | null>(null)
  const swipeX = useRef(new Animated.Value(0)).current
  const gradeRef = useRef<(gotIt: boolean) => Promise<void>>(async () => {})
  const showBackRef = useRef(false)
  showBackRef.current = showBack

  // Swipe right = Got it, left = Still learning, only once the answer is showing. The buttons
  // below do the same thing, so this is purely a shortcut.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        if (showBackRef.current) swipeX.setValue(g.dx)
      },
      onPanResponderRelease: (_, g) => {
        // A touch that barely moved is a tap: flip the card. Anything else is a swipe.
        if (Math.abs(g.dx) < 10 && Math.abs(g.dy) < 10) {
          revealRef.current()
          return
        }
        if (!showBackRef.current) return
        if (Math.abs(g.dx) > 100) {
          const gotIt = g.dx > 0
          Animated.timing(swipeX, { toValue: gotIt ? 500 : -500, duration: 140, useNativeDriver: false }).start(() => {
            swipeX.setValue(0)
            gradeRef.current(gotIt)
          })
        } else {
          Animated.spring(swipeX, { toValue: 0, useNativeDriver: false }).start()
        }
      },
      onPanResponderTerminate: () => Animated.spring(swipeX, { toValue: 0, useNativeDriver: false }).start()
    })
  ).current

  function load(): void {
    Promise.all(uris.map(async (u) => [u, await readDeckFile(u)] as const))
      .then((entries) => {
        const map = Object.fromEntries(entries)
        setDbs(map)
        navigation.setOptions({
          title: isMixed
            ? weakMode ? 'Weak cards' : allMode ? 'Mixed practice' : 'Mixed study'
            : weakMode ? `Weak: ${entries[0][1].title}` : allMode ? `Practice: ${entries[0][1].title}` : entries[0][1].title
        })
        const all: StudyItem[] = entries.flatMap(([u, f]) => f.rows.map((row) => ({ uri: u, row })))
        if (weakMode) setQueue(weakestFirst(all))
        else if (allMode) setQueue(shuffled(all))
        else {
          const due = all.filter((i) => isCardDue(i.row.properties[SRS_DUE_KEY]))
          setQueue(isMixed ? shuffled(due) : due)
        }
      })
      .catch(() => setError('Could not open this deck.'))
  }

  const finished = !!dbs && queue.length === 0
  useEffect(() => {
    if (finished) {
      pop.setValue(0.6)
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start()
    }
  }, [finished, pop])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey])

  async function grade(gotIt: boolean): Promise<void> {
    if (!dbs || queue.length === 0) return
    const { uri, row: current } = queue[0]
    const db = dbs[uri]
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
                [SRS_INCORRECT_KEY]: (Number(r.properties[SRS_INCORRECT_KEY]) || 0) + (gotIt ? 0 : 1),
                [SRS_LAST_KEY]: new Date().toISOString()
              }
            }
          : r
      )
    }
    setDbs((d) => (d ? { ...d, [uri]: nextDb } : d))
    setQueue((q) => q.slice(1))
    setGradedCount((c) => c + 1)
    setShowBack(false)
    recordGrade().then((prevStreak) => setLastGrade({ uri, prevRow: current, prevStreak }))
    try {
      await writeDeckFile(uri, nextDb)
    } catch {
      setError('Studied, but saving progress failed — check the folder still has write access.')
    }
  }
  gradeRef.current = grade

  async function undo(): Promise<void> {
    if (!lastGrade || !dbs) return
    const { uri, prevRow, prevStreak } = lastGrade
    const db = dbs[uri]
    const nextDb: DatabaseFile = { ...db, rows: db.rows.map((r) => (r.id === prevRow.id ? prevRow : r)) }
    setDbs((d) => (d ? { ...d, [uri]: nextDb } : d))
    setQueue((q) => [{ uri, row: prevRow }, ...q])
    setGradedCount((c) => Math.max(0, c - 1))
    setShowBack(false)
    setLastGrade(null)
    restoreStreak(prevStreak)
    try {
      await writeDeckFile(uri, nextDb)
    } catch {
      setError('Undo worked here, but saving it failed — check the folder still has write access.')
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

  if (!dbs) {
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
          {gradedCount > 0 ? 'All done for now 🎉' : weakMode ? 'No weak cards yet' : 'Nothing due right now'}
        </Animated.Text>
        <Text style={styles.subtitle}>
          {gradedCount > 0
            ? `Studied ${gradedCount} card${gradedCount === 1 ? '' : 's'}. Come back later for more.`
            : weakMode
              ? 'Cards you keep missing will show up here.'
              : 'Check back once some cards are due.'}
        </Text>
        <MetalButton label="Back to decks" colors={theme.btnGrad} onPress={() => router.back()} style={{ marginTop: 16 }} />
        {lastGrade && (
          <Pressable onPress={undo} style={{ padding: 12 }}>
            <Text style={{ color: theme.accent, fontSize: 13.5 }}>↶ Undo last grade</Text>
          </Pressable>
        )}
      </View>
    )
  }

  const current = queue[0].row
  const front = (current.properties.front as string) || '(empty)'
  const back = (current.properties.back as string) || '(empty)'

  return (
    // Flipping used to require tapping the card itself, forcing a thumb-stretch up the screen
    // on top of reaching the buttons below - the whole screen now flips (while the back is
    // hidden), so any tap gets you there. Grading still needs its own two distinct buttons
    // once flipped, so this only fires while !showBack; the grade buttons below claim their
    // own touches as nested Pressables regardless.
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <Text style={[styles.progress, { marginBottom: 0 }]}>{queue.length} left</Text>
        {lastGrade && (
          <Pressable onPress={undo} hitSlop={10}>
            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>↶ Undo</Text>
          </Pressable>
        )}
      </View>
      <View style={[styles.cardScroll, { flex: 1 }]}>
        <Animated.View style={[styles.cardStack, { transform: [{ scaleX: flip }] }]}>
          <View style={styles.cardShadowLayer2} />
          <View style={styles.cardShadowLayer1} />
          <Animated.View
            style={{
              transform: [
                { translateX: swipeX },
                { rotate: swipeX.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-8deg', '0deg', '8deg'] }) }
              ]
            }}
          >
            <MetalCard theme={theme} radius={16} style={styles.card}>
              <Text style={styles.cardText}>{showBack ? back : front}</Text>
            </MetalCard>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.swipeTint,
                { backgroundColor: theme.success, opacity: swipeX.interpolate({ inputRange: [0, 150], outputRange: [0, 0.35], extrapolate: 'clamp' }) }
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.swipeTint,
                { backgroundColor: theme.danger, opacity: swipeX.interpolate({ inputRange: [-150, 0], outputRange: [0.35, 0], extrapolate: 'clamp' }) }
              ]}
            />
          </Animated.View>
        </Animated.View>
      </View>
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
    swipeTint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16 },
    tapHint: { fontSize: 12, color: theme.textMuted, marginTop: 18 },
    title: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: theme.text, alignSelf: 'stretch' },
    subtitle: { fontSize: 14, color: theme.textMuted, textAlign: 'center', alignSelf: 'stretch' },
    button: { backgroundColor: theme.accent, paddingVertical: 14, borderRadius: 10, marginTop: 16, alignItems: 'center' },
    buttonText: { color: theme.accentContrast, fontWeight: '600', fontSize: 15 },
    gradeRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
    gradeButton: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
    gradeBad: { backgroundColor: theme.danger },
    gradeGood: { backgroundColor: theme.success },
    gradeButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    linkButton: { padding: 12, marginTop: 4, alignSelf: 'stretch' },
    linkButtonText: { color: theme.accent, fontSize: 13.5, textAlign: 'center', alignSelf: 'stretch' }
  })
}
