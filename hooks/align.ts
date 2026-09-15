import { cellWidth } from './cell-width'
import type { Alignment } from './options'

/**
 * Pads a shaped line so it sits where an RTL reader expects it.
 *
 * Padding is done here rather than with fribidi's `--width` because the
 * choice is per line: `auto` right-aligns only the lines whose own base
 * direction is RTL, and fribidi has no way to express that. Padding is never
 * negative, so a line wider than the viewport is returned untouched.
 */
export function padLine(
  visual: string,
  width: number,
  alignment: Alignment,
  dir: 'rtl' | 'ltr',
): string {
  const right = alignment === 'right' || (alignment === 'auto' && dir === 'rtl')
  if (!right) return visual

  const pad = width - cellWidth(visual)
  if (pad <= 0) return visual

  return ' '.repeat(pad) + visual
}
