<?php
$pageTitle = $pageTitle ?? 'My Wishlist';
$bodyClass = $bodyClass ?? '';
$flashMessage = takeFlash();
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="A personal collection of products and gift ideas.">
  <meta name="theme-color" content="#f7f8fb">
  <title><?= e($pageTitle) ?></title>
  <link rel="icon" type="image/svg+xml" href="<?= e(appUrl('assets/wishlist-logo.svg')) ?>">
  <link rel="stylesheet" href="<?= e(appUrl('assets/styles.css?v=34')) ?>">
</head>
<body class="<?= e($bodyClass) ?>">
  <header class="site-header">
    <a class="site-identity" href="<?= e(appUrl()) ?>">
      <img class="identity-mark" src="<?= e(appUrl('assets/wishlist-logo.svg')) ?>" alt="">
      <strong>My Wishlist</strong>
    </a>
    <nav class="header-actions" aria-label="Account">
      <?php if (isLoggedIn()): ?>
        <span class="welcome">Hello, <?= e(currentUser()['display_name']) ?></span>
        <a class="button button-quiet button-muted" href="<?= e(appUrl('purchased.php')) ?>">Purchased</a>
        <form action="<?= e(appUrl('logout.php')) ?>" method="post">
          <?= csrfField() ?>
          <button class="button button-quiet button-muted" type="submit">Sign out</button>
        </form>
      <?php else: ?>
        <a class="button button-quiet owner-sign-in" href="<?= e(appUrl('login.php')) ?>">
          <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="9" r="3"></circle><path d="M6.8 18.2c1.2-2.5 3-3.7 5.2-3.7s4 1.2 5.2 3.7"></path></svg>
          <span>Login</span>
        </a>
      <?php endif; ?>
    </nav>
  </header>
  <?php if ($bodyClass === 'wishlist-home'): ?>
    <div class="header-divider" aria-hidden="true"></div>
  <?php endif; ?>
  <?php if ($flashMessage): ?>
    <div class="flash flash-<?= e($flashMessage['type']) ?>" role="status"><?= e($flashMessage['message']) ?></div>
  <?php endif; ?>
  <main class="page-shell">
