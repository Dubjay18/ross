# Ross — Demo Walkthrough (~3 minutes)

One-command setup:

```bash
cp .env.example .env   # fill in GOOGLE_API_KEY and PARALLEL_API_KEY
make demo
```

This brings up Postgres + API + agent + web, seeds
`scripts/seed/demo-script.fountain` through a full analysis run as a smoke
check, and opens the web UI.

## The planted script

`scripts/seed/demo-script.fountain` — "The Long Way Home" — is a short scene
sequence with three deliberately planted errors, one per class Ross is built
to catch:

1. **Continuity (wardrobe/injury):** Sarah's bandage starts on her right arm
   in the kitchen, is on her *left* arm by the Henderson office scene, then
   vanishes entirely in the restaurant scene with no on-page removal.
2. **Continuity (timeline):** the script cuts from a "DAY" meeting to
   "NIGHT" streetlights minutes later with no elapsed time to justify it.
3. **External fact (Parallel-verified):** Sarah pulls out a modern
   smartphone in a scene explicitly dated October 1985 — smartphones didn't
   exist yet. This is the claim Layer 2 sends to Parallel Search.

## Live walkthrough

1. Open <http://localhost:5173>.
2. Drag `scripts/seed/demo-script.fountain` into the upload panel and click
   **Upload & parse** — the parsed scene/character breakdown appears
   immediately, before any AI call.
3. The analysis job kicks off automatically; a banner shows queued → running
   while Layer 1 (continuity) and Layer 2 (Parallel) run.
4. Once complete, the issue sidebar lists the three planted issues
   (plus anything else the model surfaces), ranked by severity. Click one to
   see its scenes highlighted in the script view, its evidence, and — for the
   external-fact issue — the cited Parallel sources.
5. Triage: **Investigate** → **Confirm** the wardrobe issue; **Dismiss** the
   timeline issue with a reason; note the sidebar filters and counts update
   live.
6. Edit `scripts/seed/demo-script.fountain` locally (e.g. fix the bandage
   line), use **Upload a revision**, and show that only the changed scene
   gets rechecked — issues on untouched scenes, including the one you just
   dismissed, are left alone.

## Compliance notes

- Runtime third-party calls are limited to Google AI (Gemini, via
  `google-genai`) and Parallel Search (`parallel-web`) — see
  `apps/agent/app/gemini.py` and `apps/agent/app/verification/verification.py`.
- `LICENSE` (MIT) is present at the repo root; the repo is hosted at
  `github.com/Dubjay18/ross`.
