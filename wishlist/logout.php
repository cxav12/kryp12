<?php

declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';
if (!requestMethod('POST')) {
    http_response_code(405);
    exit('Method not allowed.');
}
requireValidCsrf();
logoutUser();
header('Location: ' . appUrl(), true, 303);
exit;
