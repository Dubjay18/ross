# Ross

**A script-reading agent with a memory like Mike Ross's** — holds the entire script in context to catch continuity errors nobody would spot scene-by-scene, and cross-references the real world via Parallel Search to catch factual and historical mistakes. Issues surface as a living, iterable list for a writers' room.

> Agentic Cinema Hackathon — Parallel Partner Track

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript (Vite) |
| API | Node/TypeScript (Hono) + Prisma (soon) |
| Agent | Python — `google-genai` / google-adk only |
| External facts | Parallel Search API (`parallel-web` SDK) |
| DB | Postgres 16 |
| Local run | Docker Compose |

```
apps/web  →  apps/api  →  apps/agent  →  Gemini + Parallel
                ↓
             Postgres
```

## Prerequisites

- Node 22+, pnpm 11+
- Python 3.12+
- Docker (Compose v2)
- `GOOGLE_API_KEY` (Google AI Studio / GCP)
- `PARALLEL_API_KEY` ([Parallel hackathon resources](https://agentic-cinema.devpost.com/details/parallel-resources))

## Quick start

```bash
cp .env.example .env
# edit .env — add GOOGLE_API_KEY and PARALLEL_API_KEY

pnpm install
make up          # docker compose up --build -d
make health      # curl api + agent
```

| Service | URL |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:3001/health |
| Agent | http://localhost:8000/health |
| Postgres | localhost:5432 |

### Without Docker (API + web only)

```bash
pnpm install
pnpm dev:api    # :3001
pnpm dev:web    # :5173
```

Agent locally:

```bash
cd apps/agent && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Smoke tests (hard gates before Layer 2 work)

```bash
# needs keys in .env
make smoke-parallel   # Parallel Search API via official SDK
make smoke-gemini     # google-genai minimal generate
make smoke            # both
```

## Makefile

| Target | What |
|---|---|
| `make up` | Build & start Compose stack |
| `make down` | Stop stack |
| `make health` | Hit API + agent `/health` |
| `make smoke` | Parallel + Gemini smokes |
| `make logs` | Tail compose logs |

## Monorepo layout

```
apps/web          React UI
apps/api          Thin TS API
apps/agent        Python agent (Gemini + Parallel tools)
packages/shared   Shared contracts (Module 1+)
scripts/          Smoke tests
```

## Devpost compliance checklist

- [ ] Uses **only** Google Cloud AI tools for the agent core (`google-genai` / google-adk)
- [ ] Actively calls Parallel's Search API **at runtime** via official `parallel-web` SDK
- [ ] Entirely new work created during contest period (no reuse of prior projects)
- [x] Public repo with MIT license
- [ ] Runs on web
- [ ] 3-minute demo video (YouTube/Vimeo)

## License

MIT — see [LICENSE](./LICENSE).
