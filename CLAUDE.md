# CLAUDE.md

A Claude Code mod (function-hook plugin) that shapes and reorders RTL text in the terminal
transcript by piping it through `fribidi`. User-facing docs are in `README.md`; this file is the
working context for editing the code.

## Commands

Run all four before calling a change done. None of them covers another.

```bash
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .      # 118 tests: hooks + pure logic, fribidi mocked
npx --yes tsx --test harness/*.check.ts                       # 12 tests: the real fribidi binary
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin validate --strict .   # structure: hooks, matchers, $ calls
npx --yes -p typescript@latest tsc -p tsconfig.json           # types
```

`claude plugin validate .` inspects `marketplace.json` when it is present and the plugin manifest
otherwise. To validate the plugin and its hooks, copy the plugin dirs to a temp directory without
`marketplace.json` and validate that.

To run the mod interactively against a real session:

```bash
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .
```

## Architecture

```
text -> hasRtl? -> split blocks -> split markdown prefix -> protect code/URLs
     -> WRAP in logical order -> one fribidi call per direction -> restore -> pad -> Text rows
```

`hooks/register.ts` is the engine adapter and the only file that touches `$`. Everything else is
pure and engine-import-free, which is what makes it testable under `claude plugin test`.

Four `ui.render` hooks. Three of them (`AssistantMessage`, `CommandOutput`, `ToolResult`) return
their own element tree via `draw()`. `UserMessage` is different: it goes through `rewrite()`, which
shapes the text and hands it back through `next()` so the ENGINE draws the row. That is deliberate.
A user row carries a background band and a prompt marker that returning our own tree would discard.

## Things that fail silently

These are the traps. Each one typechecks, passes tests, and then does nothing at runtime, which
looks exactly like the mod not being installed.

- **Elements are never object literals.** They come from `$.ui.resolve(e)`. A `{ type: 'Box' }`
  literal is type-legal and is refused at runtime; the engine then quietly redraws its own row.
- **`$` may only be passed to a function declared at the top level of the file.** `claude plugin
  validate` enforces this so it can report which `$` calls a plugin makes. That is why the helpers
  in `register.ts` are top-level functions taking a `Context` rather than closures.
- **Wrapping happens in logical order, before shaping.** Shaping first and wrapping the visual
  result puts the paragraph's opening words on the last line. `harness/transform-real.check.ts`
  exists to catch exactly that; do not reorder those two steps to simplify the pipeline.
- **fribidi never breaks lines for us.** Its `--width` breaking is not word-aware and splits words
  mid-token. Every call passes `--nobreak`.
- **No raw NUL or private-use characters in source.** Use `String.fromCharCode`. A literal escape
  written through a shell heredoc can land as a real control byte, which makes the file binary and
  makes `grep` silently miss it. `cell-width.ts` uses numeric range arrays rather than regex
  classes for the same reason: a raw U+2028 in a regex literal is a JS line terminator.
- **`userConfig` entries need a `title`.** The manifest schema rejects them otherwise.

## Conventions

- No npm dependencies in `hooks/`, and no Node imports. The hooks environment has no fs, network or
  process. Tests that need the real binary live in `harness/` and are named `*.check.ts`, because
  `claude plugin test` globs the whole plugin directory and refuses a module importing
  `node:child_process`.
- Every hook registration ends in `.catch(($, e, next) => next(e))`. A throw must fall back to the
  engine's own row, never break the transcript.
- Regenerate the type contract after a Claude Code update: `claude -p '/plugin-types'`. Do not
  hand-edit `.claude/types/`.
- Releasing: bump the version in BOTH `.claude-plugin/plugin.json` and the `marketplace.json`
  entry, in sync. The plugin cache is keyed on that string, so an unbumped release never reaches
  anyone who has already installed it.

## Early access

The function-hooks API is early access; the generated types carry Anthropic's own warning that the
surface may change between releases without notice. If something that used to work stops working
after a Claude Code update, regenerate the types and re-read `.claude/types/claude-code.d.ts`
before assuming the bug is here.
