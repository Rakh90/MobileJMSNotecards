import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { MetalButton, MetalCard } from './Metal'
import FolderIcon from './FolderIcon'
import { isDriveSignedIn, signInToDrive } from '../lib/googleDrive'
import { COURSES_FOLDER_NAME, listCourses, type Course } from '../lib/notes'
import type { Theme } from '../lib/theme'

// The Notes side of the home screen: one card per class (each folder inside "JMSNote Courses" on
// Drive). Notes themselves only appear once a class is opened.
export default function NotesHome({ theme }: { theme: Theme }) {
  const styles = makeStyles(theme)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [offline, setOffline] = useState(false)
  const [missingFolder, setMissingFolder] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await listCourses()
      setCourses(r.courses)
      setOffline(r.offline)
      setMissingFolder(r.missingFolder)
    } catch (err) {
      setError(`Couldn't load your classes (${err instanceof Error ? err.message : String(err)}).`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    isDriveSignedIn()
      .then((ok) => {
        setSignedIn(ok)
        if (ok) load()
      })
      .catch(() => setSignedIn(false))
  }, [load])

  async function connect(): Promise<void> {
    setError(null)
    try {
      await signInToDrive()
      setSignedIn(true)
      load()
    } catch {
      setError('Could not connect to Google Drive. Try again.')
    }
  }

  if (signedIn === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }

  if (!signedIn) {
    return (
      <View style={styles.prompt}>
        <Text style={styles.muted}>Connect Google Drive to read the notes from your classes.</Text>
        <MetalButton label="Connect Google Drive" colors={theme.btnGrad} onPress={connect} style={{ alignSelf: 'center', marginTop: 10 }} />
        {error && <Text style={[styles.muted, { marginTop: 10 }]}>{error}</Text>}
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      {offline && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Offline — showing saved classes.</Text>
        </View>
      )}
      {courses.map((c) => (
        <MetalCard key={c.id} theme={theme} style={{ marginBottom: 10 }}>
          <Pressable style={styles.row} onPress={() => router.push(`/notes/${c.id}?name=${encodeURIComponent(c.name)}`)}>
            <View style={styles.nameRow}>
              <FolderIcon color={theme.accent} size={20} />
              <Text style={styles.name}>{c.name}</Text>
            </View>
            <Text style={styles.count}>›</Text>
          </Pressable>
        </MetalCard>
      ))}
      {!loading && missingFolder && (
        <Text style={styles.muted}>
          {`No "${COURSES_FOLDER_NAME}" folder found in your Google Drive yet. On your PC, open Settings in JMSNote and choose "Copy this workspace to JMSNote Courses", then pull down here to refresh.`}
        </Text>
      )}
      {!loading && !missingFolder && !error && courses.length === 0 && (
        <Text style={styles.muted}>{`No classes in ${COURSES_FOLDER_NAME} yet.`}</Text>
      )}
      {error && <Text style={styles.muted}>{error}</Text>}
    </ScrollView>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
    prompt: { margin: 16, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed' },
    list: { padding: 16 },
    muted: { fontSize: 14, color: theme.textMuted, textAlign: 'center', marginBottom: 10 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
    name: { fontSize: 15.5, fontWeight: '600', color: theme.text },
    count: { fontSize: 18, color: theme.textMuted },
    banner: { borderWidth: 1, borderColor: theme.warning, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12 },
    bannerText: { color: theme.warning, fontSize: 12.5 }
  })
}
