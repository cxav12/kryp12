<?php
declare(strict_types=1);
require __DIR__.'/../account-app/bootstrap.php';
if(accountUser()){header('Location: /account/');exit;}
$error='';$return=safeReturn((string)($_GET['return']??$_POST['return']??'/account/'));
if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){requireAccountCsrf();if(accountLogin((string)($_POST['username']??''),(string)($_POST['password']??''))){header('Location: '.$return,true,303);exit;}usleep(350000);$error='The username or password was incorrect.';}
renderAccountHeader('Log in','login-page');
?>
<link rel="stylesheet" href="/assets/account-logo.css?v=1">
<svg class="contour-motion" id="contour-motion" viewBox="0 0 1440 1000" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs><linearGradient id="contour-trace" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#6f9abb"/><stop offset="1" stop-color="#719a7d"/></linearGradient></defs>
  <g stroke="url(#contour-trace)" stroke-width="1.25" stroke-linecap="round" stroke-dasharray="105 1100" stroke-dashoffset="1150">
    <path class="trace" d="M-120 840C300 740-80 470 250 360S380 70 790-60"/><path class="trace" d="M-90 900C370 730-10 470 290 390S430 80 850-40"/><path class="trace" d="M-60 950C400 770 20 510 340 420S490 90 910-20"/><path class="trace" d="M-30 1010C450 810 80 540 390 450S550 100 970 0"/><path class="trace" d="M0 1060C500 850 140 570 440 480S610 110 1030 20"/><path class="trace" d="M1560 160C1140 260 1520 530 1190 640S1060 930 650 1060"/><path class="trace" d="M1530 100C1070 270 1450 530 1150 610S1010 920 590 1040"/><path class="trace" d="M1500 50C1040 230 1420 490 1100 580S950 910 530 1020"/><path class="trace" d="M1470-10C990 190 1360 460 1050 550S890 900 470 1000"/><path class="trace" d="M1440-60C940 150 1300 430 1000 520S830 890 410 980"/>
  </g>
</svg>
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
<script src="/assets/account.js?v=1" defer></script>
<?php renderAccountFooter();
