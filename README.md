# Takami Lab – GitHub Pages template (researchmap auto-sync)

This template is a **static lab website** that can be published on **GitHub Pages** and **auto-updates achievements** from researchmap.

## What it does

- Displays **Publications / Talks / Projects / Awards**
- Uses **researchmap WebAPI** (recommended: cache via GitHub Actions)
- Has a simple, modern design with light/dark toggle

## Setup (quick)

1. Create a GitHub repository (e.g., `takami-lab-site`) and upload all files.
2. Edit `site.config.json`:
   - `lab.*` (name, email, links)
   - `researchmap.permalink` (already set to `takamikyo`)
3. Enable GitHub Pages:
   - Settings → Pages → Build and deployment → **Deploy from a branch**
   - Branch: `main` / folder: `/ (root)`
4. (Optional but recommended) Enable scheduled sync:
   - Actions tab → enable workflows (first time)
   - Run **Update researchmap cache** once (workflow_dispatch)
   - Thereafter it runs daily.

## Local preview

Use any static server:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Notes

- `assets/app.js` reads cached JSON in `data/researchmap/`.
- It *also* tries a best-effort **live fetch** from `https://api.researchmap.jp/…` in the browser.  
  If CORS/network blocks it, it will silently fall back to the cache.

## License

MIT (you can change it)
