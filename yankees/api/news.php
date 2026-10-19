<?php
declare(strict_types=1);
// Fixed upstream: this endpoint cannot be used as an arbitrary URL proxy.
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
$cachePath = sys_get_temp_dir() . '/kryp12-yankees-headlines-v1.json';
$cached = is_file($cachePath) ? json_decode((string) @file_get_contents($cachePath), true) : null;
if (is_array($cached) && isset($cached['fetchedAt'], $cached['items']) && time() - (int) $cached['fetchedAt'] < 600) {
    echo json_encode($cached, JSON_UNESCAPED_SLASHES);
    exit;
}
try {
    $url = 'https://www.mlb.com/yankees/feeds/news/rss.xml';
    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_TIMEOUT => 8, CURLOPT_FOLLOWLOCATION => false, CURLOPT_USERAGENT => 'Kryp12 Yankees News Reader']);
        $xml = curl_exec($curl);
        $code = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        if ($xml === false || $code !== 200) throw new RuntimeException('Upstream unavailable');
    } else {
        $context = stream_context_create(['http' => ['timeout' => 8, 'follow_location' => 0, 'user_agent' => 'Kryp12 Yankees News Reader']]);
        $xml = @file_get_contents($url, false, $context);
        if ($xml === false) throw new RuntimeException('Upstream unavailable');
    }
    if (strlen($xml) > 2000000) throw new RuntimeException('Invalid feed');
    libxml_use_internal_errors(true);
    $feed = simplexml_load_string($xml, 'SimpleXMLElement', LIBXML_NONET | LIBXML_NOCDATA);
    if ($feed === false) throw new RuntimeException('Invalid feed');
    $items = [];
    foreach ($feed->channel->item as $item) {
        $link = (string) $item->link;
        $parts = parse_url($link);
        if (($parts['scheme'] ?? '') !== 'https' || !in_array($parts['host'] ?? '', ['www.mlb.com', 'mlb.com'], true)) continue;
        $title = trim(strip_tags((string) $item->title));
        if ($title === '') continue;
        $timestamp = strtotime((string) $item->pubDate);
        $items[] = ['title' => $title, 'url' => $link, 'date' => $timestamp === false ? '' : (new DateTimeImmutable('@' . $timestamp))->setTimezone(new DateTimeZone('America/New_York'))->format('Y-m-d')];
        if (count($items) === 4) break;
    }
    if (!$items) throw new RuntimeException('Empty feed');
    $result = ['fetchedAt' => time(), 'stale' => false, 'items' => $items];
    $encoded = json_encode($result, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $temp = @tempnam(sys_get_temp_dir(), 'yankees-news-');
    if ($temp !== false) {
        if (@file_put_contents($temp, $encoded, LOCK_EX) !== false) @rename($temp, $cachePath);
        if (is_file($temp)) @unlink($temp);
    }
    echo $encoded;
} catch (Throwable $error) {
    if (is_array($cached) && isset($cached['items'])) {
        $cached['stale'] = true;
        echo json_encode($cached, JSON_UNESCAPED_SLASHES);
    } else {
        http_response_code(503);
        echo json_encode(['error' => 'Headlines unavailable', 'items' => []]);
    }
}
