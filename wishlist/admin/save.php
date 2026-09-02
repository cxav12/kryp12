<?php

declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';
requireLogin();
if (!requestMethod('POST')) {
    http_response_code(405);
    exit('Method not allowed.');
}
requireValidCsrf();
[$errors, $data] = validatedItemInput($_POST);
$itemId = filter_var($_POST['id'] ?? null, FILTER_VALIDATE_INT) ?: null;
if ($errors) {
    $item = array_merge($data, ['id' => $itemId, 'retailer' => $data['retailer']]);
    $pageTitle = ($itemId ? 'Edit item' : 'Review product') . ' · Wishlist';
    require __DIR__ . '/../templates/header.php';
    echo '<section class="editor-header"><span class="eyebrow">Check details</span><h1>Correct the product information</h1><div class="inline-error" role="alert">' . e(implode(' ', $errors)) . '</div></section>';
    require __DIR__ . '/../templates/item-form.php';
    require __DIR__ . '/../templates/footer.php';
    exit;
}
saveItem($data, $itemId ? (int) $itemId : null);
flash('success', $itemId ? 'Item updated.' : 'Item added to the wishlist.');
redirect('');
