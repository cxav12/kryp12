<?php $editing = !empty($item['id']); ?>
<form class="item-form" action="<?= e(appUrl('admin/save.php')) ?>" method="post">
  <?= csrfField() ?>
  <?php if ($editing): ?><input type="hidden" name="id" value="<?= (int) $item['id'] ?>"><?php endif; ?>
  <div class="field field-wide">
    <label for="title">Product title</label>
    <input id="title" name="title" maxlength="255" required value="<?= e($item['title'] ?? '') ?>">
  </div>
  <div class="field">
    <label for="retailer">Retailer</label>
    <input id="retailer" name="retailer" maxlength="120" required value="<?= e($item['retailer'] ?? $item['retailer_name'] ?? '') ?>">
  </div>
  <div class="field">
    <label for="price">Price</label>
    <input id="price" name="price" inputmode="decimal" placeholder="0.00" value="<?= e((string) ($item['price'] ?? $item['current_price'] ?? '')) ?>">
  </div>
  <div class="field field-wide">
    <label for="product_url">Product URL</label>
    <input id="product_url" name="product_url" type="url" maxlength="2048" required value="<?= e($item['product_url'] ?? '') ?>">
  </div>
  <div class="field field-wide">
    <label for="image_url">Image URL <span>optional</span></label>
    <input id="image_url" name="image_url" type="url" maxlength="2048" value="<?= e($item['image_url'] ?? '') ?>">
  </div>
  <div class="field field-wide">
    <label for="description">Note or description <span>optional</span></label>
    <textarea id="description" name="description" maxlength="2000" rows="4"><?= e($item['description'] ?? '') ?></textarea>
  </div>
  <div class="field">
    <label for="quantity">Quantity</label>
    <input id="quantity" name="quantity" type="number" min="1" max="999" value="<?= e((string) ($item['quantity'] ?? 1)) ?>">
  </div>
  <div class="field">
    <label for="priority">Priority</label>
    <select id="priority" name="priority">
      <?php for ($priority = 0; $priority <= 5; $priority++): ?>
        <option value="<?= $priority ?>"<?= (int) ($item['priority'] ?? 0) === $priority ? ' selected' : '' ?>><?= $priority === 0 ? 'No priority' : $priority ?></option>
      <?php endfor; ?>
    </select>
  </div>
  <label class="check-field field-wide">
    <input type="checkbox" name="visibility" value="public"<?= ($item['visibility'] ?? 'private') === 'public' ? ' checked' : '' ?>>
    <span>Visible to public visitors</span>
  </label>
  <div class="form-actions field-wide">
    <a class="button button-quiet" href="<?= e(appUrl()) ?>">Cancel</a>
    <button class="button button-primary" type="submit"><?= $editing ? 'Save changes' : 'Save item' ?></button>
  </div>
</form>
