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
- Root `index.html`, `styles.css`, and `app.js` power the game recap dashboard.
- Each subdirectory contains the page-specific HTML, CSS, and JavaScript for that route.
- `team-overview/` keeps its roster and transaction module in `roster-transactions.js`; `around-the-league/` provides the league-wide daily scoreboard and standings views.

## GitHub Pages

All tracked files in this directory are static deployment assets. The primary routes are:

- `/yankees/`
- `/yankees/player-profile/`
- `/yankees/player-stats/`
- `/yankees/schedule/`
- `/yankees/around-the-league/`
- `/yankees/team-overview/`
