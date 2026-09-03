<?php

declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';

$items = wishlistItems(isLoggedIn());
$pageTitle = 'Wishlist';
$bodyClass = 'wishlist-home';
require __DIR__ . '/templates/header.php';
?>
<?php if (isLoggedIn()): ?>
  <section class="add-panel" aria-labelledby="add-item-title">
    <div>
      <span class="eyebrow">Quick add</span>
      <h2 id="add-item-title">Paste a product URL</h2>
    </div>
    <form class="url-form" action="<?= e(appUrl('admin/import.php')) ?>" method="post">
      <?= csrfField() ?>
      <label class="visually-hidden" for="product-import-url">Product URL</label>
      <input id="product-import-url" name="product_url" type="url" placeholder="https://www.example.com/product" maxlength="2048" required>
      <button class="button button-primary" type="submit">Add item</button>
    </form>
  </section>
<?php endif; ?>

<div class="item-summary">
  <span class="eyebrow">Personal collection</span>
  <span class="item-count"><?= count($items) ?> <?= count($items) === 1 ? 'item' : 'items' ?></span>
</div>

<?php if ($items): ?>
  <section class="product-grid" aria-label="Wishlist items">
    <?php foreach ($items as $item) require __DIR__ . '/templates/item-card.php'; ?>
  </section>
<?php else: ?>
  <section class="empty-state">
    <span aria-hidden="true">♡</span>
    <h2>No public items yet</h2>
    <p><?= isLoggedIn() ? 'Paste a product URL above to add the first item.' : 'Check back soon for new wishlist ideas.' ?></p>
  </section>
<?php endif; ?>
<?php require __DIR__ . '/templates/footer.php'; ?>
