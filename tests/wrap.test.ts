import { describe, expect, test } from 'claude-code/testing'

import { cellWidth } from '../hooks/cell-width'
import { wrapBody } from '../hooks/wrap'

const PARAGRAPH = 'این یک متن فارسی است برای تست'

describe('wrap', () => {
  test('every line fits and nothing is lost when each token fits', () => {
    const lines = wrapBody(PARAGRAPH, 12)
    for (const line of lines) expect(cellWidth(line) <= 12).toBe(true)
    expect(lines.join(' ')).toBe(PARAGRAPH)
    expect(lines.length >= 3).toBe(true)
  })

  test('a Latin token can start a continuation line', () => {
    const lines = wrapBody('قیمت ۱۲۰ دلار است و the API returns JSON.', 20)
    expect(lines.length >= 2).toBe(true)
    expect(lines.slice(1).some(line => /^[A-Za-z]/.test(line))).toBe(true)
  })

  test('an inline code span is never split when it fits', () => {
    const lines = wrapBody('قیمت را با `getPrice()` بگیر', 16)
    expect(lines.some(line => line.includes('`getPrice()`'))).toBe(true)
  })

  test('a URL is never split when it fits', () => {
    const lines = wrapBody('برو به https://example.com/a?b=c و ببین', 26)
    expect(lines.some(line => line.includes('https://example.com/a?b=c'))).toBe(true)
  })

  test('a token wider than the width is hard-broken by cell width', () => {
    const lines = wrapBody('ابرکلمهطولانیبسیارزیاد', 6)
    expect(lines.length >= 2).toBe(true)
    for (const line of lines) expect(cellWidth(line) <= 6).toBe(true)
  })

  test('the empty body is one empty line', () => {
    expect(wrapBody('', 20)).toEqual([''])
  })

  test('a width of zero means no wrapping', () => {
    expect(wrapBody('سلام', 0)).toEqual(['سلام'])
  })
})
