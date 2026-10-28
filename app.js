/* =========================================================
   B²GC BROKERS — APP.JS COMPLETO
   Dashboard + Simulador + Gráficas
   ========================================================= */

/* ===== Variables globales ===== */
let currentAuthMode = "login";
let currentRole = "vendedor";
let currentDetail = null;
let toastTimer = null;
let countdownTimer = null;
let currentPage = "dashboard";

/* ===== Estado ===== */
const DEMO_STORAGE_KEY = "b2gc_demo_state_v2";

const demoAccounts = {
  vendedor: { email: "vendedor@demo.b2gc.co", password: "Demo123!", company: "Banco Demo S.A.", avatar: "VD" },
  comprador: { email: "comprador@demo.b2gc.co", password: "Demo123!", company: "Casa de Cobranza Demo S.A.S.", avatar: "CD" }
};

const appState = {
  loggedIn: false,
  demoMode: true,
  company: "Banco Demo S.A.",
  avatar: "VD",
  userEmail: demoAccounts.vendedor.email,
  vendedor: { stats: { cartera: "$18.420 M", operaciones: "126", compradores: "47", cierre: "82%" } },
  comprador: { stats: { oportunidades: "32", ofertas: "14", adjudicadas: "8", cierre: "76%" } },
  offers: [],
  uploadedDocuments: [],
  decisions: {},  // { idOferta: "Aceptada" | "Rechazada" } — decisión del vendedor
  views: {},      // { idCartera: { count, viewers: [empresas] } } — entradas registradas en este navegador (demo)
  favorites: [],  // lotes que el comprador marcó como favoritos
  operations: []  // operaciones en cierre (ver cierre.js)
};

const originatorLots = [
  { id: "LOTE-TEST-001", title: "Cartera de consumo — Demo", vendedor: "Banco Demo S.A.", type: "Consumo", amount: "$4.850 M", discount: "18%", debtors: "2.840", status: "Subasta activa", statusClass: "badge-green", modality: "Subasta privada", deadline: "18 Sep 2026", score: "A+" },
  { id: "LOTE-TEST-002", title: "Cartera libranza — Demo", vendedor: "Banco Demo S.A.", type: "Libranza", amount: "$3.240 M", discount: "15%", debtors: "1.460", status: "En negociación", statusClass: "badge-blue", modality: "Compra directa", deadline: "22 Sep 2026", score: "A" },
  { id: "LOTE-TEST-003", title: "Cartera comercial — Demo", vendedor: "Banco Demo S.A.", type: "Comercial", amount: "$6.780 M", discount: "22%", debtors: "860", status: "Data room abierto", statusClass: "badge-blue", modality: "Híbrida", deadline: "25 Sep 2026", score: "B+" }
];

const lots = [
  { id: "LOTE-TEST-001", title: "Cartera de consumo — Demo", vendedor: "Banco Demo S.A.", type: "Consumo", amount: "$4.850 M", discount: "18%", debtors: "2.840", status: "Subasta activa", statusClass: "badge-green", modality: "Subasta privada", deadline: "18 Sep 2026", score: "A+" },
  { id: "LOTE-TEST-002", title: "Cartera libranza — Demo", vendedor: "Banco Demo S.A.", type: "Libranza", amount: "$3.240 M", discount: "15%", debtors: "1.460", status: "En negociación", statusClass: "badge-blue", modality: "Compra directa", deadline: "22 Sep 2026", score: "A" },
  { id: "LOTE-TEST-003", title: "Cartera comercial — Demo", vendedor: "Banco Demo S.A.", type: "Comercial", amount: "$6.780 M", discount: "22%", debtors: "860", status: "Precalificación", statusClass: "badge-gold", modality: "Híbrida", deadline: "25 Sep 2026", score: "B+" },
  { id: "LOTE-TEST-004", title: "Cartera hipotecaria — Demo", vendedor: "Cooperativa Demo Andina", type: "Hipotecaria", amount: "$8.920 M", discount: "12%", debtors: "420", status: "Data room abierto", statusClass: "badge-blue", modality: "Subasta privada", deadline: "30 Sep 2026", score: "A+" },
  { id: "LOTE-TEST-005", title: "Cartera pyme — Demo", vendedor: "Fintech Demo Pacífico", type: "PYME", amount: "$2.160 M", discount: "20%", debtors: "315", status: "Nueva", statusClass: "badge-green", modality: "Compra directa", deadline: "02 Oct 2026", score: "A" }
];

const buyerOpportunities = lots.map(lot => ({ ...lot }));

/* Carteras que la casa de cobranza demo ya compró antes (histórico) */
const buyerAcquisitionsDemo = [
  { lotId: "LOTE-HIST-011", title: "Cartera de libranza", vendedor: "Fintech Demo Pacífico", type: "Libranza", nominal: 2100, percent: 85, date: "28/7/2026", status: "Cerrada" },
  { lotId: "LOTE-HIST-018", title: "Cartera de consumo", vendedor: "Cooperativa Demo Andina", type: "Consumo", nominal: 4850, percent: 82, date: "12/9/2026", status: "Cerrada" }
];

/* ===== Referencia del proceso =====
   Iniciales de la entidad que vende + consecutivo de sus procesos.
   Ej.: Banco Santander → BS004. En el modo real la asigna el servidor. */
const REF_SKIP = /^(de|del|la|las|los|el|y|s\.?a\.?s?\.?|ltda\.?|e\.?u\.?)$/i;
const lotRefs = {};
const refOf = id => lotRefs[id] || id;

function refPrefix(name) {
  return String(name || "").split(/\s+/)
    .filter(w => w && !REF_SKIP.test(w) && /^[\p{L}\d]/u.test(w))
    .map(w => w[0].toUpperCase()).join("").slice(0, 4) || "EN";
}

(function assignDemoRefs() {
  const seq = {};
  // El histórico va primero porque esas compras son anteriores
  [...buyerAcquisitionsDemo.map(h => ({ id: h.lotId, vendedor: h.vendedor })), ...lots].forEach(item => {
    if (lotRefs[item.id]) return;
    const p = refPrefix(item.vendedor);
    seq[p] = (seq[p] || 0) + 1;
    lotRefs[item.id] = p + String(seq[p]).padStart(3, "0");
  });
})();

/* ===== TRM y perfil ampliado de cada lote (DEMO: reemplazar por API/BD) ===== */
const TRM_DEMO = 3950; // COP por USD; conectar a la TRM oficial cuando haya backend
const DAY = 864e5;
const SOLD_DEMO = 3977; // M COP ya vendidos (demo)

const lotProfiles = {
  "LOTE-TEST-001": { views: 412, viewers: 38, obligations: 6120, likes: 128, favs: 41, comments: 17, offers: 6, bestPercent: 82, startsAt: Date.now() - 3 * DAY, endsAt: Date.now() + 5 * 36e5 },
  "LOTE-TEST-002": { views: 236, viewers: 24, obligations: 3010, likes: 76, favs: 22, comments: 9, offers: 4, bestPercent: 85, startsAt: Date.now() - 2 * DAY, endsAt: Date.now() + 2.25 * DAY },
  "LOTE-TEST-003": { views: 168, viewers: 17, obligations: 1930, likes: 54, favs: 15, comments: 6, offers: 3, bestPercent: 74, startsAt: Date.now() - 1.5 * DAY, endsAt: Date.now() + 4 * DAY },
  "LOTE-TEST-004": { views: 96, viewers: 9, obligations: 980, likes: 33, favs: 10, comments: 3, offers: 2, bestPercent: 88, startsAt: Date.now() - 1 * DAY, endsAt: Date.now() + 6 * DAY },
  "LOTE-TEST-005": { views: 41, viewers: 6, obligations: 720, likes: 21, favs: 7, comments: 2, offers: 0, bestPercent: 0, startsAt: Date.now() + 18 * 36e5, endsAt: Date.now() + 8 * DAY }
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
  { id: "DOC-TEST-001", name: "Resumen ejecutivo", type: "PDF", size: "320 KB", category: "Comercial", lotId: "LOTE-TEST-001", status: "Disponible", content: "RESUMEN EJECUTIVO — BD001\n\nDocumento ficticio para pruebas de B²GC Brokers.\n\nValor nominal: $4.850 M\nTipo: Consumo\nModalidad: Subasta privada\nCalificación: A+\n\nEste documento no contiene información real y solo debe utilizarse para pruebas." },
  { id: "DOC-TEST-002", name: "Base anonimizada", type: "XLSX", size: "1,2 MB", category: "Datos", lotId: "LOTE-TEST-001", status: "Disponible", content: "BASE ANONIMIZADA — BD001\n\nArchivo de prueba. Registros ficticios: 2.840 deudores anonimizados.\nNo contiene PII real." },
  { id: "DOC-TEST-003", name: "Información de saldos", type: "PDF", size: "540 KB", category: "Financiero", lotId: "LOTE-TEST-002", status: "Disponible", content: "INFORMACIÓN DE SALDOS — BD002\n\nSaldo nominal de prueba: $3.240 M\nDeudores de prueba: 1.460\nTipo: Libranza\n\nInformación ficticia para validar el flujo documental." },
  { id: "DOC-TEST-004", name: "Metodología de valoración", type: "DOCX", size: "210 KB", category: "Valoración", lotId: "LOTE-TEST-003", status: "Disponible", content: "METODOLOGÍA DE VALORACIÓN — DEMO\n\nModelo ilustrativo para pruebas. La valoración utiliza escenarios y porcentajes configurables dentro del simulador." },
  { id: "DOC-TEST-005", name: "Documentación jurídica", type: "PDF", size: "760 KB", category: "Legal", lotId: "LOTE-TEST-004", status: "Disponible", content: "DOCUMENTACIÓN JURÍDICA — DEMO\n\nChecklist jurídico ficticio: contrato, certificaciones y anexos.\nEstado de prueba: documentación disponible para revisión." },
  { id: "DOC-TEST-006", name: "Certificación de cartera", type: "PDF", size: "430 KB", category: "Legal", lotId: "LOTE-TEST-005", status: "Disponible", content: "CERTIFICACIÓN DE CARTERA — FDP002\n\nDocumento ficticio para validar consulta, descarga y trazabilidad." }
];

/* ===== Persistencia demo ===== */
function loadDemoState() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || "null");
    if (saved && Array.isArray(saved.offers)) appState.offers = saved.offers;
    if (saved && Array.isArray(saved.uploadedDocuments)) appState.uploadedDocuments = saved.uploadedDocuments;
    if (saved && Array.isArray(saved.demoPortfolios)) appState.demoPortfolios = saved.demoPortfolios;
    if (saved && saved.decisions && typeof saved.decisions === "object") appState.decisions = saved.decisions;
    if (saved && Array.isArray(saved.favorites)) appState.favorites = saved.favorites;
    if (saved && saved.views && typeof saved.views === "object") appState.views = saved.views;
    if (saved && Array.isArray(saved.operations)) appState.operations = saved.operations;
  } catch (error) {
    console.warn("No fue posible cargar el estado demo.", error);
    appState.offers = [];
  }
}

function saveDemoState() {
  if (appState.realMode) { // en modo real los datos viven en Supabase; aquí solo las favoritas
    try { localStorage.setItem(`b2gc_real_favs_${real.user?.id}`, JSON.stringify(appState.favorites || [])); } catch { }
    return;
  }
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ offers: appState.offers, uploadedDocuments: appState.uploadedDocuments, decisions: appState.decisions, favorites: appState.favorites, views: appState.views, operations: appState.operations, demoPortfolios: appState.demoPortfolios || [] }));
}

function resetDemoData() {
  appState.offers = [];
  appState.uploadedDocuments = [];
  appState.decisions = {};
  appState.favorites = [];
  appState.views = {};
  appState.operations = [];
  const hadPortfolios = (appState.demoPortfolios || []).length;
  appState.demoPortfolios = [];
  saveDemoState();
  if (hadPortfolios) { location.reload(); return; } // las carteras publicadas ya están cargadas en memoria
  if (typeof syncLotStatuses === "function") syncLotStatuses();
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
    const ms = (kind === "inicio" ? p.startsAt : p.endsAt) - Date.now();
    el.textContent = kind === "inicio" && ms <= 0 ? "En curso" : fmtCountdown(ms);
    el.classList.toggle("cd-urgent", kind === "cierre" && ms > 0 && ms < DAY);
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
  const started = (lotProfiles[id]?.startsAt || 0) <= Date.now();
  label.textContent = next === "inicio"
    ? (started ? "Estado de la subasta" : "Tiempo para el inicio de la subasta")
    : "Tiempo para el cierre de la subasta";
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
  if (mode === "register" && typeof openRegister === "function") { closeAuth(); openRegister(); return; }
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

function fillDemo(role) {
  const account = demoAccounts[role];
  const email = $("#auth-email"), password = $("#auth-password");
  if (email) email.value = account.email;
  if (password) password.value = account.password;
  pickRole($(`.role-opt[data-role="${role}"]`), role);
  showToast("Cuenta demo cargada. Pulsa “Entrar a la plataforma”.");
}

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* Cartera del sitio público: abre el demo de casa de cobranza filtrado por ese tipo */
function openPublicPortfolio(type) {
  openAuth("login");
  fillDemo("comprador");
  typeFilter = type;
  showToast(`Entra al demo para ver la cartera de ${type.toLowerCase()}, o inicia sesión con tu cuenta.`);
}

const MODALITIES = {
  subasta: {
    title: "Subasta privada", icon: "↗",
    lead: "La entidad vendedora fija una fecha de cierre y una tarifa mínima; las casas de cobranza compiten mejorando su oferta.",
    steps: ["La entidad vendedora publica la cartera anonimizada, la tarifa mínima y la ventana de la subasta.", "Las casas de cobranza aprobadas revisan el data room y ofertan; ven su posición pero no las ofertas ajenas.", "Si alguien oferta por debajo de la última, se le avisa y la entidad vendedora decide.", "Al cierre, la entidad vendedora adjudica y B²GC Brokers acompaña firmas, pago, entrega y paz y salvo."]
  },
  directa: {
    title: "Compra directa", icon: "◇",
    lead: "Negociación uno a uno entre la entidad vendedora y una casa de cobranza, sin ventana competitiva.",
    steps: ["La casa de cobranza presenta una oferta sobre la cartera.", "La entidad vendedora la acepta, la rechaza o espera una mejor.", "Al aceptar, se abre el cierre documental con B²GC Brokers como intermediario."]
  },
  hibrida: {
    title: "Híbrida", icon: "◎",
    lead: "Negociación previa y luego una subasta limitada a las casas de cobranza que la entidad vendedora preselecciona.",
    steps: ["La entidad vendedora conversa con varias casas de cobranza y elige a las finalistas.", "Las finalistas compiten en una subasta corta con fecha límite.", "La mejor oferta se adjudica y se cierra con B²GC Brokers."]
  }
};

function openModality(key) {
  const m = MODALITIES[key];
  if (!m) return;
  $("#modality-overlay")?.remove();
  const el = document.createElement("div");
  el.id = "modality-overlay";
  el.className = "offer-overlay";
  el.innerHTML = `
    <div class="offer-modal">
      <button class="detail-close" type="button" onclick="$('#modality-overlay').remove()">×</button>
      <div class="section-kicker">MODALIDAD DE NEGOCIACIÓN</div>
      <h2>${m.icon} ${m.title}</h2>
      <p>${m.lead}</p>
      <ol class="modality-steps">${m.steps.map(s => `<li>${s}</li>`).join("")}</ol>
      <div class="offer-actions">
        <button class="btn btn-ghost" onclick="$('#modality-overlay').remove();openAuth('login');fillDemo('comprador')">Probar el demo</button>
        <button class="btn btn-navy" onclick="$('#modality-overlay').remove();openRegister()">Registrar mi empresa</button>
      </div>
    </div>`;
  el.addEventListener("click", e => { if (e.target === el) el.remove(); });
  document.body.appendChild(el);
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

  // Las cuentas demo funcionan en este navegador; las demás son cuentas reales en Supabase
  if (!isDemoEmail(emailValue)) { realSignIn(emailValue, passwordValue); return; }

  const res = authenticate(emailValue, passwordValue); // definido en admin.js
  if (res.error) { showToast(res.error); return; }

  closeAuth();
  if (res.admin) { openAdminPanel(); return; }

  appState.loggedIn = true;
  appState.demoMode = !!res.demo;
  appState.userEmail = emailValue;
  appState.session = res;
  appState.company = res.company;
  appState.avatar = res.avatar;
  currentRole = res.role;

  $("#public-site")?.classList.add("hidden");
  $("#app-shell")?.classList.remove("hidden");
  const toggle = $(".role-toggle");
  if (toggle) toggle.style.display = res.demo ? "" : "none"; // solo las cuentas demo cambian de rol
  setRole(currentRole);
  if (typeFilter && currentRole === "comprador") navigate(null, "mercado"); // vino desde una cartera del sitio público
  showToast(`Bienvenido, ${res.company}.`);
}

function exitApp() {
  if (appState.realMode) { realSignOut(); return; }
  appState.loggedIn = false;
  appState.session = null;
  $("#admin-shell")?.classList.add("hidden");
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
  if (typeof closeOperation === "function") closeOperation();
  const account = (appState.session && !appState.session.demo) ? appState.session : demoAccounts[role];
  if (account) { appState.company = account.company; appState.avatar = account.avatar; }

  const companyName = $("#company-name");
  const avatar = $(".avatar");
  if (companyName) companyName.textContent = appState.company;
  if (avatar) avatar.textContent = appState.avatar;

  $("#rt-vendedor")?.classList.toggle("active", role === "vendedor");
  $("#rt-comprador")?.classList.toggle("active", role === "comprador");

  const h1 = $("#page-h1");
  if (h1) h1.textContent = "Dashboard";
  currentPage = "dashboard";

  buildSidebar();
  renderDashboard();
}

function buildSidebar() {
  const nav = $("#sidebar-nav");
  if (!nav) return;

  if (appState.realMode) {
    const seller = currentRole === "vendedor";
    const link = (page, label, active) => `<a href="#" class="${active ? "active" : ""}" onclick="navigate(event,'${page}')">${label}</a>`;
    nav.innerHTML = (seller ? [
      link("dashboard", "Dashboard", true), link("cartera", "Mis carteras"), link("publicar", "Publicar cartera"),
      link("subastas", "Carteras en subasta"), link("ofertas", "Ofertas recibidas"), link("oportunidades", "Casas de cobranza interesadas"), link("cierre", "Cierre de operaciones")
    ] : [
      link("dashboard", "Dashboard", true), link("mercado", "Mercado"), link("subastas", "Carteras en subasta"),
      link("ofertas", "Mis ofertas"), link("cierre", "Cierre de operaciones"), link("adjudicaciones", "Carteras adquiridas")
    ]).join("") + `<div class="sidebar-market-status"><div class="status-title">Conectado · datos reales</div><p>${escapeHtml(appState.company)}</p></div>`;
    return;
  }

  if (currentRole === "vendedor") {
    nav.innerHTML = `
      <a href="#" class="active" onclick="navigate(event,'dashboard')">Dashboard</a>
      <a href="#" onclick="navigate(event,'cartera')">Mis carteras</a>
      <a href="#" onclick="navigate(event,'publicar')">Publicar cartera</a>
      <a href="#" onclick="navigate(event,'subastas')">Carteras en subasta</a>
      <a href="#" onclick="navigate(event,'ofertas')">Ofertas recibidas</a>
      <a href="#" onclick="navigate(event,'oportunidades')">Casas de cobranza interesadas</a>
      <a href="#" onclick="navigate(event,'negociaciones')">Negociaciones</a>
      <a href="#" onclick="navigate(event,'cierre')">Cierre de operaciones</a>
      <a href="#" onclick="navigate(event,'documentos')">Documentos</a>
      <a href="#" onclick="navigate(event,'reportes')">Reportes</a>
      <a href="#" onclick="navigate(event,'pruebas')">Pruebas</a>
      <div class="sidebar-market-status"><div class="status-title">Mercado activo</div><p>47 casas de cobranza conectadas</p></div>`;
  } else {
    nav.innerHTML = `
      <a href="#" class="active" onclick="navigate(event,'dashboard')">Dashboard</a>
      <a href="#" onclick="navigate(event,'mercado')">Mercado</a>
      <a href="#" onclick="navigate(event,'subastas')">Carteras en subasta</a>
      <a href="#" onclick="navigate(event,'ofertas')">Mis ofertas</a>
      <a href="#" onclick="navigate(event,'cierre')">Cierre de operaciones</a>
      <a href="#" onclick="navigate(event,'adjudicaciones')">Carteras adquiridas</a>
      <a href="#" onclick="navigate(event,'dataroom')">Data room</a>
      <a href="#" onclick="navigate(event,'reportes')">Reportes</a>
      <a href="#" onclick="navigate(event,'pruebas')">Pruebas</a>
      <div class="sidebar-market-status"><div class="status-title">Mercado activo</div><p>32 oportunidades disponibles</p></div>`;
  }
}

function navigate(event, page) {
  if (event) event.preventDefault();
  const pageTitle = $("#page-h1");
  $$("#sidebar-nav a").forEach(link => link.classList.remove("active"));
  if (event && event.currentTarget) event.currentTarget.classList.add("active");

  currentPage = page;
  if (event) resetFilters();
  const titles = {
    dashboard: "Dashboard", cartera: "Mis carteras", oportunidades: currentRole === "vendedor" ? "Casas de cobranza interesadas" : "Oportunidades", negociaciones: "Negociaciones",
    documentos: "Documentos", reportes: "Reportes", mercado: "Mercado de oportunidades",
    ofertas: currentRole === "vendedor" ? "Ofertas recibidas" : "Mis ofertas",
    adjudicaciones: currentRole === "comprador" ? "Carteras adquiridas" : "Adjudicaciones", dataroom: "Data room", pruebas: "Centro de pruebas",
    subastas: "Carteras en subasta", cierre: "Cierre de operaciones", publicar: "Publicar cartera"
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
  if (appState.realMode) { renderRealDashboard(); return; }

  const isOriginator = currentRole === "vendedor";
  const roleData = isOriginator ? {
    kicker: "VISTA GENERAL · ENTIDAD VENDEDORA",
    title: "Tus carteras y las ofertas que han recibido",
    description: "Publica la cartera de tu banco, fintech o cooperativa; B²GC la lleva a las casas de cobranza, gestiona la subasta y acompaña el cierre."
  } : {
    kicker: "VISTA GENERAL · CASA DE COBRANZA",
    title: "Carteras disponibles y tus ofertas",
    description: "Explora la cartera que bancos, fintech y cooperativas publican a través de B²GC, revisa data rooms, oferta y sigue tus adjudicaciones.",
    kpis: [
      ["Oportunidades disponibles", "32", "↗ 7 nuevas hoy", "navigate(null,'mercado')"],
      ["Ofertas realizadas", "14", "↗ +3 esta semana", "navigate(null,'ofertas')"],
      ["Adjudicaciones", "8", "↗ +2 este mes", "navigate(null,'adjudicaciones')"],
      ["Tasa de cierre", "76%", "↗ +3.8 puntos", "navigate(null,'reportes')"]
    ]
  };

  content.innerHTML = `
    <div class="dashboard-welcome reveal visible">
      <div style="margin-bottom:25px;">
        <div class="section-kicker">${roleData.kicker}</div>
        <div class="dash-title-row">
          <h2 style="font-size:30px;letter-spacing:-1px;color:var(--navy);margin-top:5px;">${roleData.title}</h2>
          ${isOriginator ? `<button class="btn btn-navy" onclick="navigate(null,'publicar')">＋ Publicar cartera</button>` : ""}
        </div>
        <p style="color:var(--muted);font-size:13px;margin-top:5px;">${roleData.description}</p>
      </div>
      <div class="kpi-grid">
        ${isOriginator ? renderOriginatorKpis() : buyerKpiCards()}
      </div>
      ${isOriginator ? renderOriginatorCharts() : renderDashboardCharts("comprador")}
      ${renderLotsCard()}
    </div>`;

  initReveal();
  startCountdowns();
}

function kpiCard(label, value, change, direction = "up", action = "") {
  const attrs = action ? ` role="button" tabindex="0" onclick="${action}" title="Ver detalle"` : "";
  return `
    <div class="kpi-card ${action ? "clickable" : ""}"${attrs}>${action ? '<span class="kpi-go" aria-hidden="true">→</span>' : ""}
      <div class="label">${label}</div>
      <div class="value">${value}</div>
      <div class="change ${direction === "down" ? "down" : ""}">${change}</div>
    </div>`;
}

/* ----- Visualizaciones: veces que una casa de cobranza entra a una cartera ----- */
function viewsOf(lotId) {
  const base = lotProfiles[lotId] || {};
  const tracked = appState.views?.[lotId] || { count: 0, viewers: [] };
  return { views: (base.views || 0) + tracked.count, viewers: (base.viewers || 0) + tracked.viewers.length };
}

function registerView(lot) {
  if (currentRole !== "comprador" || !appState.loggedIn) return;
  if (appState.realMode) { if (typeof realRegisterView === "function") realRegisterView(lot); return; }
  if (!appState.views) appState.views = {};
  const v = appState.views[lot.id] || (appState.views[lot.id] = { count: 0, viewers: [] });
  v.count++;
  if (!v.viewers.includes(appState.company)) v.viewers.push(appState.company);
  saveDemoState();
}

/* Página del vendedor: quién está mirando sus carteras */
function renderInterestPage() {
  const rows = originatorLots.map(l => ({ lot: l, ...viewsOf(l.id), favs: profileOf(l).favs || 0, offers: bidsFor(l.id).length, bidders: bidderCount(l.id) }))
    .sort((a, b) => b.views - a.views);
  const total = rows.reduce((s, r) => s + r.views, 0);
  const viewers = rows.reduce((s, r) => s + r.viewers, 0);
  const bidders = rows.reduce((s, r) => s + r.bidders, 0);
  return `
    <div class="card page-card">
      <h2>Casas de cobranza interesadas</h2>
      <p>Cuántas veces entraron a ver cada cartera, cuántas casas de cobranza distintas lo hicieron y cuántas terminaron ofertando.</p>
      <div class="report-kpi-grid">
        <div class="report-kpi"><span>Visualizaciones</span><strong>${fmtN(total)}</strong><small>Entradas a tus carteras</small></div>
        <div class="report-kpi"><span>Casas de cobranza</span><strong>${fmtN(viewers)}</strong><small>Visitantes distintos, sumados por cartera</small></div>
        <div class="report-kpi"><span>Postores</span><strong>${fmtN(bidders)}</strong><small>Casas que ofertaron</small></div>
        <div class="report-kpi"><span>De visita a oferta</span><strong>${viewers ? Math.round(bidders / viewers * 100) : 0}%</strong><small>Postores sobre visitantes</small></div>
      </div>
      ${rows.length ? `<div class="table-wrap page-table"><table>
        <thead><tr><th>Referencia del proceso</th><th>Cartera</th><th>Visualizaciones</th><th>Casas distintas</th><th>Favoritos</th><th>Ofertas</th><th>De visita a oferta</th></tr></thead>
        <tbody>${rows.map(r => `<tr class="clickable" role="button" tabindex="0" onclick="openDetail('${r.lot.id}')">
          <td><strong>${refOf(r.lot.id)}</strong></td><td>${escapeHtml(r.lot.title)}</td>
          <td><strong>${fmtN(r.views)}</strong></td><td>${fmtN(r.viewers)}</td><td>${fmtN(r.favs)}</td><td>${fmtN(r.offers)}</td>
          <td>${r.viewers ? Math.round(r.bidders / r.viewers * 100) + "%" : "—"}</td>
        </tr>`).join("")}</tbody>
      </table></div>` : `<div class="page-placeholder"><strong>Aún no tienes carteras publicadas</strong></div>`}
    </div>`;
}

/* ----- Carteras publicadas en el demo ----- */
function addDemoPortfolio(p) {
  if (lots.some(l => l.id === p.id)) return;
  const vendedor = demoAccounts.vendedor.company;
  const now = Date.now();
  const [status, statusClass] = now < p.startsAt ? ["Por abrir", "badge-blue"] : now >= p.endsAt ? ["Subasta finalizada", "badge-gold"] : ["Subasta activa", "badge-green"];
  const lot = {
    id: p.id, title: p.title, vendedor, type: p.type, amount: fmtM(Number(p.nominal)), discount: "", debtors: fmtN(p.debtors),
    status, statusClass, modality: p.modality, deadline: new Date(p.endsAt).toLocaleDateString("es-CO"), score: "—", description: p.description || ""
  };
  lots.push(lot);
  originatorLots.push({ ...lot });
  buyerOpportunities.push({ ...lot });
  lotProfiles[p.id] = { obligations: p.obligations, likes: 0, favs: 0, comments: 0, offers: 0, bestPercent: 0, startsAt: p.startsAt, endsAt: p.endsAt };
  lotReserve[p.id] = Number(p.reserve);
  const prefix = refPrefix(vendedor);
  const used = Object.values(lotRefs).filter(r => r.startsWith(prefix) && /^\d+$/.test(r.slice(prefix.length))).length;
  lotRefs[p.id] = prefix + String(used + 1).padStart(3, "0");
}

/* ----- KPIs de la casa de cobranza (demo y real) ----- */
const fmtPct = n => n.toLocaleString("es-CO", { maximumFractionDigits: 1 }) + "%";
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* Carteras que la casa de cobranza ganó: histórico demo + operaciones adjudicadas */
function buyerAcquisitions() {
  const fromOps = (appState.operations || [])
    .filter(o => o.status !== "Cancelada" && o.buyer === appState.company)
    .map(o => ({
      lotId: o.lotId, title: o.lotTitle, vendedor: o.seller, type: lotById(o.lotId)?.type || "—",
      nominal: o.nominal, percent: o.percent, value: o.value, paid: o.steps.pago ? Number(o.steps.pago.amount) || o.value : 0,
      date: new Date(o.createdAt).toLocaleDateString("es-CO"), status: o.status, opId: o.id
    }));
  const history = appState.realMode ? [] : buyerAcquisitionsDemo.map(h => {
    const value = +(h.nominal * h.percent / 100).toFixed(1);
    return { ...h, value, paid: value };
  });
  return [...history, ...fromOps];
}

function buyerKpiCards() {
  // Disponibles: carteras con subasta abierta o por abrir que no se han adjudicado
  const available = buyerOpportunities.filter(l => auctionState(l.id) !== "cerrada");
  const availableNominal = available.reduce((s, l) => s + parseLotAmount(l), 0);

  // Activas: mi mejor oferta vigente en cada cartera cuya subasta sigue abierta
  const myBest = {};
  (appState.offers || []).forEach(o => {
    if (appState.decisions?.[o.id] === "Rechazada" || auctionState(o.lotId) === "cerrada") return;
    myBest[o.lotId] = Math.max(myBest[o.lotId] || 0, o.percent);
  });
  const activeIds = Object.keys(myBest).filter(id => lotById(id));
  const offered = activeIds.reduce((s, id) => s + parseLotAmount(lotById(id)) * myBest[id] / 100, 0);

  // Adquiridas y precio promedio (ponderado por valor nominal)
  const acquired = buyerAcquisitions();
  const paid = acquired.reduce((s, a) => s + a.paid, 0);
  const pending = acquired.reduce((s, a) => s + a.value - a.paid, 0);
  const nominal = acquired.reduce((s, a) => s + a.nominal, 0);
  const avgPrice = nominal ? acquired.reduce((s, a) => s + a.value, 0) / nominal * 100 : 0;

  return [
    kpiCard("Oportunidades disponibles", available.length,
      `${available.length === 1 ? "cartera o tramo" : "carteras o tramos"} por ${fmtM(availableNominal)} de valor nominal`, "up", "navigate(null,'subastas')"),
    kpiCard("Ofertas activas", activeIds.length,
      activeIds.length ? `${activeIds.length === 1 ? "cartera o tramo" : "carteras o tramos"} con ${fmtM(offered)} ofertados` : "No tienes ofertas vigentes", "up", "navigate(null,'ofertas')"),
    acquired.length ? kpiCard("Carteras adquiridas", acquired.length,
      `${fmtM(paid)} pagados${pending > 0.05 ? ` y ${fmtM(pending)} por pagar` : ""}`, "up", "navigate(null,'adjudicaciones')") : "",
    acquired.length ? kpiCard("Precio promedio de adquisición", `${fmtPct(avgPrice)} <small class="kpi-unit">del nominal</small>`,
      `Descuento promedio de ${fmtPct(100 - avgPrice)} sobre ${plural(acquired.length, "cartera", "carteras")}`, "up", "navigate(null,'adjudicaciones')") : ""
  ].join("");
}

/* ----- KPIs del vendedor ----- */
function renderOriginatorKpis() {
  const total = originatorLots.reduce((s, l) => s + parseLotAmount(l), 0); // M COP
  const usd = total * 1e6 / TRM_DEMO;
  const featured = originatorLots[0];
  const views = originatorLots.map(l => ({ lot: l, ...viewsOf(l.id) }));
  const totalViews = views.reduce((s, v) => s + v.views, 0);
  const mostViewed = [...views].sort((a, b) => b.views - a.views)[0];
  const nOffers = originatorLots.reduce((s, l) => s + bidsFor(l.id).length, 0);
  const best = originatorLots.map(l => ({ lot: l, p: topBid(l.id)?.percent || 0 })).sort((a, b) => b.p - a.p)[0];
  const bestValue = parseLotAmount(best.lot) * best.p / 100;
  const n = getNotif();

  return `
    <div class="kpi-card clickable" role="button" tabindex="0" onclick="navigate(null,'cartera')" title="Ver mis carteras">
      <div class="label">Cartera en comercialización · Saldo a capital</div>
      <div class="value">${fmtM(total)}</div>
      <div class="change">≈ USD ${fmtN(usd)} · TRM $${fmtN(TRM_DEMO)}</div>
    </div>

    <div class="kpi-card clickable" role="button" tabindex="0" onclick="navigate(null,'oportunidades')" title="Ver casas de cobranza interesadas">
      <div class="label">Visualizaciones</div>
      <div class="value">${fmtN(totalViews)}</div>
      <div class="change" style="color:var(--muted)">${totalViews ? `Veces que casas de cobranza entraron a tus carteras. La más vista: ${refOf(mostViewed.lot.id)} (${fmtN(mostViewed.views)})` : "Aún nadie ha entrado a tus carteras"}</div>
    </div>

    <div class="kpi-card clickable" role="button" tabindex="0" onclick="navigate(null,'ofertas')" title="Ver ofertas recibidas">
      <div class="label">Mejor oferta actual · ${refOf(best.lot.id)}</div>
      <div class="value">${fmtM(bestValue)} <small style="font-size:13px;color:var(--blue)">${best.p}%</small></div>
      <div class="change">Vendido ${fmtM(SOLD_DEMO)} de ${fmtM(total)} (${(SOLD_DEMO / total * 100).toFixed(1)}%) · ${nOffers} ofertas</div>
    </div>

    <div class="kpi-card clickable" role="button" tabindex="0" onclick="toggleCountdown()" title="Toca para ver si la subasta está en curso o cuánto falta para el cierre">
      <div class="label"><span id="cd-label">Tiempo para el cierre de la subasta</span> ⇄</div>
      <div class="value" id="cd-main" data-cd="${featured.id}|cierre" style="font-size:20px">—</div>
      <div class="change" style="color:var(--muted)" onclick="event.stopPropagation()">
        Avisar por:
        <label><input type="checkbox" ${n.sms ? "checked" : ""} onchange="setNotif('sms',this.checked)"> SMS</label>
        <label><input type="checkbox" ${n.wa ? "checked" : ""} onchange="setNotif('wa',this.checked)"> WA</label>
        <label><input type="checkbox" ${n.mail ? "checked" : ""} onchange="setNotif('mail',this.checked)"> Mail</label>
      </div>
    </div>`;
}

/* ----- Gráficas del vendedor ----- */
function renderOriginatorCharts() {
  const donut = [["Consumo", 42], ["Libranza", 28], ["Comercial", 18], ["Hipotecaria", 12]];
  const statuses = [["En mercado", 36, "active"], ["En negociación", 18, "negotiation"], ["Cerradas", 72, "completed"]];
  return `
    <div class="dashboard-chart-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <div class="dashboard-chart-card dashboard-chart-large">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">SUBASTAS</div><h3>Mejor oferta vs. tu tarifa</h3><p>La línea dorada marca la tarifa mínima que fijaste para cada cartera.</p></div><button class="chart-period" onclick="navigate(null,'ofertas')">Ver ofertas</button></div>
        ${renderReserveChart(originatorLots)}
      </div>
      <div class="dashboard-chart-card">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">TU PORTAFOLIO</div><h3>Distribución por tipo</h3></div><button class="chart-period" onclick="navigate(null,'cartera')">Mis carteras</button></div>
        ${svgDonut(donut, "126", "operaciones", "dv")}
      </div>
      <div class="dashboard-chart-card">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">SEGUIMIENTO</div><h3>Estado de tus operaciones</h3></div><button class="chart-period" onclick="navigate(null,'cierre')">Cierre</button></div>
        ${renderStatusBars(statuses)}
      </div>
    </div>`;
}

/* ----- Gráficas del comprador ----- */
function renderDashboardCharts(role) {
  const donut = [["Consumo", 34], ["Libranza", 27], ["Comercial", 23], ["Hipotecaria", 16]];
  const statuses = [["Disponibles", 32, "active"], ["Con oferta", 14, "negotiation"], ["Adjudicadas", 8, "completed"]];
  return `
    <div class="dashboard-chart-grid">
      <div class="dashboard-chart-card dashboard-chart-large">
        ${renderBuyerProcess()}
      </div>
      <div class="dashboard-chart-card">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">MERCADO DISPONIBLE</div><h3>Tipos de oportunidad</h3></div><button class="chart-period" onclick="navigate(null,'mercado')">Ver mercado</button></div>
        ${svgDonut(donut, "32", "oportunidades", "dc")}
      </div>
      <div class="dashboard-chart-card">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">ACTIVIDAD</div><h3>Actividad de compras</h3></div><div class="chart-period">Mar — Sep</div></div>
        <div class="activity-chart">${renderActivityBars(role)}</div>
      </div>
      <div class="dashboard-chart-card">
        <div class="dashboard-chart-header"><div><div class="chart-kicker">SEGUIMIENTO</div><h3>Tu pipeline de compra</h3></div><button class="chart-period" onclick="navigate(null,'ofertas')">Mis ofertas</button></div>
        ${renderStatusBars(statuses)}
      </div>
    </div>`;
}

// A dónde lleva cada etapa del pipeline al hacer clic
const STATUS_TARGET = {
  "Disponibles": "mercado", "Con oferta": "ofertas", "Adjudicadas": "cierre",
  "En mercado": "subastas", "En subasta": "subastas", "En negociación": "ofertas", "En cierre": "cierre", "Cerradas": "cierre", "Vendidas": "cierre"
};

function renderStatusBars(statuses) {
  const total = statuses.reduce((s, x) => s + x[1], 0) || 1;
  return `<div class="status-summary premium">${statuses.map(([name, value, cls]) => `
    <div class="status-item clickable" role="button" tabindex="0" title="Ver ${name.toLowerCase()}" onclick="navigate(null,'${STATUS_TARGET[name] || "dashboard"}')">
      <div class="status-row"><div class="status-name"><span class="status-dot ${cls}"></span>${name}</div><strong>${value}<small>${Math.round(value / total * 100)}%</small></strong></div>
      <div class="status-progress ${cls}"><span style="width:${value / total * 100}%"></span></div>
    </div>`).join("")}
    <div class="status-total"><span>Total</span><strong>${statuses.reduce((s, x) => s + x[1], 0)}</strong></div>
  </div>`;
}

function renderActivityBars(role) {
  const values = role === "vendedor" ? [48, 55, 62, 70, 66, 81, 88] : [38, 46, 58, 52, 70, 64, 84];
  const labels = ["Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep"];
  return values.map((value, index) => `
    <div class="activity-column clickable ${index === values.length - 1 ? "current" : ""}" role="button" tabindex="0" title="Ver ofertas de ${labels[index]}" onclick="openActivityMonth('${labels[index]}', ${value})">
      <div class="activity-value" style="height:${value}%"><b>${value}</b></div>
      <span>${labels[index]}</span>
    </div>`).join("");
}

/* ----- Tabla de lotes ----- */
function renderLotsCard() {
  if (currentRole === "vendedor") return renderOriginatorLotsCard();

  const fav = new Set(appState.favorites);
  const items = [...buyerOpportunities].sort((a, b) => (fav.has(b.id) - fav.has(a.id)) || endKey(a) - endKey(b));
  return `
    <div class="card">
      <div class="card-header"><div><h3>Oportunidades disponibles</h3><p>Tus favoritas primero, luego las que cierran antes</p></div>
        <button class="btn btn-ghost btn-small" onclick="navigate(event,'mercado')">Ver todo</button>
      </div>
      <div class="table-wrap"><table><thead><tr>
        <th></th><th>Referencia del proceso</th><th>Tipo</th><th>Valor</th><th>Oferta más alta</th><th>Tiempo de subasta</th><th>Estado</th><th></th>
      </tr></thead><tbody>
        ${items.map(lot => {
          const top = topBid(lot.id);
          return `<tr>
            <td>${favButton(lot.id)}</td>
            <td><strong style="color:var(--navy);">${refOf(lot.id)}</strong>${lot.id === topSellerId() ? ' <span class="chip chip-hot">Más vendida</span>' : ""}</td>
            <td>${lot.type}</td><td><strong>${lot.amount}</strong></td>
            <td>${top ? top.percent + "%" : "—"}</td>
            <td><small class="cd-label">${cdLabel(lot.id)}</small> ${cdHtml(lot.id)}</td>
            <td><span class="badge ${lot.statusClass}">${lot.status}</span></td>
            <td><button class="btn btn-ghost btn-small" onclick="openDetail('${lot.id}')">Ver</button></td>
          </tr>`;
        }).join("")}
      </tbody></table></div>
    </div>`;
}

function renderOriginatorLotsCard() {
  return `
    <div class="card">
      <div class="card-header"><div><h3>Mis portafolios y operaciones</h3><p>Abre cada cartera para ver el detalle completo</p></div>
        <button class="btn btn-ghost btn-small" onclick="navigate(event,'cartera')">Ver todo</button>
      </div>
      <div class="table-wrap"><table><thead><tr>
        <th>Referencia del proceso</th><th>Valor</th><th>Tarifa</th><th>Mejor oferta</th><th>Cuenta regresiva</th><th>Modalidad</th><th>Estado</th><th></th>
      </tr></thead><tbody>
        ${originatorLots.map(lot => {
          const top = topBid(lot.id);
          const reserve = reserveOf(lot.id);
          return `<tr>
            <td><strong style="color:var(--navy);">${refOf(lot.id)}</strong></td>
            <td><strong>${lot.amount}</strong></td>
            <td>${reserve}%</td>
            <td>${top ? `${fmtM(parseLotAmount(lot) * top.percent / 100)} · ${top.percent}% ${reserveBadge(top.percent, reserve)}` : "Sin ofertas"}</td>
            <td>${cdHtml(lot.id)}</td>
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

  const isOrig = currentRole === "vendedor";
  const data = {
    cartera: { title: "Mis carteras", description: "Carteras publicadas por la entidad vendedora demo." },
    oportunidades: { title: isOrig ? "Casas de cobranza interesadas" : "Oportunidades", description: isOrig ? "Casas de cobranza demo que han mostrado interés en tus portafolios." : "Oportunidades disponibles para analizar y ofertar." },
    negociaciones: { title: isOrig ? "Negociaciones con casas de cobranza" : "Mis negociaciones", description: isOrig ? "Seguimiento a propuestas recibidas y contrapropuestas de tus portafolios." : "Seguimiento a tus propuestas y contrapropuestas." },
    mercado: { title: "Mercado de oportunidades", description: "Carteras de ejemplo disponibles para revisar y ofertar." },
    reportes: { title: "Reportes", description: "Indicadores simulados para validar visualizaciones." },
    pruebas: { title: "Centro de pruebas", description: "Herramientas para validar el prototipo sin usar datos reales." }
  };
  const current = data[page] || data.reportes;

  if (page === "pruebas") { content.innerHTML = renderTestCenter(); runSelfTests(false); return; }
  if (page === "ofertas") { content.innerHTML = renderOffersPage(); startCountdowns(); return; }
  if (page === "publicar") { content.innerHTML = renderPublishForm(); return; }
  if (page === "cierre") { content.innerHTML = renderClosingPage(); return; }
  if (isOrig && page === "oportunidades") { content.innerHTML = renderInterestPage(); return; }
  if (page === "subastas") { content.innerHTML = renderAuctionsPage(); startCountdowns(); return; }
  if (!isOrig && ["oportunidades", "mercado"].includes(page)) { content.innerHTML = renderMarketPage(current.title, current.description); startCountdowns(); return; }

  if (["cartera", "oportunidades", "mercado"].includes(page)) {
    const pool = isOrig ? originatorLots : buyerOpportunities;
    const items = pool.filter(passesFilters);
    if (appState.realMode && !pool.length) {
      content.innerHTML = `<div class="card page-card"><div class="section-kicker">MIS CARTERAS</div><h2>Mis carteras</h2>
        <div class="page-placeholder"><strong>Aún no has publicado carteras</strong><span>Publica la primera y B²GC Brokers la llevará a las casas de cobranza aprobadas.</span>
        <button class="btn btn-navy btn-small" style="margin-top:12px" onclick="navigate(null,'publicar')">＋ Publicar cartera</button></div></div>`;
      return;
    }
    content.innerHTML = `
      <div class="card page-card">
        <div class="section-kicker">${appState.realMode ? "DATOS REALES" : "DATOS DE PRUEBA"} · ${isOrig ? "VENDEDOR" : "COMPRADOR"}</div>
        ${isOrig ? `<button class="btn btn-navy btn-small" style="float:right" onclick="navigate(null,'publicar')">＋ Publicar cartera</button>` : ""}
        <h2>${current.title}</h2>
        <p>${current.description}</p>
        ${renderFilterBar(pool)}
        ${!items.length ? noMatches("cartera") : ""}
        <div class="test-lot-grid">
          ${items.map(lot => `
            <article class="test-lot-card clickable" role="button" tabindex="0" onclick="openDetail('${lot.id}')">
              <div class="lot-number">${refOf(lot.id)}</div>
              <h3>${lot.title}</h3>
              <span>${lot.type} · ${lot.modality}</span>
              <strong>${lot.amount}</strong>
              <div class="test-lot-timer"><small>${cdLabel(lot.id)}</small>${cdHtml(lot.id)}</div>
              <div class="test-lot-meta">
                <span class="badge ${lot.statusClass}">${lot.status}</span>
                <span>${fmtN(profileOf(lot).obligations)} obligaciones</span>
              </div>
              <button class="btn btn-ghost btn-small" onclick="event.stopPropagation();openDetail('${lot.id}')">Ver cartera</button>
            </article>`).join("")}
        </div>
      </div>`;
    startCountdowns();
    return;
  }

  if (page === "negociaciones") {
    const rows = !isOrig && appState.offers.length
      ? appState.offers
      : isOrig
        ? [
          { id: "NEG-ORIG-001", lotId: "LOTE-TEST-002", amount: "$2.754 M", status: "En revisión", date: "16 Sep 2026", counterparty: "Cobranzas Demo Andina" },
          { id: "NEG-ORIG-002", lotId: "LOTE-TEST-003", amount: "$5.220 M", status: "Contrapropuesta", date: "15 Sep 2026", counterparty: "Recaudos Demo Capital" }
        ]
        : [
          { id: "NEG-COMP-001", lotId: "LOTE-TEST-002", amount: "$2.754 M", status: "En revisión", date: "16 Sep 2026", counterparty: "Banco Demo S.A." },
          { id: "NEG-COMP-002", lotId: "LOTE-TEST-003", amount: "$5.017 M", status: "Contrapropuesta", date: "15 Sep 2026", counterparty: "Cooperativa Demo C" }
        ];

    content.innerHTML = `
      <div class="card page-card">
        <div class="section-kicker">PIPELINE DEMO</div>
        <h2>${current.title}</h2>
        <p>${current.description}</p>
        <div class="table-wrap page-table"><table>
          <thead><tr><th>Proceso</th><th>Referencia del proceso</th><th>Contraparte</th><th>Valor</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody>${rows.map(row => `<tr><td><strong>${row.id}</strong></td><td>${refOf(row.lotId)}</td><td>${row.counterparty || "Contraparte demo"}</td><td>${row.amount}</td><td><span class="badge badge-blue">${row.status}</span></td><td>${row.date}</td></tr>`).join("")}</tbody>
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
                  <span>${uploadedDoc ? "Archivo cargado" : "Documento de prueba"} · ${escapeHtml(doc.category || "General")} · ${escapeHtml(doc.lotId ? refOf(doc.lotId) : "Sin cartera asociada")}</span>
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
      lotId: pendingDocumentLotId || "", status: "Cargado", source: "upload",
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
  if (currentRole === "comprador") return renderBuyerAcquisitionsPage();
  const adjudications = [
    { id: "ADJ-ORIG-001", lot: "LOTE-TEST-001", buyer: "Casa de Cobranza Demo S.A.S.", value: "$3.977 M", status: "Adjudicada", date: "12 Sep 2026" },
    { id: "ADJ-ORIG-002", lot: "LOTE-TEST-002", buyer: "Cobranzas Demo Andina", value: "$2.754 M", status: "En cierre", date: "15 Sep 2026" },
    { id: "ADJ-ORIG-003", lot: "LOTE-TEST-003", buyer: "Recaudos Demo Capital", value: "$5.220 M", status: "Documental", date: "16 Sep 2026" }
  ];
  return `
    <div class="card page-card">
      <h2>Cierres de mis portafolios</h2>
      <p>Operaciones de tus portafolios que avanzan hacia cierre.</p>
      ${renderOpsMiniTable()}
      <div class="table-wrap page-table"><table><thead><tr><th>Adjudicación</th><th>Referencia del proceso</th><th>Casa de cobranza</th><th>Valor</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>
        ${adjudications.map(item => `<tr><td><strong>${item.id}</strong></td><td>${refOf(item.lot)}</td><td>${item.buyer}</td><td>${item.value}</td><td><span class="badge badge-green">${item.status}</span></td><td>${item.date}</td></tr>`).join("")}
      </tbody></table></div>
    </div>`;
}

/* Histórico de carteras adquiridas por la casa de cobranza */
function renderBuyerAcquisitionsPage() {
  const rows = buyerAcquisitions();
  const nominal = rows.reduce((s, r) => s + r.nominal, 0);
  const value = rows.reduce((s, r) => s + r.value, 0);
  const avgPrice = nominal ? value / nominal * 100 : 0;
  return `
    <div class="card page-card">
      <h2>Carteras adquiridas</h2>
      <p>Todas las carteras que has ganado: cuánto valían, qué porcentaje del nominal pagaste y el descuento que obtuviste.</p>
      ${rows.length ? `
      <div class="report-kpi-grid">
        <div class="report-kpi"><span>Carteras adquiridas</span><strong>${rows.length}</strong><small>${fmtM(nominal)} de valor nominal</small></div>
        <div class="report-kpi"><span>Valor pagado</span><strong>${fmtM(rows.reduce((s, r) => s + r.paid, 0))}</strong><small>${fmtM(value)} adjudicados</small></div>
        <div class="report-kpi"><span>Precio promedio</span><strong>${fmtPct(avgPrice)}</strong><small>del valor nominal</small></div>
        <div class="report-kpi"><span>Descuento promedio</span><strong>${fmtPct(100 - avgPrice)}</strong><small>100% menos el precio pagado</small></div>
      </div>
      <div class="table-wrap page-table"><table>
        <thead><tr><th>Referencia del proceso</th><th>Entidad vendedora</th><th>Tipo</th><th>Valor nominal</th><th>Precio pagado</th><th>Descuento</th><th>Valor</th><th>Estado</th><th>Fecha</th></tr></thead>
        <tbody>${rows.map(r => `<tr ${r.opId ? `class="clickable" role="button" tabindex="0" onclick="navigate(null,'cierre');openOperation('${r.opId}')"` : ""}>
          <td><strong>${refOf(r.lotId)}</strong><br><small style="color:var(--muted-2)">${escapeHtml(r.title)}</small></td>
          <td>${escapeHtml(r.vendedor)}</td><td>${escapeHtml(r.type)}</td><td>${fmtM(r.nominal)}</td>
          <td>${fmtPct(r.percent)}</td><td>${fmtPct(100 - r.percent)}</td><td>${fmtM(r.value)}</td>
          <td><span class="badge ${r.status === "Cerrada" ? "badge-green" : "badge-gold"}">${r.paid ? (r.status === "Cerrada" ? "Pagada y recibida" : "Pagada") : "Por pagar"}</span></td>
          <td>${r.date}</td>
        </tr>`).join("")}</tbody>
      </table></div>` : `
      <div class="page-placeholder"><strong>Aún no has adquirido carteras</strong><span>Cuando una entidad vendedora te adjudique una oferta, la verás aquí con su precio y su descuento.</span>
        <button class="btn btn-navy btn-small" style="margin-top:12px" onclick="navigate(null,'subastas')">Ver carteras en subasta</button></div>`}
    </div>`;
}

function renderReportsPage() {
  const isOriginator = currentRole === "vendedor";
  const items = isOriginator ? originatorLots : buyerOpportunities;
  const totalNominal = items.reduce((sum, lot) => sum + parseLotAmount(lot), 0);
  const active = items.filter(lot => /activa|nueva|abierto/i.test(lot.status)).length;
  const negotiations = items.filter(lot => /negociación/i.test(lot.status)).length;
  return `
    <div class="card page-card">
      <div class="section-kicker">REPORTES · ${isOriginator ? "VENDEDOR" : "COMPRADOR"}</div>
      <h2>${isOriginator ? "Reportes de cartera" : "Reportes de inversión"}</h2>
      <p>${isOriginator ? "Indicadores calculados sobre tus portafolios ficticios y su actividad comercial." : "Indicadores calculados sobre oportunidades, ofertas y adjudicaciones ficticias."}</p>
      <div class="report-kpi-grid">
        <div class="report-kpi"><span>${isOriginator ? "Valor de cartera propia" : "Valor de oportunidades"}</span><strong>${fmtM(totalNominal)}</strong><small>${items.length} registros demo</small></div>
        <div class="report-kpi"><span>${isOriginator ? "Portafolios activos" : "Oportunidades activas"}</span><strong>${active}</strong><small>Escenario actual</small></div>
        <div class="report-kpi"><span>${isOriginator ? "Negociaciones" : "Ofertas"}</span><strong>${isOriginator ? negotiations : appState.offers.length}</strong><small>${isOriginator ? "Con casas de cobranza demo" : "Registradas en este navegador"}</small></div>
        <div class="report-kpi"><span>${isOriginator ? "Casas de cobranza interesadas" : "Adjudicaciones"}</span><strong>${isOriginator ? "47" : "8"}</strong><small>Dato ficticio de prueba</small></div>
      </div>
      <div class="report-bars">
        ${items.map(lot => `<div class="report-bar-row"><span>${refOf(lot.id)}</span><div><i style="width:${Math.min(100, parseLotAmount(lot) / 89.5 * 100)}%"></i></div><strong>${lot.amount}</strong></div>`).join("")}
      </div>
    </div>`;
}

/* ----- Mis ofertas / Ofertas recibidas: segmentadas por lote, de la más alta a la más baja ----- */
function renderOffersPage() {
  return currentRole === "comprador" ? renderBuyerOffersPage() : renderSellerOffersPage();
}

function renderSellerOffersPage() {
  const groups = originatorLots.map(lot => ({ lot, bids: bidsFor(lot.id), reserve: reserveOf(lot.id) }));
  const all = groups.flatMap(g => g.bids.map(b => ({ ...b, reserve: g.reserve })));
  const above = all.filter(b => b.percent >= b.reserve).length;
  const below = all.filter(b => b.belowLast).length;
  const pending = all.filter(b => !b.decision).length;

  return `
    <div class="card page-card">
      <div class="section-kicker">ACTIVIDAD DEL VENDEDOR</div>
      <h2>Ofertas recibidas</h2>
      <p>Todas las ofertas con el detalle completo de cada casa de cobranza, ordenadas de la más alta a la más baja. Acepta o rechaza cada una.</p>
      <div class="report-kpi-grid">
        <div class="report-kpi"><span>Ofertas recibidas</span><strong>${all.length}</strong><small>${originatorLots.length} carteras</small></div>
        <div class="report-kpi"><span>Sobre tu tarifa</span><strong>${above}</strong><small>${all.length ? Math.round(above / all.length * 100) : 0}% del total</small></div>
        <div class="report-kpi warn"><span>Bajo la última ofertada</span><strong>${below}</strong><small>Quedaron bajo la oferta más alta previa</small></div>
        <div class="report-kpi"><span>Pendientes de decisión</span><strong>${pending}</strong><small>Aceptar o rechazar</small></div>
      </div>
      ${groups.map(({ lot, bids, reserve, op = operationForLot(lot.id) }) => `
        <section class="offer-group">
          <div class="offer-group-head">
            <div><div class="lot-number">${refOf(lot.id)} ${op ? `<span class="badge ${lot.statusClass}">${lot.status}</span>` : ""}</div><h3>${lot.title}</h3><span>${lot.amount} · ${lot.modality} · Tarifa ${reserve}%</span></div>
            <div class="offer-group-timer"><small>${cdLabel(lot.id)}</small>${cdHtml(lot.id, "big")}</div>
          </div>
          ${bids.length ? `<div class="table-wrap page-table"><table>
            <thead><tr><th>#</th><th>Casa de cobranza</th><th>Oferta</th><th>Valor</th><th>vs. tarifa</th><th>Alerta</th><th>Fecha</th><th>Decisión</th></tr></thead>
            <tbody>${bids.map((b, i) => `<tr class="${b.decision === "Rechazada" ? "row-muted" : ""}">
              <td><span class="rank ${i === 0 ? "first" : ""}">${i + 1}</span></td>
              <td><strong>${escapeHtml(b.buyer)}</strong>${b.note ? `<br><small style="color:var(--muted-2)">“${escapeHtml(b.note)}”</small>` : ""}</td>
              <td><strong>${b.percent}%</strong></td>
              <td>${fmtM(parseLotAmount(lot) * b.percent / 100)}</td>
              <td>${reserveBadge(b.percent, reserve, true)}</td>
              <td>${b.belowLast ? `<span class="chip chip-warn">⚠ Bajo la última (${b.prevBest}%)</span>` : `<span class="chip chip-ok">Mejora la puja</span>`}</td>
              <td>${fmtWhen(b)}</td>
              <td>${op
                ? (op.offerId === b.id
                  ? `<span class="badge badge-green">Adjudicada · ${op.id}</span> <button class="btn-text" onclick="openOperation('${op.id}')">Ver cierre</button>`
                  : '<span class="badge">No adjudicada</span>')
                : b.decision
                  ? `<span class="badge ${b.decision === "Aceptada" ? "badge-green" : "badge-red"}">${b.decision}</span> <button class="btn-text" onclick="decideOffer('${b.id}',null)">Deshacer</button>`
                  : `<div class="decision-actions"><button class="btn btn-blue-soft btn-small" onclick="uiAdjudicate('${b.id}')">Aceptar y adjudicar</button><button class="btn btn-danger-soft btn-small" onclick="decideOffer('${b.id}','Rechazada')">Rechazar</button></div>`}</td>
            </tr>`).join("")}</tbody>
          </table></div>` : `<div class="page-placeholder"><strong>Sin ofertas todavía</strong><span>Cuando una casa de cobranza oferte, aparecerá aquí.</span></div>`}
        </section>`).join("")}
    </div>`;
}

function renderBuyerOffersPage() {
  const myLots = [...new Set((appState.offers || []).map(o => o.lotId))].map(lotById).filter(Boolean);
  if (!myLots.length) {
    return `
      <div class="card page-card">
        <div class="section-kicker">ACTIVIDAD DEL COMPRADOR</div>
        <h2>Mis ofertas</h2>
        <div class="page-placeholder"><strong>Aún no has ofertado</strong><span>Entra a una cartera en subasta y usa “Presentar oferta”. Aquí verás todas las ofertas de la cartera, de la más alta a la más baja, con los demás postores en anónimo.</span>
          <button class="btn btn-navy btn-small" style="margin-top:12px" onclick="navigate(null,'subastas')">Ver carteras en subasta</button></div>
      </div>`;
  }

  return `
    <div class="card page-card">
      <div class="section-kicker">ACTIVIDAD DEL COMPRADOR</div>
      <h2>Mis ofertas</h2>
      <p>Todas las ofertas de cada subasta en la que participas, de la más alta a la más baja. Los demás postores aparecen en anónimo.</p>
      ${myLots.map(lot => {
        const bids = bidsFor(lot.id);
        const alias = anonymizer(lot.id);
        const myBest = bids.findIndex(b => b.own) + 1;
        return `
        <section class="offer-group">
          <div class="offer-group-head">
            <div><div class="lot-number">${refOf(lot.id)}</div><h3>${lot.title}</h3>
              <span>Tu mejor posición: <strong>${myBest} de ${bids.length}</strong> · ${bidderCount(lot.id)} postores</span></div>
            <div class="offer-group-timer"><small>${cdLabel(lot.id)}</small>${cdHtml(lot.id, "big")}</div>
          </div>
          <div class="table-wrap page-table"><table>
            <thead><tr><th>#</th><th>Postor</th><th>Oferta</th><th>Valor</th><th>Fecha</th><th>Estado</th></tr></thead>
            <tbody>${bids.map((b, i) => `<tr class="${b.own ? "row-own" : ""}">
              <td><span class="rank ${i === 0 ? "first" : ""}">${i + 1}</span></td>
              <td>${b.own ? "<strong>Tú</strong>" : alias(b.buyer)}</td>
              <td><strong>${b.percent}%</strong></td>
              <td>${fmtM(parseLotAmount(lot) * b.percent / 100)}</td>
              <td>${fmtWhen(b)}</td>
              <td>${b.own ? ownStatusBadge(b) : '<span style="color:var(--muted-2)">—</span>'}</td>
            </tr>`).join("")}</tbody>
          </table></div>
        </section>`;
      }).join("")}
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
        <button class="btn btn-gold" onclick="runClosingFlowTest(true)">Simular operación completa</button>
        <button class="btn btn-ghost" onclick="resetDemoData()">Restaurar datos</button>
        <button class="btn btn-ghost" onclick="showToast('Estado guardado en localStorage.')">Ver persistencia</button>
      </div>
      <div id="test-results" class="test-results"></div>
      <div class="test-credentials">
        <div><strong>Entidad vendedora demo</strong><span>vendedor@demo.b2gc.co</span><span>Demo123!</span></div>
        <div><strong>Casa de cobranza demo</strong><span>comprador@demo.b2gc.co</span><span>Demo123!</span></div>
      </div>
    </div>`;
}

function runSelfTests(showFeedback = true) {
  const results = [];
  const assert = (name, condition) => results.push({ name, ok: Boolean(condition) });

  assert("Existen las 5 carteras de prueba de base", lots.filter(l => !l.id.startsWith("LOTE-DEMO-")).length === 5);
  assert("Todas las carteras tienen referencia única", new Set(lots.map(lot => lot.id)).size === lots.length);
  assert("Todas las carteras tienen valor nominal", lots.every(lot => lot.amount.includes("$")));
  assert("Todas las carteras tienen modalidad", lots.every(lot => lot.modality));
  assert("Simulador puede calcular un valor", Number.isFinite(parseLotAmount(lots[0])));
  assert("El estado de ofertas es un arreglo", Array.isArray(appState.offers));
  assert("Las cuentas demo están configuradas", Object.values(demoAccounts).every(account => account.password));
  assert("Existen documentos demo consultables", testDocuments.length >= 5);
  assert("Los documentos demo tienen contenido", testDocuments.every(doc => doc.name && doc.content));
  assert("Los archivos cargados se manejan como arreglo", Array.isArray(appState.uploadedDocuments));
  assert("Cada cartera tiene obligaciones y cuenta regresiva", lots.every(lot => lotProfiles[lot.id]));
  assert("La composición de tipos suma 100%", Math.abs(composition.tipos.reduce((s, t) => s + t[1], 0) - 1) < 0.001 && Math.abs(composition.tipos.reduce((s, t) => s + t[2], 0) - 1) < 0.001);

  assert("Una operación completa cierra de punta a punta", runClosingFlowTest(false).ok);

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
  registerView(lot);

  const overlay = $("#detail-overlay");
  if (!overlay) return;
  overlay.classList.remove("hidden");

  if ($("#d-lot")) $("#d-lot").textContent = refOf(lot.id);
  if ($("#d-title")) $("#d-title").textContent = lot.title;

  renderDetailSummary(lot);
  renderSimulator(lot);
  if (lot.real) renderRealDataRoom(lot); else renderDataRoom(lot);
  showTab("resumen");
  startCountdowns();
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

  if (lot.real) { // cartera real: sin composición ficticia
    const mine = originatorLots.some(l => l.id === lot.id);
    panel.innerHTML = `
      ${renderAuctionBanner(lot)}
      <div class="summary-metrics">
        ${detailMetric("Valor nominal", lot.amount)}
        ${detailMetric("Número de deudores", lot.debtors)}
        ${detailMetric("Número de obligaciones", fmtN(p.obligations))}
        ${detailMetric("Modalidad", lot.modality)}
      </div>
      <div class="summary-block" style="margin-top:22px"><div class="meta-line">Publicada por</div><p style="margin-top:6px;color:var(--navy);font-weight:700">${escapeHtml(lot.vendedor)} · vía B²GC Brokers</p></div>
      ${lot.description ? `<div class="summary-block" style="margin-top:14px"><div class="meta-line">Descripción</div><p style="margin-top:6px;color:var(--ink-2);font-size:13px;line-height:1.6;white-space:pre-line">${escapeHtml(lot.description)}</p></div>` : ""}
      <p style="margin-top:14px;color:var(--muted);font-size:12px">Revisa la pestaña <strong>Data room</strong> para descargar la base anonimizada y los soportes.</p>
      <div style="margin-top:25px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-navy" onclick="makeOffer('${lot.id}')">${mine ? "Ver ofertas recibidas" : "Presentar oferta"}</button>
        ${mine && lot.dbStatus === "publicada" ? `<button class="btn btn-danger-soft" onclick="cancelPortfolio('${lot.id}')">Retirar del mercado</button>` : ""}
      </div>`;
    return;
  }

  const bars = (rows, total, unit) => rows.map(r => `
    <div class="report-bar-row">
      <span>${r[0]}</span>
      <div><i style="width:${r[1] * 100}%"></i></div>
      <strong>${fmtN(total * r[1])} ${unit} · ${(r[1] * 100).toFixed(0)}%</strong>
    </div>`).join("");

  const block = (title, body) => `
    <div class="summary-block">
      <div class="section-kicker">${title}</div>
      <div class="report-bars">${body}</div>
    </div>`;

  panel.innerHTML = `
    ${renderAuctionBanner(lot)}
    <div class="summary-metrics">
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

    <div class="summary-blocks">
    ${block("RANGOS DE MORA Y CASTIGO", bars(c.mora, p.obligations, "oblig."))}
    ${block("UBICACIÓN GEOGRÁFICA (CIUDAD)", bars(c.ciudades, p.obligations, "oblig."))}
    ${block("OBLIGACIONES POR RANGO DE CAPITAL", bars(c.rangos, p.obligations, "oblig."))}
    ${block("OBLIGACIONES POR CLIENTE", bars(c.obligPorCliente, debtors, "clientes"))}
    ${block("TIPO DE CLIENTE", bars(c.tipoCliente, debtors, "clientes"))}
    ${block("ESTADO DE SOPORTES Y LOCALIZACIÓN", c.soportes.map(s => `<div class="report-bar-row"><span>${s[0]}</span><div><i style="width:${s[1]}%"></i></div><strong>${s[1]}%</strong></div>`).join(""))}
    </div>

    <div style="margin-top:25px;">
      <button class="btn btn-navy" onclick="makeOffer('${lot.id}')">
        ${currentRole === "comprador" ? "Presentar oferta" : "Ver ofertas recibidas"}
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
        <div class="simulator-lot"><span>${refOf(lot.id)}</span><strong>${lot.type}</strong></div>
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
          <div class="metric-caption">Valor estimado de la oferta</div>
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
    closeDetail();
    navigate(null, "ofertas");
    return;
  }

  $("#offer-overlay")?.remove();
  const numericValue = parseLotAmount(lot);
  const top = topBid(lot.id);
  const closed = auctionState(lot.id) === "cerrada";
  const start = top ? Math.min(100, +(top.percent + 0.5).toFixed(1)) : 82;

  const overlay = document.createElement("div");
  overlay.id = "offer-overlay";
  overlay.className = "offer-overlay";
  overlay.innerHTML = `
    <div class="offer-modal">
      <button class="detail-close" type="button" aria-label="Cerrar" onclick="closeOfferModal()">×</button>
      <div class="section-kicker">NUEVA OFERTA · ${lot.modality.toUpperCase()}</div>
      <h2>Presentar oferta</h2>
      <p>${refOf(lot.id)} · ${lot.title}</p>
      <div class="offer-auction-strip">
        <div><small>${cdLabel(lot.id)}</small>${cdHtml(lot.id)}</div>
        <div><small>Última oferta más alta</small><strong>${top ? top.percent + "%" : "Sin ofertas"}</strong></div>
        <div><small>Postores</small><strong>${bidderCount(lot.id)}</strong></div>
      </div>
      <div class="offer-summary"><span>Valor nominal</span><strong>${lot.amount}</strong></div>
      <label class="offer-field"><span>Porcentaje de compra</span>
        <input id="offer-form-percent" type="number" min="0.1" max="100" step="0.1" value="${start}" ${closed ? "disabled" : ""}>
      </label>
      <div id="offer-alert" class="offer-alert hidden" role="alert"></div>
      <label class="offer-field"><span>Comentario</span>
        <textarea id="offer-form-note" rows="3" placeholder="Comentario opcional para el vendedor"></textarea>
      </label>
      <div class="offer-preview"><span>Valor estimado</span><strong id="offer-form-value">$0 M</strong></div>
      <div class="offer-actions">
        <button class="btn btn-ghost" onclick="closeOfferModal()">Cancelar</button>
        <button class="btn btn-navy" id="offer-submit" onclick="submitOffer('${lot.id}')" ${closed ? "disabled" : ""}>${closed ? "Subasta cerrada" : "Enviar oferta"}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  startCountdowns();

  const input = $("#offer-form-percent");
  const updatePreview = () => {
    const percent = Math.min(100, Math.max(0.1, Number(input?.value) || 0.1));
    const output = $("#offer-form-value");
    if (output) output.textContent = fmtM(numericValue * percent / 100);

    const alertBox = $("#offer-alert");
    const submit = $("#offer-submit");
    if (!alertBox || closed) return;
    alertBox.classList.remove("hidden", "warn", "ok");
    if (top && percent < top.percent) {
      alertBox.classList.add("warn");
      alertBox.innerHTML = `<strong>⚠ Tu oferta está por debajo de la última ofertada (${top.percent}%).</strong><span>Puedes enviarla, pero el vendedor decidirá si la acepta o la rechaza.</span>`;
      if (submit) submit.textContent = "Enviar de todas formas";
    } else {
      alertBox.classList.add("ok");
      alertBox.innerHTML = top
        ? `<strong>✓ Superas la última oferta (${top.percent}%).</strong><span>Quedarías en el primer lugar de la subasta.</span>`
        : `<strong>✓ Serías la primera oferta de esta cartera.</strong>`;
      if (submit) submit.textContent = "Enviar oferta";
    }
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
  if (auctionState(lot.id) === "cerrada") { showToast("La subasta de esta cartera ya cerró."); return; }
  if (lot.real) { realPlaceBid(lot, +percent.toFixed(1), note); return; }

  const top = topBid(lot.id);
  const belowLast = !!(top && percent < top.percent);
  const offerValue = parseLotAmount(lot) * percent / 100;
  const nextNumber = appState.offers.reduce((max, o) => Math.max(max, Number(String(o.id).split("-").pop()) || 0), 0) + 1;
  const offer = {
    id: `OF-TEST-${String(nextNumber).padStart(3, "0")}`,
    lotId: lot.id,
    amount: fmtM(offerValue),
    percent: +percent.toFixed(1),
    note,
    status: belowLast ? "Bajo la última · pendiente del vendedor" : "Enviada",
    date: new Date().toLocaleDateString("es-CO"),
    at: Date.now(),
    buyer: appState.company || "Casa de Cobranza Demo S.A.S.",
    submittedByRole: currentRole
  };

  appState.offers.unshift(offer);
  saveDemoState();
  closeOfferModal();
  closeDetail();
  showToast(belowLast
    ? `Oferta ${offer.id} enviada por debajo de la última (${top.percent}%). El vendedor decidirá.`
    : `Oferta ${offer.id} enviada. Vas de primero.`);
  if (currentPage === "ofertas" || currentPage === "subastas") renderPage(currentPage);
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
   GRÁFICA DE TENDENCIA (HERO) CON LÍNEA DE TIEMPO
   ========================================================= */
const HERO_SERIES = [ // [mes, valor publicado en M COP] — DEMO
  ["Nov 25", 9200], ["Dic 25", 9800], ["Ene 26", 10400], ["Feb 26", 11000], ["Mar 26", 11600], ["Abr 26", 12400],
  ["May 26", 13200], ["Jun 26", 14800], ["Jul 26", 15600], ["Ago 26", 16900], ["Sep 26", 17500], ["Oct 26", 18420]
];

function renderHeroChart(range = 6) {
  const box = $("#hero-chart");
  if (!box) return;
  const data = HERO_SERIES.slice(-range);
  const vals = data.map(d => d[1]);
  const step = 2500;
  const lo = Math.floor(Math.min(...vals) / step) * step;
  const hi = Math.ceil(Math.max(...vals) / step) * step;
  const pos = data.map((d, i) => [i / (data.length - 1) * 100, 100 - (d[1] - lo) / (hi - lo) * 100]);
  const line = pos.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const ticks = []; for (let v = hi; v >= lo; v -= step) ticks.push(v);
  const fmt = v => "$" + v.toLocaleString("es-CO") + " M";
  const first = vals[0], last = vals[vals.length - 1];

  $$("#trend-range button").forEach(b => b.classList.toggle("active", Number(b.dataset.range) === range));
  const tv = $("#trend-value"), tc = $("#trend-change");
  if (tv) tv.textContent = fmt(last);
  if (tc) tc.textContent = `↗ +${((last / first - 1) * 100).toFixed(1)}% en ${range} meses`;

  box.innerHTML = `
    <div class="trend-y">${ticks.map(t => `<span>${(t / 1000).toLocaleString("es-CO", { maximumFractionDigits: 1 })}k M</span>`).join("")}</div>
    <div class="trend-plot">
      <div class="trend-grid">${ticks.map(() => "<i></i>").join("")}</div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path class="trend-area" d="${line} L100,100 L0,100 Z"></path>
        <path class="trend-line" d="${line}"></path>
      </svg>
      ${pos.map(([x, y], i) => `
        <button type="button" class="trend-dot ${i === pos.length - 1 ? "last" : ""}" style="left:${x}%;top:${y}%"
          aria-label="${data[i][0]}: ${fmt(data[i][1])}">
          <span class="trend-tip"><b>${data[i][0]}</b>${fmt(data[i][1])}</span>
        </button>`).join("")}
    </div>
    <div class="trend-x">${data.map((d, i) => `<span style="left:${pos[i][0]}%">${d[0]}</span>`).join("")}</div>`;
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
  if ((event.key === "Enter" || event.key === " ") && event.target?.matches?.('[role="button"][onclick]')) {
    event.preventDefault();
    event.target.click();
    return;
  }
  if (event.key !== "Escape") return;
  closeAuth();
  closeDetail();
  closeOfferModal();
  closeDocumentViewer();
  $("#modality-overlay")?.remove();
});

document.addEventListener("DOMContentLoaded", () => {
  (appState.demoPortfolios || []).forEach(addDemoPortfolio);
  buildSidebar();
  renderHeroChart(6);
  if (location.hash === "#admin" && typeof openAdminLogin === "function") openAdminLogin();
  initReveal();

  if (appState.loggedIn) {
    $("#public-site")?.classList.add("hidden");
    $("#app-shell")?.classList.remove("hidden");
    setRole(currentRole);
  }
});
