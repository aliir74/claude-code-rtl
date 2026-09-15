import type { PluginOptions } from 'claude-code'

/** How a paragraph is placed in the viewport once it has been shaped. */
export type Alignment = 'auto' | 'left' | 'right'

/** The mod's settings, every field resolved and clamped. */
export type Settings = {
  alignment: Alignment
  fribidiPath: string
  margin: number
  cacheSize: number
  timeoutMs: number
}

const DEFAULTS: Settings = {
  alignment: 'auto',
  fribidiPath: 'fribidi',
  margin: 4,
  cacheSize: 256,
  timeoutMs: 2000,
}

const ALIGNMENTS: readonly Alignment[] = ['auto', 'left', 'right']

const clamped = (value: unknown, min: number, max: number, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

/**
 * Resolves the plugin's options into complete settings, replacing anything
 * missing or out of range with a default rather than refusing to load.
 */
export function settingsOf(options: PluginOptions): Settings {
  const alignment = options['alignment']
  const path = options['fribidiPath']

  return {
    alignment: ALIGNMENTS.includes(alignment as Alignment)
      ? (alignment as Alignment)
      : DEFAULTS.alignment,
    fribidiPath: typeof path === 'string' && path.length > 0 ? path : DEFAULTS.fribidiPath,
    margin: clamped(options['margin'], 0, 64, DEFAULTS.margin),
    cacheSize: clamped(options['cacheSize'], 1, 4096, DEFAULTS.cacheSize),
    timeoutMs: clamped(options['timeoutMs'], 200, 10000, DEFAULTS.timeoutMs),
  }
}
