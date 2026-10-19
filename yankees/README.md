# Yankees

Static Yankees dashboard for local development and GitHub Pages.

## Run locally

Serve the repository root with any static HTTP server, then open `/yankees/`.
For example, from the repository root:

```text
python -m http.server 8080
```

Then visit `http://localhost:8080/yankees/`.

## Structure

- `shared.css` contains site-wide tokens, typography, navigation, and common controls.
- Root `index.html`, `offseason.css`, and `assets/js/offseason.js` power the Offseason Hub with live MLB transactions, current roster groups, and regular-season totals.
- Offseason extras include confirmed Yankees opener dates, official MLB headlines, and a spotlight that rotates through the minor-league prospects already listed in Team Overview. Prospect stats are labeled as combined minor-league totals or the specific affiliate; unavailable data is left unavailable.
- `api/news.php` fetches only the fixed official Yankees RSS feed and caches four linked headlines for ten minutes in the server temporary directory. It requires PHP with SimpleXML and either cURL or HTTPS streams. Namecheap and the PHP local launcher support this; static-only hosting shows a news fallback link. No full articles are copied.
- `game/index.html`, root `styles.css`, and `assets/js/app.js` preserve individual game recaps linked from Schedule. Legacy `?game=` homepage links forward to the game page.
- `assets/js/` contains the dashboard scripts and site-wide `shared.js`.
- `home-view.js` selects the offseason or original game dashboard from the shared season state. Offseason mode begins 24 hours after the verified final-play end time of the Yankees’ last game of the season, including their last playoff game. Qualified teams awaiting a playoff matchup keep the game view; missing game-end data never triggers an early switch. Open pages recheck automatically. Offseason mode persists through spring training; the Yankees’ first regular-season official game date switches the homepage and header back at midnight America/New_York. The Opening Day countdown uses that same boundary, and the spring opener remains a separate date.
- `tests/` contains JavaScript unit tests. Run them from the repository root with `node --test yankees/tests/*.test.js`.
- Each route subdirectory contains its page-specific HTML, CSS, and JavaScript.
- `team-overview/` keeps its roster and transaction module in `roster-transactions.js`; `around-the-league/` provides the league-wide daily scoreboard and standings views.

## GitHub Pages

GitHub Pages serves the static pages and assets in this directory. The `tests/` directory is for development; PHP contact handlers require a PHP server and are currently disabled. The primary routes are:

- `/yankees/`
- `/yankees/game/?game=<MLB-game-id>`
- `/yankees/player-profile/`
- `/yankees/player-stats/`
- `/yankees/schedule/`
- `/yankees/around-the-league/`
- `/yankees/team-overview/`

Offseason visuals live in `offseason.css` and `assets/js/offseason-effects.js`, enabled only by the offseason homepage body class. Pointer lighting is limited to fine pointers; entrances run once and reduced-motion preferences disable animation. The regular-season homepage never loads the effects script.
