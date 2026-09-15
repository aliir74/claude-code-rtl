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
