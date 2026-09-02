<article class="product-card<?= $item['visibility'] === 'private' ? ' is-private' : '' ?>">
  <a class="product-link" href="<?= e($item['product_url']) ?>" target="_blank" rel="noopener noreferrer" aria-label="Open <?= e($item['title']) ?> at <?= e($item['retailer_name']) ?>">
    <div class="product-image-wrap">
      <?php if ($item['image_url']): ?>
        <img class="product-image" src="<?= e($item['image_url']) ?>" alt="" loading="lazy" referrerpolicy="no-referrer">
      <?php else: ?>
        <span class="product-placeholder" aria-hidden="true">♡</span>
      <?php endif; ?>
    </div>
    <div class="product-copy">
      <span class="retailer-badge"><?= e($item['retailer_name']) ?></span>
      <h2><?= e($item['title']) ?></h2>
      <?php if ($item['current_price'] !== null): ?><strong class="product-price"><?= e(money($item['current_price'])) ?></strong><?php endif; ?>
      <?php if ($item['description']): ?><p><?= e($item['description']) ?></p><?php endif; ?>
      <span class="open-product">View product <span aria-hidden="true">↗</span></span>
    </div>
  </a>
  <?php if (isLoggedIn()): ?>
    <div class="product-admin">
      <span class="visibility-badge visibility-<?= e($item['visibility']) ?>"><?= e(ucfirst($item['visibility'])) ?></span>
      <a class="text-action" href="<?= e(appUrl('admin/edit.php?id=' . $item['id'])) ?>">Edit</a>
      <form action="<?= e(appUrl('admin/visibility.php')) ?>" method="post">
        <?= csrfField() ?>
        <input type="hidden" name="id" value="<?= (int) $item['id'] ?>">
        <button class="text-action" type="submit"><?= $item['visibility'] === 'public' ? 'Make private' : 'Make public' ?></button>
      </form>
      <form action="<?= e(appUrl('admin/delete.php')) ?>" method="post" data-confirm="Delete this item permanently?">
        <?= csrfField() ?>
        <input type="hidden" name="id" value="<?= (int) $item['id'] ?>">
        <button class="text-action text-danger" type="submit">Delete</button>
      </form>
    </div>
  <?php endif; ?>
</article>
