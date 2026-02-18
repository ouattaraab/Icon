# Icon — Makefile principal
# Usage: make help

.DEFAULT_GOAL := help
SHELL := /bin/bash

VERSION ?= 0.1.0
AGENT_DIR := agent
BACKEND_DIR := backend
DOCKER_DIR := docker

# ── Aide ────────────────────────────────────────────────────
.PHONY: help
help: ## Afficher cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-24s\033[0m %s\n", $$1, $$2}'

# ── Agent Rust ──────────────────────────────────────────────
.PHONY: agent-build agent-test agent-check agent-clean

agent-build: ## Compiler l'agent en mode release
	cd $(AGENT_DIR) && cargo build --release

agent-test: ## Lancer les tests de l'agent
	cd $(AGENT_DIR) && cargo test --verbose

agent-check: ## Vérifier formatting + clippy
	cd $(AGENT_DIR) && cargo fmt -- --check
	cd $(AGENT_DIR) && cargo clippy -- -D warnings

agent-clean: ## Nettoyer les artefacts de build agent
	cd $(AGENT_DIR) && cargo clean

# ── Backend Laravel ─────────────────────────────────────────
.PHONY: backend-install backend-test backend-lint backend-migrate backend-seed

backend-install: ## Installer les dépendances backend
	cd $(BACKEND_DIR) && composer install
	cd $(BACKEND_DIR) && npm ci

backend-test: ## Lancer les tests backend
	cd $(BACKEND_DIR) && php artisan test --parallel

backend-lint: ## Vérifier le code PHP (Pint)
	cd $(BACKEND_DIR) && ./vendor/bin/pint --test

backend-migrate: ## Exécuter les migrations
	cd $(BACKEND_DIR) && php artisan migrate

backend-seed: ## Seeder la base de données
	cd $(BACKEND_DIR) && php artisan db:seed

# ── Linting ─────────────────────────────────────────────────
.PHONY: lint lint-frontend lint-backend lint-fix

lint-frontend: ## Linter le code JavaScript (ESLint)
	cd $(BACKEND_DIR) && npx eslint resources/js/

lint-backend: ## Vérifier le style PHP (Pint, dry-run)
	cd $(BACKEND_DIR) && ./vendor/bin/pint --test

lint: lint-frontend lint-backend ## Lancer tous les linters

lint-fix: ## Corriger automatiquement les problèmes de lint
	cd $(BACKEND_DIR) && npx eslint resources/js/ --fix
	cd $(BACKEND_DIR) && ./vendor/bin/pint

# ── Docker ──────────────────────────────────────────────────
.PHONY: up down logs ps build

up: ## Démarrer tous les services Docker
	cd $(DOCKER_DIR) && docker compose up -d

down: ## Arrêter tous les services Docker
	cd $(DOCKER_DIR) && docker compose down

logs: ## Voir les logs de tous les services
	cd $(DOCKER_DIR) && docker compose logs -f

ps: ## Voir l'état des services
	cd $(DOCKER_DIR) && docker compose ps

build: ## Rebuilder les images Docker
	cd $(DOCKER_DIR) && docker compose build --no-cache

restart: ## Redémarrer tous les services Docker
	cd $(DOCKER_DIR) && docker compose restart

shell: ## Ouvrir un shell dans le conteneur app
	cd $(DOCKER_DIR) && docker compose exec app sh

tinker: ## Ouvrir Laravel Tinker
	cd $(DOCKER_DIR) && docker compose exec app php artisan tinker

# ── Setup initial ───────────────────────────────────────────
.PHONY: setup setup-env

setup-env: ## Générer le fichier .env à partir du template
	@if [ ! -f $(DOCKER_DIR)/.env ]; then \
		cp $(DOCKER_DIR)/.env.example $(DOCKER_DIR)/.env; \
		echo "Fichier .env créé dans docker/ — modifiez les valeurs avant de démarrer"; \
	else \
		echo "Le fichier docker/.env existe déjà"; \
	fi
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
		cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env; \
		echo "Fichier .env créé dans backend/ — modifiez les valeurs avant de démarrer"; \
	else \
		echo "Le fichier backend/.env existe déjà"; \
	fi

setup: setup-env up ## Setup complet: env + démarrage Docker
	@echo ""
	@echo "En attente que les services soient prêts..."
	@sleep 15
	cd $(DOCKER_DIR) && docker compose exec app php artisan db:seed --force
	@echo ""
	@echo "=== Icon est prêt ==="
	@echo "  Dashboard: http://localhost:$${NGINX_PORT:-8888}"
	@echo "  Admin:     admin@gs2e.ci / changeme"
	@echo ""
	@echo "  Services:"
	@echo "    Nginx:         http://localhost:$${NGINX_PORT:-8888}"
	@echo "    PostgreSQL:    localhost:$${POSTGRES_PORT:-5433}"
	@echo "    Elasticsearch: http://localhost:$${ES_PORT:-9201}"
	@echo "    Redis:         localhost:$${REDIS_PORT:-6380}"
	@echo "    Reverb (WS):   ws://localhost:$${REVERB_PORT:-6001}"

# ── Installeurs ─────────────────────────────────────────────
.PHONY: pkg-macos msi-windows

pkg-macos: ## Construire le PKG macOS (arm64)
	cd installer/macos && chmod +x build.sh && ./build.sh $(VERSION) aarch64-apple-darwin

msi-windows: ## Construire le MSI Windows (PowerShell requis)
	@echo "Exécuter depuis Windows: cd installer\\windows && .\\build.ps1 -Version $(VERSION)"

# ── Elasticsearch ───────────────────────────────────────────
.PHONY: es-create-index es-reset-index

es-create-index: ## Créer l'index Elasticsearch
	cd $(DOCKER_DIR) && docker compose exec app php artisan icon:create-es-index

es-reset-index: ## Supprimer et recréer l'index Elasticsearch
	@echo "Suppression de l'index..."
	curl -s -X DELETE http://localhost:$${ES_PORT:-9201}/icon-exchanges 2>/dev/null || true
	$(MAKE) es-create-index

# ── Maintenance ─────────────────────────────────────────────
.PHONY: purge-events detect-offline

purge-events: ## Purger les anciens événements
	cd $(DOCKER_DIR) && docker compose exec app php artisan queue:work --once

detect-offline: ## Détecter les machines hors-ligne
	cd $(DOCKER_DIR) && docker compose exec app php artisan icon:detect-offline

# ── Pilote ──────────────────────────────────────────────────
.PHONY: pilot-status

pilot-status: ## Vérifier l'état du déploiement pilote
	@echo "=== État des services Docker ==="
	@cd $(DOCKER_DIR) && docker compose ps
	@echo ""
	@echo "=== Santé du backend ==="
	@curl -sf http://localhost:$${NGINX_PORT:-8888}/api/health 2>/dev/null && echo " OK" || echo " ERREUR"
	@echo ""
	@echo "=== Elasticsearch ==="
	@curl -sf http://localhost:$${ES_PORT:-9201}/_cluster/health 2>/dev/null | python3 -m json.tool 2>/dev/null || echo " Non accessible"
	@echo ""
	@echo "=== Index des échanges ==="
	@curl -sf http://localhost:$${ES_PORT:-9201}/icon-exchanges/_count 2>/dev/null | python3 -m json.tool 2>/dev/null || echo " Aucun échange indexé"
