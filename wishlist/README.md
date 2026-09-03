# Wishlist

A personal wishlist for collecting products from different retailers in one place. The current release supports one administrator, automatic metadata retrieval with manual fallback, public and private items, and responsive product cards.

## Requirements

- Apache with PHP 8.1 or newer
- MySQL 5.7+ or MariaDB 10.3+
- PHP extensions: PDO MySQL, cURL, DOM, mbstring
- Apache `mod_headers` and `mod_authz_core`

## Local setup

1. Create a MySQL or MariaDB database and import `database/schema.sql`.
2. Copy `config.example.php` to `config.php`.
3. Add the local database credentials and choose a long, temporary `install_key` in `config.php`.
4. Set `app_url` to `http://localhost:8080/wishlist`.
5. Serve the repository root through a PHP-capable local server. For PHP's development server, run `php -S localhost:8080` from the repository root.
6. Open `http://localhost:8080/wishlist/install.php`, enter the installation key, and create the administrator account.
7. Remove the `install_key` value from `config.php` after setup.

The real `config.php` is ignored by Git. Keep it out of commits and backups that may be shared.

## Namecheap setup

1. In cPanel, create a database and database user under **MySQL Databases**. Grant the user all privileges on that database.
2. Open phpMyAdmin, select the new database, and import `wishlist/database/schema.sql`.
3. Copy `wishlist/config.example.php` to `wishlist/config.php` on the server. Supply the cPanel database values, set `app_url` to `https://kryp12.com/wishlist`, and set a long temporary `install_key`.
4. Select PHP 8.1 or newer in **MultiPHP Manager**. Enable PDO MySQL, cURL, DOM, and mbstring in **Select PHP Version** if needed.
5. Deploy the approved repository revision. The repository's `.cpanel.yml` copies `wishlist` into `public_html` without changing the existing site directories.
6. Visit `https://kryp12.com/wishlist/install.php`, enter the installation key, create the administrator, and remove the `install_key` value from the server configuration.
7. Confirm that `/wishlist/config.php` and `/wishlist/database/schema.sql` return an access-denied response.

The installer disables itself once a user exists. The temporary key protects it before the first account is created.

## Git and deployment workflow

Review the changes locally, then commit the application and deployment entries:

```bash
git status
git add wishlist .gitignore .cpanel.yml
git commit -m "Add personal wishlist application"
git push origin main
```

If work is on another branch, replace `main` with that branch and merge the reviewed change through the repository's usual workflow. In cPanel's **Git Version Control**, update from the remote and choose **Deploy HEAD Commit**.

## Server validation

Run PHP's syntax checker on a PHP-equipped machine or through cPanel Terminal:

```bash
find wishlist -name '*.php' -print0 | xargs -0 -n1 php -l
```

After deployment, verify these behaviors in a private browser window:

- the public page includes public items and excludes private items;
- an administrator URL redirects logged-out visitors to login;
- an invalid or blocked address produces the editable manual form;
- login, add, edit, visibility change, and delete actions work;
- cards collapse from a desktop grid to two columns on tablet and one column on a narrow phone.

## Configuration values

`config.php` requires:

- `app_url`: full base address without a trailing slash
- `session_name`: a site-specific cookie name
- `session_lifetime`: sign-in lifetime in seconds; the default is 30 days and renews while the site is used
- `timezone`: timezone used for purchase dates, such as `America/New_York`
- `install_key`: temporary first-account setup key; leave empty afterward
- `db.host`: database host supplied by Namecheap
- `db.port`: normally `3306`
- `db.name`: cPanel database name
- `db.username`: cPanel database username
- `db.password`: database password
- `db.charset`: keep `utf8mb4`
