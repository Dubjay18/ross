.PHONY: up down logs health smoke smoke-parallel smoke-gemini install demo

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

health:
	@curl -sf http://localhost:3001/health | tee /dev/stderr | grep -q '"ok":true'
	@echo ""
	@curl -sf http://localhost:8000/health | tee /dev/stderr | grep -q '"ok":true'
	@echo ""
	@echo "health ok"

install:
	pnpm install
	cd apps/agent && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

smoke: smoke-parallel smoke-gemini

smoke-parallel:
	@test -f .env || (echo "missing .env — cp .env.example .env"; exit 1)
	@cd apps/agent && \
		(test -x .venv/bin/python || (python3 -m venv .venv && .venv/bin/pip install -r requirements.txt)) && \
		set -a && . ../../.env && set +a && \
		../../scripts/run-smoke.sh parallel

smoke-gemini:
	@test -f .env || (echo "missing .env — cp .env.example .env"; exit 1)
	@cd apps/agent && \
		(test -x .venv/bin/python || (python3 -m venv .venv && .venv/bin/pip install -r requirements.txt)) && \
		set -a && . ../../.env && set +a && \
		../../scripts/run-smoke.sh gemini

# One-command demo: bring up the stack, wait for health, seed the planted-error
# script through the full analyze pipeline (proves the API->agent->DB loop end
# to end), then open the web UI so a human can drag the same file in and
# triage the issues live.
demo:
	@$(MAKE) up
	@echo "waiting for services..."
	@for i in $$(seq 1 30); do $(MAKE) health >/dev/null 2>&1 && break; sleep 2; done
	@./scripts/seed-demo.sh || echo "seed run failed/degraded — continuing (agent may be missing API keys); the UI upload flow still works standalone"
	@echo ""
	@echo "Demo script: scripts/seed/demo-script.fountain"
	@echo "Drag it into http://localhost:5173 to walk through the planted issues."
	@(command -v xdg-open >/dev/null && xdg-open http://localhost:5173) \
		|| (command -v open >/dev/null && open http://localhost:5173) \
		|| echo "open http://localhost:5173 manually"
