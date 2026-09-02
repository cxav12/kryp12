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
$statement = db()->prepare('DELETE FROM items WHERE id = ? AND wishlist_id = ?');
$statement->execute([(int) $item['id'], (int) $item['wishlist_id']]);
flash('success', 'Item deleted.');
redirect('');
