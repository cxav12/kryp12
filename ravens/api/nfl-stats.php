<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

$slug = strtolower((string)($_GET['slug'] ?? ''));
if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) || strlen($slug) > 120) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid game slug.']);
    exit;
}

$cacheFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'kryp12-nfl-stats-' . sha1($slug) . '.json';
if (is_file($cacheFile) && filemtime($cacheFile) > time() - 300) {
    readfile($cacheFile);
    exit;
}

$url = 'https://www.nfl.com/games/' . rawurlencode($slug) . '?tab=stats';
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
    echo json_encode(['error' => 'NFL statistics are temporarily unavailable.']);
    exit;
}

$decoded = str_replace('\\"', '"', $html);
preg_match_all('/(\{"table":(?:(?!\{"table":).)*?\},"title":"([A-Z]{2,3}) RECEIVING"\})/s', $decoded, $matches, PREG_SET_ORDER);
$teams = [];
foreach ($matches as $match) {
    $section = json_decode($match[1], true);
    if (!is_array($section)) continue;
    $columns = array_map(static fn(array $column): string => strtoupper((string)($column['title'] ?? '')), $section['table']['columns'] ?? []);
    $yacIndex = array_search('YAC', $columns, true);
    if ($yacIndex === false) continue;
    $rows = [];
    foreach ($section['table']['rows'] ?? [] as $row) {
        $name = trim((string)($row[0]['text'] ?? ''));
        $yac = $row[$yacIndex]['text'] ?? null;
        if ($name !== '' && is_numeric($yac)) $rows[] = ['name' => $name, 'yac' => (float)$yac];
    }
    $teams[$match[2]] = $rows;
}

if (!$teams) {
    http_response_code(502);
    echo json_encode(['error' => 'NFL receiving statistics were not found.']);
    exit;
}

$payload = json_encode(['source' => 'NFL.com', 'game' => $slug, 'teams' => $teams], JSON_UNESCAPED_SLASHES);
if (is_string($payload)) {
    @file_put_contents($cacheFile, $payload, LOCK_EX);
    echo $payload;
}
