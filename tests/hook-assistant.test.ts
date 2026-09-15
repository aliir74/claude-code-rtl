import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

/**
 * Stands in for the fribidi binary, which the hooks environment has no way to
 * run. Reverses each line, which is enough to prove the hook called out and
 * drew what came back. The `--version` probe arrives with no stdin and gets an
 * empty stdout with exit 0, so the availability check passes.
 */
const fakeFribidi = (on: On): void => {
  on('process.run', (_$, e, next) => {
    if (e.argv[0] !== 'fribidi') return next(e)
    const stdin = e.init?.stdin ?? ''
    const stdout = stdin
      .split('\n')
      .map(line => Array.from(line).reverse().join(''))
      .join('\n')
    return { value: { exitCode: 0, stdout, stderr: '' } }
  })
}

/** Every string anywhere in a drawn tree. */
const stringsOf = (node: unknown): string[] => {
  if (typeof node === 'string') return [node]
  if (Array.isArray(node)) return node.flatMap(stringsOf)
  if (node && typeof node === 'object') {
    return Object.values(node as Record<string, unknown>).flatMap(stringsOf)
  }
  return []
}

const reverse = (s: string): string => Array.from(s).reverse().join('')

describe('hook-assistant', () => {
  test('a Persian assistant message is drawn as a shaped column Box', async ($, on) => {
    fakeFribidi(on)

    const tree = await $.ui.render({
      surface: 'terminal',
      component: 'AssistantMessage',
      requestId: 'r1',
      viewport: { columns: 40, rows: 20 },
      props: { text: 'سلام دنیا', isFirstOfReply: true },
    })

    expect(tree).toMatchObject({ type: 'Box' })
    const strings = stringsOf(tree)
    expect(strings.some(s => s.includes(reverse('سلام دنیا')))).toBe(true)
  })

  test('an all-Latin assistant message is left to the engine', async ($, on) => {
    fakeFribidi(on)

    const sentinel = 'SENTINEL-LATIN'
    on('ui.render', { component: 'AssistantMessage' }, ($$, e, next) => {
      void next
      const { Text } = $$.ui.resolve(e)
      return Text({ children: [sentinel] })
    })

    const tree = await $.ui.render({
      surface: 'terminal',
      component: 'AssistantMessage',
      requestId: 'r2',
      viewport: { columns: 40, rows: 20 },
      props: { text: 'the API returns JSON', isFirstOfReply: true },
    })

    expect(stringsOf(tree).includes(sentinel)).toBe(true)
  })

  test('a fribidi failure falls back instead of drawing nothing', async ($, on) => {
    on('process.run', (_$, e, next) => {
      if (e.argv[0] !== 'fribidi') return next(e)
      return { value: { exitCode: 1, stdout: '', stderr: 'boom' } }
    })

    const sentinel = 'SENTINEL-FALLBACK'
    on('ui.render', { component: 'AssistantMessage' }, ($$, e, next) => {
      void next
      const { Text } = $$.ui.resolve(e)
      return Text({ children: [sentinel] })
    })

    const tree = await $.ui.render({
      surface: 'terminal',
      component: 'AssistantMessage',
      requestId: 'r3',
      viewport: { columns: 40, rows: 20 },
      props: { text: 'سلام دنیا', isFirstOfReply: true },
    })

    expect(stringsOf(tree).includes(sentinel)).toBe(true)
  })

  test('a render with no viewport is left to the engine', async ($, on) => {
    fakeFribidi(on)

    const sentinel = 'SENTINEL-NOVIEWPORT'
    on('ui.render', { component: 'AssistantMessage' }, ($$, e, next) => {
      void next
      const { Text } = $$.ui.resolve(e)
      return Text({ children: [sentinel] })
    })

    const tree = await $.ui.render({
      surface: 'terminal',
      component: 'AssistantMessage',
      requestId: 'r4',
      props: { text: 'سلام دنیا', isFirstOfReply: true },
    })

    expect(stringsOf(tree).includes(sentinel)).toBe(true)
  })

  test('a Persian user message is shaped too', async ($, on) => {
    fakeFribidi(on)

    const tree = await $.ui.render({
      surface: 'terminal',
      component: 'UserMessage',
      requestId: 'r5',
      viewport: { columns: 40, rows: 20 },
      props: { text: 'سلام دنیا', origin: { kind: 'composer' } },
    })

    expect(tree).toMatchObject({ type: 'Box' })
    expect(stringsOf(tree).some(s => s.includes(reverse('سلام دنیا')))).toBe(true)
  })

  test('a non-Bash ToolResult is never touched', async ($, on) => {
    fakeFribidi(on)

    const sentinel = 'SENTINEL-NOTBASH'
    on('ui.render', { component: 'ToolResult' }, ($$, e, next) => {
      void next
      const { Text } = $$.ui.resolve(e)
      return Text({ children: [sentinel] })
    })

    const tree = await $.ui.render({
      surface: 'terminal',
      component: 'ToolResult',
      requestId: 'r6',
      viewport: { columns: 40, rows: 20 },
      props: {
        tool_use_id: 't1',
        tool: 'Read',
        output: { stdout: 'سلام دنیا', stderr: '', interrupted: false },
        isErrored: false,
      },
    })

    expect(stringsOf(tree).includes(sentinel)).toBe(true)
  })

  test('a persisted Bash output is left alone rather than shown truncated', async ($, on) => {
    fakeFribidi(on)

    const sentinel = 'SENTINEL-PERSISTED'
    on('ui.render', { component: 'ToolResult' }, ($$, e, next) => {
      void next
      const { Text } = $$.ui.resolve(e)
      return Text({ children: [sentinel] })
    })

    const tree = await $.ui.render({
      surface: 'terminal',
      component: 'ToolResult',
      requestId: 'r7',
      viewport: { columns: 40, rows: 20 },
      props: {
        tool_use_id: 't2',
        tool: 'Bash',
        output: {
          stdout: 'سلام دنیا',
          stderr: '',
          interrupted: false,
          persistedOutputPath: '/tmp/out.txt',
        },
        isErrored: false,
      },
    })

    expect(stringsOf(tree).includes(sentinel)).toBe(true)
  })
})
