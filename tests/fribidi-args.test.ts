import { describe, expect, test } from 'claude-code/testing'

import { fribidiArgv, packStdin, unpackStdout } from '../hooks/fribidi-args'

const FILLER = String.fromCharCode(0xfeff)

describe('fribidi-args', () => {
  test('the rtl argv is exactly the verified flag set', () => {
    expect(fribidiArgv('rtl', 'fribidi')).toEqual([
      'fribidi',
      '--nopad',
      '--nobreak',
      '--reordernsm',
      '--rtl',
    ])
  })

  test('a custom path leads and ltr forces the other direction', () => {
    const argv = fribidiArgv('ltr', '/opt/homebrew/bin/fribidi')
    expect(argv[0]).toBe('/opt/homebrew/bin/fribidi')
    expect(argv[argv.length - 1]).toBe('--ltr')
  })

  test('never passes --width, whose padding we do ourselves', () => {
    expect(fribidiArgv('rtl', 'fribidi').includes('--width')).toBe(false)
  })

  test('stdin is one newline-terminated line each', () => {
    expect(packStdin(['a', 'b'])).toBe('a\nb\n')
  })

  test('no lines means no stdin', () => {
    expect(packStdin([])).toBe('')
  })

  test('stdout unpacks to the same number of lines', () => {
    expect(unpackStdout('x\ny\n', 2)).toEqual(['x', 'y'])
  })

  test('a line-count mismatch is refused', () => {
    expect(unpackStdout('x\n', 2)).toBe(null)
  })

  test('the lam-alef filler is stripped', () => {
    expect(unpackStdout('ﻼ' + FILLER + 'ﺳ\n', 1)).toEqual(['ﻼﺳ'])
  })

  test('a trailing carriage return is dropped', () => {
    expect(unpackStdout('a\r\n', 1)).toEqual(['a'])
  })
})
