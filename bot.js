/* =========================================================
   B²GC BROKERS — BOT.JS
   Asistente guiado: ayuda al comprador a elegir qué cartera
   le conviene según tipo, presupuesto, riesgo y modalidad.

   Funciona con reglas (sin servicio externo). Entiende los
   botones y también frases como "busco libranza, tengo
   3.000 millones, perfil conservador". Para conversar con un
   modelo de lenguaje real hace falta un backend que guarde la
   clave de la API.
   ========================================================= */

const BOT = { open: false, answers: {}, step: 0, busy: false };

const BOT_STEPS = [
  { key: "type", q: "¿Qué tipo de cartera te interesa?",
    opts: [["Consumo", "Consumo"], ["Libranza", "Libranza"], ["Comercial", "Comercial"], ["Hipotecaria", "Hipotecaria"], ["PYME", "PYME"], ["Sin preferencia", "any"]] },
  { key: "budget", q: "¿Cuánto capital tienes disponible para esta compra?",
    opts: [["Hasta $3.000 M", 3000], ["$3.000 – $6.000 M", 6000], ["$6.000 – $9.000 M", 9000], ["Más de $9.000 M", 99999], ["Aún no lo defino", 0]] },
  { key: "risk", q: "¿Qué perfil de riesgo prefieres?",
    opts: [["Conservador · menor descuento", "conservador"], ["Moderado", "moderado"], ["Agresivo · mayor descuento", "agresivo"]] },
  { key: "modality", q: "¿Cómo prefieres negociar?",
    opts: [["Subasta privada", "Subasta privada"], ["Compra directa", "Compra directa"], ["Híbrida", "Híbrida"], ["Me da igual", "any"]] }
];

const money = n => "$" + Math.round(n).toLocaleString("es-CO") + " M";
const pct = s => Number(String(s).replace("%", ""));

/* ----- Construcción de la interfaz ----- */
function buildBot() {
  if ($("#bot-root")) return;
  const root = document.createElement("div");
  root.id = "bot-root";
  root.innerHTML = `
    <button type="button" id="bot-fab" class="bot-fab" onclick="toggleBot()" aria-label="Abrir asistente de carteras">
      <span class="bot-fab-icon">✦</span><span class="bot-fab-text">¿Qué cartera me sirve?</span>
    </button>
    <section id="bot-panel" class="bot-panel hidden" role="dialog" aria-label="Asistente de carteras">
      <header class="bot-head">
        <div class="bot-avatar">✦</div>
        <div><strong>Asistente B²GC</strong><span>Te ayudo a elegir cartera</span></div>
        <button type="button" class="bot-x" onclick="toggleBot()" aria-label="Cerrar">×</button>
      </header>
      <div id="bot-msgs" class="bot-msgs"></div>
      <form class="bot-form" onsubmit="botSend(event)">
        <input id="bot-input" type="text" autocomplete="off" placeholder="Escribe: busco libranza, tengo 3.000 millones…">
        <button type="submit" aria-label="Enviar">→</button>
      </form>
    </section>`;
  document.body.appendChild(root);
}

function openBot() { if (!BOT.open) toggleBot(); }

function toggleBot() {
  BOT.open = !BOT.open;
  $("#bot-panel").classList.toggle("hidden", !BOT.open);
  $("#bot-fab").classList.toggle("hidden", BOT.open);
  if (BOT.open && !$("#bot-msgs").children.length) botStart();
  if (BOT.open) setTimeout(() => $("#bot-input")?.focus(), 150);
}

/* ----- Mensajes ----- */
function botScroll() { const m = $("#bot-msgs"); m.scrollTop = m.scrollHeight; }

function botSay(html, cls = "") {
  const d = document.createElement("div");
  d.className = "bot-msg bot " + cls;
  d.innerHTML = html;
  $("#bot-msgs").appendChild(d);
  botScroll();
  return d;
}
function userSay(text) {
  const d = document.createElement("div");
  d.className = "bot-msg user";
  d.textContent = text;
  $("#bot-msgs").appendChild(d);
  botScroll();
}

function botTyping(ms = 450) {
  return new Promise(res => {
    const t = botSay('<span class="bot-dots"><i></i><i></i><i></i></span>');
    setTimeout(() => { t.remove(); res(); }, ms);
  });
}

function botChips(options, onPick) {
  const wrap = document.createElement("div");
  wrap.className = "bot-chips";
  options.forEach(([label, value]) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label;
    b.onclick = () => { wrap.remove(); onPick(label, value); };
    wrap.appendChild(b);
  });
  $("#bot-msgs").appendChild(wrap);
  botScroll();
}

/* ----- Flujo ----- */
async function botStart() {
  BOT.answers = {}; BOT.step = 0;
  $("#bot-msgs").innerHTML = "";
  await botTyping(300);
  botSay("Hola 👋 Soy el asistente de B²GC. Con cuatro preguntas te muestro las carteras que mejor encajan contigo.");
  botSay('También puedes escribirme todo junto, por ejemplo: <em>“libranza, 3.000 millones, conservador”</em>.');
  botAsk();
}

async function botAsk() {
  const next = BOT_STEPS.find(s => BOT.answers[s.key] === undefined);
  if (!next) return botRecommend();
  await botTyping();
  botSay(next.q);
  botChips(next.opts, (label, value) => {
    userSay(label);
    BOT.answers[next.key] = value;
    botAsk();
  });
}

/* Interpreta texto libre y rellena lo que encuentre */
function parseFreeText(t) {
  const s = t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const found = {};
  const types = { consumo: "Consumo", libranza: "Libranza", comercial: "Comercial", hipotecari: "Hipotecaria", vivienda: "Hipotecaria", pyme: "PYME" };
  for (const k in types) if (s.includes(k)) { found.type = types[k]; break; }
  if (/(sin preferencia|cualquiera|me da igual|no importa)/.test(s)) { found.type ??= "any"; }

  const m = s.match(/(\d[\d.,]*)\s*(mil\s*)?(millones|mm|m\b)/);
  if (m) {
    let n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
    if (m[2]) n *= 1000;
    if (/mil\s*millones/.test(s) && n < 1000) n *= 1000;
    if (n > 0) found.budget = n;
  }
  if (/conservador|bajo riesgo|seguro/.test(s)) found.risk = "conservador";
  else if (/agresivo|alto riesgo|mayor rentabilidad/.test(s)) found.risk = "agresivo";
  else if (/moderado|medio/.test(s)) found.risk = "moderado";

  if (/subasta/.test(s)) found.modality = "Subasta privada";
  else if (/directa/.test(s)) found.modality = "Compra directa";
  else if (/hibrida/.test(s)) found.modality = "Híbrida";
  return found;
}

function botSend(e) {
  e.preventDefault();
  const input = $("#bot-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  userSay(text);
  $$("#bot-msgs .bot-chips").forEach(c => c.remove());

  if (/^(reiniciar|empezar|de nuevo|otra vez)/i.test(text)) return botStart();

  const found = parseFreeText(text);
  const keys = Object.keys(found);
  if (!keys.length) {
    botSay("No logré identificar tipo, presupuesto, riesgo o modalidad en tu mensaje. Usa los botones o prueba con algo como <em>“hipotecaria, 8.000 millones, moderado”</em>.");
    return botAsk();
  }
  Object.assign(BOT.answers, found);
  botAsk();
}

/* ----- Motor de recomendación ----- */
function scoreLot(lot, a) {
  const nominal = parseLotAmount(lot);
  const disc = pct(lot.discount);
  const price = nominal * (1 - disc / 100); // lo que pagarías al descuento objetivo
  let score = 0; const why = [];

  if (!a.type || a.type === "any") { score += 25; }
  else if (lot.type === a.type) { score += 40; why.push(`Es cartera de ${lot.type.toLowerCase()}, como pediste`); }
  else { score += 0; }

  if (!a.budget) { score += 15; }
  else if (price <= a.budget) { score += 25; why.push(`Pagarías cerca de ${money(price)}, dentro de tu capital`); }
  else {
    const over = price / a.budget - 1;
    score += Math.max(0, 25 - over * 50);
    why.push(`Excede tu capital en ${money(price - a.budget)} (puedes negociar o entrar en un lote menor)`);
  }

  if (a.risk) {
    const target = { conservador: [0, 15], moderado: [15, 20], agresivo: [20, 100] }[a.risk];
    if (disc >= target[0] && disc <= target[1]) {
      score += 20;
      why.push({ conservador: `Descuento bajo (${lot.discount}): cartera más depurada`, moderado: `Descuento equilibrado (${lot.discount})`, agresivo: `Descuento alto (${lot.discount}): más margen de rentabilidad` }[a.risk]);
    } else {
      const d = Math.min(Math.abs(disc - target[0]), Math.abs(disc - target[1]));
      score += Math.max(0, 20 - d * 2.5);
    }
  } else score += 10;

  if (!a.modality || a.modality === "any") score += 8;
  else if (lot.modality === a.modality) { score += 15; why.push(`Se negocia por ${lot.modality.toLowerCase()}`); }

  return { lot, price, score: Math.round(Math.min(100, score)), why };
}

async function botRecommend() {
  await botTyping(700);
  const a = BOT.answers;
  const ranked = lots.map(l => scoreLot(l, a)).sort((x, y) => y.score - x.score).slice(0, 3);

  const resumen = [
    a.type && a.type !== "any" ? a.type : "cualquier tipo",
    a.budget ? (a.budget >= 99999 ? "más de $9.000 M" : `hasta ${money(a.budget)}`) : "capital por definir",
    a.risk ? `perfil ${a.risk}` : "riesgo abierto",
    a.modality && a.modality !== "any" ? a.modality.toLowerCase() : "cualquier modalidad"
  ].join(" · ");
  botSay(`Esto es lo que entendí: <strong>${resumen}</strong>.<br>Estas son mis tres mejores opciones:`);

  ranked.forEach((r, i) => {
    botSay(`
      <div class="bot-card">
        <div class="bot-card-top"><span>${i + 1}. ${r.lot.id}</span><b class="${r.score >= 70 ? "hi" : r.score >= 45 ? "mid" : "lo"}">${r.score}% afín</b></div>
        <strong>${r.lot.title}</strong>
        <div class="bot-card-meta">${money(parseLotAmount(r.lot))} nominal · ${r.lot.discount} descuento · ${r.lot.modality}</div>
        <ul>${r.why.length ? r.why.map(w => `<li>${w}</li>`).join("") : "<li>Coincide parcialmente con tus criterios</li>"}</ul>
        <div class="bot-card-actions">
          <button type="button" onclick="botViewLot('${r.lot.id}','resumen')">Ver cartera</button>
          <button type="button" onclick="botViewLot('${r.lot.id}','simulador')">Simular oferta</button>
        </div>
      </div>`, "wide");
  });

  botSay("Son estimaciones sobre los datos de prueba; antes de ofertar revisa el data room. ¿Quieres ajustar algún criterio?");
  botChips([["Cambiar presupuesto", "budget"], ["Cambiar riesgo", "risk"], ["Cambiar tipo", "type"], ["Empezar de nuevo", "restart"]], (label, v) => {
    userSay(label);
    if (v === "restart") return botStart();
    delete BOT.answers[v];
    botAsk();
  });
}

function botViewLot(id, tab) {
  if (!appState.loggedIn) {
    openAuth("login");
    $$(".role-opt").forEach(o => o.classList.toggle("active", o.dataset.role === "comprador"));
    currentRole = "comprador";
    const e = $("#auth-email"), p = $("#auth-password");
    if (e) e.value = demoAccounts.comprador.email;
    if (p) p.value = demoAccounts.comprador.password;
    showToast("Inicia sesión como comprador para ver el detalle (cuenta demo cargada).");
    return;
  }
  openDetail(id);
  showTab(tab);
}

/* ----- Visible solo para público y compradores ----- */
function syncBot() {
  const root = $("#bot-root");
  if (!root) return;
  const adminOpen = $("#admin-shell") && !$("#admin-shell").classList.contains("hidden");
  const hide = adminOpen || (appState.loggedIn && currentRole === "originador");
  root.classList.toggle("hidden", hide);
}

(function hookBot() {
  const wrap = name => {
    const orig = window[name];
    if (typeof orig !== "function") return;
    window[name] = function (...args) { const r = orig.apply(this, args); syncBot(); return r; };
  };
  ["setRole", "exitApp", "openAdminPanel", "closeAdminPanel"].forEach(wrap);
})();

document.addEventListener("DOMContentLoaded", () => { buildBot(); syncBot(); });
