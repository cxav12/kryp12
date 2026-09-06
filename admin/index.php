<?php
declare(strict_types=1);require __DIR__.'/../account-app/bootstrap.php';$user=requireSuperAdmin();renderAccountHeader('Administration');?>
<section class="card"><h1>Administration</h1><p class="muted">Manage KRYP12 users, application access, and public site visibility.</p></section><section class="grid"><a class="action" href="/admin/users/"><strong>Users &amp; Access</strong><br><span class="muted">Roles and application permissions</span></a><a class="action" href="/admin/sites/"><strong>Site Visibility</strong><br><span class="muted">Choose homepage project cards</span></a></section>
<?php renderAccountFooter();
