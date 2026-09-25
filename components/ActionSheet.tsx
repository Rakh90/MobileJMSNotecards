import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Icon, { type IconName } from './Icon'
import FolderIcon from './FolderIcon'
import { Sheen } from './Metal'
import type { Theme } from '../lib/theme'

export interface SheetAction {
  label: string
  icon?: IconName | 'folder'
  destructive?: boolean
  onPress: () => void
}

// A themed replacement for Alert menus. The Android back button, tapping outside, and Cancel all
// close it without choosing anything.
export default function ActionSheet({
  visible,
  theme,
  title,
  message,
  actions,
  onClose
}: {
  visible: boolean
  theme: Theme
  title: string
  message?: string
  actions: SheetAction[]
  onClose: () => void
}) {
  const styles = makeStyles(theme)
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <LinearGradient colors={theme.cardGrad} style={StyleSheet.absoluteFill} />
          <Sheen radius={16} height="30%" />
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {message ? <Text style={styles.message}>{message}</Text> : <View style={{ height: 6 }} />}
          {actions.map((a) => {
            const color = a.destructive ? theme.danger : theme.text
            const iconColor = a.destructive ? theme.danger : theme.accent
            return (
              <Pressable
                key={a.label}
                style={styles.row}
                onPress={() => {
                  onClose()
                  a.onPress()
                }}
              >
                <View style={styles.iconBox}>
                  {a.icon === 'folder' ? (
                    <FolderIcon color={iconColor} size={18} />
                  ) : a.icon ? (
                    <Icon name={a.icon} color={iconColor} size={18} />
                  ) : null}
                </View>
                <Text style={[styles.rowText, { color }]}>{a.label}</Text>
              </Pressable>
            )
          })}
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    card: {
      width: '100%',
      maxWidth: 380,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.borderAccent,
      overflow: 'hidden',
      paddingHorizontal: 12,
      paddingTop: 16,
      paddingBottom: 8
    },
    title: { color: theme.text, fontSize: 16.5, fontWeight: '700', paddingHorizontal: 8, paddingRight: 12 },
    message: { color: theme.textMuted, fontSize: 13, paddingHorizontal: 8, paddingRight: 12, marginTop: 6, marginBottom: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: theme.border },
    iconBox: { width: 22, alignItems: 'center' },
    rowText: { flex: 1, fontSize: 15, paddingRight: 8 },
    cancel: { alignItems: 'center', paddingVertical: 13, borderTopWidth: 1, borderTopColor: theme.border },
    cancelText: { color: theme.accent, fontSize: 14.5, fontWeight: '600' }
  })
}
