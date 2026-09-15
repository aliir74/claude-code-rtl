// Real-binary tests. These need a process, which the `claude plugin test`
// environment does not have, so they run under:
//   npx --yes tsx --test harness/*.test.ts
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { cellWidth } from '../hooks/cell-width'
import { fribidiArgv, packStdin, unpackStdout } from '../hooks/fribidi-args'

const run = (argv: string[], stdin: string): string => {
  const [command, ...args] = argv
  const result = spawnSync(command as string, args, { input: stdin, encoding: 'utf8' })
  assert.equal(result.status, 0, 'fribidi exited ' + String(result.status) + ': ' + result.stderr)
  return result.stdout
}

const SAMPLES = [
  'سلام دنیا',
  'می‌کند',
  'مَدرسه',
  'قیمت ۱۲۰ دلار است و the API returns JSON',
]

test('fribidi is installed and reports a version', () => {
  const result = spawnSync('fribidi', ['--version'], { encoding: 'utf8' })
  assert.equal(result.status, 0)
  assert.match(result.stdout + result.stderr, /fribidi/i)
})

test('cellWidth agrees with fribidi --width, the independent oracle', () => {
  // fribidi's own padding is display-cell accurate. If our cellWidth agrees
  // with it on shaped output, our alignment padding will land correctly.
  for (const sample of SAMPLES) {
    const stdout = run(['fribidi', '--nobreak', '--reordernsm', '--rtl', '--width', '40'], sample + '\n')
    const line = stdout.replace(/\n$/, '').replace(/\s+$/, '')
    assert.equal(
      cellWidth(line),
      40,
      'cellWidth disagreed with fribidi --width 40 on: ' + sample + ' -> got ' + String(cellWidth(line)),
    )
  }
})

test('shaping produces Arabic presentation forms', () => {
  const stdout = run(fribidiArgv('rtl', 'fribidi'), packStdin(['سلام دنیا']))
  const lines = unpackStdout(stdout, 1)
  assert.ok(lines)
  const shaped = lines[0] as string
  // U+FB50-U+FEFF is the Arabic Presentation Forms range.
  assert.match(shaped, /[ﭐ-﻿]/, 'no presentation forms in: ' + shaped)
})

test('the line count is preserved, N in N out', () => {
  const input = ['سلام دنیا', 'قیمت ۱۲۰ دلار است و the API returns JSON', 'خداحافظ']
  const stdout = run(fribidiArgv('rtl', 'fribidi'), packStdin(input))
  const lines = unpackStdout(stdout, input.length)
  assert.ok(lines, 'unpackStdout refused the output')
  assert.equal(lines.length, 3)
})

test('a pure-Latin line comes back byte-identical', () => {
  const stdout = run(fribidiArgv('ltr', 'fribidi'), packStdin(['the API returns JSON']))
  const lines = unpackStdout(stdout, 1)
  assert.ok(lines)
  assert.equal(lines[0], 'the API returns JSON')
})

test('ZWNJ survives shaping and keeps the letters unjoined', () => {
  const stdout = run(fribidiArgv('rtl', 'fribidi'), packStdin(['می‌کند']))
  const lines = unpackStdout(stdout, 1)
  assert.ok(lines)
  assert.ok((lines[0] as string).includes('‌'), 'ZWNJ was lost')
})
