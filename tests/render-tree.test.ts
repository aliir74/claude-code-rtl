import { describe, expect, test } from 'claude-code/testing'

import type { DrawTable } from '../hooks/render-tree'
import { treeOf } from '../hooks/render-tree'

const TEXT_PROPS = [
  'color',
  'backgroundColor',
  'dimColor',
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'inverse',
  'wrap',
]

/** A stand-in for the surface's table: records the props it was handed. */
const fakeTable = (): DrawTable => {
  const split = (props: Record<string, unknown>) => {
    const { children, ...rest } = props
    return { rest, children }
  }
  return {
    Box: props => {
      const { rest, children } = split(props as Record<string, unknown>)
      return { type: 'Box', props: rest, children } as never
    },
    Text: props => {
      const { rest, children } = split(props as Record<string, unknown>)
      return { type: 'Text', props: rest, children } as never
    },
    Code: props => {
      const { rest } = split(props as Record<string, unknown>)
      return { type: 'Code', props: rest } as never
    },
  } as DrawTable
}

const asAny = (value: unknown): Record<string, never> => value as Record<string, never>

describe('render-tree', () => {
  test('the root is a column Box', () => {
    const tree = asAny(treeOf([{ kind: 'text', text: 'سلام' }], fakeTable()))
    expect(tree['type']).toBe('Box')
    expect(asAny(tree['props'])['flexDirection']).toBe('column')
  })

  test('each text line is a truncating Text carrying the line', () => {
    const tree = asAny(treeOf([{ kind: 'text', text: 'سلام' }], fakeTable()))
    const first = asAny(asAny(tree['children'])[0])
    expect(first['type']).toBe('Text')
    expect(asAny(first['props'])['wrap']).toBe('truncate-end')
    expect(first['children']).toEqual(['سلام'])
  })

  test('a blank line draws a space so the row does not collapse', () => {
    const tree = asAny(treeOf([{ kind: 'text', text: '' }], fakeTable()))
    expect(asAny(asAny(tree['children'])[0])['children']).toEqual([' '])
  })

  test('a code block becomes a Code element with its language', () => {
    const tree = asAny(
      treeOf([{ kind: 'code', source: 'const a = 1', language: 'ts' }], fakeTable()),
    )
    const first = asAny(asAny(tree['children'])[0])
    expect(first['type']).toBe('Code')
    expect(asAny(first['props'])['source']).toBe('const a = 1')
    expect(asAny(first['props'])['language']).toBe('ts')
  })

  test('language is absent, not undefined, when the fence had none', () => {
    const tree = asAny(treeOf([{ kind: 'code', source: 'raw' }], fakeTable()))
    const props = asAny(asAny(asAny(tree['children'])[0])['props'])
    expect(Object.prototype.hasOwnProperty.call(props, 'language')).toBe(false)
  })

  test('an over-long code block falls back to plain rows', () => {
    const source = 'x'.repeat(10001)
    const tree = asAny(treeOf([{ kind: 'code', source }], fakeTable()))
    expect(asAny(asAny(tree['children'])[0])['type']).toBe('Text')
  })

  test('a gutter marks the first line and indents the rest', () => {
    const tree = asAny(
      treeOf(
        [
          { kind: 'text', text: 'alpha' },
          { kind: 'text', text: 'beta' },
        ],
        fakeTable(),
        { first: 'B ', rest: '  ' },
      ),
    )
    const rows = tree['children'] as unknown as Record<string, unknown>[]
    expect((rows[0]?.['children'] as string[])[0]).toBe('B alpha')
    expect((rows[1]?.['children'] as string[])[0]).toBe('  beta')
  })

  test('every Text prop is in the allowlist', () => {
    const tree = asAny(
      treeOf([{ kind: 'text', text: 'a' }, { kind: 'text', text: '' }], fakeTable()),
    )
    for (const child of tree['children'] as unknown as Record<string, unknown>[]) {
      if (child['type'] !== 'Text') continue
      for (const key of Object.keys(child['props'] as object)) {
        expect(TEXT_PROPS.includes(key)).toBe(true)
      }
    }
  })
})
