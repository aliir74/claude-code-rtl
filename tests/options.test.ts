import { describe, expect, test } from 'claude-code/testing'

import { settingsOf } from '../hooks/options'

describe('options', () => {
  test('an empty options object gives every default', () => {
    expect(settingsOf({})).toEqual({
      alignment: 'auto',
      fribidiPath: 'fribidi',
      margin: 4,
      cacheSize: 256,
      timeoutMs: 2000,
      replyBullet: String.fromCodePoint(0x23fa),
    })
  })

  test('a valid alignment and margin are taken as given', () => {
    const s = settingsOf({ alignment: 'right', margin: 6 })
    expect(s.alignment).toBe('right')
    expect(s.margin).toBe(6)
  })

  test('an unknown alignment falls back to auto', () => {
    expect(settingsOf({ alignment: 'bogus' }).alignment).toBe('auto')
  })

  test('a negative margin clamps to zero', () => {
    expect(settingsOf({ margin: -3 }).margin).toBe(0)
  })

  test('a non-numeric cacheSize falls back to the default', () => {
    expect(settingsOf({ cacheSize: 'x' }).cacheSize).toBe(256)
  })

  test('a custom reply bullet is taken as given, including empty', () => {
    expect(settingsOf({ replyBullet: '>' }).replyBullet).toBe('>')
    expect(settingsOf({ replyBullet: '' }).replyBullet).toBe('')
  })

  test('an over-large timeoutMs clamps to the ceiling', () => {
    expect(settingsOf({ timeoutMs: 999999 }).timeoutMs).toBe(10000)
  })
})
