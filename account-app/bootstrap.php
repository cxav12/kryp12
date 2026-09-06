<?php
declare(strict_types=1);
$configFile = __DIR__ . '/../wishlist/config.php';
if (!is_file($configFile)) { http_response_code(503); exit('Account configuration is missing.'); }
$config = require $configFile;
require_once __DIR__ . '/../wishlist/app/database.php';
date_default_timezone_set((string)($config['timezone'] ?? 'America/New_York'));
$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name((string)($config['account_session_name'] ?? 'kryp12_session'));
session_set_cookie_params(['lifetime'=>(int)($config['session_lifetime'] ?? 2592000),'path'=>'/','secure'=>$secure,'httponly'=>true,'samesite'=>'Strict']);
ini_set('session.use_strict_mode','1'); ini_set('session.use_only_cookies','1');
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
function h(?string $v): string { return htmlspecialchars($v ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function accountCsrf(): string { return $_SESSION['account_csrf'] ??= bin2hex(random_bytes(32)); }
function requireAccountCsrf(): void { if (!hash_equals(accountCsrf(), (string)($_POST['csrf_token'] ?? ''))) { http_response_code(419); exit('The form expired.'); } }
function schemaReady(): bool { try { return (bool)db()->query("SHOW COLUMNS FROM users LIKE 'role'")->fetch(); } catch (Throwable $e) { return false; } }
function accountUser(): ?array { $id=filter_var($_SESSION['user_id']??null,FILTER_VALIDATE_INT);if(!$id)return null;$fields=schemaReady()?'id,username,display_name,role,is_active':'id,username,display_name,is_active';$s=db()->prepare("SELECT $fields FROM users WHERE id=? AND is_active=1");$s->execute([$id]);$u=$s->fetch()?:null;if($u&&!isset($u['role']))$u['role']='';return $u; }
function requireAccount(): array { $u=accountUser();if(!$u){header('Location: /login/?return='.rawurlencode($_SERVER['REQUEST_URI']??'/account/'));exit;}return $u; }
function requireSuperAdmin(): array { $u=requireAccount();if(($u['role']??'')!=='super_admin'){http_response_code(403);exit('Super administrator access is required.');}return $u; }
function hasAppAccess(array $user,string $key): bool { if(($user['role']??'')==='super_admin')return true;if(!schemaReady())return $key==='wishlist';try{$s=db()->prepare('SELECT 1 FROM user_application_access ua JOIN applications a ON a.id=ua.application_id WHERE ua.user_id=? AND a.application_key=? AND a.is_active=1');$s->execute([$user['id'],$key]);return (bool)$s->fetchColumn();}catch(Throwable $e){return false;} }
function safeReturn(string $path): string { return str_starts_with($path,'/')&&!str_starts_with($path,'//')?$path:'/account/'; }
function accountLogin(string $username,string $password): bool { $s=db()->prepare('SELECT id,password_hash FROM users WHERE username=? AND is_active=1');$s->execute([trim($username)]);$u=$s->fetch();if(!$u||!password_verify($password,$u['password_hash']))return false;session_regenerate_id(true);$_SESSION['user_id']=(int)$u['id'];if(schemaReady())db()->prepare('UPDATE users SET last_login_at=NOW() WHERE id=?')->execute([$u['id']]);return true; }
function accountLogout(): void { global $secure;$_SESSION=[];if(ini_get('session.use_cookies')){setcookie(session_name(),'', ['expires'=>time()-42000,'path'=>'/','secure'=>$secure,'httponly'=>true,'samesite'=>'Strict']);}session_destroy(); }
function renderAccountHeader(string $title): void { $u=accountUser();echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'.h($title).' · KRYP12</title><link rel="stylesheet" href="/assets/account.css?v=1"></head><body><header class="account-top"><a href="/">KRYP12</a><nav>';if($u){echo '<a href="/account/">Account</a>';if(($u['role']??'')==='super_admin')echo '<a href="/admin/">Admin</a>';echo '<form method="post" action="/login/logout.php"><input type="hidden" name="csrf_token" value="'.h(accountCsrf()).'"><button>Sign out</button></form>';}else echo '<a href="/login/">Log in</a>';echo '</nav></header><main class="account-shell">'; }
function renderAccountFooter(): void { echo '</main></body></html>'; }
