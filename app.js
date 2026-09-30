/* =========================================================
   B²GC BROKERS — APP.JS COMPLETO
   Dashboard + Simulador + Gráficas
   ========================================================= */

/* ===== Variables globales ===== */
let currentAuthMode = "login";
let currentRole = "originador";
let currentDetail = null;
let toastTimer = null;
let countdownTimer = null;

/* ===== Estado ===== */
const DEMO_STORAGE_KEY = "b2gc_demo_state_v2";

const demoAccounts = {
  originador: { email: "originador@demo.b2gc.co", password: "Demo123!", company: "Originador Demo S.A.S.", avatar: "OD" },
  comprador: { email: "comprador@demo.b2gc.co", password: "Demo123!", company: "Comprador Demo S.A.S.", avatar: "CD" }
};

const appState = {
  loggedIn: false,
  demoMode: true,
  company: "Originador Demo S.A.S.",
  avatar: "OD",
  userEmail: demoAccounts.originador.email,
  originador: { stats: { cartera: "$18.420 M", operaciones: "126", compradores: "47", cierre: "82%" } },
  comprador: { stats: { oportunidades: "32", ofertas: "14", adjudicadas: "8", cierre: "76%" } },
  offers: [],
  uploadedDocuments: []
};

const originatorLots = [
  { id: "LOTE-TEST-001", title: "Cartera de consumo — Demo", originador: "Originador Demo S.A.S.", type: "Consumo", amount: "$4.850 M", discount: "18%", debtors: "2.840", status: "Subasta activa", statusClass: "badge-green", modality: "Subasta privada", deadline: "18 Sep 2026", score: "A+" },
  { id: "LOTE-TEST-002", title: "Cartera libranza — Demo", originador: "Originador Demo S.A.S.", type: "Libranza", amount: "$3.240 M", discount: "15%", debtors: "1.460", status: "En negociación", statusClass: "badge-blue", modality: "Compra directa", deadline: "22 Sep 2026", score: "A" },
  { id: "LOTE-TEST-003", title: "Cartera comercial — Demo", originador: "Originador Demo S.A.S.", type: "Comercial", amount: "$6.780 M", discount: "22%", debtors: "860", status: "Data room abierto", statusClass: "badge-blue", modality: "Híbrida", deadline: "25 Sep 2026", score: "B+" }
];

const lots = [
  { id: "LOTE-TEST-001", title: "Cartera de consumo — Demo", originador: "Entidad Financiera Demo A", type: "Consumo", amount: "$4.850 M", discount: "18%", debtors: "2.840", status: "Subasta activa", statusClass: "badge-green", modality: "Subasta privada", deadline: "18 Sep 2026", score: "A+" },
  { id: "LOTE-TEST-002", title: "Cartera libranza — Demo", originador: "Entidad Financiera Demo B", type: "Libranza", amount: "$3.240 M", discount: "15%", debtors: "1.460", status: "En negociación", statusClass: "badge-blue", modality: "Compra directa", deadline: "22 Sep 2026", score: "A" },
  { id: "LOTE-TEST-003", title: "Cartera comercial — Demo", originador: "Entidad Financiera Demo C", type: "Comercial", amount: "$6.780 M", discount: "22%", debtors: "860", status: "Precalificación", statusClass: "badge-gold", modality: "Híbrida", deadline: "25 Sep 2026", score: "B+" },
  { id: "LOTE-TEST-004", title: "Cartera hipotecaria — Demo", originador: "Entidad Financiera Demo D", type: "Hipotecaria", amount: "$8.920 M", discount: "12%", debtors: "420", status: "Data room abierto", statusClass: "badge-blue", modality: "Subasta privada", deadline: "30 Sep 2026", score: "A+" },
  { id: "LOTE-TEST-005", title: "Cartera pyme — Demo", originador: "Originador Demo E", type: "PYME", amount: "$2.160 M", discount: "20%", debtors: "315", status: "Nueva", statusClass: "badge-green", modality: "Compra directa", deadline: "02 Oct 2026", score: "A" }
];

const buyerOpportunities = lots.map(lot => ({ ...lot }));

/* ===== TRM y perfil ampliado de cada lote (DEMO: reemplazar por API/BD) ===== */
const TRM_DEMO = 3950; // COP por USD; conectar a la TRM oficial cuando haya backend
const DAY = 864e5;
const SOLD_DEMO = 3977; // M COP ya vendidos (demo)

const lotProfiles = {
  "LOTE-TEST-001": { obligations: 6120, likes: 128, favs: 41, comments: 17, offers: 6, bestPercent: 82, startsAt: Date.now() + 2 * DAY, endsAt: Date.now() + 9 * DAY },
  "LOTE-TEST-002": { obligations: 3010, likes: 76, favs: 22, comments: 9, offers: 4, bestPercent: 85, startsAt: Date.now() + 4 * DAY, endsAt: Date.now() + 12 * DAY },
  "LOTE-TEST-003": { obligations: 1930, likes: 54, favs: 15, comments: 6, offers: 3, bestPercent: 74, startsAt: Date.now() + 6 * DAY, endsAt: Date.now() + 15 * DAY },
  "LOTE-TEST-004": { obligations: 980, likes: 33, favs: 10, comments: 3, offers: 2, bestPercent: 88, startsAt: Date.now() + 8 * DAY, endsAt: Date.now() + 18 * DAY },
  "LOTE-TEST-005": { obligations: 720, likes: 21, favs: 7, comments: 2, offers: 1, bestPercent: 80, startsAt: Date.now() + 10 * DAY, endsAt: Date.now() + 20 * DAY }
};
const profileOf = lot => lotProfiles[lot.id] || lotProfiles["LOTE-TEST-001"];

// Composición de cartera (DEMO, porcentajes). tipos: [nombre, %obligaciones, %valor]
const composition = {
  tipos: [["Consumo", .46, .38], ["Sobregiros", .18, .09], ["Vivienda", .06, .31], ["Tarjeta de crédito", .20, .14], ["Libre inversión", .10, .08]],
  mora: [["Al día (0)", .22], ["1–30 días", .18], ["31–60 días", .16], ["61–180 días", .24], ["180+ / castigo", .20]],
  ciudades: [["Bogotá", .34], ["Medellín", .18], ["Cali", .14], ["Barranquilla", .10], ["Otras", .24]],
  rangos: [["< $1 M", .41], ["$1–5 M", .37], ["$5–20 M", .16], ["> $20 M", .06]],
  obligPorCliente: [["1 obligación", .58], ["2 obligaciones", .24], ["3 obligaciones", .12], ["4 o más", .06]],
  tipoCliente: [["Persona natural", .87], ["Persona jurídica", .13]],
  soportes: [["Soportes físicos", 78], ["Soportes digitales", 91], ["Deudores localizados", 64], ["Con celular", 72], ["Con correo", 55], ["Con dirección", 83], ["Obligaciones judicializadas", 18]]
};

const testDocuments = [
  { id: "DOC-TEST-001", name: "Resumen ejecutivo", type: "PDF", size: "320 KB", category: "Comercial", lotId: "LOTE-TEST-001", status: "Disponible", content: "RESUMEN EJECUTIVO — LOTE-TEST-001\n\nDocumento ficticio para pruebas de B²GC Brokers.\n\nValor nominal: $4.850 M\nTipo: Consumo\nModalidad: Subasta privada\nCalificación: A+\n\nEste documento no contiene información real y solo debe utilizarse para pruebas." },
  { id: "DOC-TEST-002", name: "Base anonimizada", type: "XLSX", size: "1,2 MB", category: "Datos", lotId: "LOTE-TEST-001", status: "Disponible", content: "BASE ANONIMIZADA — LOTE-TEST-001\n\nArchivo de prueba. Registros ficticios: 2.840 deudores anonimizados.\nNo contiene PII real." },
  { id: "DOC-TEST-003", name: "Información de saldos", type: "PDF", size: "540 KB", category: "Financiero", lotId: "LOTE-TEST-002", status: "Disponible", content: "INFORMACIÓN DE SALDOS — LOTE-TEST-002\n\nSaldo nominal de prueba: $3.240 M\nDeudores de prueba: 1.460\nTipo: Libranza\n\nInformación ficticia para validar el flujo documental." },
  { id: "DOC-TEST-004", name: "Metodología de valoración", type: "DOCX", size: "210 KB", category: "Valoración", lotId: "LOTE-TEST-003", status: "Disponible", content: "METODOLOGÍA DE VALORACIÓN — DEMO\n\nModelo ilustrativo para pruebas. La valoración utiliza escenarios y porcentajes configurables dentro del simulador." },
  { id: "DOC-TEST-005", name: "Documentación jurídica", type: "PDF", size: "760 KB", category: "Legal", lotId: "LOTE-TEST-004", status: "Disponible", content: "DOCUMENTACIÓN JURÍDICA — DEMO\n\nChecklist jurídico ficticio: contrato, certificaciones y anexos.\nEstado de prueba: documentación disponible para revisión." },
  { id: "DOC-TEST-006", name: "Certificación de cartera", type: "PDF", size: "430 KB", category: "Legal", lotId: "LOTE-TEST-005", status: "Disponible", content: "CERTIFICACIÓN DE CARTERA — LOTE-TEST-005\n\nDocumento ficticio para validar consulta, descarga y trazabilidad." }
];

/* ===== Persistencia demo ===== */
function loadDemoState() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || "null");
    if (saved && Array.isArray(saved.offers)) appState.offers = saved.offers;
    if (saved && Array.isArray(saved.uploadedDocuments)) appState.uploadedDocuments = saved.uploadedDocuments;
  } catch (error) {
    console.warn("No fue posible cargar el estado demo.", error);
    appState.offers = [];
  }
}

function saveDemoState() {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ offers: appState.offers, uploadedDocuments: appState.uploadedDocuments }));
}

function resetDemoData() {
  appState.offers = [];
  appState.uploadedDocuments = [];
  saveDemoState();
  showToast("Datos de prueba restaurados.");
  if (appState.loggedIn) {
    const page = document.querySelector("#page-h1")?.textContent || "";
    if (page === "Centro de pruebas") renderPage("pruebas");
    else setRole(currentRole);
  }
}

loadDemoState();

/* ===== Selectores y utilidades ===== */
const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);

const fmtN = n => Math.round(n).toLocaleString("es-CO");
const fmtM = n => "$" + n.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " M";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function parseLotAmount(lot) {
  return Number(String(lot.amount).replace("$", "").replace(/\./g, "").replace(",", ".").replace(" M", ""));
}

/* ===== Cuenta regresiva ===== */
function fmtCountdown(ms) {
  if (ms <= 0) return "Finalizado";
  const d = Math.floor(ms / DAY), h = Math.floor(ms % DAY / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3);
  const p = n => String(n).padStart(2, "0");
  return `${d}d ${p(h)}h ${p(m)}m ${p(s)}s`;
}

function tickCountdowns() {
  const els = $$("[data-cd]");
  if (!els.length) { clearInterval(countdownTimer); countdownTimer = null; return; }
  els.forEach(el => {
    const [id, kind] = el.dataset.cd.split("|");
    const p = lotProfiles[id];
    if (!p) return;
    el.textContent = fmtCountdown((kind === "inicio" ? p.startsAt : p.endsAt) - Date.now());
  });
}

function startCountdowns() {
  clearInterval(countdownTimer);
  tickCountdowns();
  countdownTimer = setInterval(tickCountdowns, 1000);
}

function toggleCountdown() {
  const el = $("#cd-main"), label = $("#cd-label");
  if (!el || !label) return;
  const [id, kind] = el.dataset.cd.split("|");
  const next = kind === "inicio" ? "cierre" : "inicio";
  el.dataset.cd = `${id}|${next}`;
  label.textContent = next === "inicio" ? "Tiempo para inicio de subasta" : "Tiempo para cierre de subasta";
  tickCountdowns();
}

/* ===== Preferencias de aviso (SMS / WhatsApp / Mail) — solo guarda la preferencia ===== */
function getNotif() {
  try { return JSON.parse(localStorage.getItem("b2gc_notif") || "null") || { sms: true, wa: true, mail: true }; }
  catch { return { sms: true, wa: true, mail: true }; }
}

function setNotif(key, value) {
  const n = getNotif();
  n[key] = value;
  try { localStorage.setItem("b2gc_notif", JSON.stringify(n)); } catch { }
  showToast("Preferencia de aviso guardada.");
}

/* =========================================================
   AUTENTICACIÓN
   ========================================================= */
function openAuth(mode = "login") {
  currentAuthMode = mode;
  const overlay = $("#auth-overlay");
  const title = $("#auth-title");
  const subtitle = $("#auth-sub");
  const switchText = $("#auth-switch");
  const rolePick = $("#role-pick");
  if (!overlay) return;
  overlay.classList.remove("hidden");

  if (mode === "register") {
    if (title) title.textContent = "Crear cuenta";
    if (subtitle) subtitle.textContent = "Registra tu empresa y comienza a operar en B²GC Brokers.";
    if (switchText) switchText.innerHTML = '¿Ya tienes una cuenta? <button class="btn-text" onclick="openAuth(\'login\')">Inicia sesión</button>';
  } else {
    if (title) title.textContent = "Iniciar sesión";
    if (subtitle) subtitle.textContent = "Accede a tu cuenta de B²GC Brokers.";
    if (switchText) switchText.innerHTML = '¿Aún no tienes cuenta? <button class="btn-text" onclick="openAuth(\'register\')">Regístrate</button>';
  }
  if (rolePick) rolePick.classList.remove("hidden");
  setTimeout(() => { const email = $("#auth-email"); if (email) email.focus(); }, 150);
}

function closeAuth() {
  const overlay = $("#auth-overlay");
  if (overlay) overlay.classList.add("hidden");
}

function pickRole(element, role) {
  currentRole = role;
  $$(".role-opt").forEach(item => item.classList.remove("active"));
  if (element) element.classList.add("active");
}

function enterApp() {
  const email = $("#auth-email");
  const password = $("#auth-password");
  const emailValue = email ? email.value.trim().toLowerCase() : "";
  const passwordValue = password ? password.value : "";

  if (!emailValue) { showToast("Ingresa tu correo corporativo."); email?.focus(); return; }
  if (!passwordValue) { showToast("Ingresa tu contraseña."); password?.focus(); return; }

  const demoAccount = demoAccounts[currentRole];
  if (emailValue !== demoAccount.email || passwordValue !== demoAccount.password) {
    showToast(`Credenciales de prueba: ${demoAccount.email} / ${demoAccount.password}`);
    return;
  }

  appState.loggedIn = true;
  appState.demoMode = true;
  appState.userEmail = emailValue;
  appState.company = demoAccount.company;
  appState.avatar = demoAccount.avatar;

  closeAuth();
  $("#public-site")?.classList.add("hidden");
  $("#app-shell")?.classList.remove("hidden");
  setRole(currentRole);
  showToast(currentRole === "originador" ? "Bienvenido al entorno de pruebas como originador." : "Bienvenido al entorno de pruebas como comprador.");
}

function exitApp() {
  appState.loggedIn = false;
  $("#app-shell")?.classList.add("hidden");
  $("#public-site")?.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
  showToast("Has salido de la plataforma.");
}

/* =========================================================
   ROL Y SIDEBAR
   ========================================================= */
function setRole(role) {
  currentRole = role;
  const account = demoAccounts[role];
  if (account) { appState.company = account.company; appState.avatar = account.avatar; }

  const companyName = $("#company-name");
  const avatar = $(".avatar");
  if (companyName) companyName.textContent = appState.company;
  if (avatar) avatar.textContent = appState.avatar;

  $("#rt-originador")?.classList.toggle("active", role === "originador");
  $("#rt-comprador")?.classList.toggle("active", role === "comprador");

  const h1 = $("#page-h1");
  if (h1) h1.textContent = "Dashboard";

  buildSidebar();
  renderDashboard();
}

function buildSidebar() {
  const nav = $("#sidebar-nav");
  if (!nav) return;

  if (currentRole === "originador") {
    nav.innerHTML = `
      <a href="#" class="active" onclick="navigate(event,'dashboard')"><span>▦</span> Dashboard</a>
      <a href="#" onclick="navigate(event,'cartera')"><span>◫</span> Mis carteras</a>
      <a href="#" onclick="navigate(event,'oportunidades')"><span>◇</span> Interés de compradores</a>
      <a href="#" onclick="navigate(event,'negociaciones')"><span>⇄</span> Negociaciones</a>
      <a href="#" onclick="navigate(event,'documentos')"><span>□</span> Documentos y cierre</a>
      <a href="#" onclick="navigate(event,'reportes')"><span>▥</span> Reportes</a>
      <a href="#" onclick="navigate(event,'pruebas')"><span>✓</span> Pruebas</a>
      <div class="sidebar-market-status"><div class="status-title">Mercado activo</div><p>47 compradores conectados</p></div>`;
  } else {
    nav.innerHTML = `
      <a href="#" class="active" onclick="navigate(event,'dashboard')"><span>▦</span> Dashboard</a>
      <a href="#" onclick="navigate(event,'mercado')"><span>◇</span> Mercado</a>
      <a href="#" onclick="navigate(event,'ofertas')"><span>⇄</span> Mis ofertas</a>
      <a href="#" onclick="navigate(event,'adjudicaciones')"><span>✓</span> Adjudicaciones</a>
      <a href="#" onclick="navigate(event,'dataroom')"><span>□</span> Data room</a>
      <a href="#" onclick="navigate(event,'reportes')"><span>▥</span> Reportes</a>
      <a href="#" onclick="navigate(event,'pruebas')"><span>✓</span> Pruebas</a>
      <div class="sidebar-market-status"><div class="status-title">Mercado activo</div><p>32 oportunidades disponibles</p></div>`;
  }
}

function navigate(event, page) {
  if (event) event.preventDefault();
  const pageTitle = $("#page-h1");
  $$("#sidebar-nav a").forEach(link => link.classList.remove("active"));
  if (event && event.currentTarget) event.currentTarget.classList.add("active");

  const titles = {
    dashboard: "Dashboard", cartera: "Mis carteras", oportunidades: "Oportunidades", negociaciones: "Negociaciones",
    documentos: "Documentos", reportes: "Reportes", mercado: "Mercado de oportunidades", ofertas: "Mis ofertas",
    adjudicaciones: "Adjudicaciones", dataroom: "Data room", pruebas: "Centro de pruebas"
  };
  if (pageTitle) pageTitle.textContent = titles[page] || "Dashboard";

  if (page === "dashboard") renderDashboard();
  else renderPage(page);
}

/* =========================================================
   DASHBOARD
   ========================================================= */
function renderDashboard() {
  const content = $("#content");
  if (!content) return;

  const isOriginator = currentRole === "originador";
  const roleData = isOriginator ? {
    kicker: "VISTA GENERAL DEL ORIGINADOR",
    title: "Controla tu cartera y tus procesos de venta.",
    description: "Publica portafolios, revisa compradores, gestiona negociaciones y acompaña el cierre documental."
  } : {
    kicker: "VISTA GENERAL DEL COMPRADOR",
    title: "Encuentra, analiza y oferta en nuevas oportunidades.",
    description: "Explora cartera disponible, revisa data rooms, presenta ofertas y haz seguimiento a tus adjudicaciones.",
    kpis: [
      ["Oportunidades disponibles", "32", "↗ 7 nuevas hoy"],
      ["Ofertas realizadas", "14", "↗ +3 esta semana"],
      ["Adjudicaciones", "8", "↗ +2 este mes"],
      ["Tasa de cierre", "76%", "↗ +3.8 puntos"]
    ]
  };

  content.innerHTML = `
    <div class="dashboard-welcome reveal visible">
      <div style="margin-bottom:25px;">
        <div class="section-kicker">${roleData.kicker}</div>
        <h2 style="font-size:30px;letter-spacing:-1px;color:var(--navy);margin-top:5px;">${roleData.title}</h2>
        <p style="color:var(--muted);font-size:13px;margin-top:5px;">${roleData.description}</p>
      </div>
      <div class="kpi-grid">
        ${isOriginator ? renderOriginatorKpis() : roleData.kpis.map(k => kpiCard(k[0], k[1], k[2], "up")).join("")}
      </div>
      ${isOriginator ? renderOriginatorCharts() : renderDashboardCharts("comprador")}
      ${renderLotsCard()}
    </div>`;

  initReveal();
  startCountdowns();
}

function kpiCard(label, value, change, direction = "up") {
  return `
    <div class="kpi-card">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
      <div class="change ${direction === "down" ? "down" : ""}">${change}</div>
    </div>`;
}

/* ----- KPIs del originador ----- */
function renderOriginatorKpis() {
  const total = originatorLots.reduce((s, l) => s + parseLotAmount(l), 0); // M COP
  const usd = total * 1e6 / TRM_DEMO;
  const featured = originatorLots[0];
  const likes = originatorLots.reduce((s, l) => s + profileOf(l).likes, 0);
  const favs = originatorLots.reduce((s, l) => s + profileOf(l).favs, 0);
  const comments = originatorLots.reduce((s, l) => s + profileOf(l).comments, 0);
  const nOffers = originatorLots.reduce((s, l) => s + profileOf(l).offers, 0);
  const best = originatorLots.map(l => ({ lot: l, p: profileOf(l).bestPercent })).sort((a, b) => b.p - a.p)[0];
  const bestValue = parseLotAmount(best.lot) * best.p / 100;
  const n = getNotif();

  return `
    <div class="kpi-card">
      <div class="label">Cartera en comercialización · Saldo a capital</div>
      <div class="value">${fmtM(total)}</div>
      <div class="change">≈ USD ${fmtN(usd)} · TRM $${fmtN(TRM_DEMO)}</div>
    </div>

    <div class="kpi-card">
      <div class="label">Visualizaciones</div>
      <div class="value">${fmtN(likes + favs + comments)}</div>
      <div class="change" style="color:var(--muted)">♥ ${fmtN(likes)} likes · ★ ${fmtN(favs)} favoritos · ✎ ${fmtN(comments)} comentarios</div>
    </div>

    <div class="kpi-card">
      <div class="label">Mejor oferta actual · ${best.lot.id}</div>
      <div class="value">${fmtM(bestValue)} <small style="font-size:13px;color:var(--blue)">${best.p}%</small></div>
      <div class="change">Vendido ${fmtM(SOLD_DEMO)} de ${fmtM(total)} (${(SOLD_DEMO / total * 100).toFixed(1)}%) · ${nOffers} ofertas</div>
    </div>

    <div class="kpi-card" style="cursor:pointer" onclick="toggleCountdown()" title="Clic para alternar inicio ⇄ cierre">
      <div class="label"><span id="cd-label">Tiempo para inicio de subasta</span> ⇄</div>
      <div class="value" id="cd-main" data-cd="${featured.id}|inicio" style="font-size:20px">—</div>
      <div class="change" style="color:var(--muted)" onclick="event.stopPropagation()">
        Avisar por:
        <label><input type="checkbox" ${n.sms ? "checked" : ""} onchange="setNotif('sms',this.checked)"> SMS</label>
        <label><input type="checkbox" ${n.wa ? "checked" : ""} onchange="setNotif('wa',this.checked)"> WA</label>
        <label><input type="checkbox" ${n.mail ? "checked" : ""} onchange="setNotif('mail',this.checked)"> Mail</label>
      </div>
    </div>`;
}

/* ----- Gráficas del originador: solo Distribución por tipo y Estado de operaciones ----- */
function renderOriginatorCharts() {
  const donut = [["Consumo", 42], ["Libranza", 28], ["Comercial", 18], ["Hipotecaria", 12]];
  const statuses = [["En mercado", 36, "active"], ["En negociación", 18, "negotiation"], ["Cerradas", 72, "completed"]];
  const max = Math.max(...statuses.map(s => s[1]));
  return `
    <div class="dashboard-chart-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <div class="dashboard-chart-card">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">TU PORTAFOLIO</div><h3>Distribución por tipo</h3></div></div>
        <div class="portfolio-donut-wrap"><div class="portfolio-donut role-originador"><div class="portfolio-donut-center"><strong>126</strong><span>operaciones</span></div></div></div>
        <div class="portfolio-legend">${donut.map((d, i) => `<div><i class="legend-${i}"></i><span>${d[0]}</span><strong>${d[1]}%</strong></div>`).join("")}</div>
      </div>
      <div class="dashboard-chart-card">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">SEGUIMIENTO</div><h3>Estado de tus operaciones</h3></div></div>
        <div class="status-summary">${statuses.map(s => `<div class="status-row"><div class="status-name"><span class="status-dot ${s[2]}"></span>${s[0]}</div><strong>${s[1]}</strong></div><div class="status-progress"><span style="width:${s[1] / max * 100}%"></span></div>`).join("")}</div>
      </div>
    </div>`;
}

/* ----- Gráficas del comprador (sin cambios) ----- */
function renderDashboardCharts(role) {
  const data = {
    lineKicker: "MERCADO PARA TI", lineTitle: "Valor de oportunidades", lineSubtitle: "Valor nominal de las oportunidades que puedes analizar",
    values: [10800, 11600, 12150, 13400, 14200, 15100, 15950],
    donutKicker: "MERCADO DISPONIBLE", donutTitle: "Tipos de oportunidad", donutTotal: "32", donutLabel: "oportunidades",
    donut: [["Consumo", 34], ["Libranza", 27], ["Comercial", 23], ["Hipotecaria", 16]],
    activityTitle: "Actividad de compras",
    statusTitle: "Tu pipeline de compra",
    statuses: [["Disponibles", 32, "active"], ["Con oferta", 14, "negotiation"], ["Adjudicadas", 8, "completed"]]
  };

  const max = 20000;
  const points = data.values.map((v, i) => [(700 / (data.values.length - 1)) * i, 245 - (v / max) * 205]);
  const linePath = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L700,260 L0,260 Z`;
  const months = ["Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep"];
  const maxStatus = Math.max(...data.statuses.map(s => s[1]));

  return `
    <div class="dashboard-chart-grid">
      <div class="dashboard-chart-card dashboard-chart-large">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">${data.lineKicker}</div><h3>${data.lineTitle}</h3><p>${data.lineSubtitle}</p></div><div class="chart-period">Mar — Sep 2026</div></div>
        <div class="line-chart">
          <div class="line-chart-y"><span>20.000 M</span><span>15.000 M</span><span>10.000 M</span><span>5.000 M</span><span>0</span></div>
          <div class="line-chart-area"><div class="chart-lines"><span></span><span></span><span></span><span></span><span></span></div>
            <svg viewBox="0 0 700 260" preserveAspectRatio="none" class="market-line-svg" aria-label="${escapeHtml(data.lineTitle)}">
              <defs><linearGradient id="marketGradient-${role}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-opacity=".22"/><stop offset="100%" stop-opacity="0"/></linearGradient></defs>
              <path class="market-area" fill="url(#marketGradient-${role})" d="${areaPath}"></path>
              <path class="market-line" d="${linePath}"></path>
              <circle cx="${points.at(-1)[0]}" cy="${points.at(-1)[1]}" r="6" class="chart-current-point"></circle>
            </svg>
            <div class="line-chart-x">${months.map(m => `<span>${m}</span>`).join("")}</div>
          </div>
        </div>
      </div>

      <div class="dashboard-chart-card">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">${data.donutKicker}</div><h3>${data.donutTitle}</h3></div></div>
        <div class="portfolio-donut-wrap"><div class="portfolio-donut role-${role}"><div class="portfolio-donut-center"><strong>${data.donutTotal}</strong><span>${data.donutLabel}</span></div></div></div>
        <div class="portfolio-legend">${data.donut.map((item, i) => `<div><i class="legend-${i}"></i><span>${item[0]}</span><strong>${item[1]}%</strong></div>`).join("")}</div>
      </div>

      <div class="dashboard-chart-card">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">ACTIVIDAD</div><h3>${data.activityTitle}</h3></div></div>
        <div class="activity-chart">${renderActivityBars(role)}</div>
      </div>

      <div class="dashboard-chart-card">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">SEGUIMIENTO</div><h3>${data.statusTitle}</h3></div></div>
        <div class="status-summary">${data.statuses.map(item => `<div class="status-row"><div class="status-name"><span class="status-dot ${item[2]}"></span>${item[0]}</div><strong>${item[1]}</strong></div><div class="status-progress"><span style="width:${Math.min(100, item[1] / maxStatus * 100)}%"></span></div>`).join("")}</div>
      </div>
    </div>`;
}

function renderActivityBars(role) {
  const values = role === "originador" ? [48, 55, 62, 70, 66, 81, 88] : [38, 46, 58, 52, 70, 64, 84];
  const labels = ["Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep"];
  return values.map((value, index) => `
    <div class="activity-column">
      <div class="activity-value" style="height:${value}%"></div>
      <span>${labels[index]}</span>
    </div>`).join("");
}

/* ----- Tabla de lotes ----- */
function renderLotsCard() {
  if (currentRole === "originador") return renderOriginatorLotsCard();

  return `
    <div class="card">
      <div class="card-header"><div><h3>Oportunidades disponibles</h3><p>Lotes que puedes analizar y ofertar</p></div>
        <button class="btn btn-ghost btn-small" onclick="navigate(event,'mercado')">Ver todo</button>
      </div>
      <div class="table-wrap"><table><thead><tr>
        <th>Lote</th><th>Tipo</th><th>Valor</th><th>Descuento</th><th>Modalidad</th><th>Estado</th><th></th>
      </tr></thead><tbody>
        ${buyerOpportunities.map(lot => `<tr><td><strong style="color:var(--navy);">${lot.id}</strong></td><td>${lot.type}</td><td><strong>${lot.amount}</strong></td><td>${lot.discount}</td><td>${lot.modality}</td><td><span class="badge ${lot.statusClass}">${lot.status}</span></td><td><button class="btn btn-ghost btn-small" onclick="openDetail('${lot.id}')">Ver</button></td></tr>`).join("")}
      </tbody></table></div>
    </div>`;
}

function renderOriginatorLotsCard() {
  return `
    <div class="card">
      <div class="card-header"><div><h3>Mis portafolios y operaciones</h3><p>Detalle completo dentro de cada lote</p></div>
        <button class="btn btn-ghost btn-small" onclick="navigate(event,'cartera')">Ver todo</button>
      </div>
      <div class="table-wrap"><table><thead><tr>
        <th>Lote</th><th>Valor</th><th>Mejor oferta</th><th>Cuenta regresiva</th><th>Modalidad</th><th>Estado</th><th></th>
      </tr></thead><tbody>
        ${originatorLots.map(lot => {
          const p = profileOf(lot);
          return `<tr>
            <td><strong style="color:var(--navy);">${lot.id}</strong></td>
            <td><strong>${lot.amount}</strong></td>
            <td>${fmtM(parseLotAmount(lot) * p.bestPercent / 100)} · ${p.bestPercent}%</td>
            <td data-cd="${lot.id}|cierre">—</td>
            <td>${lot.modality}</td>
            <td><span class="badge ${lot.statusClass}">${lot.status}</span></td>
            <td><button class="btn btn-ghost btn-small" onclick="openDetail('${lot.id}')">Ver</button></td>
          </tr>`;
        }).join("")}
      </tbody></table></div>
    </div>`;
}

/* =========================================================
   PÁGINAS INTERNAS
   ========================================================= */
function renderPage(page) {
  const content = $("#content");
  if (!content) return;

  const isOrig = currentRole === "originador";
  const data = {
    cartera: { title: "Mis carteras", description: "Portafolios publicados por el originador demo." },
    oportunidades: { title: isOrig ? "Interés de compradores" : "Oportunidades", description: isOrig ? "Compradores demo que han mostrado interés en tus portafolios." : "Oportunidades disponibles para analizar y ofertar." },
    negociaciones: { title: isOrig ? "Negociaciones con compradores" : "Mis negociaciones", description: isOrig ? "Seguimiento a propuestas recibidas y contrapropuestas de tus portafolios." : "Seguimiento a tus propuestas y contrapropuestas." },
    mercado: { title: "Mercado de oportunidades", description: "Lotes demo disponibles para explorar y ofertar." },
    reportes: { title: "Reportes", description: "Indicadores simulados para validar visualizaciones." },
    pruebas: { title: "Centro de pruebas", description: "Herramientas para validar el prototipo sin usar datos reales." }
  };
  const current = data[page] || data.reportes;

  if (page === "pruebas") { content.innerHTML = renderTestCenter(); runSelfTests(false); return; }
  if (page === "ofertas") { content.innerHTML = renderOffersPage(); return; }

  if (["cartera", "oportunidades", "mercado"].includes(page)) {
    const items = isOrig ? originatorLots : buyerOpportunities;
    content.innerHTML = `
      <div class="card page-card">
        <div class="section-kicker">DATOS DE PRUEBA · ${isOrig ? "ORIGINADOR" : "COMPRADOR"}</div>
        <h2>${current.title}</h2>
        <p>${current.description}</p>
        <div class="test-lot-grid">
          ${items.map(lot => `
            <article class="test-lot-card">
              <div class="lot-number">${lot.id}</div>
              <h3>${lot.title}</h3>
              <span>${lot.type} · ${lot.modality}</span>
              <strong>${lot.amount}</strong>
              <div class="test-lot-meta">
                <span class="badge ${lot.statusClass}">${lot.status}</span>
                <span>${fmtN(profileOf(lot).obligations)} obligaciones</span>
              </div>
              <button class="btn btn-ghost btn-small" onclick="openDetail('${lot.id}')">Ver lote</button>
            </article>`).join("")}
        </div>
      </div>`;
    return;
  }

  if (page === "negociaciones") {
    const rows = !isOrig && appState.offers.length
      ? appState.offers
      : isOrig
        ? [
          { id: "NEG-ORIG-001", lotId: "LOTE-TEST-002", amount: "$2.754 M", status: "En revisión", date: "16 Sep 2026", counterparty: "Fondo Demo Andino" },
          { id: "NEG-ORIG-002", lotId: "LOTE-TEST-003", amount: "$5.220 M", status: "Contrapropuesta", date: "15 Sep 2026", counterparty: "Inversiones Demo Capital" }
        ]
        : [
          { id: "NEG-COMP-001", lotId: "LOTE-TEST-002", amount: "$2.754 M", status: "En revisión", date: "16 Sep 2026", counterparty: "Originador Demo S.A.S." },
          { id: "NEG-COMP-002", lotId: "LOTE-TEST-003", amount: "$5.017 M", status: "Contrapropuesta", date: "15 Sep 2026", counterparty: "Entidad Financiera Demo C" }
        ];

    content.innerHTML = `
      <div class="card page-card">
        <div class="section-kicker">PIPELINE DEMO</div>
        <h2>${current.title}</h2>
        <p>${current.description}</p>
        <div class="table-wrap page-table"><table>
          <thead><tr><th>Proceso</th><th>Lote</th><th>Contraparte</th><th>Valor</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody>${rows.map(row => `<tr><td><strong>${row.id}</strong></td><td>${row.lotId}</td><td>${row.counterparty || "Originador / contraparte demo"}</td><td>${row.amount}</td><td><span class="badge badge-blue">${row.status}</span></td><td>${row.date}</td></tr>`).join("")}</tbody>
        </table></div>
      </div>`;
    return;
  }

  if (page === "documentos" || page === "dataroom") { content.innerHTML = renderDocumentsPage(page); return; }
  if (page === "adjudicaciones") { content.innerHTML = renderAdjudicationsPage(); return; }
  if (page === "reportes") { content.innerHTML = renderReportsPage(); return; }

  content.innerHTML = `
    <div class="card page-card">
      <div class="section-kicker">B²GC BROKERS · DEMO</div>
      <h2>${current.title}</h2>
      <p>${current.description}</p>
      <div class="page-placeholder"><strong>Módulo funcional de prueba</strong><span>Los datos mostrados son ficticios y están almacenados únicamente en este navegador.</span></div>
    </div>`;
}

/* =========================================================
   DOCUMENTOS
   ========================================================= */
function renderDocumentsPage(page = "documentos") {
  const uploaded = appState.uploadedDocuments || [];
  const allDocs = [...testDocuments, ...uploaded];
  const title = page === "dataroom" ? "Data room" : "Documentos";
  const kicker = page === "dataroom" ? "DUE DILIGENCE · DEMO" : "GESTIÓN DOCUMENTAL · DEMO";
  const description = page === "dataroom"
    ? "Consulta documentos de prueba, revisa el contenido y carga archivos para validar el flujo de due diligence."
    : "Documentos ficticios listos para consultar, descargar y reemplazar durante las pruebas.";

  return `
    <div class="card page-card documents-page">
      <div class="documents-head">
        <div><div class="section-kicker">${kicker}</div><h2>${title}</h2><p>${description}</p></div>
        <div class="documents-head-actions">
          <input id="document-upload-input" type="file" class="hidden-file-input" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg" onchange="handleDocumentUpload(event)">
          <button class="btn btn-navy" type="button" onclick="triggerDocumentUpload()">＋ Subir documento</button>
        </div>
      </div>

      <div class="document-stats">
        <div><strong>${testDocuments.length}</strong><span>Documentos de prueba</span></div>
        <div><strong>${uploaded.length}</strong><span>Archivos cargados</span></div>
        <div><strong>${allDocs.length}</strong><span>Total disponible</span></div>
      </div>

      <div class="document-list document-list-enhanced">
        ${allDocs.map(doc => {
          const uploadedDoc = doc.source === "upload";
          return `
            <div class="document-row document-row-enhanced">
              <div class="document-main">
                <div class="document-icon ${uploadedDoc ? "uploaded" : "test"}">${escapeHtml(doc.type || "DOC")}</div>
                <div class="document-info">
                  <strong>${escapeHtml(doc.name)}</strong>
                  <span>${uploadedDoc ? "Archivo cargado" : "Documento de prueba"} · ${escapeHtml(doc.category || "General")} · ${escapeHtml(doc.lotId || "Sin lote")}</span>
                  <small>${escapeHtml(doc.size || "Tamaño demo")} · ${escapeHtml(doc.status || "Disponible")}</small>
                </div>
              </div>
              <div class="document-actions">
                <button class="btn btn-ghost btn-small" type="button" onclick="openDocumentViewer('${doc.id}')">Ver</button>
                <button class="btn btn-ghost btn-small" type="button" onclick="downloadDocument('${doc.id}')">Descargar</button>
                ${uploadedDoc ? `<button class="btn btn-danger-soft btn-small" type="button" onclick="removeUploadedDocument('${doc.id}')">Eliminar</button>` : `<button class="btn btn-blue-soft btn-small" type="button" onclick="triggerDocumentUpload('${doc.id}')">Subir reemplazo</button>`}
              </div>
            </div>`;
        }).join("")}
      </div>

      <div class="document-upload-zone" onclick="triggerDocumentUpload()" role="button" tabindex="0">
        <div class="upload-symbol">↑</div>
        <div><strong>Sube un archivo de prueba</strong><span>PDF, Word, Excel, CSV o imagen · máximo 2 MB por archivo</span></div>
      </div>
    </div>`;
}

let pendingDocumentReplacementId = null;
let pendingDocumentLotId = null;

function triggerDocumentUpload(replaceId = null, lotId = null) {
  pendingDocumentReplacementId = replaceId;
  pendingDocumentLotId = lotId;
  const input = $("#document-upload-input");
  if (input) { input.value = ""; input.click(); }
  else showToast("Abre primero la sección Documentos.");
}

function handleDocumentUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast("El archivo supera el límite demo de 2 MB."); return; }

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result || "");
    const extension = file.name.includes(".") ? file.name.split(".").pop().toUpperCase() : "FILE";
    const id = pendingDocumentReplacementId || `UPLOAD-TEST-${Date.now()}`;
    const existingIndex = appState.uploadedDocuments.findIndex(doc => doc.id === id);
    const uploaded = {
      id, name: file.name, type: extension, size: formatFileSize(file.size), category: "Cargado por usuario",
      lotId: pendingDocumentLotId || "Sin lote", status: "Cargado", source: "upload",
      mimeType: file.type || "application/octet-stream", dataUrl, uploadedAt: new Date().toLocaleString("es-CO")
    };
    try {
      if (existingIndex >= 0) appState.uploadedDocuments[existingIndex] = uploaded;
      else appState.uploadedDocuments.unshift(uploaded);
      saveDemoState();
      showToast(`Archivo ${file.name} cargado correctamente.`);
      renderPage(document.querySelector("#page-h1")?.textContent === "Data room" ? "dataroom" : "documentos");
    } catch (error) {
      console.error(error);
      showToast("No fue posible guardar el archivo. Prueba con un archivo más pequeño.");
    } finally {
      pendingDocumentReplacementId = null;
      pendingDocumentLotId = null;
    }
  };
  reader.onerror = () => showToast("No fue posible leer el archivo.");
  reader.readAsDataURL(file);
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function findDocument(documentId) {
  return [...testDocuments, ...(appState.uploadedDocuments || [])].find(doc => doc.id === documentId);
}

function openDocumentViewer(documentId) {
  const doc = findDocument(documentId);
  if (!doc) return;
  $("#document-viewer-overlay")?.remove();

  const content = doc.source === "upload"
    ? `<p><strong>Archivo:</strong> ${escapeHtml(doc.name)}</p><p><strong>Tipo:</strong> ${escapeHtml(doc.type)}</p><p><strong>Tamaño:</strong> ${escapeHtml(doc.size)}</p><p><strong>Fecha de carga:</strong> ${escapeHtml(doc.uploadedAt)}</p><p>El archivo fue guardado localmente en este navegador para las pruebas.</p>`
    : `<pre class="document-preview-text">${escapeHtml(doc.content)}</pre>`;

  const overlay = document.createElement("div");
  overlay.id = "document-viewer-overlay";
  overlay.className = "document-viewer-overlay";
  overlay.innerHTML = `
    <div class="document-viewer-modal">
      <button class="detail-close" type="button" onclick="closeDocumentViewer()">×</button>
      <div class="section-kicker">${doc.source === "upload" ? "ARCHIVO CARGADO" : "DOCUMENTO DE PRUEBA"}</div>
      <h2>${escapeHtml(doc.name)}</h2>
      <p>${escapeHtml(doc.lotId || "Documento general")} · ${escapeHtml(doc.type || "DOC")} · ${escapeHtml(doc.size || "")}</p>
      <div class="document-viewer-content">${content}</div>
      <div class="offer-actions">
        <button class="btn btn-ghost" type="button" onclick="closeDocumentViewer()">Cerrar</button>
        <button class="btn btn-navy" type="button" onclick="downloadDocument('${doc.id}')">Descargar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function closeDocumentViewer() { $("#document-viewer-overlay")?.remove(); }

function downloadDocument(documentId) {
  const doc = findDocument(documentId);
  if (!doc) return;

  if (doc.source === "upload" && doc.dataUrl) {
    const link = document.createElement("a");
    link.href = doc.dataUrl;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } else {
    const blob = new Blob([doc.content || `Documento de prueba: ${doc.name}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${doc.id}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }
  showToast(`Descarga preparada: ${doc.name}`);
}

function removeUploadedDocument(documentId) {
  const doc = findDocument(documentId);
  if (!doc || doc.source !== "upload") return;
  if (!confirm(`¿Eliminar el archivo de prueba "${doc.name}"?`)) return;
  appState.uploadedDocuments = appState.uploadedDocuments.filter(item => item.id !== documentId);
  saveDemoState();
  showToast("Archivo eliminado del entorno demo.");
  renderPage(document.querySelector("#page-h1")?.textContent === "Data room" ? "dataroom" : "documentos");
}

/* =========================================================
   ADJUDICACIONES, REPORTES, OFERTAS, PRUEBAS
   ========================================================= */
function renderAdjudicationsPage() {
  const isOrig = currentRole === "originador";
  const adjudications = isOrig
    ? [
      { id: "ADJ-ORIG-001", lot: "LOTE-TEST-001", buyer: "Comprador Demo S.A.S.", value: "$3.977 M", status: "Adjudicada", date: "12 Sep 2026" },
      { id: "ADJ-ORIG-002", lot: "LOTE-TEST-002", buyer: "Fondo Demo Andino", value: "$2.754 M", status: "En cierre", date: "15 Sep 2026" },
      { id: "ADJ-ORIG-003", lot: "LOTE-TEST-003", buyer: "Inversiones Demo Capital", value: "$5.220 M", status: "Documental", date: "16 Sep 2026" }
    ]
    : [
      { id: "ADJ-COMP-001", lot: "LOTE-TEST-001", buyer: "Originador Demo S.A.S.", value: "$3.977 M", status: "Adjudicada", date: "12 Sep 2026" },
      { id: "ADJ-COMP-002", lot: "LOTE-TEST-004", buyer: "Entidad Financiera Demo D", value: "$7.850 M", status: "En cierre", date: "14 Sep 2026" },
      { id: "ADJ-COMP-003", lot: "LOTE-TEST-002", buyer: "Originador Demo S.A.S.", value: "$2.754 M", status: "Documental", date: "15 Sep 2026" }
    ];
  return `
    <div class="card page-card">
      <div class="section-kicker">CIERRES · ${isOrig ? "ORIGINADOR" : "COMPRADOR"}</div>
      <h2>${isOrig ? "Cierres de mis portafolios" : "Mis adjudicaciones"}</h2>
      <p>${isOrig ? "Operaciones de tus portafolios que avanzan hacia cierre." : "Operaciones adjudicadas a tu cuenta de comprador demo."}</p>
      <div class="table-wrap page-table"><table><thead><tr><th>Adjudicación</th><th>Lote</th><th>${isOrig ? "Comprador" : "Originador"}</th><th>Valor</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>
        ${adjudications.map(item => `<tr><td><strong>${item.id}</strong></td><td>${item.lot}</td><td>${item.buyer}</td><td>${item.value}</td><td><span class="badge badge-green">${item.status}</span></td><td>${item.date}</td></tr>`).join("")}
      </tbody></table></div>
    </div>`;
}

function renderReportsPage() {
  const isOriginator = currentRole === "originador";
  const items = isOriginator ? originatorLots : buyerOpportunities;
  const totalNominal = items.reduce((sum, lot) => sum + parseLotAmount(lot), 0);
  const active = items.filter(lot => /activa|nueva|abierto/i.test(lot.status)).length;
  const negotiations = items.filter(lot => /negociación/i.test(lot.status)).length;
  return `
    <div class="card page-card">
      <div class="section-kicker">REPORTES · ${isOriginator ? "ORIGINADOR" : "COMPRADOR"}</div>
      <h2>${isOriginator ? "Reportes de cartera" : "Reportes de inversión"}</h2>
      <p>${isOriginator ? "Indicadores calculados sobre tus portafolios ficticios y su actividad comercial." : "Indicadores calculados sobre oportunidades, ofertas y adjudicaciones ficticias."}</p>
      <div class="report-kpi-grid">
        <div class="report-kpi"><span>${isOriginator ? "Valor de cartera propia" : "Valor de oportunidades"}</span><strong>${fmtM(totalNominal)}</strong><small>${items.length} registros demo</small></div>
        <div class="report-kpi"><span>${isOriginator ? "Portafolios activos" : "Oportunidades activas"}</span><strong>${active}</strong><small>Escenario actual</small></div>
        <div class="report-kpi"><span>${isOriginator ? "Negociaciones" : "Ofertas"}</span><strong>${isOriginator ? negotiations : appState.offers.length}</strong><small>${isOriginator ? "Con compradores demo" : "Registradas en este navegador"}</small></div>
        <div class="report-kpi"><span>${isOriginator ? "Compradores interesados" : "Adjudicaciones"}</span><strong>${isOriginator ? "47" : "8"}</strong><small>Dato ficticio de prueba</small></div>
      </div>
      <div class="report-bars">
        ${items.map(lot => `<div class="report-bar-row"><span>${lot.id}</span><div><i style="width:${Math.min(100, parseLotAmount(lot) / 89.5 * 100)}%"></i></div><strong>${lot.amount}</strong></div>`).join("")}
      </div>
    </div>`;
}

const receivedOffersDemo = [
  { id: "OF-REC-001", lotId: "LOTE-TEST-001", buyer: "Comprador Demo S.A.S.", amount: "$3.977 M", percent: 82, status: "En revisión", date: "16 Sep 2026" },
  { id: "OF-REC-002", lotId: "LOTE-TEST-002", buyer: "Fondo Demo Andino", amount: "$2.754 M", percent: 85, status: "Contrapropuesta", date: "15 Sep 2026" },
  { id: "OF-REC-003", lotId: "LOTE-TEST-003", buyer: "Inversiones Demo Capital", amount: "$5.017 M", percent: 74, status: "Recibida", date: "14 Sep 2026" }
];

function renderOffersPage() {
  const isBuyer = currentRole === "comprador";
  const submittedForOriginator = (appState.offers || [])
    .filter(offer => originatorLots.some(lot => lot.id === offer.lotId))
    .map(offer => ({ ...offer, buyer: offer.buyer || "Comprador Demo S.A.S." }));

  const offers = isBuyer
    ? appState.offers
    : [...submittedForOriginator, ...receivedOffersDemo.filter(received => !submittedForOriginator.some(s => s.lotId === received.lotId && s.amount === received.amount))];

  return `
    <div class="card page-card">
      <div class="section-kicker">${isBuyer ? "ACTIVIDAD DEL COMPRADOR" : "ACTIVIDAD DEL ORIGINADOR"}</div>
      <h2>${isBuyer ? "Mis ofertas" : "Ofertas recibidas"}</h2>
      <p>${isBuyer ? "Registra y consulta las ofertas creadas durante el testeo." : "Consulta las propuestas recibidas sobre tus portafolios de prueba."}</p>
      ${offers.length ? `
        <div class="table-wrap page-table"><table>
          <thead><tr><th>Oferta</th><th>Lote</th><th>${isBuyer ? "Valor" : "Comprador"}</th><th>${isBuyer ? "Porcentaje" : "Valor"}</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody>${offers.map(offer => `<tr><td><strong>${offer.id}</strong></td><td>${offer.lotId}</td><td>${isBuyer ? offer.amount : offer.buyer}</td><td>${isBuyer ? `${offer.percent}%` : offer.amount}</td><td><span class="badge badge-green">${offer.status}</span></td><td>${offer.date || "16 Sep 2026"}</td></tr>`).join("")}</tbody>
        </table></div>` : `
        <div class="page-placeholder"><strong>Aún no hay ofertas creadas</strong><span>Entra a Mercado, abre un lote y usa “Presentar oferta” para generar una oferta de prueba.</span></div>`}
    </div>`;
}

function renderTestCenter() {
  return `
    <div class="card page-card">
      <div class="section-kicker">QA · ENTORNO CONTROLADO</div>
      <h2>Centro de pruebas</h2>
      <p>Todo lo que aparece aquí es información ficticia. Puedes crear ofertas, navegar por roles y restaurar el escenario inicial.</p>
      <div class="test-banner">
        <div><strong>Modo demo activo</strong><span>Sin conexión a base de datos, pagos ni información real.</span></div>
        <span class="badge badge-gold">TEST DATA</span>
      </div>
      <div class="test-actions">
        <button class="btn btn-navy" onclick="runSelfTests(true)">Ejecutar pruebas</button>
        <button class="btn btn-ghost" onclick="resetDemoData()">Restaurar datos</button>
        <button class="btn btn-ghost" onclick="showToast('Estado guardado en localStorage.')">Ver persistencia</button>
      </div>
      <div id="test-results" class="test-results"></div>
      <div class="test-credentials">
        <div><strong>Originador demo</strong><span>originador@demo.b2gc.co</span><span>Demo123!</span></div>
        <div><strong>Comprador demo</strong><span>comprador@demo.b2gc.co</span><span>Demo123!</span></div>
      </div>
    </div>`;
}

function runSelfTests(showFeedback = true) {
  const results = [];
  const assert = (name, condition) => results.push({ name, ok: Boolean(condition) });

  assert("Existen 5 lotes de prueba", lots.length === 5);
  assert("Todos los lotes tienen ID único", new Set(lots.map(lot => lot.id)).size === lots.length);
  assert("Todos los lotes tienen valor nominal", lots.every(lot => lot.amount.includes("$")));
  assert("Todos los lotes tienen modalidad", lots.every(lot => lot.modality));
  assert("Simulador puede calcular un valor", Number.isFinite(parseLotAmount(lots[0])));
  assert("El estado de ofertas es un arreglo", Array.isArray(appState.offers));
  assert("Las cuentas demo están configuradas", Object.values(demoAccounts).every(account => account.password));
  assert("Existen documentos demo consultables", testDocuments.length >= 5);
  assert("Los documentos demo tienen contenido", testDocuments.every(doc => doc.name && doc.content));
  assert("Los archivos cargados se manejan como arreglo", Array.isArray(appState.uploadedDocuments));
  assert("Cada lote tiene perfil (obligaciones y cuenta regresiva)", lots.every(lot => lotProfiles[lot.id]));
  assert("La composición de tipos suma 100%", Math.abs(composition.tipos.reduce((s, t) => s + t[1], 0) - 1) < 0.001 && Math.abs(composition.tipos.reduce((s, t) => s + t[2], 0) - 1) < 0.001);

  const target = $("#test-results");
  if (target) {
    target.innerHTML = results.map(result => `
      <div class="test-result ${result.ok ? "pass" : "fail"}">
        <span>${result.ok ? "✓" : "×"}</span><strong>${result.name}</strong><small>${result.ok ? "OK" : "REVISAR"}</small>
      </div>`).join("");
  }

  const passed = results.filter(item => item.ok).length;
  if (showFeedback) showToast(`${passed}/${results.length} pruebas automáticas pasaron.`);
  return results;
}

/* =========================================================
   DETALLE DEL LOTE
   ========================================================= */
function openDetail(lotId) {
  const lot = lots.find(item => item.id === lotId);
  if (!lot) return;
  currentDetail = lot;

  const overlay = $("#detail-overlay");
  if (!overlay) return;
  overlay.classList.remove("hidden");

  if ($("#d-lot")) $("#d-lot").textContent = lot.id;
  if ($("#d-title")) $("#d-title").textContent = lot.title;

  renderDetailSummary(lot);
  renderSimulator(lot);
  renderDataRoom(lot);
  showTab("resumen");
}

function closeDetail() {
  const overlay = $("#detail-overlay");
  if (overlay) overlay.classList.add("hidden");
  currentDetail = null;
}

function renderDetailSummary(lot) {
  const panel = $("#tab-resumen");
  if (!panel) return;

  const p = profileOf(lot);
  const nominal = parseLotAmount(lot);
  const debtors = Number(String(lot.debtors).replace(/\./g, ""));
  const c = composition;

  const bars = (rows, total, unit) => rows.map(r => `
    <div class="report-bar-row">
      <span>${r[0]}</span>
      <div><i style="width:${r[1] * 100}%"></i></div>
      <strong>${fmtN(total * r[1])} ${unit} · ${(r[1] * 100).toFixed(0)}%</strong>
    </div>`).join("");

  const block = (title, body) => `
    <div style="margin-top:22px">
      <div class="section-kicker">${title}</div>
      <div class="report-bars" style="margin-top:10px">${body}</div>
    </div>`;

  panel.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
      ${detailMetric("Valor nominal", lot.amount)}
      ${detailMetric("Número de deudores", lot.debtors)}
      ${detailMetric("Número de obligaciones", fmtN(p.obligations))}
      ${detailMetric("Modalidad", lot.modality)}
    </div>

    <div style="margin-top:22px">
      <div class="section-kicker">DISTRIBUCIÓN POR TIPO DE CRÉDITO</div>
      <div class="table-wrap"><table><thead><tr>
        <th>Tipo</th><th># Obligaciones</th><th>Valor</th><th>Promedio de capital</th>
      </tr></thead><tbody>
        ${c.tipos.map(t => {
          const n = p.obligations * t[1], v = nominal * t[2];
          return `<tr><td><strong>${t[0]}</strong></td><td>${fmtN(n)}</td><td>${fmtM(v)}</td><td>${fmtM(v / n)}</td></tr>`;
        }).join("")}
      </tbody></table></div>
    </div>

    ${block("RANGOS DE MORA Y CASTIGO", bars(c.mora, p.obligations, "oblig."))}
    ${block("UBICACIÓN GEOGRÁFICA (CIUDAD)", bars(c.ciudades, p.obligations, "oblig."))}
    ${block("OBLIGACIONES POR RANGO DE CAPITAL", bars(c.rangos, p.obligations, "oblig."))}
    ${block("OBLIGACIONES POR CLIENTE", bars(c.obligPorCliente, debtors, "clientes"))}
    ${block("TIPO DE CLIENTE", bars(c.tipoCliente, debtors, "clientes"))}
    ${block("ESTADO DE SOPORTES Y LOCALIZACIÓN", c.soportes.map(s => `<div class="report-bar-row"><span>${s[0]}</span><div><i style="width:${s[1]}%"></i></div><strong>${s[1]}%</strong></div>`).join(""))}

    <div style="margin-top:25px;">
      <button class="btn btn-navy" onclick="makeOffer('${lot.id}')">
        ${currentRole === "comprador" ? "Presentar oferta" : "Gestionar operación"}
      </button>
    </div>`;
}

function detailMetric(label, value) {
  return `
    <div style="padding:20px;border-radius:15px;background:white;border:1px solid var(--line);">
      <div style="color:var(--muted-2);font-size:9px;text-transform:uppercase;font-family:'IBM Plex Mono';">${label}</div>
      <div style="margin-top:5px;color:var(--navy);font-size:20px;font-weight:800;">${value}</div>
    </div>`;
}

/* =========================================================
   SIMULADOR (acepta decimales, paso 0,1)
   ========================================================= */
function renderSimulator(lot) {
  const panel = $("#tab-simulador");
  if (!panel) return;

  panel.innerHTML = `
    <div class="simulator-container">
      <div class="simulator-header">
        <div>
          <div class="section-kicker">ANÁLISIS FINANCIERO</div>
          <h3>Simulador de oferta</h3>
          <p>Analiza diferentes escenarios de compra y visualiza cómo cambia el valor de tu oferta.</p>
        </div>
        <div class="simulator-lot"><span>${lot.id}</span><strong>${lot.type}</strong></div>
      </div>

      <div class="simulator-top">
        <div class="simulator-control-card">
          <div class="simulator-label">Porcentaje sobre valor nominal</div>
          <div class="percent-input-row">
            <input id="offer-percent" type="range" min="0.1" max="100" step="0.1" value="82" oninput="updateSimulator('${lot.id}')">
            <div class="percent-number">
              <input id="offer-percent-number" type="number" min="0.1" max="100" step="0.1" value="82" oninput="updateSimulator('${lot.id}')">
              <span>%</span>
            </div>
          </div>
          <div class="range-labels"><span>0,1%</span><span>50%</span><span>100%</span></div>
        </div>

        <div class="simulator-main-value">
          <div class="metric-caption">VALOR ESTIMADO DE OFERTA</div>
          <div class="simulator-price" id="simulated-value">$0 M</div>
          <div class="simulator-price-sub" id="simulated-discount">Calculando...</div>
        </div>
      </div>

      <div class="simulator-kpis">
        <div class="simulator-kpi"><div class="simulator-kpi-icon">◈</div><div><span>Valor nominal</span><strong id="sim-nominal">$0 M</strong></div></div>
        <div class="simulator-kpi"><div class="simulator-kpi-icon">↘</div><div><span>Descuento</span><strong id="sim-discount">0%</strong></div></div>
        <div class="simulator-kpi"><div class="simulator-kpi-icon">◎</div><div><span>Ahorro estimado</span><strong id="sim-saving">$0 M</strong></div></div>
        <div class="simulator-kpi"><div class="simulator-kpi-icon">%</div><div><span>Precio de compra</span><strong id="sim-price-percent">82%</strong></div></div>
      </div>

      <div class="simulator-charts">
        <div class="chart-card simulator-chart-main">
          <div class="chart-card-header">
            <div><div class="chart-kicker">VALOR DE OPERACIÓN</div><h4>Nominal vs. oferta</h4></div>
            <div class="chart-legend">
              <span><i class="legend-dot nominal"></i> Nominal</span>
              <span><i class="legend-dot offer"></i> Oferta</span>
            </div>
          </div>
          <div class="comparison-chart">
            <div class="comparison-grid"><div class="grid-line"></div><div class="grid-line"></div><div class="grid-line"></div><div class="grid-line"></div><div class="grid-line"></div></div>
            <div class="comparison-bars">
              <div class="comparison-column">
                <div class="bar-value" id="nominal-bar-value">$0 M</div>
                <div class="comparison-bar nominal-bar" style="height:100%"></div>
                <span>Valor nominal</span>
              </div>
              <div class="comparison-column">
                <div class="bar-value" id="offer-bar-value">$0 M</div>
                <div class="comparison-bar offer-bar" id="offer-bar" style="height:82%"></div>
                <span>Tu oferta</span>
              </div>
            </div>
          </div>
        </div>

        <div class="chart-card simulator-chart-side">
          <div class="chart-card-header"><div><div class="chart-kicker">ESTRUCTURA</div><h4>Precio de compra</h4></div></div>
          <div class="donut-wrapper">
            <div class="donut-chart" id="sim-donut">
              <div class="donut-center"><strong id="donut-percent">82%</strong><span>del nominal</span></div>
            </div>
          </div>
          <div class="donut-info">
            <div><span class="donut-indicator offer"></span><span>Precio de compra</span><strong id="donut-offer">$0 M</strong></div>
            <div><span class="donut-indicator remaining"></span><span>Diferencia</span><strong id="donut-saving">$0 M</strong></div>
          </div>
        </div>
      </div>

      <div class="chart-card sensitivity-card">
        <div class="chart-card-header">
          <div>
            <div class="chart-kicker">ANÁLISIS DE ESCENARIOS</div>
            <h4>Sensibilidad de la oferta</h4>
            <p>Compara rápidamente cuánto pagarías según diferentes porcentajes de adquisición.</p>
          </div>
        </div>
        <div class="sensitivity-chart" id="sensitivity-chart"></div>
      </div>
    </div>`;

  updateSimulator(lot.id);
}

function updateSimulator(lotId) {
  const lot = lots.find(item => item.id === lotId);
  if (!lot) return;

  const range = $("#offer-percent");
  const number = $("#offer-percent-number");
  if (!range || !number) return;

  const typing = document.activeElement === number;
  let percentage = Number(typing ? number.value : range.value);
  if (!percentage || percentage < 0.1) percentage = 0.1;
  if (percentage > 100) percentage = 100;

  range.value = percentage;
  if (!typing) number.value = percentage; // no pisar lo que la persona está escribiendo (ej. "82.")

  const shown = +percentage.toFixed(1);
  const numericValue = parseLotAmount(lot);
  const offerValue = numericValue * (percentage / 100);
  const saving = numericValue - offerValue;
  const discount = 100 - percentage;
  const discountText = +discount.toFixed(1);

  const setText = (sel, text) => { const el = $(sel); if (el) el.textContent = text; };

  setText("#simulated-value", fmtM(offerValue));
  setText("#simulated-discount", `${discountText}% por debajo del valor nominal`);
  setText("#sim-nominal", fmtM(numericValue));
  setText("#sim-discount", `${discountText}%`);
  setText("#sim-saving", fmtM(saving));
  setText("#sim-price-percent", `${shown}%`);
  setText("#nominal-bar-value", fmtM(numericValue));
  setText("#offer-bar-value", fmtM(offerValue));
  setText("#donut-percent", `${shown}%`);
  setText("#donut-offer", fmtM(offerValue));
  setText("#donut-saving", fmtM(saving));

  const offerBar = $("#offer-bar");
  if (offerBar) offerBar.style.height = `${percentage}%`;

  const donut = $("#sim-donut");
  if (donut) {
    const angle = percentage * 3.6;
    donut.style.background = `conic-gradient(var(--blue) 0deg ${angle}deg, #e8edf5 ${angle}deg 360deg)`;
  }

  renderSensitivityChart(numericValue, percentage);
}

function renderSensitivityChart(nominalValue, selectedPercentage) {
  const container = $("#sensitivity-chart");
  if (!container) return;

  const scenarios = [60, 65, 70, 75, 80, 85, 90, 95];
  container.innerHTML = scenarios.map(percent => {
    const selected = Math.abs(percent - selectedPercentage) < 0.05;
    return `
      <div class="sensitivity-column ${selected ? "selected" : ""}" onclick="selectSensitivity(${percent})">
        <div class="sensitivity-value">${percent}%</div>
        <div class="sensitivity-track"><div class="sensitivity-bar" style="height:${percent}%"></div></div>
        <div class="sensitivity-label">${percent}%</div>
      </div>`;
  }).join("");
}

function selectSensitivity(percent) {
  const range = $("#offer-percent");
  const number = $("#offer-percent-number");
  if (range) range.value = percent;
  if (number) number.value = percent;
  if (currentDetail) updateSimulator(currentDetail.id);
}

/* =========================================================
   DATA ROOM
   ========================================================= */
function renderDataRoom(lot) {
  const panel = $("#tab-dataroom");
  if (!panel) return;

  const docs = testDocuments.filter(doc => !lot || doc.lotId === lot.id || doc.lotId === "LOTE-TEST-001");
  panel.innerHTML = `
    <div class="dataroom-panel-head">
      <div>
        <div class="section-kicker">DATA ROOM · ${lot?.id || "DEMO"}</div>
        <h3>Documentos disponibles</h3>
        <p>Archivos ficticios para revisar el flujo de due diligence.</p>
      </div>
      <div class="documents-head-actions">
        <input id="document-upload-input" type="file" class="hidden-file-input" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg" onchange="handleDocumentUpload(event)">
        <button class="btn btn-navy btn-small" type="button" onclick="triggerDocumentUpload(null,'${lot?.id || ""}')">↑ Subir archivo</button>
        <button class="btn btn-ghost btn-small" type="button" onclick="closeDetail();navigate(null,'dataroom')">Gestionar</button>
      </div>
    </div>
    <div class="document-list">
      ${docs.map(doc => `
        <div class="document-row document-row-enhanced">
          <div class="document-main">
            <div class="document-icon test">${escapeHtml(doc.type)}</div>
            <div class="document-info"><strong>${escapeHtml(doc.name)}</strong><span>${escapeHtml(doc.category)} · ${escapeHtml(doc.size)}</span></div>
          </div>
          <div class="document-actions">
            <button class="btn btn-ghost btn-small" type="button" onclick="openDocumentViewer('${doc.id}')">Ver</button>
            <button class="btn btn-blue-soft btn-small" type="button" onclick="downloadDocument('${doc.id}')">Descargar</button>
          </div>
        </div>`).join("")}
    </div>`;
}

function showTab(tabName) {
  $$(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.tab === tabName));
  $$(".tab-panel").forEach(panel => panel.classList.add("hidden"));
  const selected = $(`#tab-${tabName}`);
  if (selected) selected.classList.remove("hidden");
}

/* =========================================================
   OFERTAS (acepta decimales)
   ========================================================= */
function makeOffer(lotId) {
  const lot = lots.find(item => item.id === lotId);
  if (!lot) return;

  if (currentRole !== "comprador") {
    showToast("La presentación de ofertas está disponible para compradores.");
    return;
  }

  $("#offer-overlay")?.remove();
  const numericValue = parseLotAmount(lot);

  const overlay = document.createElement("div");
  overlay.id = "offer-overlay";
  overlay.className = "offer-overlay";
  overlay.innerHTML = `
    <div class="offer-modal">
      <button class="detail-close" type="button" aria-label="Cerrar" onclick="closeOfferModal()">×</button>
      <div class="section-kicker">NUEVA OFERTA · DEMO</div>
      <h2>Presentar oferta</h2>
      <p>${lot.id} · ${lot.title}</p>
      <div class="offer-summary"><span>Valor nominal</span><strong>${lot.amount}</strong></div>
      <label class="offer-field"><span>Porcentaje de compra</span>
        <input id="offer-form-percent" type="number" min="0.1" max="100" step="0.1" value="82">
      </label>
      <label class="offer-field"><span>Comentario</span>
        <textarea id="offer-form-note" rows="3" placeholder="Comentario opcional para esta prueba"></textarea>
      </label>
      <div class="offer-preview"><span>Valor estimado</span><strong id="offer-form-value">$0 M</strong></div>
      <div class="offer-actions">
        <button class="btn btn-ghost" onclick="closeOfferModal()">Cancelar</button>
        <button class="btn btn-navy" onclick="submitOffer('${lot.id}')">Guardar oferta</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const input = $("#offer-form-percent");
  const updatePreview = () => {
    const percent = Math.min(100, Math.max(0.1, Number(input?.value) || 0.1));
    const output = $("#offer-form-value");
    if (output) output.textContent = fmtM(numericValue * percent / 100);
  };
  input?.addEventListener("input", updatePreview);
  updatePreview();
  input?.focus();
}

function submitOffer(lotId) {
  const lot = lots.find(item => item.id === lotId);
  const percent = Math.min(100, Math.max(0.1, Number($("#offer-form-percent")?.value) || 0));
  const note = ($("#offer-form-note")?.value || "").trim();

  if (!lot || !percent) { showToast("Ingresa un porcentaje válido."); return; }

  const offerValue = parseLotAmount(lot) * percent / 100;
  const offer = {
    id: `OF-TEST-${String(appState.offers.length + 1).padStart(3, "0")}`,
    lotId: lot.id,
    amount: fmtM(offerValue),
    percent: +percent.toFixed(1),
    note,
    status: "Enviada",
    date: new Date().toLocaleDateString("es-CO"),
    buyer: appState.company || "Comprador Demo S.A.S.",
    submittedByRole: currentRole
  };

  appState.offers.unshift(offer);
  saveDemoState();
  closeOfferModal();
  closeDetail();
  showToast(`Oferta ${offer.id} guardada en el entorno demo.`);
}

function closeOfferModal() { $("#offer-overlay")?.remove(); }

/* =========================================================
   TOAST Y ANIMACIONES
   ========================================================= */
function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function initReveal() {
  const elements = $$(".reveal");
  if (!elements.length) return;

  if (!("IntersectionObserver" in window)) {
    elements.forEach(element => element.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .12 });

  elements.forEach(element => observer.observe(element));
}

/* =========================================================
   EVENTOS GLOBALES
   ========================================================= */
document.addEventListener("click", event => {
  const authOverlay = $("#auth-overlay");
  if (authOverlay && event.target === authOverlay) closeAuth();

  const detailOverlay = $("#detail-overlay");
  if (detailOverlay && event.target === detailOverlay) closeDetail();

  const offerOverlay = $("#offer-overlay");
  if (offerOverlay && event.target === offerOverlay) closeOfferModal();

  const documentViewer = $("#document-viewer-overlay");
  if (documentViewer && event.target === documentViewer) closeDocumentViewer();
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  closeAuth();
  closeDetail();
  closeOfferModal();
  closeDocumentViewer();
});

document.addEventListener("DOMContentLoaded", () => {
  buildSidebar();
  initReveal();

  if (appState.loggedIn) {
    $("#public-site")?.classList.add("hidden");
    $("#app-shell")?.classList.remove("hidden");
    setRole(currentRole);
  }
});
