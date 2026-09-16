# Validator findings on plan-draft.json (apply ALL blockers and should-fixes)

## BLOCKER 1 — task 4.1 / architecture: hand-built element literals
`hooks/render-tree.ts` builds `{type:'Box', props:{...}, children:[...]}` literals.
Shipped diff mod and the official d.ts header both say elements come from the
surface table: `const { Box, Text } = $.ui.resolve(e)`. Literals are TYPE-LEGAL so
tsc never catches this; a refused element makes the engine draw the original row,
which is indistinguishable from "hooks didn't ship" — the bug would be written into
the README as an environment limitation.
FIX: make `treeOf` take the table as a parameter so it stays pure and testable:
    import type { Elements, RenderElement } from 'claude-code'
    export function treeOf(lines: RenderLine[], t: Elements['terminal']): RenderElement
body uses t.Box({ flexDirection:'column', children:[...] }),
t.Text({ wrap:'truncate-end', children:[text] }), t.Code({ source, language }).
In 4.2 render(): `const t = await $.ui.resolve(e)`; render() takes `e` narrowed to
`e.surface === 'terminal'`, not just columns. 4.1's test passes a fake table of
constructors returning the literals, so allowlist assertions survive.
Add to 4.V: `claude plugin validate .` output contains `$.ui.resolve`.

## BLOCKER 2 — 5.1/5.2/5.3: interactive steps written as if the executor runs them
A background executor cannot drive the interactive TUI and `-p` never fires
ui.render. 5.2 makes CODE EDITS conditional on what the executor "sees".
FIX: retitle Phase 5 "Hand-off: manual smoke (Ali drives) + README". 5.1's only
executor action is to print this block and stop:
    Run in a Ghostty window at least 100 columns wide:
      cd /tmp && CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir ~/Downloads/Coding/claude-mod-bidi
    Prompt: این یک متن فارسی است برای تست. لطفاً همین جمله را دو بار تکرار کن و بعد بنویس: قیمت ۱۲۰ دلار است و the API returns JSON.
    Report: (a) letters joined and right-to-left? (b) RTL lines flush right?
            (c) is the ⏺ reply bullet still drawn? (d) grep -i bidi ~/.claude/debug/latest
Split into "5.2 Apply the smoke findings" — a normal task GATED on Ali's answers,
each conditional edit keyed to (a)-(d). 5.4/5.V explicitly blocked on it.
State in the plan: Phases 1-4 complete unattended, Phase 5 does not.

## SHOULD-FIX 3 — 1.4 and 4.7: the load probe verify is tautological
Measured: a register.ts of `this is not valid typescript {{{` gives no error,
exit 0, no debug output under `claude --debug --plugin-dir ... -p`. The step passes
when the plugin is completely broken.
FIX: use `claude plugin validate` (see tooling-corrections.md §1). Keep the `-p` run
only as a "does not crash a session" smoke and SAY it proves nothing about the module.

## SHOULD-FIX 4 — 1.2: regenerate the d.ts, do not copy the 2.1.271 one
`/plugin-types` works (tooling-corrections.md §2). 2.1.272 file is 10922 lines vs
10736. RenderPropsOf/On/Register/Registration.catch/RenderViewport/ui.resolve are
byte-identical, BUT 2.1.271 has `export interface BuiltinToolResults { }` EMPTY while
the regenerated one declares `Bash: { stdout, stderr, interrupted, persistedOutputPath?, ... }`.
FIX: 1.2 runs `/plugin-types`; Verify `head -1 .claude/types/claude-code.d.ts` ->
`// Written by Claude Code 2.1.272.`. Delete drafter assumption #2.

## SHOULD-FIX 5 — 3.3/3.1: the stated reason for avoiding --width is false
fribidi's --width padding IS display-cell accurate (measured: سلام دنیا with the
lam-alef FEFF filler, می‌کند with ZWNJ, مَدرسه with a combining fatha, and a mixed
line all came back 41 code points / exactly 40 cells at --width 40; `hello` 40/40).
The DECISION to pad in TS still stands (only way to get auto/left/right and
per-line base direction), but the justification is wrong and hides the real risk:
cellWidth must independently reproduce what fribidi already gets right.
FIX: rewrite the 3.3 note accordingly, and add to 3.1 a test using fribidi as the
ORACLE (put it in harness/fribidi-real.test.ts under 3.4 so cell-width.ts stays
import-free): for each of ['سلام دنیا','می‌کند','مَدرسه','قیمت ۱۲۰ دلار است و the API returns JSON'],
spawnSync fribidi --nobreak --reordernsm --rtl --width 40 -> cellWidth(stdout.trimEnd()) === 40.
This is also the concrete pre-check for drafter assumption #5.

## SHOULD-FIX 6 — 3.4/3.7: nothing runs the real binary through the real transform
3.4 uses hand-written argv; 3.7 uses a fake reversing shaper. The plan's central
claim (wrap in logical order THEN shape, so line 1 stays the paragraph's start) has
no regression test.
FIX: add task 3.8 harness/transform-real.test.ts — real Shaper over
spawnSync(fribidiArgv(dir,'fribidi')), call transformText(<3-sentence Persian
paragraph>, {columns:30, alignment:'auto', markdown:true}, realShaper) and assert:
 (a) every line cellWidth <= 30
 (b) the FIRST output line's rightmost non-space run is the shaped form of the
     paragraph's FIRST word  <- the reverse-then-wrap regression
 (c) a `getPrice()` span and a https:// URL come back byte-identical inside their lines
 (d) `- سلام دنیا` yields a first line starting '- '

## SHOULD-FIX 7 — 4.2 vs 4.3: probe() return type inconsistent
4.2 has probe($) set disabled=true and call $.ui.log (returns nothing); 4.3 writes
`if (!(await (probed ??= probe($)))) return next(e)` with `probed: Promise<boolean>|null`.
Fails at first tsc.
FIX: specify in 4.2:
  const probe = async ($: EngineInterface): Promise<boolean> => {
    try { const { exitCode } = await $.process.run([settings.fribidiPath,'--version'], { timeoutMs: settings.timeoutMs }); if (exitCode === 0) return true } catch {}
    disabled = true
    $.ui.log('bidi: fribidi not runnable at ' + settings.fribidiPath + '; RTL shaping disabled')
    return false
  }

## SHOULD-FIX 8 — 4.4/4.5/4.6/4.V: only 4.3 attaches .catch
Registration.catch is real; d.ts says "without it a failed hook is absent" and a
SECOND .catch on one registration throws (so exactly one per registration).
FIX: add `.catch(($, e, next) => next(e))` to 4.4, 4.5, 4.6. Add to 4.V:
`grep -c '\.catch((' hooks/register.ts` -> 4.

## SHOULD-FIX 9 — 4.3 and the other hooks: $.ui.log will flood the transcript
$.ui.log appends a line to the transcript; render hooks re-run on every resize and
redraw, and each logged row is itself new transcript content.
FIX: `const logged = new Set<string>()` in the register closure;
`if (!logged.has(msg)) { logged.add(msg); $.ui.log('bidi: ' + msg) }`.

## SHOULD-FIX 10 — 2.1: two contradictory regexes, neither passes its own test
Step gives /[֐-׿؀-ۿ…]/ then says exclude U+06F0-06F9 via \p{Script=Arabic} minus
\p{Nd}. The first fails the step's own hasRtl('۱۲۳')===false; the second needs the
ES2024 `v` flag which target es2023 refuses. Arabic-Indic U+0660-0669 unmentioned.
FIX: use the verified regex (checked on node v22.19.0 — hello false, سلام دنیا true,
قیمت ۱۲۰ دلار است و the API returns JSON true, שלום true, ۱۲۳ false, ٠١٢ false, 123 false):
    const RTL = /(?=\p{L})[\p{Script=Arabic}\p{Script=Hebrew}]/u
Add hasRtl('٠١٢')===false to the test list.

## SHOULD-FIX 11 — 4.6: cast output to the now-typed Bash record; handle persisted output
RenderPropsOf.ToolResult.output is `unknown`; BuiltinToolResults.Bash is now declared
and carries persistedOutputPath?/persistedOutputSize? — a large Bash output is written
to a file and stdout is not the whole thing.
FIX: `const out = e.props.output as import('claude-code').BuiltinToolResults['Bash'] | null`
and guard `if (out?.persistedOutputPath) return next(e)`.

## SHOULD-FIX 12 — 4.6: the grep verify is gameable
`grep -c 'output:' hooks/register.ts` -> 0 matches nothing either way.
FIX: `grep -cE "next\(\{" hooks/register.ts` -> 0 (no hook rewrites the envelope;
all four return their own tree or next(e)).

## NITS
13. 1.3 vs 4.7: timeoutMs is a Settings field with a default but absent from the
    userConfig manifest. Add it to 4.7 or note it is intentionally code-only.
14. 3.2: "lines joined by a single space equal the input" contradicts the hard-break
    case in the same list. Scope it: "for inputs whose every token fits in width".
15. 3.1/3.7: wrapping measures LOGICAL text but the shaped line is narrower (سلام is
    4 logical cells, shapes to 3 via lam-alef ligature + zero-width FEFF). So wrapping
    under-fills and never overflows — safe. Add a one-line note so nobody "fixes" it
    later by measuring the shaped form, which would require shaping before wrapping,
    i.e. exactly the bug this mod exists to avoid.
16. 3.3: stripping U+FEFF in unpackStdout makes the FEFF entry in 3.1's zero-width set
    dead code. Keep both; say which is load-bearing.
17. 3.7/4.1: wrap:'truncate-end' on a right-aligned RTL line truncates the START of the
    sentence if cellWidth ever over-measures. margin default 4 gives slack; state that
    as the reason margin must stay >= 1.

## Drafter assumptions — verdicts
1 userConfig schema: fallback adequate, but re-point its probe at `claude plugin validate .`
2 d.ts version: RESOLVED, delete (regenerate via /plugin-types)
3 -p probe: proves NOTHING, needs the concrete pre-check
4 tsx with no package.json: VERIFIED WORKING (pass 1 / fail 0, exit 0, node v22.19.0);
  keep the harness/package.json fallback as a one-liner
5 cellWidth vs Ink string-width: needs the fribidi --width oracle test (finding 5)
6 PUA U+E000/E001 bidi class L: VERIFIED, delete. Both placeholders come back with
  their code points adjacent and in order; the two SWAP relative position (correct
  bidi), which index-encoded restoreTokens handles. Add that reversal case to 2.4.
7 reply-bullet survival: genuinely unknown, only answerable interactively -> fold into
  the 5.1 hand-off as observation (c)
8 list markers flush-left: a design choice, not an unknown; correctly deferred

## Verified correct — do not change
Register/PluginOptions signature; the two-overload On with the matcher form; ALL FOUR
prop sets exact (ToolResult {tool_use_id,tool,output:unknown,isErrored}, CommandOutput
{command,args,text,isErrored}, UserMessage {text,origin}, AssistantMessage
{text,isFirstOfReply}); RenderInputOf {surface,component,requestId,viewport?,props};
RenderViewport {columns,rows}; Registration.catch incl. "a second .catch throws";
CodeProps {source,language?,path?,startLine?,format?} with the 10000-char cap;
ProcessRunInit/Result exactly as stated, 30s default / 10min cap; no manifest gate for
$.process.run (`uses` is scanned from source); both Text and Box prop allowlists in
4.1's test match exactly; e is Frozen and the plan never assigns into it; the d.ts is
an ambient declare module so NO paths entry is needed; manifests match shipped diff
byte-for-byte; all fribidi flags exist on GNU FriBidi 1.0.16 and behave as stated;
line count preserved N in -> N out; a pure-Latin line comes back byte-identical;
U+FEFF filler after lam-alef U+FEFC is real; ZWNJ survives and breaks the join,
cellWidth('می‌خواهم')===7 is right; --reordernsm was a no-op on every Persian sample
tried (harmless, keep, but do not claim it is load-bearing);
~/.claude/debug/latest exists and is right for 5.1.
