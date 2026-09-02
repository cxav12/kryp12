<?php

declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';
requireLogin();
if (!requestMethod('POST')) {
    http_response_code(405);
    exit('Method not allowed.');
}
requireValidCsrf();
$itemId = filter_var($_POST['id'] ?? null, FILTER_VALIDATE_INT);
$item = $itemId ? ownedItem((int) $itemId) : null;
if (!$item) {
    http_response_code(404);
    exit('Item not found.');
}

$restoring = ($_POST['action'] ?? '') === 'restore';
if ($restoring) {
    $statement = db()->prepare('UPDATE items SET purchased_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND wishlist_id = ?');
    $statement->execute([(int) $item['id'], (int) $item['wishlist_id']]);
} else {
    $statement = db()->prepare('UPDATE items SET purchased_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND wishlist_id = ?');
    $statement->execute([date('Y-m-d H:i:s'), (int) $item['id'], (int) $item['wishlist_id']]);
}
flash('success', $restoring ? 'Item returned to the wishlist.' : 'Item moved to purchased items.');
redirect($restoring ? 'purchased.php' : '');
