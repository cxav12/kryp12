<?php
declare(strict_types=1);
function eccEscape(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function eccText($value): bool { return is_string($value) && trim($value) !== ''; }
function eccValidTopic($t): bool {
    if (!is_array($t)) return false;
    foreach (['id', 'slug', 'title', 'category', 'summary', 'status', 'lastReviewed'] as $key) if (!eccText($t[$key] ?? null)) return false;
    foreach (['id', 'slug'] as $key) if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $t[$key])) return false;
    if (!in_array($t['status'], ['general-reference', 'department-approved'], true)) return false;
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $t['lastReviewed']);
    if (!$date || $date->format('Y-m-d') !== $t['lastReviewed']) return false;
    foreach (['sections', 'sources', 'flashcards', 'quiz'] as $key) if (!isset($t[$key]) || !is_array($t[$key]) || array_values($t[$key]) !== $t[$key]) return false;
    if (!$t['sections'] || !$t['sources']) return false;
    foreach ($t['sources'] as $s) if (!is_array($s) || !eccText($s['title'] ?? null) || !is_string($s['url'] ?? null) || !filter_var($s['url'], FILTER_VALIDATE_URL) || !in_array(parse_url($s['url'], PHP_URL_SCHEME), ['http', 'https'], true)) return false;
    foreach ($t['sections'] as $s) {
        if (!is_array($s) || !eccText($s['heading'] ?? null)) return false;
        if (isset($s['text']) && !eccText($s['text'])) return false;
        if (isset($s['items'])) {
            if (!is_array($s['items']) || !$s['items'] || array_values($s['items']) !== $s['items']) return false;
            foreach ($s['items'] as $item) if (!is_array($item) || !eccText($item['label'] ?? null) || !eccText($item['text'] ?? null)) return false;
        }
        if (!isset($s['text']) && !isset($s['items'])) return false;
    }
    foreach ($t['flashcards'] as $c) if (!is_array($c) || !eccText($c['question'] ?? null) || !eccText($c['answer'] ?? null)) return false;
    foreach ($t['quiz'] as $q) {
        if (!is_array($q) || !eccText($q['question'] ?? null) || !eccText($q['explanation'] ?? null) || !is_array($q['choices'] ?? null) || count($q['choices']) < 2 || array_values($q['choices']) !== $q['choices']) return false;
        foreach ($q['choices'] as $choice) if (!eccText($choice)) return false;
        if (!is_int($q['correctIndex'] ?? null) || !isset($q['choices'][$q['correctIndex']])) return false;
    }
    return true;
}
function eccLoadTopics(?string $directory = null): array {
    $topics = []; $ids = [];
    foreach (glob(($directory ?? __DIR__ . '/../content') . '/*.json') ?: [] as $file) {
        try {
            $raw = file_get_contents($file);
            if ($raw === false) throw new RuntimeException('Unreadable content');
            $t = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
            if (!eccValidTopic($t) || isset($topics[$t['slug']]) || isset($ids[$t['id']])) throw new RuntimeException('Invalid or duplicate topic');
            $topics[$t['slug']] = $t; $ids[$t['id']] = true;
        } catch (Throwable $error) { error_log('ECC: skipped ' . basename($file) . ': ' . $error->getMessage()); }
    }
    uasort($topics, function ($a, $b) { return strcasecmp($a['title'], $b['title']); });
    return $topics;
}
