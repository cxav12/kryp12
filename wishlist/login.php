<?php

declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';

if (isLoggedIn()) redirect('');
$error = '';
if (requestMethod('POST')) {
    requireValidCsrf();
    if (attemptLogin((string) ($_POST['username'] ?? ''), (string) ($_POST['password'] ?? ''))) {
        flash('success', 'Welcome back.');
        redirect('');
    }
    usleep(350000);
    $error = 'The username or password was incorrect.';
}
$pageTitle = 'Owner sign in · Wishlist';
$bodyClass = 'auth-page';
require __DIR__ . '/templates/header.php';
?>
<section class="auth-card">
  <span class="eyebrow">Private access</span>
  <h1>Owner sign in</h1>
  <p>Sign in to add and manage wishlist items.</p>
  <?php if ($error): ?><div class="inline-error" role="alert"><?= e($error) ?></div><?php endif; ?>
  <form class="stack-form" method="post">
    <?= csrfField() ?>
    <label for="username">Username</label>
    <input id="username" name="username" autocomplete="username" required autofocus>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <button class="button button-primary" type="submit">Sign in</button>
  </form>
</section>
<?php require __DIR__ . '/templates/footer.php'; ?>
