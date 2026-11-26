const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const REMOTE = location.hostname.endsWith("github.io");
(() => { const k = new URLSearchParams(location.search).get("k");
  if (k) { try { localStorage.setItem("tf_key", k); } catch {} history.replaceState(null, "", location.pathname + location.hash); } })();
let API_BASE = null;
async function apiBase(force) {
  if (API_BASE && !force) return API_BASE;
  const c = await (await fetch("config.json?t=" + Date.now(), { cache: "no-store" })).json();
  return (API_BASE = String(c.api || "").replace(/\/$/, ""));
}
function askKey() {
  if ($("#keybox")) return;
  const d = document.createElement("div"); d.id = "keybox";
  d.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);display:grid;place-items:center;z-index:99";
  d.innerHTML = `<form class="card" style="padding:24px;max-width:340px;width:calc(100% - 32px)"><h3 style="margin:0 0 12px">Access key</h3>
    <input id="keyin" type="password" style="width:100%;padding:8px;margin-bottom:12px" placeholder="paste key"><button class="ghost on" type="submit">Unlock</button></form>`;
  d.querySelector("form").onsubmit = e => { e.preventDefault(); try { localStorage.setItem("tf_key", $("#keyin").value.trim()); } catch {} location.reload(); };
  document.body.appendChild(d);
}
let ROUTE_GEN = 0; const STALE = new Error("stale");
const api = async (p, retry = true) => {
  const g = ROUTE_GEN, d = await api0(p, retry);
  if (g !== ROUTE_GEN) throw STALE;
  return d;
};
const api0 = async (p, retry = true) => {
  if (!REMOTE) { const r = await fetch("/api/" + p); return r.json(); }
  let k = ""; try { k = localStorage.getItem("tf_key") || ""; } catch {}
  if (!k) { askKey(); throw new Error("access key needed"); }
  let r;
  try { r = await fetch((await apiBase()) + "/api/" + p, { headers: { "X-TF-Key": k }, cache: "no-store" }); }
  catch (e) {
    if (retry) { await apiBase(true); return api0(p, false); }
    throw new Error("backend offline (laptop asleep, or tunnel restarting — retry in ~2 min)");
  }
  if (r.status === 401) { try { localStorage.removeItem("tf_key"); } catch {} askKey(); throw new Error("wrong access key"); }
  return r.json();
};
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("tf_" + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("tf_" + k, JSON.stringify(v)); } catch {} },
};
const NAV = [
  { r: "home", t: "Home", ic: "▦", crumb: "OVERVIEW" },
  { g: "Stocks", ic: "♥", items: [
    { r: "marketPulse", t: "Market Pulse" }, { r: "insiderStrategy", t: "Insider Strategy" },
    { r: "sectorScope", t: "Sector Scope" }, { r: "swingSpectrum", t: "Swing Spectrum" }] },
  { g: "Index", ic: "▟", items: [
    { r: "optionClock", t: "Option Clock" }, { r: "optionApex", t: "Option Apex" }, { r: "indexMover", t: "Index Mover" }] },
  { r: "fiiDii", t: "FII DII", ic: "⇅" },
  { r: "tradingJournal", t: "Trading Journal", ic: "✎" },
  { r: "watchlist", t: "Watchlist", ic: "★" },
  { r: "calculator", t: "Calculator", ic: "⌗" },
  { r: "status", t: "Engine Status", ic: "⚙" },
];
function drawNav(cur) {
  $("#nav").innerHTML = NAV.map(n => n.g
    ? `<div class="grp"><div class="gh"><span class="ic">${n.ic}</span>${n.g}</div><div class="sub">${
        n.items.map(i => `<a href="#/${i.r}" class="${i.r === cur ? "on" : ""}">${i.t}</a>`).join("")}</div></div>`
    : `<a href="#/${n.r}" class="${n.r === cur ? "on" : ""}"><span class="ic">${n.ic}</span>${n.t}</a>`).join("");
}
function titleOf(r) {
  for (const n of NAV) { if (n.r === r) return [n.crumb || "TOOLS", n.t];
    for (const i of n.items || []) if (i.r === r) return [n.g === "Index" ? "INDEX" : "MARKETS", i.t]; }
  return ["", r];
}
const f2 = v => v == null || isNaN(v) ? "—" : Number(v).toFixed(2);
const inr = (v, d = 2) => v == null || isNaN(v) ? "—" : Number(v).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const cls = v => v > 0 ? "up" : v < 0 ? "dn" : "mut";
const chip = v => `<span class="chip ${v >= 0 ? "up" : "dn"}">${f2(v)}</span>`;
const sgn = s => s === "bull" ? `<span class="sg up" title="Bullish">▲</span>` : s === "bear" ? `<span class="sg dn" title="Bearish">▼</span>` : "";
function hue(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function symCell(r) {
  const h = hue(r.sym);
  return `<div class="sym"><span class="av" style="background:hsla(${h},45%,40%,.35);color:hsl(${h},70%,78%)">${esc(r.sym.slice(0, 2))}</span>
    <div><a class="symlink" href="${esc(chartUrl(r.sym))}" target="_blank" rel="noopener noreferrer" title="Open ${esc(r.sym)} chart" onclick="event.preventDefault();openChart('${esc(r.sym)}')"><b>${esc(r.sym)}</b></a><small>${esc(r.name || "")}</small></div></div>`;
}
const wl = () => store.get("watch", []);
function starCell(r) {
  const on = wl().includes(r.sym);
  return `<span class="chart-l" onclick="openChart('${r.sym}')" title="Open Chart">📈</span>
    <span class="star ${on ? "on" : ""}" onclick="toggleWatch('${r.sym}',this)" title="Watchlist">${on ? "★" : "☆"}</span>`;
}
window.toggleWatch = (s, el) => {
  let w = wl(); w = w.includes(s) ? w.filter(x => x !== s) : [...w, s]; store.set("watch", w);
  if (el) { el.classList.toggle("on"); el.textContent = w.includes(s) ? "★" : "☆"; }
};
const CHART_PROVIDERS = { tradingview: "TradingView", lemonn: "Lemonn", fyers: "Fyers" };
const chartProvider = () => { const p = store.get("chart_provider", "tradingview"); return CHART_PROVIDERS[p] ? p : "tradingview"; };
function chartUrl(sym, prov = chartProvider()) {
  sym = String(sym || "").trim();
  if (prov === "lemonn") return `https://tv.lemonn.co.in/symbol/${sym.replace(/NIFTY 50/g, "NIFTY").replace(/NIFTY BANK/g, "BANKNIFTY")}`;
  if (prov === "fyers") return `https://trade.fyers.in/popout/index.html?symbol=NSE:${sym}-EQ`.replace(/NIFTY 50/g, "NIFTY50").replace(/NIFTY BANK/g, "NIFTYBANK")
    .replace(/NIFTY MID SELECT/g, "MIDCPNIFTY").replace("&", "%26").replace("NIFTY50-EQ", "NIFTY50-INDEX").replace("NIFTYBANK-EQ", "NIFTYBANK-INDEX")
    .replace("MIDCPNIFTY-EQ", "MIDCPNIFTY-INDEX").replace("NSE:SENSEX-EQ", "BSE:SENSEX-INDEX");
  return `https://www.tradingview.com/chart/?symbol=NSE:${sym.replace(/[-&]/g, "_")}&interval=5`.replace(/NIFTY 50/g, "NIFTY").replace(/NIFTY BANK/g, "BANKNIFTY");
}
window.openChart = s => window.open(chartUrl(s), "_blank", "noopener,noreferrer");
document.addEventListener("click", e => {
  if (e.defaultPrevented || e.button !== 0 || String(getSelection() || "")) return;
  if (e.target.closest("a,button,input,select,label,.star,.chart-l,th")) return;
  const el = e.target.closest("tr[data-sym],.t[data-sym]"); if (!el) return;
  openChart(el.dataset.sym);
});
const tip = $("#tip");
document.addEventListener("mousemove", e => {
  const t = e.target.closest("[data-tip]");
  if (!t) { tip.style.display = "none"; return; }
  tip.innerHTML = t.dataset.tip; tip.style.display = "block";
  const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8);
  tip.style.left = x + "px"; tip.style.top = (e.clientY + 14) + "px";
});
const TSTATE = {}, TABLES = {};
const HEAT_W = [5, 4, 3.3, 2.5, 2, 1.67, 1.43, 1.25, 1.11];
const NUMRE = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
function sortVal(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const t = String(v ?? "").trim();
  let m = /^(\d{1,2})[:.](\d{2})(?::(\d{2}))?$/.exec(t);
  if (m) return (60 * +m[1] + +m[2]) * 60 + +(m[3] || 0);
  m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(t);
  if (m) return Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) / 1e3;
  return NUMRE.test(t) ? parseFloat(t) : t.toUpperCase();
}
function tfSort(rows, key, dir) {
  return rows.sort((a, b) => {
    const x = sortVal(key(a)), y = sortVal(key(b));
    let c = 0;
    if (typeof x === typeof y) c = x < y ? -1 : x > y ? 1 : 0;
    else c = typeof x === "number" ? -1 : 1;
    if (c) return c * dir;
    const p = String(a.sym ?? "").toUpperCase(), q = String(b.sym ?? "").toUpperCase();
    return p < q ? -1 : p > q ? 1 : 0;
  });
}
const rowKey = r => `${r.sym}|${r.dtime ?? r.time ?? r.date ?? ""}`;
function tableCard(id, o) {
  const st = TSTATE[id] ||= { sort: o.sort || null, q: "", dir: "all", sector: "all", price: "All", volt: "all", view: "table" };
  const t = TABLES[id] ||= { id };
  t.st = st; t.o = o;
  const sel = (f, opts) => `<select data-f="${f}">${opts}</select>`;
  const hdr = `<div class="chead"><div><h2>${o.title}${o.info ? ` <span class="info" data-tip="${esc(o.info)}">💡</span>` : ""}</h2>
      <div class="meta">${o.live !== false ? `<span class="live-b">LIVE</span>` : ""}
      ${o.filters?.dir ? sel("dir", `<option value="all">Neutral</option><option value="bull">Bullish</option><option value="bear">Bearish</option>`) : ""}
      ${o.filters?.price ? sel("price", PRICE_BUCKETS.map(b => `<option>${b}</option>`).join("")) : ""}
      ${o.filters?.volt ? sel("volt", `<option value="all">Neutral</option><option>High</option><option>Low</option>`) : ""}
      ${o.filters?.sector ? `<select data-f="sector" data-sectors></select>` : ""}
      <span class="pill" data-n></span>${o.upd !== false ? `<span class="upd" data-upd></span>` : ""}
      ${o.search !== false ? `<input class="search" placeholder="Search symbol…" data-f="q">` : ""}
      ${o.heat ? `<div class="vt"><button data-v="table" title="Table view">☰</button><button data-v="heat" title="Heatmap view">▦</button></div>` : ""}</div></div></div>`;
  t.html = `<div class="card ${o.cls || ""}" id="${id}" data-live>${hdr}${o.sub ? `<div data-sub>${o.sub}</div>` : ""}<div class="tw ${o.tall ? "tall" : ""}"></div><div class="tm hm" style="display:none"></div></div>`;
  return t;
}
function mountTable(t) {
  const el = document.getElementById(t.id); if (!el) return;
  const { st } = t;
  t.prev = null;
  el.querySelectorAll("[data-f]").forEach(inp => {
    if (inp.dataset.f === "sector") fillSectors(t, inp);
    inp.value = st[inp.dataset.f];
    inp.oninput = () => { st[inp.dataset.f] = inp.value; renderRows(t, { quiet: 1 }); };
  });
  el.querySelectorAll("[data-v]").forEach(b => b.onclick = () => { st.view = b.dataset.v; renderRows(t, { quiet: 1 }); });
  renderRows(t, { quiet: 1 });
}
function fillSectors(t, inp) {
  const secs = t.o.sectors || [], sig = secs.join("|");
  if (inp.dataset.sig === sig) return;
  inp.dataset.sig = sig;
  inp.innerHTML = `<option value="all">All</option>${secs.map(s => `<option>${esc(s)}</option>`).join("")}`;
  inp.value = t.st.sector;
}
function updateTable(t, rows, extra = {}) {
  Object.assign(t.o, extra, { rows });
  const el = document.getElementById(t.id); if (!el) return;
  const s = el.querySelector("[data-sectors]"); if (s) fillSectors(t, s);
  renderRows(t);
}
function viewRows(t) {
  const { o, st } = t;
  let rows = (o.rows || []).slice();
  if (st.q) { const q = st.q.toUpperCase();
    rows = rows.filter(r => [r.sym, r.name, r.dtime, r.time, r.date, r.segment].some(x => x != null && String(x).toUpperCase().includes(q))); }
  if (st.dir !== "all") rows = rows.filter(r => r.sgn === st.dir);
  if (st.sector !== "all") rows = rows.filter(r => (r.groups || []).includes(st.sector));
  if (st.price && st.price !== "All") rows = rows.filter(r => inBucket(r.open, st.price));
  if (st.volt && st.volt !== "all") rows = rows.filter(r => r.volt === st.volt);
  if (st.sort) {
    const [k, d] = st.sort, col = o.cols.find(c => c.k === k), key = col?.sk || (r => r[k]);
    tfSort(rows, key, d);
  }
  return rows;
}
function renderRows(t, { quiet } = {}) {
  const el = document.getElementById(t.id); if (!el) return;
  const { o, st } = t, rows = viewRows(t);
  el.querySelector("[data-n]").textContent = `${rows.length} stocks`;
  const up = el.querySelector("[data-upd]");
  if (up && !quiet) { up.textContent = "updated " + new Date().toLocaleTimeString("en-IN", { hour12: false }); up.classList.remove("pulse"); void up.offsetWidth; up.classList.add("pulse"); }
  el.querySelectorAll("[data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === st.view));
  const tw = el.querySelector(".tw"), hm = el.querySelector(".hm");
  const heat = o.heat && st.view === "heat";
  tw.style.display = heat ? "none" : ""; hm.style.display = heat ? "" : "none";
  if (heat) { drawHeat(t, hm, rows); t.prev = null; return; }
  const oldPos = {}, oldVal = t.prev || {};
  tw.querySelectorAll("tbody tr[data-key]").forEach(tr => oldPos[tr.dataset.key] = tr.getBoundingClientRect().top);
  const sortCol = st.sort && st.sort[0];
  const th = o.cols.map(c => {
    const act = sortCol === c.k, dsc = act && st.sort[1] < 0, can = c.k !== "_";
    return `<th class="${c.r ? "r" : ""}${act ? " act" : ""}${can ? "" : " ns"}" data-k="${c.k}" aria-sort="${act ? (dsc ? "descending" : "ascending") : "none"}">${c.label}${act ? `<i class="si">${dsc ? "▼" : "▲"}</i>` : can ? `<i class="si ghost-i">▲▼</i>` : ""}</th>`;
  }).join("");
  const vals = {};
  const body = rows.length ? rows.map(r => {
    const key = rowKey(r); vals[key] = {};
    const tds = o.cols.map(c => {
      const raw = c.k === "_" ? null : (c.sk ? c.sk(r) : r[c.k]);
      if (raw != null) vals[key][c.k] = raw;
      let fl = "";
      if (t.prev && oldVal[key] && typeof raw === "number" && typeof oldVal[key][c.k] === "number" && raw !== oldVal[key][c.k])
        fl = raw > oldVal[key][c.k] ? " fl-up" : " fl-dn";
      return `<td class="${c.r ? "r" : ""}${fl}">${c.fmt ? c.fmt(r) : esc(r[c.k])}</td>`;
    }).join("");
    const isNew = t.prev && !oldVal[key];
    return `<tr data-key="${esc(key)}" data-sym="${esc(r.sym)}" title="Open ${esc(r.sym)} chart" class="${isNew ? "is-new" : ""}">${tds}</tr>`;
  }).join("") : `<tr><td colspan="${o.cols.length}" class="empty">${o.empty || "Waiting on session prints — signals fill as the tape builds."}</td></tr>`;
  const top = tw.scrollTop;
  tw.innerHTML = `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
  tw.scrollTop = top;
  t.prev = vals;
  if (!quiet && Object.keys(oldPos).length) {
    const moved = [];
    tw.querySelectorAll("tbody tr[data-key]").forEach(tr => {
      const o0 = oldPos[tr.dataset.key]; if (o0 == null) return;
      const dy = o0 - tr.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) { tr.style.transform = `translateY(${dy}px)`; tr.style.transition = "none"; moved.push(tr); }
    });
    if (moved.length) requestAnimationFrame(() => requestAnimationFrame(() => moved.forEach(tr => {
      tr.style.transition = "transform .6s cubic-bezier(.2,.8,.2,1)"; tr.style.transform = ""; })));
  }
  tw.querySelectorAll("th").forEach(h => h.onclick = () => {
    const k = h.dataset.k; if (k === "_") return;
    st.sort = st.sort && st.sort[0] === k ? [k, -st.sort[1]] : [k, k === "sym" ? 1 : -1];
    t.prev = null; renderRows(t, { quiet: 1 });
  });
}
function drawHeat(t, el, rows) {
  const k = t.st.sort?.[0], col = t.o.cols.find(c => c.k === k), key = col?.sk || (r => r[k]);
  const n = Math.min(rows.length, 50);
  if (!n) { el.style.height = "auto"; el.innerHTML = `<div class="empty">Heatmap fills once session prints arrive.</div>`; return; }
  const items = rows.slice(0, 50).map((r, i) => {
    const v = Number(key(r)), base = Number.isFinite(v) && k !== "sym" ? Math.abs(v) : (n - i);
    return { w: Math.max(Math.pow(base || Math.abs(r.pchg) || .1, 2) * (HEAT_W[i] ?? 1), .01), sym: r.sym, label: r.sym, sub: `${f2(r.pchg)}%`,
      color: heat(r.pchg ?? 0), tip: `<b>${esc(r.sym)}</b> ${esc(r.name || "")}<br>${f2(r.pchg)}%${r.rf != null ? ` · R.FAC ${f2(r.rf)}` : ""}${col && k !== "pchg" && k !== "rf" ? ` · ${col.label} ${f2(v)}` : ""}` };
  });
  treemap(el, items, t.o.tall ? 620 : 400);
}
function paint(v, tables, html, refresh, rowsOf) {
  const alive = refresh && tables.every(t => document.getElementById(t.id));
  if (alive) { tables.forEach(t => updateTable(t, rowsOf ? rowsOf(t) : t.o.rows)); return true; }
  v.innerHTML = html(); tables.forEach(mountTable); return false;
}
const PRICE_BUCKETS = ["All", "100 - 1K", "1K - 1.5K", "1.5K - 2K", "2K - 3K", "3K - 5K", "5K - Beyond"];
function inBucket(e, b) {
  if (!(e > 0)) return false;
  return { "100 - 1K": e >= 100 && e <= 1e3, "1K - 1.5K": e > 1e3 && e <= 1500, "1.5K - 2K": e > 1500 && e <= 2e3,
    "2K - 3K": e > 2e3 && e <= 3e3, "3K - 5K": e > 3e3 && e <= 5e3, "5K - Beyond": e > 5e3 }[b] ?? true;
}
const C = {
  sgn: { k: "sgn", label: "SGN", fmt: r => sgn(r.sgn) },
  sym: { k: "sym", label: "SYMBOL", fmt: symCell },
  act: { k: "_", label: "", fmt: starCell },
  pct: { k: "pchg", label: "%", r: 1, fmt: r => chip(r.pchg) },
  rf: { k: "rf", label: "R.FAC", r: 1, fmt: r => `<span class="num">${f2(r.rf)}</span>` },
  num: (k, label, d = 2) => ({ k, label, r: 1, fmt: r => `<span class="num">${inr(r[k], d)}</span>` }),
  txt: (k, label) => ({ k, label, r: 1, fmt: r => `<span class="num mut">${esc(r[k] ?? "")}</span>` }),
};
function squarify(items, x, y, w, h) {
  const out = []; items = items.filter(i => i.w > 0).sort((a, b) => b.w - a.w);
  const total = items.reduce((s, i) => s + i.w, 0); if (!total) return out;
  const scale = (w * h) / total; let rest = items.map(i => ({ ...i, a: i.w * scale }));
  const worst = (row, len) => { const s = row.reduce((a, r) => a + r.a, 0), mx = Math.max(...row.map(r => r.a)), mn = Math.min(...row.map(r => r.a));
    return Math.max(len * len * mx / (s * s), (s * s) / (len * len * mn)); };
  while (rest.length) {
    const len = Math.min(w, h); let row = [rest[0]], i = 1;
    while (i < rest.length && worst([...row, rest[i]], len) <= worst(row, len)) row.push(rest[i++]);
    const s = row.reduce((a, r) => a + r.a, 0);
    if (w >= h) { const cw = s / h; let cy = y; for (const r of row) { const ch = r.a / cw; out.push({ ...r, x, y: cy, w: cw, h: ch }); cy += ch; } x += cw; w -= cw; }
    else { const ch = s / w; let cx = x; for (const r of row) { const cw2 = r.a / ch; out.push({ ...r, x: cx, y, w: cw2, h: ch }); cx += cw2; } y += ch; h -= ch; }
    rest = rest.slice(i);
  }
  return out;
}
function heat(p, max = 3) {
  const t = Math.min(1, Math.abs(p) / max);
  return p >= 0 ? `rgb(${Math.round(60 - 20 * t)},${Math.round(110 + 50 * t)},${Math.round(80 - 10 * t)})`
                : `rgb(${Math.round(140 + 60 * t)},${Math.round(70 - 20 * t)},${Math.round(75 - 15 * t)})`;
}
function treemap(el, items, height) {
  const W = el.clientWidth || 800; el.style.height = height + "px";
  el.innerHTML = squarify(items, 0, 0, W, height).map(t => `<div class="t${t.sym ? " clk" : ""}"${t.sym ? ` data-sym="${esc(t.sym)}"` : ""} style="left:${t.x}px;top:${t.y}px;width:${t.w}px;height:${t.h}px;background:${t.color}" data-tip="${esc(t.tip || t.label)}">
      ${t.w > 44 && t.h > 20 ? `<span>${esc(t.label)}</span>` : ""}${t.w > 60 && t.h > 38 && t.sub ? `<small>${esc(t.sub)}</small>` : ""}</div>`).join("");
}
function barsSVG(vals, labels, { h = 150, color } = {}) {
  const n = vals.length, W = 1000, mx = Math.max(1, ...vals.map(Math.abs)), bw = W / n * .66, mid = h / 2;
  const bars = vals.map((v, i) => { const bh = Math.abs(v) / mx * (h / 2 - 8), x = i * W / n + (W / n - bw) / 2;
    return `<rect x="${x}" y="${v >= 0 ? mid - bh : mid}" width="${bw}" height="${Math.max(bh, 1)}" rx="3" fill="${color ? color(v) : v >= 0 ? "#4b9ef0" : "#e0739a"}"><title>${labels[i]}: ${inr(v)}</title></rect>`; }).join("");
  return `<svg viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" width="100%" height="${h}"><line x1="0" x2="${W}" y1="${mid}" y2="${mid}" stroke="rgba(143,164,188,.25)"/>${bars}</svg>`;
}
function donutSVG(a, b, ca, cb, center) {
  const tot = a + b || 1, r = 70, c = 2 * Math.PI * r, da = a / tot * c;
  return `<svg viewBox="0 0 200 200" width="190" height="190"><circle cx="100" cy="100" r="${r}" fill="none" stroke="${cb}" stroke-width="26"/>
    <circle cx="100" cy="100" r="${r}" fill="none" stroke="${ca}" stroke-width="26" stroke-dasharray="${da} ${c}" transform="rotate(-90 100 100)"/>
    <text x="100" y="92" text-anchor="middle" fill="#8fa4bc" font-size="13" font-weight="600">PCR</text>
    <text x="100" y="118" text-anchor="middle" fill="#fff" font-size="24" font-weight="700">${center}</text></svg>`;
}
function gaugeSVG(x, label) {
  const a = Math.PI * (1 - (x + 1) / 2), cx = 110, cy = 100, r = 78;
  const nx = cx + Math.cos(a) * (r - 14), ny = cy - Math.sin(a) * (r - 14);
  return `<svg viewBox="0 0 220 130" width="100%" height="130"><defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="#f07178"/><stop offset=".5" stop-color="#8fa4bc"/><stop offset="1" stop-color="#3ecf8e"/></linearGradient></defs>
    <path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="url(#gg)" stroke-width="12" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="6" fill="#fff"/>
    <text x="14" y="124" fill="#8fa4bc" font-size="10">Strong Sell</text><text x="206" y="124" fill="#8fa4bc" font-size="10" text-anchor="end">Strong Buy</text>
    <text x="${cx}" y="16" fill="#8fa4bc" font-size="10" text-anchor="middle">Neutral</text>
    <text x="${cx}" y="124" fill="#fff" font-size="13" font-weight="700" text-anchor="middle">${label}</text></svg>`;
}
const PAGES = {};
let timer = null, curRoute = null;
PAGES.home = {
  every: 15000,
  async render(v) {
    const d = await api("home");
    const tools = [
      ["marketPulse", "💓", "Market Pulse", "Live scanners for breakouts, R-Factor boost, gainers, losers, day-high/low and high-turnover stocks."],
      ["insiderStrategy", "🎯", "Insider Strategy", "Momentum-spike heatmaps plus intraday setups: LOM, contraction breakouts, H/L reversals, index alpha."],
      ["sectorScope", "🧭", "Sector Scope", "Sector strength and breadth, ranked by R-Factor, with every constituent in one view."],
      ["swingSpectrum", "📊", "Swing Spectrum", "Daily swing scans: 10/50-day breakouts, reversal radar, channel breakouts, NR7, delivery."],
      ["optionClock", "⏱", "Option Clock", "Call vs put OI change by strike, net position, PCR — with an intraday time window."],
      ["optionApex", "🕯", "Option Apex", "Index candles with futures money-flux, sentiment and PCR dials, constituent money flux."],
      ["indexMover", "📈", "Index Mover", "Which stocks are pushing or dragging the index, ranked by point contribution."],
      ["fiiDii", "🏦", "FII / DII", "Institutional cash-market flows, collected daily from NSE."],
    ];
    v.innerHTML = `
      <div class="card hero"><small>DEADLY STOCKS · WORKSPACE</small><h2>Welcome back</h2>
        <div class="note">Scanners, flow and setups — one workspace for the session. Every number is computed locally from your Upstox feed + NSE.</div>
        <div class="row" style="margin-top:12px"><span class="pill ${d.status.market_open ? "act" : ""}">${d.status.market_open ? "Market open" : "Market closed"}</span>
        <span class="pill">Breadth: <b class="up">${d.adv}</b> / <b class="dn">${d.dec}</b></span>
        <span class="pill">${d.status.stocks} F&O stocks</span></div></div>
      <div class="grid g3" style="margin-top:16px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">${d.indices.map(i => `
        <div class="card idx"><b>${i.name}</b><span class="v">${inr(i.ltp)}</span><span class="${cls(i.chg)} num">${i.chg >= 0 ? "+" : ""}${inr(i.chg)} (${f2(i.pchg)}%)</span></div>`).join("")}</div>
      <h3 style="margin:22px 0 10px">● Core tools <span class="mut" style="font-weight:400;font-size:12px">Daily stack</span></h3>
      <div class="grid g4">${tools.map(t => `<a class="card tool" href="#/${t[0]}"><div class="ti">${t[1]}</div><h3>${t[2]}</h3><p>${t[3]}</p></a>`).join("")}</div>`;
  },
};
const TIP = {
  bb: "Stocks breaking out with momentum as participation builds.",
  ib: "Stocks with a sharp pickup in today's activity versus the last 20 sessions.",
  tl: "Names trading near the day's high — candidates for breakouts and reversals from those levels. Diff = % below the day high.",
  ll: "Names trading near the day's low — candidates for breakdowns and reversal setups. Diff = % above the day low.",
  tg: "Stocks that have shown the highest rise compared to yesterday's close.",
  tlo: "Stocks that have taken the steepest falls compared to yesterday's close.",
  hp: "Cash-segment names with the highest turnover today (₹ Cr).",
  sp: "Stocks with a sharp volume and price move in the last 5 / 10 minutes.",
  ls: "LOM = Loss Of Momentum. Bullish LOM: price was falling but bulls have entered. Bearish LOM: price was rising but bears have entered. For intraday trading.",
  ll2: "LOMs for swing trading — ride full swings and take advantage of gap up/down.",
  cb: "Stocks that were consolidating in a tight range and have now broken out. Bullish = upside breakout, Bearish = downside.",
  dr: "Stocks trading near day's high or low but showing signs of reversal.",
  td: "Stocks breaking both the 2-day high or low — a stronger momentum shift.",
  ia: "Completely backtested strategy for Nifty and BankNifty.",
  sn: "Backtested swing strategy with a Sniper Reversal entry. Updated every Friday at 4pm.",
  b10: "Stocks breaking through 10-day highs or lows. Above the 10-day high = bullish momentum; below the 10-day low = bearish control.",
  b50: "Stocks breaking through 50-day highs or lows — significant shifts in market trends.",
  rr: "Stocks exhibiting reversal patterns on the daily timeframe — potential trend flips for swing traders.",
  ch: "Stocks that consolidated in a tight daily range and are now breaking out.",
  nr7: "Stocks with the narrowest high–low range versus the past 7 days — compression before expansion.",
  ww: "Weekly change across major indices and sectors for swing and positional context.",
  dl: "Delivery versus average — a read on whether a name is being accumulated or distributed. Highest Delivery: highest delivery % in the session. Delivery Spike: delivery has jumped versus its average.",
  ss: "See which sectors are leading, and which stocks inside them have the strongest participation.",
};
PAGES.marketPulse = {
  every: 10000,
  async render(v, refresh) {
    const d = await api("market_pulse");
    const secs = d.sectors || [];
    const F = { sector: 1 }, sp = { sectors: secs, heat: 1, upd: false };
    (d.breakout_beacon || []).forEach(r => r.sgn_abs = Math.abs(r.sgn_pct));
    d.intraday_boost = (d.intraday_boost || []).slice().sort((a, b) => (b.rf ?? -1e9) - (a.rf ?? -1e9)).slice(0, 80);
    d.high_power = (d.high_power || []).slice(0, 50);
    const tb = [
      tableCard("bb", { title: "Breakout Beacon", info: TIP.bb, rows: d.breakout_beacon, sort: ["sgn_abs", -1], filters: { dir: 1, sector: 1 }, ...sp,
        cols: [C.sgn, C.sym, C.act, C.pct, { k: "sgn_abs", label: "SGN %", r: 1, sk: r => Math.abs(r.sgn_pct), fmt: r => `<b class="num ${cls(r.sgn_pct)}">${f2(r.sgn_pct)}</b>` }, C.txt("time", "TIME")], empty: "Needs today's 5-min candles — loads a few minutes after start" }),
      tableCard("ib", { title: "Intraday Boost", info: TIP.ib, rows: d.intraday_boost, sort: ["rf", -1], filters: { dir: 1, price: 1, volt: 1, sector: 1 }, ...sp,
        cols: [C.sym, C.act, C.pct, C.rf, C.sgn], empty: "R-Factor baselines loading…" }),
      tableCard("tl", { title: "Top Level Stocks", info: TIP.tl, rows: d.top_level, sort: ["diff", 1], filters: F, ...sp, cols: [C.sym, C.act, C.pct, C.num("diff", "DIFF")] }),
      tableCard("ll", { title: "Low Level Stocks", info: TIP.ll, rows: d.low_level, sort: ["diff", 1], filters: F, ...sp, cols: [C.sym, C.act, C.pct, C.num("diff", "DIFF")] }),
      tableCard("tg", { title: "Top Gainers", info: TIP.tg, rows: d.gainers, sort: ["pchg", -1], filters: F, ...sp, cols: [C.sym, C.act, C.pct, C.rf] }),
      tableCard("tlo", { title: "Top Losers", info: TIP.tlo, rows: d.losers, sort: ["pchg", 1], filters: F, ...sp, cols: [C.sym, C.act, C.pct, C.rf] }),
      tableCard("hp", { title: "High Power Stocks", info: TIP.hp, rows: d.high_power, sort: ["to", -1], filters: F, ...sp, cols: [C.sym, C.act, C.pct, C.num("to", "T.O.")] }),
    ];
    paint(v, tb, () => `<div class="mp-top"><div class="tabs">${tb.map(t => `<button class="ghost" onclick="document.getElementById('${t.id}').scrollIntoView({behavior:'smooth'})">${t.o.title}</button>`).join("")}</div>
      <span class="live-b">LIVE</span><span class="upd" id="mp_upd"></span></div>
      <div class="grid g2">${tb.map(t => t.html).join("")}</div>`, refresh);
    const up = document.getElementById("mp_upd");
    if (up) { up.textContent = "Updated " + new Date().toLocaleTimeString("en-IN", { hour12: false }); up.classList.remove("pulse"); void up.offsetWidth; up.classList.add("pulse"); }
  },
};
PAGES.insiderStrategy = {
  every: 30000,
  async render(v, refresh) {
    const d = await api("insider");
    const sp = { sectors: d.sectors || [] };
    const ev = (id, title, info, rows, extra = []) => tableCard(id, { title, info, rows, sort: ["dtime", -1], filters: { dir: 1, sector: 1 }, ...sp,
      cols: [C.sym, C.act, C.pct, C.txt("dtime", "DATE-TIME"), ...extra, C.sgn] });
    const tb = [
      ev("lom_s", "LOM Short Term", TIP.ls, d.lom_short),
      ev("lom_l", "LOM Long Term", TIP.ll2, d.lom_long),
      ev("cbo", "Contraction BO", TIP.cb, d.contraction),
      ev("dhl", "Day H/L Reversal", TIP.dr, d.dayhl),
      ev("tdb", "2 Day H/L BO", TIP.td, d.twoday),
      tableCard("ia", { title: "Index Alpha", info: TIP.ia, rows: d.alpha, sort: ["dtime", -1], search: false,
        cols: [{ k: "sym", label: "SYMBOL", fmt: r => `<b>${esc(r.sym)}</b>` }, C.pct, C.txt("dtime", "DATE-TIME"), C.txt("segment", "DAY SEGMENT"), C.sgn], empty: "First checkpoint at 09:50" }),
      ev("ssr", "Sniper Swing Reversal", TIP.sn, d.sniper),
    ];
    const spike = (id, t) => `<div class="card"><div class="chead"><div><h2>${t} <span class="info" data-tip="${esc(TIP.sp)}">💡</span></h2><div class="meta"><span class="live-b">LIVE</span></div></div></div><div class="tm" id="${id}"></div></div>`;
    paint(v, tb, () => `${spike("sp5", "5 MIN MOMENTUM SPIKE")}<div style="height:16px"></div>${spike("sp10", "10 MIN MOMENTUM SPIKE")}
      <div class="tabs" style="margin-top:18px">${tb.map(t => `<button class="ghost" onclick="document.getElementById('${t.id}').scrollIntoView({behavior:'smooth'})">${t.o.title}</button>`).join("")}</div>
      <div class="grid g2">${tb.map(t => t.html).join("")}</div>`, refresh);
    for (const [id, rows] of [["sp5", d.spike5], ["sp10", d.spike10]]) {
      const el = document.getElementById(id);
      if (!rows.length) { el.innerHTML = `<div class="empty">No momentum spikes in the last candles</div>`; continue; }
      treemap(el, rows.map(r => ({ w: r.spike, sym: r.sym, label: r.sym, sub: `${f2(r.move)}% · ${r.spike}x`, color: heat(r.move, 1.2),
        tip: `<b>${r.sym}</b> ${esc(r.name)}<br>move ${f2(r.move)}% · spike ${r.spike}x · day ${f2(r.pchg)}% · ${r.time}` })), 250);
    }
  },
};
const SS_PAL = [[-100, [176, 42, 53]], [-50, [224, 82, 82]], [0, [91, 101, 115]], [50, [34, 168, 90]], [100, [14, 143, 74]]];
function ssVal(v, sibs) {
  const mx = Math.max(0, ...sibs), mn = Math.min(0, ...sibs);
  return v > 0 ? 40 + 60 * Math.min(1, v / (mx || 1)) : v < 0 ? -40 - 60 * Math.min(1, v / (mn || -1)) : 0;
}
function ssColor(v, sibs) {
  const s = ssVal(v, sibs);
  for (let k = 1; k < SS_PAL.length; k++) {
    const [x0, c0] = SS_PAL[k - 1], [x1, c1] = SS_PAL[k];
    if (s <= x1) { const t = (s - x0) / (x1 - x0); return `rgb(${c0.map((c, q) => Math.round(c + (c1[q] - c) * t)).join(",")})`; }
  }
  return "rgb(14,143,74)";
}
const ssPct = v => (v > 0 ? "+" : "") + (Math.round(v * 100) / 100).toFixed(2) + "%";
function ssLabel(t) {
  if (t.h < 14 || t.w < 24) return "";
  const fs = Math.max(9, Math.min(12, t.w / (t.r.sym.length * 0.66 + 1)));
  return `<span style="font-size:${fs.toFixed(1)}px">${esc(t.r.sym)}</span>`;
}
const ssId = g => "sec_" + g.replace(/\W/g, "");
PAGES.sectorScope = {
  every: 10000, zoom: null,
  async render(v, refresh) {
    const d = await api("sector_scope"), me = PAGES.sectorScope, secs = d.sectors || [];
    const pos = secs.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(s => s.sector);
    const neg = secs.filter(s => s.score < 0).sort((a, b) => a.score - b.score).slice(0, 3).map(s => s.sector);
    const breadth = s => {
      const up = s.up, dn = s.down, n = up + dn || 1, lead = up >= dn, a = lead ? up : dn, b = lead ? dn : up;
      return `<div class="ssb"><div class="ssb-track ${lead ? "dn" : "up"}"><div class="ssb-fill ${lead ? "up" : "dn"}" style="width:${(100 * a / n).toFixed(1)}%"></div></div>
        <div class="ssb-l"><span class="${lead ? "up" : "dn"}">${a} stocks (${(100 * a / n).toFixed(2)}% ${lead ? "Up" : "Down"})</span>
        <span class="${lead ? "dn" : "up"}">${b} stocks (${(100 * b / n).toFixed(2)}% ${lead ? "Down" : "Up"})</span></div></div>`;
    };
    const sgnTF = { k: "sgn", label: "SGN", fmt: r => r.sgn === "bull" || r.sgn === "bear" ? sgn(r.sgn) : `<span class="mut">—</span>` };
    const tb = secs.map(s => tableCard(ssId(s.sector), {
      title: esc(s.sector), info: TIP.ss, rows: s.stocks, sort: ["rf", -1], heat: 1, sub: breadth(s),
      cls: pos.includes(s.sector) ? "ss-pos" : neg.includes(s.sector) ? "ss-neg" : "",
      cols: [C.sym, C.act, C.num("prev", "PRE C"), C.pct, C.rf, sgnTF] }));
    const alive = refresh && tb.every(t => document.getElementById(t.id));
    paint(v, tb, () => `<div class="row" style="margin-bottom:12px"><span class="live-b">LIVE</span> <span class="info" data-tip="${esc(TIP.ss)}">💡</span></div>
      <div class="card ss-hm"><button class="ghost ss-restore" title="Reset zoom (Esc)" style="display:none">⟲ All sectors</button><div class="tm" id="sectm"></div></div>
      <div class="card" style="margin-top:16px"><h3>Daily sector score <span class="pill act">ACTIVE</span></h3><div id="ssbars"></div></div>
      <div class="grid g2" style="margin-top:16px">${tb.map(t => t.html).join("")}</div>`, refresh, t => (secs.find(s => ssId(s.sector) === t.id) || {}).stocks || []);
    if (alive) tb.forEach(t => {
      const el = document.getElementById(t.id), s = secs.find(x => ssId(x.sector) === t.id); if (!el || !s) return;
      el.classList.toggle("ss-pos", pos.includes(s.sector)); el.classList.toggle("ss-neg", neg.includes(s.sector));
      const sub = el.querySelector("[data-sub]"); if (sub) sub.innerHTML = breadth(s);
    });
    me.draw(secs);
    const srt = secs.slice().sort((a, b) => b.score - a.score || a.sector.localeCompare(b.sector)).slice(0, 20);
    const mx = Math.max(0.01, ...srt.map(s => Math.abs(s.score))), H = 220, mid = 110, n = srt.length;
    $("#ssbars").innerHTML = `<div class="ssbars" style="grid-template-columns:repeat(${n},minmax(0,1fr))">${srt.map(s => {
      const h = Math.max(2, Math.abs(s.score) / mx * (mid - 22));
      return `<div class="ssbar" data-sec="${esc(s.sector)}" title="${esc(s.sector)}: ${s.score.toFixed(2)}">
        <div class="ssbar-plot" style="height:${H}px"><div class="ssbar-b ${s.score >= 0 ? "up" : "dn"}" style="${s.score >= 0 ? `bottom:${mid}px` : `top:${H - mid}px`};height:${h}px"></div>
        <span class="ssbar-v" style="${s.score >= 0 ? `bottom:${mid + h + 3}px` : `top:${H - mid + h + 3}px`}">${s.score.toFixed(2)}</span></div>
        <div class="ssbar-x">${esc(s.sector)}</div></div>`; }).join("")}</div>`;
    document.querySelectorAll(".ssbar").forEach(b => b.onclick = () => document.getElementById(ssId(b.dataset.sec))?.scrollIntoView({ behavior: "smooth", block: "start" }));
  },
  draw(secs) {
    const me = this, el = $("#sectm"); if (!el) return;
    me._secs = secs;
    const show = me.zoom ? secs.filter(s => s.sector === me.zoom) : secs;
    const W = el.clientWidth || 900, H = Math.max(420, Math.round(window.innerHeight * 0.75));
    el.style.height = H + "px"; el.style.position = "relative";
    const rb = el.parentElement.querySelector(".ss-restore"); rb.style.display = me.zoom ? "" : "none";
    rb.onclick = () => { me.zoom = null; me.draw(me._secs); };
    const blocks = squarify(show.map(s => ({ w: Math.max(Math.abs(s.score), 0.005), s })), 0, 0, W, H);
    el.innerHTML = blocks.map(b => {
      const st = b.s.stocks.slice(0, 50), ps = st.map(r => r.pchg), top = 22;
      const inner = squarify(st.map(r => ({ w: Math.max(Math.abs(r.pchg), 0.005), r })), 1, top, b.w - 2, b.h - top - 1);
      return `<div class="ssg" data-g="${esc(b.s.sector)}" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px">
        <div class="ssg-h" title="${esc(b.s.sector)} · score ${ssPct(b.s.score)} — click to zoom">${b.w > 30 ? esc(b.s.sector) : ""}</div>
        ${inner.map(t => `<div class="t clk" data-sym="${esc(t.r.sym)}" style="left:${t.x}px;top:${t.y}px;width:${t.w}px;height:${t.h}px;background:${ssColor(t.r.pchg, ps)}" data-tip="<b>${esc(t.r.sym)}</b><br>% chg: ${ssPct(t.r.pchg)}">${ssLabel(t)}</div>`).join("")}</div>`;
    }).join("");
    el.querySelectorAll(".ssg-h").forEach(h => h.onclick = () => { me.zoom = me.zoom ? null : h.parentElement.dataset.g; me.draw(me._secs); });
    if (!me._esc) { me._esc = 1; document.addEventListener("keydown", e => { if (e.key === "Escape" && me.zoom && $("#sectm")) { me.zoom = null; me.draw(me._secs); } }); }
  },
};
PAGES.swingSpectrum = {
  every: 60000, st: { scan: "highest_delivery", segment: "fno" },
  async render(v, refresh) {
    const st = this.st, d = await api(`swing?scan=${st.scan}&segment=${st.segment}`);
    const sp = { sectors: d.sectors || [] };
    const sw = (id, title, info, rows, withSgn = true) => tableCard(id, { title, info, rows: rows || [], sort: ["date", -1], filters: { dir: withSgn ? 1 : 0, sector: 1 }, ...sp,
      cols: [C.sym, C.act, C.pct, C.txt("date", "DATE"), ...(withSgn ? [C.sgn] : [])], empty: "Loading daily history…" });
    const spike = st.scan === "delivery_spike";
    const tb = [
      sw("b10", "10 Day BO", TIP.b10, d.bo10), sw("b50", "50 Day BO", TIP.b50, d.bo50),
      sw("rr", "Reversal Radar", TIP.rr, d.reversal), sw("cb", "Channel BO", TIP.ch, d.channel),
      sw("nr7", "NR7", TIP.nr7, d.nr7, false),
      tableCard("dl", { title: "Delivery Scanner", info: TIP.dl, rows: d.delivery || [], sort: [spike ? "increase_pct" : "delivery_pct", -1], live: false,
        cols: [C.sym, C.act, C.num("volume", "VOLUME", 0), C.num("avg_delivery_pct", "AVG. DEL %"), C.num("delivery_pct", "DELIVERY %"), ...(spike ? [C.num("increase_pct", "INCREASE %")] : []), C.txt("date", "DATE")], empty: "Bhavcopy not available yet" }),
    ];
    const ww = d.weekly || [];
    if (refresh && tb.every(t => document.getElementById(t.id))) { tb.forEach(t => updateTable(t, t.o.rows)); return; }
    v.innerHTML = `<div class="card row" style="margin-bottom:14px"><b>Delivery Scanner</b>
        <label class="mut">Scan type <select id="dl_s"><option value="highest_delivery">Highest Delivery</option><option value="delivery_spike">Delivery Spike</option></select></label>
        <label class="mut">Segment <select id="dl_g"><option value="fno">F&amp;O</option><option value="n500">Nifty500</option></select></label></div>
      <div class="grid g2">${tb.map(t => t.html).join("")}</div>
      <div class="card" style="margin-top:16px"><h2>WEEKLY WATCH <span class="info" data-tip="${esc(TIP.ww)}">💡</span></h2>
        ${ww.length ? `<div class="tm" id="wwtm"></div>` : `<div class="empty">No weekly data yet</div>`}</div>`;
    $("#dl_s").value = st.scan; $("#dl_g").value = st.segment;
    $("#dl_s").onchange = e => { st.scan = e.target.value; delete TSTATE.dl; this.render(v); };
    $("#dl_g").onchange = e => { st.segment = e.target.value; this.render(v); };
    tb.forEach(mountTable);
    if (ww.length) treemap($("#wwtm"), ww.map(x => ({ w: 1, label: x.name, sub: `${f2(x.weekly)}%`, color: heat(x.weekly, 3), tip: `<b>${x.name}</b> weekly ${f2(x.weekly)}%` })), 220);
  },
};
const IDX = ["NIFTY50", "BANKNIFTY", "FINNIFTY", "MIDCAP", "SENSEX"];
PAGES.optionClock = {
  every: 30000, st: { index: "NIFTY50", expiry: "", from: "09:15", to: "15:30" },
  async render(v) {
    const st = this.st;
    const d = await api(`option_clock?index=${st.index}&expiry=${st.expiry}&from=${st.from}&to=${st.to}`);
    if (d.error) { v.innerHTML = `<div class="card empty">${esc(d.error)}</div>`; return; }
    st.expiry = d.expiry;
    const times = ["09:15", ...d.times.filter(t => t > "09:15" && t < "15:30"), "15:30"];
    const mx = Math.max(1, ...d.rows.flatMap(r => [Math.abs(r.bulls), Math.abs(r.bears)]));
    const dte = Math.round((new Date(d.expiry) - new Date(new Date().toDateString())) / 864e5);
    const bar = (val, col) => `<div style="display:flex;align-items:center;gap:6px;height:11px"><i style="display:block;height:10px;border-radius:0 4px 4px 0;background:${col};width:${Math.abs(val) / mx * 88}%;opacity:${val < 0 ? .45 : 1}"></i><small class="mut" style="font-size:10px">${Math.abs(val) >= 1000 ? (val / 1000).toFixed(0) + "k" : Math.round(val)}</small></div>`;
    v.innerHTML = `<div class="card row" style="margin-bottom:14px">
        <label class="mut">INDEX <select id="oi_i">${IDX.map(i => `<option ${i === st.index ? "selected" : ""}>${i}</option>`).join("")}</select></label>
        <label class="mut">EXP <select id="oi_e">${d.expiries.map(e => `<option ${e === d.expiry ? "selected" : ""}>${e}</option>`).join("")}</select></label>
        <span class="pill">${dte}d</span>
        <label class="mut">FROM <select id="oi_f">${times.map(t => `<option ${t === st.from ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label class="mut">TO <select id="oi_t">${times.map(t => `<option ${t === st.to ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <button class="btn" id="oi_go">Go</button><span class="note">Intraday windows use snapshots this server took (every ${60}s while running). 09:15 = previous close OI.</span></div>
      <div class="grid" style="grid-template-columns:2fr 1fr">
        <div class="card"><div class="chead"><h2>OI Clock <span class="pill">ATM ${inr(d.atm, 0)}</span></h2><div class="right"><span class="dn">■ Bears (call OI Δ)</span><span class="up">■ Bulls (put OI Δ)</span></div></div>
          <div>${d.rows.map(r => `<div style="display:grid;grid-template-columns:60px 1fr;gap:8px;align-items:center;padding:3px 0;${r.strike === d.atm ? "border-top:1px dashed #8fa4bc;border-bottom:1px dashed #8fa4bc" : ""}">
            <span class="num mut" style="font-size:11px">${r.strike}</span><div>${bar(r.bears, "#e5787c")}${bar(r.bulls, "#6fce8f")}</div></div>`).join("")}</div>
          <div class="note" style="margin-top:6px">Values in lots. Faded bars = OI reduction.</div></div>
        <div class="card"><h3>Net Position <span class="mut">Δ OI (lots)</span></h3>
          <div style="display:flex;gap:30px;align-items:flex-end;height:200px;padding:10px 30px;border-bottom:1px solid var(--line)">
            ${[["Bulls Chg", d.bulls_chg, "#6fce8f"], ["Bears Chg", d.bears_chg, "#e5787c"]].map(([l, x, c]) => {
              const m = Math.max(Math.abs(d.bulls_chg), Math.abs(d.bears_chg), 1);
              return `<div style="flex:1;text-align:center"><div class="num" style="font-size:12px">${inr(x, 0)}</div><div style="height:${Math.abs(x) / m * 160}px;background:${c};border-radius:6px 6px 0 0;opacity:${x < 0 ? .45 : 1}"></div><small class="mut">${l}</small></div>`; }).join("")}
          </div>
          <h3 style="margin-top:16px">Distribution <span class="mut">TOTAL OI</span></h3>
          <div style="text-align:center">${donutSVG(d.bulls_total, d.bears_total, "#6fce8f", "#e5787c", d.pcr ?? "—")}</div>
          <div class="grid g2"><div class="stat"><small class="up">BULLS · ${f2(d.bulls_total / (d.bulls_total + d.bears_total) * 100)}%</small><div>${inr(d.bulls_total, 0)}</div></div>
            <div class="stat"><small class="dn">BEARS · ${f2(d.bears_total / (d.bulls_total + d.bears_total) * 100)}%</small><div>${inr(d.bears_total, 0)}</div></div></div></div></div>`;
    $("#oi_i").onchange = e => { st.index = e.target.value; st.expiry = ""; this.render(v); };
    $("#oi_e").onchange = e => { st.expiry = e.target.value; this.render(v); };
    $("#oi_go").onclick = () => { st.from = $("#oi_f").value; st.to = $("#oi_t").value; this.render(v); };
  },
};
PAGES.optionApex = {
  every: 30000, st: { index: "NIFTY50", tf: 3 }, chart: null,
  async render(v, refresh) {
    const st = this.st, d = await api(`option_apex?index=${st.index}&tf=${st.tf}`);
    if (!refresh || !$("#apx")) {
      v.innerHTML = `<div class="grid" style="grid-template-columns:2fr 1fr">
        <div class="card"><div class="chead"><h2>${st.index} <span class="info" data-tip="Candle-by-candle option flow: per candle, change in (put OI − call OI) near ATM from this server's option-chain snapshots.">💡</span></h2>
          <div class="right"><label class="mut">INDEX <select id="ax_i">${IDX.map(i => `<option ${i === st.index ? "selected" : ""}>${i}</option>`).join("")}</select></label>
          <label class="mut">TIME <select id="ax_t">${[1, 3, 5, 15].map(t => `<option value="${t}" ${t == st.tf ? "selected" : ""}>${t}m</option>`).join("")}</select></label></div></div>
          <div id="apx" style="height:520px"></div></div>
        <div class="card"><div class="grid g2" id="dials"></div><h3 style="margin-top:10px">Money Flux <span class="info" data-tip="Stocks witnessing a significant surge in activity today — tile size = R.FAC, colour = % change.">💡</span></h3><div class="tm" id="mflux"></div></div></div>`;
      $("#ax_i").onchange = e => { st.index = e.target.value; this.render(v); };
      $("#ax_t").onchange = e => { st.tf = +e.target.value; this.render(v); };
      const el = $("#apx");
      if (window.LightweightCharts) {
        const ch = LightweightCharts.createChart(el, { layout: { background: { color: "transparent" }, textColor: "#8fa4bc", fontFamily: "Geist" },
          grid: { vertLines: { color: "rgba(120,150,185,.07)" }, horzLines: { color: "rgba(120,150,185,.07)" } },
          timeScale: { timeVisible: true, secondsVisible: false, borderColor: "rgba(120,150,185,.2)" }, rightPriceScale: { borderColor: "rgba(120,150,185,.2)" }, autoSize: true });
        this.cs = ch.addCandlestickSeries({ upColor: "#3ecf8e", downColor: "#f07178", borderVisible: false, wickUpColor: "#3ecf8e", wickDownColor: "#f07178" });
        this.hs = ch.addHistogramSeries({ priceScaleId: "flux", priceFormat: { type: "volume" } });
        ch.priceScale("flux").applyOptions({ scaleMargins: { top: .75, bottom: 0 } });
        this.cs.priceScale().applyOptions({ scaleMargins: { top: .05, bottom: .3 } });
        this.chart = ch;
      } else el.innerHTML = `<div class="empty">Chart library failed to load (offline?)</div>`;
    }
    if (this.cs) {
      this.cs.setData(d.candles);
      this.hs.setData(d.flux.map(f => ({ ...f, color: f.value >= 0 ? "rgba(62,207,142,.55)" : "rgba(240,113,120,.55)" })));
      if (!refresh) this.chart.timeScale().fitContent();
    }
    $("#dials").innerHTML = `<div style="text-align:center">${gaugeSVG(d.sentiment.x, d.sentiment.label)}<b>Sentimental Dial</b></div>
      <div style="text-align:center">${gaugeSVG(d.pcr.x, d.pcr.label)}<b>PCR Dial</b> <span class="mut">${d.pcr.start ?? "—"} → ${d.pcr.value ?? "—"}</span></div>
      <div class="note" style="grid-column:1/-1">Flow bars: ${esc(d.flux_source)} (OI refreshes every 3 minutes).</div>`;
    const mf = $("#mflux");
    if (d.money_flux.length) treemap(mf, d.money_flux.map(t => ({ w: Math.max(t.rf, 0.05), sym: t.sym, label: t.sym, sub: f2(t.pchg) + "%", color: heat(t.pchg), tip: `<b>${t.sym}</b> ${f2(t.pchg)}% · R.FAC ${f2(t.rf)}` })), 330);
    else mf.innerHTML = `<div class="empty">No constituent list for ${st.index}</div>`;
  },
};
PAGES.indexMover = {
  every: 10000, st: { index: "NIFTY50" },
  async render(v) {
    const st = this.st, d = await api(`index_mover?index=${st.index}`);
    if (d.error) { v.innerHTML = `<div class="card empty">${esc(d.error)}</div>`; return; }
    const segs = [...d.drivers.map(x => ({ l: x.sym, v: x.pts })), { l: "OTHERS", v: d.others }];
    const tot = segs.reduce((s, x) => s + Math.abs(x.v), 0) || 1;
    let a0 = -Math.PI / 2; const R = 120, r0 = 78, cx = 220, cy = 190;
    const arcs = segs.map(sg => {
      const a1 = a0 + Math.abs(sg.v) / tot * 2 * Math.PI, large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a, r) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
      const mid = (a0 + a1) / 2, lx = cx + (R + 34) * Math.cos(mid), ly = cy + (R + 34) * Math.sin(mid);
      const path = `<path d="M${p(a0, R)} A${R} ${R} 0 ${large} 1 ${p(a1, R)} L${p(a1, r0)} A${r0} ${r0} 0 ${large} 0 ${p(a0, r0)}Z" fill="${sg.v >= 0 ? "#5cc58a" : "#de6f73"}" stroke="#0d1728" stroke-width="2"><title>${sg.l}: ${f2(sg.v)}</title></path>
        <text x="${lx}" y="${ly}" fill="#e8eef7" font-size="11" font-weight="600" text-anchor="${Math.cos(mid) >= 0 ? "start" : "end"}">${sg.l}: <tspan fill="${sg.v >= 0 ? "#3ecf8e" : "#f07178"}">${f2(sg.v)}</tspan></text>`;
      a0 = a1; return path;
    }).join("");
    const mxp = Math.max(...d.drivers.map(x => Math.abs(x.pts)), 1);
    v.innerHTML = `<div class="grid" style="grid-template-columns:1fr 2fr;margin-bottom:16px">
        <div class="card"><div class="row"><div><h2 style="font-size:24px">${d.index}</h2><span class="num mut">${inr(d.ltp)}</span></div>
          <div style="margin-left:auto;text-align:right" class="${cls(d.chg)}"><b>${d.chg >= 0 ? "UP" : "DOWN"} ${f2(Math.abs(d.chg))} PTS</b><br>${f2(d.pchg)}%</div></div></div>
        <div class="card"><h3>Gainers / Losers</h3><div class="bar" style="display:flex"><i style="background:var(--up);width:${d.gainers / (d.gainers + d.losers || 1) * 100}%"></i><i style="background:var(--dn);flex:1"></i></div>
          <div class="row" style="justify-content:space-between;margin-top:8px"><span class="up">● Gainers : ${d.gainers}</span><span class="dn">Losers : ${d.losers} ●</span></div></div></div>
      <div class="grid" style="grid-template-columns:1.1fr 1fr">
        <div class="card"><div class="tabs">${IDX.map(i => `<button class="ghost ${i === st.index ? "on" : ""}" data-i="${i}">${i}</button>`).join("")}</div>
          <svg viewBox="0 0 440 380" width="100%">${arcs}<text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="#fff" font-size="17" font-weight="700">${d.index}</text>
          <text x="${cx}" y="${cy + 20}" text-anchor="middle" fill="${d.chg >= 0 ? "#3ecf8e" : "#f07178"}" font-size="16" font-weight="700">${f2(d.chg)} pts</text></svg>
          ${d.weights_ready ? "" : `<div class="note warn">Estimating index weights from recent 5-min data… (first run of the day)</div>`}</div>
        <div class="card"><h3>Drivers <span class="${cls(d.chg)}">${f2(d.chg)} pts</span></h3><div class="note">Ranked by contribution · bar width is point share · weight estimated by regression on 10 sessions of 5-min returns</div>
          ${d.drivers.map((x, i) => `<div class="drv"><span class="mut num">${String(i + 1).padStart(2, "0")}</span><div><b>${x.sym}</b><br><small>${x.chg >= 0 ? "+" : ""}${f2(x.chg)} · ${x.pchg >= 0 ? "+" : ""}${f2(x.pchg)}%</small></div>
            <span class="num mut">${f2(x.weight)}%</span><div class="bar"><i style="width:${Math.abs(x.pts) / mxp * 100}%;background:${x.pts >= 0 ? "var(--up)" : "var(--dn)"}"></i></div><b class="num r ${cls(x.pts)}">${x.pts >= 0 ? "+" : ""}${f2(x.pts)}</b></div>`).join("")}
          <div class="drv"><span class="mut">Σ</span><div><b>OTHERS</b><br><small>remaining basket</small></div><span></span><span></span><b class="num ${cls(d.others)}">${f2(d.others)}</b></div></div></div>`;
    v.querySelectorAll("[data-i]").forEach(b => b.onclick = () => { st.index = b.dataset.i; this.render(v); });
  },
};
PAGES.fiiDii = {
  every: 300000,
  async render(v) {
    const d = await api("fiidii"), rows = d.rows || [];
    if (!rows.length) { v.innerHTML = `<div class="card empty">No FII/DII data yet — NSE publishes after ~6pm.</div>`; return; }
    const L = rows[rows.length - 1], lab = rows.map(r => r.date);
    const tb = tableCard("fd", { title: "Capital Market Activity (in Cr.)", rows: rows.map(r => ({ ...r, sym: r.date })).reverse(), sort: ["date", -1], live: false, search: false, tall: 1,
      cols: [{ k: "date", label: "DATE", fmt: r => r.date }, C.num("fii_buy", "FII BUY"), C.num("fii_sell", "FII SELL"),
        { k: "fii_net", label: "FII NET", r: 1, fmt: r => `<b class="num ${cls(r.fii_net)}">${inr(r.fii_net)}</b>` },
        { k: "in_market", label: "IN MARKET", r: 1, fmt: r => `<b class="num ${cls(r.in_market)}">${inr(r.in_market)}</b>` },
        { k: "dii_net", label: "DII NET", r: 1, fmt: r => `<b class="num ${cls(r.dii_net)}">${inr(r.dii_net)}</b>` },
        C.num("dii_buy", "DII BUY"), C.num("dii_sell", "DII SELL")] });
    v.innerHTML = `<div class="card grid g4" style="margin-bottom:16px">
        <div><small class="mut">LATEST SESSION</small><h3>${L.date}</h3></div>
        <div><small class="mut">FII NET</small><h3 class="${cls(L.fii_net)}">${inr(L.fii_net)}</h3></div>
        <div><small class="mut">DII NET</small><h3 class="${cls(L.dii_net)}">${inr(L.dii_net)}</h3></div>
        <div><small class="mut">IN MARKET</small><h3 class="${cls(L.in_market)}">${inr(L.in_market)}</h3></div></div>
      <div class="card" style="margin-bottom:16px"><h2>FII / DII <span class="pill act">ACTIVE</span></h2>
        <h3 class="mut" style="margin-top:14px">FII Net</h3>${barsSVG(rows.map(r => r.fii_net), lab)}
        <h3 class="mut">DII Net</h3>${barsSVG(rows.map(r => r.dii_net), lab)}
        <h3 class="mut">FII + DII</h3>${barsSVG(rows.map(r => r.in_market), lab)}
        <div class="note">History accumulates locally in cache/fiidii.csv — NSE's API only serves the latest session, so the chart grows by one bar per day this server runs.</div></div>
      ${tb.html}`;
    mountTable(tb);
  },
};
PAGES.watchlist = {
  every: 10000,
  async render(v, refresh) {
    const w = wl();
    const d = w.length ? await api("quotes?syms=" + encodeURIComponent(w.join(","))) : [];
    const tb = tableCard("wl", { title: "Watchlist", rows: d, sort: ["pchg", -1], search: false,
      cols: [C.sym, C.act, C.num("ltp", "LTP"), C.num("prev", "PREV"), C.num("high", "HIGH"), C.num("low", "LOW"), C.pct, C.rf, C.sgn], empty: "Star ☆ any stock in a scanner, or add one above" });
    if (paint(v, [tb], () => `<div class="card row" style="margin-bottom:14px"><input id="wq" placeholder="Add symbol (e.g. RELIANCE)" style="width:260px"><div id="wres" class="row"></div></div>${tb.html}`, refresh)) return;
    $("#wq").oninput = async e => {
      const q = e.target.value; if (q.length < 2) { $("#wres").innerHTML = ""; return; }
      const r = await api("search?q=" + encodeURIComponent(q));
      $("#wres").innerHTML = r.map(x => `<button class="ghost" data-s="${x.sym}">${x.sym}${x.fno ? "" : " ·cash"}</button>`).join("");
      $("#wres").querySelectorAll("button").forEach(b => b.onclick = () => { if (!wl().includes(b.dataset.s)) toggleWatch(b.dataset.s); this.render(v); });
    };
  },
};
PAGES.tradingJournal = {
  render(v) {
    const J = store.get("journal", []);
    const pnl = t => (t.side === "BUY" ? 1 : -1) * (t.exit - t.entry) * t.qty - (+t.cost || 0);
    const tot = J.reduce((s, t) => s + pnl(t), 0), wins = J.filter(t => pnl(t) > 0).length;
    v.innerHTML = `<div class="grid g4" style="margin-bottom:16px">
        <div class="stat"><small>TRADES</small><div>${J.length}</div></div><div class="stat"><small>NET P&L</small><div class="${cls(tot)}">₹${inr(tot, 0)}</div></div>
        <div class="stat"><small>WIN RATE</small><div>${J.length ? f2(wins / J.length * 100) : "—"}%</div></div>
        <div class="stat"><small>AVG / TRADE</small><div class="${cls(tot)}">₹${J.length ? inr(tot / J.length, 0) : "—"}</div></div></div>
      <div class="card" style="margin-bottom:16px"><h3>Add trade</h3><div class="row" id="jf">
        <input type="date" name="date" value="${new Date().toISOString().slice(0, 10)}"><input name="sym" placeholder="Symbol" style="width:120px">
        <select name="side"><option>BUY</option><option>SELL</option></select><input name="qty" type="number" placeholder="Qty" style="width:80px">
        <input name="entry" type="number" step="0.05" placeholder="Entry" style="width:90px"><input name="exit" type="number" step="0.05" placeholder="Exit" style="width:90px">
        <input name="cost" type="number" placeholder="Charges" style="width:90px"><input name="note" placeholder="Setup / notes" style="width:220px"><button class="btn" id="jadd">Add</button></div></div>
      <div class="card"><div class="tw tall"><table><thead><tr><th>DATE</th><th>SYMBOL</th><th>SIDE</th><th class="r">QTY</th><th class="r">ENTRY</th><th class="r">EXIT</th><th class="r">P&L</th><th>NOTES</th><th></th></tr></thead>
        <tbody>${J.map((t, i) => `<tr><td>${t.date}</td><td><b>${esc(t.sym)}</b></td><td class="${t.side === "BUY" ? "up" : "dn"}">${t.side}</td><td class="r num">${t.qty}</td><td class="r num">${t.entry}</td><td class="r num">${t.exit}</td>
          <td class="r num ${cls(pnl(t))}">${inr(pnl(t), 0)}</td><td class="mut">${esc(t.note)}</td><td><button class="ghost" data-del="${i}">✕</button></td></tr>`).join("") || `<tr><td colspan="9" class="empty">No trades logged</td></tr>`}</tbody></table></div>
        <div class="note">Stored in this browser only.</div></div>`;
    $("#jadd").onclick = () => {
      const f = Object.fromEntries([...v.querySelectorAll("#jf [name]")].map(i => [i.name, i.value]));
      if (!f.sym || !f.qty || !f.entry || !f.exit) return;
      J.unshift({ ...f, sym: f.sym.toUpperCase(), qty: +f.qty, entry: +f.entry, exit: +f.exit }); store.set("journal", J); this.render(v);
    };
    v.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { J.splice(+b.dataset.del, 1); store.set("journal", J); this.render(v); });
  },
};
PAGES.calculator = {
  render(v) {
    v.innerHTML = `<div class="grid g2">
      <div class="card"><h2>Position size</h2><div class="note">Risk-based sizing from a stop-loss.</div>
        <div class="grid g2" style="margin-top:12px" id="ps">
          <label>Capital ₹<input name="cap" type="number" value="100000"></label><label>Risk %<input name="risk" type="number" value="1" step="0.1"></label>
          <label>Entry<input name="entry" type="number" value="1000"></label><label>Stop<input name="stop" type="number" value="985"></label>
          <label>Lot size (0 = cash)<input name="lot" type="number" value="0"></label><label>Target R<input name="rr" type="number" value="2" step="0.5"></label></div>
        <div id="pso" style="margin-top:14px"></div></div>
      <div class="card"><h2>F&O / intraday charges</h2><div class="note">Approximate statutory charges (STT, exchange, SEBI, stamp, GST) + ₹20/order brokerage.</div>
        <div class="grid g2" style="margin-top:12px" id="bc">
          <label>Segment<select name="seg"><option value="opt">Options</option><option value="fut">Futures</option><option value="int">Equity intraday</option></select></label>
          <label>Quantity<input name="qty" type="number" value="500"></label><label>Buy price<input name="buy" type="number" value="40"></label><label>Sell price<input name="sell" type="number" value="48"></label></div>
        <div id="bco" style="margin-top:14px"></div></div></div>`;
    const val = (id) => Object.fromEntries([...v.querySelectorAll(`#${id} [name]`)].map(i => [i.name, i.name === "seg" ? i.value : +i.value]));
    const ps = () => {
      const p = val("ps"), rps = Math.abs(p.entry - p.stop), budget = p.cap * p.risk / 100;
      let qty = rps ? Math.floor(budget / rps) : 0; if (p.lot > 0) qty = Math.floor(qty / p.lot) * p.lot;
      const tgt = p.entry + (p.entry > p.stop ? 1 : -1) * rps * p.rr;
      $("#pso").innerHTML = [["Risk budget", "₹" + inr(budget, 0)], ["Risk / share", inr(rps)], ["Quantity", qty + (p.lot > 0 ? ` (${qty / p.lot} lots)` : "")],
        ["Exposure", "₹" + inr(qty * p.entry, 0)], ["Target", inr(tgt)], ["Reward at target", "₹" + inr(qty * rps * p.rr, 0)]].map(([k, x]) => `<div class="kv"><span class="mut">${k}</span><b class="num">${x}</b></div>`).join("");
    };
    const bc = () => {
      const p = val("bc"), bt = p.buy * p.qty, stv = p.sell * p.qty, to = bt + stv;
      const R = { opt: { stt: stv * 0.001, ex: to * 0.0003503, stamp: bt * 0.00003 }, fut: { stt: stv * 0.0002, ex: to * 0.0000173, stamp: bt * 0.00002 },
                  int: { stt: stv * 0.00025, ex: to * 0.0000297, stamp: bt * 0.00003 } }[p.seg];
      const brk = Math.min(40, p.seg === "int" ? to * 0.0003 : 40), sebi = to * 0.000001, gst = (brk + R.ex + sebi) * 0.18;
      const tot = brk + R.stt + R.ex + sebi + R.stamp + gst, gross = stv - bt;
      $("#bco").innerHTML = [["Turnover", inr(to, 0)], ["Brokerage", inr(brk)], ["STT", inr(R.stt)], ["Exchange txn", inr(R.ex)], ["SEBI", inr(sebi)], ["Stamp duty", inr(R.stamp)], ["GST", inr(gst)],
        ["Total charges", inr(tot)], ["Gross P&L", inr(gross)], ["Net P&L", `<span class="${cls(gross - tot)}">${inr(gross - tot)}</span>`], ["Points to breakeven", inr(tot / (p.qty || 1))]]
        .map(([k, x]) => `<div class="kv"><span class="mut">${k}</span><b class="num">${x}</b></div>`).join("");
    };
    v.querySelectorAll("#ps input").forEach(i => i.oninput = ps); v.querySelectorAll("#bc [name]").forEach(i => i.oninput = bc); ps(); bc();
  },
};
PAGES.status = {
  every: 5000,
  async render(v) {
    const s = await api("status");
    v.innerHTML = `<div class="card"><h2>Engine status</h2>${Object.entries(s).filter(([k]) => k !== "errors" && k !== "nifty")
      .map(([k, x]) => `<div class="kv"><span class="mut">${k}</span><b class="num">${esc(JSON.stringify(x))}</b></div>`).join("")}
      <h3 style="margin-top:16px">Recent errors</h3><pre class="note" style="white-space:pre-wrap">${esc((s.errors || []).join("\n")) || "none"}</pre></div>`;
  },
};
async function route() {
  const r = (location.hash.replace(/^#\/?/, "") || "home").split("?")[0];
  const page = PAGES[r] || PAGES.home, gen = ++ROUTE_GEN;
  document.body.classList.remove("nav-open");
  const [crumb, t] = titleOf(r); $("#crumb").textContent = crumb; $("#title").textContent = t;
  drawNav(r); clearInterval(timer);
  const v = $("#view");
  if (curRoute !== r) { v.innerHTML = `<div class="empty">Loading…</div>`; curRoute = r; }
  const go = async (refresh) => { if (gen !== ROUTE_GEN) return; try { await page.render(v, refresh); } catch (e) { if (e === STALE || gen !== ROUTE_GEN) return; console.error(e); if (!refresh) v.innerHTML = `<div class="card empty">Could not load: ${esc(e.message)}. Is the server running?</div>`; } };
  let last = Date.now(), busy = false;
  const tick = async () => {
    const ae = document.activeElement;
    if (busy || document.hidden || (ae?.matches("input,select") && !ae.closest("[data-live]"))) return;
    busy = true; last = Date.now();
    try { await go(true); } finally { busy = false; }
  };
  REFRESH = () => { if (curRoute === r && page.every && Date.now() - last >= 15000) tick(); };
  await go(false); last = Date.now();
  if (page.every) timer = setInterval(tick, page.every);
}
let REFRESH = () => {};
for (const [tgt, ev] of [[document, "visibilitychange"], [window, "focus"], [window, "pageshow"], [window, "online"]])
  tgt.addEventListener(ev, () => { if (document.visibilityState === "visible") REFRESH(); });
addEventListener("hashchange", route);
async function header() {
  try {
    const d = await api("home");
    $("#ticker").innerHTML = d.indices.slice(0, 4).map(i => `<span><b>${i.name}</b><span class="num">${inr(i.ltp)}</span> <span class="${cls(i.chg)}">${f2(i.pchg)}%</span></span>`).join("");
    $("#mktdot").className = "dot" + (d.status.market_open ? " live" : "");
    $("#mktlabel").textContent = d.status.market_open ? "Live" : "Closed";
  } catch {}
}
setInterval(() => { $("#clock").textContent = new Date().toLocaleTimeString("en-IN", { hour12: false }); }, 1000);
(() => { const sel = $("#chartprov"); if (!sel) return;
  sel.innerHTML = Object.entries(CHART_PROVIDERS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
  sel.value = chartProvider(); sel.onchange = () => { store.set("chart_provider", sel.value); route(); }; })();
setInterval(header, 15000); header(); route();
