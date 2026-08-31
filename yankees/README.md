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
- Root `index.html`, `styles.css`, and `assets/js/app.js` power the game recap dashboard.
- `assets/js/` contains the dashboard scripts and site-wide `shared.js`.
- `tests/` contains JavaScript unit tests. Run them from the repository root with `node --test yankees/tests/*.test.js`.
- Each route subdirectory contains its page-specific HTML, CSS, and JavaScript.
- `team-overview/` keeps its roster and transaction module in `roster-transactions.js`; `around-the-league/` provides the league-wide daily scoreboard and standings views.

## GitHub Pages

All tracked files in this directory are static deployment assets. The primary routes are:

- `/yankees/`
- `/yankees/player-profile/`
- `/yankees/player-stats/`
- `/yankees/schedule/`
- `/yankees/around-the-league/`
- `/yankees/team-overview/`
