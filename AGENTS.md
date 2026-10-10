# Repository maintenance

When the user says **“clean the code”**, perform a deep cleanup of the Yankees site. Audit HTML, CSS, JavaScript, and PHP; remove confirmed unused code and selectors; consolidate redundancies; improve efficiency and readability without changing intended behavior or appearance; and finish with syntax, reference, and Git integrity checks. Do not deploy unless the user explicitly asks.

## Visual design preference

Never introduce 1px borders anywhere in the site unless the user explicitly requests a 1px border. Use spacing, contrasting backgrounds, or borderless depth treatments when visual separation is needed.

## New site visibility

Every new site must start hidden on the KRYP12 homepage until the user enables it in Admin → Site Visibility. Register the site in the admin controls and save handler, database setup and existing-install registration, visibility API defaults, and homepage filtering (`data-site-key`). Use `is_visible = 0` and false defaults everywhere, including API failures and missing database rows; mark the initial homepage card hidden so it does not flash before JavaScript runs. Registration must preserve an existing visibility choice rather than resetting it. Verify that the administrator can enable and hide the site before considering its integration complete.

Homepage visibility controls listing only; direct URL access remains governed separately. Do not describe a hidden homepage card as access protection.
