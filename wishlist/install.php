<?php

declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';

$count = (int) db()->query('SELECT COUNT(*) FROM users')->fetchColumn();
$configuredInstallKey = (string) ($config['install_key'] ?? '');
if ($count > 0 || $configuredInstallKey === '') {
    http_response_code(404);
    exit('Not found.');
}
$error = '';
if (requestMethod('POST')) {
    requireValidCsrf();
    $installKey = (string) ($_POST['install_key'] ?? '');
    $username = trim((string) ($_POST['username'] ?? ''));
    $displayName = trim((string) ($_POST['display_name'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');
    if (!hash_equals($configuredInstallKey, $installKey)) $error = 'The installation key is incorrect.';
    elseif (!preg_match('/^[A-Za-z0-9_.-]{3,80}$/', $username)) $error = 'Use 3–80 letters, numbers, periods, underscores, or hyphens for the username.';
    elseif ($displayName === '' || mb_strlen($displayName) > 120) $error = 'Enter a display name.';
    elseif (strlen($password) < 12) $error = 'Use a password with at least 12 characters.';
    else {
        db()->beginTransaction();
        try {
            $user = db()->prepare('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)');
            $user->execute([$username, password_hash($password, PASSWORD_DEFAULT), $displayName]);
            $userId = (int) db()->lastInsertId();
            $list = db()->prepare("INSERT INTO wishlists (user_id, name, slug, visibility) VALUES (?, ?, 'main', 'public')");
            $list->execute([$userId, $displayName . "'s Wishlist"]);
            db()->commit();
            flash('success', 'The owner account is ready. You can now sign in.');
            redirect('login.php');
        } catch (Throwable $exception) {
            db()->rollBack();
            $error = 'Installation could not be completed.';
        }
    }
}
$pageTitle = 'Set up Wishlist';
$bodyClass = 'auth-page';
require __DIR__ . '/templates/header.php';
?>
<section class="auth-card">
  <span class="eyebrow">First-time setup</span>
  <h1>Create the owner account</h1>
  <p>This page stops working after the first account is created.</p>
  <?php if ($error): ?><div class="inline-error" role="alert"><?= e($error) ?></div><?php endif; ?>
  <form class="stack-form" method="post">
    <?= csrfField() ?>
    <label for="install_key">Installation key</label>
    <input id="install_key" name="install_key" type="password" required>
    <label for="display_name">Display name</label>
    <input id="display_name" name="display_name" maxlength="120" required>
    <label for="username">Username</label>
    <input id="username" name="username" maxlength="80" autocomplete="username" required>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" minlength="12" autocomplete="new-password" required>
    <button class="button button-primary" type="submit">Create account</button>
  </form>
</section>
<?php require __DIR__ . '/templates/footer.php'; ?>
