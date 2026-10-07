import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams, useNavigation } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import NoteView from '../../components/NoteView'
import Icon from '../../components/Icon'
import { useTheme, type Theme } from '../../lib/theme'
import { loadCourse, readCachedCourse, readNote, type CourseData, type NoteContent } from '../../lib/notes'

// A single note, read-only, with find-on-page.
export default function NoteScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const { noteId, courseId, title } = useLocalSearchParams<{ noteId: string; courseId: string; title?: string }>()
  const [data, setData] = useState<CourseData | null>(null)
  const [note, setNote] = useState<NoteContent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const scrollRef = useRef<ScrollView>(null)

  // find on page
  const [findOpen, setFindOpen] = useState(false)
  const [findText, setFindText] = useState('')
  const [term, setTerm] = useState('')
  const [count, setCount] = useState(0)
  const [current, setCurrent] = useState(0)

  const load = useCallback(
    async (fresh: boolean) => {
      setBusy(true)
      setError(null)
      try {
        let d = fresh ? null : await readCachedCourse(courseId)
        if (!d) d = (await loadCourse(courseId)).data
        setData(d)
        setNote(await readNote(d, noteId))
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setBusy(false)
      }
    },
    [courseId, noteId]
  )

  useEffect(() => {
    load(false)
  }, [load])

  // The search term only applies after a short pause, and needs 2+ characters, so typing doesn't
  // redraw the whole note on every keystroke or light up every single letter.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = findText.trim().length >= 2 ? findText.trim() : ''
      setTerm(next)
      setCurrent(0)
    }, 250)
    return () => clearTimeout(t)
  }, [findText])

  useEffect(() => {
    navigation.setOptions({
      title: note?.title ?? (title ? decodeURIComponent(title) : 'Note'),
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <Pressable onPress={() => setFindOpen((v) => !v)} hitSlop={12}>
            <Icon name="search" color={theme.accent} size={22} />
          </Pressable>
          <Pressable onPress={() => load(true)} hitSlop={12}>
            <Icon name="refresh" color={theme.accent} size={22} />
          </Pressable>
        </View>
      )
    })
  }, [navigation, note, title, theme, load])

  function closeFind(): void {
    setFindOpen(false)
    setFindText('')
    setTerm('')
    setCount(0)
    Keyboard.dismiss()
  }

  function step(delta: number): void {
    if (count === 0) return
    setCurrent((c) => (c + delta + count) % count)
  }

  const openLinked = useCallback(
    (id: string) => {
      if (data?.noteFiles[id]) {
        const t = data.notes.find((n) => n.id === id)?.title ?? ''
        router.push(`/note/${id}?courseId=${courseId}&title=${encodeURIComponent(t)}`)
      }
    },
    [data, courseId]
  )

  return (
    <View style={styles.container}>
      {findOpen && (
        <View style={styles.findBar}>
          <TextInput
            style={styles.findInput}
            value={findText}
            onChangeText={setFindText}
            placeholder="Find on page…"
            placeholderTextColor={theme.textMuted}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => step(1)}
          />
          <Text style={styles.findCount}>{term ? (count > 0 ? `${current + 1}/${count}` : '0/0') : ''}</Text>
          <Pressable onPress={() => step(-1)} hitSlop={8} style={styles.findBtn}>
            <Icon name="up" color={count > 0 ? theme.accent : theme.textMuted} size={22} />
          </Pressable>
          <Pressable onPress={() => step(1)} hitSlop={8} style={styles.findBtn}>
            <Icon name="down" color={count > 0 ? theme.accent : theme.textMuted} size={22} />
          </Pressable>
          <Pressable onPress={closeFind} hitSlop={8} style={styles.findBtn}>
            <Icon name="close" color={theme.text} size={20} />
          </Pressable>
        </View>
      )}
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
      >
        {note && data && (
          <>
            <Text style={styles.title}>{note.title}</Text>
            {note.stale && <Text style={styles.stale}>Showing the saved copy — couldn't reach Drive.</Text>}
            <NoteView
              body={note.body}
              data={data}
              theme={theme}
              onNoteLink={openLinked}
              find={term}
              current={current}
              onCount={setCount}
              scrollRef={scrollRef}
            />
          </>
        )}
        {busy && !note && (
          <View style={{ padding: 24 }}>
            <ActivityIndicator color={theme.accent} />
          </View>
        )}
        {error && !note && <Text style={styles.stale}>{`Couldn't open this note (${error}).`}</Text>}
      </ScrollView>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16 },
    title: { fontSize: 24, fontWeight: '700', color: theme.text, marginBottom: 14 },
    stale: { fontSize: 13, color: theme.warning, marginBottom: 10 },
    findBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.cardBg,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderAccent
    },
    findInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 7,
      fontSize: 15,
      color: theme.text
    },
    findCount: { minWidth: 44, textAlign: 'center', fontSize: 13, color: theme.textMuted },
    findBtn: { padding: 4 }
  })
}
