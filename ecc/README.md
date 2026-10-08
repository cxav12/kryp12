# ECC dispatcher study

Public, mobile-first PHP study site. No database, login, build step, external fonts, or packages. Intended path: `/ecc/`. This is a study aid, not an operational dispatch tool.

## Structure

- `index.php`: home, library, topic, cards and quiz views, using query parameters.
- `app/content.php`: shared validation, safe content loading and output escaping.
- `content/*.json`: one published topic per file; read on each request.
- `assets/style.css`, `study.js`, `favicon.svg`: isolated presentation and study tools.

URLs: `/ecc/`, `/ecc/?view=library`, `/ecc/?view=topic&topic=phonetic-alphabet`, `/ecc/?view=cards&topic=phonetic-alphabet`, `/ecc/?view=quiz`. Omit topic for an all-topic session. Unknown views/slugs return HTTP 404. Requests are matched against loaded slugs, never interpreted as file paths.

## Content schema and editing

Copy the starter JSON, choose unique stable `id` and `slug`, then revise the content. Files are automatically discovered; no template changes needed. Changing a published slug changes its URL, so prefer preserving it. Delete a file to unpublish it; Git retains the history. Every valid file is public: never add sensitive material, even as a draft.

```json
{
  "id": "example-topic",
  "slug": "example-topic",
  "title": "Example topic",
  "category": "Reference",
  "summary": "A short description.",
  "status": "general-reference",
  "lastReviewed": "2026-10-08",
  "sources": [{"title": "Approved public reference", "url": "https://example.com/reference"}],
  "sections": [{"heading": "Overview", "text": "Your verified notes."}],
  "flashcards": [{"question": "A question based on these notes?", "answer": "Its verified answer."}],
  "quiz": [{"question": "Choose the correct answer.", "choices": ["Correct", "Incorrect"], "correctIndex": 0, "explanation": "Explain using the reference notes."}]
}
```

All top-level fields shown are required. IDs/slugs use lowercase letters, digits and single hyphens. Dates must be real YYYY-MM-DD dates. Sources need a title and HTTP(S) URL. At least one source and section is required. A section has a heading and `text`, `items`, or both. `items` is a list of `{ "label": "A", "text": "Alfa" }` objects, rendered as a reference grid. Text is plain text, not HTML or Markdown; newlines are supported in section text.

`flashcards` and `quiz` may be empty arrays. Each quiz needs at least two nonempty choices, a zero-based integer `correctIndex` identifying one choice, and a nonempty explanation. Keep study questions consistent with the reference; nothing is generated automatically at runtime.

Categories appear only when populated. Invalid JSON, invalid schema and duplicate IDs/slugs are skipped and logged on the server without disclosing paths to visitors. Fix logged errors before publishing. Empty libraries and topics without practice material have explanatory states.

Use `department-approved` only with supplied approval and a publishable source. Otherwise use `general-reference`. Record the review date and original source. Initial NATO alphabet content is sourced from NATO and awaits confirmation that it matches the ECC's alphabet. No local protocols or codes are assumed.

## Preview and validation

With PHP 7.4+ installed, from repository root:

```sh
php -S 127.0.0.1:8080 -t .
```

Visit `http://127.0.0.1:8080/ecc/`. PHP 8.x is recommended. Validate:

```sh
php -l ecc/index.php
php -l ecc/app/content.php
php -r 'require "ecc/app/content.php"; foreach (glob("ecc/content/*.json") as $f) { $t=json_decode(file_get_contents($f),true,512,JSON_THROW_ON_ERROR); if (!eccValidTopic($t)) {fwrite(STDERR,"Invalid: $f\n"); exit(1);} } echo "Content valid\n";'
node --check ecc/assets/study.js
git diff --check
```

Check phone and desktop widths, keyboard navigation, no-match search, an unknown topic (404), reveal/hide/previous/next cards, correct and incorrect quiz feedback, final score and retry, and empty practice arrays. Search works with JavaScript or standard form submission. Interactive study requires JavaScript. Progress exists only for the current page session and is not stored or synced.

## Git and deployment

Review changes, stage only intended files, commit, then push both remotes:

```sh
git status --short
git add ecc index.html assets/landing/landing.css assets/landing/landing.js .cpanel.yml
git diff --cached --check
git diff --cached --stat
git commit -m "Add ECC dispatcher study site"
git push origin main
git push namecheap main
```

`.cpanel.yml` includes ECC in the existing deployment copy list. No separate manual deployment is assumed. Do not force-push. A database is not needed for ECC even though other repository sites use one. The hub entry is public and does not depend on account access.

A future editor could write this schema, but must have protected access, validation and backups. Live edits require a defined Git synchronization process before deployment to avoid overwriting server changes. No editor or authentication is implemented now.
