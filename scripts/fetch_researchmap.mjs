/**
 * Fetch researchmap WebAPI and write cache JSON for GitHub Pages.
 * - Reads site.config.json (researchmap.permalink, researchmap.types)
 * - Writes data/researchmap/{type}.json and data/researchmap/meta.json
 *
 * NOTE:
 *   researchmap WebAPI examples & parameters are documented in community notes like:
 *   https://api.researchmap.jp/{permalink}/{achievement_type}?limit=100&from_date=2016&format=json&start=1
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const configPath = path.join(repoRoot, "site.config.json");
const outDir = path.join(repoRoot, "data", "researchmap");

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, "utf-8"));
}

async function writeJson(p, obj) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(obj, null, 2), "utf-8");
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "accept": "application/json" } });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}\n${text.slice(0, 400)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response for ${url}: ${text.slice(0, 200)}`);
  }
}

function buildUrl({ baseUrl, permalink, type, start, limit }) {
  const u = new URL(`${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(permalink)}/${encodeURIComponent(type)}`);
  u.searchParams.set("format", "json");
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("start", String(start));
  // cache buster for Actions (not strictly necessary)
  u.searchParams.set("_", String(Date.now()));
  return u.toString();
}

async function fetchAllItems({ baseUrl, permalink, type }) {
  const limit = 1000;
  const starts = [1, 0]; // API起点の揺れに対応
  let lastErr = null;

  for (const start0 of starts) {
    try {
      let all = [];
      let start = start0;

      while (true) {
        const url = buildUrl({ baseUrl, permalink, type, start, limit });
        const json = await fetchJson(url);

        const items = json.items ?? json["@graph"] ?? json ?? [];
        const page = Array.isArray(items) ? items : (items.items ?? []);
        if (!Array.isArray(page)) break;

        all = all.concat(page);

        if (page.length < limit) break;
        start += limit;

        // safety guard
        if (all.length > 5000) break;
      }

      return all;
    } catch (e) {
      lastErr = e;
      // try the other start base
    }
  }

  throw lastErr ?? new Error(`Failed to fetch ${type}`);
}

async function main() {
  const cfg = await readJson(configPath);
  const rm = cfg.researchmap ?? {};
  const permalink = rm.permalink;
  const baseUrl = rm.baseUrl ?? "https://api.researchmap.jp";
  const types = rm.types ?? ["published_papers"];

  if (!permalink) throw new Error("site.config.json: researchmap.permalink is required");

  await fs.mkdir(outDir, { recursive: true });

  const fetchedAt = new Date().toISOString();
  const meta = { fetchedAt, permalink, baseUrl, types, source: "github-actions-cache" };

  let total = 0;

  for (const t of types) {
    const items = await fetchAllItems({ baseUrl, permalink, type: t });
    total += items.length;
    await writeJson(path.join(outDir, `${t}.json`), items);
    console.log(`${t}: ${items.length}`);
  }

  meta.itemsTotal = total;
  await writeJson(path.join(outDir, "meta.json"), meta);
  console.log(`Done. total=${total}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
