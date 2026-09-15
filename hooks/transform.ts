import { padLine } from './align'
import { cellWidth } from './cell-width'
import type { Direction } from './fribidi-args'
import type { Alignment } from './options'
import { baseDirection, hasRtl } from './rtl-detect'
import {
  joinTableRow,
  protectTokens,
  restoreTokens,
  splitBlocks,
  splitPrefix,
  splitTableRow,
} from './segment'
import { wrapBody } from './wrap'

/** Turns logical lines into visual ones. One call per base direction. */
export type Shaper = (lines: string[], dir: Direction) => Promise<string[]>

/** A line of the drawn tree: prose to print, or a code block to hand to Code. */
export type RenderLine =
  | { kind: 'text'; text: string }
  | { kind: 'code'; source: string; language?: string }

export type TransformOptions = {
  columns: number
  alignment: Alignment
  markdown: boolean
}

/** A wrapped piece waiting for its shaped form. */
type Slot = {
  dir: Direction
  index: number
  prefix: string
  tokens: string[]
  /** Set for a table cell so the row can be rebuilt once every cell is back. */
  row?: { at: number; cell: number }
}

/**
 * Shapes a markdown message for a terminal that cannot do bidi itself.
 *
 * Returns null when there is nothing to do, which is the fast path for an
 * all-Latin message: the caller then leaves the engine's own row alone.
 *
 * The order is the whole point. Wrapping happens in LOGICAL order against the
 * viewport width, and only then is each finished line shaped. Shaping first
 * and wrapping the visual result would move the paragraph's opening words to
 * the last line.
 */
export async function transformText(
  text: string,
  opts: TransformOptions,
  shape: Shaper,
): Promise<RenderLine[] | null> {
  if (!hasRtl(text)) return null

  const blocks = opts.markdown
    ? splitBlocks(text)
    : [{ kind: 'text' as const, lines: text.split('\n') }]

  const out: RenderLine[] = []
  const pending: Record<Direction, string[]> = { rtl: [], ltr: [] }
  const slots: (Slot | null)[] = []

  const queue = (body: string, prefix: string, width: number, row?: Slot['row']): void => {
    const dir = baseDirection(body)
    for (const piece of wrapBody(body, width)) {
      const { text: protectedText, tokens } = protectTokens(piece)
      slots.push({ dir, index: pending[dir].length, prefix, tokens, ...(row ? { row } : {}) })
      pending[dir].push(protectedText)
      out.push({ kind: 'text', text: '' })
    }
  }

  for (const block of blocks) {
    if (block.kind === 'code') {
      slots.push(null)
      out.push(
        block.language === undefined
          ? { kind: 'code', source: block.lines.join('\n') }
          : { kind: 'code', source: block.lines.join('\n'), language: block.language },
      )
      continue
    }

    for (const line of block.lines) {
      if (!hasRtl(line)) {
        slots.push(null)
        out.push({
          kind: 'text',
          text: opts.alignment === 'right' ? padLine(line, opts.columns, 'right', 'ltr') : line,
        })
        continue
      }

      const cells = opts.markdown ? splitTableRow(line) : null
      if (cells) {
        const at = out.length
        slots.push(null)
        out.push({ kind: 'text', text: '' })
        cells.forEach((cell, index) => {
          queue(cell, '', opts.columns, { at, cell: index })
        })
        continue
      }

      const { prefix, body } = opts.markdown ? splitPrefix(line) : { prefix: '', body: line }
      queue(body, prefix, opts.columns - cellWidth(prefix))
    }
  }

  // One subprocess per direction actually used, never one per line.
  const shaped: Record<Direction, string[]> = { rtl: [], ltr: [] }
  if (pending.rtl.length > 0) shaped.rtl = await shape(pending.rtl, 'rtl')
  if (pending.ltr.length > 0) shaped.ltr = await shape(pending.ltr, 'ltr')

  const rows = new Map<number, string[]>()

  slots.forEach((slot, position) => {
    if (!slot) return

    const visual = shaped[slot.dir][slot.index]
    if (visual === undefined) return

    const restored = slot.tokens.length === 0 ? visual : restoreTokens(visual, slot.tokens)

    if (slot.row) {
      const cells = rows.get(slot.row.at) ?? []
      cells[slot.row.cell] = (cells[slot.row.cell] ?? '') + restored
      rows.set(slot.row.at, cells)
      return
    }

    const width = opts.columns - cellWidth(slot.prefix)
    out[position] = {
      kind: 'text',
      text: slot.prefix + padLine(restored, width, opts.alignment, slot.dir),
    }
  })

  for (const [at, cells] of rows) {
    out[at] = { kind: 'text', text: joinTableRow(cells.map(cell => cell ?? '')) }
  }

  return out
}
