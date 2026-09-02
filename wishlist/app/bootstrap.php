<?php

declare(strict_types=1);

const APP_ROOT = __DIR__ . '/..';

$configFile = APP_ROOT . '/config.php';
if (!is_file($configFile)) {
    http_response_code(503);
    exit('Wishlist configuration is missing.');
}

$config = require $configFile;
if (!is_array($config)) {
    http_response_code(500);
    exit('Wishlist configuration is invalid.');
}

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/url-security.php';
require_once __DIR__ . '/product-importer.php';
require_once __DIR__ . '/items.php';

startSecureSession($config);
