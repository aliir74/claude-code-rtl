# fribidi empirical findings (measured 2026-09-15, GNU FriBidi via Homebrew)
These were measured AFTER the drafter's brief was written. They override any
contrary assumption in brief-facts.md or in the drafted plan.

## 1. fribidi's own line breaking is NOT word-aware — never use it
`fribidi --width 40` on a long Persian paragraph broke the word ستون across two
lines ("ﻥﻮﺘ" / "ﺳ"). Passing long text to fribidi and letting it break is WRONG.
=> ALWAYS pass `--nobreak`. The mod does its own word-aware wrapping.

## 2. Verified-correct pipeline (this is the algorithm to implement)
  a. Take the logical-order source line.
  b. Word-wrap it to the viewport width IN LOGICAL ORDER (our own wrapper).
  c. Feed the wrapped block to ONE fribidi call with `--nobreak`.
     - `--nopad`      => left-aligned output
     - `--width <N>`  => right-justified to N (the RTL-correct look)
  d. fribidi treats each input line independently and preserves line order,
     so one subprocess converts the whole message. Confirmed with a 3-line block.
Measured output (width 40, right-justified) — words intact, order correct:
     ﺭﺩ ﺪﯾﺎﺑ ﻪﮐ ﺖﺳﺍ ﯽﻧﻻ﻿ﻮﻃ ﯽﺳﺭﺎﻓ ﻦﺘﻣ ﮏﯾ ﻦﯾﺍ
  ﯼﺪﯿﺒﯾﺮﻓ ﻢﯿﻨﯿﺒﺑ ﺎﺗ ﺩﻮﺷ ﻪﺘﺴﮑﺷ ﻥﻮﺘﺳ ﻞﻬﭼ ﺽﺮﻋ
                                  ﺪﻨﮐ‌ﯽﻣ ﻪﭼ

## 3. Useful flags (from `fribidi --help`, verified present)
  --nobreak     do not break long lines            <- ALWAYS PASS THIS
  --nopad       do not right justify RTL lines     <- left-align mode
  -w, --width W screen width for padding           <- right-justify mode
  --basedir --novisual   prints "Base direction: R" or "L" and no visual string
                         <- clean way to pick alignment per paragraph
  --rtl / --ltr          force base direction
  --wrtl / --wltr        base direction if no strong char (default --wltr)
  --clean       remove explicit format codes from the visual output
  --reordernsm  reorder NSM sequences to follow their base character
  -c, --charset CS       default UTF-8
NOTE: `--width` also reads the COLUMNS env var when the flag is absent. Always pass
the flag explicitly so the child's inherited environment cannot change the layout.

## 4. Width accounting for the wrapper
Do NOT wrap on `String.length`. The wrapper must use DISPLAY width:
  - ZWNJ U+200C (very common in Persian, e.g. می‌کند) is ZERO width.
  - Combining marks / Arabic diacritics (tashkeel, U+064B-U+065F, U+0670) are zero width.
  - Arabic Presentation Forms (U+FB50-U+FEFF) that fribidi emits are width 1.
  - The existing per-line count must match what Ghostty will actually draw, or
    right-justification padding will be off by the number of zero-width chars.
A small `displayWidth(s)` helper with a zero-width codepoint set is required, and
is itself a good TDD unit.

## 5. Base direction detection
`printf '%s' "$line" | fribidi --basedir --novisual` => "Base direction: R" or "L".
Cheaper alternative for the auto-alignment decision: first strong character wins,
which is the UAX#9 P2/P3 rule. A regex for the first strong RTL vs strong LTR char
avoids a second subprocess. Prefer the regex; keep --basedir as the test oracle.

# Runtime availability findings (measured 2026-09-15 on Claude Code 2.1.272)

## The function-hooks runtime IS present in this build
`strings` on the installed binary
(/Users/aliirani/.local/share/claude/versions/2.1.272, Mach-O arm64, 200.9M):
    CLAUDE_CODE_ENABLE_FUNCTION_HOOKS   5 hits
    functionHooks                     141 hits
    ui.render                          23 hits
    ui.blit                            11 hits
    engine.create                      35 hits
    AssistantMessage                   27 hits
    process.run                        10 hits
    hooks.json                         40 hits
=> The feature is shipped and gated behind the env var, NOT missing. The plan
   should NOT hedge as if the runtime might be absent.

## What is genuinely absent on 2.1.272
`claude plugin --help` (with the flag set) lists: details, disable, enable, eval,
update, ... but NO `test` and no `/plugin-types`. So the mods README's
`claude plugin test <dir>` runner is unavailable. Type declarations must come from
the downloaded mods/types/claude-code.d.ts, and tests from a standalone node
harness. This part of brief-facts.md stands.

## Probe result and how to read it
A minimal plugin with hooks/hooks.json + hooks/register.ts loaded via
`--plugin-dir` produced no error in `claude -p` mode, AND a deliberately
syntactically-broken register.ts ALSO produced no error in `-p` mode.
Do not read this as "hooks do not work". `ui.render` is an interactive-surface
event; `claude -p` has no terminal surface to draw, so render hooks never fire and
the module is never exercised. The correct smoke test is INTERACTIVE:
    CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir <dir>
then send a prompt that makes Claude reply in Persian, and look at the transcript.
This must be done by Ali in a real Ghostty window (a background session cannot
drive the interactive TUI). The plan's final phase should hand him that exact
command rather than claiming the smoke test was run.

# Real API shapes, read from the shipped diff mod's hooks/register.ts
These are copied from Anthropic's own mod source. Prefer them over anything
inferred from the .d.ts alone.

## Hook registration takes a MATCHER as the second argument
    on('ui.render', { component: 'PromptHint' }, ($, e, next) => { ... return next(e) })
    on('ui.render', { component: 'Pane' }, async ($, e, next) => { ... })
So the mod registers one matcher per component:
    on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => ...)
Hooks MAY be async. Always `return next(e)` on the pass-through path.

## Elements are RESOLVED, not written as raw object literals
    const { Box, Text, Button, Select, Code } = await $.ui.resolve(e)
This is the big one. Do NOT hand-build `{ type: 'Box', props: {...}, children: [...] }`.
Destructure the builders from `await $.ui.resolve(e)` and use those. The `.d.ts`
StyledElement shape describes what those builders produce; it is not the authoring
API. Note `Code` is among the resolved builders, which may be the right node for
fenced code blocks that must bypass the bidi pass entirely.

## Viewport field name is confirmed
    columns = e.viewport?.columns ?? columns
=> `e.viewport?.columns` is correct. Guard the undefined case with a fallback
(the diff mod keeps the last known value in a closure variable; do the same,
defaulting to 80 before any viewport has been seen).

## Imports
    import type { On, ResultOf, ... } from 'claude-code'
Type-only imports from the bare specifier 'claude-code'. The tsconfig must map
that specifier to the downloaded claude-code.d.ts via `paths`.

## Structure convention in Anthropic's own mods
One concern per directory under hooks/, each with an index that re-exports, and a
top-level hooks/index.ts doing `export * from './thing'`. Worth mirroring: it keeps
the pure logic modules importable by the standalone node test harness.
