<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=900');

$cacheFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'kryp12-ravens-transactions-v2.json';
if (is_file($cacheFile) && filemtime($cacheFile) > time() - 900) {
    readfile($cacheFile);
    exit;
}

$url = 'https://www.baltimoreravens.com/team/transactions/';
$html = false;
if (function_exists('curl_init')) {
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_ENCODING => '',
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; Kryp12-Ravens/1.0)',
    ]);
    $html = curl_exec($curl);
    $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);
    if ($status < 200 || $status >= 300) $html = false;
} else {
    $context = stream_context_create(['http' => ['timeout' => 12, 'header' => "User-Agent: Mozilla/5.0 (compatible; Kryp12-Ravens/1.0)\r\n"]]);
    $html = @file_get_contents($url, false, $context);
}

if (!is_string($html) || $html === '') {
    http_response_code(502);
    echo json_encode(['error' => 'Official Ravens transactions are temporarily unavailable.']);
    exit;
}

$transactions = [];
if (class_exists('DOMDocument')) {
    libxml_use_internal_errors(true);
    $document = new DOMDocument();
    $document->loadHTML($html, LIBXML_NOERROR | LIBXML_NOWARNING);
    $xpath = new DOMXPath($document);
    foreach ($xpath->query('//tr') as $row) {
        $cells = $xpath->query('./th|./td', $row);
        if ($cells->length < 2) continue;
        $dateCell = $cells->item(0);
        $date = $dateCell ? trim((string)$dateCell->textContent) : '';
        $descriptions = [];
        for ($index = 1; $index < $cells->length; $index++) {
            $cell = $cells->item($index);
            if ($cell) $descriptions[] = trim((string)$cell->textContent);
        }
        $description = preg_replace('/\s+/', ' ', trim(implode(' ', $descriptions)));
        if (preg_match('/\b(\d{1,2})\/(\d{1,2})\b/', $date, $parts) && $description !== '') {
            $transactions[] = ['date' => sprintf('%d-%02d-%02d', (int)date('Y'), (int)$parts[1], (int)$parts[2]), 'description' => $description];
        }
    }
    libxml_clear_errors();
}

if (!$transactions) {
    $withLines = preg_replace('/<\/(?:tr|li|p)>/i', "\n", $html);
    $plain = html_entity_decode(strip_tags((string)$withLines), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    foreach (preg_split('/\R+/', $plain) as $line) {
        $line = preg_replace('/\s+/', ' ', trim($line));
        if (preg_match('/^(\d{1,2})\/(\d{1,2})\s+(.+)$/', (string)$line, $parts)) {
            $transactions[] = ['date' => sprintf('%d-%02d-%02d', (int)date('Y'), (int)$parts[1], (int)$parts[2]), 'description' => trim($parts[3])];
        }
    }
}

if (!$transactions) {
    http_response_code(502);
    echo json_encode(['error' => 'No official Ravens transactions were found.']);
    exit;
}

$transactions = array_slice($transactions, 0, 20);
$payload = json_encode(['source' => $url, 'transactions' => $transactions], JSON_UNESCAPED_SLASHES);
if (is_string($payload)) {
    @file_put_contents($cacheFile, $payload, LOCK_EX);
    echo $payload;
}
