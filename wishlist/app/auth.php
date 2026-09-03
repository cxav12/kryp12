<?php

declare(strict_types=1);

function startSecureSession(array $config): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $sessionLifetime = max(0, (int) ($config['session_lifetime'] ?? 2592000));
    session_name((string) ($config['session_name'] ?? 'wishlist_session'));
    session_set_cookie_params([
        'lifetime' => $sessionLifetime,
        'path' => '/wishlist/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string) max(1440, $sessionLifetime));
    session_start();

    if ($sessionLifetime > 0 && isset($_SESSION['user_id'])) {
        setcookie(session_name(), session_id(), [
            'expires' => time() + $sessionLifetime,
            'path' => '/wishlist/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }
}

function currentUser(): ?array
{
    static $loaded = false;
    static $user;
    if ($loaded) {
        return $user;
    }
    $loaded = true;
    $userId = filter_var($_SESSION['user_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$userId) {
        return null;
    }
    $statement = db()->prepare('SELECT id, username, display_name FROM users WHERE id = ? AND is_active = 1');
    $statement->execute([$userId]);
    $user = $statement->fetch() ?: null;
    return $user;
}

function isLoggedIn(): bool
{
    return currentUser() !== null;
}

function requireLogin(): void
{
    if (!isLoggedIn()) {
        flash('error', 'Please sign in to manage the wishlist.');
        redirect('login.php');
    }
}

function attemptLogin(string $username, string $password): bool
{
    $statement = db()->prepare('SELECT id, password_hash FROM users WHERE username = ? AND is_active = 1');
    $statement->execute([trim($username)]);
    $user = $statement->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) {
        return false;
    }
    if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
        $update = db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $update->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
    }
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];
    return true;
}

function logoutUser(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'],
            'domain' => $params['domain'] ?? '',
            'secure' => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => $params['samesite'] ?? 'Strict',
        ]);
    }
    session_destroy();
}
