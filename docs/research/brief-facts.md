# Verified facts (do not re-derive; treat as ground truth)

## Goal
A Claude Code "mod" (function-hook plugin) that makes Persian/RTL text render correctly
in the Ghostty terminal transcript. Ghostty 1.3.2 has no UAX#9 bidi and no Arabic
shaping, so Persian currently appears reversed and with unjoined letters.

## Project location
~/Downloads/Coding/claude-mod-bidi/   (does not exist yet; create it)
Git repo, branch `main` is fine to create; this is NOT the Obsidian vault, so normal
feature-branch rules apply only if a PR is intended (it is not — no remote).

## Type contract (already downloaded, READ IT)
~/.claude/jobs/caea74f1/tmp/claude-code.d.ts   (10736 lines)
This is mods/types/claude-code.d.ts from github.com/anthropics/claude-code.

## Verified API facts
- Hook signature: `($, e, next)`, Express/Koa middleware. Entry is
  `register(on, options)`.
- Plugin layout (copied from the shipped `diff` mod):
    .claude-plugin/plugin.json   {name, version, description, author}
    hooks/hooks.json             {description, modules: ["./register.ts"]}
    hooks/*.ts                   raw TypeScript, loaded directly
  There is NO package.json and NO node_modules in the shipped mods. Hooks modules
  are self-contained TS using only the `$` surface. => Do NOT plan on npm deps.
- `ui.render` is the render event. RenderComponent union is exactly:
  'AskUserQuestion' | 'UserMessage' | 'AssistantMessage' | 'ToolUse' | 'ToolResult'
  | 'ToolGroup' | 'CommandOutput' | 'Spinner' | 'TurnDuration' | 'InfoNotice'
  | 'SessionMode' | 'PromptHint' | 'AbovePrompt' | 'Pane'
- RenderInputOf gives the hook: { surface, component, requestId, viewport?, props }
  - `viewport?: RenderViewport` — "the interactive screen's size"; a width change
    re-draws every hooked site once the resize settles. Look up RenderViewport's
    exact field name in the d.ts (do not guess `columns`).
  - AssistantMessage props: { text: string; isFirstOfReply: boolean }
    `text` is markdown, "as the transcript will draw it" — i.e. BEFORE layout/wrap.
  - UserMessage props: { text: string; origin: PromptOrigin }  (origin is read-only;
    a rewrite must carry it through unchanged or the row is refused)
  - ToolResult / CommandOutput / ToolUse props: LOOK THEM UP in the d.ts.
- A hook rewrites via `next({ ...e, props })`, or returns a RenderElement tree.
  "A rewrite is validated by the component and an invalid one draws the original."
- RenderElement = StyledElement<'Box'|'Text'> | Button | Input | Select | Raster ...
    StyledElement = { type: 'Box'|'Text', props?: Record<string,string|number|boolean>,
                      hover?, group?, children?: RenderNode[] }
    RenderNode = RenderElement | string
    "a Box holds elements and strings (core wraps each string in a Text);
     a Text holds strings and inline elements"
  TextProps: color, backgroundColor, dimColor, bold, italic, underline,
             strikethrough, inverse, wrap ('wrap'|'end'|'middle'|'truncate'|
             'truncate-start'|'truncate-middle'|'truncate-end')
  Props outside the allowlist fail validation for the WHOLE tree.
- `$.process.run({ argv: readonly string[], init?: { cwd?, env?, stdin?, timeoutMs? } })`
  resolves to { exitCode: number, stdout: string, stderr: string }.
  Default timeout 30s. This is how we call fribidi.
- `ui.blit` is NOT usable here: it repaints a Raster the PLUGIN itself drew
  (requestId is "one of its panes' ids"), never engine transcript rows.
  => after-layout bidi is not available; the mod must do its own wrapping.
- `ui.input` fires only for an `Input` element a render hook drew, not the main
  composer. => typing Persian in the prompt box is OUT OF SCOPE, state this.
- `$.clock`, `$.store`, `$.env` exist (see mock.clock/store/env in mods/README).
  Check the d.ts for `settings`/`config` access for the mod's options.

## fribidi (verified on this machine, Homebrew)
- `fribidi` IS installed and DOES both bidi reordering AND Arabic shaping:
  `printf 'سلام دنیا' | fribidi --nopad` emits Arabic Presentation Forms
  (ﺳ ﻼ ﻡ - initial/medial/final joined shapes) in visual order.
- Default output is RIGHT-PADDED to --width 80. `--nopad` disables padding.
- `-w, --width W` sets the width used for padding => this is the right-alignment
  lever: pass the viewport width to right-align RTL paragraphs.
- Flags to check with `fribidi --help` before using: --nopad, --width, --charset,
  --rtl, --ltr, --showinput, --reordernsm.
- fribidi processes stdin LINE BY LINE => one subprocess can convert MANY lines
  in a single call. Exploit this: never spawn per line.

## Settled design decisions (do not re-litigate; build these)
1. Shaping engine = fribidi via `$.process.run`, NOT a vendored JS bidi library.
   Reason: mods have no npm deps, and fribidi is already installed and correct.
2. Batching + caching are REQUIRED, not optional. A render hook re-runs on every
   resize and re-draw. Plan: one fribidi call per message render carrying all its
   lines, plus a bounded LRU cache keyed on (text, width). Include a cache-size cap.
3. The mod must WRAP TEXT ITSELF against the viewport width before shaping,
   because props.text is pre-layout markdown. Reverse-then-let-Ink-wrap is the
   central bug to avoid: it puts the paragraph's start on the last line.
   Emit one Text node per visual line inside a Box (flexDirection column).
4. Fast path: if the text contains no RTL codepoints, return `next(e)` untouched.
   Cheap regex on the Arabic/Hebrew/Persian ranges. This keeps English sessions
   at zero cost and is the single most important correctness+perf guard.
5. Segmentation — these must NOT go through fribidi:
   - fenced code blocks (``` ... ```) and indented code blocks
   - inline code spans (`...`)
   - URLs
   - runs of pure-Latin/ASCII
   Persian runs get shaped; everything else passes through verbatim, and the
   segments are recombined in the correct visual order per line.
6. Alignment is a mod SETTING, default "auto": paragraphs whose base direction is
   RTL get right-aligned to the viewport width; LTR paragraphs stay left.
   Other values: "left" (shape+reorder only, no padding), "right" (always).
7. Components hooked: AssistantMessage, UserMessage, ToolResult, CommandOutput.
   All four route through ONE shared transform module. ToolUse is optional/stretch.
8. Markdown structure must survive: list bullets, headings, blockquote markers and
   table pipes stay at the logical line start and must not be swept into the
   reversed run. Treat the leading markdown marker as a prefix, shape the remainder.

## Environment / verification constraints
- Installed Claude Code is 2.1.272.
- Function hooks are gated behind `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`.
- VERIFIED ABSENT on this build even with the flag set: `claude plugin test` and
  `/plugin-types`. So the mods README's test runner is NOT available.
  => The plan MUST NOT contain a step that runs `claude plugin test`.
- Therefore verification is:
  (a) `npx --yes typescript@latest tsc --noEmit` against a tsconfig that includes
      the downloaded claude-code.d.ts, and
  (b) a STANDALONE Node harness (node v22.19.0, `npx --yes tsx`) that imports the
      pure functions (segmenter, wrapper, cache, fribidi-arg builder) and asserts
      on them with real Persian strings, using node:test + node:assert.
      The pure functions must therefore live in modules that do NOT import the
      engine, so the harness can load them without a running Claude Code.
  (c) a manual smoke step: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir
      ~/Downloads/Coding/claude-mod-bidi` and eyeball a Persian reply
      in Ghostty. This may fail if the runtime has not shipped to 2.1.272 — the plan
      must treat that as an EXPECTED possible outcome with a documented fallback,
      not a blocker that invalidates the work.
- Use real Persian test strings, e.g. سلام دنیا / این یک متن فارسی است برای تست
  and a mixed one like: قیمت ۱۲۰ دلار است و the API returns JSON.

## Hard constraints on the plan itself
- Every task's `steps` must contain an explicit `Verify:` step naming a command and
  its expected output/exit code. Never "Verify: confirm it works".
- Last task of every phase is a verification checkpoint (id like "1.V").
- TDD is ON (`"tdd": true`): the segmenter/wrapper are pure functions, so each
  implementation task is Write failing test -> Implement -> Verify -> Commit.
- Prefer many small tasks over few large ones.
- Commit messages end with:
    Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
