<?php

declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';

$items = wishlistItems(isLoggedIn());
$pageTitle = 'Wishlist';
require __DIR__ . '/templates/header.php';
?>
<section class="hero">
  <div>
    <span class="eyebrow">Personal collection</span>
    <h1>Things I’d love to have.</h1>
    <p>A thoughtfully collected list of products, useful finds, and gift ideas from across the web.</p>
  </div>
  <span class="item-count"><?= count($items) ?> <?= count($items) === 1 ? 'item' : 'items' ?></span>
</section>

<?php if (isLoggedIn()): ?>
  <section class="add-panel" aria-labelledby="add-item-title">
    <div>
      <span class="eyebrow">Quick add</span>
      <h2 id="add-item-title">Paste a product URL</h2>
      <p>Details will be retrieved when available, and you can review everything before saving.</p>
    </div>
    <form class="url-form" action="<?= e(appUrl('admin/import.php')) ?>" method="post">
      <?= csrfField() ?>
      <label class="visually-hidden" for="product-import-url">Product URL</label>
      <input id="product-import-url" name="product_url" type="url" placeholder="https://www.example.com/product" maxlength="2048" required>
      <button class="button button-primary" type="submit">Add item</button>
    </form>
  </section>
<?php endif; ?>

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
