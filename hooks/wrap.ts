import { cellWidth } from './cell-width'

/** Inline code spans and URLs are atomic: wrapping must not split them. */
const ATOMIC = /^(?:`[^`\n]+`|https?:\/\/[^\s<>()\]]+)$/

/** Breaks one oversize token into width-sized pieces, measured in cells. */
const hardBreak = (token: string, width: number): string[] => {
  const pieces: string[] = []
  let piece = ''

  for (const char of token) {
    if (cellWidth(piece + char) > width && piece !== '') {
      pieces.push(piece)
      piece = char
      continue
    }
    piece += char
  }

  if (piece !== '') pieces.push(piece)

  return pieces
}

/**
 * Greedy word wrap measured in terminal cells, in LOGICAL order.
 *
 * Wrapping happens before shaping on purpose. Shaping first and wrapping the
 * visual result would put the paragraph's opening words on the last line;
 * this order keeps line 1 the start of the paragraph. A width of zero or less
 * means no wrapping at all.
 */
export function wrapBody(body: string, width: number): string[] {
  if (width <= 0) return [body]
  if (body === '') return ['']

  const lines: string[] = []
  let line = ''

  const flush = (): void => {
    if (line !== '') {
      lines.push(line)
      line = ''
    }
  }

  for (const token of body.split(' ')) {
    if (token === '') continue

    const candidate = line === '' ? token : line + ' ' + token

    if (cellWidth(candidate) <= width) {
      line = candidate
      continue
    }

    flush()

    if (cellWidth(token) <= width || ATOMIC.test(token)) {
      line = token
      continue
    }

    const pieces = hardBreak(token, width)
    for (let i = 0; i < pieces.length - 1; i += 1) lines.push(pieces[i] ?? '')
    line = pieces[pieces.length - 1] ?? ''
  }

  flush()

  return lines.length === 0 ? [''] : lines
}
