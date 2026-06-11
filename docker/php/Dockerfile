FROM php:8.3-fpm-alpine

RUN apk add --no-cache icu-dev libzip-dev zip unzip git $PHPIZE_DEPS \
    && docker-php-ext-configure intl \
    && docker-php-ext-install pdo_mysql bcmath intl zip opcache \
    && apk del $PHPIZE_DEPS

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

RUN addgroup -g 1000 bereket && adduser -G bereket -u 1000 -D bereket
USER bereket

WORKDIR /var/www/html

CMD ["php-fpm"]
