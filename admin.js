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
  try { return JSON.parse(localStorage.getItem(COMPANIES_KEY) || "[]"); } catch { return []; }
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

  // Cuentas demo (entorno de pruebas)
  const demo = demoAccounts[currentRole];
  if (demo && email === demo.email && password === demo.password) {
    return { role: currentRole, company: demo.company, avatar: demo.avatar, demo: true, email };
  }
  return { error: `No encontramos esa cuenta. Prueba: ${demo.email} / ${demo.password}` };
}

function initials(name) {
  return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

/* =========================================================
   REGISTRO DE EMPRESA
   ========================================================= */
const regFiles = {}; // { rut: File, camara: File, cc: File }

function openRegister() {
  $("#register-overlay")?.remove();
  Object.keys(regFiles).forEach(k => delete regFiles[k]);

  const overlay = document.createElement("div");
  overlay.id = "register-overlay";
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="modal modal-wrap register-modal">
      <button type="button" class="modal-close" onclick="closeRegister()">×</button>
      <div class="modal-brand">B<span>2</span>GC</div>
      <h2>Registrar mi empresa</h2>
      <p class="sub">Verificamos cada empresa antes de darle acceso. Cuando aprobemos tu solicitud, te asignaremos tu usuario.</p>

      <div class="role-pick" id="reg-role-pick">
        <div class="role-opt active" data-role="originador" onclick="pickRegRole(this)">
          <strong>Soy originador</strong><small>Publico y vendo cartera</small>
        </div>
        <div class="role-opt" data-role="comprador" onclick="pickRegRole(this)">
          <strong>Soy comprador</strong><small>Busco oportunidades</small>
        </div>
      </div>

      <div class="form-grid">
        <div class="field"><label for="reg-name">Razón social *</label><input id="reg-name" type="text" placeholder="Mi Empresa S.A.S."></div>
        <div class="field"><label for="reg-nit">NIT *</label><input id="reg-nit" type="text" inputmode="numeric" placeholder="900.123.456-7"></div>
        <div class="field"><label for="reg-contact">Representante legal *</label><input id="reg-contact" type="text" placeholder="Nombre completo"></div>
        <div class="field"><label for="reg-city">Ciudad</label><input id="reg-city" type="text" placeholder="Bogotá"></div>
        <div class="field"><label for="reg-email">Correo corporativo *</label><input id="reg-email" type="email" placeholder="nombre@empresa.com"></div>
        <div class="field"><label for="reg-phone">Celular / WhatsApp *</label><input id="reg-phone" type="tel" placeholder="300 000 0000"></div>
      </div>

      <div class="doc-upload-title">Documentos en PDF <span>(máx. 3 MB cada uno)</span></div>
      <div class="doc-upload-list">
        ${REQUIRED_DOCS.map(d => `
          <label class="doc-upload" id="reg-doc-${d.key}">
            <input type="file" accept="application/pdf,.pdf" onchange="pickRegFile('${d.key}', this)">
            <div class="doc-upload-icon">PDF</div>
            <div class="doc-upload-text">
              <strong>${d.label} *</strong>
              <span class="doc-upload-hint">${d.hint}</span>
              <span class="doc-upload-file" id="reg-file-${d.key}">Haz clic para seleccionar el archivo</span>
            </div>
            <div class="doc-upload-check" id="reg-check-${d.key}">✓</div>
          </label>`).join("")}
      </div>

      <label class="consent">
        <input type="checkbox" id="reg-consent">
        <span>Autorizo el tratamiento de los datos y documentos con fines de verificación (Ley 1581 de 2012).</span>
      </label>

      <button type="button" class="btn btn-navy" style="width:100%;" id="reg-submit" onclick="submitRegistration()">Enviar solicitud →</button>
      <p class="modal-switch">¿Ya tienes usuario? <button type="button" class="btn-text" onclick="closeRegister();openAuth('login')">Inicia sesión</button></p>
    </div>`;
  overlay.addEventListener("click", e => { if (e.target === overlay) closeRegister(); });
  document.body.appendChild(overlay);
}

function closeRegister() { $("#register-overlay")?.remove(); }

function pickRegRole(el) {
  $$("#reg-role-pick .role-opt").forEach(o => o.classList.remove("active"));
  el.classList.add("active");
}

function pickRegFile(key, input) {
  const file = input.files?.[0];
  const label = $(`#reg-file-${key}`);
  const box = $(`#reg-doc-${key}`);
  delete regFiles[key];
  box.classList.remove("done", "error");

  if (!file) { label.textContent = "Haz clic para seleccionar el archivo"; return; }

  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) { label.textContent = "Solo se aceptan archivos PDF."; box.classList.add("error"); input.value = ""; return; }
  if (file.size > MAX_PDF) { label.textContent = `Pesa ${formatFileSize(file.size)}; el máximo es 3 MB.`; box.classList.add("error"); input.value = ""; return; }

  regFiles[key] = file;
  label.textContent = `${file.name} · ${formatFileSize(file.size)}`;
  box.classList.add("done");
}

async function submitRegistration() {
  const v = id => ($(id)?.value || "").trim();
  const role = $("#reg-role-pick .role-opt.active")?.dataset.role || "originador";
  const data = {
    name: v("#reg-name"), nit: v("#reg-nit"), contactName: v("#reg-contact"),
    city: v("#reg-city"), email: v("#reg-email").toLowerCase(), phone: v("#reg-phone")
  };

  if (!data.name || !data.nit || !data.contactName || !data.email || !data.phone) { showToast("Completa los campos obligatorios (*)."); return; }
  if (!/^\S+@\S+\.\S+$/.test(data.email)) { showToast("Revisa el formato del correo."); return; }
  const nitDigits = data.nit.replace(/\D/g, "");
  if (nitDigits.length < 8) { showToast("El NIT parece incompleto."); return; }
  for (const d of REQUIRED_DOCS) {
    if (!regFiles[d.key]) { showToast(`Falta adjuntar: ${d.label}.`); return; }
  }
  if (!$("#reg-consent")?.checked) { showToast("Debes autorizar el tratamiento de datos."); return; }

  const list = loadCompanies();
  const dup = list.find(c => c.nitDigits === nitDigits || c.email === data.email || (c.user && c.user.email === data.email));
  if (dup) { showToast(dup.status === "aprobada" ? "Esa empresa ya tiene usuario. Inicia sesión." : "Ya existe una solicitud con ese NIT o correo."); return; }

  const btn = $("#reg-submit");
  btn.disabled = true; btn.textContent = "Enviando…";

  const id = "EMP-" + String(list.length + 1).padStart(4, "0");
  try {
    const docs = {};
    for (const d of REQUIRED_DOCS) {
      const f = regFiles[d.key];
      await putFile(`${id}:${d.key}`, f);
      docs[d.key] = { name: f.name, size: f.size };
    }
    list.push({
      id, role, ...data, nitDigits, status: "pendiente",
      createdAt: new Date().toISOString(), docs, user: null, reviewNote: "", reviewedAt: null
    });
    saveCompanies(list);
  } catch (err) {
    console.error(err);
    btn.disabled = false; btn.textContent = "Enviar solicitud →";
    showToast("No fue posible guardar los archivos en este navegador.");
    return;
  }

  $("#register-overlay .register-modal").innerHTML = `
    <div class="register-success">
      <div class="success-mark">✓</div>
      <h2>Solicitud recibida</h2>
      <p>Radicado <strong>${id}</strong>. Nuestro equipo revisará los documentos de <strong>${escapeHtml(data.name)}</strong> y te asignará un usuario.</p>
      <p class="muted">Te avisaremos al correo ${escapeHtml(data.email)} o al WhatsApp registrado.</p>
      <button type="button" class="btn btn-navy" onclick="closeRegister()">Entendido</button>
    </div>`;
}

/* =========================================================
   PANEL DE ADMINISTRACIÓN
   ========================================================= */
let adminFilter = null; // se decide al abrir: pendientes si hay, si no todas

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
  const all = loadCompanies();
  if (!adminFilter) adminFilter = all.some(c => c.status === "pendiente") ? "pendiente" : "todas";
  const count = s => all.filter(c => c.status === s).length;
  const rows = adminFilter === "todas" ? all : all.filter(c => c.status === adminFilter);
  const tabs = [["pendiente", "Pendientes"], ["aprobada", "Aprobadas"], ["rechazada", "Rechazadas"], ["suspendida", "Suspendidas"], ["todas", "Todas"]];

  shell.innerHTML = `
    <header class="admin-top">
      <a class="brand" href="#">B<span class="sup">2</span>GC Brokers <em class="admin-tag">ADMIN</em></a>
      <div class="admin-top-right">
        <span class="admin-user">${escapeHtml(ADMIN_ACCOUNT.name)}</span>
        <button class="btn btn-ghost btn-small" onclick="closeAdminPanel()">← Salir</button>
      </div>
    </header>

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
            <td>${c.role === "originador" ? "Originador" : "Comprador"}</td>
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
      <div class="section-kicker">${c.id} · ${c.role === "originador" ? "ORIGINADOR" : "COMPRADOR"}</div>
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
    ["Inversiones Andina S.A.S.", "901234567-1", "comprador", "Laura Gómez", "laura@andina.co", "Bogotá"],
    ["Financiera del Valle S.A.", "800765432-9", "originador", "Carlos Ruiz", "carlos@fvalle.co", "Cali"],
    ["Fondo Capital Norte", "900111222-3", "comprador", "Ana Pérez", "ana@capitalnorte.co", "Medellín"]
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
