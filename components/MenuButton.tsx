import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Icon, { type IconName } from './Icon'
import type { Theme } from '../lib/theme'

export interface MenuItem {
  label: string
  icon: IconName
  onPress: () => void
  badge?: string
}

// Hamburger button for the header. `items` sit at the top of the menu; `footerItems` are pushed
// to the bottom behind a divider, leaving room for more items to be added in between later.
export default function MenuButton({
  theme,
  items,
  footerItems = []
}: {
  theme: Theme
  items: MenuItem[]
  footerItems?: MenuItem[]
}) {
  const [open, setOpen] = useState(false)
  const insets = useSafeAreaInsets()
  const styles = makeStyles(theme)

  function run(item: MenuItem): void {
    setOpen(false)
    item.onPress()
  }

  function row(item: MenuItem) {
    return (
      <Pressable key={item.label} style={styles.item} onPress={() => run(item)}>
        <Icon name={item.icon} color={theme.accent} size={18} />
        <Text style={styles.itemText}>{item.label}</Text>
        {item.badge ? <Text style={styles.badge}>{item.badge}</Text> : null}
      </Pressable>
    )
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={12}>
        <Icon name="menu" color={theme.accent} size={24} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { top: insets.top + 54 }]}>
            {items.map(row)}
            {footerItems.length > 0 && (
              <>
                <View style={{ height: 28 }} />
                <View style={styles.divider} />
                {footerItems.map(row)}
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
    menu: {
      position: 'absolute',
      right: 12,
      width: 230,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderAccent,
      borderRadius: 12,
      padding: 6,
      elevation: 12
    },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10 },
    itemText: { flex: 1, color: theme.text, fontSize: 14.5 },
    badge: { color: theme.textMuted, fontSize: 12.5 },
    divider: { borderTopWidth: 1, borderTopColor: theme.border, marginHorizontal: 4 }
  })
}
