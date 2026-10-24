<?php
header('X-Robots-Tag: noindex, nofollow, noarchive', true);
require __DIR__ . '/app/content.php';
$topics = eccLoadTopics();
$view = is_string($_GET['view'] ?? null) ? $_GET['view'] : 'library';
// Keep existing Home bookmarks pointed at the consolidated library.
if ($view === 'home') $view = 'library';
// Keep saved quiz URLs useful while quizzes are hidden.
if ($view === 'quiz') $view = 'cards';
$slug = is_string($_GET['topic'] ?? null) ? $_GET['topic'] : '';
$topic = $topics[$slug] ?? null;
$missing = !in_array($view, ['library', 'topic', 'cards', 'quiz'], true) || ($view === 'topic' && !$topic) || ($slug !== '' && !$topic);
if ($missing) http_response_code(404);
$title = $missing ? 'Topic not found' : ($view === 'topic' ? $topic['title'] : ['library'=>'Reference library','cards'=>'Flashcards','quiz'=>'Practice quiz'][$view]);
function eccLink(string $view, string $slug = ''): string { return './?' . http_build_query(array_filter(['view'=>$view, 'topic'=>$slug])); }
?>
<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#142e36">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="description" content="ECC dispatcher study references and flashcards.">
<title><?= eccEscape($title) ?> · ECC</title><link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/style.css?v=<?= filemtime(__DIR__.'/assets/style.css') ?>">
<?php if ($view === 'topic' && !$missing && in_array($slug, ['phonetic-alphabet', 'phonetic-alphabet-police'], true)): ?>
<script src="assets/alphabet-audio.js?v=<?= filemtime(__DIR__.'/assets/alphabet-audio.js') ?>" defer></script>
<?php endif; ?>
<script src="assets/study.js?v=<?= filemtime(__DIR__.'/assets/study.js') ?>" defer></script></head><body>
<a class="skip" href="#main">Skip to content</a>
<main id="main" tabindex="-1"<?= in_array($view, ['cards', 'quiz'], true) ? ' class="study-page"' : ($view === 'topic' && !$missing ? ' class="topic-page"' : '') ?>>
<div class="page-heading<?= $view === 'topic' ? ' topic-page-heading' : ($view === 'library' ? ' library-page-heading' : '') ?>"><span class="eyebrow"><?= $view === 'topic' && $topic ? eccEscape($topic['category']) : 'ECC / STUDY LIBRARY' ?></span><div class="page-title-row"><h1 id="page-title"><?= eccEscape($title) ?></h1><?php if ($view === 'library'): ?><span class="topic-count"><?= count($topics) ?> <?= count($topics) === 1 ? 'topic' : 'topics' ?></span><?php endif; ?></div></div>
<?php if ($missing): ?>
<section class="panel"><h2>We couldn’t find that topic.</h2><p>It may have been moved or isn’t published yet.</p><a class="button" href="<?= eccLink('library') ?>">Open the library</a></section>
<?php elseif ($view === 'library'): ?>
<section aria-labelledby="page-title">
<?php
$query = '';
$shown = 0;
foreach (array_unique(array_column($topics, 'category')) as $category): ?>
<div class="category"><h3><?= eccEscape($category) ?></h3><div class="topic-list">
<?php foreach ($topics as $t): if ($t['category'] !== $category) continue;
$searchText = $t['title'].' '.($t['summary'] ?? '').' '.$t['category'];
foreach ($t['sections'] as $s) { $searchText .= ' '.$s['heading'].' '.($s['text'] ?? ''); foreach ($s['items'] ?? [] as $item) $searchText .= ' '.$item['label'].' '.$item['text']; }
$match = $query === '' || stripos($searchText, $query) !== false; if ($match) $shown++;
?>
<a class="topic-row" href="<?= eccLink('topic', $t['slug']) ?>" data-search="<?= eccEscape($searchText) ?>" <?= !$match ? 'hidden' : '' ?>><div><h4><?= eccEscape($t['title']) ?></h4></div><span aria-hidden="true">→</span></a>
<?php endforeach; ?></div></div><?php endforeach; ?>
<p id="empty-search" class="notice" <?= $shown ? 'hidden' : '' ?>><?= $topics ? 'No matching topics. Try another word or clear your search.' : 'Your library is ready for its first topic.' ?></p></section>
<?php elseif ($view === 'topic'): ?>
<a class="back-link" href="<?= eccLink('library') ?>">← All references</a>
<?php
$stationGrouping = $slug === 'fire-stations' && ($_GET['group'] ?? '') === 'battalion';
$referenceSections = $topic['sections'];
if ($stationGrouping) usort($referenceSections, fn($a, $b) => strcmp($a['battalion'], $b['battalion']) ?: strnatcasecmp($a['heading'], $b['heading']));
?>
<?php if ($slug === 'fire-stations'): ?>
<form class="station-group-form scope-form" action="./" method="get">
<input type="hidden" name="view" value="topic"><input type="hidden" name="topic" value="fire-stations">
<label for="station-group">Group stations</label><div class="search-row"><select id="station-group" name="group"><option value="station" <?= !$stationGrouping ? 'selected' : '' ?>>Station number</option><option value="battalion" <?= $stationGrouping ? 'selected' : '' ?>>Battalion</option></select></div>
<noscript><button class="button" type="submit">Apply grouping</button></noscript>
</form>
<?php endif; ?>
<div class="topic-actions" role="group" aria-label="Study actions">
<?php if (in_array($slug, ['phonetic-alphabet', 'phonetic-alphabet-police'], true)): ?>
<button class="button" id="alphabet-read" type="button" hidden>Play alphabet</button>
<?php endif; ?>
<a class="button" href="<?= eccLink('cards', $slug) ?>">Flashcards · <?= count($topic['flashcards']) ?></a>
<?php if (in_array($slug, ['phonetic-alphabet', 'phonetic-alphabet-police'], true)): ?>
<span id="alphabet-audio-status" role="status"></span>
<noscript>Enable JavaScript to play the alphabet.</noscript>
<?php endif; ?>
</div>
<div class="topic-layout"><article>
<?php $previousBattalion = null; foreach ($referenceSections as $s): ?>
<?php if ($stationGrouping && $previousBattalion !== $s['battalion']): $previousBattalion = $s['battalion']; ?><h2 class="battalion-heading"><?= eccEscape($previousBattalion) ?></h2><?php endif; ?><section class="panel reference-section"><h2><?= eccEscape($s['heading']) ?></h2><?php if (isset($s['text'])): ?><p><?= nl2br(eccEscape($s['text'])) ?></p><?php endif; ?><?php if (isset($s['items'])): ?><dl class="reference-grid<?= $slug === 'fire-stations' ? ' station-reference' : '' ?>"><?php foreach ($s['items'] as $item): ?><div><dt><?= eccEscape($item['label']) ?></dt><dd><?= eccEscape($item['text']) ?></dd></div><?php endforeach; ?></dl><?php endif; ?></section><?php endforeach; ?>
</article>
</div>
<?php else: ?>
<form class="scope-form" action="./" method="get"><input type="hidden" name="view" value="<?= eccEscape($view) ?>"><label for="scope">Study topic</label><div class="search-row"><select id="scope" name="topic"><option value="">All topics</option><?php foreach ($topics as $t): ?><option value="<?= eccEscape($t['slug']) ?>" <?= $slug === $t['slug'] ? 'selected' : '' ?>><?= eccEscape($t['title']) ?></option><?php endforeach; ?></select><button type="submit">Load</button></div></form>
<details class="study-options"><summary><strong>Study options</strong><span id="study-options-summary">Random<?= $view === 'quiz' ? ' · Multiple choice' : '' ?></span></summary><div class="study-options-body">
<?php if ($view === 'cards'): ?><fieldset class="quiz-format"><legend>Card order</legend><label><input type="radio" name="card-order" value="ordered"> In order</label><label><input type="radio" name="card-order" value="random" checked> Random</label></fieldset><?php endif; ?>
<?php if ($view === 'quiz'): ?><fieldset class="quiz-format"><legend>Question order</legend><label><input type="radio" name="quiz-order" value="ordered"> In order</label><label><input type="radio" name="quiz-order" value="random" checked> Random</label></fieldset><?php endif; ?>
<?php if ($view === 'quiz'): ?><fieldset class="quiz-format"><legend>Answer style</legend><label><input type="radio" name="quiz-format" value="multiple" checked> Multiple choice</label><label><input type="radio" name="quiz-format" value="typed"> Type answer</label></fieldset><?php endif; ?>
<fieldset class="quiz-format" id="shuffle-scope-field"><legend>Shuffle across topics</legend><label><input type="radio" name="shuffle-scope" value="all" checked> Mix all topics</label><label><input type="radio" name="shuffle-scope" value="topic"> Finish each topic</label></fieldset>
<button type="button" class="button" id="close-study-options">Done</button></div></details>
<div id="study" class="panel study-panel" data-mode="<?= eccEscape($view) ?>"></div><noscript><p class="notice">Enable JavaScript to use interactive study tools. You can still read all <a href="<?= eccLink('library') ?>">reference topics</a>.</p></noscript>
<script id="study-data" type="application/json"><?= json_encode(array_values($topic ? [$topic] : $topics), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_INVALID_UTF8_SUBSTITUTE) ?></script>
<?php if ($view === 'quiz'): ?><script id="quiz-topic-pool" type="application/json"><?= json_encode(array_values($topics), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_INVALID_UTF8_SUBSTITUTE) ?></script><?php endif; ?>
<?php endif; ?>

</main><nav class="bottom-nav" aria-label="Main navigation"><?php foreach (['library'=>'Library','cards'=>'Cards'] as $key=>$label): ?><a href="<?= eccLink($key) ?>" <?= ($view === $key || ($view === 'topic' && $key === 'library')) ? 'aria-current="page"' : '' ?>><?= $label ?></a><?php endforeach; ?></nav></body></html>
