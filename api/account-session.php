<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');

require __DIR__ . '/../account-app/bootstrap.php';

$user = accountUser();
if (!$user) {
    echo json_encode(['authenticated' => false], JSON_UNESCAPED_SLASHES);
    exit;
}

echo json_encode([
    'authenticated' => true,
    'isAdmin' => ($user['role'] ?? '') === 'super_admin',
    'csrfToken' => accountCsrf(),
], JSON_UNESCAPED_SLASHES);
