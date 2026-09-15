/** The base direction forced on a run of lines. */
export type Direction = 'rtl' | 'ltr'

/** The U+FEFF filler fribidi emits after a lam-alef ligature. */
const FILLER = String.fromCharCode(0xfeff)

/**
 * The argv for one fribidi call.
 *
 * `--nopad` because alignment padding is done in TypeScript: fribidi's own
 * `--width` padding is display-cell accurate, but it cannot express a
 * per-line `auto` alignment or a base direction chosen from the whole logical
 * line. `--nobreak` because fribidi's line breaking is NOT word-aware and
 * will split a word mid-token. `--reordernsm` puts non-spacing marks after
 * their base character.
 */
export function fribidiArgv(direction: Direction, path: string): string[] {
  return [path, '--nopad', '--nobreak', '--reordernsm', '--' + direction]
}

/** One line per input line; fribidi converts each independently. */
export function packStdin(lines: string[]): string {
  return lines.length === 0 ? '' : lines.map(line => line + '\n').join('')
}

/**
 * Parses fribidi's stdout back into lines, returning null when the line count
 * does not match what was sent. A mismatch means fribidi broke or merged a
 * line, which would silently corrupt the transcript, so the caller falls back
 * to the unshaped text rather than drawing something wrong.
 */
export function unpackStdout(stdout: string, expected: number): string[] | null {
  const body = stdout.endsWith('\n') ? stdout.slice(0, -1) : stdout
  const lines = body.split('\n').map(line => {
    const withoutCr = line.endsWith('\r') ? line.slice(0, -1) : line
    return withoutCr.split(FILLER).join('')
  })

  return lines.length === expected ? lines : null
}
