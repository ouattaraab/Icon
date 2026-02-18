#!/bin/sh
set -e

echo "=== Icon — Initialisation du conteneur ==="

# Install dependencies if volume mount overrides the image build
if [ ! -f vendor/autoload.php ]; then
    echo "Installation des dépendances PHP..."
    composer install --no-dev --optimize-autoloader --no-interaction
fi

if [ ! -d public/build ]; then
    echo "Compilation des assets frontend..."
    npm ci --no-audit --no-fund && npm run build
fi

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

# Seed the database on first run (admin user, default rules, monitored domains)
php artisan db:seed --force --no-interaction 2>/dev/null || true

echo "=== Initialisation terminée ==="

# Execute the main command
exec "$@"
