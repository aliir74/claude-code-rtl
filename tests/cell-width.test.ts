import { describe, expect, test } from 'claude-code/testing'

import { cellWidth } from '../hooks/cell-width'

describe('cell-width', () => {
  test('ASCII is one cell each', () => {
    expect(cellWidth('hello')).toBe(5)
  })

  test('Persian letters are one cell each', () => {
    expect(cellWidth('سلام')).toBe(4)
  })

  test('ZWNJ costs nothing', () => {
    expect(cellWidth('می‌خواهم')).toBe(7)
  })

  test("fribidi's lam-alef filler costs nothing", () => {
    expect(cellWidth('ﻼ﻿')).toBe(1)
  })

  test('an Arabic fatha costs nothing', () => {
    expect(cellWidth('مَدرسه')).toBe(5)
  })

  test('the empty string is zero', () => {
    expect(cellWidth('')).toBe(0)
  })

  test('CJK is two cells each', () => {
    expect(cellWidth('日本')).toBe(4)
  })

  test('a combining acute costs nothing', () => {
    expect(cellWidth('á')).toBe(1)
  })
})
