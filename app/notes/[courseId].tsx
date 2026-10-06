import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams, useNavigation } from 'expo-router'
import { MetalCard } from '../../components/Metal'
import FolderIcon from '../../components/FolderIcon'
import MenuButton from '../../components/MenuButton'
import { useTheme, type Theme } from '../../lib/theme'
import { downloadCourse, loadCourse, readCachedCourse, type CourseData, type NoteSummary } from '../../lib/notes'

// One class. Shows only the folders and notes directly inside the folder you're in; searching
// looks through the whole class (and never other classes).
export default function CourseScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const navigation = useNavigation()
  const { courseId, name, folderId } = useLocalSearchParams<{ courseId: string; name?: string; folderId?: string }>()
  const currentFolder = folderId || null
  const [data, setData] = useState<CourseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [progress, setProgress] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await loadCourse(courseId)
      setData(r.data)
      setOffline(r.offline)
    } catch (err) {
      setError(`Couldn't open this class (${err instanceof Error ? err.message : String(err)}).`)
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    // Show the saved copy straight away, then bring it up to date.
    readCachedCourse(courseId).then((c) => {
      if (c) setData((prev) => prev ?? c)
    })
    refresh()
  }, [courseId, refresh])

  useEffect(() => {
    navigation.setOptions({
      title: name ? decodeURIComponent(name) : 'Notes',
      headerRight: () => (
        <MenuButton
          theme={theme}
          items={[
            { label: 'Refresh', icon: 'refresh', onPress: refresh },
            { label: 'Download for offline', icon: 'download', onPress: downloadAll }
          ]}
        />
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, theme, name, data, refresh])

  async function downloadAll(): Promise<void> {
    if (!data) return
    setProgress(`Downloading 0 / ${data.notes.length}`)
    const r = await downloadCourse(data, (done, total) => setProgress(`Downloading ${done} / ${total}`))
    setProgress(null)
    Alert.alert(
      'Saved for offline',
      r.failed > 0
        ? `${r.notes} notes saved. ${r.failed} couldn't be downloaded — try again with a connection.`
        : `All ${r.notes} notes in this class are stored on this phone.`
    )
  }

  const subtreeCount = useMemo(() => {
    const counts = new Map<string, number>()
    if (!data) return counts
    const children = new Map<string | null, string[]>()
    for (const f of data.folders) {
      const list = children.get(f.parentId) ?? []
      list.push(f.id)
      children.set(f.parentId, list)
    }
    const direct = new Map<string, number>()
    for (const n of data.notes) if (n.folderId) direct.set(n.folderId, (direct.get(n.folderId) ?? 0) + 1)
    const total = (id: string): number => (direct.get(id) ?? 0) + (children.get(id) ?? []).reduce((s, c) => s + total(c), 0)
    for (const f of data.folders) counts.set(f.id, total(f.id))
    return counts
  }, [data])

  const query = search.trim().toLowerCase()
  const folders = data
    ? data.folders.filter((f) => f.parentId === currentFolder).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    : []
  const notes: NoteSummary[] = data
    ? query
      ? data.notes.filter((n) => n.title.toLowerCase().includes(query) || n.tags.some((t) => t.toLowerCase().includes(query)))
      : data.notes.filter((n) => n.folderId === currentFolder)
    : []
  notes.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))

  function openNote(n: NoteSummary): void {
    router.push(`/note/${n.id}?courseId=${courseId}&title=${encodeURIComponent(n.title)}`)
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} />}
      >
        {(offline || progress) && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{progress ?? 'Offline — showing saved notes.'}</Text>
          </View>
        )}
        {data && data.notes.length > 0 && (
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search this class…"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
        {!query &&
          folders.map((f) => {
            const count = subtreeCount.get(f.id) ?? 0
            return (
              <MetalCard key={f.id} theme={theme} style={{ marginBottom: 10 }}>
                <Pressable
                  style={styles.row}
                  onPress={() => router.push(`/notes/${courseId}?name=${encodeURIComponent(f.name)}&folderId=${f.id}`)}
                >
                  <View style={styles.nameRow}>
                    <FolderIcon color={theme.accent} size={20} />
                    <Text style={styles.folderName} numberOfLines={2}>
                      {f.name}
                    </Text>
                  </View>
                  <Text style={styles.count}>{`${count} note${count === 1 ? '' : 's'} ›`}</Text>
                </Pressable>
              </MetalCard>
            )
          })}
        {notes.map((n) => (
          <Pressable key={n.id} style={styles.noteRow} onPress={() => openNote(n)}>
            <Text style={styles.noteTitle} numberOfLines={2}>
              {n.title}
            </Text>
            {n.tags.length > 0 && (
              <Text style={styles.noteTags} numberOfLines={1}>
                {n.tags.join(' · ')}
              </Text>
            )}
          </Pressable>
        ))}
        {data && query && notes.length === 0 && <Text style={styles.muted}>{`No notes match "${search.trim()}".`}</Text>}
        {data && !query && folders.length === 0 && notes.length === 0 && !loading && (
          <Text style={styles.muted}>Nothing in here yet.</Text>
        )}
        {error && <Text style={styles.muted}>{error}</Text>}
        {loading && !data && (
          <View style={{ padding: 24 }}>
            <ActivityIndicator color={theme.accent} />
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    list: { padding: 16 },
    muted: { fontSize: 14, color: theme.textMuted, textAlign: 'center', marginVertical: 10 },
    search: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.text,
      marginBottom: 12
    },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
    folderName: { fontSize: 15.5, fontWeight: '600', color: theme.text, flexShrink: 1 },
    count: { fontSize: 13, color: theme.textMuted, flexShrink: 0, width: 92, textAlign: 'right' },
    noteRow: {
      paddingVertical: 13,
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border
    },
    noteTitle: { fontSize: 15.5, color: theme.text },
    noteTags: { fontSize: 12, color: theme.textMuted, marginTop: 3 },
    banner: { borderWidth: 1, borderColor: theme.warning, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12 },
    bannerText: { color: theme.warning, fontSize: 12.5 }
  })
}
