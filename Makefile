.PHONY: up down logs health smoke smoke-parallel smoke-gemini install

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
