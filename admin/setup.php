<?php
declare(strict_types=1);
require __DIR__.'/../account-app/bootstrap.php';
$user=requireAccount();$error='';
if(schemaReady()){header('Location: /admin/');exit;}
if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
  requireAccountCsrf();$password=(string)($_POST['current_password']??'');
  $passwordQuery=db()->prepare('SELECT password_hash FROM users WHERE id=? AND is_active=1');$passwordQuery->execute([$user['id']]);$passwordHash=(string)($passwordQuery->fetchColumn()?:'');
  if($passwordHash===''||!password_verify($password,$passwordHash)){usleep(350000);$error='Your current password is incorrect.';}
  else try{
    db()->exec("ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'user' AFTER display_name, ADD COLUMN last_login_at DATETIME NULL AFTER is_active");
    db()->exec("CREATE TABLE applications (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, application_key VARCHAR(80) NOT NULL UNIQUE, display_name VARCHAR(120) NOT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    db()->exec("CREATE TABLE user_application_access (user_id BIGINT UNSIGNED NOT NULL, application_id BIGINT UNSIGNED NOT NULL, access_level VARCHAR(32) NOT NULL DEFAULT 'user', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY(user_id,application_id), CONSTRAINT fk_access_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT fk_access_app FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    db()->exec("CREATE TABLE site_visibility (site_key VARCHAR(80) PRIMARY KEY, display_name VARCHAR(120) NOT NULL, is_visible TINYINT(1) NOT NULL DEFAULT 0, updated_by BIGINT UNSIGNED NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT fk_visibility_user FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    db()->exec("CREATE TABLE admin_audit_log (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, admin_user_id BIGINT UNSIGNED NULL, action VARCHAR(120) NOT NULL, target_type VARCHAR(80) NULL, target_id VARCHAR(120) NULL, details TEXT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_audit_created(created_at), CONSTRAINT fk_audit_admin FOREIGN KEY(admin_user_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $app=db()->prepare('INSERT INTO applications(application_key,display_name) VALUES (?,?)');foreach(['wishlist'=>'Wishlist','yankees'=>'Yankees','ravens'=>'Ravens','palworld'=>'Palworld'] as $k=>$n)$app->execute([$k,$n]);
    $site=db()->prepare('INSERT INTO site_visibility(site_key,display_name,is_visible) VALUES (?,?,?)');foreach(['yankees'=>['New York Yankees',1],'palworld'=>['Palworld',1],'wishlist'=>['Wishlist',0],'ravens'=>['Baltimore Ravens',0]] as $k=>$v)$site->execute([$k,$v[0],$v[1]]);
    db()->prepare("UPDATE users SET role='super_admin' WHERE id=?")->execute([$user['id']]);
    db()->prepare("INSERT INTO admin_audit_log(admin_user_id,action,details) VALUES (?,'system_setup','Central account system installed')")->execute([$user['id']]);
    header('Location: /admin/',true,303);exit;
  }catch(Throwable $e){$error='Setup could not be completed. No additional setup should be attempted until the database is reviewed.';}
}
renderAccountHeader('Administrator setup');?>
<section class="card" style="max-width:600px;margin-inline:auto"><h1>One-time administrator setup</h1><p class="muted">Confirm your current account password. The signed-in account will become the first super administrator.</p><?php if($error):?><p class="error"><?=h($error)?></p><?php endif?><form method="post"><input type="hidden" name="csrf_token" value="<?=h(accountCsrf())?>"><label class="field">Current password<input type="password" name="current_password" autocomplete="current-password" required></label><button>Install account system</button></form></section>
<?php renderAccountFooter();
