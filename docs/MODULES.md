# Ross — Modules, In Depth

All modules (0–10) are done. This document breaks down Modules 3–10 into
concrete, ownership-tagged subtasks, plus notes on how each was actually
built (which sometimes differs from the original plan — see the per-module
"as built" notes).

Owner tags: **[JAY]** TypeScript/DevOps · **[DARKKNIGHT]** Python/Agent · **[SHARED]** needs both.

See `docs/ARCHITECTURE.md` §3 for the API↔Agent interface contract referenced
throughout (`IssueDraft`, `/analyze`, `/recheck`).

---

## Module 3 — Document parser `[JAY]` — ✅ done

**Goal:** turn raw uploaded text into the `Scene[]` / `Character[]` / `Line[]`
structure that everything downstream (the agent, the UI) depends on.

**Why it matters to Darkknight:** he can't write a single line of continuity
logic against real data until this exists — Module 4 onward assumes scenes are
already parsed. Until then he works against hand-written fixture JSON.

Scope grew beyond the original plan: **Fountain, plaintext, PDF, and Final
Draft (`.fdx`) are all supported**, not just Fountain/plaintext. `.fdx` was
added because it's the most common real-world screenwriting tool format and,
being structured XML, is actually the *easiest* of the four to parse
correctly — no heuristics needed. PDF was added because it's the most common
delivery format for finished scripts. **Scanned/image-only PDFs remain out of
scope** — no OCR; only digitally-generated PDFs are supported.

### Architecture: one shared indexer, four format-specific extractors

Every format-specific extractor produces the same intermediate event stream
(`apps/api/src/parser/types.ts::ParsedEvent` — `scene` / `character` / `line`
events) rather than building `Scene[]`/`Character[]` itself. One shared
`buildIndex()` in `apps/api/src/parser/index.ts` consumes that stream for all
four formats — scene-numbering, character dedup, and line-building logic is
written once, not four times.

```
apps/api/src/parser/
  types.ts          ParsedEvent, EventStream, yieldToEventLoop()
  heuristics.ts      shared scene-heading/character-cue/transition detection
  lineClassifier.ts  shared batch classifier used by plaintext + fountain
  fountain.ts        → EventStream (heuristic + Fountain forced-syntax: . @ >)
  plaintext.ts       → EventStream (heuristic only)
  pdf.ts             → EventStream (position/indent-based, via pdfjs-dist)
  fdx.ts             → EventStream (direct XML→event mapping, via fast-xml-parser)
  index.ts           dispatch + size guard + buildIndex()
  __fixtures__/       sample.fountain / .txt / .fdx / .pdf — same underlying script
  parser.test.ts
```

### 3.1 Fountain + 3.2 Plaintext extractors
- Both share `lineClassifier.ts::classifyLines()` — shape-based heuristics
  (`heuristics.ts`): scene headings (`INT.`/`EXT.`/`INT./EXT.` prefix),
  character cues (short ALL-CAPS line followed by non-blank text), dialogue,
  parentheticals `(beat)`, action, transitions (`CUT TO:` etc). A blank line
  ends a dialogue block per screenplay convention.
- Fountain additionally recognizes forced syntax: `.` forces a scene heading,
  `@` forces a character cue, `>` forces a transition — these resolve cases
  the shape heuristic alone can't.
- **Chunked:** processed in batches of 500 lines with a cooperative yield
  (`yieldToEventLoop()`, i.e. `setImmediate`) between batches, so a very large
  script doesn't block the event loop for its whole parse in one synchronous
  stretch — the API stays responsive to other requests during a big upload.
- This will misclassify sometimes — accepted tradeoff, documented in code
  rather than chased further.

### 3.3 PDF extractor (`pdf.ts`)
- **Library:** `pdfjs-dist` (pure JS, no native bindings — matters for the
  chunking approach: no worker-thread/process-pool story needed). Import path
  is `pdfjs-dist/legacy/build/pdf.mjs`, not the bare package — the package's
  default `main` entry uses `DOMMatrix`/browser globals that don't exist in
  Node; the `legacy` build is the one meant for Node and is what actually
  works (confirmed by hand before committing to the dependency).
- PDF carries no element-type markup — only position. Extraction groups each
  page's text items into rows by y-coordinate, then classifies each row by
  the same shape heuristics as plaintext *plus* left-indent relative to the
  page's inferred left margin (character cues indented further than action;
  dialogue indented less than a cue but more than action).
- **Margin estimation bug caught during implementation:** the natural
  instinct is to use the *median* x across all rows as "the margin," but
  action/scene-heading text is always the leftmost column in standard
  screenplay format — nothing legitimate sits further left than it. So the
  true margin is a lower bound, not a central tendency. Using a low
  percentile (10th) instead of the median fixed misclassification on
  dialogue-heavy pages and is the more theoretically correct heuristic, not
  just a fixture-driven hack.
- **Chunked page-by-page:** each page is extracted, classified, and yielded
  as events; control returns to the event loop (`page.cleanup()` +
  `yieldToEventLoop()`) before the next page — the actual mechanism keeping a
  large PDF from stalling the API.
- **Pre-flight sanity gate:** page count (`doc.numPages`, free — no text
  extraction needed to read it) is checked against a 600-page hard cap before
  any per-page work runs. This is a cheap early-exit, not the authoritative
  limit — that's `MAX_SCRIPT_CHARS`, enforced character-by-character in
  `buildIndex()` as events stream in from *any* format.

### 3.4 Final Draft (`.fdx`) extractor (`fdx.ts`)
- **Library:** `fast-xml-parser` (pure JS, no native deps).
- FDX paragraphs carry an explicit `Type` attribute (`Scene Heading`,
  `Action`, `Character`, `Dialogue`, `Parenthetical`, `Transition`, `Shot`,
  `General`) — a direct 1:1 map to `ParsedEvent`, no heuristics, the most
  reliable of the four formats.
- Not chunked: XML is parsed into memory in one call and FDX files are
  typically far smaller than an equivalent PDF for the same script — a
  streaming/SAX parser would add complexity for no measurable benefit here.

### 3.5 Fail-fast size guard (in `buildIndex()`, `index.ts`)
- Reuses the existing `MAX_SCRIPT_CHARS` / `MAX_SCENES_PER_SCRIPT` /
  `MAX_LINES_PER_SCENE` constants from `packages/shared/src/constants.ts`.
- For text formats, checked synchronously on the raw string length before
  any dispatch happens at all. For every format, also enforced incrementally
  as `buildIndex()` consumes the event stream — so an oversized document is
  rejected (`ScriptTooLargeError`, mapped to a 400 in `index.ts`'s
  `onError`) without finishing the expensive remainder of the parse.
- Deliberately centralized in one place rather than duplicated per-extractor.

### 3.6 Batch DB writes (`repositories/scripts.ts`)
- `createScript()` runs inside a single `prisma.$transaction`: create the
  `Script` row, then `character.createMany` / `scene.createMany` /
  `line.createMany` — one round-trip per table instead of N.

### 3.7 Upload endpoint: JSON + multipart (`routes/scripts.ts`)
- `POST /scripts` supports two paths on the same endpoint:
  - **JSON** (`UploadScriptRequestSchema`): `{ title?, content, format }` —
    text formats only (`plaintext` / `fountain` / `fdx`), unchanged for
    existing callers (`scripts/smoke-api.sh`).
  - **`multipart/form-data`**: a `file` field (works for binary `pdf` too),
    optional `title`/`format` fields — format is inferred from the file
    extension when not given explicitly.
- `Script.rawText` semantics: plaintext/fountain preserve the original
  uploaded text as-is; pdf/fdx store the canonical plaintext reconstruction
  built from the parsed event stream (there's no sensible "original text" to
  preserve for those).

### Deferred: worker-thread isolation
Considered and explicitly not built: moving parsing into a
`node:worker_threads` worker would fully isolate CPU work from the event
loop, strictly better than cooperative yielding, but adds real complexity
(message-passing, worker lifecycle/pool management). Cooperative yielding
removes the actual symptom (API freezing during a big upload) at a fraction
of the complexity, which is the right tradeoff at hackathon scale. Revisit
only if real usage shows the event loop still stalls noticeably.

**Tests:** `apps/api/src/parser/parser.test.ts` (vitest) — the same
underlying script fixture in all four formats asserts equivalent
`Scene[]`/`Character[]` output (PDF gets a looser assertion given its
heuristic fuzziness); plus a large-input test asserting the size guard
rejects an oversized script before any scene-building work runs.

**Done when:** ✅ uploading a real sample script via `POST /scripts` (any of
the four formats) returns a populated `scenes[]` on the follow-up
`GET /scripts/:id`; all unit tests pass; verified against both a local run
and the full Dockerized stack.

---

## Module 4 — Agent orchestrator skeleton `[DARKKNIGHT]` — ✅ done

**As built:** the FastAPI skeleton (4.1–4.4) plus the API→agent wiring (4.5)
are both done. `apps/api/src/agent-client.ts` is a thin `fetch` wrapper
around `AGENT_URL`; `apps/api/src/analysis-runner.ts` runs
`markJobRunning` → call the agent → `createIssuesFromDrafts` → `markJobCompleted`,
or `markJobFailed` with the agent's error message on failure. `POST
/scripts/:id/analyze` and `/recheck` fire this without awaiting it (`void
runAnalysisJob(...)`), so the HTTP response returns 202 immediately and the
caller polls `GET /jobs/:id`. Verified end-to-end against a live (keyless)
agent: job correctly transitions `queued → running → failed` with the
agent's `GeminiError` surfaced as `job.error` when `GOOGLE_API_KEY` is unset,
and `queued → running → completed` with issues persisted when a stub agent
stands in for a real one.


**Goal:** stand up the FastAPI service structure and tool-calling scaffold —
no real reasoning yet, just plumbing that Module 5/6 will fill in.

### 4.1 Request/response models
- Add `AnalyzeAgentRequest` / `AnalyzeAgentResponse` / `IssueDraft` to
  `apps/agent/app/models.py`, mirroring the contract in
  `docs/ARCHITECTURE.md` §3.1 (same alias/`populate_by_name` pattern already
  used for `Issue`, `Script`, etc.).
- **[SHARED]** — get these added to `packages/shared` too, so the TS side has a
  typed client for calling the agent (used in Module 4.5, Jay's half — see below).

### 4.2 Routes
- `POST /analyze` — body `AnalyzeAgentRequest`, returns `AnalyzeAgentResponse`.
- `POST /recheck` — same shapes; `mode` will be `"partial"` and `sceneIds`
  non-empty. For the skeleton, `/recheck` can just delegate to the same handler
  as `/analyze` — the actual "only focus on these scenes" behavior is Module 8.
- File: `apps/agent/app/routes/analyze.py`, mounted in `app/main.py`.

### 4.3 Gemini client wrapper
- `apps/agent/app/gemini.py` — thin wrapper around `google-genai`'s
  `client.models.generate_content(...)`, matching the API shape already proven
  in `scripts/smoke-gemini.py`. Centralize the model name (`GEMINI_MODEL` env
  var, default `gemini-2.0-flash`) here so Module 5 doesn't hardcode it.
- Full script text goes in context per scene-analysis pass (hackathon
  assumption from the architecture doc) — don't build chunking/RAG for this.

### 4.4 Tool stubs
- `flag_issue(type, severity, ...)` — the function the LLM calls to emit a
  candidate issue. For the skeleton, just append to an in-memory list and
  return `{"ok": true}`.
- `search_parallel(query, objective)` — stub returning a canned empty/mock
  result for now; Module 6 replaces the body with the real `parallel-web` call
  already proven in `scripts/smoke-parallel.py`.
- `get_scene(scene_id)` — look up a scene from the `Script` payload already in
  the request (agent is stateless, no DB — this reads from the in-memory
  request object, not a database).
- File: `apps/agent/app/tools.py`.

### 4.5 Wire the real call into the API `[JAY]`
- Replace the stub in `apps/api/src/routes/scripts.ts::analyze`/`recheck`
  (currently just creates an `AnalysisJob` row and returns 202) with:
  1. Create the job row as today (`status: "queued"`).
  2. Fire an async (non-blocking w.r.t. the HTTP response) call to the agent's
     `/analyze` or `/recheck`, updating job status to `"running"` before the
     call and `"completed"`/`"failed"` after.
  3. On success, bulk-insert the returned `IssueDraft[]` as `Issue` rows
     (`status: "open"`).
- New file: `apps/api/src/agent-client.ts` — a small typed `fetch` wrapper
  around `AGENT_URL`, using the `AnalyzeAgentRequest`/`Response` types from
  `packages/shared`.
- Use Node's built-in `fetch`; don't add an HTTP client dependency for this.

**Done when:** `POST /scripts/:id/analyze` really calls the agent, the agent
returns an empty or mock `issues: []`, and the job transitions
`queued → running → completed` with zero issues stored (proves the whole pipe
end-to-end before any real reasoning exists).

---

## Module 5 — Layer 1: internal consistency `[DARKKNIGHT]` — ✅ done

Implemented in `apps/agent/app/continuity/continuity.py` with fixtures and
tests in `apps/agent/tests/`.


**Goal:** the actual continuity reasoning over the full script.

### 5.1 Check families (each becomes prompt guidance + a few-shot example)
| Family | What to catch |
|---|---|
| Props | An object appears, disappears, or moves between scenes without an on-page reason |
| Wardrobe / injury | Cast side of an injury, a bandage, a costume changes without a story beat explaining it |
| Timeline / time-of-day | Day→night jumps that don't add up, impossible travel time between two locations in adjacent scenes |
| Geography | A location's stated properties contradict themselves across scenes |
| Character knowledge | A character reacts to information they haven't been shown learning yet (info leak / spoiler logic) |

### 5.2 Implementation approach
- Start with a single-pass system prompt: full script + structured-output
  instructions (`flag_issue` tool calls), one pass per check family or one
  combined pass — try combined first, split only if quality is poor.
- If single-pass quality is weak, fall back to a two-pass approach:
  (a) extract a compact entity/prop/timeline table from the script, (b) run a
  second pass that scans that table for contradictions. Keep this as a fallback,
  not the default — it's slower and costs more tokens.
- Every emitted issue must include `sceneIds` (all scenes involved in the
  contradiction, not just one) and a plain-language `evidence` string quoting or
  paraphrasing the conflicting lines.
- Ambiguous cases (e.g. time-of-day genuinely unclear from the text) →
  `type: "ambiguous"`, not a forced verdict either way.

### 5.3 Where this lives
- `apps/agent/app/layer1/` — one module per check family or one combined
  `continuity.py`, Darkknight's call based on how the single-pass-vs-two-pass
  experiment goes.
- Called from the `/analyze` route (Module 4.2), populating the `issues` list
  before Module 7's merge step runs.

**Tests:** integration test — plant a "cast on wrong arm across two scenes"
fixture script, assert the returned issues include one referencing both scene
ids with `type: "continuity_injury"` or similar.

**Done when:** planted continuity errors in a fixture script are reliably
surfaced with correct severity and both/all relevant scene citations.

---

## Module 6 — Layer 2: external verification (Parallel) `[DARKKNIGHT]` — ✅ done

Implemented in `apps/agent/app/verification/verification.py`, using the
`parallel-web` SDK with multi-query search and top-3 URL extraction; tested
in `apps/agent/tests/test_verification.py`.


**Goal:** cross-reference real-world claims using the Parallel Search API at
runtime — this is the hackathon's required "Parallel Partner Track" integration,
already hard-gated by `scripts/smoke-parallel.py` in Module 0.

### 6.1 Claim extraction
- From the script text/scenes: historical dates, technology claims (was this
  invented yet?), period-accuracy of named props, real place names and their
  stated geography.
- This can be a targeted LLM pass ("list verifiable real-world claims in this
  scene with enough context to search for them") rather than hand-written regex.

### 6.2 `search_parallel` tool (real implementation)
- Replace the Module 4 stub with the real `parallel-web` SDK call, same
  pattern proven in `scripts/smoke-parallel.py`:
  `client.search(search_queries=[...], objective=..., mode="fast")`.
- Use **forced/required tool calling** for claims the LLM has flagged as
  needing external verification — don't let the model silently skip the search.

### 6.3 Verdict logic
- `confirm` — sources support the claim.
- `dispute` — sources contradict it.
- `unverifiable` — no results, or results too weak to call either way. **Never
  silently drop a flagged claim** — always emit an issue, even if it's
  `type: "unverifiable"` with low confidence.

### 6.4 Cross-referencing / disputed claims
- If multiple search results disagree, populate `SourceConflict` on the issue:
  `{ supportingCount, disputingCount, summary }`, and include **all** citing
  sources in `sources[]`, not just the majority side.

**Tests:**
- Integration: one real (or recorded-fixture) Parallel call, assert it parses
  into a valid `IssueDraft`.
- Unit: feed a hand-built multi-source fixture response through the
  verdict/conflict logic, assert `disputed` path produces the right
  `SourceConflict` counts without hitting the network.

**Done when:** one real script claim (e.g. a planted anachronism) returns an
issue with a cited verdict, sourced from a live Parallel Search call.

---

## Module 7 — Conflict resolution & severity `[DARKKNIGHT]` — ✅ done

Implemented in `apps/agent/app/merge.py`, tested in
`apps/agent/tests/test_merge.py`, wired into `routes/analyze.py` right
before both `/analyze` and `/recheck` return.


**Goal:** merge Layer 1 + Layer 2 output into one triage-ready list before it
ever leaves `apps/agent` — the API should receive an already-clean list.

- **Dedupe:** collapse issues that share the same scene(s) + same entity/claim
  into one (keep the higher-confidence version, merge `sources[]`).
- **Severity heuristic:** audience-visible continuity errors outrank obscure
  trivia; `confidence` combines model certainty with source agreement (Layer 2
  issues with multiple confirming sources should rank above single-source ones).
- **Ranking:** sort key `(severity, confidence desc, lowest sceneId/number)`.
  Document that LLM output isn't perfectly deterministic — the sort key exists
  precisely so *presentation order* is stable even if wording varies run to run.
- File: `apps/agent/app/merge.py`, called right before the `/analyze` and
  `/recheck` handlers return their response.

**Tests:** unit — fixed `IssueDraft` fixtures in, assert stable sort order and
correct dedup collapsing, no network calls involved.

**Done when:** `/analyze` never returns two issues that are really the same
underlying problem, and repeated runs against the same fixtures always produce
the same order.

---

## Module 8 — Incremental re-check `[SHARED]` — ✅ done

**Goal:** re-analyzing a revised script shouldn't re-run everything, and must
not clobber issues a human already triaged.

**As built (differs from the original sketch below):** rather than a
separate "patch scenes" endpoint, scene diffing lives on
`PATCH /scripts/:id` (`apps/api/src/repositories/scripts.ts::updateScriptContent`,
routed in `apps/api/src/routes/scripts.ts`). It accepts the same
content/format shape as upload (JSON or multipart, including PDF), re-parses
the full script, and matches old scenes to new ones **by position** (scene
numbers are assigned sequentially with no gaps, so position `i` is a stable
join key across a revision):

- same content hash at position `i` → scene keeps its id, untouched.
- different hash at position `i` → scene row is updated *in place* (its id
  is preserved) — this is what keeps `Issue.sceneIds` valid for issues tied
  to a changed-but-not-removed scene, and is returned in `affectedSceneIds`.
- position exists in the old script but not the new one → the scene row is
  deleted and its id goes into `removedSceneIds`.
- position exists in the new script but not the old one → a new scene row is
  created and its id goes into `affectedSceneIds`.

Characters are matched by name (case-insensitive) across the revision so
their ids also stay stable. `resolveIssuesForRemovedScenes` (in
`repositories/issues.ts`) then auto-resolves any non-terminal issue whose
`sceneIds` are now *entirely* contained in `removedSceneIds`
(`dismissedReason: "scene_removed"`) — an issue that also touches a
surviving scene is left alone. The web UI calls `PATCH` on "Upload a
revision", then automatically fires `POST /recheck` with the returned
`affectedSceneIds` if any are non-empty (`apps/web/src/App.tsx::handleRevise`).
No schema versioning table was added — this was the "simpler, no schema
change" option the plan called out, and it was sufficient for the hackathon
scope. Verified manually end-to-end (see command transcript in project
history): edit one scene → only that scene's id appears in
`affectedSceneIds`; remove two trailing scenes → both come back in
`removedSceneIds` and their open issues flip to `resolved`.


### 8.1 Scene diffing `[JAY]`
- On re-upload (or a "patch scenes" endpoint — decide if needed, or if
  re-upload + re-parse is good enough for the hackathon), hash each scene's
  body text (`Scene.lines` concatenated, or `Scene.heading + lines text`).
- Compare hashes against the previous version → `affectedSceneIds`.
- Store the previous hash somewhere retrievable — either add a `contentHash`
  column to `Scene`, or compute it on the fly from stored `Line.text` each time
  (simpler, no schema change; fine unless scripts get very long).

### 8.2 Auto-resolving removed scenes `[JAY]`
- Issues whose *only* `sceneIds` no longer exist in the new version → set
  `status: "resolved"` automatically (or a dedicated `scene_removed` reason via
  `dismissedReason`, Jay's call) rather than leaving them dangling as `open`.

### 8.3 Partial re-check request `[JAY → DARKKNIGHT]`
- `POST /scripts/:id/recheck` (Module 2, already stubbed) takes
  `{ sceneIds: string[] }` — Jay computes `affectedSceneIds` per §8.1 and passes
  them through to the agent's `/recheck` as the request's `sceneIds`, with
  `mode: "partial"`.

### 8.4 Honoring partial mode `[DARKKNIGHT]`
- The agent still receives the **full** `Script` (per the architecture
  contract — internal continuity needs whole-script context), but the system
  prompt should instruct the model to focus new-issue generation on the given
  `sceneIds`, rather than re-flagging everything from scratch.
- Issues on unaffected scenes that are already `dismissed`/`resolved` must not
  be regenerated — this is enforced by the API only inserting *new* issues from
  the response and never touching existing rows outside `PATCH /issues/:id`, so
  this is naturally safe as long as the agent doesn't also try to "resolve"
  things — it only ever emits new `IssueDraft`s, never mutates old ones.

**Tests:** E2E — edit one scene in a fixture script, re-check, assert only
issues touching that scene changed and issues on untouched scenes (including
ones a human already dismissed) are untouched.

**Done when:** the recheck endpoint matches the row in the test matrix
(Module 10) for "edit one scene → only related issues churn."

---

## Module 9 — Web UI `[JAY]` — ✅ done

**Goal:** the writers'-room loop, usable without curl. Can start immediately
after Module 2 using mocked issues — swap in live data once Module 4+ lands.

**As built:** no mocking layer was needed in the end — Module 4.5 landed
alongside the UI, so `apps/web/src` talks to the real API from the start.
Structure: `src/api.ts` (typed fetch client), `src/components/UploadPanel.tsx`,
`ScriptView.tsx` (scene list with speaker-attributed dialogue and
issue-driven scene highlighting via `#scene-<id>` anchors), `IssueSidebar.tsx`
(severity-sorted, status-filterable), `IssueDetail.tsx` (evidence, sources,
disputed badge, and only the transitions `isValidTransition` allows from the
current status), `JobBanner.tsx` (polls `GET /jobs/:id` every 1.5s while
queued/running). `App.tsx` orchestrates upload → auto-analyze → poll → list
issues, plus the revise → diff → auto-recheck flow from Module 8. Verified
live in a browser (not just `tsc`): upload, scene/speaker rendering, issue
selection + scene highlighting, status transitions updating the sidebar
live, recheck appending new issues, and a revision correctly preserving
unchanged-scene issues while triggering recheck only on changed scenes.


| View | Behavior |
|---|---|
| Upload | Drag-drop `.txt` / `.fountain`, `POST /scripts` |
| Script view | Scene-scrollable, highlights lines linked to the selected issue |
| Issue sidebar | Severity-ranked, filterable by `status`/`type` (`GET /scripts/:id/issues?...`) |
| Issue detail | Scenes involved, `evidence`, `sources[]`, disputed badge when `sourceConflict` is set |
| Actions | Resolve / Dismiss / Confirm (`PATCH /issues/:id` — respects the state machine, so surface the 409 error if a bad transition is attempted), Re-check |
| Job status | Poll `GET /jobs/:id` while `status` is `queued`/`running`, show a spinner |

- Stack: React + TS + Vite (already scaffolded in Module 0). Plain CSS or a
  minimal existing kit — don't rabbit-hole on design for a hackathon demo.
- Mocking strategy while Module 4–7 aren't done yet: hand-write a few
  `Issue[]` fixtures matching the `@ross/shared` type and point the sidebar/detail
  views at them directly, behind a `USE_MOCK_ISSUES` flag or similar, so
  swapping to the real `GET /scripts/:id/issues` later is a one-line change.

**Done when:** the full loop works without curl — upload → issues appear →
triage (resolve/dismiss) → re-check — end to end.

---

## Module 10 — E2E hardening & Devpost pack `[SHARED]` — ✅ done

| Item | Detail | Owner |
|---|---|---|
| Seed script | ~10–15 page Fountain script with planted continuity errors + one real external-fact error, used across every module's tests | Shared — write it together so both sides test against the same fixture |
| Test matrix | Automate the unit/integration tests referenced in each module above; keep a manual E2E checklist for what can't be automated cheaply | Shared |
| Compliance check | Confirm the only runtime third-party calls are Google AI + Parallel (hackathon rule); LICENSE present; repo public | Jay (infra-facing) |
| Demo script | Scripted ~3-minute walkthrough for the submission video | Shared |
| Compose polish | One-command `make demo` that seeds the sample script and opens the UI | Jay |

**As built:** `scripts/seed/demo-script.fountain` ("The Long Way Home") is a
6-scene Fountain script with three planted errors — one per class Ross
targets: a wardrobe/injury continuity error (bandage moves arms, then
vanishes with no removal scene), a timeline error (an implausible day→night
jump with no elapsed time), and one real external-fact error (a smartphone
in a scene dated October 1985, meant to be the claim Layer 2 sends to
Parallel Search). It's parse-verified against the actual parser (6 scenes,
3 characters recognized correctly). `scripts/seed-demo.sh` uploads it
through the real API, triggers a full analysis, and polls the job to
completion/failure — an automated smoke check that exercises the whole
Module 4.5 → 5/6/7 → persisted-issues pipeline, not just a fixture-in/JSON-out
unit test. `make demo` brings up the stack, waits for health, runs the seed
script, and opens the web UI. `docs/DEMO.md` has the ~3-minute walkthrough
script (upload → triage → revise) plus the compliance notes (Google AI +
Parallel are the only runtime third-party calls; MIT `LICENSE` present;
repo hosted at `github.com/Dubjay18/ross`). A dedicated automated test-matrix
harness beyond the existing per-module unit/integration suites
(`apps/agent/tests/`, `apps/api/src/parser/parser.test.ts`) was judged out
of scope for the hackathon timeline — the manual walkthrough in `DEMO.md`
plus `seed-demo.sh` cover the E2E path.

---

## Suggested working order

Given the split, a reasonable parallel timeline:

1. **Jay** starts Module 3 (parser) immediately — it's a pure TS task, no
   dependency on Darkknight.
2. **Darkknight** starts Module 4 (agent skeleton) in parallel, working against
   a hand-written fixture `Script` JSON (copy a shape from Module 3's fixtures
   once Jay's drafted them, even before the parser is finished) — no need to
   wait on Jay.
3. Once both land, wire Module 4.5 (the real API→agent call) together — this is
   the first point Jay and Darkknight will want to actually sync, since it's
   the one shared file (`packages/shared`'s new `AnalyzeAgentRequest`/`IssueDraft`
   types).
4. **Darkknight** proceeds through Modules 5 → 6 → 7 mostly independently.
5. **Jay** can start Module 9 (UI) with mocks as soon as Module 2 is done —
   it doesn't need to wait for any of the above.
6. Module 8 (re-check) and Module 10 (hardening) are the natural last sync
   points before the demo.
