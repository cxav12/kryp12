<?php
declare(strict_types=1);
require __DIR__.'/../account-app/bootstrap.php';
if(accountUser()){header('Location: /account/');exit;}
$error='';$return=safeReturn((string)($_GET['return']??$_POST['return']??'/account/'));
if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){requireAccountCsrf();if(accountLogin((string)($_POST['username']??''),(string)($_POST['password']??''))){header('Location: '.$return,true,303);exit;}usleep(350000);$error='The username or password was incorrect.';}
renderAccountHeader('Log in','login-page');
?>
<section class="card" style="max-width:460px;margin-inline:auto"><h1>Log in</h1><p class="muted">Use your KRYP12 account to access available applications.</p><?php if($error):?><p class="error" role="alert"><?=h($error)?></p><?php endif?><form method="post"><input type="hidden" name="csrf_token" value="<?=h(accountCsrf())?>"><input type="hidden" name="return" value="<?=h($return)?>"><label class="field">Username<input name="username" autocomplete="username" required autofocus></label><label class="field">Password<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">Log in</button></form></section>
<?php renderAccountFooter();
