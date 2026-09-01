<?php
declare(strict_types=1);

const CONTACT_PAGE_ENABLED = false;
if (!CONTACT_PAGE_ENABLED) {
    header('Location: /yankees/', true, 302);
    exit;
}

$isHttps = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/yankees/',
    'secure' => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

if (empty($_SESSION['contact_csrf'])) {
    $_SESSION['contact_csrf'] = bin2hex(random_bytes(32));
}

$status = isset($_GET['status']) ? (string) $_GET['status'] : '';
$messages = [
    'sent' => ['success', 'Your message was sent successfully.'],
    'invalid' => ['error', 'Please check the form fields and try again.'],
    'expired' => ['error', 'The form expired. Please reload the page and try again.'],
    'rate' => ['error', 'Please wait a moment before sending another message.'],
    'error' => ['error', 'The message could not be sent. Please try again later.'],
];
$notice = $messages[$status] ?? null;
?>
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preload" as="image" href="/yankees/assets/yankees-header-background.webp" type="image/webp" fetchpriority="high" />
    <base href="/yankees/contact/" />
    <title>Contact | Yankees Fan Site</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
    <link rel="stylesheet" href="../shared.css?v=20260831-muted-header4" />
  </head>
  <body>
    <main class="container-fluid app-shell">
      <section class="overflow-hidden position-relative">
        <header class="topbar d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
          <a class="brand-lockup d-flex align-items-center gap-3" href="../" aria-label="Yankees home">
            <img class="brand-logo" src="../assets/new-york-yankees.svg" alt="New York Yankees logo" />
            <div>
              <h1 class="display-title brand-title mb-0">New York Yankees</h1>
            </div>
          </a>
        </header>

        <details class="site-nav">
          <summary><span>Menu</span><span class="site-nav-icon" aria-hidden="true"></span></summary>
          <nav class="site-nav-links" aria-label="Yankees sections">
            <a class="site-nav-link" href="../">Home</a>
            <a class="site-nav-link" href="../player-profile/">Player Profile</a>
            <a class="site-nav-link" href="../player-stats/">Stats</a>
            <a class="site-nav-link" href="../schedule/">Schedule</a>
            <a class="site-nav-link" href="../team-overview/">Team Overview</a>
            <a class="site-nav-link" href="../around-the-league/">Around the League</a>
          </nav>
        </details>
        <nav class="desktop-site-nav navbar navbar-expand" aria-label="Yankees sections">
          <div class="navbar-nav">
            <a class="nav-link" href="../">Home</a>
            <a class="nav-link" href="../player-profile/">Player Profile</a>
            <a class="nav-link" href="../player-stats/">Stats</a>
            <a class="nav-link" href="../schedule/">Schedule</a>
            <a class="nav-link" href="../team-overview/">Team Overview</a>
            <a class="nav-link" href="../around-the-league/">Around the League</a>
          </div>
        </nav>
      </section>

      <header class="page-intro-card">
        <h2 class="page-heading">Contact</h2>
        <p class="page-intro-description">Questions, comments, or a suggestion from the dugout? Send me a message.</p>
      </header>

      <section class="contact-card" aria-labelledby="contact-form-title">
        <h3 class="visually-hidden" id="contact-form-title">Contact form</h3>
        <?php if ($notice !== null): ?>
          <div class="contact-alert contact-alert-<?= htmlspecialchars($notice[0], ENT_QUOTES, 'UTF-8') ?>" role="<?= $notice[0] === 'success' ? 'status' : 'alert' ?>">
            <?= htmlspecialchars($notice[1], ENT_QUOTES, 'UTF-8') ?>
          </div>
        <?php endif; ?>

        <form class="contact-form" method="post" action="submit.php">
          <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION['contact_csrf'], ENT_QUOTES, 'UTF-8') ?>" />
          <input type="hidden" name="form_started" value="<?= time() ?>" />

          <div class="contact-honeypot" aria-hidden="true">
            <label for="company-website">Leave this field blank</label>
            <input id="company-website" name="company_website" type="text" tabindex="-1" autocomplete="off" />
          </div>

          <div class="contact-form-grid">
            <div class="contact-field">
              <label for="name">Name</label>
              <input class="form-control" id="name" name="name" type="text" maxlength="100" autocomplete="name" required />
            </div>

            <div class="contact-field">
              <label for="email">Email</label>
              <input class="form-control" id="email" name="email" type="email" maxlength="254" autocomplete="email" required />
            </div>

            <div class="contact-field contact-field-full">
              <label for="subject">Subject</label>
              <input class="form-control" id="subject" name="subject" type="text" maxlength="150" required />
            </div>

            <div class="contact-field contact-field-full">
              <label for="message">Message</label>
              <textarea class="form-control" id="message" name="message" maxlength="5000" required></textarea>
              <p class="contact-help">Maximum 5,000 characters. Your email address is used only to reply to your message. See the <a href="../privacy-policy/">Privacy Policy</a>.</p>
            </div>
          </div>

          <button class="btn btn-yankees contact-submit" type="submit">Send Message</button>
        </form>
      </section>

      <footer class="site-footer">
        <nav class="site-footer-links" aria-label="Footer">
          <a class="site-footer-link site-footer-item" href="/yankees/">Home</a>
          <a class="site-footer-link site-footer-item" href="../legal-disclaimer/">Legal Disclaimer</a>
        </nav>
      </footer>
    </main>
    <script src="../assets/js/shared.js?v=20260831-header-games-back2" defer></script>
  </body>
</html>
