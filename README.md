# Icon

**Agent de monitoring IA pour la protection des données d'entreprise.**

Icon est un agent endpoint installé sur les postes de travail (Windows + macOS) qui surveille et contrôle l'usage des plateformes d'intelligence artificielle publiques (ChatGPT, Claude, Copilot, Gemini, etc.), intercepte les fuites de données confidentielles et remonte les événements vers un dashboard centralisé.

## Architecture

```
Poste de travail                          Serveur central
┌──────────────────────┐                 ┌──────────────────────┐
│  Icon Agent (Rust)   │    TLS 1.3     │  Laravel 11 API      │
│  ├─ Proxy MITM local │ ─────────────► │  ├─ PostgreSQL 16    │
│  ├─ Clipboard monitor│                 │  ├─ Elasticsearch 8  │
│  ├─ Rule engine      │ ◄───WebSocket──│  ├─ Redis 7          │
│  ├─ SQLCipher local  │                 │  └─ React Dashboard  │
│  └─ Watchdog         │                 └──────────────────────┘
└──────────────────────┘
```

## Fonctionnalités

- **Interception proxy MITM** — Capture les prompts et réponses vers les plateformes IA ciblées
- **Règles DLP** — Détection de patterns sensibles (identifiants, données financières, code source, données personnelles)
- **Blocage temps réel** — Empêche l'envoi de données confidentielles avec page d'avertissement
- **Monitoring presse-papier** — Détecte les copier-coller de contenu sensible vers les IA
- **Dashboard admin** — Vue d'ensemble du parc, alertes, historique des échanges, gestion des règles
- **Mode hors-ligne** — Fonctionne avec les règles en cache, synchronise à la reconnexion
- **Anti-tampering** — Watchdog, vérification d'intégrité des binaires, détection de contournement
- **Recherche full-text** — Recherche dans les échanges via Elasticsearch

## Structure du projet

```
Icon/
├── agent/              # Agent Rust (endpoint)
│   ├── src/
│   │   ├── proxy/      # Proxy MITM local + TLS
│   │   ├── clipboard/  # Monitoring presse-papier
│   │   ├── rules/      # Moteur de règles local
│   │   ├── storage/    # SQLCipher chiffré
│   │   ├── sync/       # Communication serveur (REST + WebSocket)
│   │   ├── watchdog/   # Surveillance + anti-tampering
│   │   └── update/     # Auto-mise à jour
│   └── Cargo.toml
├── backend/            # Serveur Laravel 11
│   ├── app/
│   │   ├── Http/Controllers/
│   │   ├── Models/
│   │   ├── Services/
│   │   └── Jobs/
│   └── resources/js/   # Dashboard React + Inertia.js
├── installer/
│   ├── windows/        # WiX MSI
│   └── macos/          # PKG
├── docker/             # Docker Compose (production)
├── scripts/            # Scripts de déploiement
└── docs/               # Documentation
```

## Quickstart

### Serveur

```bash
# Déploiement automatique
./scripts/deploy-pilot.sh

# Ou manuellement
cd docker
cp .env.example .env   # Configurer les valeurs
docker compose up -d
```

Dashboard : `https://localhost` — Admin : `admin@gs2e.ci` / `changeme`

### Agent (build)

```bash
# macOS
cd installer/macos && ./build.sh 0.1.0 aarch64-apple-darwin

# Windows (PowerShell)
cd installer\windows
.\build.ps1 -Version "0.1.0"
```

### Commandes Make

```bash
make help              # Liste des commandes
make up                # Démarrer les services
make down              # Arrêter les services
make logs              # Voir les logs
make agent-test        # Tests agent Rust
make backend-test      # Tests backend PHP
make pilot-status      # Vérification santé
make setup             # Setup complet (env + Docker + migrations)
```

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Agent endpoint | Rust (tokio, rustls, rusqlite/SQLCipher) |
| Backend API | Laravel 11 (PHP 8.3) |
| Dashboard | React 18 + Inertia.js |
| Base de données | PostgreSQL 16 |
| Recherche | Elasticsearch 8.15 |
| Cache / Queue | Redis 7 |
| Installeur Windows | WiX Toolset v4 (MSI) |
| Installeur macOS | pkgbuild + productbuild (PKG) |
| CI/CD | GitHub Actions |
| Conteneurisation | Docker Compose |

## Documentation

- [Guide de déploiement](docs/deployment-guide.md)
- [Référence API](docs/api-reference.md)
- [Conformité juridique](docs/legal-compliance.md)

## Sécurité

- TLS 1.3 + certificate pinning
- HMAC-SHA256 par requête
- SQLCipher (AES-256) pour le stockage local
- Code signing des binaires
- Watchdog anti-tampering
- Rate limiting API
- Audit log des actions admin

## Licence

Propriétaire — GS2E. Tous droits réservés.
