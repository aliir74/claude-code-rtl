import type {
  BuiltinToolResults,
  EngineInterface,
  On,
  PluginOptions,
  RenderComponent,
  RenderElement,
  RenderInput,
} from 'claude-code'

import { cellWidth } from './cell-width'
import { fribidiArgv, packStdin, unpackStdout } from './fribidi-args'
import { LruCache } from './lru-cache'
import type { Settings } from './options'
import { settingsOf } from './options'
import { baseDirection } from './rtl-detect'
import type { Gutter } from './render-tree'
import { treeOf } from './render-tree'
import type { RenderLine, Shaper } from './transform'
import { transformText } from './transform'

/**
 * Separates the cache key's fields. A NUL can never appear in a rendered
 * message, so no text can forge a key boundary. Built with fromCharCode
 * rather than written as an escape: an editor would otherwise put a raw
 * NUL in this file and make it a binary file to grep and friends.
 */
const KEY_SEPARATOR = String.fromCharCode(0)

/** A terminal render event, the only surface this mod draws on. */
type TerminalRender = RenderInput<RenderComponent, 'terminal'>

/** What `next` is, once narrowed to the terminal render input. */
type Next = (e: TerminalRender) => Promise<RenderElement> | RenderElement

/**
 * Everything the hooks share.
 *
 * The helpers below are top-level function declarations taking this as a
 * parameter rather than closures inside `register`. That is not a style
 * choice: `claude plugin validate` refuses a module that passes `$` to
 * anything but a function declared at the top of the file, so it can see
 * statically which `$` calls a plugin makes.
 */
type Context = {
  settings: Settings
  cache: LruCache<RenderLine[]>
  logged: Set<string>
  disabled: boolean
  probed: Promise<boolean> | null
}

/**
 * Logs a line once and only once.
 *
 * `$.ui.log` appends to the transcript, and render hooks re-run on every
 * redraw and resize, so an undeduplicated log would append a row per frame,
 * and each row is itself new transcript content.
 */
function note($: EngineInterface, ctx: Context, msg: string): void {
  if (ctx.logged.has(msg)) return
  ctx.logged.add(msg)
  $.ui.log('bidi: ' + msg)
}

/** Runs one fribidi call per batch of lines sharing a base direction. */
function shaperOf($: EngineInterface, ctx: Context): Shaper {
  return async (lines, dir) => {
    const { exitCode, stdout, stderr } = await $.process.run(
      fribidiArgv(dir, ctx.settings.fribidiPath),
      { stdin: packStdin(lines), timeoutMs: ctx.settings.timeoutMs },
    )
    if (exitCode !== 0) throw new Error(stderr)

    const out = unpackStdout(stdout, lines.length)
    if (!out) throw new Error('fribidi line count mismatch')

    return out
  }
}

/** One-shot check that fribidi can actually run; failure disables the mod. */
async function probe($: EngineInterface, ctx: Context): Promise<boolean> {
  try {
    const { exitCode } = await $.process.run([ctx.settings.fribidiPath, '--version'], {
      timeoutMs: ctx.settings.timeoutMs,
    })
    if (exitCode === 0) return true
  } catch {
    // fall through to disabling
  }

  ctx.disabled = true
  note($, ctx, 'fribidi not runnable at ' + ctx.settings.fribidiPath + '; RTL shaping disabled')

  return false
}

/**
 * Shapes `text` and returns the tree to draw, or null to leave the engine's
 * own row alone.
 *
 * `columns` is passed separately from `e` because `viewport` is optional on
 * the render input: each hook does its own `!e.viewport` guard, which makes
 * reading `e.viewport.columns` legal there but not in here.
 */
async function render(
  $: EngineInterface,
  ctx: Context,
  e: TerminalRender,
  columns: number,
  text: string,
  markdown: boolean,
  gutter?: Gutter,
): Promise<RenderElement | null> {
  const lead = gutter ? cellWidth(gutter.first) : 0
  const width = Math.max(1, columns - ctx.settings.margin - lead)
  const key = [String(markdown), String(width), text].join(KEY_SEPARATOR)

  let lines = ctx.cache.get(key)

  if (lines === undefined) {
    const shaped = await transformText(
      text,
      { columns: width, alignment: ctx.settings.alignment, markdown },
      shaperOf($, ctx),
    )
    if (shaped === null) return null
    ctx.cache.set(key, shaped)
    lines = shaped
  }

  const t = await $.ui.resolve(e)

  return treeOf(lines, t, gutter)
}

/**
 * The shared hook body: bail out on anything this mod does not handle, then
 * draw. Any throw is caught by the registration's own `.catch`, which falls
 * back to the engine's own row.
 */
async function draw(
  $: EngineInterface,
  ctx: Context,
  e: TerminalRender,
  next: Next,
  text: string,
  markdown: boolean,
  gutter?: Gutter,
): Promise<RenderElement> {
  if (ctx.disabled || e.surface !== 'terminal' || !e.viewport) return next(e)
  if (!(await (ctx.probed ??= probe($, ctx)))) return next(e)

  const tree = await render($, ctx, e, e.viewport.columns, text, markdown, gutter)

  return tree ?? next(e)
}

/**
 * The reply marker, drawn only on the block that opens a reply.
 *
 * Returning our own tree replaces the engine's entire row, marker included, so
 * successive replies run together unless we draw it ourselves. It sits on the
 * edge the text starts from: on the right for a right-aligned RTL reply, where
 * a left-hand marker would sit at the END of the sentence and read as noise.
 * Set `replyBullet` to an empty string to turn it off.
 */
function gutterFor(settings: Settings, isFirstOfReply: boolean, dir: 'rtl' | 'ltr'): Gutter | undefined {
  if (settings.replyBullet === '') return undefined

  const right = settings.alignment === 'right' || (settings.alignment === 'auto' && dir === 'rtl')
  const mark = right ? ' ' + settings.replyBullet : settings.replyBullet + ' '
  const width = cellWidth(mark)

  return {
    first: isFirstOfReply ? mark : ' '.repeat(width),
    rest: ' '.repeat(width),
    side: right ? 'right' : 'left',
  }
}

/** The shaped lines as one string, for handing back to the engine's own row. */
function shapedTextOf(lines: RenderLine[]): string {
  return lines.map(line => (line.kind === 'code' ? line.source : line.text)).join('\n')
}

/**
 * Shapes the text and hands it back through `next`, so the ENGINE draws the
 * row.
 *
 * Used where the engine's own styling is the point: a user message carries a
 * background band and a prompt marker that an own tree would throw away. The
 * cost is that the engine may re-wrap, so the text is shaped to a width with
 * room to spare and every line comes back shorter than the engine's own limit.
 */
async function rewrite(
  $: EngineInterface,
  ctx: Context,
  e: TerminalRender,
  next: Next,
  text: string,
  markdown: boolean,
): Promise<RenderElement> {
  if (ctx.disabled || e.surface !== 'terminal' || !e.viewport) return next(e)
  if (!(await (ctx.probed ??= probe($, ctx)))) return next(e)

  // Extra slack beyond `margin`: the engine indents its own row, and a line
  // that overflows would be re-wrapped, which is what undoes the bidi order.
  const width = Math.max(1, e.viewport.columns - ctx.settings.margin - 4)
  const key = ['rw', String(markdown), String(width), text].join(KEY_SEPARATOR)

  let lines = ctx.cache.get(key)

  if (lines === undefined) {
    const shaped = await transformText(
      text,
      { columns: width, alignment: ctx.settings.alignment, markdown },
      shaperOf($, ctx),
    )
    if (shaped === null) return next(e)
    ctx.cache.set(key, shaped)
    lines = shaped
  }

  return next({ ...e, props: { ...e.props, text: shapedTextOf(lines) } } as TerminalRender)
}

export function register(on: On, options: PluginOptions): void {
  const settings = settingsOf(options)

  const ctx: Context = {
    settings,
    cache: new LruCache<RenderLine[]>(settings.cacheSize),
    logged: new Set<string>(),
    disabled: false,
    probed: null,
  }

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) =>
    draw(
      $,
      ctx,
      e as TerminalRender,
      next as Next,
      e.props.text,
      true,
      gutterFor(ctx.settings, e.props.isFirstOfReply, baseDirection(e.props.text)),
    ),
  ).catch(($, e, next) => next(e))

  // A user row is handed back to the engine rather than drawn here: it carries
  // a background band and a prompt marker that an own tree would discard.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) =>
    rewrite($, ctx, e as TerminalRender, next as Next, e.props.text, true),
  ).catch(($, e, next) => next(e))

  on('ui.render', { component: 'CommandOutput' }, async ($, e, next) =>
    draw($, ctx, e as TerminalRender, next as Next, e.props.text, false),
  ).catch(($, e, next) => next(e))

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.props.tool !== 'Bash') return next(e)

    const out = e.props.output as BuiltinToolResults['Bash'] | null
    // A large Bash output lives in a file; redrawing stdout would present a
    // truncated view as though it were the whole thing.
    if (!out || out.persistedOutputPath) return next(e)

    return draw($, ctx, e as TerminalRender, next as Next, out.stdout, false)
  }).catch(($, e, next) => next(e))
}
