import { loadConfig, loadCachedData, fetchLiveData, normalizeItems } from "./researchmap.js";

const els = {
  labName: document.getElementById("labName"),
  labTagline: document.getElementById("labTagline"),
  heroTitle: document.getElementById("heroTitle"),
  heroLead: document.getElementById("heroLead"),
  footerLab: document.getElementById("footerLab"),
  yearNow: document.getElementById("yearNow"),

  researchmapLink: document.getElementById("researchmapLink"),
  refreshBtn: document.getElementById("refreshBtn"),
  dataStatus: document.getElementById("dataStatus"),
  toggleTheme: document.getElementById("toggleTheme"),

  mPapers: document.getElementById("mPapers"),
  mTalks: document.getElementById("mTalks"),
  mProjects: document.getElementById("mProjects"),

  pubList: document.getElementById("pubList"),
  talkList: document.getElementById("talkList"),
  projectCards: document.getElementById("projectCards"),
  pubCount: document.getElementById("pubCount"),
  pubExport: document.getElementById("pubExport"),

  searchInput: document.getElementById("searchInput"),
  yearFilter: document.getElementById("yearFilter"),

  labAffiliation: document.getElementById("labAffiliation"),
  labEmail: document.getElementById("labEmail"),
  labResearchmap: document.getElementById("labResearchmap"),
  labGithub: document.getElementById("labGithub"),
  labScholar: document.getElementById("labScholar"),
};

function setTheme(theme) {
  const root = document.documentElement;
  if (theme === "light") root.classList.add("light");
  else root.classList.remove("light");
  localStorage.setItem("theme", theme);
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) return setTheme(saved);
  // auto (prefers-color-scheme)
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)")?.matches;
  setTheme(prefersLight ? "light" : "dark");
}

function getText(field, prefer = "ja") {
  if (!field) return "";
  if (typeof field === "string") return field;
  if (field[prefer]) return field[prefer];
  if (field.en) return field.en;
  if (field.ja) return field.ja;
  // take first key
  const k = Object.keys(field)[0];
  return field[k] ?? "";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function yearFromDate(dateStr) {
  if (!dateStr) return "";
  const m = String(dateStr).match(/^\d{4}/);
  return m ? m[0] : "";
}

function renderPublications(items, { query = "", year = "" } = {}) {
  const q = query.trim().toLowerCase();
  const filtered = items.filter((it) => {
    const y = it.year || "";
    if (year && y !== year) return false;
    if (!q) return true;
    const hay = `${it.title} ${it.venue} ${it.year} ${it.authors}`.toLowerCase();
    return hay.includes(q);
  });

  els.pubCount.textContent = `${filtered.length} items`;

  els.pubList.innerHTML = filtered
    .slice(0, window.__UI_MAX || 50)
    .map((it) => {
      const doiLink = it.doi ? `https://doi.org/${encodeURIComponent(it.doi)}` : "";
      const links = [
        it.url ? `<a href="${escapeHtml(it.url)}" target="_blank" rel="noreferrer">link</a>` : "",
        doiLink ? `<a href="${escapeHtml(doiLink)}" target="_blank" rel="noreferrer">doi</a>` : "",
      ].filter(Boolean).join(" · ");

      const meta = [it.venue, it.year].filter(Boolean).join(" · ");
      const authors = it.authors ? `<span class="muted"> — ${escapeHtml(it.authors)}</span>` : "";

      return `<li>
        <div><strong>${escapeHtml(it.title || "(no title)")}</strong>${authors}</div>
        <div class="muted">${escapeHtml(meta)}${links ? ` · ${links}` : ""}</div>
      </li>`;
    })
    .join("");

  // export (client-side)
  const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
  els.pubExport.href = URL.createObjectURL(blob);
}

function renderTalks(items) {
  els.talkList.innerHTML = items
    .slice(0, window.__UI_MAX || 50)
    .map((it) => {
      const meta = [it.venue, it.year].filter(Boolean).join(" · ");
      return `<li>
        <div><strong>${escapeHtml(it.title || "(no title)")}</strong></div>
        <div class="muted">${escapeHtml(meta)}${it.authors ? ` · ${escapeHtml(it.authors)}` : ""}</div>
      </li>`;
    })
    .join("");
}

function renderProjects(items) {
  const max = Math.min(items.length, window.__UI_MAX || 50);
  els.projectCards.innerHTML = items.slice(0, max).map((it) => {
    const period = [it.from, it.to].filter(Boolean).join(" – ");
    const meta = [it.role, period].filter(Boolean).join(" · ");
    const desc = it.summary ? `<p class="muted">${escapeHtml(it.summary)}</p>` : "";
    const link = it.url ? `<a class="link" target="_blank" rel="noreferrer" href="${escapeHtml(it.url)}">details</a>` : "";
    return `<div class="card">
      <h3 style="margin:0 0 8px 0">${escapeHtml(it.title || "(no title)")}</h3>
      <div class="muted">${escapeHtml(meta)}${link ? ` · ${link}` : ""}</div>
      ${desc}
    </div>`;
  }).join("");
}

function fillYearFilter(items) {
  const years = Array.from(new Set(items.map((x) => x.year).filter(Boolean))).sort((a,b)=>b.localeCompare(a));
  els.yearFilter.innerHTML = `<option value="">All years</option>` + years.map(y => `<option value="${y}">${y}</option>`).join("");
}

function setStatus(msg) {
  els.dataStatus.textContent = msg;
}

async function boot() {
  initTheme();
  els.toggleTheme.addEventListener("click", () => {
    const isLight = document.documentElement.classList.contains("light");
    setTheme(isLight ? "dark" : "light");
  });

  const config = await loadConfig();

  // expose UI max
  window.__UI_MAX = config?.ui?.maxItemsPerSection ?? 50;

  const lab = config.lab ?? {};
  els.labName.textContent = lab.name_ja || lab.name_en || "Lab";
  els.labTagline.textContent = lab.tagline || "";
  els.heroTitle.textContent = lab.name_ja || lab.name_en || "Lab";
  els.footerLab.textContent = lab.name_en || lab.name_ja || "Lab";
  els.yearNow.textContent = String(new Date().getFullYear());

  const rmUrl = lab.social?.researchmap || "https://researchmap.jp/";
  els.researchmapLink.href = rmUrl;
  document.getElementById("labResearchmap").href = rmUrl;
  document.getElementById("labResearchmap").textContent = rmUrl;

  els.labAffiliation.textContent = lab.affiliation || "";
  els.labEmail.textContent = lab.email || "";
  els.labEmail.href = lab.email ? `mailto:${lab.email}` : "#";
  const gh = lab.social?.github || "";
  els.labGithub.href = gh || "#";
  els.labGithub.textContent = gh || "(set in site.config.json)";
  const scholar = lab.social?.scholar || "";
  els.labScholar.href = scholar || "#";
  els.labScholar.textContent = scholar || "(set in site.config.json)";

  // 1) cached load
  const cached = await loadCachedData();
  let data = cached;
  setStatus(cached?.meta?.fetchedAt ? `cache: ${cached.meta.fetchedAt}` : "cache: (none)");

  // 2) best-effort live fetch (optional) — if it fails, keep cache
  try {
    const live = await fetchLiveData(config);
    if (live?.meta?.itemsTotal) {
      data = live;
      setStatus(`live: ${live.meta.fetchedAt}`);
    }
  } catch (e) {
    // ignore; cache is fine
  }

  // normalize
  const pubs = normalizeItems(data?.published_papers ?? [], "published_papers");
  const talks = normalizeItems(data?.presentations ?? [], "presentations");
  const projects = normalizeItems(data?.research_projects ?? [], "research_projects");

  els.mPapers.textContent = String(pubs.length);
  els.mTalks.textContent = String(talks.length);
  els.mProjects.textContent = String(projects.length);

  fillYearFilter(pubs);

  // initial render
  renderPublications(pubs);
  renderTalks(talks);
  renderProjects(projects);

  // interactions
  const updateFilters = () => renderPublications(pubs, { query: els.searchInput.value, year: els.yearFilter.value });
  els.searchInput.addEventListener("input", updateFilters);
  els.yearFilter.addEventListener("change", updateFilters);

  // refresh button forces live
  els.refreshBtn.addEventListener("click", async () => {
    setStatus("fetching…");
    try {
      const live = await fetchLiveData(config, { force: true });
      setStatus(`live: ${live.meta.fetchedAt}`);
      const pubs2 = normalizeItems(live?.published_papers ?? [], "published_papers");
      const talks2 = normalizeItems(live?.presentations ?? [], "presentations");
      const projects2 = normalizeItems(live?.research_projects ?? [], "research_projects");

      els.mPapers.textContent = String(pubs2.length);
      els.mTalks.textContent = String(talks2.length);
      els.mProjects.textContent = String(projects2.length);

      fillYearFilter(pubs2);
      renderPublications(pubs2, { query: els.searchInput.value, year: els.yearFilter.value });
      renderTalks(talks2);
      renderProjects(projects2);

    } catch (e) {
      console.error(e);
      setStatus("live fetch failed (using cache)");
    }
  });

  // keyboard shortcut: Ctrl/Cmd+K focuses search
  window.addEventListener("keydown", (ev) => {
    const isK = (ev.key || "").toLowerCase() === "k";
    const mod = ev.ctrlKey || ev.metaKey;
    if (mod && isK) {
      ev.preventDefault();
      els.searchInput.focus();
    }
  });
}

boot();
