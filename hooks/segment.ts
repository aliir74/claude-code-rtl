/** A run of markdown lines, either prose to shape or code to leave alone. */
export type Block =
  | { kind: 'text'; lines: string[] }
  | { kind: 'code'; lines: string[]; language?: string }

/** Opening or closing fence, with the info string when it opens. */
const FENCE = /^\s{0,3}(```+|~~~+)\s*(\S*)/

/** Four spaces or a tab, the markdown indented-code prefix. */
const INDENT = /^(?: {4}|\t)/

/**
 * Splits markdown into blocks so a caller can shape prose and pass code
 * through untouched. Fence markers are dropped; an indented block keeps its
 * text with the indent stripped. An unterminated fence runs to the end.
 */
export function splitBlocks(markdown: string): Block[] {
  if (markdown === '') return []

  const lines = markdown.split('\n')
  const blocks: Block[] = []
  let text: string[] = []

  const flushText = (): void => {
    if (text.length > 0) {
      blocks.push({ kind: 'text', lines: text })
      text = []
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const fence = FENCE.exec(line)

    if (fence) {
      flushText()

      const marker = fence[1] ?? '```'
      const language = fence[2] ?? ''
      const body: string[] = []

      i += 1
      while (i < lines.length) {
        const inner = lines[i] ?? ''
        const closing = FENCE.exec(inner)
        if (closing && (closing[1] ?? '').startsWith(marker[0] ?? '`') && (closing[2] ?? '') === '') {
          break
        }
        body.push(inner)
        i += 1
      }

      blocks.push(language === '' ? { kind: 'code', lines: body } : { kind: 'code', lines: body, language })
      continue
    }

    const previousIsBlank = text.length > 0 && (text[text.length - 1] ?? '') === ''
    if (INDENT.test(line) && previousIsBlank) {
      flushText()

      const body: string[] = []
      while (i < lines.length && INDENT.test(lines[i] ?? '')) {
        body.push((lines[i] ?? '').replace(INDENT, ''))
        i += 1
      }
      i -= 1

      blocks.push({ kind: 'code', lines: body })
      continue
    }

    text.push(line)
  }

  flushText()

  return blocks
}

/** A line's leading markdown markers, kept out of the shaped run. */
export type PrefixSplit = { prefix: string; body: string }

/**
 * One leading marker: a bullet (with an optional task checkbox), an ordered
 * marker, a heading, or a blockquote. Applied repeatedly so `> - ` composes.
 */
const PREFIX = /^(\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d{1,3}[.)]\s+|#{1,6}\s+|>\s?))/

/**
 * Peels the leading markdown markers off a line. They stay at the logical
 * start of the row; only `body` is reordered, so a bullet never ends up on
 * the wrong side of its own text.
 */
export function splitPrefix(line: string): PrefixSplit {
  let prefix = ''
  let body = line

  for (;;) {
    const match = PREFIX.exec(body)
    if (!match) break
    const taken = match[1] ?? ''
    if (taken === '') break
    prefix += taken
    body = body.slice(taken.length)
  }

  return { prefix, body }
}

/** A body with its unshapeable runs lifted out. */
export type ProtectedBody = { text: string; tokens: string[] }

/**
 * Runs fribidi must never see.
 *
 * Inline code and URLs have to come back byte-identical. Emphasis spans are
 * here for a different reason: `*` and `_` are neutral characters, so bidi
 * moves each marker independently of the words it wraps and a reply comes out
 * with stray `**` at the wrong ends. Protecting the whole span keeps every
 * marker attached to its own text.
 */
const TOKEN =
  /(`[^`\n]+`)|(https?:\/\/[^\s<>()\]]+)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)/g

const OPEN = String.fromCharCode(0xe000)
const CLOSE = String.fromCharCode(0xe001)

/** Encodes an index as a..z, aa..az, ba.. so a placeholder carries its own id. */
const letters = (index: number): string => {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(97 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

/**
 * Replaces inline code and URLs with private-use placeholders. The
 * placeholders are letters, so the bidi algorithm treats them as a plain LTR
 * run and keeps each one's code points adjacent and in order; the index is
 * encoded in the placeholder itself, so a run that bidi moves elsewhere in
 * the line still restores to the right token.
 */
export function protectTokens(body: string): ProtectedBody {
  const tokens: string[] = []

  const text = body.replace(TOKEN, match => {
    const placeholder = OPEN + letters(tokens.length) + CLOSE
    tokens.push(match)
    return placeholder
  })

  return { text, tokens }
}

const PLACEHOLDER = new RegExp(OPEN + '([a-z]+)' + CLOSE, 'g')

const indexOfLetters = (code: string): number => {
  let n = 0
  for (const char of code) n = n * 26 + (char.charCodeAt(0) - 97 + 1)
  return n - 1
}

/** Puts the protected runs back, wherever bidi left their placeholders. */
export function restoreTokens(visual: string, tokens: string[]): string {
  return visual.replace(PLACEHOLDER, (whole, code: string) => {
    const token = tokens[indexOfLetters(code)]
    return token === undefined ? whole : token
  })
}

/** A table row: `| a | b |`, but not the `|---|---|` separator. */
const TABLE_ROW = /^\s*\|.*\|\s*$/
const TABLE_SEPARATOR = /^\s*\|?(\s*:?-+:?\s*\|)+\s*$/

/**
 * Splits a table row into its cells, or returns null when the line is not a
 * row (or is the separator). Each cell is shaped on its own so the pipes keep
 * their columns. An escaped `\|` stays inside its cell.
 */
export function splitTableRow(line: string): string[] | null {
  if (!TABLE_ROW.test(line) || TABLE_SEPARATOR.test(line)) return null

  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells: string[] = []
  let cell = ''

  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i] ?? ''
    if (char === '\\' && inner[i + 1] === '|') {
      cell += '\\|'
      i += 1
      continue
    }
    if (char === '|') {
      cells.push(cell.trim())
      cell = ''
      continue
    }
    cell += char
  }
  cells.push(cell.trim())

  return cells
}

/** Joins shaped cells back into a row. */
export function joinTableRow(cells: string[]): string {
  return '| ' + cells.join(' | ') + ' |'
}
