<?php

declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';
requireLogin();
if (!requestMethod('POST')) redirect('');
requireValidCsrf();

$productUrl = (string) ($_POST['product_url'] ?? '');
try {
    $item = importProduct($productUrl);
} catch (InvalidArgumentException $exception) {
    flash('error', $exception->getMessage());
    redirect('');
}
$item['visibility'] = 'public';
$item['quantity'] = 1;
$item['priority'] = 0;
$pageTitle = 'Review product · Wishlist';
require __DIR__ . '/../templates/header.php';
?>
<section class="editor-header">
  <span class="eyebrow">Review import</span>
  <h1>Confirm product details</h1>
  <p><?= e($item['import_message']) ?></p>
</section>
<?php require __DIR__ . '/../templates/item-form.php'; ?>
<?php require __DIR__ . '/../templates/footer.php'; ?>
