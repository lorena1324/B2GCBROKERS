/* =========================================================
   B²GC BROKERS — ADMIN.JS
   Registro de empresas (RUT, Cámara de Comercio, CC del
   representante legal en PDF) + panel de administración
   para aprobar y otorgar usuarios.

   ⚠ PROTOTIPO: todo vive en este navegador (localStorage +
   IndexedDB). Para producción esto debe ir en un backend:
   contraseñas con hash, archivos en almacenamiento privado,
   autenticación en servidor y envío real de correos.
   ========================================================= */

const COMPANIES_KEY = "b2gc_companies_v1";
const FILES_DB = "b2gc_files_v1";
const MAX_PDF = 3 * 1024 * 1024; // 3 MB por archivo

/* Administrador de pruebas — cambiar/eliminar en producción */
const ADMIN_ACCOUNT = { email: "admin@b2gc.co", password: "Admin123!", name: "Administrador B²GC" };

const REQUIRED_DOCS = [
  { key: "rut", label: "RUT", hint: "Registro Único Tributario vigente" },
  { key: "camara", label: "Cámara de Comercio", hint: "Certificado de existencia y representación legal" },
  { key: "cc", label: "Cédula del representante legal", hint: "Documento de identidad, ambas caras" }
];

/* ===== Almacenamiento ===== */
function loadCompanies() {
  try {
    // Migración: el rol "originador" ahora se llama "vendedor"
    return JSON.parse(localStorage.getItem(COMPANIES_KEY) || "[]")
      .map(c => c.role === "originador" ? { ...c, role: "vendedor" } : c);
  } catch { return []; }
}
function saveCompanies(list) {
  localStorage.setItem(COMPANIES_KEY, JSON.stringify(list));
}

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FILES_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function putFile(key, blob) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(blob, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function getFile(key) {
  const db = await idb();
  return new Promise((res, rej) => {
    const r = db.transaction("files").objectStore("files").get(key);
    r.onsuccess = () => res(r.result || null);
    r.onerror = () => rej(r.error);
  });
}

/* Abre el login con las credenciales de administrador de pruebas */
function openAdminLogin() {
  openAuth("login");
  const e = $("#auth-email"), p = $("#auth-password");
  if (e) e.value = ADMIN_ACCOUNT.email;
  if (p) p.value = ADMIN_ACCOUNT.password;
  showToast("Credenciales de administrador cargadas. Pulsa “Entrar a la plataforma”.");
}

/* ===== Autenticación ===== */
function authenticate(email, password) {
  if (email === ADMIN_ACCOUNT.email) {
    return password === ADMIN_ACCOUNT.password
      ? { admin: true }
      : { error: "Contraseña de administrador incorrecta." };
  }

  const company = loadCompanies().find(c => c.user && c.user.email === email);
  if (company) {
    if (company.user.password !== password) return { error: "Correo o contraseña incorrectos." };
    if (company.status === "suspendida") return { error: "Tu cuenta está suspendida. Escríbenos a contacto@b2gcbrokers.co." };
    return {
      role: company.role,
      company: company.name,
      avatar: initials(company.name),
      demo: false,
      companyId: company.id,
      email
    };
  }

  const pending = loadCompanies().find(c => (c.email || "").toLowerCase() === email && c.status !== "aprobada");
  if (pending) {
    return {
      error: pending.status === "rechazada"
        ? "Tu solicitud fue rechazada. Revisa tu correo o contáctanos."
        : "Tu solicitud sigue en revisión. Te asignaremos usuario cuando se apruebe."
    };
  }

  // Cuentas demo (entorno de pruebas): el rol sale del correo
  const entry = Object.entries(demoAccounts).find(([, a]) => a.email === email);
  if (entry && password === entry[1].password) {
    const [role, demo] = entry;
    return { role, company: demo.company, avatar: demo.avatar, demo: true, email };
  }
  return { error: entry ? "Contraseña incorrecta para la cuenta demo." : "No encontramos esa cuenta." };
}

function initials(name) {
  return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

/* =========================================================
   REGISTRO DE EMPRESA
   ========================================================= */
const ENTITY_OPTIONS = {
  vendedor: [["banco", "Banco"], ["fintech", "Fintech"], ["cooperativa", "Cooperativa"], ["otro", "Otra entidad financiera"]],
  comprador: [["casa_cobranza", "Casa de cobranza"], ["otro", "Otro comprador de cartera"]]
};

function openRegister() {
  $("#register-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "register-overlay";
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="modal modal-wrap register-modal">
      <button type="button" class="modal-close" onclick="closeRegister()">×</button>
      <div class="modal-brand">B<span>2</span>GC</div>
      <h2>Registrar mi empresa</h2>
      <p class="sub">Crea tu cuenta. Después de confirmar tu correo subirás el RUT, la Cámara de Comercio y la cédula del representante legal; B²GC Brokers revisa y aprueba tu empresa.</p>

      <div class="role-pick" id="reg-role-pick">
        <div class="role-opt active" data-role="vendedor" onclick="pickRegRole(this)">
          <strong>Soy entidad vendedora</strong><small>Banco, fintech o cooperativa</small>
        </div>
        <div class="role-opt" data-role="comprador" onclick="pickRegRole(this)">
          <strong>Soy casa de cobranza</strong><small>Compro cartera para cobrarla</small>
        </div>
      </div>

      <div class="form-grid">
        <div class="field"><label for="reg-entity">Tipo de entidad *</label><select id="reg-entity">${ENTITY_OPTIONS.vendedor.map(o => `<option value="${o[0]}">${o[1]}</option>`).join("")}</select></div>
        <div class="field"><label for="reg-name">Razón social *</label><input id="reg-name" type="text" placeholder="Mi Empresa S.A.S."></div>
        <div class="field"><label for="reg-nit">NIT *</label><input id="reg-nit" type="text" inputmode="numeric" placeholder="900.123.456-7"></div>
        <div class="field"><label for="reg-contact">Representante legal *</label><input id="reg-contact" type="text" placeholder="Nombre completo"></div>
        <div class="field"><label for="reg-city">Ciudad</label><input id="reg-city" type="text" placeholder="Bogotá"></div>
        <div class="field"><label for="reg-phone">Celular / WhatsApp *</label><input id="reg-phone" type="tel" placeholder="300 000 0000"></div>
        <div class="field"><label for="reg-email">Correo corporativo *</label><input id="reg-email" type="email" placeholder="nombre@empresa.com" autocomplete="email"></div>
        <div class="field"><label for="reg-password">Contraseña * <small>(mín. 8 caracteres)</small></label><input id="reg-password" type="password" autocomplete="new-password"></div>
        <div class="field"><label for="reg-password2">Confirmar contraseña *</label><input id="reg-password2" type="password" autocomplete="new-password"></div>
      </div>

      <label class="consent">
        <input type="checkbox" id="reg-consent">
        <span>Autorizo el tratamiento de los datos y documentos con fines de verificación (Ley 1581 de 2012).</span>
      </label>

      <button type="button" class="btn btn-navy" style="width:100%;" id="reg-submit" onclick="submitRegistration()">Crear cuenta →</button>
      <p class="modal-switch">¿Ya tienes cuenta? <button type="button" class="btn-text" onclick="closeRegister();openAuth('login')">Inicia sesión</button></p>
    </div>`;
  overlay.addEventListener("click", e => { if (e.target === overlay) closeRegister(); });
  document.body.appendChild(overlay);
}

function closeRegister() { $("#register-overlay")?.remove(); }

function pickRegRole(el) {
  $$("#reg-role-pick .role-opt").forEach(o => o.classList.remove("active"));
  el.classList.add("active");
  const select = $("#reg-entity");
  if (select) select.innerHTML = ENTITY_OPTIONS[el.dataset.role].map(o => `<option value="${o[0]}">${o[1]}</option>`).join("");
}

async function submitRegistration() {
  const v = id => ($(id)?.value || "").trim();
  const role = $("#reg-role-pick .role-opt.active")?.dataset.role || "vendedor";
  const data = {
    role, entityType: v("#reg-entity"), name: v("#reg-name"), nit: v("#reg-nit"), contactName: v("#reg-contact"),
    city: v("#reg-city"), email: v("#reg-email").toLowerCase(), phone: v("#reg-phone"), password: $("#reg-password")?.value || ""
  };

  if (!data.name || !data.nit || !data.contactName || !data.email || !data.phone) { showToast("Completa los campos obligatorios (*)."); return; }
  if (!/^\S+@\S+\.\S+$/.test(data.email)) { showToast("Revisa el formato del correo."); return; }
  if (data.nit.replace(/\D/g, "").length < 8) { showToast("El NIT parece incompleto."); return; }
  if (data.password.length < 8) { showToast("La contraseña debe tener al menos 8 caracteres."); return; }
  if (data.password !== ($("#reg-password2")?.value || "")) { showToast("Las contraseñas no coinciden."); return; }
  if (!$("#reg-consent")?.checked) { showToast("Debes autorizar el tratamiento de datos."); return; }
  if (isDemoEmail(data.email)) { showToast("Ese correo es de una cuenta demo. Usa el correo real de tu empresa."); return; }

  const btn = $("#reg-submit");
  btn.disabled = true; btn.textContent = "Creando cuenta…";
  const res = await realSignUp(data); // real.js
  if (res.error) { btn.disabled = false; btn.textContent = "Crear cuenta →"; showToast(res.error); return; }
  if (res.session) return;

  $("#register-overlay .register-modal").innerHTML = `
    <div class="register-success">
      <div class="success-mark">✓</div>
      <h2>Revisa tu correo</h2>
      <p>Enviamos un enlace de confirmación a <strong>${escapeHtml(data.email)}</strong>.</p>
      <p class="muted">Ábrelo, vuelve aquí e inicia sesión para subir los documentos de <strong>${escapeHtml(data.name)}</strong>. B²GC Brokers los revisará y aprobará tu empresa.</p>
      <button type="button" class="btn btn-navy" onclick="closeRegister();openAuth('login')">Ir a iniciar sesión</button>
    </div>`;
}

/* =========================================================
   PANEL DE ADMINISTRACIÓN
   ========================================================= */
let adminFilter = null; // se decide al abrir: pendientes si hay, si no todas
let adminView = "solicitudes"; // "solicitudes" | "subastas"

function setAdminView(view) { adminView = view; renderAdmin(); }

function openAdminPanel() {
  appState.loggedIn = false;
  $("#public-site")?.classList.add("hidden");
  $("#app-shell")?.classList.add("hidden");
  let shell = $("#admin-shell");
  if (!shell) {
    shell = document.createElement("div");
    shell.id = "admin-shell";
    document.body.appendChild(shell);
  }
  shell.classList.remove("hidden");
  renderAdmin();
  showToast("Panel de administración.");
}

function closeAdminPanel() {
  $("#admin-shell")?.classList.add("hidden");
  $("#admin-review")?.remove();
  $("#public-site")?.classList.remove("hidden");
  window.scrollTo({ top: 0 });
}

const STATUS_LABEL = { pendiente: "Pendiente", aprobada: "Aprobada", rechazada: "Rechazada", suspendida: "Suspendida" };
const STATUS_CLASS = { pendiente: "badge-gold", aprobada: "badge-green", rechazada: "badge-red", suspendida: "badge-red" };

function renderAdmin() {
  const shell = $("#admin-shell");
  if (!shell) return;
  if (adminView === "subastas") { renderAdminAnalytics(shell); return; }
  const all = loadCompanies();
  if (!adminFilter) adminFilter = all.some(c => c.status === "pendiente") ? "pendiente" : "todas";
  const count = s => all.filter(c => c.status === s).length;
  const rows = adminFilter === "todas" ? all : all.filter(c => c.status === adminFilter);
  const tabs = [["pendiente", "Pendientes"], ["aprobada", "Aprobadas"], ["rechazada", "Rechazadas"], ["suspendida", "Suspendidas"], ["todas", "Todas"]];

  shell.innerHTML = `
    ${adminHeader()}

    <main class="admin-main">
      <div class="section-kicker">GESTIÓN DE ACCESOS</div>
      <h2 class="admin-h2">Solicitudes de empresas</h2>
      <p class="admin-sub">Revisa el RUT, la Cámara de Comercio y la cédula del representante legal; luego aprueba y entrega el usuario a la empresa.</p>

      <div class="kpi-grid">
        ${kpiCard("Pendientes de revisión", count("pendiente"), "Requieren tu atención", "up")}
        ${kpiCard("Empresas aprobadas", count("aprobada"), "Con usuario activo", "up")}
        ${kpiCard("Rechazadas", count("rechazada"), "No cumplieron requisitos", "down")}
        ${kpiCard("Total de solicitudes", all.length, "Histórico en este navegador", "up")}
      </div>

      <div class="admin-tabs">
        ${tabs.map(t => `<button class="${adminFilter === t[0] ? "active" : ""}" onclick="setAdminFilter('${t[0]}')">${t[1]}${t[0] !== "todas" ? ` <b>${count(t[0])}</b>` : ""}</button>`).join("")}
      </div>

      <div class="card">
        ${rows.length ? `
        <div class="table-wrap"><table><thead><tr>
          <th>Radicado</th><th>Empresa</th><th>NIT</th><th>Tipo</th><th>Contacto</th><th>Fecha</th><th>Estado</th><th></th>
        </tr></thead><tbody>
          ${rows.map(c => `<tr>
            <td><strong style="color:var(--navy)">${c.id}</strong></td>
            <td><strong>${escapeHtml(c.name)}</strong><br><small style="color:var(--muted-2)">${escapeHtml(c.city || "—")}</small></td>
            <td>${escapeHtml(c.nit)}</td>
            <td>${c.role === "vendedor" ? "Entidad vendedora" : "Casa de cobranza"}</td>
            <td>${escapeHtml(c.contactName)}<br><small style="color:var(--muted-2)">${escapeHtml(c.email)}</small></td>
            <td>${new Date(c.createdAt).toLocaleDateString("es-CO")}</td>
            <td><span class="badge ${STATUS_CLASS[c.status]}">${STATUS_LABEL[c.status]}</span></td>
            <td><button class="btn btn-ghost btn-small" onclick="openReview('${c.id}')">${c.status === "pendiente" ? "Revisar" : "Ver"}</button></td>
          </tr>`).join("")}
        </tbody></table></div>` : `
        <div class="page-placeholder" style="margin:22px"><strong>No hay solicitudes en esta vista</strong>
          <span>Cuando una empresa se registre desde “Registrar mi empresa”, aparecerá aquí.</span></div>`}
      </div>

      <div class="admin-foot">
        <button class="btn btn-ghost btn-small" onclick="seedDemoRequests()">Cargar solicitudes de ejemplo</button>
        <span>Prototipo: los datos viven solo en este navegador.</span>
      </div>
    </main>`;
}

function setAdminFilter(f) { adminFilter = f; renderAdmin(); }

/* ----- Revisión de una solicitud ----- */
function openReview(id) {
  const c = loadCompanies().find(x => x.id === id);
  if (!c) return;
  $("#admin-review")?.remove();

  const pend = c.status === "pendiente";
  const el = document.createElement("div");
  el.id = "admin-review";
  el.className = "overlay";
  el.innerHTML = `
    <div class="modal modal-wrap review-modal">
      <button type="button" class="modal-close" onclick="closeReview()">×</button>
      <div class="section-kicker">${c.id} · ${c.role === "vendedor" ? "VENDEDOR" : "COMPRADOR"}</div>
      <h2 style="margin-bottom:4px">${escapeHtml(c.name)}</h2>
      <span class="badge ${STATUS_CLASS[c.status]}">${STATUS_LABEL[c.status]}</span>

      <div class="review-grid">
        <div><span>NIT</span><strong>${escapeHtml(c.nit)}</strong></div>
        <div><span>Representante legal</span><strong>${escapeHtml(c.contactName)}</strong></div>
        <div><span>Correo</span><strong>${escapeHtml(c.email)}</strong></div>
        <div><span>Celular</span><strong>${escapeHtml(c.phone)}</strong></div>
        <div><span>Ciudad</span><strong>${escapeHtml(c.city || "—")}</strong></div>
        <div><span>Radicada</span><strong>${new Date(c.createdAt).toLocaleString("es-CO")}</strong></div>
      </div>

      <div class="doc-upload-title">Documentos</div>
      <div class="review-docs">
        ${REQUIRED_DOCS.map(d => {
          const f = c.docs?.[d.key];
          return `<div class="review-doc">
            <div class="doc-upload-icon">PDF</div>
            <div class="doc-upload-text"><strong>${d.label}</strong><span class="doc-upload-file">${f ? `${escapeHtml(f.name)} · ${formatFileSize(f.size)}` : "No disponible"}</span></div>
            ${f ? `<div class="review-doc-actions">
              <button class="btn btn-ghost btn-small" onclick="viewCompanyDoc('${c.id}','${d.key}')">Ver</button>
              <button class="btn btn-ghost btn-small" onclick="downloadCompanyDoc('${c.id}','${d.key}')">Descargar</button>
            </div>` : ""}
            ${pend ? `<label class="review-check" title="Marca cuando verifiques el documento"><input type="checkbox" class="rv-check"><span>Verificado</span></label>` : ""}
          </div>`;
        }).join("")}
      </div>

      ${c.user ? `
        <div class="cred-box">
          <div class="doc-upload-title" style="margin:0 0 8px">Usuario asignado</div>
          <div><span>Usuario</span><strong>${escapeHtml(c.user.email)}</strong></div>
          <div><span>Contraseña</span><strong>${escapeHtml(c.user.password)}</strong></div>
          <div class="cred-actions">
            <button class="btn btn-ghost btn-small" onclick="copyCredentials('${c.id}')">Copiar credenciales</button>
            <button class="btn btn-ghost btn-small" onclick="resetCompanyPassword('${c.id}')">Generar nueva contraseña</button>
            ${c.status === "aprobada"
              ? `<button class="btn btn-danger-soft btn-small" onclick="setCompanyStatus('${c.id}','suspendida')">Suspender acceso</button>`
              : `<button class="btn btn-blue-soft btn-small" onclick="setCompanyStatus('${c.id}','aprobada')">Reactivar acceso</button>`}
          </div>
        </div>` : ""}

      ${c.reviewNote ? `<div class="page-placeholder" style="margin-top:14px"><strong>Motivo / nota</strong><span>${escapeHtml(c.reviewNote)}</span></div>` : ""}

      ${pend ? `
        <div class="field" style="margin-top:18px"><label for="rv-user">Usuario a otorgar</label>
          <input id="rv-user" type="email" value="${escapeHtml(c.email)}"></div>
        <div class="field"><label for="rv-note">Motivo (obligatorio solo si rechazas)</label>
          <textarea id="rv-note" rows="2" placeholder="Ej: RUT ilegible, Cámara de Comercio vencida…"></textarea></div>
        <div class="offer-actions">
          <button class="btn btn-danger-soft" onclick="rejectCompany('${c.id}')">Rechazar</button>
          <button class="btn btn-navy" onclick="approveCompany('${c.id}')">Aprobar y crear usuario</button>
        </div>` : ""}
    </div>`;
  el.addEventListener("click", e => { if (e.target === el) closeReview(); });
  document.body.appendChild(el);
}

function closeReview() { $("#admin-review")?.remove(); }

async function companyDocBlob(id, key) { return getFile(`${id}:${key}`); }

async function viewCompanyDoc(id, key) {
  const blob = await companyDocBlob(id, key);
  if (!blob) { showToast("Archivo no encontrado en este navegador."); return; }
  const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function downloadCompanyDoc(id, key) {
  const blob = await companyDocBlob(id, key);
  const c = loadCompanies().find(x => x.id === id);
  if (!blob || !c) { showToast("Archivo no encontrado en este navegador."); return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${id}-${key}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(10);
  crypto.getRandomValues(buf);
  return Array.from(buf, n => chars[n % chars.length]).join("") + "!";
}

function approveCompany(id) {
  const checks = $$("#admin-review .rv-check");
  if ([...checks].some(c => !c.checked)) { showToast("Marca como verificados los tres documentos antes de aprobar."); return; }
  const userEmail = ($("#rv-user")?.value || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(userEmail)) { showToast("El usuario debe ser un correo válido."); return; }

  const list = loadCompanies();
  if (list.some(c => c.id !== id && c.user && c.user.email === userEmail) || userEmail === ADMIN_ACCOUNT.email) {
    showToast("Ese usuario ya está en uso."); return;
  }
  const c = list.find(x => x.id === id);
  c.status = "aprobada";
  c.user = { email: userEmail, password: genPassword() };
  c.reviewedAt = new Date().toISOString();
  c.reviewNote = ($("#rv-note")?.value || "").trim();
  saveCompanies(list);
  renderAdmin();
  openReview(id);
  showToast("Empresa aprobada. Copia las credenciales y envíaselas.");
}

function rejectCompany(id) {
  const note = ($("#rv-note")?.value || "").trim();
  if (!note) { showToast("Escribe el motivo del rechazo."); return; }
  const list = loadCompanies();
  const c = list.find(x => x.id === id);
  c.status = "rechazada"; c.reviewNote = note; c.reviewedAt = new Date().toISOString();
  saveCompanies(list);
  closeReview(); renderAdmin();
  showToast("Solicitud rechazada.");
}

function setCompanyStatus(id, status) {
  const list = loadCompanies();
  const c = list.find(x => x.id === id);
  if (!c) return;
  c.status = status;
  saveCompanies(list);
  renderAdmin(); openReview(id);
  showToast(status === "suspendida" ? "Acceso suspendido." : "Acceso reactivado.");
}

function resetCompanyPassword(id) {
  const list = loadCompanies();
  const c = list.find(x => x.id === id);
  if (!c?.user) return;
  c.user.password = genPassword();
  saveCompanies(list);
  openReview(id);
  showToast("Nueva contraseña generada.");
}

function copyCredentials(id) {
  const c = loadCompanies().find(x => x.id === id);
  if (!c?.user) return;
  const text = `B²GC Brokers\nUsuario: ${c.user.email}\nContraseña: ${c.user.password}\nIngreso: Iniciar sesión → "Soy ${c.role}"`;
  (navigator.clipboard?.writeText(text) || Promise.reject()).then(
    () => showToast("Credenciales copiadas."),
    () => showToast("No se pudo copiar; selecciónalas manualmente.")
  );
}

/* ----- Datos de ejemplo para probar el flujo sin registrar nada ----- */
function seedDemoRequests() {
  const list = loadCompanies();
  const base = [
    ["Cobranzas Andina S.A.S.", "901234567-1", "comprador", "Laura Gómez", "laura@andina.co", "Bogotá"],
    ["Cooperativa Financiera del Valle", "800765432-9", "vendedor", "Carlos Ruiz", "carlos@fvalle.co", "Cali"],
    ["Cobranzas Capital Norte S.A.S.", "900111222-3", "comprador", "Ana Pérez", "ana@capitalnorte.co", "Medellín"]
  ];
  let added = 0;
  base.forEach(b => {
    if (list.some(c => c.email === b[4])) return;
    list.push({
      id: "EMP-" + String(list.length + 1).padStart(4, "0"), role: b[2], name: b[0], nit: b[1],
      nitDigits: b[1].replace(/\D/g, ""), contactName: b[3], email: b[4], phone: "300 000 0000", city: b[5],
      status: "pendiente", createdAt: new Date().toISOString(),
      docs: { rut: { name: "rut.pdf", size: 0 }, camara: { name: "camara.pdf", size: 0 }, cc: { name: "cc.pdf", size: 0 } },
      user: null, reviewNote: "", reviewedAt: null
    });
    added++;
  });
  saveCompanies(list);
  renderAdmin();
  showToast(added ? `${added} solicitudes de ejemplo cargadas (sin PDF real).` : "Los ejemplos ya estaban cargados.");
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeRegister(); closeReview(); }
});

/* =========================================================
   ADMIN · SUBASTAS Y CONVERSIÓN
   Vista a fondo de tiempos de subasta, ofertas y conversión,
   con un asistente de IA (modelo de reglas sobre los datos
   demo; en producción conectarlo al histórico real).
   ========================================================= */

function adminHeader() {
  return `
    <header class="admin-top">
      <a class="brand" href="#">B<span class="sup">2</span>GC Brokers <em class="admin-tag">ADMIN</em></a>
      <nav class="admin-nav">
        <button class="${adminView === "solicitudes" ? "active" : ""}" onclick="setAdminView('solicitudes')">Solicitudes de empresas</button>
        <button class="${adminView === "subastas" ? "active" : ""}" onclick="setAdminView('subastas')">Subastas y conversión</button>
      </nav>
      <div class="admin-top-right">
        <span class="admin-user">${escapeHtml(ADMIN_ACCOUNT.name)}</span>
        <button class="btn btn-ghost btn-small" onclick="closeAdminPanel()">← Salir</button>
      </div>
    </header>`;
}

// Subastas ya cerradas — DEMO. [lote, tipo, días de duración, ofertas, postores, horas a 1.ª oferta, adjudicada, % final, tarifa %]
const AUCTION_HISTORY = [
  ["LOTE-HIST-011", "Consumo", 5, 7, 4, 6, true, 83, 80],
  ["LOTE-HIST-012", "Libranza", 10, 4, 3, 30, true, 83, 82],
  ["LOTE-HIST-013", "Comercial", 7, 6, 4, 12, true, 75, 72],
  ["LOTE-HIST-014", "Hipotecaria", 14, 3, 2, 52, false, 84, 87],
  ["LOTE-HIST-015", "PYME", 7, 5, 3, 9, true, 81, 78],
  ["LOTE-HIST-016", "Consumo", 3, 4, 3, 4, false, 77, 79],
  ["LOTE-HIST-017", "Libranza", 12, 2, 2, 70, false, 80, 84],
  ["LOTE-HIST-018", "Consumo", 6, 8, 5, 5, true, 84, 80],
  ["LOTE-HIST-019", "PYME", 7, 3, 2, 20, false, 74, 78],
  ["LOTE-HIST-020", "Comercial", 9, 5, 4, 14, true, 76, 73]
].map(([id, type, days, offers, bidders, firstBidH, won, final, reserve]) => ({ id, type, days, offers, bidders, firstBidH, won, final, reserve }));

const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
const winRate = arr => arr.length ? arr.filter(h => h.won).length / arr.length * 100 : 0;

/* Probabilidad de cierre de una subasta en curso (modelo de reglas) */
function closeProbability(lot) {
  const top = topBid(lot.id);
  const reserve = reserveOf(lot.id);
  let score = 25 + Math.min(bidderCount(lot.id), 5) * 8;
  if (top) score += top.percent >= reserve ? 25 : -10 + (top.percent - reserve) * 3;
  if (auctionState(lot.id) === "proxima") score -= 15;
  return Math.round(Math.min(97, Math.max(5, score)));
}

function aiInsights(live) {
  const short = AUCTION_HISTORY.filter(h => h.days <= 7), long = AUCTION_HISTORY.filter(h => h.days > 7);
  const fast = AUCTION_HISTORY.filter(h => h.firstBidH <= 12), slow = AUCTION_HISTORY.filter(h => h.firstBidH > 12);
  const out = [
    { tone: "ok", title: "Duración ideal de subasta", text: `Las subastas de 7 días o menos convierten ${winRate(short).toFixed(0)}% frente a ${winRate(long).toFixed(0)}% de las más largas. Recomienda ventanas de 5 a 7 días.` },
    { tone: "info", title: "La primera oferta marca el resultado", text: `Cuando la primera oferta llega en menos de 12 h, se adjudica el ${winRate(fast).toFixed(0)}% (vs ${winRate(slow).toFixed(0)}%). Avisa a quienes tienen la cartera en favoritos apenas abra la subasta.` }
  ];
  live.forEach(lot => {
    const top = topBid(lot.id);
    const left = profileOf(lot).endsAt - Date.now();
    if (!top) out.push({ tone: "warn", title: `${lot.id} sin ofertas`, text: "Aún no recibe ofertas. Sugerencia: destacarla en el mercado y avisar a quienes la marcaron como favorita." });
    else if (top.percent < reserveOf(lot.id)) out.push({ tone: "warn", title: `${lot.id} bajo tarifa`, text: `La mejor oferta (${top.percent}%) está bajo la tarifa del vendedor (${reserveOf(lot.id)}%). Sugerencia: extender 48 h o revisar la tarifa con el vendedor.` });
    else if (left < DAY) out.push({ tone: "ok", title: `${lot.id} cierra en menos de 24 h`, text: `Tiene oferta sobre tarifa (${top.percent}%) y ${bidderCount(lot.id)} postores: probabilidad de cierre ${closeProbability(lot)}%.` });
  });
  const pendingBelow = lots.flatMap(l => bidsFor(l.id)).filter(b => b.belowLast && !b.decision).length;
  if (pendingBelow) out.push({ tone: "info", title: "Ofertas bajo la última ofertada", text: `${pendingBelow} ofertas quedaron por debajo de la última y esperan que el vendedor las acepte o rechace.` });
  return out;
}

function renderAdminAnalytics(shell) {
  const live = lots.filter(l => auctionState(l.id) === "vivo");
  const upcoming = lots.filter(l => auctionState(l.id) === "proxima");
  const bids = lots.flatMap(l => bidsFor(l.id));
  const bidders = new Set(bids.map(b => b.buyer)).size;
  const accepted = bids.filter(b => b.decision === "Aceptada").length;
  const rejected = bids.filter(b => b.decision === "Rechazada").length;
  const won = AUCTION_HISTORY.filter(h => h.won);

  const views = lots.reduce((s, l) => s + profileOf(l).likes + profileOf(l).favs + profileOf(l).comments, 0);
  const favs = lots.reduce((s, l) => s + profileOf(l).favs, 0);
  const funnel = [["Visualizaciones", views], ["Favoritos", favs], ["Ofertas", bids.length], ["Sobre tarifa", bids.filter(b => b.percent >= reserveOf(b.lotId)).length], ["Adjudicadas", won.length]];

  const buckets = [["3–5 días", h => h.days <= 5], ["6–7 días", h => h.days > 5 && h.days <= 7], ["8–14 días", h => h.days > 7]]
    .map(([label, fn]) => { const g = AUCTION_HISTORY.filter(fn); return { label, conv: winRate(g), n: g.length, firstBid: avg(g.map(h => h.firstBidH)) }; });

  const icon = { ok: "✓", warn: "!", info: "i" };

  shell.innerHTML = `
    ${adminHeader()}
    <main class="admin-main">
      <div class="section-kicker">ANALÍTICA DE SUBASTAS</div>
      <h2 class="admin-h2">Subastas, tiempos y conversión</h2>
      <p class="admin-sub">Todo el detalle de las subastas en curso y del histórico: tiempos, ofertas, tarifas y conversión.</p>

      <div class="kpi-grid">
        ${kpiCard("Subastas en vivo", live.length, `${upcoming.length} próximas`, "up")}
        ${kpiCard("Ofertas en curso", bids.length, `${bidders} postores únicos`, "up")}
        ${kpiCard("Conversión histórica", winRate(AUCTION_HISTORY).toFixed(0) + "%", `${won.length} de ${AUCTION_HISTORY.length} subastas adjudicadas`, "up")}
        ${kpiCard("Duración promedio", avg(AUCTION_HISTORY.map(h => h.days)).toFixed(1) + " días", `1.ª oferta en ${avg(AUCTION_HISTORY.map(h => h.firstBidH)).toFixed(0)} h en promedio`, "up")}
      </div>

      <div class="ai-card">
        <div class="ai-card-head"><div class="ai-avatar">✦</div><div><strong>Asistente IA · tiempos y conversión</strong><span>Análisis automático del histórico y de las subastas en curso (modelo de reglas sobre datos demo)</span></div></div>
        <div class="ai-insights">${aiInsights(live).map(i => `<div class="ai-insight ${i.tone}"><b>${icon[i.tone]}</b><div><strong>${escapeHtml(i.title)}</strong><span>${escapeHtml(i.text)}</span></div></div>`).join("")}</div>
      </div>

      <div class="dashboard-chart-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <div class="dashboard-chart-card">
          <div class="dashboard-chart-header"><div><div class="chart-kicker">EMBUDO</div><h3>Conversión del mercado</h3><p>De la visualización a la adjudicación</p></div></div>
          <div class="funnel">${funnel.map(([label, v], i) => `
            <div class="funnel-row"><span>${label}</span><div class="funnel-track"><b style="width:${Math.max(4, v / funnel[0][1] * 100)}%"></b></div><strong>${fmtN(v)}</strong>
            <small>${i ? (v / funnel[i - 1][1] * 100).toFixed(0) + "%" : ""}</small></div>`).join("")}</div>
        </div>
        <div class="dashboard-chart-card">
          <div class="dashboard-chart-header"><div><div class="chart-kicker">TIEMPOS</div><h3>Conversión según duración</h3><p>Subastas cerradas agrupadas por días de duración</p></div></div>
          <div class="activity-chart" style="grid-template-columns:repeat(3,minmax(0,1fr))">${buckets.map((b, i) => `
            <div class="activity-column ${i === 1 ? "current" : ""}">
              <div class="activity-value" style="height:${Math.max(6, b.conv)}%"><b>${b.conv.toFixed(0)}%</b></div>
              <span>${b.label}<br>${b.n} subastas · 1.ª oferta ${b.firstBid.toFixed(0)} h</span>
            </div>`).join("")}</div>
        </div>
      </div>

      <div class="card" style="margin-top:18px">
        <div class="card-header"><div><h3>Subastas en curso y próximas</h3><p>Decisiones de los vendedores: ${accepted} aceptadas · ${rejected} rechazadas</p></div></div>
        <div class="table-wrap"><table><thead><tr>
          <th>Lote</th><th>Estado</th><th>Tiempo</th><th>Duración</th><th>Ofertas</th><th>Postores</th><th>Más alta</th><th>Tarifa</th><th>Bajo la última</th><th>Prob. de cierre</th>
        </tr></thead><tbody>
          ${[...live, ...upcoming].map(lot => {
            const p = profileOf(lot), top = topBid(lot.id), lb = bidsFor(lot.id);
            const prob = closeProbability(lot);
            const st = auctionState(lot.id);
            return `<tr>
              <td><strong style="color:var(--navy)">${lot.id}</strong><br><small style="color:var(--muted-2)">${lot.type} · ${escapeHtml(lot.vendedor)}</small></td>
              <td><span class="state-chip ${st}">${st === "vivo" ? "<i></i> En vivo" : "Próxima"}</span></td>
              <td><small class="cd-label">${cdLabel(lot.id)}</small> ${cdHtml(lot.id)}</td>
              <td>${((p.endsAt - p.startsAt) / DAY).toFixed(1)} días</td>
              <td>${lb.length}</td><td>${bidderCount(lot.id)}</td>
              <td>${top ? top.percent + "%" : "—"}</td>
              <td>${reserveOf(lot.id)}% ${top ? reserveBadge(top.percent, reserveOf(lot.id)) : ""}</td>
              <td>${lb.filter(b => b.belowLast).length}</td>
              <td><div class="prob"><div><b style="width:${prob}%"></b></div><strong>${prob}%</strong></div></td>
            </tr>`;
          }).join("")}
        </tbody></table></div>
      </div>

      <div class="card" style="margin-top:18px">
        <div class="card-header"><div><h3>Operaciones en cierre</h3><p>Seguimiento de firmas, pago, entrega y paz y salvo</p></div></div>
        ${(appState.operations || []).filter(o => o.status !== "Cancelada").length ? `<div class="table-wrap"><table><thead><tr>
          <th>Operación</th><th>Lote</th><th>Entidad vendedora</th><th>Casa de cobranza</th><th>Valor</th><th>Avance</th><th>Siguiente paso</th><th>Estado</th>
        </tr></thead><tbody>
          ${(appState.operations || []).filter(o => o.status !== "Cancelada").map(o => {
            const st = nextStep(o);
            return `<tr>
              <td><strong>${o.id}</strong></td><td>${o.lotId}</td><td>${escapeHtml(o.seller)}</td><td>${escapeHtml(o.buyer)}</td>
              <td>${fmtM(o.value)}</td>
              <td><div class="prob"><div><b style="width:${stepsDone(o) / CLOSING_STEPS.length * 100}%"></b></div><strong>${stepsDone(o)}/${CLOSING_STEPS.length}</strong></div></td>
              <td>${st ? `${st.label} · ${st.role}` : "—"}</td>
              <td><span class="badge ${o.status === "Cerrada" ? "badge-green" : "badge-gold"}">${o.status}</span></td>
            </tr>`;
          }).join("")}
        </tbody></table></div>` : `<div class="page-placeholder" style="margin:22px"><strong>Sin operaciones en cierre</strong><span>Aparecerán cuando un vendedor adjudique una oferta.</span></div>`}
      </div>

      <div class="card" style="margin-top:18px">
        <div class="card-header"><div><h3>Histórico de subastas</h3><p>Base del análisis de conversión</p></div></div>
        <div class="table-wrap"><table><thead><tr>
          <th>Lote</th><th>Tipo</th><th>Duración</th><th>1.ª oferta</th><th>Ofertas</th><th>Postores</th><th>% final</th><th>Tarifa</th><th>Resultado</th>
        </tr></thead><tbody>
          ${AUCTION_HISTORY.map(h => `<tr>
            <td><strong>${h.id}</strong></td><td>${h.type}</td><td>${h.days} días</td><td>${h.firstBidH} h</td><td>${h.offers}</td><td>${h.bidders}</td>
            <td>${h.final}%</td><td>${h.reserve}%</td>
            <td><span class="badge ${h.won ? "badge-green" : "badge-red"}">${h.won ? "Adjudicada" : "Desierta"}</span></td>
          </tr>`).join("")}
        </tbody></table></div>
      </div>
    </main>`;
  startCountdowns();
}
