/**
 * The strong-RTL test.
 *
 * The `(?=\p{L})` lookahead is what keeps the Arabic-script DIGITS out:
 * Persian U+06F0-06F9 and Arabic-Indic U+0660-0669 are `\p{Nd}`, not `\p{L}`,
 * so a line of Persian numerals alone is not RTL. A set-difference class would
 * say the same thing but needs the ES2024 `v` flag, which `target: es2023`
 * refuses.
 */
const RTL = /(?=\p{L})[\p{Script=Arabic}\p{Script=Hebrew}]/u

/** Any letter at all, used to find the first strong character of a line. */
const LETTER = /\p{L}/u

/** True when the text holds at least one Arabic or Hebrew letter. */
export function hasRtl(text: string): boolean {
  return RTL.test(text)
}

/**
 * The line's base direction by the UAX #9 first-strong rule: the first letter
 * decides, neutrals before it are skipped, and a line with no letter is `ltr`.
 */
export function baseDirection(line: string): 'rtl' | 'ltr' {
  for (const char of line) {
    if (!LETTER.test(char)) continue
    return RTL.test(char) ? 'rtl' : 'ltr'
  }

  return 'ltr'
}
