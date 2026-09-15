import { describe, expect, test } from 'claude-code/testing'

import { padLine } from '../hooks/align'

describe('align', () => {
  test('right alignment pads to the width', () => {
    expect(padLine('ab', 6, 'right', 'ltr')).toBe('    ab')
  })

  test('auto right-aligns an rtl line', () => {
    expect(padLine('ab', 6, 'auto', 'rtl')).toBe('    ab')
  })

  test('auto leaves an ltr line alone', () => {
    expect(padLine('ab', 6, 'auto', 'ltr')).toBe('ab')
  })

  test('left never pads, even for rtl', () => {
    expect(padLine('ab', 6, 'left', 'rtl')).toBe('ab')
  })

  test('padding is measured in cells, not code points', () => {
    // 'می‌خواهم' is 8 code points but 7 cells, so 3 spaces reach 10.
    expect(padLine('می‌خواهم', 10, 'right', 'rtl')).toBe('   می‌خواهم')
  })

  test('an over-wide line is never negatively padded', () => {
    expect(padLine('abcdefgh', 4, 'right', 'rtl')).toBe('abcdefgh')
  })
})
