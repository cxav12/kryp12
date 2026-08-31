# KRYP12 root hub

The root remains a static HTML page on Namecheap. GitHub stores the source.
No build, JavaScript, PHP changes, external fonts, or new dependencies are required.

## Files and content

- `index.html`: semantic project list and all project content.
- `assets/landing/landing.css`: isolated root styling and responsive layouts.
- `assets/landing/contours.svg`: small vector background texture, no raster download.
- `.cpanel.yml`: includes the new root assets in the existing deployment.

Logos are reused from `/yankees/assets/new-york-yankees.svg` and
`/palworld/assets/palworld-logo.png`, without changing or duplicating them.
The cards use CSS artwork instead of large photos. For future replacement
artwork, place an optimized WebP in `assets/landing/` and update the relevant
`.project-art::before` background, using `center / cover` with a dark gradient.
Keep logo images contained to avoid cropping or distortion.

To add a project, duplicate an active `<li>` in `index.html`, update the URL,
category, heading, description, artwork, and unique IDs used by `aria-labelledby`
and `aria-describedby`. Add a card modifier with its accent/background variables.
The grid automatically wraps any number of entries: three columns above 999px,
two at 600–999px, and one below 600px. Coming Soon is an article, not a link.
Hover effects run only on pointing devices and respect reduced-motion preferences.

## Commit only this landing-page work

Run in PowerShell from the repository root. Review the staged filenames before
committing; earlier Yankees changes may still be uncommitted. Do not use `git add .`.

```powershell
git add -- index.html assets/landing/landing.css assets/landing/contours.svg .cpanel.yml LANDING.md
git diff --cached --name-only
git diff --cached --check
git commit -m "Build KRYP12 project hub landing page"
git push origin main
```

## Root-only Namecheap upload (leaves both live project folders untouched)

The existing configuration identifies `/home/horacqou/public_html/` as the document
root. Confirm that this is still the document root for kryp12.com in cPanel.
With SSH access enabled, run these commands from the local repository root:

```powershell
ssh -p 21098 horacqou@198.54.116.214 "mkdir -p /home/horacqou/public_html/assets/landing"
scp -P 21098 assets/landing/landing.css assets/landing/contours.svg horacqou@198.54.116.214:/home/horacqou/public_html/assets/landing/
scp -P 21098 index.html horacqou@198.54.116.214:/home/horacqou/public_html/index.html
```

Upload assets before HTML, then open https://kryp12.com/ and test both cards.
Alternatively use cPanel File Manager to upload those same three files to those
same locations. No Yankees or Palworld uploads are needed. Back up the existing
root index before replacing it if you need an immediate rollback.

## Existing full-site Git deployment (optional)

The configured `namecheap` remote points to the cPanel repository. Once you intend
to deploy the entire committed site, use:

```powershell
git push namecheap main
```

cPanel-managed repositories normally deploy on push. If it does not, use
cPanel → Git Version Control → Manage → Pull or Deploy → Deploy HEAD Commit.
The existing `.cpanel.yml` also copies `yankees/` and `palworld/`; this is not a
root-only deployment. It publishes committed files, not uncommitted local changes,
and may overwrite manual live edits. Do not force-push if the remote rejects a push.

Namecheap reference:
https://www.namecheap.com/support/knowledgebase/article.aspx/10113/2210/how-to-use-git-version-control-cpanel-plugin/

No commit, push, or production upload was performed while implementing this page.
