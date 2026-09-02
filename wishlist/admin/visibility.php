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
$visibility = $item['visibility'] === 'public' ? 'private' : 'public';
$statement = db()->prepare('UPDATE items SET visibility = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND wishlist_id = ?');
$statement->execute([$visibility, (int) $item['id'], (int) $item['wishlist_id']]);
flash('success', 'Item visibility updated.');
redirect('');
