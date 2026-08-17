<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

function redirectWithStatus(string $status): void
{
    header('Location: /yankees/contact/?status=' . rawurlencode($status), true, 303);
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

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit('Method Not Allowed');
}

$submittedToken = isset($_POST['csrf_token']) ? (string) $_POST['csrf_token'] : '';
$sessionToken = isset($_SESSION['contact_csrf']) ? (string) $_SESSION['contact_csrf'] : '';
if ($submittedToken === '' || $sessionToken === '' || !hash_equals($sessionToken, $submittedToken)) {
    redirectWithStatus('expired');
}

// Bots commonly complete fields hidden from human visitors.
if (!empty($_POST['company_website'])) {
    redirectWithStatus('sent');
}

$started = filter_input(INPUT_POST, 'form_started', FILTER_VALIDATE_INT);
$elapsed = $started === false || $started === null ? 0 : time() - $started;
if ($elapsed < 3 || $elapsed > 7200) {
    redirectWithStatus('expired');
}

$name = trim((string) ($_POST['name'] ?? ''));
$email = trim((string) ($_POST['email'] ?? ''));
$subject = trim((string) ($_POST['subject'] ?? ''));
$message = trim((string) ($_POST['message'] ?? ''));

if (
    $name === '' || strlen($name) > 100 ||
    !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254 ||
    $subject === '' || strlen($subject) > 150 ||
    $message === '' || strlen($message) > 5000
) {
    redirectWithStatus('invalid');
}

// Header values may not contain line breaks.
$name = preg_replace('/[\r\n]+/', ' ', $name) ?? '';
$subject = preg_replace('/[\r\n]+/', ' ', $subject) ?? '';

// Rate-limit each remote address to one accepted attempt per minute.
$remoteAddress = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$rateFile = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
    . DIRECTORY_SEPARATOR
    . 'kryp12-contact-'
    . hash('sha256', $remoteAddress);
$rateHandle = @fopen($rateFile, 'c+');
if ($rateHandle !== false) {
    if (flock($rateHandle, LOCK_EX)) {
        $previous = trim((string) stream_get_contents($rateHandle));
        if ($previous !== '' && ctype_digit($previous) && time() - (int) $previous < 60) {
            flock($rateHandle, LOCK_UN);
            fclose($rateHandle);
            redirectWithStatus('rate');
        }
        ftruncate($rateHandle, 0);
        rewind($rateHandle);
        fwrite($rateHandle, (string) time());
        fflush($rateHandle);
        flock($rateHandle, LOCK_UN);
    }
    fclose($rateHandle);
}

$configPath = '/home/horacqou/contact-config.php';
$phpMailerPath = dirname(__DIR__) . '/vendor/phpmailer';

if (!is_readable($configPath)) {
    error_log('Contact form configuration is missing or unreadable.');
    redirectWithStatus('error');
}

require $phpMailerPath . '/Exception.php';
require $phpMailerPath . '/PHPMailer.php';
require $phpMailerPath . '/SMTP.php';

$config = require $configPath;
$requiredKeys = [
    'smtp_host',
    'smtp_port',
    'smtp_encryption',
    'smtp_username',
    'smtp_password',
    'sender_email',
    'sender_name',
    'recipient_email',
];

if (!is_array($config)) {
    error_log('Contact form configuration did not return an array.');
    redirectWithStatus('error');
}

foreach ($requiredKeys as $key) {
    if (!isset($config[$key]) || $config[$key] === '') {
        error_log('Contact form configuration is missing a required value.');
        redirectWithStatus('error');
    }
}

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host = (string) $config['smtp_host'];
    $mail->Port = (int) $config['smtp_port'];
    $mail->SMTPAuth = true;
    $mail->Username = (string) $config['smtp_username'];
    $mail->Password = (string) $config['smtp_password'];
    $mail->SMTPSecure = (string) $config['smtp_encryption'];
    $mail->Timeout = 15;
    $mail->CharSet = 'UTF-8';

    $mail->setFrom((string) $config['sender_email'], (string) $config['sender_name']);
    $mail->addAddress((string) $config['recipient_email']);
    $mail->addReplyTo($email, $name);
    $mail->Subject = '[Kryp12 Contact] ' . $subject;
    $mail->Body = "A message was submitted through the Kryp12 website.\n\n"
        . "Name: {$name}\n"
        . "Email: {$email}\n"
        . "Subject: {$subject}\n\n"
        . "Message:\n{$message}\n";
    $mail->AltBody = $mail->Body;
    $mail->send();

    unset($_SESSION['contact_csrf']);
    redirectWithStatus('sent');
} catch (Throwable $exception) {
    error_log('Contact form mail delivery failed: ' . $mail->ErrorInfo);
    redirectWithStatus('error');
}
