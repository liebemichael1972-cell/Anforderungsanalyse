/* Anforderungsanalyse – Requirements Editor
 * Reine Client-Anwendung, keine Abhängigkeiten. Speichert im LocalStorage.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "anforderungsanalyse.v1";

  // Kategorien für nicht-fachliche (nicht-funktionale) Anforderungen
  const NFA_CATEGORIES = [
    "Performance", "Sicherheit", "Usability / Bedienbarkeit",
    "Zuverlässigkeit", "Wartbarkeit", "Skalierbarkeit",
    "Kompatibilität", "Barrierefreiheit", "Datenschutz / Compliance",
    "Betrieb / Deployment", "Sonstiges"
  ];

  /** @typedef {{id:string,title:string,description:string,priority:string,category?:string}} Requirement */

  const defaultState = () => ({
    project: { title: "", author: "", desc: "", tech: "", scope: "" },
    functional: [],
    nonfunctional: [],
    acceptance: [], // {id,title,relatedTo,given,when,then}
    counters: { functional: 0, nonfunctional: 0, acceptance: 0 }
  });

  let state = load();

  // ---------- Persistenz ----------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Object.assign(defaultState(), parsed);
      }
    } catch (e) { console.warn("Konnte gespeicherten Stand nicht laden", e); }
    return defaultState();
  }

  let saveTimer = null;
  function save() {
    const el = document.getElementById("saveState");
    el.textContent = "Speichert…";
    el.classList.add("saving");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        el.textContent = "Automatisch gespeichert";
        el.classList.remove("saving");
      } catch (e) {
        el.textContent = "Speichern fehlgeschlagen";
      }
    }, 300);
  }

  // ---------- Hilfsfunktionen ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const nextId = (type) => "r" + type + "_" + (++state.counters[type]) + "_" + Date.now().toString(36);

  function prefixFor(type) {
    return type === "functional" ? "FA" : type === "nonfunctional" ? "NFA" : "AK";
  }

  // Fortlaufende Anzeige-Nummer (FA-1, FA-2 …) basierend auf Reihenfolge
  function displayId(type, index) {
    return prefixFor(type) + "-" + (index + 1);
  }

  // ---------- Rendering: Projekt ----------
  function bindProject() {
    const map = {
      projTitle: "title", projAuthor: "author",
      projDesc: "desc", projTech: "tech", projScope: "scope"
    };
    Object.entries(map).forEach(([elId, key]) => {
      const el = document.getElementById(elId);
      el.value = state.project[key] || "";
      el.addEventListener("input", () => {
        state.project[key] = el.value;
        save(); renderMarkdown();
      });
    });
  }

  // ---------- Rendering: Anforderungen ----------
  function renderRequirementList(type) {
    const listEl = document.getElementById(
      type === "functional" ? "listFunctional" : "listNonFunctional"
    );
    listEl.innerHTML = "";
    const items = state[type];
    items.forEach((item, index) => {
      listEl.appendChild(buildRequirementNode(type, item, index));
    });
    updateEmptyAndCount(type);
  }

  function buildRequirementNode(type, item, index) {
    const node = document.getElementById("tplRequirement").content.firstElementChild.cloneNode(true);
    node.dataset.id = item.id;
    $(".req-id", node).textContent = displayId(type, index);

    const titleEl = $(".req-title", node);
    const descEl = $(".req-desc", node);
    const prioEl = $('[data-field="priority"]', node);
    const catWrap = $(".category-field", node);
    const catEl = $('[data-field="category"]', node);

    titleEl.value = item.title || "";
    descEl.value = item.description || "";
    prioEl.value = item.priority || "Muss";

    if (type === "nonfunctional") {
      catWrap.classList.add("show");
      NFA_CATEGORIES.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c; opt.textContent = c;
        catEl.appendChild(opt);
      });
      catEl.value = item.category || NFA_CATEGORIES[0];
    }

    // Events
    titleEl.addEventListener("input", () => { item.title = titleEl.value; save(); renderMarkdown(); });
    descEl.addEventListener("input", () => { item.description = descEl.value; save(); renderMarkdown(); });
    prioEl.addEventListener("change", () => { item.priority = prioEl.value; save(); renderMarkdown(); });
    if (type === "nonfunctional") {
      catEl.addEventListener("change", () => { item.category = catEl.value; save(); renderMarkdown(); });
    }
    $('[data-action="delete"]', node).addEventListener("click", () => {
      state[type] = state[type].filter(x => x.id !== item.id);
      renderRequirementList(type);
      renderAcceptanceRelations();
      save(); renderMarkdown();
    });

    return node;
  }

  // ---------- Rendering: Abnahmekriterien ----------
  function renderAcceptanceList() {
    const listEl = document.getElementById("listAcceptance");
    listEl.innerHTML = "";
    state.acceptance.forEach((item, index) => {
      listEl.appendChild(buildAcceptanceNode(item, index));
    });
    updateEmptyAndCount("acceptance");
  }

  function relatedOptionsHtml(selected) {
    let html = '<option value="">– keine Zuordnung –</option>';
    const groups = [
      { label: "Fachliche Anforderungen", type: "functional" },
      { label: "Nicht-fachliche Anforderungen", type: "nonfunctional" }
    ];
    groups.forEach(g => {
      if (state[g.type].length === 0) return;
      html += `<optgroup label="${escapeHtml(g.label)}">`;
      state[g.type].forEach((r, i) => {
        const id = displayId(g.type, i);
        const label = id + (r.title ? " – " + r.title : "");
        const sel = selected === r.id ? " selected" : "";
        html += `<option value="${r.id}"${sel}>${escapeHtml(label)}</option>`;
      });
      html += "</optgroup>";
    });
    return html;
  }

  function buildAcceptanceNode(item, index) {
    const node = document.getElementById("tplAcceptance").content.firstElementChild.cloneNode(true);
    node.dataset.id = item.id;
    $(".req-id", node).textContent = displayId("acceptance", index);

    const titleEl = $(".req-title", node);
    const relEl = $('[data-field="relatedTo"]', node);
    const givenEl = $('[data-field="given"]', node);
    const whenEl = $('[data-field="when"]', node);
    const thenEl = $('[data-field="then"]', node);

    titleEl.value = item.title || "";
    relEl.innerHTML = relatedOptionsHtml(item.relatedTo);
    givenEl.value = item.given || "";
    whenEl.value = item.when || "";
    thenEl.value = item.then || "";

    titleEl.addEventListener("input", () => { item.title = titleEl.value; save(); renderMarkdown(); });
    relEl.addEventListener("change", () => { item.relatedTo = relEl.value; save(); renderMarkdown(); });
    givenEl.addEventListener("input", () => { item.given = givenEl.value; save(); renderMarkdown(); });
    whenEl.addEventListener("input", () => { item.when = whenEl.value; save(); renderMarkdown(); });
    thenEl.addEventListener("input", () => { item.then = thenEl.value; save(); renderMarkdown(); });
    $('[data-action="delete"]', node).addEventListener("click", () => {
      state.acceptance = state.acceptance.filter(x => x.id !== item.id);
      renderAcceptanceList();
      save(); renderMarkdown();
    });

    return node;
  }

  // Aktualisiert nur die Related-Dropdowns (wenn Anforderungen sich ändern)
  function renderAcceptanceRelations() {
    document.querySelectorAll('#listAcceptance [data-field="relatedTo"]').forEach(sel => {
      const node = sel.closest(".req-item");
      const item = state.acceptance.find(x => x.id === node.dataset.id);
      if (item) sel.innerHTML = relatedOptionsHtml(item.relatedTo);
    });
  }

  function updateEmptyAndCount(type) {
    const map = {
      functional: { empty: "emptyFunctional", cnt: "cntFunctional" },
      nonfunctional: { empty: "emptyNonFunctional", cnt: "cntNonFunctional" },
      acceptance: { empty: "emptyAcceptance", cnt: "cntAcceptance" }
    };
    const cfg = map[type];
    const len = state[type].length;
    document.getElementById(cfg.cnt).textContent = len;
    document.getElementById(cfg.empty).classList.toggle("hidden", len > 0);
  }

  // ---------- Hinzufügen ----------
  function addRequirement(type) {
    if (type === "acceptance") {
      state.acceptance.push({ id: nextId("acceptance"), title: "", relatedTo: "", given: "", when: "", then: "" });
      renderAcceptanceList();
      // Fokus auf neues Feld
      const nodes = document.querySelectorAll("#listAcceptance .req-item");
      const last = nodes[nodes.length - 1];
      if (last) $(".req-title", last).focus();
    } else {
      const item = { id: nextId(type), title: "", description: "", priority: "Muss" };
      if (type === "nonfunctional") item.category = NFA_CATEGORIES[0];
      state[type].push(item);
      renderRequirementList(type);
      renderAcceptanceRelations();
      const listId = type === "functional" ? "listFunctional" : "listNonFunctional";
      const nodes = document.querySelectorAll("#" + listId + " .req-item");
      const last = nodes[nodes.length - 1];
      if (last) $(".req-title", last).focus();
    }
    save(); renderMarkdown();
  }

  // ---------- Markdown-Generierung ----------
  function md() {
    const p = state.project;
    const L = [];
    const title = p.title.trim() || "Anforderungsanalyse";
    L.push("# " + title);
    L.push("");

    // Meta
    const meta = [];
    if (p.author.trim()) meta.push("**Autor:** " + p.author.trim());
    meta.push("**Datum:** " + new Date().toLocaleDateString("de-DE"));
    L.push(meta.join("  \n"));
    L.push("");

    // Übersicht
    if (p.desc.trim()) {
      L.push("## Projektübersicht");
      L.push("");
      L.push(p.desc.trim());
      L.push("");
    }
    if (p.tech.trim()) {
      L.push("## Rahmenbedingungen / Technologie");
      L.push("");
      L.push(p.tech.trim());
      L.push("");
    }
    if (p.scope.trim()) {
      L.push("## Out of Scope");
      L.push("");
      L.push(p.scope.trim());
      L.push("");
    }

    // Fachliche Anforderungen
    L.push("## Fachliche Anforderungen (Funktionale Anforderungen)");
    L.push("");
    if (state.functional.length === 0) {
      L.push("_Keine fachlichen Anforderungen erfasst._");
      L.push("");
    } else {
      state.functional.forEach((r, i) => {
        L.push(`### ${displayId("functional", i)}: ${orDash(r.title)}`);
        L.push("");
        L.push("- **Priorität:** " + (r.priority || "Muss"));
        L.push("- **Beschreibung:** " + orDash(r.description));
        L.push("");
      });
    }

    // Nicht-fachliche Anforderungen
    L.push("## Nicht-fachliche Anforderungen (Nicht-funktionale Anforderungen)");
    L.push("");
    if (state.nonfunctional.length === 0) {
      L.push("_Keine nicht-fachlichen Anforderungen erfasst._");
      L.push("");
    } else {
      state.nonfunctional.forEach((r, i) => {
        L.push(`### ${displayId("nonfunctional", i)}: ${orDash(r.title)}`);
        L.push("");
        L.push("- **Kategorie:** " + (r.category || "Sonstiges"));
        L.push("- **Priorität:** " + (r.priority || "Muss"));
        L.push("- **Beschreibung:** " + orDash(r.description));
        L.push("");
      });
    }

    // Abnahmekriterien
    L.push("## Abnahmekriterien");
    L.push("");
    if (state.acceptance.length === 0) {
      L.push("_Keine Abnahmekriterien erfasst._");
      L.push("");
    } else {
      state.acceptance.forEach((a, i) => {
        L.push(`### ${displayId("acceptance", i)}: ${orDash(a.title)}`);
        L.push("");
        const relLabel = relatedLabel(a.relatedTo);
        if (relLabel) L.push("- **Bezug:** " + relLabel);
        if (a.given && a.given.trim()) L.push("- **Gegeben:** " + a.given.trim());
        if (a.when && a.when.trim()) L.push("- **Wenn:** " + a.when.trim());
        if (a.then && a.then.trim()) L.push("- **Dann:** " + a.then.trim());
        if (!a.given?.trim() && !a.when?.trim() && !a.then?.trim() && !a.title.trim()) {
          L.push("- _Noch nicht ausgefüllt._");
        }
        L.push("");
      });
    }

    // Umsetzungshinweis für Claude Code
    L.push("---");
    L.push("");
    L.push("## Umsetzungsauftrag");
    L.push("");
    L.push("Setze die oben beschriebenen fachlichen und nicht-fachlichen Anforderungen um. " +
      "Halte dabei alle genannten Rahmenbedingungen ein und stelle sicher, dass jedes " +
      "Abnahmekriterium erfüllt wird. Priorisiere Anforderungen mit **Muss** vor **Soll** vor **Kann**.");
    L.push("");

    return L.join("\n");
  }

  function relatedLabel(relId) {
    if (!relId) return "";
    let out = "";
    ["functional", "nonfunctional"].forEach(type => {
      const idx = state[type].findIndex(r => r.id === relId);
      if (idx >= 0) {
        const r = state[type][idx];
        out = displayId(type, idx) + (r.title ? " – " + r.title : "");
      }
    });
    return out;
  }

  function orDash(v) { return (v && v.trim()) ? v.trim() : "—"; }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  function renderMarkdown() {
    document.getElementById("markdownOut").textContent = md();
  }

  // ---------- Markdown einlesen ----------
  // Liest eine zuvor erzeugte Markdown-Datei wieder ein, damit bestehende
  // Anforderungen weiterbearbeitet werden können.
  function parseMarkdown(text) {
    const st = defaultState();
    const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
    const relations = [];   // { item, ref } – Bezüge werden am Ende aufgelöst
    let section = null;     // aktueller Abschnitt
    let item = null;        // aktuelle Anforderung / aktuelles Kriterium
    let buffer = [];        // Freitext des aktuellen Abschnitts

    const FREETEXT = { desc: 1, tech: 1, scope: 1 };
    const flushText = () => {
      if (section && FREETEXT[section]) {
        const t = buffer.join("\n").trim();
        if (t) st.project[section] = t;
      }
      buffer = [];
    };

    const sectionOf = (heading) => {
      const h = heading.toLowerCase();
      if (h.includes("umsetzungsauftrag")) return null;
      if (h.includes("übersicht") || h.includes("ubersicht")) return "desc";
      if (h.includes("rahmenbedingung") || h.includes("technologie")) return "tech";
      if (h.includes("out of scope")) return "scope";
      if (h.includes("abnahmekriterien")) return "acceptance";
      // Reihenfolge wichtig: "nicht-fachlich" vor "fachlich" prüfen
      if (h.includes("nicht-fachlich") || h.includes("nicht fachlich") ||
          h.includes("nicht-funktional") || h.includes("nicht funktional")) return "nonfunctional";
      if (h.includes("fachlich") || h.includes("funktional")) return "functional";
      return null;
    };

    const clean = (v) => {
      const t = (v || "").trim();
      return (t === "—" || t === "-" || t === "–") ? "" : t;
    };

    for (const raw of lines) {
      const line = raw.trimEnd();

      // Projekttitel
      const h1 = line.match(/^#\s+(.*)$/);
      if (h1) { flushText(); section = null; item = null; st.project.title = clean(h1[1]); continue; }

      // Abschnittswechsel
      const h2 = line.match(/^##\s+(.*)$/);
      if (h2) { flushText(); section = sectionOf(h2[1]); item = null; continue; }

      // Neue Anforderung / neues Kriterium
      const h3 = line.match(/^###\s+(.*)$/);
      if (h3) {
        item = null;
        if (section === "functional" || section === "nonfunctional") {
          item = { id: nextId(section), title: "", description: "", priority: "Muss" };
          if (section === "nonfunctional") item.category = NFA_CATEGORIES[0];
          st[section].push(item);
        } else if (section === "acceptance") {
          item = { id: nextId("acceptance"), title: "", relatedTo: "", given: "", when: "", then: "" };
          st.acceptance.push(item);
        }
        if (item) {
          // Führende Nummerierung (FA-1:, NFA-2:, AK-3:) entfernen
          item.title = clean(h3[1].replace(/^(FA|NFA|AK)-\d+\s*:\s*/i, ""));
        }
        continue;
      }

      // Feldzeilen einer Anforderung
      const bullet = line.match(/^\s*[-*]\s+\*\*(.+?):\*\*\s*(.*)$/);
      if (bullet && item) {
        const key = bullet[1].trim().toLowerCase();
        const val = clean(bullet[2]);
        if (key.startsWith("priorit")) {
          item.priority = ["Muss", "Soll", "Kann"].includes(val) ? val : "Muss";
        } else if (key.startsWith("beschreibung")) {
          item.description = val;
        } else if (key.startsWith("kategorie")) {
          item.category = NFA_CATEGORIES.includes(val) ? val : "Sonstiges";
        } else if (key.startsWith("bezug")) {
          const ref = val.match(/^(FA|NFA)-(\d+)/i);
          if (ref) relations.push({ item, type: ref[1].toUpperCase(), index: parseInt(ref[2], 10) - 1 });
        } else if (key.startsWith("gegeben")) {
          item.given = val;
        } else if (key.startsWith("wenn")) {
          item.when = val;
        } else if (key.startsWith("dann")) {
          item.then = val;
        }
        continue;
      }

      // Autorzeile aus dem Kopfbereich
      const author = line.match(/^\*\*Autor:\*\*\s*(.*)$/i);
      if (author) { st.project.author = clean(author[1]); continue; }
      if (/^\*\*Datum:\*\*/i.test(line)) continue;

      // Platzhalter und Trennlinien überspringen
      if (/^_Keine .*erfasst\._$/.test(line.trim())) continue;
      if (/^-{3,}$/.test(line.trim())) continue;

      // Freitext der Beschreibungsabschnitte sammeln
      if (section && FREETEXT[section] && !item) buffer.push(line);
    }
    flushText();

    // Bezüge der Abnahmekriterien auflösen (FA-1 → tatsächliche ID)
    relations.forEach(({ item, type, index }) => {
      const list = type === "FA" ? st.functional : st.nonfunctional;
      if (list[index]) item.relatedTo = list[index].id;
    });

    st.counters = {
      functional: st.functional.length,
      nonfunctional: st.nonfunctional.length,
      acceptance: st.acceptance.length
    };
    return st;
  }

  function hasContent(s) {
    return !!(s.project.title || s.project.desc || s.functional.length ||
      s.nonfunctional.length || s.acceptance.length);
  }

  // ---------- Aktionen: Download / Copy / Export / Import / Reset ----------
  function slugify(s) {
    return (s || "anforderungen").toLowerCase()
      .replace(/[äöü]/g, m => ({ "ä": "ae", "ö": "oe", "ü": "ue" }[m]))
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "anforderungen";
  }

  // Läuft die Anwendung eingebettet (iframe)? Dort können Browser Downloads sperren.
  function isEmbedded() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }

  // Löst den Datei-Download aus. Der Download wird immer angestoßen; die
  // Kopier-Möglichkeit wird nur zusätzlich angeboten, falls der Browser ihn sperrt.
  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Eingebettete Ansichten können Downloads sperren – dort zusätzlich einen
    // Ausweg anbieten, ohne den regulären Download zu behindern.
    if (isEmbedded()) offerCopyFallback(content, filename, url);


    // URL erst spät freigeben, damit langsame Downloads nicht abbrechen.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  }

  // Unaufdringlicher Hinweis: Falls der Download nicht ankam, Inhalt kopieren.
  function offerCopyFallback(content, filename, url) {
    let bar = document.querySelector(".fallback-bar");
    if (bar) bar.remove();
    bar = document.createElement("div");
    bar.className = "fallback-bar";
    bar.innerHTML = `<span>Download gestartet. Nichts angekommen?</span>
      <button class="btn" data-tab>In neuem Tab öffnen</button>
      <button class="btn btn-primary" data-open>Inhalt kopieren</button>
      <button class="icon-btn" data-close aria-label="Hinweis schließen">✕</button>`;
    document.body.appendChild(bar);
    requestAnimationFrame(() => bar.classList.add("show"));

    const close = () => bar.remove();
    bar.querySelector("[data-close]").addEventListener("click", close);
    // Öffnen aus einer Nutzeraktion heraus – das lassen Browser eher zu.
    bar.querySelector("[data-tab]").addEventListener("click", () => {
      window.open(url, "_blank", "noopener");
    });
    bar.querySelector("[data-open]").addEventListener("click", () => {
      close(); showTextFallback(content, filename);
    });
    setTimeout(() => { if (bar.isConnected) bar.classList.remove("show"); }, 12000);
    setTimeout(() => { if (bar.isConnected) bar.remove(); }, 12400);
  }

  // Eigener Bestätigungsdialog. Das eingebaute confirm() wird in eingebetteten
  // Ansichten (iframe/Sandbox) blockiert und liefert dort immer "false".
  function askConfirm(message, confirmLabel) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "overlay";
      overlay.innerHTML = `
        <div class="modal modal-confirm" role="dialog" aria-modal="true" aria-labelledby="cfTitle">
          <h3 id="cfTitle">Bitte bestätigen</h3>
          <p class="confirm-text"></p>
          <div class="modal-actions">
            <button class="btn" data-cancel>Abbrechen</button>
            <button class="btn btn-primary" data-ok></button>
          </div>
        </div>`;
      overlay.querySelector(".confirm-text").textContent = message;
      overlay.querySelector("[data-ok]").textContent = confirmLabel || "Bestätigen";
      document.body.appendChild(overlay);

      const done = (answer) => {
        document.removeEventListener("keydown", onKey);
        overlay.remove();
        resolve(answer);
      };
      function onKey(e) {
        if (e.key === "Escape") done(false);
        if (e.key === "Enter") done(true);
      }
      overlay.querySelector("[data-cancel]").addEventListener("click", () => done(false));
      overlay.querySelector("[data-ok]").addEventListener("click", () => done(true));
      overlay.addEventListener("click", (e) => { if (e.target === overlay) done(false); });
      document.addEventListener("keydown", onKey);
      overlay.querySelector("[data-ok]").focus();
    });
  }

  function showTextFallback(content, filename) {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgTitle">
        <h3 id="dlgTitle">Inhalt kopieren</h3>
        <p class="modal-hint">Kopiere den Text und speichere ihn als <code></code>.</p>
        <textarea readonly spellcheck="false"></textarea>
        <div class="modal-actions">
          <button class="btn" data-close>Schließen</button>
          <button class="btn btn-primary" data-copy>Alles kopieren</button>
        </div>
      </div>`;
    overlay.querySelector("code").textContent = filename;
    const ta = overlay.querySelector("textarea");
    ta.value = content;
    document.body.appendChild(overlay);
    ta.focus(); ta.select();

    const close = () => overlay.remove();
    overlay.querySelector("[data-close]").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
    });
    overlay.querySelector("[data-copy]").addEventListener("click", async () => {
      ta.select();
      try { await navigator.clipboard.writeText(content); }
      catch (e) { document.execCommand("copy"); }
      toast("Kopiert – jetzt einfügen und speichern");
      close();
    });
  }

  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  function wireActions() {
    document.querySelectorAll("[data-add]").forEach(btn => {
      btn.addEventListener("click", () => addRequirement(btn.dataset.add));
    });

    document.getElementById("btnDownload").addEventListener("click", () => {
      downloadBlob(md(), slugify(state.project.title) + "-anforderungen.md", "text/markdown;charset=utf-8");
      toast("Markdown-Datei heruntergeladen");
    });

    document.getElementById("btnCopy").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(md());
        toast("Markdown in Zwischenablage kopiert");
      } catch (e) {
        const ta = document.getElementById("markdownOut");
        const range = document.createRange();
        range.selectNodeContents(ta);
        const sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(range);
        document.execCommand("copy");
        toast("Markdown kopiert");
      }
    });

    document.getElementById("btnExportJson").addEventListener("click", () => {
      downloadBlob(JSON.stringify(state, null, 2), slugify(state.project.title) + "-anforderungen.json", "application/json");
      toast("Projekt als JSON gesichert");
    });

    const fileInput = document.getElementById("fileImport");
    document.getElementById("btnImport").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          state = Object.assign(defaultState(), parsed);
          renderAll();
          save();
          toast("Projekt importiert");
        } catch (e) {
          toast("Ungültige JSON-Datei");
        }
        fileInput.value = "";
      };
      reader.readAsText(file);
    });

    const mdInput = document.getElementById("fileImportMd");
    document.getElementById("btnImportMd").addEventListener("click", () => mdInput.click());
    mdInput.addEventListener("change", () => {
      const file = mdInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const parsed = parseMarkdown(reader.result);
        if (!hasContent(parsed)) {
          toast("Keine Anforderungen in der Datei erkannt");
          mdInput.value = "";
          return;
        }
        if (hasContent(state)) {
          const ok = await askConfirm(
            "Die aktuellen Eingaben werden durch den Inhalt der Datei ersetzt. Fortfahren?",
            "Ersetzen");
          if (!ok) { mdInput.value = ""; return; }
        }
        state = parsed;
        renderAll();
        save();
        toast(`Importiert: ${parsed.functional.length} fachliche, ` +
          `${parsed.nonfunctional.length} nicht-fachliche, ${parsed.acceptance.length} Kriterien`);
        mdInput.value = "";
      };
      reader.readAsText(file);
    });

    document.getElementById("btnReset").addEventListener("click", async () => {
      const ok = await askConfirm(
        "Wirklich alle Eingaben zurücksetzen? Das kann nicht rückgängig gemacht werden.",
        "Zurücksetzen");
      if (!ok) return;
      state = defaultState();
      renderAll();
      save();
      toast("Zurückgesetzt");
    });
  }

  // ---------- Initiales Rendering ----------
  function renderAll() {
    // Projektfelder befüllen (ohne erneutes Binden)
    document.getElementById("projTitle").value = state.project.title || "";
    document.getElementById("projAuthor").value = state.project.author || "";
    document.getElementById("projDesc").value = state.project.desc || "";
    document.getElementById("projTech").value = state.project.tech || "";
    document.getElementById("projScope").value = state.project.scope || "";
    renderRequirementList("functional");
    renderRequirementList("nonfunctional");
    renderAcceptanceList();
    renderMarkdown();
  }

  function init() {
    bindProject();
    wireActions();
    renderRequirementList("functional");
    renderRequirementList("nonfunctional");
    renderAcceptanceList();
    renderMarkdown();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
