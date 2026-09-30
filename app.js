/* =========================================================
   B²GC BROKERS — APP.JS (v3)
   Rol "Vendedor" + estado de lote derivado de startsAt/endsAt
   ========================================================= */

let currentAuthMode = "login";
let currentRole = "vendedor";
let currentDetail = null;
let toastTimer = null;
let countdownTimer = null;

const DEMO_STORAGE_KEY = "b2gc_demo_state_v3";
const USERS_KEY = "b2gc_users";
const MAX_UPLOAD = 400 * 1024; // localStorage ~5 MB y base64 pesa ~33% más

const demoAccounts = {
  vendedor: { email: "vendedor@demo.b2gc.co", password: "Demo123!", company: "Vendedor Demo S.A.S.", avatar: "VD" },
  comprador: { email: "comprador@demo.b2gc.co", password: "Demo123!", company: "Comprador Demo S.A.S.", avatar: "CD" }
};

const appState = {
  loggedIn: false,
  company: demoAccounts.vendedor.company,
  avatar: "VD",
  userEmail: demoAccounts.vendedor.email,
  offers: [],
  uploadedDocuments: []
};

/* ===== Constantes demo ===== */
const TRM_DEMO = 3950; // reemplazar por TRM oficial con backend
const DAY = 864e5;
const SOLD_DEMO = 3977; // M COP
const NOW = Date.now();
const SELLER_NAME = "Vendedor Demo S.A.S.";

/* ===== Lotes: una sola fuente de verdad (el estado se deriva de startsAt/endsAt) ===== */
const lots = [
  { id: "LOTE-TEST-001", title: "Cartera de consumo — Demo", seller: SELLER_NAME, mine: true, type: "Consumo", amount: "$4.850 M", discount: "18%", debtors: "2.840", modality: "Subasta privada", score: "A+", obligations: 6120, likes: 128, favs: 41, comments: 17, offers: 6, bestPercent: 82, startsAt: NOW - 2 * DAY, endsAt: NOW + 9 * DAY },
  { id: "LOTE-TEST-002", title: "Cartera libranza — Demo", seller: SELLER_NAME, mine: true, type: "Libranza", amount: "$3.240 M", discount: "15%", debtors: "1.460", modality: "Compra directa", score: "A", obligations: 3010, likes: 76, favs: 22, comments: 9, offers: 4, bestPercent: 85, startsAt: NOW - 5 * DAY, endsAt: NOW + 12 * DAY },
  { id: "LOTE-TEST-003", title: "Cartera comercial — Demo", seller: SELLER_NAME, mine: true, type: "Comercial", amount: "$6.780 M", discount: "22%", debtors: "860", modality: "Híbrida", score: "B+", obligations: 1930, likes: 54, favs: 15, comments: 6, offers: 3, bestPercent: 74, startsAt: NOW + 6 * DAY, endsAt: NOW + 15 * DAY },
  { id: "LOTE-TEST-004", title: "Cartera hipotecaria — Demo", seller: "Entidad Financiera Demo D", mine: false, type: "Hipotecaria", amount: "$8.920 M", discount: "12%", debtors: "420", modality: "Subasta privada", score: "A+", obligations: 980, likes: 33, favs: 10, comments: 3, offers: 2, bestPercent: 88, startsAt: NOW + 8 * DAY, endsAt: NOW + 18 * DAY },
  { id: "LOTE-TEST-005", title: "Cartera pyme — Demo", seller: "Entidad Financiera Demo E", mine: false, type: "PYME", amount: "$2.160 M", discount: "20%", debtors: "315", modality: "Compra directa", score: "A", obligations: 720, likes: 21, favs: 7, comments: 2, offers: 1, bestPercent: 80, startsAt: NOW - 1 * DAY, endsAt: NOW + 20 * DAY }
];
const sellerLots = lots.filter(l => l.mine);
const buyerOpportunities = lots;
const profileOf = lot => lot;
const lotById = id => lots.find(l => l.id === id);

function lotStatus(lot) {
  const t = Date.now();
  if (t >= lot.endsAt) return { text: "Cerrada", cls: "badge-gold" };
  if (lot.modality === "Compra directa") return { text: "En negociación", cls: "badge-blue" };
  if (t < lot.startsAt) return { text: "Data room abierto", cls: "badge-blue" };
  return { text: "Subasta abierta", cls: "badge-green" };
}
const isOpen = lot => lotStatus(lot).text !== "Cerrada";
const fmtDate = ms => new Date(ms).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
const statusBadge = lot => { const s = lotStatus(lot); return `<span class="badge ${s.cls}">${s.text}</span>`; };

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
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ offers: appState.offers, uploadedDocuments: appState.uploadedDocuments }));
    return true;
  } catch (error) {
    console.warn("No fue posible guardar el estado demo.", error);
    return false;
  }
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

/* ===== Utilidades ===== */
const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);
const fmtN = n => Math.round(n).toLocaleString("es-CO");
const fmtM = n => "$" + n.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " M";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function parseLotAmount(lot) {
  return Number(String(lot.amount).replace("$", "").replace(/\./g, "").replace(",", ".").replace(" M", ""));
}

const currentPageKey = () => (document.querySelector("#page-h1")?.textContent === "Data room" ? "dataroom" : "documentos");

/* ===== Cuenta regresiva (auto: antes de startsAt → inicio; después → cierre) ===== */
function fmtCountdown(ms) {
  if (ms <= 0) return "Finalizado";
  const d = Math.floor(ms / DAY), h = Math.floor(ms % DAY / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3);
  const p = n => String(n).padStart(2, "0");
  return `${d}d ${p(h)}h ${p(m)}m ${p(s)}s`;
}

function countdownFor(lot, kind) {
  if (kind === "auto") kind = Date.now() < lot.startsAt ? "inicio" : "cierre";
  return { kind, text: fmtCountdown((kind === "inicio" ? lot.startsAt : lot.endsAt) - Date.now()) };
}

function tickCountdowns() {
  const els = $$("[data-cd]");
  if (!els.length) { clearInterval(countdownTimer); countdownTimer = null; return; }
  els.forEach(el => {
    const [id, kind] = el.dataset.cd.split("|");
    const lot = lotById(id);
    if (!lot) return;
    const cd = countdownFor(lot, kind);
    el.textContent = cd.text;
    if (el.id === "cd-main" && kind === "auto") {
      const label = $("#cd-label");
      if (label) label.textContent = cd.kind === "inicio" ? "Tiempo para inicio de subasta" : "Tiempo para cierre de subasta";
    }
  });
}

function startCountdowns() {
  clearInterval(countdownTimer);
  tickCountdowns();
  countdownTimer = setInterval(tickCountdowns, 1000);
}

function toggleCountdown() {
  const el = $("#cd-main");
  if (!el) return;
  const [id, kind] = el.dataset.cd.split("|");
  const lot = lotById(id);
  const current = kind === "auto" ? countdownFor(lot, "auto").kind : kind;
  el.dataset.cd = `${id}|${current === "inicio" ? "cierre" : "inicio"}`;
  const label = $("#cd-label");
  if (label) label.textContent = current === "inicio" ? "Tiempo para cierre de subasta" : "Tiempo para inicio de subasta";
  tickCountdowns();
}

/* ===== Preferencias de aviso (solo guarda la preferencia) ===== */
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
   AUTENTICACIÓN (demo: contraseñas en localStorage, NO usar en producción)
   ========================================================= */
function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); } catch { return []; }
}

function openAuth(mode = "login") {
  currentAuthMode = mode;
  const overlay = $("#auth-overlay");
  if (!overlay) return;
  overlay.classList.remove("hidden");

  const register = mode === "register";
  $("#auth-title").textContent = register ? "Crear cuenta" : "Iniciar sesión";
  $("#auth-sub").textContent = register ? "Registra tu empresa y comienza a operar en B²GC Brokers." : "Accede a tu cuenta de B²GC Brokers.";
  $("#auth-submit").textContent = register ? "Crear cuenta →" : "Entrar a la plataforma →";
  $("#auth-company-field").classList.toggle("hidden", !register);
  $("#demo-credentials").classList.toggle("hidden", register);
  $("#auth-switch").innerHTML = register
    ? '¿Ya tienes una cuenta? <button type="button" class="btn-text" onclick="openAuth(\'login\')">Inicia sesión</button>'
    : '¿Aún no tienes cuenta? <button type="button" class="btn-text" onclick="openAuth(\'register\')">Regístrate</button>';

  if (register) { $("#auth-email").value = ""; $("#auth-password").value = ""; }
  else if (!$("#auth-email").value) { $("#auth-email").value = demoAccounts[currentRole].email; $("#auth-password").value = demoAccounts[currentRole].password; }

  setTimeout(() => $(register ? "#auth-company" : "#auth-email")?.focus(), 150);
}

function closeAuth() { $("#auth-overlay")?.classList.add("hidden"); }

function pickRole(element, role) {
  currentRole = role;
  $$(".role-opt").forEach(item => item.classList.remove("active"));
  element?.classList.add("active");
  if (currentAuthMode === "login") {
    $("#auth-email").value = demoAccounts[role].email;
    $("#auth-password").value = demoAccounts[role].password;
  }
}

function submitAuth() { currentAuthMode === "register" ? registerUser() : enterApp(); }

function registerUser() {
  const company = $("#auth-company").value.trim();
  const email = $("#auth-email").value.trim().toLowerCase();
  const password = $("#auth-password").value;
  if (!company) return showToast("Ingresa el nombre de tu empresa.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return showToast("Ingresa un correo válido.");
  if (password.length < 8) return showToast("La contraseña debe tener mínimo 8 caracteres.");

  const users = getUsers();
  if (users.some(u => u.email === email) || Object.values(demoAccounts).some(a => a.email === email)) return showToast("Ese correo ya está registrado.");
  users.push({ email, password, company, role: currentRole });
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch { return showToast("No fue posible guardar el registro."); }

  showToast("Cuenta creada. Ya puedes iniciar sesión.");
  $("#auth-password").value = "";
  openAuth("login");
  $("#auth-email").value = email;
}

function enterApp() {
  const emailValue = $("#auth-email").value.trim().toLowerCase();
  const passwordValue = $("#auth-password").value;
  if (!emailValue) { showToast("Ingresa tu correo corporativo."); return; }
  if (!passwordValue) { showToast("Ingresa tu contraseña."); return; }

  const demo = demoAccounts[currentRole];
  const user = getUsers().find(u => u.email === emailValue && u.password === passwordValue && u.role === currentRole);
  let account = null;
  if (emailValue === demo.email && passwordValue === demo.password) account = demo;
  else if (user) account = { company: user.company, avatar: user.company.slice(0, 2).toUpperCase() };

  if (!account) { showToast(`Credenciales incorrectas. Demo: ${demo.email} / ${demo.password}`); return; }

  appState.loggedIn = true;
  appState.userEmail = emailValue;
  appState.company = account.company;
  appState.avatar = account.avatar;

  closeAuth();
  $("#public-site")?.classList.add("hidden");
  $("#app-shell")?.classList.remove("hidden");
  setRole(currentRole);
  showToast(currentRole === "vendedor" ? "Bienvenido como vendedor." : "Bienvenido como comprador.");
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
  // Cambiar de rol con un usuario propio conserva su empresa; en demo usa la cuenta demo del rol
  const isDemoUser = Object.values(demoAccounts).some(a => a.email === appState.userEmail);
  if (isDemoUser || role !== currentRole) {
    appState.company = demoAccounts[role].company;
    appState.avatar = demoAccounts[role].avatar;
  }
  $("#company-name").textContent = appState.company;
  $(".avatar").textContent = appState.avatar;
  $("#rt-vendedor")?.classList.toggle("active", role === "vendedor");
  $("#rt-comprador")?.classList.toggle("active", role === "comprador");
  $("#page-h1").textContent = "Dashboard";
  buildSidebar();
  renderDashboard();
}

function buildSidebar() {
  const nav = $("#sidebar-nav");
  if (!nav) return;
  const link = (page, icon, label, active) => `<a href="#" ${active ? 'class="active"' : ""} onclick="navigate(event,'${page}')"><span>${icon}</span> ${label}</a>`;

  if (currentRole === "vendedor") {
    nav.innerHTML =
      link("dashboard", "▦", "Dashboard", true) + link("cartera", "◫", "Mis carteras") + link("oportunidades", "◇", "Interés de compradores") +
      link("negociaciones", "⇄", "Negociaciones") + link("documentos", "□", "Documentos y cierre") + link("reportes", "▥", "Reportes") + link("pruebas", "✓", "Pruebas") +
      `<div class="sidebar-market-status"><div class="status-title">Mercado activo</div><p>47 compradores conectados</p></div>`;
  } else {
    nav.innerHTML =
      link("dashboard", "▦", "Dashboard", true) + link("mercado", "◇", "Mercado") + link("ofertas", "⇄", "Mis ofertas") +
      link("adjudicaciones", "✓", "Adjudicaciones") + link("dataroom", "□", "Data room") + link("reportes", "▥", "Reportes") + link("pruebas", "✓", "Pruebas") +
      `<div class="sidebar-market-status"><div class="status-title">Mercado activo</div><p>${lots.filter(isOpen).length} oportunidades disponibles</p></div>`;
  }
}

function navigate(event, page) {
  if (event) event.preventDefault();
  $$("#sidebar-nav a").forEach(l => l.classList.remove("active"));
  event?.currentTarget?.classList.add("active");

  const titles = {
    dashboard: "Dashboard", cartera: "Mis carteras", oportunidades: "Oportunidades", negociaciones: "Negociaciones",
    documentos: "Documentos", reportes: "Reportes", mercado: "Mercado de oportunidades", ofertas: "Mis ofertas",
    adjudicaciones: "Adjudicaciones", dataroom: "Data room", pruebas: "Centro de pruebas"
  };
  $("#page-h1").textContent = titles[page] || "Dashboard";
  if (page === "dashboard") renderDashboard(); else renderPage(page);
}

/* =========================================================
   DASHBOARD
   ========================================================= */
function renderDashboard() {
  const content = $("#content");
  if (!content) return;
  const isSeller = currentRole === "vendedor";
  const buyerKpis = [
    ["Oportunidades disponibles", String(lots.filter(isOpen).length), "↗ 7 nuevas hoy"],
    ["Ofertas realizadas", String(appState.offers.length), "↗ +3 esta semana"],
    ["Adjudicaciones", "8", "↗ +2 este mes"],
    ["Tasa de cierre", "76%", "↗ +3.8 puntos"]
  ];

  content.innerHTML = `
    <div class="dashboard-welcome reveal visible">
      <div style="margin-bottom:25px;">
        <div class="section-kicker">${isSeller ? "VISTA GENERAL DEL VENDEDOR" : "VISTA GENERAL DEL COMPRADOR"}</div>
        <h2 style="font-size:30px;letter-spacing:-1px;color:var(--navy);margin-top:5px;">${isSeller ? "Controla tu cartera y tus procesos de venta." : "Encuentra, analiza y oferta en nuevas oportunidades."}</h2>
        <p style="color:var(--muted);font-size:13px;margin-top:5px;">${isSeller ? "Publica portafolios, gestiona subastas, revisa ofertas y acompaña el cierre documental." : "Explora cartera disponible, revisa data rooms, presenta ofertas y haz seguimiento a tus adjudicaciones."}</p>
      </div>
      <div class="kpi-grid">${isSeller ? renderSellerKpis() : buyerKpis.map(k => kpiCard(k[0], k[1], k[2])).join("")}</div>
      ${isSeller ? renderSellerCharts() : renderDashboardCharts("comprador")}
      ${renderLotsCard()}
    </div>`;

  initReveal();
  startCountdowns();
}

function kpiCard(label, value, change, direction = "up") {
  return `<div class="kpi-card"><div class="label">${label}</div><div class="value">${value}</div><div class="change ${direction === "down" ? "down" : ""}">${change}</div></div>`;
}

function renderSellerKpis() {
  const total = sellerLots.reduce((s, l) => s + parseLotAmount(l), 0);
  const usd = total * 1e6 / TRM_DEMO;
  const featured = sellerLots.find(l => lotStatus(l).text === "Subasta abierta") || sellerLots[0];
  const sum = key => sellerLots.reduce((s, l) => s + l[key], 0);
  const best = sellerLots.map(l => ({ lot: l, p: l.bestPercent })).sort((a, b) => b.p - a.p)[0];
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
      <div class="value">${fmtN(sum("likes") + sum("favs") + sum("comments"))}</div>
      <div class="change" style="color:var(--muted)">♥ ${fmtN(sum("likes"))} likes · ★ ${fmtN(sum("favs"))} favoritos · ✎ ${fmtN(sum("comments"))} comentarios</div>
    </div>
    <div class="kpi-card">
      <div class="label">Mejor oferta actual · ${best.lot.id}</div>
      <div class="value">${fmtM(bestValue)} <small style="font-size:13px;color:var(--blue)">${best.p}%</small></div>
      <div class="change">Vendido ${fmtM(SOLD_DEMO)} de ${fmtM(total)} (${(SOLD_DEMO / total * 100).toFixed(1)}%) · ${sum("offers")} ofertas</div>
    </div>
    <div class="kpi-card" style="cursor:pointer" onclick="toggleCountdown()" title="Clic para alternar inicio ⇄ cierre">
      <div class="label"><span id="cd-label">Tiempo para cierre de subasta</span> ⇄</div>
      <div class="value" id="cd-main" data-cd="${featured.id}|auto" style="font-size:20px">—</div>
      <div class="change" style="color:var(--muted)" onclick="event.stopPropagation()">
        Avisar por:
        <label><input type="checkbox" ${n.sms ? "checked" : ""} onchange="setNotif('sms',this.checked)"> SMS</label>
        <label><input type="checkbox" ${n.wa ? "checked" : ""} onchange="setNotif('wa',this.checked)"> WA</label>
        <label><input type="checkbox" ${n.mail ? "checked" : ""} onchange="setNotif('mail',this.checked)"> Mail</label>
      </div>
    </div>`;
}

function renderSellerCharts() {
  const donut = [["Consumo", 42], ["Libranza", 28], ["Comercial", 18], ["Hipotecaria", 12]];
  const statuses = [["En mercado", sellerLots.filter(isOpen).length * 12, "active"], ["En negociación", 18, "negotiation"], ["Cerradas", 72, "completed"]];
  const max = Math.max(...statuses.map(s => s[1]));
  return `
    <div class="dashboard-chart-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <div class="dashboard-chart-card">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">TU PORTAFOLIO</div><h3>Distribución por tipo</h3></div></div>
        <div class="portfolio-donut-wrap"><div class="portfolio-donut role-vendedor"><div class="portfolio-donut-center"><strong>126</strong><span>operaciones</span></div></div></div>
        <div class="portfolio-legend">${donut.map((d, i) => `<div><i class="legend-${i}"></i><span>${d[0]}</span><strong>${d[1]}%</strong></div>`).join("")}</div>
      </div>
      <div class="dashboard-chart-card">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">SEGUIMIENTO</div><h3>Estado de tus operaciones</h3></div></div>
        <div class="status-summary">${statuses.map(s => `<div class="status-row"><div class="status-name"><span class="status-dot ${s[2]}"></span>${s[0]}</div><strong>${s[1]}</strong></div><div class="status-progress"><span style="width:${s[1] / max * 100}%"></span></div>`).join("")}</div>
      </div>
    </div>`;
}

function renderDashboardCharts(role) {
  const values = [10800, 11600, 12150, 13400, 14200, 15100, 15950];
  const donut = [["Consumo", 34], ["Libranza", 27], ["Comercial", 23], ["Hipotecaria", 16]];
  const statuses = [["Disponibles", lots.filter(isOpen).length, "active"], ["Con oferta", appState.offers.length, "negotiation"], ["Adjudicadas", 8, "completed"]];
  const points = values.map((v, i) => [(700 / (values.length - 1)) * i, 245 - (v / 20000) * 205]);
  const linePath = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L700,260 L0,260 Z`;
  const months = ["Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep"];
  const maxStatus = Math.max(1, ...statuses.map(s => s[1]));
  const last = points[points.length - 1];

  return `
    <div class="dashboard-chart-grid">
      <div class="dashboard-chart-card dashboard-chart-large">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">MERCADO PARA TI</div><h3>Valor de oportunidades</h3><p>Valor nominal de las oportunidades que puedes analizar</p></div><div class="chart-period">Mar — Sep 2026</div></div>
        <div class="line-chart">
          <div class="line-chart-y"><span>20.000 M</span><span>15.000 M</span><span>10.000 M</span><span>5.000 M</span><span>0</span></div>
          <div class="line-chart-area"><div class="chart-lines"><span></span><span></span><span></span><span></span><span></span></div>
            <svg viewBox="0 0 700 260" preserveAspectRatio="none" class="market-line-svg" aria-label="Valor de oportunidades">
              <defs><linearGradient id="marketGradient-${role}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-opacity=".22"/><stop offset="100%" stop-opacity="0"/></linearGradient></defs>
              <path class="market-area" fill="url(#marketGradient-${role})" d="${areaPath}"></path>
              <path class="market-line" d="${linePath}"></path>
              <circle cx="${last[0]}" cy="${last[1]}" r="6" class="chart-current-point"></circle>
            </svg>
            <div class="line-chart-x">${months.map(m => `<span>${m}</span>`).join("")}</div>
          </div>
        </div>
      </div>
      <div class="dashboard-chart-card">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">MERCADO DISPONIBLE</div><h3>Tipos de oportunidad</h3></div></div>
        <div class="portfolio-donut-wrap"><div class="portfolio-donut role-${role}"><div class="portfolio-donut-center"><strong>${lots.filter(isOpen).length}</strong><span>oportunidades</span></div></div></div>
        <div class="portfolio-legend">${donut.map((d, i) => `<div><i class="legend-${i}"></i><span>${d[0]}</span><strong>${d[1]}%</strong></div>`).join("")}</div>
      </div>
      <div class="dashboard-chart-card">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">ACTIVIDAD</div><h3>Actividad de compras</h3></div></div>
        <div class="activity-chart">${renderActivityBars()}</div>
      </div>
      <div class="dashboard-chart-card">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">SEGUIMIENTO</div><h3>Tu pipeline de compra</h3></div></div>
        <div class="status-summary">${statuses.map(s => `<div class="status-row"><div class="status-name"><span class="status-dot ${s[2]}"></span>${s[0]}</div><strong>${s[1]}</strong></div><div class="status-progress"><span style="width:${Math.min(100, s[1] / maxStatus * 100)}%"></span></div>`).join("")}</div>
      </div>
    </div>`;
}

function renderActivityBars() {
  const values = [38, 46, 58, 52, 70, 64, 84];
  const labels = ["Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep"];
  return values.map((v, i) => `<div class="activity-column"><div class="activity-value" style="height:${v}%"></div><span>${labels[i]}</span></div>`).join("");
}

function renderLotsCard() {
  if (currentRole === "vendedor") {
    return `
      <div class="card">
        <div class="card-header"><div><h3>Mis portafolios y operaciones</h3><p>Detalle completo dentro de cada lote</p></div>
          <button class="btn btn-ghost btn-small" onclick="navigate(event,'cartera')">Ver todo</button></div>
        <div class="table-wrap"><table><thead><tr><th>Lote</th><th>Valor</th><th>Mejor oferta</th><th>Cuenta regresiva</th><th>Modalidad</th><th>Estado</th><th></th></tr></thead><tbody>
          ${sellerLots.map(lot => `<tr>
            <td><strong style="color:var(--navy);">${lot.id}</strong></td>
            <td><strong>${lot.amount}</strong></td>
            <td>${fmtM(parseLotAmount(lot) * lot.bestPercent / 100)} · ${lot.bestPercent}%</td>
            <td data-cd="${lot.id}|auto">—</td>
            <td>${lot.modality}</td>
            <td>${statusBadge(lot)}</td>
            <td><button class="btn btn-ghost btn-small" onclick="openDetail('${lot.id}')">Ver</button></td>
          </tr>`).join("")}
        </tbody></table></div>
      </div>`;
  }
  return `
    <div class="card">
      <div class="card-header"><div><h3>Oportunidades disponibles</h3><p>Lotes que puedes analizar y ofertar</p></div>
        <button class="btn btn-ghost btn-small" onclick="navigate(event,'mercado')">Ver todo</button></div>
      <div class="table-wrap"><table><thead><tr><th>Lote</th><th>Tipo</th><th>Valor</th><th>Descuento</th><th>Modalidad</th><th>Cierre</th><th>Estado</th><th></th></tr></thead><tbody>
        ${buyerOpportunities.map(lot => `<tr><td><strong style="color:var(--navy);">${lot.id}</strong></td><td>${lot.type}</td><td><strong>${lot.amount}</strong></td><td>${lot.discount}</td><td>${lot.modality}</td><td>${fmtDate(lot.endsAt)}</td><td>${statusBadge(lot)}</td><td><button class="btn btn-ghost btn-small" onclick="openDetail('${lot.id}')">Ver</button></td></tr>`).join("")}
      </tbody></table></div>
    </div>`;
}

/* =========================================================
   PÁGINAS INTERNAS
   ========================================================= */
function renderPage(page) {
  const content = $("#content");
  if (!content) return;
  const isSeller = currentRole === "vendedor";
  const data = {
    cartera: { title: "Mis carteras", description: "Portafolios publicados por el vendedor demo." },
    oportunidades: { title: isSeller ? "Interés de compradores" : "Oportunidades", description: isSeller ? "Compradores demo que han mostrado interés en tus portafolios." : "Oportunidades disponibles para analizar y ofertar." },
    negociaciones: { title: isSeller ? "Negociaciones con compradores" : "Mis negociaciones", description: isSeller ? "Seguimiento a propuestas recibidas y contrapropuestas de tus portafolios." : "Seguimiento a tus propuestas y contrapropuestas." },
    mercado: { title: "Mercado de oportunidades", description: "Lotes demo disponibles para explorar y ofertar." }
  };
  const current = data[page] || { title: "Reportes", description: "" };

  if (page === "pruebas") { content.innerHTML = renderTestCenter(); runSelfTests(false); return; }
  if (page === "ofertas") { content.innerHTML = renderOffersPage(); return; }
  if (page === "documentos" || page === "dataroom") { content.innerHTML = renderDocumentsPage(page); return; }
  if (page === "adjudicaciones") { content.innerHTML = renderAdjudicationsPage(); return; }
  if (page === "reportes") { content.innerHTML = renderReportsPage(); return; }

  if (["cartera", "oportunidades", "mercado"].includes(page)) {
    const items = isSeller ? sellerLots : buyerOpportunities;
    content.innerHTML = `
      <div class="card page-card">
        <div class="section-kicker">DATOS DE PRUEBA · ${isSeller ? "VENDEDOR" : "COMPRADOR"}</div>
        <h2>${current.title}</h2>
        <p>${current.description}</p>
        <div class="test-lot-grid">
          ${items.map(lot => `
            <article class="test-lot-card">
              <div class="lot-number">${lot.id}</div>
              <h3>${lot.title}</h3>
              <span>${lot.type} · ${lot.modality}</span>
              <strong>${lot.amount}</strong>
              <div class="test-lot-meta">${statusBadge(lot)}<span>${fmtN(lot.obligations)} obligaciones</span></div>
              <button class="btn btn-ghost btn-small" onclick="openDetail('${lot.id}')">Ver lote</button>
            </article>`).join("")}
        </div>
      </div>`;
    return;
  }

  if (page === "negociaciones") {
    const rows = !isSeller && appState.offers.length ? appState.offers
      : isSeller ? [
        { id: "NEG-VEND-001", lotId: "LOTE-TEST-002", amount: "$2.754 M", status: "En revisión", date: "16 Sep 2026", counterparty: "Fondo Demo Andino" },
        { id: "NEG-VEND-002", lotId: "LOTE-TEST-003", amount: "$5.220 M", status: "Contrapropuesta", date: "15 Sep 2026", counterparty: "Inversiones Demo Capital" }
      ] : [
        { id: "NEG-COMP-001", lotId: "LOTE-TEST-002", amount: "$2.754 M", status: "En revisión", date: "16 Sep 2026", counterparty: SELLER_NAME },
        { id: "NEG-COMP-002", lotId: "LOTE-TEST-003", amount: "$5.017 M", status: "Contrapropuesta", date: "15 Sep 2026", counterparty: SELLER_NAME }
      ];
    content.innerHTML = `
      <div class="card page-card">
        <div class="section-kicker">PIPELINE DEMO</div>
        <h2>${current.title}</h2>
        <p>${current.description}</p>
        <div class="table-wrap page-table"><table>
          <thead><tr><th>Proceso</th><th>Lote</th><th>Contraparte</th><th>Valor</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody>${rows.map(r => `<tr><td><strong>${r.id}</strong></td><td>${r.lotId}</td><td>${escapeHtml(r.counterparty || SELLER_NAME)}</td><td>${r.amount}</td><td><span class="badge badge-blue">${r.status}</span></td><td>${r.date}</td></tr>`).join("")}</tbody>
        </table></div>
      </div>`;
    return;
  }

  content.innerHTML = `<div class="card page-card"><div class="section-kicker">B²GC BROKERS · DEMO</div><h2>${current.title}</h2><p>${current.description}</p></div>`;
}

/* =========================================================
   DOCUMENTOS
   ========================================================= */
function renderDocumentsPage(page = "documentos") {
  const uploaded = appState.uploadedDocuments || [];
  const allDocs = [...testDocuments, ...uploaded];
  const isRoom = page === "dataroom";

  return `
    <div class="card page-card documents-page">
      <div class="documents-head">
        <div><div class="section-kicker">${isRoom ? "DUE DILIGENCE · DEMO" : "GESTIÓN DOCUMENTAL · DEMO"}</div><h2>${isRoom ? "Data room" : "Documentos"}</h2>
        <p>${isRoom ? "Consulta documentos de prueba, revisa el contenido y carga archivos para validar el flujo de due diligence." : "Documentos ficticios listos para consultar, descargar y reemplazar durante las pruebas."}</p></div>
        <div class="documents-head-actions"><button class="btn btn-navy" type="button" onclick="triggerDocumentUpload()">＋ Subir documento</button></div>
      </div>
      <div class="document-stats">
        <div><strong>${testDocuments.length}</strong><span>Documentos de prueba</span></div>
        <div><strong>${uploaded.length}</strong><span>Archivos cargados</span></div>
        <div><strong>${allDocs.length}</strong><span>Total disponible</span></div>
      </div>
      <div class="document-list document-list-enhanced">
        ${allDocs.map(doc => {
          const up = doc.source === "upload";
          return `
            <div class="document-row document-row-enhanced">
              <div class="document-main">
                <div class="document-icon ${up ? "uploaded" : "test"}">${escapeHtml(doc.type || "DOC")}</div>
                <div class="document-info">
                  <strong>${escapeHtml(doc.name)}</strong>
                  <span>${up ? "Archivo cargado" : "Documento de prueba"} · ${escapeHtml(doc.category || "General")} · ${escapeHtml(doc.lotId || "Sin lote")}</span>
                  <small>${escapeHtml(doc.size || "Tamaño demo")} · ${escapeHtml(doc.status || "Disponible")}</small>
                </div>
              </div>
              <div class="document-actions">
                <button class="btn btn-ghost btn-small" type="button" onclick="openDocumentViewer('${doc.id}')">Ver</button>
                <button class="btn btn-ghost btn-small" type="button" onclick="downloadDocument('${doc.id}')">Descargar</button>
                ${up ? `<button class="btn btn-danger-soft btn-small" type="button" onclick="removeUploadedDocument('${doc.id}')">Eliminar</button>` : `<button class="btn btn-blue-soft btn-small" type="button" onclick="triggerDocumentUpload('${doc.id}')">Subir reemplazo</button>`}
              </div>
            </div>`;
        }).join("")}
      </div>
      <div class="document-upload-zone" onclick="triggerDocumentUpload()" role="button" tabindex="0">
        <div class="upload-symbol">↑</div>
        <div><strong>Sube un archivo de prueba</strong><span>PDF, Word, Excel, CSV o imagen · máximo ${MAX_UPLOAD / 1024} KB por archivo</span></div>
      </div>
    </div>`;
}

let pendingDocumentReplacementId = null;
let pendingDocumentLotId = null;

function triggerDocumentUpload(replaceId = null, lotId = null) {
  pendingDocumentReplacementId = replaceId;
  pendingDocumentLotId = lotId || null;
  const input = $("#document-upload-input");
  if (input) { input.value = ""; input.click(); }
}

function handleDocumentUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > MAX_UPLOAD) { showToast(`El archivo supera el límite demo de ${MAX_UPLOAD / 1024} KB.`); return; }

  const replaceId = pendingDocumentReplacementId;
  const lotId = pendingDocumentLotId;
  const reader = new FileReader();
  reader.onload = () => {
    const extension = file.name.includes(".") ? file.name.split(".").pop().toUpperCase() : "FILE";
    // Reemplazar un doc de prueba crea un archivo nuevo asociado al mismo lote
    const base = replaceId ? testDocuments.find(d => d.id === replaceId) : null;
    const uploaded = {
      id: `UPLOAD-TEST-${Date.now()}`, name: file.name, type: extension, size: formatFileSize(file.size), category: base?.category || "Cargado por usuario",
      lotId: base?.lotId || lotId || "Sin lote", status: base ? "Reemplazo" : "Cargado", source: "upload",
      mimeType: file.type || "application/octet-stream", dataUrl: String(reader.result || ""), uploadedAt: new Date().toLocaleString("es-CO")
    };
    appState.uploadedDocuments.unshift(uploaded);
    if (!saveDemoState()) {
      appState.uploadedDocuments.shift(); // revertir si localStorage se llenó
      showToast("Sin espacio en el navegador. Elimina archivos o usa uno más pequeño.");
      return;
    }
    showToast(`Archivo ${file.name} cargado correctamente.`);
    if (currentDetail) renderDataRoom(currentDetail); else renderPage(currentPageKey());
  };
  reader.onerror = () => showToast("No fue posible leer el archivo.");
  reader.readAsDataURL(file);
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const findDocument = id => [...testDocuments, ...(appState.uploadedDocuments || [])].find(d => d.id === id);

function openDocumentViewer(documentId) {
  const doc = findDocument(documentId);
  if (!doc) return;
  $("#document-viewer-overlay")?.remove();
  const up = doc.source === "upload";
  const body = up
    ? `<p><strong>Archivo:</strong> ${escapeHtml(doc.name)}</p><p><strong>Tipo:</strong> ${escapeHtml(doc.type)}</p><p><strong>Tamaño:</strong> ${escapeHtml(doc.size)}</p><p><strong>Fecha de carga:</strong> ${escapeHtml(doc.uploadedAt)}</p><p>El archivo fue guardado localmente en este navegador para las pruebas.</p>`
    : `<pre class="document-preview-text">${escapeHtml(doc.content)}</pre>`;

  const overlay = document.createElement("div");
  overlay.id = "document-viewer-overlay";
  overlay.className = "document-viewer-overlay";
  overlay.innerHTML = `
    <div class="document-viewer-modal">
      <button class="detail-close" type="button" onclick="closeDocumentViewer()">×</button>
      <div class="section-kicker">${up ? "ARCHIVO CARGADO" : "DOCUMENTO DE PRUEBA"}</div>
      <h2>${escapeHtml(doc.name)}</h2>
      <p>${escapeHtml(doc.lotId || "Documento general")} · ${escapeHtml(doc.type || "DOC")} · ${escapeHtml(doc.size || "")}</p>
      <div class="document-viewer-content">${body}</div>
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
  const link = document.createElement("a");
  let url = null;
  if (doc.source === "upload" && doc.dataUrl) { link.href = doc.dataUrl; link.download = doc.name; }
  else {
    url = URL.createObjectURL(new Blob([doc.content || `Documento de prueba: ${doc.name}`], { type: "text/plain;charset=utf-8" }));
    link.href = url; link.download = `${doc.id}.txt`;
  }
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (url) setTimeout(() => URL.revokeObjectURL(url), 500);
  showToast(`Descarga preparada: ${doc.name}`);
}

function removeUploadedDocument(documentId) {
  const doc = findDocument(documentId);
  if (!doc || doc.source !== "upload") return;
  if (!confirm(`¿Eliminar el archivo de prueba "${doc.name}"?`)) return;
  appState.uploadedDocuments = appState.uploadedDocuments.filter(d => d.id !== documentId);
  saveDemoState();
  showToast("Archivo eliminado del entorno demo.");
  renderPage(currentPageKey());
}

/* =========================================================
   ADJUDICACIONES, REPORTES, OFERTAS, PRUEBAS
   ========================================================= */
function renderAdjudicationsPage() {
  const isSeller = currentRole === "vendedor";
  const rows = isSeller
    ? [["ADJ-VEND-001", "LOTE-TEST-001", "Comprador Demo S.A.S.", "$3.977 M", "Adjudicada", "12 Sep 2026"], ["ADJ-VEND-002", "LOTE-TEST-002", "Fondo Demo Andino", "$2.754 M", "En cierre", "15 Sep 2026"], ["ADJ-VEND-003", "LOTE-TEST-003", "Inversiones Demo Capital", "$5.220 M", "Documental", "16 Sep 2026"]]
    : [["ADJ-COMP-001", "LOTE-TEST-001", SELLER_NAME, "$3.977 M", "Adjudicada", "12 Sep 2026"], ["ADJ-COMP-002", "LOTE-TEST-004", "Entidad Financiera Demo D", "$7.850 M", "En cierre", "14 Sep 2026"], ["ADJ-COMP-003", "LOTE-TEST-002", SELLER_NAME, "$2.754 M", "Documental", "15 Sep 2026"]];
  return `
    <div class="card page-card">
      <div class="section-kicker">CIERRES · ${isSeller ? "VENDEDOR" : "COMPRADOR"}</div>
      <h2>${isSeller ? "Cierres de mis portafolios" : "Mis adjudicaciones"}</h2>
      <p>${isSeller ? "Operaciones de tus portafolios que avanzan hacia cierre." : "Operaciones adjudicadas a tu cuenta de comprador demo."}</p>
      <div class="table-wrap page-table"><table><thead><tr><th>Adjudicación</th><th>Lote</th><th>${isSeller ? "Comprador" : "Vendedor"}</th><th>Valor</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td><strong>${r[0]}</strong></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td><span class="badge badge-green">${r[4]}</span></td><td>${r[5]}</td></tr>`).join("")}
      </tbody></table></div>
    </div>`;
}

function renderReportsPage() {
  const isSeller = currentRole === "vendedor";
  const items = isSeller ? sellerLots : buyerOpportunities;
  const total = items.reduce((s, l) => s + parseLotAmount(l), 0);
  const active = items.filter(isOpen).length;
  const negotiations = items.filter(l => lotStatus(l).text === "En negociación").length;
  return `
    <div class="card page-card">
      <div class="section-kicker">REPORTES · ${isSeller ? "VENDEDOR" : "COMPRADOR"}</div>
      <h2>${isSeller ? "Reportes de cartera" : "Reportes de inversión"}</h2>
      <p>${isSeller ? "Indicadores calculados sobre tus portafolios ficticios y su actividad comercial." : "Indicadores calculados sobre oportunidades, ofertas y adjudicaciones ficticias."}</p>
      <div class="report-kpi-grid">
        <div class="report-kpi"><span>${isSeller ? "Valor de cartera propia" : "Valor de oportunidades"}</span><strong>${fmtM(total)}</strong><small>${items.length} registros demo</small></div>
        <div class="report-kpi"><span>${isSeller ? "Portafolios activos" : "Oportunidades activas"}</span><strong>${active}</strong><small>Escenario actual</small></div>
        <div class="report-kpi"><span>${isSeller ? "Negociaciones" : "Ofertas"}</span><strong>${isSeller ? negotiations : appState.offers.length}</strong><small>${isSeller ? "Con compradores demo" : "Registradas en este navegador"}</small></div>
        <div class="report-kpi"><span>${isSeller ? "Compradores interesados" : "Adjudicaciones"}</span><strong>${isSeller ? "47" : "8"}</strong><small>Dato ficticio de prueba</small></div>
      </div>
      <div class="report-bars">
        ${items.map(l => `<div class="report-bar-row"><span>${l.id}</span><div><i style="width:${Math.min(100, parseLotAmount(l) / 89.5 * 100)}%"></i></div><strong>${l.amount}</strong></div>`).join("")}
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
  const submitted = (appState.offers || []).filter(o => sellerLots.some(l => l.id === o.lotId)).map(o => ({ ...o, buyer: o.buyer || "Comprador Demo S.A.S." }));
  const offers = isBuyer ? appState.offers : [...submitted, ...receivedOffersDemo.filter(r => !submitted.some(s => s.lotId === r.lotId && s.amount === r.amount))];

  return `
    <div class="card page-card">
      <div class="section-kicker">${isBuyer ? "ACTIVIDAD DEL COMPRADOR" : "ACTIVIDAD DEL VENDEDOR"}</div>
      <h2>${isBuyer ? "Mis ofertas" : "Ofertas recibidas"}</h2>
      <p>${isBuyer ? "Registra y consulta las ofertas creadas durante el testeo." : "Consulta las propuestas recibidas sobre tus portafolios de prueba."}</p>
      ${offers.length ? `
        <div class="table-wrap page-table"><table>
          <thead><tr><th>Oferta</th><th>Lote</th><th>${isBuyer ? "Valor" : "Comprador"}</th><th>${isBuyer ? "Porcentaje" : "Valor"}</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody>${offers.map(o => `<tr><td><strong>${o.id}</strong></td><td>${o.lotId}</td><td>${isBuyer ? o.amount : escapeHtml(o.buyer)}</td><td>${isBuyer ? `${o.percent}%` : o.amount}</td><td><span class="badge badge-green">${o.status}</span></td><td>${o.date || "—"}</td></tr>`).join("")}</tbody>
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
        <div><strong>Vendedor demo</strong><span>vendedor@demo.b2gc.co</span><span>Demo123!</span></div>
        <div><strong>Comprador demo</strong><span>comprador@demo.b2gc.co</span><span>Demo123!</span></div>
      </div>
    </div>`;
}

function runSelfTests(showFeedback = true) {
  const results = [];
  const assert = (name, cond) => results.push({ name, ok: Boolean(cond) });

  assert("Existen 5 lotes de prueba", lots.length === 5);
  assert("Todos los lotes tienen ID único", new Set(lots.map(l => l.id)).size === lots.length);
  assert("Todos los lotes tienen valor nominal", lots.every(l => l.amount.includes("$")));
  assert("Todos los lotes tienen modalidad", lots.every(l => l.modality));
  assert("Todos los lotes tienen startsAt < endsAt", lots.every(l => l.startsAt < l.endsAt));
  assert("El estado de cada lote se deriva de las fechas", lots.every(l => lotStatus(l).text));
  assert("Simulador puede calcular un valor", Number.isFinite(parseLotAmount(lots[0])));
  assert("El estado de ofertas es un arreglo", Array.isArray(appState.offers));
  assert("Los IDs de oferta son únicos", new Set(appState.offers.map(o => o.id)).size === appState.offers.length);
  assert("Las cuentas demo están configuradas", Object.values(demoAccounts).every(a => a.password));
  assert("Existen documentos demo consultables", testDocuments.length >= 5);
  assert("Los documentos demo tienen contenido", testDocuments.every(d => d.name && d.content));
  assert("Los archivos cargados se manejan como arreglo", Array.isArray(appState.uploadedDocuments));
  assert("Solo existe un input de subida", $$("#document-upload-input").length === 1);
  assert("La composición de tipos suma 100%", Math.abs(composition.tipos.reduce((s, t) => s + t[1], 0) - 1) < 0.001 && Math.abs(composition.tipos.reduce((s, t) => s + t[2], 0) - 1) < 0.001);

  const target = $("#test-results");
  if (target) {
    target.innerHTML = results.map(r => `
      <div class="test-result ${r.ok ? "pass" : "fail"}">
        <span>${r.ok ? "✓" : "×"}</span><strong>${r.name}</strong><small>${r.ok ? "OK" : "REVISAR"}</small>
      </div>`).join("");
  }
  const passed = results.filter(r => r.ok).length;
  if (showFeedback) showToast(`${passed}/${results.length} pruebas automáticas pasaron.`);
  return results;
}

/* =========================================================
   DETALLE DEL LOTE
   ========================================================= */
function openDetail(lotId) {
  const lot = lotById(lotId);
  if (!lot) return;
  currentDetail = lot;
  $("#detail-overlay")?.classList.remove("hidden");
  $("#d-lot").textContent = lot.id;
  $("#d-title").textContent = lot.title;
  renderDetailSummary(lot);
  renderSimulator(lot);
  renderDataRoom(lot);
  showTab("resumen");
}

function closeDetail() {
  $("#detail-overlay")?.classList.add("hidden");
  currentDetail = null;
}

function renderDetailSummary(lot) {
  const panel = $("#tab-resumen");
  if (!panel) return;
  const nominal = parseLotAmount(lot);
  const debtors = Number(String(lot.debtors).replace(/\./g, ""));
  const c = composition;

  const bars = (rows, total, unit) => rows.map(r => `
    <div class="report-bar-row"><span>${r[0]}</span><div><i style="width:${r[1] * 100}%"></i></div><strong>${fmtN(total * r[1])} ${unit} · ${(r[1] * 100).toFixed(0)}%</strong></div>`).join("");
  const block = (title, body) => `<div style="margin-top:22px"><div class="section-kicker">${title}</div><div class="report-bars" style="margin-top:10px">${body}</div></div>`;
  const s = lotStatus(lot);

  panel.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
      ${detailMetric("Valor nominal", lot.amount)}
      ${detailMetric("Número de deudores", lot.debtors)}
      ${detailMetric("Número de obligaciones", fmtN(lot.obligations))}
      ${detailMetric("Modalidad", lot.modality)}
      ${detailMetric("Estado", s.text)}
      ${detailMetric("Ventana", `${fmtDate(lot.startsAt)} → ${fmtDate(lot.endsAt)}`)}
    </div>

    <div style="margin-top:22px">
      <div class="section-kicker">DISTRIBUCIÓN POR TIPO DE CRÉDITO</div>
      <div class="table-wrap"><table><thead><tr><th>Tipo</th><th># Obligaciones</th><th>Valor</th><th>Promedio de capital</th></tr></thead><tbody>
        ${c.tipos.map(t => { const n = lot.obligations * t[1], v = nominal * t[2]; return `<tr><td><strong>${t[0]}</strong></td><td>${fmtN(n)}</td><td>${fmtM(v)}</td><td>${fmtM(v / n)}</td></tr>`; }).join("")}
      </tbody></table></div>
    </div>

    ${block("RANGOS DE MORA Y CASTIGO", bars(c.mora, lot.obligations, "oblig."))}
    ${block("UBICACIÓN GEOGRÁFICA (CIUDAD)", bars(c.ciudades, lot.obligations, "oblig."))}
    ${block("OBLIGACIONES POR RANGO DE CAPITAL", bars(c.rangos, lot.obligations, "oblig."))}
    ${block("OBLIGACIONES POR CLIENTE", bars(c.obligPorCliente, debtors, "clientes"))}
    ${block("TIPO DE CLIENTE", bars(c.tipoCliente, debtors, "clientes"))}
    ${block("ESTADO DE SOPORTES Y LOCALIZACIÓN", c.soportes.map(x => `<div class="report-bar-row"><span>${x[0]}</span><div><i style="width:${x[1]}%"></i></div><strong>${x[1]}%</strong></div>`).join(""))}

    <div style="margin-top:25px;">
      <button class="btn btn-navy" onclick="makeOffer('${lot.id}')">${currentRole === "comprador" ? "Presentar oferta" : "Gestionar operación"}</button>
    </div>`;
}

function detailMetric(label, value) {
  return `<div style="padding:20px;border-radius:15px;background:white;border:1px solid var(--line);">
    <div style="color:var(--muted-2);font-size:9px;text-transform:uppercase;font-family:'IBM Plex Mono';">${label}</div>
    <div style="margin-top:5px;color:var(--navy);font-size:20px;font-weight:800;">${value}</div></div>`;
}

/* =========================================================
   SIMULADOR
   ========================================================= */
function renderSimulator(lot) {
  const panel = $("#tab-simulador");
  if (!panel) return;

  panel.innerHTML = `
    <div class="simulator-container">
      <div class="simulator-header">
        <div><div class="section-kicker">ANÁLISIS FINANCIERO</div><h3>Simulador de oferta</h3><p>Analiza diferentes escenarios de compra y visualiza cómo cambia el valor de tu oferta.</p></div>
        <div class="simulator-lot"><span>${lot.id}</span><strong>${lot.type}</strong></div>
      </div>

      <div class="simulator-top">
        <div class="simulator-control-card">
          <div class="simulator-label">Porcentaje sobre valor nominal</div>
          <div class="percent-input-row">
            <input id="offer-percent" type="range" min="0.1" max="100" step="0.1" value="82" oninput="updateSimulator('${lot.id}')">
            <div class="percent-number"><input id="offer-percent-number" type="number" min="0.1" max="100" step="0.1" value="82" oninput="updateSimulator('${lot.id}')"><span>%</span></div>
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
            <div class="chart-legend"><span><i class="legend-dot nominal"></i> Nominal</span><span><i class="legend-dot offer"></i> Oferta</span></div>
          </div>
          <div class="comparison-chart">
            <div class="comparison-grid"><div class="grid-line"></div><div class="grid-line"></div><div class="grid-line"></div><div class="grid-line"></div><div class="grid-line"></div></div>
            <div class="comparison-bars">
              <div class="comparison-column"><div class="bar-value" id="nominal-bar-value">$0 M</div><div class="comparison-bar nominal-bar" style="height:100%"></div><span>Valor nominal</span></div>
              <div class="comparison-column"><div class="bar-value" id="offer-bar-value">$0 M</div><div class="comparison-bar offer-bar" id="offer-bar" style="height:82%"></div><span>Tu oferta</span></div>
            </div>
          </div>
        </div>
        <div class="chart-card simulator-chart-side">
          <div class="chart-card-header"><div><div class="chart-kicker">ESTRUCTURA</div><h4>Precio de compra</h4></div></div>
          <div class="donut-wrapper"><div class="donut-chart" id="sim-donut"><div class="donut-center"><strong id="donut-percent">82%</strong><span>del nominal</span></div></div></div>
          <div class="donut-info">
            <div><span class="donut-indicator offer"></span><span>Precio de compra</span><strong id="donut-offer">$0 M</strong></div>
            <div><span class="donut-indicator remaining"></span><span>Diferencia</span><strong id="donut-saving">$0 M</strong></div>
          </div>
        </div>
      </div>

      <div class="chart-card sensitivity-card">
        <div class="chart-card-header"><div><div class="chart-kicker">ANÁLISIS DE ESCENARIOS</div><h4>Sensibilidad de la oferta</h4><p>Compara rápidamente cuánto pagarías según diferentes porcentajes de adquisición.</p></div></div>
        <div class="sensitivity-chart" id="sensitivity-chart"></div>
      </div>
    </div>`;

  updateSimulator(lot.id);
}

function updateSimulator(lotId) {
  const lot = lotById(lotId);
  const range = $("#offer-percent");
  const number = $("#offer-percent-number");
  if (!lot || !range || !number) return;

  const typing = document.activeElement === number;
  let percentage = Number(typing ? number.value : range.value);
  if (!percentage || percentage < 0.1) percentage = 0.1;
  if (percentage > 100) percentage = 100;

  range.value = percentage;
  if (!typing) number.value = percentage;

  const shown = +percentage.toFixed(1);
  const nominal = parseLotAmount(lot);
  const offerValue = nominal * (percentage / 100);
  const saving = nominal - offerValue;
  const discountText = +(100 - percentage).toFixed(1);
  const setText = (sel, text) => { const el = $(sel); if (el) el.textContent = text; };

  setText("#simulated-value", fmtM(offerValue));
  setText("#simulated-discount", `${discountText}% por debajo del valor nominal`);
  setText("#sim-nominal", fmtM(nominal));
  setText("#sim-discount", `${discountText}%`);
  setText("#sim-saving", fmtM(saving));
  setText("#sim-price-percent", `${shown}%`);
  setText("#nominal-bar-value", fmtM(nominal));
  setText("#offer-bar-value", fmtM(offerValue));
  setText("#donut-percent", `${shown}%`);
  setText("#donut-offer", fmtM(offerValue));
  setText("#donut-saving", fmtM(saving));

  const bar = $("#offer-bar");
  if (bar) bar.style.height = `${percentage}%`;
  const donut = $("#sim-donut");
  if (donut) { const a = percentage * 3.6; donut.style.background = `conic-gradient(var(--blue) 0deg ${a}deg, #e8edf5 ${a}deg 360deg)`; }

  renderSensitivityChart(percentage);
}

function renderSensitivityChart(selected) {
  const container = $("#sensitivity-chart");
  if (!container) return;
  container.innerHTML = [60, 65, 70, 75, 80, 85, 90, 95].map(p => `
    <div class="sensitivity-column ${Math.abs(p - selected) < 0.05 ? "selected" : ""}" onclick="selectSensitivity(${p})">
      <div class="sensitivity-value">${p}%</div>
      <div class="sensitivity-track"><div class="sensitivity-bar" style="height:${p}%"></div></div>
      <div class="sensitivity-label">${p}%</div>
    </div>`).join("");
}

function selectSensitivity(percent) {
  const range = $("#offer-percent"), number = $("#offer-percent-number");
  if (range) range.value = percent;
  if (number) number.value = percent;
  if (currentDetail) updateSimulator(currentDetail.id);
}

/* =========================================================
   DATA ROOM (dentro del detalle del lote)
   ========================================================= */
function renderDataRoom(lot) {
  const panel = $("#tab-dataroom");
  if (!panel) return;
  const uploaded = (appState.uploadedDocuments || []).filter(d => d.lotId === lot.id);
  const docs = [...testDocuments.filter(d => d.lotId === lot.id || d.lotId === "LOTE-TEST-001"), ...uploaded];

  panel.innerHTML = `
    <div class="dataroom-panel-head">
      <div><div class="section-kicker">DATA ROOM · ${lot.id}</div><h3>Documentos disponibles</h3><p>Archivos ficticios para revisar el flujo de due diligence.</p></div>
      <div class="documents-head-actions">
        <button class="btn btn-navy btn-small" type="button" onclick="triggerDocumentUpload(null,'${lot.id}')">↑ Subir archivo</button>
        <button class="btn btn-ghost btn-small" type="button" onclick="closeDetail();navigate(null,'dataroom')">Gestionar</button>
      </div>
    </div>
    <div class="document-list">
      ${docs.map(doc => `
        <div class="document-row document-row-enhanced">
          <div class="document-main">
            <div class="document-icon ${doc.source === "upload" ? "uploaded" : "test"}">${escapeHtml(doc.type)}</div>
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
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tabName));
  $$(".tab-panel").forEach(p => p.classList.add("hidden"));
  $(`#tab-${tabName}`)?.classList.remove("hidden");
}

/* =========================================================
   OFERTAS (solo se puede mejorar la propia puja)
   ========================================================= */
function myBestOffer(lotId) {
  return appState.offers.filter(o => o.lotId === lotId && o.buyer === appState.company).reduce((m, o) => Math.max(m, o.percent), 0);
}

function makeOffer(lotId) {
  const lot = lotById(lotId);
  if (!lot) return;
  if (currentRole !== "comprador") { showToast("La presentación de ofertas está disponible para compradores."); return; }
  if (!isOpen(lot)) { showToast("Este lote ya cerró."); return; }
  if (lot.modality !== "Compra directa" && Date.now() < lot.startsAt) { showToast(`La subasta abre el ${fmtDate(lot.startsAt)}.`); return; }

  $("#offer-overlay")?.remove();
  const nominal = parseLotAmount(lot);
  const previous = myBestOffer(lot.id);
  const start = previous ? +(previous + 0.1).toFixed(1) : 82;

  const overlay = document.createElement("div");
  overlay.id = "offer-overlay";
  overlay.className = "offer-overlay";
  overlay.innerHTML = `
    <div class="offer-modal">
      <button class="detail-close" type="button" aria-label="Cerrar" onclick="closeOfferModal()">×</button>
      <div class="section-kicker">${previous ? "MEJORAR OFERTA" : "NUEVA OFERTA"} · DEMO</div>
      <h2>Presentar oferta</h2>
      <p>${lot.id} · ${lot.title}</p>
      <div class="offer-summary"><span>Valor nominal</span><strong>${lot.amount}</strong></div>
      ${previous ? `<div class="offer-summary"><span>Tu mejor oferta</span><strong>${previous}%</strong></div>` : ""}
      <label class="offer-field"><span>Porcentaje de compra${previous ? ` (mayor a ${previous}%)` : ""}</span>
        <input id="offer-form-percent" type="number" min="0.1" max="100" step="0.1" value="${Math.min(100, start)}">
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
  const update = () => {
    const percent = Math.min(100, Math.max(0.1, Number(input?.value) || 0.1));
    const out = $("#offer-form-value");
    if (out) out.textContent = fmtM(nominal * percent / 100);
  };
  input?.addEventListener("input", update);
  update();
  input?.focus();
}

function submitOffer(lotId) {
  const lot = lotById(lotId);
  const percent = Number($("#offer-form-percent")?.value);
  const note = ($("#offer-form-note")?.value || "").trim();

  if (!lot || !(percent >= 0.1 && percent <= 100)) { showToast("Ingresa un porcentaje válido (0,1 – 100)."); return; }
  if (!isOpen(lot)) { showToast("Este lote ya cerró."); return; }
  const previous = myBestOffer(lot.id);
  if (previous && percent <= previous) { showToast(`Solo puedes mejorar tu oferta: debe ser mayor a ${previous}%.`); return; }

  const offer = {
    id: `OF-TEST-${Date.now().toString(36).toUpperCase()}`,
    lotId: lot.id,
    amount: fmtM(parseLotAmount(lot) * percent / 100),
    percent: +percent.toFixed(1),
    note,
    status: previous ? "Mejorada" : "Enviada",
    date: new Date().toLocaleDateString("es-CO"),
    buyer: appState.company,
    submittedByRole: currentRole
  };

  appState.offers.unshift(offer);
  if (!saveDemoState()) { appState.offers.shift(); showToast("No fue posible guardar la oferta."); return; }
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
  if (!("IntersectionObserver" in window)) { elements.forEach(e => e.classList.add("visible")); return; }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); } });
  }, { threshold: .12 });
  elements.forEach(e => observer.observe(e));
}

/* =========================================================
   EVENTOS GLOBALES
   ========================================================= */
document.addEventListener("click", event => {
  if (event.target === $("#auth-overlay")) closeAuth();
  if (event.target === $("#detail-overlay")) closeDetail();
  if (event.target === $("#offer-overlay")) closeOfferModal();
  if (event.target === $("#document-viewer-overlay")) closeDocumentViewer();
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  closeAuth(); closeDetail(); closeOfferModal(); closeDocumentViewer();
});

document.addEventListener("DOMContentLoaded", () => {
  buildSidebar();
  initReveal();
});
