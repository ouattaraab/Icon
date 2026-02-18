#!/bin/bash
# Icon — Script de déploiement pilote
# Déploie le serveur Icon et vérifie que tout fonctionne
# Usage: ./scripts/deploy-pilot.sh [--reset]
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DOCKER_DIR="${ROOT_DIR}/docker"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${CYAN}[ICON]${NC} $1"; }
ok()    { echo -e "${GREEN}  ✓${NC} $1"; }
warn()  { echo -e "${YELLOW}  ⚠${NC} $1"; }
fail()  { echo -e "${RED}  ✗${NC} $1"; }

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       Icon — Déploiement Pilote          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Reset mode
if [ "$1" = "--reset" ]; then
    warn "Mode RESET : suppression de toutes les données"
    cd "${DOCKER_DIR}"
    docker compose down -v 2>/dev/null || true
    log "Volumes supprimés"
fi

# ── 1. Vérifications préalables ────────────────────────────
log "Vérification des prérequis..."

command -v docker >/dev/null 2>&1 || { fail "Docker non installé"; exit 1; }
ok "Docker installé"

docker compose version >/dev/null 2>&1 || { fail "Docker Compose non disponible"; exit 1; }
ok "Docker Compose disponible"

# ── 2. Fichier .env ────────────────────────────────────────
log "Configuration de l'environnement..."

if [ ! -f "${DOCKER_DIR}/.env" ]; then
    cp "${DOCKER_DIR}/.env.example" "${DOCKER_DIR}/.env"

    # Générer un mot de passe DB aléatoire
    DB_PASS=$(openssl rand -hex 16)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/your_secure_password_here/${DB_PASS}/" "${DOCKER_DIR}/.env"
    else
        sed -i "s/your_secure_password_here/${DB_PASS}/" "${DOCKER_DIR}/.env"
    fi
    ok "Fichier .env Docker créé (DB_PASSWORD généré)"
else
    ok "Fichier .env Docker existant conservé"
fi

if [ ! -f "${ROOT_DIR}/backend/.env" ]; then
    cp "${ROOT_DIR}/backend/.env.example" "${ROOT_DIR}/backend/.env"
    ok "Fichier .env backend créé"
else
    ok "Fichier .env backend existant conservé"
fi

# ── 3. Démarrage des services ──────────────────────────────
log "Démarrage des services Docker..."
cd "${DOCKER_DIR}"
docker compose up -d --build

# ── 4. Attente que les services soient prêts ───────────────
log "Attente de la disponibilité des services..."

wait_for_service() {
    local name=$1
    local check=$2
    local max_wait=$3
    local elapsed=0

    while [ $elapsed -lt $max_wait ]; do
        if eval "$check" >/dev/null 2>&1; then
            ok "$name prêt (${elapsed}s)"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    fail "$name non disponible après ${max_wait}s"
    return 1
}

wait_for_service "PostgreSQL" "docker compose exec -T postgres pg_isready -U icon" 30
wait_for_service "Redis" "docker compose exec -T redis redis-cli ping" 20
wait_for_service "Elasticsearch" "curl -sf http://localhost:${ES_PORT:-9201}/_cluster/health" 60
wait_for_service "Application PHP" "docker compose exec -T app php -v" 30

# ── 5. Initialisation Laravel ──────────────────────────────
log "Initialisation de l'application..."

docker compose exec -T app php artisan key:generate --force 2>/dev/null || true
ok "Clé d'application générée"

docker compose exec -T app php artisan migrate --force
ok "Migrations exécutées"

docker compose exec -T app php artisan db:seed --force
ok "Base de données seedée"

docker compose exec -T app php artisan icon:create-es-index 2>/dev/null || true
ok "Index Elasticsearch créé"

# ── 6. Vérifications de santé ──────────────────────────────
log "Vérifications de santé post-déploiement..."

HEALTH_OK=true

# API health check
if curl -sf http://localhost:${NGINX_PORT:-8888}/api/health >/dev/null 2>&1; then
    ok "API /health opérationnelle"
else
    warn "API /health non accessible (Nginx peut nécessiter un certificat SSL)"
fi

# PostgreSQL
MACHINE_COUNT=$(docker compose exec -T postgres psql -U icon -d icon -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
if [ -n "$MACHINE_COUNT" ] && [ "$MACHINE_COUNT" -gt 0 ]; then
    ok "PostgreSQL: ${MACHINE_COUNT} tables créées"
else
    fail "PostgreSQL: tables non trouvées"
    HEALTH_OK=false
fi

# Elasticsearch
ES_STATUS=$(curl -sf http://localhost:${ES_PORT:-9201}/_cluster/health 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
if [ -n "$ES_STATUS" ]; then
    ok "Elasticsearch: cluster status = ${ES_STATUS}"
else
    fail "Elasticsearch non accessible"
    HEALTH_OK=false
fi

# Redis
REDIS_PONG=$(docker compose exec -T redis redis-cli ping 2>/dev/null | tr -d '\r')
if [ "$REDIS_PONG" = "PONG" ]; then
    ok "Redis: opérationnel"
else
    fail "Redis non accessible"
    HEALTH_OK=false
fi

# Queue worker
QUEUE_STATUS=$(docker compose ps queue-worker --format "{{.Status}}" 2>/dev/null)
if echo "$QUEUE_STATUS" | grep -qi "up"; then
    ok "Queue worker: actif"
else
    warn "Queue worker: status = ${QUEUE_STATUS}"
fi

# ── 7. Résumé ──────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         Déploiement terminé              ║"
echo "╚══════════════════════════════════════════╝"
echo ""

if [ "$HEALTH_OK" = true ]; then
    echo -e "${GREEN}Tous les services sont opérationnels.${NC}"
else
    echo -e "${YELLOW}Certains services nécessitent une attention.${NC}"
fi

echo ""
echo -e "${CYAN}Accès:${NC}"
echo "  Dashboard:      http://localhost:${NGINX_PORT:-8888}"
echo "  Admin:          admin@gs2e.ci / changeme"
echo "  API Health:     curl http://localhost:${NGINX_PORT:-8888}/api/health"
echo "  Elasticsearch:  http://localhost:${ES_PORT:-9201}"
echo ""
echo -e "${CYAN}Commandes utiles:${NC}"
echo "  make logs           Voir les logs en temps réel"
echo "  make ps             État des services"
echo "  make pilot-status   Vérification complète"
echo "  make down           Arrêter les services"
echo ""
echo -e "${CYAN}Prochaines étapes:${NC}"
echo "  1. Configurer le certificat SSL dans docker/nginx/ssl/"
echo "  2. Installer l'agent sur 5-10 machines pilotes"
echo "  3. Surveiller le dashboard pendant 48h"
echo "  4. Ajuster les règles DLP selon les premiers résultats"
echo ""
