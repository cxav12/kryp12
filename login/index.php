<?php
declare(strict_types=1);
require __DIR__.'/../account-app/bootstrap.php';
if(accountUser()){header('Location: /account/');exit;}
$error='';$return=safeReturn((string)($_GET['return']??$_POST['return']??'/account/'));
if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){requireAccountCsrf();if(accountLogin((string)($_POST['username']??''),(string)($_POST['password']??''))){header('Location: '.$return,true,303);exit;}usleep(350000);$error='The username or password was incorrect.';}
renderAccountHeader('Log in','login-page');
?>
<section class="login-card">
  <header class="login-brand" aria-label="KRYP12">
    <img src="/assets/brand/kryp12/kryp12-mark.svg" alt="">
    <strong>RYP12</strong>
  </header>
  <div class="login-body">
    <h1>Sign In</h1>
    <p class="login-intro">Enter your username and password<br>to access your KRYP12 account.</p>
    <?php if($error):?><p class="error" role="alert"><?=h($error)?></p><?php endif?>
    <form method="post">
      <input type="hidden" name="csrf_token" value="<?=h(accountCsrf())?>">
      <input type="hidden" name="return" value="<?=h($return)?>">
      <label class="field">Username<input name="username" placeholder="Enter your username" autocomplete="username" required autofocus></label>
      <label class="field">Password<input name="password" type="password" placeholder="Enter your password" autocomplete="current-password" required></label>
      <label class="remember-row"><input type="checkbox" name="remember_me" value="1" checked><span>Keep me signed in</span></label>
      <div class="login-submit"><button type="submit">Log In</button></div>
    </form>
  </div>
</section>
<?php renderAccountFooter();
