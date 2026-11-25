<?php
// Enumerate rendered PHP views: PHP source itself cannot run offline.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow, noarchive');
require __DIR__ . '/app/content.php';
$resources = ['./', './?view=library', './?view=cards', './manifest.json'];
foreach (glob(__DIR__ . '/assets/*') as $file) {
    if (is_file($file)) {
        $asset = 'assets/' . basename($file);
        $resources[] = $asset;
        if (in_array(pathinfo($file, PATHINFO_EXTENSION), ['css', 'js'], true)) {
            $resources[] = $asset . '?v=' . filemtime($file);
        }
    }
}
foreach (eccLoadTopics() as $topic) {
    foreach (['topic', 'cards'] as $view) {
        $resources[] = './?' . http_build_query(['view' => $view, 'topic' => $topic['slug']]);
    }
    if ($topic['slug'] === 'fire-stations') {
        foreach (['station', 'battalion'] as $group) {
            foreach (['0', '1'] as $compact) {
                $resources[] = './?view=topic&topic=fire-stations&group=' . $group . '&compact=' . $compact;
            }
        }
    }
    if ($topic['slug'] === 'highway-exits') {
        $resources[] = './?view=topic&topic=highway-exits&compact=1';
    }
}
echo json_encode($resources, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
