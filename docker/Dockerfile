FROM php:8.3-fpm-alpine

# Install system dependencies
RUN apk add --no-cache \
    libpq-dev \
    libzip-dev \
    zip \
    unzip \
    curl \
    nodejs \
    npm

# Install PHP extensions
RUN docker-php-ext-install \
    pdo \
    pdo_pgsql \
    pgsql \
    zip \
    pcntl \
    opcache

# Install Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Configure PHP
RUN cp /usr/local/etc/php/php.ini-production /usr/local/etc/php/php.ini
RUN echo "upload_max_filesize = 10M" >> /usr/local/etc/php/php.ini
RUN echo "post_max_size = 12M" >> /usr/local/etc/php/php.ini
RUN echo "memory_limit = 256M" >> /usr/local/etc/php/php.ini

# Set working directory
WORKDIR /var/www/html

# Copy application
COPY . .

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Install Node dependencies and build frontend
RUN npm ci && npm run build && rm -rf node_modules

# Set permissions
RUN chown -R www-data:www-data storage bootstrap/cache

EXPOSE 9000

CMD ["php-fpm"]
