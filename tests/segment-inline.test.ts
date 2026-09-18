import { describe, expect, test } from 'claude-code/testing'

import { protectTokens, restoreTokens } from '../hooks/segment'

const CODE_BODY = 'قیمت را با `getPrice()` بگیر'
const URL_BODY = 'برو به https://example.com/a?b=c و ببین'

const OPEN = String.fromCharCode(0xe000)
const CLOSE = String.fromCharCode(0xe001)

describe('segment-inline', () => {
  test('an inline code span becomes a token', () => {
    const { text, tokens } = protectTokens(CODE_BODY)
    expect(tokens).toEqual(['`getPrice()`'])
    expect(text.includes('`')).toBe(false)
    expect(text.includes(OPEN + 'a' + CLOSE)).toBe(true)
  })

  test('a URL becomes a token', () => {
    expect(protectTokens(URL_BODY).tokens).toEqual(['https://example.com/a?b=c'])
  })

  test('two tokens get placeholders a then b', () => {
    const { text, tokens } = protectTokens('`one` و `two`')
    expect(tokens).toEqual(['`one`', '`two`'])
    expect(text).toBe(OPEN + 'a' + CLOSE + ' و ' + OPEN + 'b' + CLOSE)
  })

  test('a code body round trips', () => {
    const { text, tokens } = protectTokens(CODE_BODY)
    expect(restoreTokens(text, tokens)).toBe(CODE_BODY)
  })

  test('a URL body round trips', () => {
    const { text, tokens } = protectTokens(URL_BODY)
    expect(restoreTokens(text, tokens)).toBe(URL_BODY)
  })

  test('a body with nothing to protect is unchanged', () => {
    const { text, tokens } = protectTokens('سلام دنیا')
    expect(tokens).toEqual([])
    expect(text).toBe('سلام دنیا')
  })

  test('placeholders swapped by bidi still restore to the right token', () => {
    const { tokens } = protectTokens('`one` و `two`')
    // What real fribidi produces: each run's code points stay adjacent and in
    // order, but the two runs swap relative position.
    const swapped = OPEN + 'b' + CLOSE + ' و ' + OPEN + 'a' + CLOSE
    expect(restoreTokens(swapped, tokens)).toBe('`two` و `one`')
  })

  test('a bold span protects only its markers', () => {
    const { text, tokens } = protectTokens('**متن پررنگ**')
    expect(tokens).toEqual(['**', '**'])
    expect(text).toBe(OPEN + 'a' + CLOSE + 'متن پررنگ' + OPEN + 'b' + CLOSE)
  })

  test('an italic span protects only its markers', () => {
    expect(protectTokens('*متن*').tokens).toEqual(['*', '*'])
  })

  test('an underscore span protects only its markers', () => {
    expect(protectTokens('__متن__').tokens).toEqual(['__', '__'])
  })

  test('a code span inside a bold span stays protected', () => {
    const body = '**قیمت `getPrice()` را بگیر**'
    const { text, tokens } = protectTokens(body)
    expect(tokens).toEqual(['**', '`getPrice()`', '**'])
    expect(text.includes('`')).toBe(false)
    expect(restoreTokens(text, tokens)).toBe(body)
  })

  test('a URL inside a bold span stays protected', () => {
    const body = '**برو به https://example.com/a?b=c**'
    const { tokens } = protectTokens(body)
    expect(tokens).toEqual(['**', 'https://example.com/a?b=c', '**'])
  })

  test('an emphasis body round trips', () => {
    const body = 'یک **متن پررنگ** و یک *مورب*'
    const { text, tokens } = protectTokens(body)
    expect(restoreTokens(text, tokens)).toBe(body)
  })

  test('a token index past z encodes in two letters', () => {
    const body = Array.from({ length: 27 }, (_, i) => '`t' + i + '`').join(' ')
    const { text, tokens } = protectTokens(body)
    expect(tokens.length).toBe(27)
    expect(text.includes(OPEN + 'aa' + CLOSE)).toBe(true)
    expect(restoreTokens(text, tokens)).toBe(body)
  })
})
