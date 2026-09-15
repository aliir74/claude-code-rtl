import { describe, expect, test } from 'claude-code/testing'

import { splitPrefix } from '../hooks/segment'

describe('segment-prefix', () => {
  test('a bullet is a prefix', () => {
    expect(splitPrefix('- سلام')).toEqual({ prefix: '- ', body: 'سلام' })
  })

  test('an indented star bullet keeps its indent', () => {
    expect(splitPrefix('  * سلام')).toEqual({ prefix: '  * ', body: 'سلام' })
  })

  test('an ordered marker with a dot', () => {
    expect(splitPrefix('1. سلام')).toEqual({ prefix: '1. ', body: 'سلام' })
  })

  test('an ordered marker with a paren', () => {
    expect(splitPrefix('12) سلام')).toEqual({ prefix: '12) ', body: 'سلام' })
  })

  test('a heading marker', () => {
    expect(splitPrefix('## عنوان')).toEqual({ prefix: '## ', body: 'عنوان' })
  })

  test('a blockquote marker', () => {
    expect(splitPrefix('> نقل')).toEqual({ prefix: '> ', body: 'نقل' })
  })

  test('nested blockquote and bullet compose', () => {
    expect(splitPrefix('> - سلام')).toEqual({ prefix: '> - ', body: 'سلام' })
  })

  test('a task-list checkbox is part of the prefix', () => {
    expect(splitPrefix('- [ ] کار')).toEqual({ prefix: '- [ ] ', body: 'کار' })
  })

  test('plain text has no prefix', () => {
    expect(splitPrefix('سلام')).toEqual({ prefix: '', body: 'سلام' })
  })

  test('a dash with no space is not a bullet', () => {
    expect(splitPrefix('-سلام')).toEqual({ prefix: '', body: '-سلام' })
  })
})
