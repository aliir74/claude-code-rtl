import type { Elements, RenderElement } from 'claude-code'
import type { RenderLine } from './transform'

/**
 * The three constructors this mod draws with, taken from the surface's table.
 *
 * Elements are NOT hand-built object literals. A `{ type: 'Box', ... }`
 * literal is type-legal, so tsc would never complain, but the engine refuses
 * the tree and redraws its own row instead, which looks exactly like the mod
 * not being loaded at all.
 */
export type DrawTable = Pick<Elements['terminal'], 'Box' | 'Text' | 'Code'>

/** CodeProps.source is capped at 10000 characters. */
const CODE_CAP = 10000

/**
 * The marker column drawn beside a reply.
 *
 * Returning our own tree replaces the engine's whole row, bullet included, so
 * a reply loses the marker that separates it from the one before unless we
 * draw it ourselves. `first` goes on the opening line, `rest` keeps every
 * later line aligned with it, so both must be the same cell width.
 *
 * `side` is which edge it sits on. For right-to-left text the line begins at
 * the RIGHT edge, so a marker on the left sits at the end of the sentence,
 * which reads as nothing at all; RTL replies put it on the right.
 */
export type Gutter = { first: string; rest: string; side: 'left' | 'right' }

/**
 * Builds the drawn tree: one Text per visual line inside a column Box, and a
 * Code element for each passed-through code block.
 *
 * Every line is already wrapped to the viewport, so `wrap: 'truncate-end'`
 * should never fire; it is there so that a cell-width disagreement clips one
 * line rather than reflowing the whole paragraph and undoing the bidi order.
 */
export function treeOf(lines: RenderLine[], t: DrawTable, gutter?: Gutter): RenderElement {
  const children: RenderElement[] = []

  /** Puts the marker on the edge the reading direction starts from. */
  const withGutter = (text: string): string => {
    if (!gutter) return text
    const mark = children.length === 0 ? gutter.first : gutter.rest
    return gutter.side === 'right' ? text + mark : mark + text
  }

  for (const line of lines) {
    if (line.kind === 'code') {
      if (line.source.length <= CODE_CAP) {
        children.push(
          line.language === undefined
            ? t.Code({ source: line.source })
            : t.Code({ source: line.source, language: line.language }),
        )
        continue
      }

      // Too long for Code: fall back to plain rows rather than losing it.
      for (const row of line.source.split('\n')) {
        children.push(
          t.Text({ wrap: 'truncate-end', children: [withGutter(row === '' ? ' ' : row)] }),
        )
      }
      continue
    }

    // An empty Text can collapse the row, so a blank line draws one space.
    children.push(
      t.Text({ wrap: 'truncate-end', children: [withGutter(line.text === '' ? ' ' : line.text)] }),
    )
  }

  return t.Box({ flexDirection: 'column', children })
}
