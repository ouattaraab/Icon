# Icon — Référence API

Base URL : `https://icon.gs2e.ci/api`

## Authentification

Toutes les requêtes agent doivent inclure :

| Header | Description |
|--------|-------------|
| `X-API-Key` | Clé API unique de la machine (reçue à l'enregistrement) |
| `X-Timestamp` | Timestamp Unix de la requête |
| `X-Signature` | HMAC-SHA256 du body avec le secret partagé |

### Calcul de la signature

```
signature = HMAC-SHA256(
    key: hmac_secret,
    message: "{timestamp}.{request_body}"
)
```

Les requêtes avec un timestamp de plus de 5 minutes sont rejetées.

---

## Endpoints Agent

### POST /agents/register

Enregistrement initial d'une machine.

**Headers :** Clé de pré-enregistrement (pas d'API key individuelle)

**Body :**
```json
{
    "hostname": "PC-DIRECTION-01",
    "os": "windows",
    "os_version": "Windows 11 23H2",
    "agent_version": "0.1.0",
    "machine_id": "unique-hardware-id"
}
```

**Réponse 201 :**
```json
{
    "id": "uuid",
    "api_key": "generated-api-key",
    "server_time": "2026-02-17T10:00:00Z"
}
```

---

### POST /agents/heartbeat

Heartbeat périodique (toutes les 60 secondes).

**Body :**
```json
{
    "machine_id": "uuid",
    "agent_version": "0.1.0",
    "uptime_secs": 3600,
    "proxy_active": true,
    "queue_size": 5,
    "rules_version": 42,
    "cpu_usage": 2.5,
    "memory_mb": 45
}
```

**Réponse 200 :**
```json
{
    "status": "ok",
    "commands": [],
    "update_available": false,
    "latest_version": "0.1.0",
    "server_time": "2026-02-17T10:01:00Z"
}
```

**Commandes possibles dans `commands` :**
- `force_sync` — Resynchroniser les règles immédiatement
- `restart` — Redémarrer l'agent
- `update` — Télécharger et appliquer une mise à jour
- `purge_local` — Purger les données locales anciennes

---

### POST /events

Ingestion batch d'événements. Maximum 100 événements par requête. Corps compressé en gzip.

**Rate limit :** 30 requêtes/minute par machine.

**Body :**
```json
{
    "machine_id": "uuid",
    "events": [
        {
            "event_type": "prompt",
            "platform": "chatgpt",
            "domain": "chat.openai.com",
            "content": "Comment implémenter...",
            "content_hash": "sha256hex",
            "content_length": 150,
            "occurred_at": "2026-02-17T09:45:00Z",
            "metadata": {
                "url_path": "/backend/api/gpt-4",
                "method": "POST"
            }
        },
        {
            "event_type": "block",
            "platform": "chatgpt",
            "domain": "chat.openai.com",
            "rule_id": "uuid",
            "rule_name": "Block credentials sharing",
            "severity": "critical",
            "content_preview": "Voici les identif***",
            "occurred_at": "2026-02-17T09:46:00Z"
        },
        {
            "event_type": "clipboard",
            "content_hash": "sha256hex",
            "content_length": 500,
            "matched_patterns": ["gs2e_internal"],
            "content_preview": "Rapport financier Q4 ***",
            "occurred_at": "2026-02-17T09:47:00Z"
        }
    ]
}
```

**Types d'événements :**

| Type | Description |
|------|-------------|
| `prompt` | Prompt envoyé vers une plateforme IA |
| `response` | Réponse reçue d'une plateforme IA |
| `block` | Requête bloquée par une règle |
| `alert` | Alerte déclenchée (pattern DLP, etc.) |
| `clipboard` | Contenu presse-papier avec pattern détecté |

**Réponse 200 :**
```json
{
    "accepted": 3,
    "rejected": 0
}
```

---

### GET /rules/sync

Synchronisation incrémentale des règles.

**Paramètres query :**

| Param | Type | Description |
|-------|------|-------------|
| `version` | int | Dernière version connue par l'agent |

**Réponse 200 :**
```json
{
    "rules": [
        {
            "id": "uuid",
            "name": "Block credentials",
            "category": "block",
            "target": "prompt",
            "condition_type": "regex",
            "condition_value": {
                "pattern": "(mot de passe|password|mdp)\\s*[:=]\\s*\\S+",
                "flags": "i"
            },
            "action_config": {
                "message": "Partage d'identifiants détecté et bloqué.",
                "severity": "critical"
            },
            "priority": 100,
            "enabled": true,
            "version": 43
        }
    ],
    "deleted_rule_ids": ["uuid-of-deleted-rule"],
    "current_version": 43
}
```

---

### GET /agents/update

Vérification de mise à jour de l'agent.

**Réponse 200 :**
```json
{
    "update_available": true,
    "latest_version": "0.2.0",
    "download_url": "https://icon.gs2e.ci/updates/icon-agent-0.2.0-windows-x64.exe",
    "checksum_sha256": "abc123...",
    "release_notes": "Amélioration des performances du proxy"
}
```

---

### POST /agents/watchdog-alert

Alertes du watchdog (tampering, crash, etc.).

**Rate limit :** 10 requêtes/minute par machine.

**Body :**
```json
{
    "machine_id": "uuid",
    "alert_type": "binary_tampered",
    "message": "Agent binary hash mismatch",
    "details": {
        "expected_hash": "abc...",
        "actual_hash": "def..."
    },
    "occurred_at": "2026-02-17T09:50:00Z"
}
```

**Types d'alertes watchdog :**

| Type | Sévérité | Description |
|------|----------|-------------|
| `binary_tampered` | critical | Hash du binaire modifié |
| `agent_crash_loop` | critical | Agent redémarré > 5 fois |
| `proxy_tampered` | warning | Configuration proxy système modifiée |
| `agent_restarted` | warning | Agent redémarré par le watchdog |
| `config_tampered` | warning | Permissions config modifiées |

**Réponse 200 :**
```json
{
    "status": "received"
}
```

---

### GET /health

Endpoint de santé (non authentifié).

**Réponse 200 :**
```json
{
    "status": "ok",
    "version": "0.1.0",
    "timestamp": "2026-02-17T10:00:00Z"
}
```

---

## WebSocket Agent

URL : `wss://icon.gs2e.ci/agent-ws`

### Authentification

Le premier message doit être un JSON d'authentification :
```json
{
    "type": "auth",
    "api_key": "machine-api-key",
    "machine_id": "uuid"
}
```

### Messages serveur → agent

**Mise à jour de règle :**
```json
{
    "type": "rule_updated",
    "rule": { /* même format que /rules/sync */ }
}
```

**Suppression de règle :**
```json
{
    "type": "rule_deleted",
    "rule_id": "uuid"
}
```

**Commande admin :**
```json
{
    "type": "command",
    "action": "force_sync" | "restart" | "update"
}
```

---

## Endpoints Dashboard

Ces endpoints utilisent l'authentification par session Laravel (cookie).

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/dashboard/machines` | Liste paginée des machines |
| GET | `/dashboard/machines/{id}` | Détail machine + événements récents |
| GET | `/dashboard/alerts` | Centre d'alertes (filtrable) |
| POST | `/dashboard/alerts/{id}/acknowledge` | Acquitter une alerte |
| GET | `/dashboard/exchanges` | Historique avec recherche Elasticsearch |
| GET | `/dashboard/exchanges/{id}` | Détail d'un échange |
| GET | `/dashboard/rules` | Liste des règles |
| POST | `/dashboard/rules` | Créer une règle |
| PUT | `/dashboard/rules/{id}` | Modifier une règle |
| DELETE | `/dashboard/rules/{id}` | Supprimer une règle |
| PATCH | `/dashboard/rules/{id}/toggle` | Activer/désactiver |
| GET | `/dashboard/reports` | Données statistiques |
| GET | `/dashboard/reports/export` | Export CSV (events/alerts/machines) |

---

## Codes d'erreur

| Code | Description |
|------|-------------|
| 200 | Succès |
| 201 | Ressource créée |
| 400 | Requête invalide |
| 401 | Non authentifié (API key manquante/invalide) |
| 403 | Signature HMAC invalide ou expirée |
| 404 | Ressource non trouvée |
| 422 | Erreur de validation |
| 429 | Rate limit dépassé |
| 500 | Erreur serveur |
