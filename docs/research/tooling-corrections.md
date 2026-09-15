# TOOLING CORRECTIONS — measured 2026-09-15 on Claude Code 2.1.272
These OVERRIDE brief-facts.md, fribidi-findings.md, and the drafted plan wherever
they conflict. Three commands the earlier briefs called absent are in fact present.
All three were run on this machine; the transcripts are below.

## 1. `claude plugin validate <dir>` EXISTS — use it as the primary structural verify
It parses register.ts, lists the hooks each module registers with their matchers,
lists the `$` calls the module makes, and sets a real exit code.

    $ CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin validate <good-dir>
    Validating plugin manifest: <dir>/.claude-plugin/plugin.json
    Validating hooks: <dir>/hooks/hooks.json
      > ./register.ts hooks: ui.render
      > ./register.ts calls: nothing on $
    ✔ Validation passed
    rc=0

    $ CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin validate <broken-dir>
    ✘ Found 1 error:
      > modules../register.ts: <dir>/hooks/register.ts does not parse:
        Expected ";" but found "is" (line 1, column 6); ...
    ✘ Validation failed
    rc=1

Exit codes confirmed separately with output redirected (a pipe to `head` masks
them, so verify steps must NOT pipe before reading `$?`):
    broken rc=1
    good   rc=0
=> Replace every "grep stderr for the absence of an error" verify with this.
   As hooks are added, the `hooks:` line grows and can be asserted against, e.g.
   `ui.render{component=AssistantMessage}`.

## 2. `/plugin-types` EXISTS and runs headless — regenerate, do not copy the old d.ts
    $ cd <project> && CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude -p '/plugin-types'
    Wrote <project>/.claude/types/claude-code.d.ts: the plugin API ... and 30 built-in tools.
    Wrote <project>/.claude/types/claude-code-plugins.d.ts: ...
    Wrote <project>/.claude/types/claude-code-mcp.d.ts: 9 MCP tools from 1 server.
The generated file is 10922 lines and its first line is
    // Written by Claude Code 2.1.272.
versus the 10736-line 2.1.271 copy in the job tmp dir.
=> Task 1.2 must RUN this, not `cp` from /Users/aliirani/.claude/jobs/... (which is
   deleted with the job). Verify with `head -1 .claude/types/claude-code.d.ts`.

## 3. `claude plugin test <dir>` EXISTS — it is simply hidden from `claude plugin --help`
The earlier "absent" conclusion came from grepping `--help`. Running it directly works:
    $ CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test <dir-with-no-tests>
    claude plugin test: no *.test.ts or *.test.tsx under <dir>
and with a real test file:
    tests/smoke.test.ts:
    (pass) smoke > a render hook can rewrite AssistantMessage text [0.84ms]
     1 pass
     0 fail
    Ran 1 test across 1 file. [0.17s]
Valid `tier()` values are exactly: 'prepend' | 'user' | 'append' | 'builtin'.
`tier('local')` is rejected with: "the tier is 'prepend', 'user', 'append' or 'builtin'".
Test files live under `tests/` and import from 'claude-code/testing'
(describe, expect, test, tier, mock).

### Consequence for the plan's test strategy — TWO runners, each for what it can do
The d.ts header states a hooks module and its tests run "in an environment like the
one a plugin's hooks run in (no fs, network or process)".
  - `claude plugin test`  -> hook wiring, matchers, tree shape, catch behaviour,
      options parsing, and every PURE function. Uses the engine's own `$` plus
      `mock.clock/store/env`; `$.process.run` is answered by a hook the test
      registers, so fribidi is MOCKED here. This is the primary runner.
  - `npx --yes tsx --test harness/*.test.ts` -> the REAL-fribidi integration tests
      only (argv builder against the real binary, cell-width vs fribidi's own
      --width oracle, the full transform end-to-end). These need a real process
      and therefore cannot run under `claude plugin test`.
Keep the pure modules engine-import-free so BOTH runners can load them.

## 4. Element authoring — settled by the official d.ts header, not inference
The 2.1.272 header says verbatim:
    // The elements a render hook draws with (`Box`, `Text`,
    // `Button`, ...) are not globals: they come from the surface's table,
    //   const { Box, Text } = $.ui.resolve(e)
Note it is written WITHOUT `await` (the shipped diff mod awaits it; `await` on a
non-promise is harmless, so either compiles). Hand-built `{type:'Box'}` literals
are the blocker the validator identified — they are type-legal and tsc will never
catch them.

JSX IS AVAILABLE: the header declares `h` and `Fragment` as globals a hooks module
has, with `"jsx": "react", "jsxFactory": "h", "jsxFragmentFactory": "Fragment"`.
So a render hook may be written as JSX in a .tsx module. Prefer the destructured
table form to match the shipped mod; JSX is a legitimate alternative, not required.

## 5. The exact tsconfig, quoted from the d.ts header (use this verbatim in task 1.2)
    {
      "compilerOptions": {
        "target": "es2023", "lib": ["es2023"], "types": [],
        "module": "esnext", "moduleResolution": "bundler",
        "strict": true, "noUncheckedIndexedAccess": true,
        "noEmit": true, "skipLibCheck": true,
        "jsx": "react", "jsxFactory": "h", "jsxFragmentFactory": "Fragment"
      },
      "include": [".claude/types", "hooks", "tests"]
    }
Note `"include"` carries `tests` too. The d.ts is an ambient
`declare module 'claude-code'`, so NO `paths` entry is needed.
The standalone `harness/` folder must stay OUT of this include (it imports
node:test, and `types: []` would reject it) — give harness its own tsconfig or
leave it untypechecked.
