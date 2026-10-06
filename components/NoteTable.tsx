import { useState } from 'react'
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native'
import type { Theme } from '../lib/theme'

export interface TableCell {
  // Plain text length, used to size the column; the cell itself is drawn by `render`.
  textLength: number
  longestWord: number
  render: () => React.ReactNode
}

const CHAR_W = 7.4
const CELL_PAD = 9
const MIN_COL = 58

function columnWidths(rows: TableCell[][], cols: number): number[] {
  const widths: number[] = []
  for (let c = 0; c < cols; c++) {
    let len = 4
    let word = 3
    for (const row of rows) {
      const cell = row[c]
      if (!cell) continue
      len = Math.max(len, Math.min(cell.textLength, 34))
      word = Math.max(word, Math.min(cell.longestWord, 24))
    }
    widths.push(Math.max(64, Math.min(230, Math.max(len, word) * CHAR_W + CELL_PAD * 2 + 4)))
  }
  return widths
}

// A markdown table drawn as a real grid. If it's wider than the screen, the first column stays
// pinned on the left and the remaining columns scroll sideways, so a row never loses its label.
// Row heights are matched between the two halves (cells wrap, so heights differ) by measuring
// each side and giving both the taller of the two.
export default function NoteTable({
  theme,
  header,
  rows
}: {
  theme: Theme
  header: TableCell[]
  rows: TableCell[][]
}) {
  const all = [header, ...rows]
  const cols = Math.max(...all.map((r) => r.length))
  const [avail, setAvail] = useState(Dimensions.get('window').width - 32)
  const [heights, setHeights] = useState<Record<number, number>>({})
  const styles = makeStyles(theme)

  // Columns start at the width their text wants. Too wide for the screen: every column gives up
  // width in proportion to how much it has beyond a small minimum, so text wraps onto more lines
  // instead of the table scrolling. Only a table with too many columns to fit even at the
  // minimum still scrolls sideways (first column pinned).
  let widths = columnWidths(all, cols)
  const total = widths.reduce((a, b) => a + b, 0)
  if (total < avail) {
    widths = widths.map((w) => (w * avail) / total)
  } else if (total > avail) {
    const min = MIN_COL
    const minTotal = min * widths.length
    if (avail <= minTotal) widths = widths.map(() => min)
    else {
      const k = (avail - minTotal) / (total - minTotal)
      widths = widths.map((w) => min + Math.max(0, w - min) * k)
    }
  }
  const first = widths[0]
  const rest = widths.slice(1)
  const restTotal = rest.reduce((a, b) => a + b, 0)

  function report(i: number, h: number): void {
    setHeights((prev) => (prev[i] !== undefined && prev[i] >= h - 0.5 ? prev : { ...prev, [i]: h }))
  }

  function cell(rowIdx: number, c: TableCell | undefined, w: number, key: number, isHeader: boolean) {
    return (
      <View key={key} style={[styles.cell, isHeader && styles.headCell, { width: w }]}>
        {c?.render()}
      </View>
    )
  }

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width
        if (Math.abs(w - avail) > 1) {
          setAvail(w)
          setHeights({})
        }
      }}
    >
      <View style={{ width: first }}>
        {all.map((row, i) => (
          <View
            key={i}
            style={{ minHeight: heights[i] }}
            onLayout={(e) => report(i, e.nativeEvent.layout.height)}
          >
            {cell(i, row[0], first, 0, i === 0)}
          </View>
        ))}
      </View>
      {cols > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }} nestedScrollEnabled>
          <View style={{ width: restTotal }}>
            {all.map((row, i) => (
              <View
                key={i}
                style={[styles.row, { minHeight: heights[i] }]}
                onLayout={(e) => report(i, e.nativeEvent.layout.height)}
              >
                {rest.map((w, c) => cell(i, row[c + 1], w, c + 1, i === 0))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: theme.borderAccent,
      borderRadius: 8,
      overflow: 'hidden',
      marginVertical: 8,
      backgroundColor: theme.cardBg
    },
    row: { flexDirection: 'row', alignItems: 'stretch' },
    cell: {
      padding: CELL_PAD - 2,
      paddingHorizontal: CELL_PAD,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      flexGrow: 1,
      justifyContent: 'center'
    },
    headCell: { backgroundColor: theme.bgActive }
  })
}
