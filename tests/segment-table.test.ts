import { describe, expect, test } from 'claude-code/testing'

import { joinTableRow, splitTableRow } from '../hooks/segment'

describe('segment-table', () => {
  test('a row splits into trimmed cells', () => {
    expect(splitTableRow('| نام | قیمت |')).toEqual(['نام', 'قیمت'])
  })

  test('a separator row is not a row', () => {
    expect(splitTableRow('|---|---|')).toBe(null)
  })

  test('a line without a leading pipe is not a row', () => {
    expect(splitTableRow('سلام | دنیا')).toBe(null)
  })

  test('an escaped pipe stays inside its cell', () => {
    expect(splitTableRow('| a \\| b | c |')).toEqual(['a \\| b', 'c'])
  })

  test('cells join back into a row', () => {
    expect(joinTableRow(['نام', 'قیمت'])).toBe('| نام | قیمت |')
  })
})
