import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams, useNavigation } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import NoteView from '../../components/NoteView'
import Icon from '../../components/Icon'
import { useTheme, type Theme } from '../../lib/theme'
import { loadCourse, readCachedCourse, readNote, type CourseData, type NoteContent } from '../../lib/notes'

// A single note, read-only.
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

  useEffect(() => {
    navigation.setOptions({
      title: note?.title ?? (title ? decodeURIComponent(title) : 'Note'),
      headerRight: () => (
        <Pressable onPress={() => load(true)} hitSlop={12}>
          <Icon name="refresh" color={theme.accent} size={22} />
        </Pressable>
      )
    })
  }, [navigation, note, title, theme, load])

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
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
        {note && data && (
          <>
            <Text style={styles.title}>{note.title}</Text>
            {note.stale && <Text style={styles.stale}>Showing the saved copy — couldn't reach Drive.</Text>}
            <NoteView body={note.body} data={data} theme={theme} onNoteLink={openLinked} />
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
    stale: { fontSize: 13, color: theme.warning, marginBottom: 10 }
  })
}
