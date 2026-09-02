<?php

declare(strict_types=1);

function primaryWishlistId(int $userId): ?int
{
    $statement = db()->prepare('SELECT id FROM wishlists WHERE user_id = ? ORDER BY id LIMIT 1');
    $statement->execute([$userId]);
    $id = $statement->fetchColumn();
    return $id === false ? null : (int) $id;
}

function wishlistItems(bool $includePrivate): array
{
    $sql = 'SELECT i.*, r.name AS retailer_name
            FROM items i
            INNER JOIN wishlists w ON w.id = i.wishlist_id
            INNER JOIN retailers r ON r.id = i.retailer_id
            WHERE i.archived_at IS NULL';
    $params = [];
    if ($includePrivate) {
        $sql .= ' AND w.user_id = ?';
        $params[] = (int) currentUser()['id'];
    } else {
        $sql .= " AND i.visibility = 'public' AND w.visibility = 'public'";
    }
    $sql .= ' ORDER BY i.priority DESC, i.created_at DESC';
    $statement = db()->prepare($sql);
    $statement->execute($params);
    return $statement->fetchAll();
}

function ownedItem(int $itemId): ?array
{
    $statement = db()->prepare('SELECT i.*, r.name AS retailer_name
        FROM items i
        INNER JOIN wishlists w ON w.id = i.wishlist_id
        INNER JOIN retailers r ON r.id = i.retailer_id
        WHERE i.id = ? AND w.user_id = ?');
    $statement->execute([$itemId, (int) currentUser()['id']]);
    return $statement->fetch() ?: null;
}

function retailerId(string $name, string $productUrl): int
{
    $name = trim($name) ?: retailerFromHost((string) parse_url($productUrl, PHP_URL_HOST));
    $domain = strtolower((string) parse_url($productUrl, PHP_URL_HOST));
    $find = db()->prepare('SELECT id FROM retailers WHERE domain = ?');
    $find->execute([$domain]);
    $id = $find->fetchColumn();
    if ($id !== false) return (int) $id;
    $insert = db()->prepare('INSERT INTO retailers (name, domain) VALUES (?, ?)');
    $insert->execute([$name, $domain]);
    return (int) db()->lastInsertId();
}

function validatedItemInput(array $input): array
{
    $title = trim((string) ($input['title'] ?? ''));
    $productUrl = normalizeHttpUrl((string) ($input['product_url'] ?? ''));
    $imageUrl = trim((string) ($input['image_url'] ?? ''));
    $retailer = trim((string) ($input['retailer'] ?? ''));
    $description = trim((string) ($input['description'] ?? ''));
    $priceInput = trim((string) ($input['price'] ?? ''));
    $price = $priceInput === '' ? null : filter_var(str_replace([',', '$'], '', $priceInput), FILTER_VALIDATE_FLOAT);
    $priority = max(0, min(5, (int) ($input['priority'] ?? 0)));
    $quantity = max(1, min(999, (int) ($input['quantity'] ?? 1)));
    $errors = [];
    if ($title === '' || mb_strlen($title) > 255) $errors[] = 'Enter a product title of 255 characters or fewer.';
    if ($productUrl === null) $errors[] = 'Enter a valid HTTP or HTTPS product URL.';
    if ($imageUrl !== '' && normalizeHttpUrl($imageUrl) === null) $errors[] = 'Enter a valid HTTP or HTTPS image URL.';
    if ($retailer === '' || mb_strlen($retailer) > 120) $errors[] = 'Enter a retailer name of 120 characters or fewer.';
    if ($priceInput !== '' && ($price === false || $price < 0 || $price > 99999999.99)) $errors[] = 'Enter a valid price.';
    if (mb_strlen($description) > 2000) $errors[] = 'Keep the description under 2,000 characters.';
    return [$errors, [
        'title' => $title,
        'product_url' => $productUrl ?? '',
        'image_url' => $imageUrl,
        'retailer' => $retailer,
        'description' => $description,
        'price' => $price === false ? null : $price,
        'visibility' => ($input['visibility'] ?? '') === 'public' ? 'public' : 'private',
        'priority' => $priority,
        'quantity' => $quantity,
    ]];
}

function saveItem(array $data, ?int $itemId = null): int
{
    $user = currentUser();
    $listId = primaryWishlistId((int) $user['id']);
    if (!$listId) throw new RuntimeException('No wishlist is available for this account.');
    $retailerId = retailerId($data['retailer'], $data['product_url']);
    if ($itemId) {
        if (!ownedItem($itemId)) throw new RuntimeException('Item not found.');
        $statement = db()->prepare('UPDATE items SET retailer_id = ?, title = ?, description = ?, product_url = ?, image_url = ?, current_price = ?, quantity = ?, priority = ?, visibility = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND wishlist_id = ?');
        $statement->execute([$retailerId, $data['title'], $data['description'] ?: null, $data['product_url'], $data['image_url'] ?: null, $data['price'], $data['quantity'], $data['priority'], $data['visibility'], $itemId, $listId]);
        return $itemId;
    }
    $statement = db()->prepare('INSERT INTO items (wishlist_id, retailer_id, title, description, product_url, image_url, original_price, current_price, quantity, priority, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $statement->execute([$listId, $retailerId, $data['title'], $data['description'] ?: null, $data['product_url'], $data['image_url'] ?: null, $data['price'], $data['price'], $data['quantity'], $data['priority'], $data['visibility']]);
    return (int) db()->lastInsertId();
}
