#!/bin/sh
set -e

echo "=== Icon — Initialisation du conteneur ==="

# Wait for dependent services to be ready
echo "Attente de PostgreSQL..."
until pg_isready -h "${DB_HOST:-postgres}" -U "${DB_USERNAME:-icon}" -q 2>/dev/null; do
    sleep 1
done
echo "PostgreSQL prêt."

# Generate app key if not set
if [ -z "$APP_KEY" ] || [ "$APP_KEY" = "base64:GENERATE_WITH_PHP_ARTISAN_KEY_GENERATE" ]; then
    echo "Génération de la clé applicative..."
    php artisan key:generate --force --no-interaction
fi

# Run migrations
echo "Exécution des migrations..."
php artisan migrate --force --no-interaction

# Create storage link
php artisan storage:link --force --no-interaction 2>/dev/null || true

# Cache configuration for performance
php artisan config:cache --no-interaction
php artisan route:cache --no-interaction
php artisan view:cache --no-interaction

echo "=== Initialisation terminée ==="

# Execute the main command
exec "$@"
