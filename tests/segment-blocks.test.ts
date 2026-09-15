import { describe, expect, test } from 'claude-code/testing'

import { splitBlocks } from '../hooks/segment'

describe('segment-blocks', () => {
  test('plain Persian is one text block', () => {
    expect(splitBlocks('سلام دنیا\nاین یک تست است')).toEqual([
      { kind: 'text', lines: ['سلام دنیا', 'این یک تست است'] },
    ])
  })

  test('a fenced block splits text, code, text and drops the fence markers', () => {
    expect(splitBlocks('سلام\n```ts\nconst a = 1\n```\nبعد')).toEqual([
      { kind: 'text', lines: ['سلام'] },
      { kind: 'code', lines: ['const a = 1'], language: 'ts' },
      { kind: 'text', lines: ['بعد'] },
    ])
  })

  test('a tilde fence works the same way', () => {
    expect(splitBlocks('~~~\nraw\n~~~')).toEqual([{ kind: 'code', lines: ['raw'] }])
  })

  test('an unterminated fence runs to the end as code', () => {
    expect(splitBlocks('```py\nx = 1\ny = 2')).toEqual([
      { kind: 'code', lines: ['x = 1', 'y = 2'], language: 'py' },
    ])
  })

  test('an indented block after a blank line is code with the indent stripped', () => {
    expect(splitBlocks('سلام\n\n    const a = 1\n    const b = 2')).toEqual([
      { kind: 'text', lines: ['سلام', ''] },
      { kind: 'code', lines: ['const a = 1', 'const b = 2'] },
    ])
  })

  test('blank lines inside a text block are kept', () => {
    expect(splitBlocks('یک\n\nدو')).toEqual([{ kind: 'text', lines: ['یک', '', 'دو'] }])
  })

  test('the empty string yields no blocks', () => {
    expect(splitBlocks('')).toEqual([])
  })
})
