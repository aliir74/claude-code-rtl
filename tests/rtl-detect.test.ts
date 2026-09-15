import { describe, expect, test } from 'claude-code/testing'

import { baseDirection, hasRtl } from '../hooks/rtl-detect'

describe('rtl-detect', () => {
  test('pure Latin has no RTL', () => {
    expect(hasRtl('hello world')).toBe(false)
  })

  test('Persian has RTL', () => {
    expect(hasRtl('سلام دنیا')).toBe(true)
  })

  test('mixed Persian and Latin has RTL', () => {
    expect(hasRtl('قیمت ۱۲۰ دلار است و the API returns JSON.')).toBe(true)
  })

  test('Hebrew has RTL', () => {
    expect(hasRtl('שלום')).toBe(true)
  })

  test('Persian digits alone are not strong RTL', () => {
    expect(hasRtl('۱۲۳')).toBe(false)
  })

  test('Arabic-Indic digits alone are not strong RTL', () => {
    expect(hasRtl('٠١٢')).toBe(false)
  })

  test('ASCII digits are not RTL', () => {
    expect(hasRtl('123')).toBe(false)
  })

  test('a Persian-first line is rtl', () => {
    expect(baseDirection('قیمت ۱۲۰ دلار است')).toBe('rtl')
  })

  test('a Latin-first line is ltr even with Persian later', () => {
    expect(baseDirection('the API returns JSON و سلام')).toBe('ltr')
  })

  test('leading punctuation is neutral', () => {
    expect(baseDirection('- سلام')).toBe('rtl')
  })

  test('digits give no strong direction, so ltr', () => {
    expect(baseDirection('123')).toBe('ltr')
  })

  test('the empty line is ltr', () => {
    expect(baseDirection('')).toBe('ltr')
  })
})
