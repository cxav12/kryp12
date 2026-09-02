<?php

declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';
requireLogin();

$items = purchasedItems();
$pageTitle = 'Purchased items · Wishlist';
require __DIR__ . '/templates/header.php';
?>
<section class="purchased-header">
  <div>
    <span class="eyebrow">Purchase history</span>
    <h1>Purchased items</h1>
    <p>Products moved from your active wishlist.</p>
  </div>
  <a class="button button-quiet" href="<?= e(appUrl()) ?>">Back to wishlist</a>
</section>

<?php if ($items): ?>
  <section class="purchased-list" aria-label="Purchased items">
    <?php foreach ($items as $item): ?>
      <article class="purchased-item">
        <a class="purchased-product" href="<?= e($item['product_url']) ?>" target="_blank" rel="noopener noreferrer">
          <span class="purchased-image">
            <?php if ($item['image_url']): ?>
              <img src="<?= e($item['image_url']) ?>" alt="" loading="lazy" referrerpolicy="no-referrer">
            <?php else: ?>
              <span aria-hidden="true">♡</span>
            <?php endif; ?>
          </span>
          <span class="purchased-copy">
            <span class="retailer-badge"><?= e($item['retailer_name']) ?></span>
            <strong><?= e($item['title']) ?></strong>
            <?php if ($item['current_price'] !== null): ?><span><?= e(money($item['current_price'])) ?></span><?php endif; ?>
          </span>
        </a>
        <div class="purchase-date">
          <span>Purchased</span>
          <strong><?= e((new DateTimeImmutable($item['purchased_at']))->format('M j, Y')) ?></strong>
        </div>
        <form action="<?= e(appUrl('admin/purchase.php')) ?>" method="post">
          <?= csrfField() ?>
          <input type="hidden" name="id" value="<?= (int) $item['id'] ?>">
          <input type="hidden" name="action" value="restore">
          <button class="button button-quiet button-muted" type="submit">Return to wishlist</button>
        </form>
      </article>
    <?php endforeach; ?>
  </section>
<?php else: ?>
  <section class="empty-state">
    <span aria-hidden="true">✓</span>
    <h2>No purchased items yet</h2>
    <p>Items you mark as purchased will appear here.</p>
  </section>
<?php endif; ?>
<?php require __DIR__ . '/templates/footer.php'; ?>
