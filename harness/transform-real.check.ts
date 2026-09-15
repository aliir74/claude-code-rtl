// The full transform over the REAL fribidi binary. Needs a subprocess, so it
// runs under `npx --yes tsx --test harness/*.check.ts`, not `claude plugin test`.
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { cellWidth } from '../hooks/cell-width'
import { fribidiArgv, packStdin, unpackStdout } from '../hooks/fribidi-args'
import type { Shaper } from '../hooks/transform'
import { transformText } from '../hooks/transform'

const available = spawnSync('fribidi', ['--version'], { encoding: 'utf8' }).status === 0

const realShaper: Shaper = async (lines, dir) => {
  const argv = fribidiArgv(dir, 'fribidi')
  const result = spawnSync(argv[0] as string, argv.slice(1), {
    input: packStdin(lines),
    encoding: 'utf8',
  })
  const out = unpackStdout(result.stdout, lines.length)
  if (!out) throw new Error('fribidi returned a different number of lines')
  return out
}

const PARAGRAPH =
  'این یک متن فارسی طولانی است برای تست. ' +
  'قیمت را با `getPrice()` بگیر و بعد برو به https://example.com/a?b=c . ' +
  'خط سوم هم فارسی است و باید درست شکسته شود.'

/** The first logical word of the paragraph, shaped on its own. */
const shapedFirstWord = async (): Promise<string> => {
  const [only] = await realShaper(['این'], 'rtl')
  return only as string
}

test('every produced line fits the viewport', { skip: !available }, async () => {
  const out = await transformText(
    PARAGRAPH,
    { columns: 30, alignment: 'auto', markdown: true },
    realShaper,
  )
  assert.ok(out)
  for (const line of out) {
    if (line.kind === 'text') {
      assert.ok(
        cellWidth(line.text) <= 30,
        'line too wide (' + String(cellWidth(line.text)) + '): ' + line.text,
      )
    }
  }
})

test(
  'the paragraph STARTS on line 1: the reverse-then-wrap regression',
  { skip: !available },
  async () => {
    // If the implementation ever shapes before wrapping, the paragraph's first
    // word lands on the LAST line instead of the first. In a right-to-left
    // visual line the logical first word sits at the RIGHT end.
    const out = await transformText(
      PARAGRAPH,
      { columns: 30, alignment: 'auto', markdown: true },
      realShaper,
    )
    assert.ok(out)
    const first = out.find(line => line.kind === 'text' && line.text.trim() !== '')
    assert.ok(first && first.kind === 'text')

    const runs = first.text.trim().split(' ')
    const rightmost = runs[runs.length - 1] as string
    assert.equal(
      rightmost,
      await shapedFirstWord(),
      'the first visual line does not start the paragraph; got line: ' + first.text,
    )
  },
)

test('an inline code span and a URL come back byte-identical', { skip: !available }, async () => {
  const out = await transformText(
    PARAGRAPH,
    { columns: 30, alignment: 'auto', markdown: true },
    realShaper,
  )
  assert.ok(out)
  const joined = out.map(line => (line.kind === 'text' ? line.text : line.source)).join('\n')
  assert.ok(joined.includes('`getPrice()`'), 'the inline code span was mangled')
  assert.ok(joined.includes('https://example.com/a?b=c'), 'the URL was mangled')
})

test('a bullet marker stays at the line start', { skip: !available }, async () => {
  const out = await transformText(
    '- سلام دنیا',
    { columns: 30, alignment: 'left', markdown: true },
    realShaper,
  )
  assert.ok(out)
  const first = out[0]
  assert.ok(first && first.kind === 'text')
  assert.ok(first.text.startsWith('- '), 'bullet was moved: ' + first.text)
})
