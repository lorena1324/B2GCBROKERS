/* =========================================================
   B²GC BROKERS — SUBASTAS.JS
   Libro de ofertas, tiempos de subasta, tarifa del vendedor,
   favoritos, mercado ordenado, línea de proceso del comprador
   y gráficas SVG del dashboard.

   ⚠ DEMO: el libro de ofertas vive en el navegador. En
   producción debe venir de la API/BD.
   ========================================================= */

const HOUR = 36e5;
const PHASES = ["Exploración", "Data room", "Oferta", "Subasta", "Adjudicación", "Cierre"];

// Tarifa mínima (% del nominal) que fija el vendedor para cada lote — DEMO
const lotReserve = { "LOTE-TEST-001": 80, "LOTE-TEST-002": 83, "LOTE-TEST-003": 72, "LOTE-TEST-004": 86, "LOTE-TEST-005": 78 };

// Ofertas de otros compradores — DEMO. [comprador, %, horas atrás]
const seedBids = {
  "LOTE-TEST-001": [["Cobranzas Demo Andina", 76.5, 70], ["Recaudos Demo Capital", 79.2, 52], ["Gestión de Cobro Norte Demo", 80.4, 30], ["Cobranzas Demo Andina", 81.1, 18], ["Recuperadora Demo Pacífico", 79.8, 9], ["Recaudos Demo Capital", 82, 4]],
  "LOTE-TEST-002": [["Cobranzas Demo Andina", 84, 40], ["Gestión de Cobro Norte Demo", 82.5, 26], ["Recuperadora Demo Pacífico", 85, 12], ["Recaudos Demo Capital", 83.2, 5]],
  "LOTE-TEST-003": [["Recaudos Demo Capital", 70.5, 33], ["Cobranzas Demo Andina", 74, 20], ["Gestión de Cobro Norte Demo", 71.8, 6]],
  "LOTE-TEST-004": [["Recuperadora Demo Pacífico", 87.1, 15], ["Cobranzas Demo Andina", 88, 7]]
};

const demoBids = Object.entries(seedBids).flatMap(([lotId, rows]) =>
  rows.map(([buyer, percent, hoursAgo], i) => ({
    id: `PUJA-${lotId.slice(-3)}-${i + 1}`, lotId, buyer, percent, at: Date.now() - hoursAgo * HOUR, demo: true
  })));

// Procesos del comprador que no salen de sus ofertas — DEMO
const processDemo = {
  "LOTE-HIST-018": { phase: 6, title: "Cartera de consumo — Histórico" },
  "LOTE-TEST-003": { phase: 2 },
  "LOTE-TEST-005": { phase: 1 }
};

/* ===== Consultas ===== */
const lotById = id => lots.find(l => l.id === id);
const reserveOf = lotId => lotReserve[lotId] ?? 80;

function auctionState(lotId) {
  if (typeof operationForLot === "function" && operationForLot(lotId)) return "cerrada"; // ya adjudicada
  const p = lotProfiles[lotId];
  if (!p) return "cerrada";
  const now = Date.now();
  if (now < p.startsAt) return "proxima";
  return now >= p.endsAt ? "cerrada" : "vivo";
}

/* Todas las ofertas del lote, de la más alta a la más baja.
   belowLast: la oferta quedó por debajo de la más alta que existía cuando se hizo. */
function bidsFor(lotId) {
  const own = (appState.offers || []).filter(o => o.lotId === lotId).map(o => ({ ...o, at: o.at || 0, own: true }));
  const chronological = [...demoBids.filter(b => b.lotId === lotId), ...own].sort((a, b) => a.at - b.at);
  let best = 0;
  const enriched = chronological.map(b => {
    const decision = appState.decisions?.[b.id] || null;
    const row = { ...b, decision, prevBest: best, belowLast: best > 0 && b.percent < best };
    if (decision !== "Rechazada") best = Math.max(best, b.percent);
    return row;
  });
  return enriched
    .sort((a, b) => b.percent - a.percent || a.at - b.at)
    .map((b, i) => ({ ...b, rank: i + 1 }));
}

const topBid = lotId => bidsFor(lotId).find(b => b.decision !== "Rechazada") || null;
const bidderCount = lotId => new Set(bidsFor(lotId).map(b => b.buyer)).size;
const popularity = lot => bidsFor(lot.id).length * 10 + profileOf(lot).favs * 2 + profileOf(lot).likes;
const topSellerId = () => [...lots].sort((a, b) => popularity(b) - popularity(a))[0]?.id;

function endKey(lot) {
  const st = auctionState(lot.id);
  return st === "cerrada" ? Infinity : profileOf(lot).endsAt;
}

function soonestId(pool = lots) {
  return pool.filter(l => auctionState(l.id) === "vivo").sort((a, b) => endKey(a) - endKey(b))[0]?.id;
}

function anonymizer(lotId) {
  const order = [];
  bidsFor(lotId).filter(b => !b.own).sort((a, b) => a.at - b.at).forEach(b => { if (!order.includes(b.buyer)) order.push(b.buyer); });
  return name => `Postor anónimo #${order.indexOf(name) + 1}`;
}

/* ===== Piezas de interfaz ===== */
function cdHtml(lotId, cls = "") {
  const op = typeof operationForLot === "function" && operationForLot(lotId);
  if (op) return `<span class="cd ${cls}">${op.status === "Cerrada" ? "Vendida" : "Adjudicada"}</span>`;
  const kind = auctionState(lotId) === "proxima" ? "inicio" : "cierre";
  return `<span class="cd ${cls}" data-cd="${lotId}|${kind}">—</span>`;
}

const cdLabel = lotId => ({ proxima: "Inicia en", vivo: "Cierra en", cerrada: "Subasta" })[auctionState(lotId)];

function favButton(lotId) {
  const on = (appState.favorites || []).includes(lotId);
  return `<button type="button" class="fav-btn ${on ? "on" : ""}" title="${on ? "Quitar de favoritas" : "Agregar a favoritas"}" aria-pressed="${on}" onclick="toggleFavorite('${lotId}', event)">${on ? "★" : "☆"}</button>`;
}

function reserveBadge(percent, reserve, verbose = false) {
  const diff = +(percent - reserve).toFixed(1);
  if (diff === 0) return `<span class="chip chip-ok">= ${verbose ? "En tarifa" : "0 pts"}</span>`;
  return diff > 0
    ? `<span class="chip chip-ok">▲ ${verbose ? "Sobre tarifa " : ""}+${diff} pts</span>`
    : `<span class="chip chip-warn">▼ ${verbose ? "Bajo tarifa " : ""}${diff} pts</span>`;
}

function fmtWhen(b) {
  if (!b.at) return escapeHtml(b.date || "—");
  const h = (Date.now() - b.at) / HOUR;
  if (h < 1) return "hace minutos";
  if (h < 24) return `hace ${Math.floor(h)} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

function ownStatusBadge(b) {
  const op = typeof operationForLot === "function" && operationForLot(b.lotId);
  if (op) return op.offerId === b.id
    ? `<span class="badge badge-green">Adjudicada</span> <button class="btn-text" onclick="openOperation('${op.id}')">Ir al cierre →</button>`
    : '<span class="badge badge-red">No adjudicada</span>';
  if (b.decision === "Aceptada") return '<span class="badge badge-green">Aceptada por el vendedor</span>';
  if (b.decision === "Rechazada") return '<span class="badge badge-red">Rechazada</span>';
  if (b.belowLast) return '<span class="badge badge-gold">Bajo la última · en revisión</span>';
  return b.rank === 1 ? '<span class="badge badge-green">Vas ganando</span>' : '<span class="badge badge-blue">Superada</span>';
}

const fmtDate = ms => new Date(ms).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/* ===== Acciones ===== */
function rerenderCurrent() {
  if (!appState.loggedIn) return;
  if (currentPage === "dashboard") renderDashboard();
  else renderPage(currentPage);
}

function toggleFavorite(lotId, event) {
  event?.stopPropagation();
  const favs = new Set(appState.favorites || []);
  const adding = !favs.has(lotId);
  adding ? favs.add(lotId) : favs.delete(lotId);
  appState.favorites = [...favs];
  saveDemoState();
  showToast(adding ? `${lotId} agregada a favoritas. Aparecerá arriba.` : `${lotId} quitada de favoritas.`);
  rerenderCurrent();
}

function decideOffer(offerId, decision) {
  if (appState.realMode) { realRejectBid(offerId, !decision); return; }
  if (!appState.decisions) appState.decisions = {};
  if (decision) appState.decisions[offerId] = decision;
  else delete appState.decisions[offerId];
  saveDemoState();
  showToast(decision ? `Oferta ${offerId} ${decision.toLowerCase()}.` : "Decisión revertida.");
  rerenderCurrent();
}

/* ===== Banner de subasta dentro del lote ===== */
function renderAuctionBanner(lot) {
  const st = auctionState(lot.id);
  const top = topBid(lot.id);
  const seller = currentRole === "vendedor";
  const title = { vivo: "SUBASTA EN VIVO", proxima: "SUBASTA PRÓXIMA", cerrada: "SUBASTA CERRADA" }[st];
  return `
    <div class="auction-banner state-${st}">
      <div class="auction-banner-state"><span class="live-dot"></span>${title}</div>
      <div class="auction-banner-timer"><small>${cdLabel(lot.id)}</small>${cdHtml(lot.id, "big")}</div>
      <div><small>Oferta más alta</small><strong>${top ? top.percent + "%" : "—"}</strong></div>
      <div><small>Postores</small><strong>${bidderCount(lot.id)}</strong></div>
      ${seller ? `<div><small>Tu tarifa</small><strong>${reserveOf(lot.id)}%</strong></div>` : ""}
    </div>`;
}

/* ===== Mercado del comprador ===== */
let marketSort = "populares";
function setMarketSort(sort) { marketSort = sort; rerenderCurrent(); }

function spotlightCards(pool) {
  const topId = topSellerId();
  const soonId = soonestId(pool);
  const card = (id, kicker, cls) => {
    const lot = lotById(id);
    if (!lot) return "";
    const top = topBid(id);
    return `
      <div class="spotlight-card ${cls}" onclick="openDetail('${id}')" role="button" tabindex="0">
        <div class="spotlight-kicker">${kicker}</div>
        <h3>${lot.title}</h3>
        <span>${lot.id} · ${lot.amount} · ${bidsFor(id).length} ofertas${top ? ` · más alta ${top.percent}%` : ""}</span>
        <div class="spotlight-timer"><small>${cdLabel(id)}</small>${cdHtml(id, "big")}</div>
      </div>`;
  };
  if (topId === soonId) return `<div class="spotlight-grid single">${card(topId, "🔥 LA MÁS VENDIDA · ⏱ Y LA QUE VENCE MÁS RÁPIDO", "urgent")}</div>`;
  return `<div class="spotlight-grid">${card(topId, "🔥 LA MÁS VENDIDA", "hot")}${card(soonId, "⏱ LA QUE VENCE MÁS RÁPIDO", "urgent")}</div>`;
}

function renderMarketPage(title, description) {
  const fav = new Set(appState.favorites || []);
  const topId = topSellerId();
  const soonId = soonestId(buyerOpportunities);
  const sorters = {
    populares: (a, b) => popularity(b) - popularity(a),
    vence: (a, b) => endKey(a) - endKey(b),
    valor: (a, b) => parseLotAmount(b) - parseLotAmount(a),
    favoritas: (a, b) => popularity(b) - popularity(a)
  };
  let items = [...buyerOpportunities];
  if (marketSort === "favoritas") items = items.filter(l => fav.has(l.id));
  items.sort((a, b) => (fav.has(b.id) - fav.has(a.id)) || sorters[marketSort](a, b));

  const chip = (key, label) => `<button class="${marketSort === key ? "active" : ""}" onclick="setMarketSort('${key}')">${label}</button>`;

  return `
    <div class="card page-card">
      <div class="section-kicker">MERCADO · COMPRADOR</div>
      <h2>${title}</h2>
      <p>${description} Tus favoritas (★) siempre aparecen arriba.</p>
      ${spotlightCards(buyerOpportunities)}
      <div class="sort-chips">${chip("populares", "Más vendidas")}${chip("vence", "Vencen primero")}${chip("valor", "Mayor valor")}${chip("favoritas", `★ Favoritas (${fav.size})`)}</div>
      ${items.length ? `<div class="test-lot-grid market-grid">${items.map(lot => {
        const top = topBid(lot.id);
        return `
          <article class="test-lot-card market-card ${fav.has(lot.id) ? "is-fav" : ""}">
            <div class="market-card-top"><div class="lot-number">${lot.id}</div>${favButton(lot.id)}</div>
            <div class="market-card-tags">
              ${lot.id === topId ? '<span class="chip chip-hot">🔥 Más vendida</span>' : ""}
              ${lot.id === soonId ? '<span class="chip chip-urgent">⏱ Vence primero</span>' : ""}
              ${fav.has(lot.id) ? '<span class="chip chip-fav">★ Favorita</span>' : ""}
            </div>
            <h3>${lot.title}</h3>
            <span>${lot.type} · ${lot.modality}</span>
            <strong>${lot.amount}</strong>
            <div class="test-lot-timer"><small>${cdLabel(lot.id)}</small>${cdHtml(lot.id)}</div>
            <div class="market-card-stats">
              <div><small>Más alta</small><b>${top ? top.percent + "%" : "—"}</b></div>
              <div><small>Postores</small><b>${bidderCount(lot.id)}</b></div>
              <div><small>Ofertas</small><b>${bidsFor(lot.id).length}</b></div>
            </div>
            <button class="btn btn-navy btn-small" onclick="openDetail('${lot.id}')">Entrar a la subasta →</button>
          </article>`;
      }).join("")}</div>` : `<div class="page-placeholder"><strong>Aún no tienes favoritas</strong><span>Marca una cartera con ☆ para verla aquí y arriba del mercado.</span></div>`}
    </div>`;
}

/* ===== Espacio de carteras en subasta ===== */
function auctionCard(lot, seller) {
  const st = auctionState(lot.id);
  const p = profileOf(lot);
  const elapsed = Math.min(100, Math.max(0, (Date.now() - p.startsAt) / (p.endsAt - p.startsAt) * 100));
  const top = topBid(lot.id);
  const reserve = reserveOf(lot.id);
  const stateLabel = { vivo: "<i></i> En vivo", proxima: "Próxima", cerrada: "Cerrada" }[st];
  return `
    <article class="auction-card state-${st}">
      <div class="auction-card-head"><span class="state-chip ${st}">${stateLabel}</span>${seller ? "" : favButton(lot.id)}</div>
      <div class="lot-number">${lot.id}</div>
      <h3>${lot.title}</h3>
      <span class="auction-sub">${lot.type} · ${lot.modality} · ${lot.amount}</span>
      <div class="auction-timer"><small>${cdLabel(lot.id)}</small>${cdHtml(lot.id, "big")}</div>
      <div class="auction-progress"><span style="width:${elapsed}%"></span></div>
      <div class="auction-progress-labels"><span>${fmtDate(p.startsAt)}</span><span>${fmtDate(p.endsAt)}</span></div>
      <div class="market-card-stats">
        <div><small>Más alta</small><b>${top ? top.percent + "%" : "—"}</b></div>
        <div><small>Postores</small><b>${bidderCount(lot.id)}</b></div>
        ${seller ? `<div><small>Tarifa</small><b>${reserve}%</b></div>` : `<div><small>Ofertas</small><b>${bidsFor(lot.id).length}</b></div>`}
      </div>
      ${seller && top ? `<div style="margin-top:10px">${reserveBadge(top.percent, reserve, true)}</div>` : ""}
      <button class="btn btn-navy btn-small" onclick="openDetail('${lot.id}')">${seller ? "Ver subasta" : "Entrar a la subasta"} →</button>
    </article>`;
}

function renderAuctionsPage() {
  const seller = currentRole === "vendedor";
  const pool = seller ? originatorLots : buyerOpportunities;
  const fav = new Set(appState.favorites || []);
  const byFavThenEnd = (a, b) => (seller ? 0 : fav.has(b.id) - fav.has(a.id)) || endKey(a) - endKey(b);
  const groups = [
    ["vivo", "En vivo", "Ordenadas por la que cierra primero"],
    ["proxima", "Próximas", "Aún no abren; puedes revisarlas y marcarlas"],
    ["cerrada", "Cerradas", "Subastas finalizadas"]
  ].map(([st, title, sub]) => ({ title, sub, items: pool.filter(l => auctionState(l.id) === st).sort(byFavThenEnd) }))
    .filter(g => g.items.length);

  return `
    <div class="card page-card">
      <div class="section-kicker">${seller ? "TUS SUBASTAS" : "SUBASTAS"}</div>
      <h2>Carteras en subasta</h2>
      <p>${seller ? "Sigue el tiempo, las ofertas y si superan tu tarifa en cada una de tus carteras." : "Entra a la subasta, revisa el tiempo restante y oferta. Tus favoritas aparecen primero."}</p>
      ${seller ? "" : spotlightCards(pool)}
      ${groups.map(g => `
        <div class="auction-group-head"><h3>${g.title}</h3><span>${g.items.length} · ${g.sub}</span></div>
        <div class="auction-grid">${g.items.map(l => auctionCard(l, seller)).join("")}</div>`).join("")}
    </div>`;
}

/* ===== Línea del proceso del comprador (reemplaza "Valor de oportunidades") ===== */
function buyerProcesses() {
  const map = {};
  Object.entries(processDemo).forEach(([id, v]) => { map[id] = { ...v }; });
  (appState.favorites || []).forEach(id => { map[id] = { ...map[id], phase: Math.max(map[id]?.phase || 0, 1) }; });
  (appState.offers || []).forEach(o => {
    const d = appState.decisions?.[o.id];
    const phase = d === "Aceptada" ? 5 : auctionState(o.lotId) === "vivo" ? 4 : 3;
    map[o.lotId] = { ...map[o.lotId], phase: Math.max(map[o.lotId]?.phase || 0, phase) };
  });
  (appState.operations || []).filter(op => op.status !== "Cancelada" && op.buyer === appState.company).forEach(op => {
    const phase = op.status === "Cerrada" || op.steps.firmaComprador ? 6 : 5;
    map[op.lotId] = { ...map[op.lotId], phase: Math.max(map[op.lotId]?.phase || 0, phase) };
  });
  return Object.entries(map)
    .map(([id, v]) => ({ id, phase: v.phase, title: v.title || lotById(id)?.title || id }))
    .sort((a, b) => b.phase - a.phase);
}

function renderBuyerProcess() {
  const rows = buyerProcesses();
  const lead = rows[0];
  const last = PHASES.length - 1;
  return `
    <div class="dashboard-chart-header">
      <div><div class="chart-kicker">TU PROCESO</div><h3>¿En qué fase vas?</h3>
        <p>${lead ? `Tu proceso más avanzado: <strong>${lead.id}</strong> · fase ${lead.phase} de ${PHASES.length} (${PHASES[lead.phase - 1]})` : "Marca una cartera como favorita o presenta una oferta para empezar."}</p></div>
      <div class="chart-period">${rows.length} procesos</div>
    </div>
    <div class="process">
      <div class="process-row process-head"><div></div><div class="process-track labels">${PHASES.map((p, i) => `<label style="left:${i / last * 100}%"><b>${i + 1}</b>${p}</label>`).join("")}</div><div></div></div>
      ${rows.map(r => `
        <div class="process-row">
          <div class="process-info"><strong>${r.id}</strong><span>${escapeHtml(r.title)}</span></div>
          <div class="process-track">
            <div class="process-fill" style="width:${(r.phase - 1) / last * 100}%"></div>
            ${PHASES.map((p, i) => `<span class="process-step ${i + 1 < r.phase ? "done" : i + 1 === r.phase ? "current" : ""}" style="left:${i / last * 100}%" title="Fase ${i + 1}: ${p}"></span>`).join("")}
          </div>
          <div class="process-extra"><em>Fase ${r.phase} · ${PHASES[r.phase - 1]}</em>${r.phase === 4 && lotProfiles[r.id] ? `<small>${cdLabel(r.id)} ${cdHtml(r.id)}</small>` : ""}</div>
        </div>`).join("")}
    </div>`;
}

/* ===== Gráficas premium ===== */
const CHART_COLORS = [["#60a5fa", "#2563eb"], ["#fcd34d", "#d89b2b"], ["#6ee7b7", "#12b76a"], ["#5b7bc0", "#102a56"], ["#c4b5fd", "#7c3aed"]];

/* Dona en 3D: anillo inclinado con volumen (capas apiladas) y sombra */
function svgDonut(data, centerValue, centerLabel, idp = "d") {
  const total = data.reduce((s, d) => s + d[1], 0);
  const r = 72, C = 2 * Math.PI * r, gap = 3, DEPTH = 14, CY = 64;
  const ring = (cls, colorOf) => {
    let acc = 0;
    return data.map(([label, value], i) => {
      const len = C * value / total;
      const seg = `<circle class="${cls}" cx="100" cy="100" r="${r}" stroke="${colorOf(i)}" stroke-dasharray="${Math.max(0, len - gap).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" style="animation-delay:${i * .12}s">${cls === "donut-seg" ? `<title>${label}: ${value}%</title>` : ""}</circle>`;
      acc += len;
      return seg;
    }).join("");
  };
  const plane = d => `translate(0 ${d}) translate(100 ${CY}) scale(1 .62) translate(-100 -100)`;
  const depth = ring("donut-depth", i => CHART_COLORS[i % 5][1]);
  const layers = Array.from({ length: DEPTH }, (_, k) => DEPTH - k)
    .map(d => `<g transform="${plane(d)}"><g transform="rotate(-90 100 100)">${depth}</g></g>`).join("");
  return `
    <div class="donut-premium donut-3d">
      <svg viewBox="0 0 200 150" role="img" aria-label="${escapeHtml(centerValue + " " + centerLabel)}">
        <defs>
          ${data.map((_, i) => `<linearGradient id="${idp}${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${CHART_COLORS[i % 5][0]}"/><stop offset="100%" stop-color="${CHART_COLORS[i % 5][1]}"/></linearGradient>`).join("")}
          <radialGradient id="${idp}sh"><stop offset="0%" stop-color="#102a56" stop-opacity=".28"/><stop offset="100%" stop-color="#102a56" stop-opacity="0"/></radialGradient>
        </defs>
        <ellipse cx="100" cy="${CY + DEPTH + 8}" rx="92" ry="54" fill="url(#${idp}sh)"></ellipse>
        <g class="donut-depth-layers">${layers}</g>
        <g transform="${plane(0)}">
          <circle class="donut-track" cx="100" cy="100" r="${r}"></circle>
          <g transform="rotate(-90 100 100)">${ring("donut-seg", i => `url(#${idp}${i})`)}</g>
          <circle class="donut-shine" cx="100" cy="100" r="${r}"></circle>
        </g>
      </svg>
      <div class="donut-premium-center"><strong>${centerValue}</strong><span>${centerLabel}</span></div>
    </div>
    <div class="legend-premium">${data.map(([label, value], i) => `
      <div><i style="background:linear-gradient(135deg,${CHART_COLORS[i % 5][0]},${CHART_COLORS[i % 5][1]})"></i><span>${label}</span>
        <div class="legend-bar"><b style="width:${value / Math.max(...data.map(d => d[1])) * 100}%;background:linear-gradient(90deg,${CHART_COLORS[i % 5][0]},${CHART_COLORS[i % 5][1]})"></b></div><strong>${value}%</strong></div>`).join("")}
    </div>`;
}

function renderReserveChart(pool) {
  const lo = 60, hi = 100;
  const x = v => Math.min(100, Math.max(0, (v - lo) / (hi - lo) * 100));
  return `
    <div class="reserve-chart">
      ${pool.map(lot => {
        const top = topBid(lot.id);
        const reserve = reserveOf(lot.id);
        const ok = top && top.percent >= reserve;
        return `
          <div class="reserve-row">
            <div class="reserve-label"><strong>${lot.id}</strong><span>${lot.type} · ${bidsFor(lot.id).length} ofertas</span></div>
            <div class="reserve-track">
              ${top ? `<div class="reserve-bar ${ok ? "ok" : "low"}" style="width:${x(top.percent)}%"><b>${top.percent}%</b></div>` : ""}
              <i class="reserve-mark" style="left:${x(reserve)}%"><span>Tarifa ${reserve}%</span></i>
            </div>
            <div class="reserve-meta">${top ? reserveBadge(top.percent, reserve) : "Sin ofertas"}</div>
          </div>`;
      }).join("")}
      <div class="reserve-row reserve-axis"><div></div><div class="reserve-ticks">${[60, 70, 80, 90, 100].map(v => `<span style="left:${x(v)}%">${v}%</span>`).join("")}</div><div></div></div>
    </div>`;
}
