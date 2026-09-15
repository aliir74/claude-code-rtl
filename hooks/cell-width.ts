/**
 * Code points that occupy no terminal cell: combining marks, Arabic
 * diacritics and the harakat, the bidi format controls, ZWJ/ZWNJ, and the
 * U+FEFF filler fribidi emits after a lam-alef ligature.
 *
 * Written as code point numbers rather than a regex class on purpose: the
 * range needs U+2028-U+202E, and a regex literal holding a raw U+2028 is a
 * line break to the parser.
 */
const ZERO_RANGES: readonly (readonly [number, number])[] = [
  [0x0300, 0x036f],
  [0x0483, 0x0489],
  [0x0591, 0x05bd],
  [0x05bf, 0x05bf],
  [0x05c1, 0x05c2],
  [0x05c4, 0x05c5],
  [0x05c7, 0x05c7],
  [0x0610, 0x061a],
  [0x064b, 0x065f],
  [0x0670, 0x0670],
  [0x06d6, 0x06dc],
  [0x06df, 0x06e4],
  [0x06e7, 0x06e8],
  [0x06ea, 0x06ed],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x2064],
  [0xfeff, 0xfeff],
]

/** Code points the terminal draws two cells wide. */
const WIDE_RANGES: readonly (readonly [number, number])[] = [
  [0x1100, 0x115f],
  [0x2e80, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe4f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
]

const within = (code: number, ranges: readonly (readonly [number, number])[]): boolean => {
  for (const range of ranges) {
    if (code >= range[0] && code <= range[1]) return true
  }

  return false
}

/**
 * How many terminal cells the string occupies.
 *
 * This must agree with what the terminal actually draws, because alignment
 * padding is computed from it. Task 3.4 checks it against fribidi's own
 * `--width` padding, which is the independent oracle.
 */
export function cellWidth(s: string): number {
  let width = 0

  for (const char of s) {
    const code = char.codePointAt(0) ?? 0
    if (within(code, ZERO_RANGES)) continue
    if (code >= 0x20000 || within(code, WIDE_RANGES)) {
      width += 2
      continue
    }
    width += 1
  }

  return width
}
