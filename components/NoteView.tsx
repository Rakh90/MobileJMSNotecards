import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Image, Linking, Platform, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native'
import MarkdownIt from 'markdown-it'
import NoteTable, { type TableCell } from './NoteTable'
import { attachmentName, localAttachment, type CourseData } from '../lib/notes'
import type { Theme } from '../lib/theme'

// Draws a note's markdown with native components. Tables become real grids (see NoteTable); the
// rest - headings, lists, checkboxes, quotes, code, links, images - covers what the desktop
// editor can write. Anything it doesn't know is shown as plain text rather than dropped.

interface Tok {
  type: string
  tag: string
  content: string
  children: Tok[] | null
  attrs: [string, string][] | null
  markup: string
  info: string
  nesting: number
}

interface TreeNode {
  tok: Tok
  kids: TreeNode[]
}

const md = new MarkdownIt({ html: true, breaks: true, linkify: true })

function buildTree(tokens: Tok[]): TreeNode[] {
  const root: TreeNode[] = []
  const stack: TreeNode[][] = [root]
  for (const t of tokens) {
    if (t.nesting === 1) {
      const n: TreeNode = { tok: t, kids: [] }
      stack[stack.length - 1].push(n)
      stack.push(n.kids)
    } else if (t.nesting === -1) {
      if (stack.length > 1) stack.pop()
    } else {
      stack[stack.length - 1].push({ tok: t, kids: [] })
    }
  }
  return root
}

// Where each text block (a paragraph or table cell) sits on screen, so "find on page" can scroll
// to the line a match is on.
interface TextBlock {
  ref: { measureLayout: (...args: any[]) => void } | null
  lines: { y: number; text: string }[]
}

interface FindMatch {
  container: string
  offset: number
}

interface Ctx {
  theme: Theme
  data: CourseData
  onNoteLink: (id: string) => void
  find: string
  matches: FindMatch[]
  blocks: Map<string, TextBlock>
}

// The match the user is on, kept in context so stepping through matches only re-draws the
// highlighted words and not the whole note.
const CurrentMatchContext = createContext(-1)

function FindMark({ idx, theme, children }: { idx: number; theme: Theme; children: string }) {
  const current = useContext(CurrentMatchContext)
  const active = idx === current
  return (
    <Text style={{ backgroundColor: active ? '#ff9632' : theme.dark ? '#7a6a1a' : '#ffe14d', color: active ? '#000' : undefined }}>
      {children}
    </Text>
  )
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Props that let a text block report its position and line layout - only attached while a find
// term is active, so normal reading doesn't pay for the extra layout events.
function blockProps(ctx: Ctx, cid: string) {
  if (!ctx.find) return {}
  const entry: TextBlock = { ref: null, lines: [] }
  ctx.blocks.set(cid, entry)
  return {
    ref: (r: TextBlock['ref']) => {
      entry.ref = r
    },
    onTextLayout: (e: { nativeEvent: { lines: { y: number; text: string }[] } }) => {
      entry.lines = e.nativeEvent.lines.map((l) => ({ y: l.y, text: l.text }))
    }
  }
}

function attr(t: Tok, name: string): string | null {
  return t.attrs?.find((a) => a[0] === name)?.[1] ?? null
}

// ---------- inline ----------

interface Frame {
  style: TextStyle
  nodes: React.ReactNode[]
  onPress?: () => void
}

let keyCounter = 0
const nextKey = (): string => `k${keyCounter++}`

function inlineTokens(children: Tok[], ctx: Ctx, cid: string): { content: React.ReactNode[]; images: string[]; flat: string } {
  const stack: Frame[] = [{ style: {}, nodes: [] }]
  const images: string[] = []
  // Running character position within this text block, so a find match can be mapped to a line.
  let offset = 0
  // The plain text exactly as drawn (no styling), in case a block has to be re-drawn from it.
  let flat = ''
  const findRe = ctx.find ? new RegExp(escapeRegExp(ctx.find), 'gi') : null

  // Plain text, with every find match swapped for a highlighted mark.
  const emit = (text: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = []
    if (!findRe) {
      nodes.push(text)
    } else {
      findRe.lastIndex = 0
      let last = 0
      let m: RegExpExecArray | null
      while ((m = findRe.exec(text))) {
        if (m[0].length === 0) {
          findRe.lastIndex++
          continue
        }
        if (m.index > last) nodes.push(text.slice(last, m.index))
        const idx = ctx.matches.push({ container: cid, offset: offset + m.index }) - 1
        nodes.push(
          <FindMark key={nextKey()} idx={idx} theme={ctx.theme}>
            {m[0]}
          </FindMark>
        )
        last = m.index + m[0].length
      }
      if (last < text.length) nodes.push(text.slice(last))
    }
    offset += text.length
    flat += text
    return nodes
  }

  // ==marked text== is how the desktop editor saves highlighted text.
  const highlighted = (text: string): React.ReactNode[] =>
    text.split(/==([^=\n]+)==/g).flatMap<React.ReactNode>((p, i): React.ReactNode[] =>
      i % 2 === 1
        ? [
            <Text key={nextKey()} style={{ backgroundColor: ctx.theme.dark ? '#6b5a12' : '#fff3a3' }}>
              <>{emit(p)}</>
            </Text>
          ]
        : emit(p)
    )

  const top = (): Frame => stack[stack.length - 1]
  const push = (style: TextStyle, onPress?: () => void): void => {
    stack.push({ style, nodes: [], onPress })
  }
  const pop = (): void => {
    if (stack.length < 2) return
    const f = stack.pop()!
    top().nodes.push(
      <Text key={nextKey()} style={f.style} onPress={f.onPress}>
        {f.nodes}
      </Text>
    )
  }
  for (const t of children) {
    switch (t.type) {
      case 'text':
        top().nodes.push(...highlighted(t.content))
        break
      case 'softbreak':
      case 'hardbreak':
        top().nodes.push('\n')
        offset += 1
        flat += '\n'
        break
      case 'strong_open':
        push({ fontWeight: '700' })
        break
      case 'em_open':
        push({ fontStyle: 'italic' })
        break
      case 's_open':
        push({ textDecorationLine: 'line-through' })
        break
      case 'strong_close':
      case 'em_close':
      case 's_close':
        pop()
        break
      case 'code_inline':
        top().nodes.push(
          <Text
            key={nextKey()}
            style={{
              fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
              backgroundColor: ctx.theme.bgHover,
              fontSize: 14
            }}
          >
            {` ${t.content} `}
          </Text>
        )
        offset += t.content.length + 2
        flat += ` ${t.content} `
        break
      case 'link_open': {
        const href = attr(t, 'href') ?? ''
        const noteMatch = /^note:([A-Za-z0-9_-]+)/.exec(href)
        push(
          { color: ctx.theme.accent, textDecorationLine: 'underline' },
          () => {
            if (noteMatch) ctx.onNoteLink(noteMatch[1])
            else if (/^(https?:|mailto:)/i.test(href)) Linking.openURL(href).catch(() => {})
          }
        )
        break
      }
      case 'link_close':
        pop()
        break
      case 'image':
        images.push(attr(t, 'src') ?? '')
        break
      case 'html_inline':
        if (/^<br\s*\/?>$/i.test(t.content.trim())) {
          top().nodes.push('\n')
          offset += 1
          flat += '\n'
        }
        break
      default:
        if (t.content) {
          top().nodes.push(t.content)
          offset += t.content.length
          flat += t.content
        }
    }
  }
  while (stack.length > 1) pop()
  return { content: stack[0].nodes, images, flat }
}

function plainText(children: Tok[]): string {
  return children.map((t) => (t.type === 'text' || t.type === 'code_inline' ? t.content : t.type === 'softbreak' ? ' ' : '')).join('')
}

// ---------- images ----------

function NoteImage({ src, ctx }: { src: string; ctx: Ctx }) {
  const [uri, setUri] = useState<string | null>(null)
  const [ratio, setRatio] = useState(1.5)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    const name = attachmentName(src)
    if (/^https?:/i.test(src)) {
      setUri(src)
    } else if (name) {
      localAttachment(ctx.data, name).then((u) => {
        if (!alive) return
        if (u) setUri(u)
        else setFailed(true)
      })
    } else {
      setFailed(true)
    }
    return () => {
      alive = false
    }
  }, [src, ctx.data])
  useEffect(() => {
    if (!uri) return
    Image.getSize(
      uri,
      (w, h) => h > 0 && setRatio(w / h),
      () => {}
    )
  }, [uri])
  if (failed) {
    return <Text style={{ color: ctx.theme.textMuted, fontStyle: 'italic', marginVertical: 6 }}>[image not available offline]</Text>
  }
  if (!uri) return <View style={{ height: 80 }} />
  return <Image source={{ uri }} style={{ width: '100%', aspectRatio: ratio, marginVertical: 8, borderRadius: 6 }} resizeMode="contain" />
}

// ---------- blocks ----------

function renderBlocks(nodes: TreeNode[], ctx: Ctx, depth = 0): React.ReactNode[] {
  return nodes.map((n) => renderBlock(n, ctx, depth))
}

// A block of text that makes sure its last lines are not clipped. Android sizes the box from its own
// measurement, but some phones draw the text wider (system Bold text, custom fonts), so it wraps
// onto more lines than the box was sized for and the last line(s) disappear. After the first layout
// the box is given extra spare height, and if the layout is ever missing the end of the text, that
// tail is drawn underneath so nothing stays hidden.
function Para({
  content,
  flat,
  style,
  blockExtra
}: {
  content: React.ReactNode[]
  flat: string
  style: TextStyle | TextStyle[]
  blockExtra?: { ref?: unknown; onTextLayout?: (e: any) => void }
}) {
  const [info, setInfo] = useState<{ height: number; covered: number } | null>(null)
  const missing = info && flat.length - info.covered > 3 ? flat.slice(info.covered) : ''
  return (
    <>
      <Text
        style={[style, info ? { minHeight: info.height } : null]}
        textBreakStrategy="simple"
        ref={blockExtra?.ref as never}
        onTextLayout={(e) => {
          blockExtra?.onTextLayout?.(e)
          const lines = e.nativeEvent.lines
          if (!lines.length) return
          const last = lines[lines.length - 1]
          // The height Android measured, plus spare lines. The spare room has to be real height on
          // the Text itself (not padding - a TextView never draws text inside its padding): on
          // phones with the "Bold text" setting or a custom font, the text is drawn wider than it
          // was measured, wraps onto extra lines, and everything past the measured height is lost.
          const height = last.y + last.height + (1 + Math.ceil(lines.length * 0.05)) * last.height
          const covered = lines.reduce((n, l) => n + l.text.length, 0)
          setInfo((prev) => (prev && prev.height === height && prev.covered === covered ? prev : { height, covered }))
        }}
      >
        {content}
      </Text>
      {missing ? <Text style={style}>{missing}</Text> : null}
    </>
  )
}

function paragraphLike(children: Tok[], ctx: Ctx, textStyle: TextStyle, key: string, tight = false) {
  const { content, images, flat } = inlineTokens(children, ctx, key)
  return (
    <View key={key} style={{ marginBottom: tight ? 2 : 10 }}>
      {content.length > 0 && <Para content={content} flat={flat} style={textStyle} blockExtra={blockProps(ctx, key)} />}
      {images.map((src, i) => (
        <NoteImage key={i} src={src} ctx={ctx} />
      ))}
    </View>
  )
}

function renderBlock(n: TreeNode, ctx: Ctx, depth: number): React.ReactNode {
  const { theme } = ctx
  const body: TextStyle = { color: theme.text, fontSize: 15.5 }
  const key = nextKey()
  const t = n.tok
  switch (t.type) {
    case 'heading_open': {
      const level = Number(t.tag.slice(1)) || 3
      const size = [0, 24, 20, 17.5, 16, 15.5, 15.5][level] ?? 15.5
      const inline = n.kids.find((k) => k.tok.type === 'inline')
      return paragraphLike(
        inline?.tok.children ?? [],
        ctx,
        { ...body, fontSize: size, fontWeight: '700' },
        key
      )
    }
    case 'paragraph_open': {
      const inline = n.kids.find((k) => k.tok.type === 'inline')
      return paragraphLike(inline?.tok.children ?? [], ctx, body, key)
    }
    case 'blockquote_open':
      return (
        <View
          key={key}
          style={{ borderLeftWidth: 3, borderLeftColor: theme.borderAccent, paddingLeft: 12, marginBottom: 10, opacity: 0.95 }}
        >
          {renderBlocks(n.kids, ctx, depth)}
        </View>
      )
    case 'bullet_list_open':
    case 'ordered_list_open': {
      const ordered = t.type === 'ordered_list_open'
      const start = Number(attr(t, 'start') ?? 1)
      return (
        <View key={key} style={{ marginBottom: depth === 0 ? 10 : 2 }}>
          {n.kids.map((item, i) => renderListItem(item, ctx, depth, ordered ? `${start + i}.` : '•'))}
        </View>
      )
    }
    case 'fence':
    case 'code_block':
      return (
        <ScrollView
          key={key}
          horizontal
          style={{ backgroundColor: theme.bgHover, borderRadius: 8, marginBottom: 10 }}
          contentContainerStyle={{ padding: 10 }}
        >
          <Text style={{ color: theme.text, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo', fontSize: 13 }}>
            {t.content.replace(/\n$/, '')}
          </Text>
        </ScrollView>
      )
    case 'hr':
      return <View key={key} style={{ height: 1, backgroundColor: theme.border, marginVertical: 12 }} />
    case 'table_open':
      return renderTable(n, ctx, key)
    case 'html_block': {
      const text = t.content.replace(/<[^>]+>/g, '').trim()
      return text ? (
        <Text key={key} style={[body, { marginBottom: 10 }]}>
          {text}
        </Text>
      ) : null
    }
    default:
      return n.kids.length > 0 ? <View key={key}>{renderBlocks(n.kids, ctx, depth)}</View> : null
  }
}

function renderListItem(item: TreeNode, ctx: Ctx, depth: number, marker: string) {
  const { theme } = ctx
  const key = nextKey()
  // "- [ ] task" / "- [x] done" show as a checkbox instead of a bullet.
  let checkbox: '☐' | '☑' | null = null
  const first = item.kids[0]
  let kids = item.kids
  if (first?.tok.type === 'paragraph_open') {
    const inline = first.kids.find((k) => k.tok.type === 'inline')
    const firstChild = inline?.tok.children?.[0]
    const m = firstChild && firstChild.type === 'text' ? /^\[([ xX])\]\s+/.exec(firstChild.content) : null
    if (inline && firstChild && m) {
      checkbox = m[1] === ' ' ? '☐' : '☑'
      const patched: Tok = { ...firstChild, content: firstChild.content.slice(m[0].length) }
      const patchedInline: TreeNode = {
        tok: { ...inline.tok, children: [patched, ...(inline.tok.children ?? []).slice(1)] },
        kids: []
      }
      kids = [{ tok: first.tok, kids: first.kids.map((k) => (k === inline ? patchedInline : k)) }, ...item.kids.slice(1)]
    }
  }
  return (
    <View key={key} style={{ flexDirection: 'row', marginBottom: 3 }}>
      <Text
        style={{
          width: checkbox ? 26 : marker.length > 2 ? 30 : 22,
          color: checkbox ? theme.accent : theme.textMuted,
          fontSize: checkbox ? 18 : 15.5,
        }}
      >
        {checkbox ?? marker}
      </Text>
      <View style={{ flex: 1 }}>{renderListContent(kids, ctx, depth + 1)}</View>
    </View>
  )
}

// A list item's own paragraphs sit tight against the next nested list.
function renderListContent(kids: TreeNode[], ctx: Ctx, depth: number): React.ReactNode[] {
  const body: TextStyle = { color: ctx.theme.text, fontSize: 15.5 }
  return kids.map((k) => {
    if (k.tok.type === 'paragraph_open') {
      const inline = k.kids.find((x) => x.tok.type === 'inline')
      return paragraphLike(inline?.tok.children ?? [], ctx, body, nextKey(), true)
    }
    return renderBlock(k, ctx, depth)
  })
}

function cellOf(children: Tok[], ctx: Ctx, bold: boolean, align: string | null): TableCell {
  const text = plainText(children)
  const words = text.split(/\s+/)
  // Built once, up front (not when the table draws), so find matches are numbered in reading order.
  const cid = nextKey()
  const { content, images, flat } = inlineTokens(children, ctx, cid)
  const props = blockProps(ctx, cid)
  const node = (
    <View>
      {content.length > 0 && (
        <Para
          content={content}
          flat={flat}
          blockExtra={props}
          style={{
            color: ctx.theme.text,
            fontSize: 13.5,
            fontWeight: bold ? '700' : '400',
            textAlign: align === 'center' ? 'center' : align === 'right' ? 'right' : 'left'
          }}
        />
      )}
      {images.map((src, i) => (
        <NoteImage key={i} src={src} ctx={ctx} />
      ))}
    </View>
  )
  return {
    textLength: text.length,
    longestWord: Math.max(0, ...words.map((w) => w.length)),
    render: () => node
  }
}

function renderTable(n: TreeNode, ctx: Ctx, key: string) {
  const head: TableCell[] = []
  const rows: TableCell[][] = []
  for (const section of n.kids) {
    const isHead = section.tok.type === 'thead_open'
    for (const tr of section.kids) {
      const cells = tr.kids.map((c) => {
        const inline = c.kids.find((k) => k.tok.type === 'inline')
        const style = attr(c.tok, 'style') ?? ''
        const align = /text-align:\s*(\w+)/.exec(style)?.[1] ?? null
        return cellOf(inline?.tok.children ?? [], ctx, isHead, align)
      })
      if (isHead) head.push(...cells)
      else rows.push(cells)
    }
  }
  return <NoteTable key={key} theme={ctx.theme} header={head} rows={rows} />
}

// ---------- component ----------

export default function NoteView({
  body,
  data,
  theme,
  onNoteLink,
  find = '',
  current = 0,
  onCount,
  scrollRef
}: {
  body: string
  data: CourseData
  theme: Theme
  onNoteLink: (id: string) => void
  find?: string
  current?: number
  onCount?: (count: number) => void
  scrollRef?: React.RefObject<ScrollView | null>
}) {
  const matchesRef = useRef<FindMatch[]>([])
  const blocksRef = useRef(new Map<string, TextBlock>())
  const content = useMemo(() => {
    const matches: FindMatch[] = []
    const blocks = new Map<string, TextBlock>()
    matchesRef.current = matches
    blocksRef.current = blocks
    const tokens = md.parse(body, {}) as unknown as Tok[]
    return renderBlocks(buildTree(tokens), { theme, data, onNoteLink, find, matches, blocks })
  }, [body, data, theme, onNoteLink, find])

  useEffect(() => {
    onCount?.(matchesRef.current.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  // Scroll so the line holding the current match sits near the top. Waits a moment so the text
  // blocks have reported their line layout after (re)drawing.
  useEffect(() => {
    const match = matchesRef.current[current]
    if (!find || !match) return
    const timer = setTimeout(() => {
      const block = blocksRef.current.get(match.container)
      const scroller = scrollRef?.current
      // getInnerViewRef exists at runtime but is missing from the ScrollView typings.
      const inner = (scroller as unknown as { getInnerViewRef?: () => unknown } | null)?.getInnerViewRef?.()
      if (!block?.ref || !scroller || !inner) return
      block.ref.measureLayout(
        inner,
        (_x: number, y: number) => {
          let lineY = 0
          let seen = 0
          for (const line of block.lines) {
            lineY = line.y
            seen += line.text.length
            if (match.offset < seen) break
          }
          scroller.scrollTo({ y: Math.max(0, y + lineY - 150), animated: true })
        },
        () => {}
      )
    }, 150)
    return () => clearTimeout(timer)
  }, [current, find, content, scrollRef])

  return (
    <CurrentMatchContext.Provider value={current}>
      <View style={styles.root}>{content}</View>
    </CurrentMatchContext.Provider>
  )
}

const styles = StyleSheet.create({ root: { paddingBottom: 40 } })
