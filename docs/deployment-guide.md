# Icon — Guide de Déploiement

## Prérequis

### Serveur
- Docker Engine 24+ et Docker Compose v2
- 4 Go RAM minimum (8 Go recommandé)
- 20 Go d'espace disque
- Certificat SSL valide pour le domaine (ex: `icon.gs2e.ci`)
- Ports 80, 443 ouverts

### Postes de travail (agent)
- Windows 10/11 (x64) ou macOS 12+ (Intel/Apple Silicon)
- Droits administrateur pour l'installation
- Connectivité réseau vers le serveur Icon

---

## 1. Déploiement du serveur

### 1.1 Déploiement rapide

```bash
git clone <repo-url> Icon
cd Icon
./scripts/deploy-pilot.sh
```

Le script :
- Crée les fichiers `.env` avec des mots de passe générés
- Démarre tous les services Docker
- Exécute les migrations et seeders
- Crée l'index Elasticsearch
- Vérifie la santé de tous les services

### 1.2 Déploiement manuel

```bash
cd docker

# Copier et configurer l'environnement
cp .env.example .env
# Modifier .env : DB_PASSWORD, APP_KEY, ICON_HMAC_SECRET

# Démarrer les services
docker compose up -d

# Initialiser Laravel
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --force
docker compose exec app php artisan db:seed
docker compose exec app php artisan icon:create-es-index
```

### 1.3 Configuration SSL

Placer les certificats dans `docker/nginx/ssl/` :
```
docker/nginx/ssl/
├── icon.crt      # Certificat SSL
└── icon.key      # Clé privée
```

Redémarrer Nginx :
```bash
docker compose restart nginx
```

### 1.4 Vérification

```bash
# Santé de l'API
curl https://icon.gs2e.ci/api/health

# État des services
make ps

# Logs
make logs
```

---

## 2. Déploiement des agents

### 2.1 Windows (GPO)

1. Construire le MSI :
   ```powershell
   cd installer\windows
   .\build.ps1 -Version "0.1.0" -ServerUrl "https://icon.gs2e.ci"
   ```

2. Déployer via GPO :
   - Copier le MSI sur un partage réseau (`\\server\deploy\icon\`)
   - Créer une GPO : `Computer Configuration > Policies > Software Settings`
   - Ajouter le package MSI en mode `Assigned`
   - Cibler le groupe pilote (OU ou groupe de sécurité)

3. Vérifier l'installation :
   ```powershell
   # Vérifier les services
   Get-Service IconAgent, IconWatchdog

   # Vérifier les logs
   Get-Content "C:\ProgramData\Icon\logs\agent.log" -Tail 20
   ```

### 2.2 macOS (MDM)

1. Construire le PKG :
   ```bash
   cd installer/macos
   ./build.sh 0.1.0 aarch64-apple-darwin   # Apple Silicon
   ./build.sh 0.1.0 x86_64-apple-darwin     # Intel
   ```

2. Déployer via MDM (Jamf/Mosyle) :
   - Uploader le PKG sur le serveur MDM
   - Créer une politique ciblant le groupe pilote
   - Trigger : enrollment + recurring check-in

3. Vérifier l'installation :
   ```bash
   # Vérifier les daemons
   launchctl list | grep icon

   # Vérifier les logs
   tail -20 /var/log/icon/agent.log
   ```

### 2.3 Variable d'environnement serveur

Pour pointer l'agent vers un serveur spécifique, définir `ICON_SERVER_URL` avant l'installation :

- **Windows** : Variable d'environnement système ou paramètre MSI
- **macOS** : `export ICON_SERVER_URL=https://icon.gs2e.ci` avant `installer .pkg`

---

## 3. Architecture de production

```
Internet
    │
    ▼
[Firewall / Reverse Proxy]
    │
    ├── :443 → Nginx (Dashboard + API)
    │           ├── PHP-FPM (Laravel)
    │           ├── WebSocket (Reverb)
    │           └── Agent WebSocket
    │
    ├── PostgreSQL :5432 (interne uniquement)
    ├── Elasticsearch :9200 (interne uniquement)
    └── Redis :6379 (interne uniquement)
```

### Ports exposés

| Port | Service | Usage |
|------|---------|-------|
| 80 | Nginx | Redirection HTTPS |
| 443 | Nginx | Dashboard + API + WebSocket |
| 5432 | PostgreSQL | BDD (interne) |
| 9200 | Elasticsearch | Recherche (interne) |
| 6379 | Redis | Cache/Queue (interne) |

> **Important** : En production, seuls les ports 80 et 443 doivent être exposés à l'extérieur. Modifier `docker-compose.yml` pour retirer les mappings de ports PostgreSQL, ES et Redis.

---

## 4. Maintenance

### Sauvegardes

```bash
# PostgreSQL
docker compose exec postgres pg_dump -U icon icon > backup_$(date +%Y%m%d).sql

# Restauration
cat backup.sql | docker compose exec -T postgres psql -U icon icon
```

### Mise à jour

```bash
git pull origin main
docker compose build --no-cache
docker compose up -d
docker compose exec app php artisan migrate --force
```

### Monitoring

```bash
# État du déploiement
make pilot-status

# Logs en temps réel
make logs

# Machines hors-ligne
make detect-offline
```

---

## 5. Phase pilote (recommandations)

1. **Semaine 1** : Déployer sur 5 machines de la DSI (mode `log` uniquement, pas de blocage)
2. **Semaine 2** : Analyser les échanges IA capturés, ajuster les règles DLP
3. **Semaine 3** : Activer le blocage sur les règles critiques, étendre à 10 machines
4. **Semaine 4** : Valider les métriques, préparer le déploiement complet

### Checklist pilote

- [ ] Serveur déployé et accessible
- [ ] Certificat SSL configuré
- [ ] Agent installé sur les machines pilotes
- [ ] Machines visibles dans le dashboard
- [ ] Heartbeat régulier (toutes les 60s)
- [ ] Échanges IA capturés et indexés
- [ ] Règles DLP fonctionnelles
- [ ] Alertes générées correctement
- [ ] Mode hors-ligne testé (déconnecter un agent 5 min)
- [ ] Watchdog testé (kill du process agent → redémarrage auto)
