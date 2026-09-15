import { describe, expect, test } from 'claude-code/testing'

import { cellWidth } from '../hooks/cell-width'
import type { Shaper } from '../hooks/transform'
import { transformText } from '../hooks/transform'

// Models what real fribidi does: the line is reordered, but each protected
// placeholder run keeps its own code points adjacent and in order (measured
// against the real binary). A naive code-point reverse would flip the
// placeholder's own delimiters, which fribidi never does.
const reverse = (s: string): string => {
  const units = s.match(/[a-z]+|[\s\S]/g) ?? []
  return units.reverse().join('')
}

/** Records what it was asked to shape, and reverses each line. */
const recorder = (): { shape: Shaper; calls: { lines: string[]; dir: string }[] } => {
  const calls: { lines: string[]; dir: string }[] = []
  const shape: Shaper = async (lines, dir) => {
    calls.push({ lines: [...lines], dir })
    return lines.map(reverse)
  }
  return { shape, calls }
}

const PERSIAN = 'این یک متن فارسی است برای تست\nخط دوم هم فارسی است\nو خط سوم'

describe('transform', () => {
  test('all-Latin text takes the fast path and never shapes', async () => {
    const { shape, calls } = recorder()
    const out = await transformText(
      'hello world, the API returns JSON',
      { columns: 30, alignment: 'auto', markdown: true },
      shape,
    )
    expect(out).toBe(null)
    expect(calls.length).toBe(0)
  })

  test('a Persian message is shaped in exactly one batched call', async () => {
    const { shape, calls } = recorder()
    await transformText(PERSIAN, { columns: 30, alignment: 'auto', markdown: true }, shape)
    expect(calls.length).toBe(1)
    expect(calls[0]?.dir).toBe('rtl')
    expect((calls[0]?.lines.length ?? 0) >= 3).toBe(true)
  })

  test('every produced line fits the viewport', async () => {
    const { shape } = recorder()
    const out = await transformText(
      PERSIAN,
      { columns: 30, alignment: 'auto', markdown: true },
      shape,
    )
    expect(out).not.toBe(null)
    for (const line of out ?? []) {
      if (line.kind === 'text') expect(cellWidth(line.text) <= 30).toBe(true)
    }
  })

  test('auto alignment right-aligns the rtl lines', async () => {
    const { shape } = recorder()
    const out = await transformText(
      'سلام دنیا',
      { columns: 20, alignment: 'auto', markdown: true },
      shape,
    )
    const first = (out ?? [])[0]
    expect(first?.kind).toBe('text')
    if (first?.kind === 'text') {
      expect(first.text.startsWith(' ')).toBe(true)
      expect(cellWidth(first.text)).toBe(20)
    }
  })

  test('left alignment never pads', async () => {
    const { shape } = recorder()
    const out = await transformText(
      'سلام دنیا',
      { columns: 20, alignment: 'left', markdown: true },
      shape,
    )
    const first = (out ?? [])[0]
    if (first?.kind === 'text') expect(first.text.startsWith(' ')).toBe(false)
  })

  test('a code block passes through unshaped', async () => {
    const { shape, calls } = recorder()
    const out = await transformText(
      'سلام\n```ts\nconst a = 1\n```',
      { columns: 30, alignment: 'auto', markdown: true },
      shape,
    )
    const code = (out ?? []).find(line => line.kind === 'code')
    expect(code).not.toBe(undefined)
    if (code?.kind === 'code') {
      expect(code.source).toBe('const a = 1')
      expect(code.language).toBe('ts')
    }
    expect(calls[0]?.lines.some(line => line.includes('const a = 1'))).toBe(false)
  })

  test('a bullet marker stays at the logical line start', async () => {
    const { shape } = recorder()
    const out = await transformText(
      '- سلام دنیا',
      { columns: 30, alignment: 'left', markdown: true },
      shape,
    )
    const first = (out ?? [])[0]
    if (first?.kind === 'text') expect(first.text.startsWith('- ')).toBe(true)
  })

  test('an inline code span survives the round trip', async () => {
    const { shape } = recorder()
    const out = await transformText(
      'قیمت را با `getPrice()` بگیر',
      { columns: 40, alignment: 'left', markdown: true },
      shape,
    )
    const joined = (out ?? []).map(l => (l.kind === 'text' ? l.text : '')).join('\n')
    expect(joined.includes('`getPrice()`')).toBe(true)
  })

  test('a URL survives the round trip', async () => {
    const { shape } = recorder()
    const out = await transformText(
      'برو به https://example.com/a?b=c و ببین',
      { columns: 60, alignment: 'left', markdown: true },
      shape,
    )
    const joined = (out ?? []).map(l => (l.kind === 'text' ? l.text : '')).join('\n')
    expect(joined.includes('https://example.com/a?b=c')).toBe(true)
  })

  test('a Latin-only line inside a Persian message is not shaped', async () => {
    const { shape, calls } = recorder()
    await transformText(
      'سلام\nthe API returns JSON',
      { columns: 40, alignment: 'left', markdown: true },
      shape,
    )
    const sent = calls.flatMap(call => call.lines)
    expect(sent.some(line => line.includes('the API returns JSON'))).toBe(false)
  })

  test('a table row keeps its pipes', async () => {
    const { shape } = recorder()
    const out = await transformText(
      '| نام | قیمت |',
      { columns: 40, alignment: 'left', markdown: true },
      shape,
    )
    const first = (out ?? [])[0]
    if (first?.kind === 'text') {
      expect(first.text.startsWith('| ')).toBe(true)
      expect(first.text.endsWith(' |')).toBe(true)
    }
  })
})
