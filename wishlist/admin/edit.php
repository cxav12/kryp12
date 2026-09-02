<?php

declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';
requireLogin();
$itemId = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
$item = $itemId ? ownedItem((int) $itemId) : null;
if (!$item) {
    http_response_code(404);
    exit('Item not found.');
}
$pageTitle = 'Edit item · Wishlist';
require __DIR__ . '/../templates/header.php';
?>
<section class="editor-header">
  <span class="eyebrow">Manage item</span>
  <h1>Edit product</h1>
  <p>Update the saved details or change who can see this item.</p>
</section>
<?php require __DIR__ . '/../templates/item-form.php'; ?>
<?php require __DIR__ . '/../templates/footer.php'; ?>
