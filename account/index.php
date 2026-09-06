<?php
declare(strict_types=1);
require __DIR__.'/../account-app/bootstrap.php';
$user=requireAccount();renderAccountHeader('Account');
?>
<section class="card"><h1>Hello, <?=h($user['display_name'])?></h1><p class="muted">Your central KRYP12 account.</p><?php if(!schemaReady()):?><p class="error">Administrator setup has not been completed. <a class="button" href="/admin/setup.php">Run setup</a></p><?php endif?></section>
<section class="grid"><?php if(hasAppAccess($user,'wishlist')):?><a class="action" href="/wishlist/"><strong>Wishlist</strong><br><span class="muted">View your wishlist</span></a><?php endif?><?php if(($user['role']??'')==='super_admin'):?><a class="action" href="/admin/"><strong>Administration</strong><br><span class="muted">Manage users, access, and sites</span></a><?php endif?></section>
<?php renderAccountFooter();
