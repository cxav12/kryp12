<?php

declare(strict_types=1);

function e(?string $value): string
{
    return htmlspecialchars($value ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function appUrl(string $path = ''): string
{
    global $config;
    return rtrim((string) ($config['app_url'] ?? '/wishlist'), '/') . '/' . ltrim($path, '/');
}

function redirect(string $path): never
{
    header('Location: ' . appUrl($path), true, 303);
    exit;
}

function flash(string $type, string $message): void
{
    $_SESSION['flash'] = ['type' => $type, 'message' => $message];
}

function takeFlash(): ?array
{
    $message = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return is_array($message) ? $message : null;
}

function csrfToken(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrfField(): string
{
    return '<input type="hidden" name="csrf_token" value="' . e(csrfToken()) . '">';
}

function requireValidCsrf(): void
{
    $submitted = (string) ($_POST['csrf_token'] ?? '');
    if (!hash_equals(csrfToken(), $submitted)) {
        http_response_code(419);
        exit('The form expired. Please go back and try again.');
    }
}

function requestMethod(string $method): bool
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') === strtoupper($method);
}

function money(?string $price): string
{
    return $price === null || $price === '' ? '' : '$' . number_format((float) $price, 2);
}
