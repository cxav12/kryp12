<?php
require __DIR__ . '/app/content.php';
$topics = eccLoadTopics();
$view = is_string($_GET['view'] ?? null) ? $_GET['view'] : 'home';
$slug = is_string($_GET['topic'] ?? null) ? $_GET['topic'] : '';
$topic = $topics[$slug] ?? null;
$missing = !in_array($view, ['home', 'library', 'topic', 'cards', 'quiz'], true) || ($view === 'topic' && !$topic) || ($slug !== '' && !$topic);
if ($missing) http_response_code(404);
$title = $missing ? 'Topic not found' : ($view === 'topic' ? $topic['title'] : ['home'=>'Your study desk','library'=>'Reference library','cards'=>'Flashcards','quiz'=>'Practice quiz'][$view]);
function eccLink(string $view, string $slug = ''): string { return './?' . http_build_query(array_filter(['view'=>$view, 'topic'=>$slug])); }
?>
<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#142e36">
<meta name="description" content="ECC dispatcher study references, flashcards and practice quizzes.">
<title><?= eccEscape($title) ?> · ECC</title><link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/style.css?v=<?= filemtime(__DIR__.'/assets/style.css') ?>">
<script src="assets/study.js?v=<?= filemtime(__DIR__.'/assets/study.js') ?>" defer></script></head><body>
<a class="skip" href="#main">Skip to content</a>
<header class="topbar"><a class="brand" href="./"><span class="mark" aria-hidden="true">E</span><span>ECC<small>DISPATCH STUDY</small></span></a></header>
<main id="main" tabindex="-1"<?= in_array($view, ['cards', 'quiz'], true) ? ' class="study-page"' : '' ?>>
<div class="page-heading"><span class="eyebrow"><?= $view === 'home' ? 'A little practice. Every day.' : 'ECC / STUDY LIBRARY' ?></span><h1><?= eccEscape($title) ?></h1></div>
<?php if ($missing): ?>
<section class="panel"><h2>We couldn’t find that topic.</h2><p>It may have been moved or isn’t published yet.</p><a class="button" href="<?= eccLink('library') ?>">Open the library</a></section>
<?php elseif ($view === 'home' || $view === 'library'): ?>
<form class="search" action="./" method="get" role="search"><input type="hidden" name="view" value="library"><label for="search">Find a reference</label><div class="search-row"><input id="search" name="q" type="search" placeholder="Search topics, words, or notes…" value="<?= eccEscape(is_string($_GET['q'] ?? null) ? $_GET['q'] : '') ?>"><button type="submit">Search</button></div></form>
<?php if ($view === 'home'): ?><section class="practice-links" aria-label="Study tools"><a href="<?= eccLink('cards') ?>"><span class="tool-icon" aria-hidden="true">▤</span><strong>Flashcards</strong><span>Recall, reveal, repeat</span><b aria-hidden="true">↗</b></a><a href="<?= eccLink('quiz') ?>"><span class="tool-icon" aria-hidden="true">✓</span><strong>Practice quiz</strong><span>Check what you remember</span><b aria-hidden="true">↗</b></a></section><?php endif; ?>
<section aria-labelledby="library-title"><div class="section-heading"><h2 id="library-title">Reference library</h2><span><?= count($topics) ?> <?= count($topics) === 1 ? 'topic' : 'topics' ?></span></div><p id="search-status" role="status"></p>
<?php
$query = is_string($_GET['q'] ?? null) ? trim($_GET['q']) : '';
$shown = 0;
foreach (array_unique(array_column($topics, 'category')) as $category): ?>
<div class="category"><h3><?= eccEscape($category) ?></h3><div class="topic-list">
<?php foreach ($topics as $t): if ($t['category'] !== $category) continue;
$searchText = $t['title'].' '.($t['summary'] ?? '').' '.$t['category'];
foreach ($t['sections'] as $s) { $searchText .= ' '.$s['heading'].' '.($s['text'] ?? ''); foreach ($s['items'] ?? [] as $item) $searchText .= ' '.$item['label'].' '.$item['text']; }
$match = $query === '' || stripos($searchText, $query) !== false; if ($match) $shown++;
?>
<a class="topic-row" href="<?= eccLink('topic', $t['slug']) ?>" data-search="<?= eccEscape($searchText) ?>" <?= !$match ? 'hidden' : '' ?>><span class="topic-symbol" aria-hidden="true">Aa</span><div><h4><?= eccEscape($t['title']) ?></h4><small><?= count($t['flashcards']) ?> cards · <?= count($t['quiz']) ?> questions</small></div><span aria-hidden="true">→</span></a>
<?php endforeach; ?></div></div><?php endforeach; ?>
<p id="empty-search" class="notice" <?= $shown ? 'hidden' : '' ?>><?= $topics ? 'No matching topics. Try another word or clear your search.' : 'Your library is ready for its first topic.' ?></p></section>
<?php elseif ($view === 'topic'): ?>
<a class="back-link" href="<?= eccLink('library') ?>">← All references</a>
<div class="topic-meta"><span><?= eccEscape($topic['category']) ?></span></div>
<div class="topic-layout"><article>
<?php foreach ($topic['sections'] as $s): ?><section class="panel reference-section"><h2><?= eccEscape($s['heading']) ?></h2><?php if (isset($s['text'])): ?><p><?= nl2br(eccEscape($s['text'])) ?></p><?php endif; ?><?php if (isset($s['items'])): ?><dl class="reference-grid"><?php foreach ($s['items'] as $item): ?><div><dt><?= eccEscape($item['label']) ?></dt><dd><?= eccEscape($item['text']) ?></dd></div><?php endforeach; ?></dl><?php endif; ?></section><?php endforeach; ?>
</article>
<aside class="panel study-aside"><span class="eyebrow">Put it into practice</span><h2>Ready for a refresh?</h2><p>Study this topic at your own pace.</p><a class="button" href="<?= eccLink('cards', $slug) ?>">Flashcards · <?= count($topic['flashcards']) ?></a><a class="button secondary" href="<?= eccLink('quiz', $slug) ?>">Practice quiz · <?= count($topic['quiz']) ?></a></aside></div>
<?php else: ?>
<form class="scope-form" action="./" method="get"><input type="hidden" name="view" value="<?= eccEscape($view) ?>"><label for="scope">Study topic</label><div class="search-row"><select id="scope" name="topic"><option value="">All topics</option><?php foreach ($topics as $t): ?><option value="<?= eccEscape($t['slug']) ?>" <?= $slug === $t['slug'] ? 'selected' : '' ?>><?= eccEscape($t['title']) ?></option><?php endforeach; ?></select><button type="submit">Load</button></div></form>
<?php if ($view === 'quiz'): ?><fieldset class="quiz-format"><legend>Answer style</legend><label><input type="radio" name="quiz-format" value="multiple" checked> Multiple choice</label><label><input type="radio" name="quiz-format" value="typed"> Type answer</label></fieldset><?php endif; ?>
<div id="study" class="panel study-panel" data-mode="<?= eccEscape($view) ?>"></div><noscript><p class="notice">Enable JavaScript to use interactive study tools. You can still read all <a href="<?= eccLink('library') ?>">reference topics</a>.</p></noscript>
<script id="study-data" type="application/json"><?= json_encode(array_values($topic ? [$topic] : $topics), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_INVALID_UTF8_SUBSTITUTE) ?></script>
<?php if ($view === 'quiz'): ?><script id="quiz-topic-pool" type="application/json"><?= json_encode(array_values($topics), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_INVALID_UTF8_SUBSTITUTE) ?></script><?php endif; ?>
<?php endif; ?>

</main><nav class="bottom-nav" aria-label="Main navigation"><?php foreach (['home'=>'Home','library'=>'Library','cards'=>'Cards','quiz'=>'Quiz'] as $key=>$label): ?><a href="<?= eccLink($key) ?>" <?= ($view === $key || ($view === 'topic' && $key === 'library')) ? 'aria-current="page"' : '' ?>><?= $label ?></a><?php endforeach; ?></nav></body></html>
