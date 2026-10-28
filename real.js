/* =========================================================
   B²GC BROKERS — REAL.JS
   Modo real conectado a Supabase: cuentas, empresas aprobadas
   por B²GC, carteras, ofertas, adjudicación y cierre con
   documentos. El demo sigue funcionando aparte con sus cuentas
   de prueba.

   La publishable key es pública por diseño: la seguridad está en
   las reglas (RLS) y funciones de supabase/schema.sql.
   ========================================================= */

const SUPABASE_URL = "https://vxoifahyggjbemeullty.supabase.co";
const SUPABASE_KEY = "sb_publishable_1qOLGktD8H_5VUtPHs5cuQ_Q5d3phRr";
const sb = window.supabase?.createClient ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const real = { user: null, company: null, admin: false, poll: null, uuidByCode: {}, opUuidByCode: {} };

const ENTITY_LABEL = { banco: "Banco", fintech: "Fintech", cooperativa: "Cooperativa", casa_cobranza: "Casa de cobranza", otro: "Otra entidad" };
const STEP_ORDER = ["adjudicacion", "firmaVendedor", "firmaComprador", "pago", "confirmacionPago", "entrega", "recepcion"];
const BID_STATUS = { rechazada: "Rechazada", adjudicada: "Aceptada" };

function isDemoEmail(email) {
  return Object.values(demoAccounts).some(a => a.email === email)
    || email === ADMIN_ACCOUNT.email
    || loadCompanies().some(c => c.user?.email === email);
}

function friendlyError(error) {
  const msg = error?.message || String(error || "");
  if (/Invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos.";
  if (/Email not confirmed/i.test(msg)) return "Confirma tu correo: revisa el enlace que te enviamos.";
  if (/User already registered/i.test(msg)) return "Ese correo ya tiene cuenta. Inicia sesión.";
  if (/Password should be at least/i.test(msg)) return "La contraseña debe tener al menos 8 caracteres.";
  if (/rate limit/i.test(msg)) return "Demasiados intentos seguidos. Espera unos minutos.";
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Sin conexión con el servidor. Revisa tu internet.";
  return msg.replace(/^.*?ERROR:\s*/, "") || "Ocurrió un error inesperado.";
}

function requireSb() {
  if (!sb) { showToast("No se pudo cargar la conexión con el servidor. Recarga la página."); return false; }
  return true;
}

const safeName = name => String(name).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);

async function uploadTo(bucket, path, file, upsert = false) {
  const { error } = await sb.storage.from(bucket).upload(path, file, { upsert, contentType: file.type || "application/octet-stream" });
  if (error) throw error;
  return path;
}

async function openSignedFile(bucket, path) {
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 300);
  if (error) { showToast(friendlyError(error)); return; }
  window.open(data.signedUrl, "_blank", "noopener");
}

/* =========================================================
   SESIÓN
   ========================================================= */
async function realSignIn(email, password) {
  if (!requireSb()) return;
  const btn = $("#auth-overlay .btn-navy");
  if (btn) { btn.disabled = true; btn.textContent = "Entrando…"; }
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (btn) { btn.disabled = false; btn.textContent = "Entrar a la plataforma"; }
  if (error) { showToast(friendlyError(error)); return; }
  closeAuth();
  await afterRealLogin(data.user);
}

async function afterRealLogin(user) {
  real.user = user;
  const { data: adm } = await sb.rpc("is_admin");
  real.admin = !!adm;
  if (real.admin) { openRealAdmin(); return; }

  let { data: company, error } = await sb.from("companies").select("*").eq("owner", user.id).maybeSingle();
  if (error) { showToast(friendlyError(error)); return; }
  if (!company) {
    const r = user.user_metadata?.registration;
    if (!r) { showToast("Tu usuario no tiene empresa registrada. Usa “Registro”."); await sb.auth.signOut(); return; }
    const res = await sb.rpc("create_my_company", {
      p_role: r.role, p_entity_type: r.entityType, p_name: r.name, p_nit: r.nit,
      p_contact: r.contactName, p_city: r.city || "", p_phone: r.phone
    });
    if (res.error) { showToast(friendlyError(res.error)); return; }
    company = res.data;
  }
  real.company = company;
  if (company.status !== "aprobada") { openOnboarding(); return; }
  await enterRealApp();
}

async function realSignOut() {
  clearInterval(real.poll);
  if (sb) await sb.auth.signOut();
  location.hash = "";
  location.reload();
}

async function enterRealApp() {
  const c = real.company;
  appState.realMode = true;
  appState.demoMode = false;
  appState.loggedIn = true;
  appState.userEmail = real.user.email;
  appState.company = c.name;
  appState.avatar = initials(c.name);
  appState.session = { company: c.name, avatar: appState.avatar, role: c.role, demo: false };
  try { appState.favorites = JSON.parse(localStorage.getItem(`b2gc_real_favs_${real.user.id}`) || "[]"); } catch { appState.favorites = []; }
  currentRole = c.role;

  $("#public-site")?.classList.add("hidden");
  $("#admin-shell")?.classList.add("hidden");
  $("#app-shell")?.classList.remove("hidden");
  const toggle = $(".role-toggle");
  if (toggle) toggle.style.display = "none";
  const back = $(".logout-btn");
  if (back) { back.textContent = "Cerrar sesión"; back.setAttribute("onclick", "realSignOut()"); }

  await loadRealData();
  setRole(currentRole);
  showToast(`Bienvenido, ${c.name}.`);

  clearInterval(real.poll);
  real.poll = setInterval(async () => {
    if (document.hidden || $("#op-overlay, #offer-overlay, #op-confirm-overlay, #publish-form") || !$("#detail-overlay")?.classList.contains("hidden")) return;
    await loadRealData();
    rerenderCurrent();
  }, 25000);
}

/* =========================================================
   CARGA DE DATOS → mismas estructuras que usa la interfaz
   ========================================================= */
const clearObj = o => Object.keys(o).forEach(k => delete o[k]);

function portfolioToLot(p) {
  const now = Date.now(), start = Date.parse(p.starts_at), end = Date.parse(p.ends_at);
  const [status, statusClass] = p.status === "vendida" ? ["Vendida", "badge-green"]
    : p.status === "adjudicada" ? ["En cierre", "badge-gold"]
    : now < start ? ["Próxima", "badge-blue"]
    : now >= end ? ["Subasta finalizada", "badge-gold"]
    : ["Subasta activa", "badge-green"];
  return {
    id: p.code, uuid: p.id, real: true, title: p.title, vendedor: p.seller_name, type: p.type,
    amount: fmtM(Number(p.nominal)), discount: "", debtors: fmtN(p.debtors), obligations: p.obligations,
    status, statusClass, modality: p.modality, deadline: new Date(end).toLocaleDateString("es-CO"),
    score: "—", description: p.description || "", dbStatus: p.status
  };
}

async function loadRealData() {
  if (!sb || !real.company) return;
  const seller = real.company.role === "vendedor";
  const [ports, mine, book, ops] = await Promise.all([
    sb.rpc("market_portfolios"),
    seller ? sb.from("portfolios").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    sb.rpc("bid_book"),
    sb.from("operations").select("*, operation_steps(*)").order("created_at", { ascending: false })
  ]);
  const err = ports.error || mine.error || book.error || ops.error;
  if (err) { showToast(friendlyError(err)); return; }

  [lots, originatorLots, buyerOpportunities, demoBids].forEach(a => { a.length = 0; });
  [lotProfiles, lotReserve, processDemo, real.uuidByCode, real.opUuidByCode].forEach(clearObj);
  appState.offers = [];
  appState.decisions = {};
  appState.operations = [];

  const mineIds = new Set((mine.data || []).map(p => p.id));
  const all = [...(mine.data || []), ...(ports.data || []).filter(p => !mineIds.has(p.id))];
  const codeByUuid = {};
  all.forEach(p => {
    const lot = portfolioToLot(p);
    codeByUuid[p.id] = p.code;
    real.uuidByCode[p.code] = p.id;
    lots.push(lot);
    lotProfiles[p.code] = { obligations: p.obligations, likes: 0, favs: 0, comments: 0, offers: 0, bestPercent: 0, startsAt: Date.parse(p.starts_at), endsAt: Date.parse(p.ends_at) };
    if (mineIds.has(p.id)) { originatorLots.push({ ...lot }); lotReserve[p.code] = Number(p.reserve_percent); }
    else if (p.status !== "cancelada") buyerOpportunities.push({ ...lot });
  });

  (book.data || []).forEach(b => {
    const lotId = codeByUuid[b.portfolio_id];
    if (!lotId) return;
    const bid = { id: b.id, lotId, percent: Number(b.percent), note: b.note || "", at: Date.parse(b.created_at), status: b.status, date: new Date(b.created_at).toLocaleDateString("es-CO") };
    if (BID_STATUS[b.status]) appState.decisions[b.id] = BID_STATUS[b.status];
    if (b.is_mine) appState.offers.push({ ...bid, buyer: real.company.name, amount: "", });
    else demoBids.push({ ...bid, buyer: b.buyer_label });
    lotProfiles[lotId].offers++;
  });

  (ops.data || []).forEach(o => {
    real.opUuidByCode[o.code] = o.id;
    const steps = {};
    (o.operation_steps || []).sort((a, b) => STEP_ORDER.indexOf(a.step_key) - STEP_ORDER.indexOf(b.step_key)).forEach(s => {
      steps[s.step_key] = {
        at: new Date(s.created_at).toLocaleString("es-CO"), by: s.company_name,
        signer: s.signer || undefined, reference: s.reference || undefined,
        amount: s.amount != null ? Number(s.amount) : undefined, file: s.file_path || undefined
      };
    });
    appState.operations.push({
      id: o.code, uuid: o.id, lotId: o.portfolio_code, lotTitle: o.portfolio_title, offerId: o.bid_id,
      buyer: o.buyer_name, seller: o.seller_name, broker: BROKER, percent: Number(o.percent),
      value: Number(o.value), nominal: Number(o.nominal),
      status: { en_cierre: "En cierre", cerrada: "Cerrada", cancelada: "Cancelada" }[o.status],
      createdAt: Date.parse(o.created_at), closedAt: o.closed_at ? new Date(o.closed_at).toLocaleString("es-CO") : null,
      steps,
      log: STEP_ORDER.filter(k => steps[k]).map(k => ({ at: steps[k].at, text: `${CLOSING_STEPS.find(s => s.key === k).done} · ${steps[k].by}${steps[k].signer ? ` (firmó ${steps[k].signer})` : ""}${steps[k].reference ? ` · ref. ${steps[k].reference}` : ""}` }))
    });
  });
  lots.forEach(l => { l._base = null; });
  syncLotStatuses();
}

/* =========================================================
   ACCIONES REALES (las validaciones finales están en el servidor)
   ========================================================= */
async function rpcOrToast(fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) { showToast(friendlyError(error)); return null; }
  return data;
}

async function realPlaceBid(lot, percent, note) {
  const res = await rpcOrToast("place_bid", { p_portfolio: lot.uuid, p_percent: percent, p_note: note });
  if (!res) return;
  closeOfferModal();
  closeDetail();
  showToast(res.below_last ? `Oferta enviada por debajo de la última (${res.prev_best}%). La entidad vendedora decidirá.` : "Oferta enviada. Vas de primero.");
  await loadRealData();
  rerenderCurrent();
}

async function realRejectBid(bidId, undo) {
  if (!await rpcOrToast("reject_bid", { p_bid: bidId, p_undo: !!undo })) return;
  showToast(undo ? "Rechazo deshecho." : "Oferta rechazada.");
  await loadRealData();
  rerenderCurrent();
}

async function realAdjudicate(bidId) {
  $("#op-confirm-overlay")?.remove();
  const op = await rpcOrToast("adjudicate_bid", { p_bid: bidId });
  if (!op) return;
  await loadRealData();
  showToast(`${op.code} creada. Siguiente paso: firma de la entidad vendedora.`);
  navigate(null, "cierre");
  openOperation(op.code);
}

async function realAdvance(opCode, key, payload, fileInput) {
  const op = opById(opCode);
  if (!op) return;
  let filePath = null;
  const file = fileInput?.files?.[0];
  try {
    if (file) {
      if (file.size > 10 * 1024 * 1024) { showToast("El archivo supera 10 MB."); return; }
      filePath = await uploadTo("operation-docs", `${op.uuid}/${key}-${Date.now()}-${safeName(file.name)}`, file);
    }
  } catch (e) { showToast(friendlyError(e)); return; }
  const amount = payload.amount === undefined || payload.amount === "" ? null : Number(String(payload.amount).replace(",", "."));
  const res = await rpcOrToast("advance_operation", {
    p_operation: op.uuid, p_step: key, p_signer: payload.signer || null, p_reference: payload.reference || null,
    p_amount: amount, p_file: filePath, p_accept: !!payload.accept
  });
  if (!res) return;
  await loadRealData();
  const updated = opById(opCode);
  const next = updated && nextStep(updated);
  showToast(updated?.status === "Cerrada" ? `${opCode} cerrada con éxito.` : `Listo. Siguiente paso: ${next?.label}.`);
  rerenderCurrent();
  openOperation(opCode);
}

async function realCancelOperation(opCode) {
  const op = opById(opCode);
  if (!op || !await rpcOrToast("cancel_operation", { p_operation: op.uuid })) return;
  closeOperation();
  showToast("Adjudicación deshecha. La cartera vuelve a estar publicada.");
  await loadRealData();
  rerenderCurrent();
}

/* =========================================================
   REGISTRO
   ========================================================= */
async function realSignUp(data) {
  if (!requireSb()) return { error: "Sin conexión." };
  const { data: res, error } = await sb.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: location.origin + location.pathname,
      data: { registration: { role: data.role, entityType: data.entityType, name: data.name, nit: data.nit, contactName: data.contactName, city: data.city, phone: data.phone } }
    }
  });
  if (error) return { error: friendlyError(error) };
  // Supabase no revela si el correo ya existía: devuelve un usuario sin identidades
  if (res.user && Array.isArray(res.user.identities) && !res.user.identities.length) return { error: "Ese correo ya tiene cuenta. Inicia sesión." };
  if (res.session) { closeRegister(); await afterRealLogin(res.user); return { ok: true, session: true }; }
  return { ok: true };
}

/* =========================================================
   ALTA DE LA EMPRESA: documentos y estado de revisión
   ========================================================= */
function openOnboarding() {
  const c = real.company;
  $("#onboarding-overlay")?.remove();
  const docs = c.docs || {};
  const complete = REQUIRED_DOCS.every(d => docs[d.key]);
  const state = {
    pendiente: complete ? ["En revisión", "badge-gold", "B²GC Brokers está revisando tus documentos. Te avisaremos al correo cuando tu empresa quede aprobada."]
      : ["Faltan documentos", "badge-gold", "Sube los tres documentos en PDF para que B²GC Brokers revise y apruebe tu empresa."],
    rechazada: ["Rechazada", "badge-red", `Motivo: ${c.review_note || "—"}. Corrige y vuelve a subir los documentos para una nueva revisión.`],
    suspendida: ["Suspendida", "badge-red", "Tu acceso está suspendido. Escríbenos a contacto@b2gcbrokers.co."]
  }[c.status] || ["—", "badge-blue", ""];

  const el = document.createElement("div");
  el.id = "onboarding-overlay";
  el.className = "overlay";
  el.innerHTML = `
    <div class="modal modal-wrap register-modal">
      <button type="button" class="modal-close" onclick="realSignOut()">×</button>
      <div class="modal-brand">B<span>2</span>GC</div>
      <h2>${escapeHtml(c.name)}</h2>
      <p class="sub">${ENTITY_LABEL[c.entity_type] || ""} · NIT ${escapeHtml(c.nit)} · <span class="badge ${state[1]}">${state[0]}</span></p>
      <div class="offer-alert ${c.status === "rechazada" || c.status === "suspendida" ? "warn" : "ok"}"><span>${escapeHtml(state[2])}</span></div>
      ${c.status !== "suspendida" ? `
        <div class="doc-upload-title">Documentos en PDF <span>(máx. 5 MB cada uno)</span></div>
        <div class="doc-upload-list">
          ${REQUIRED_DOCS.map(d => `
            <label class="doc-upload ${docs[d.key] ? "done" : ""}" id="ob-doc-${d.key}">
              <input type="file" accept="application/pdf,.pdf" onchange="uploadCompanyDoc('${d.key}', this)">
              <div class="doc-upload-icon">PDF</div>
              <div class="doc-upload-text"><strong>${d.label} *</strong><span class="doc-upload-hint">${d.hint}</span>
                <span class="doc-upload-file" id="ob-file-${d.key}">${docs[d.key] ? `${escapeHtml(docs[d.key].name)} · subido` : "Haz clic para seleccionar el archivo"}</span></div>
              <div class="doc-upload-check">✓</div>
            </label>`).join("")}
        </div>` : ""}
      <div class="offer-actions">
        <button class="btn btn-ghost" onclick="realSignOut()">Cerrar sesión</button>
        <button class="btn btn-navy" onclick="refreshOnboarding()">Actualizar estado</button>
      </div>
    </div>`;
  document.body.appendChild(el);
}

async function uploadCompanyDoc(key, input) {
  const file = input.files?.[0];
  const label = $(`#ob-file-${key}`);
  if (!file) return;
  if (!(file.type === "application/pdf" || /\.pdf$/i.test(file.name))) { label.textContent = "Solo se aceptan archivos PDF."; return; }
  if (file.size > 5 * 1024 * 1024) { label.textContent = "El archivo supera 5 MB."; return; }
  label.textContent = "Subiendo…";
  try {
    const path = await uploadTo("company-docs", `${real.company.id}/${key}.pdf`, file, true);
    const { data, error } = await sb.rpc("set_company_doc", { p_key: key, p_path: path, p_name: file.name, p_size: file.size });
    if (error) throw error;
    real.company = data;
    showToast(`${REQUIRED_DOCS.find(d => d.key === key).label} subido.`);
    openOnboarding();
  } catch (e) { label.textContent = friendlyError(e); }
}

async function refreshOnboarding() {
  const { data } = await sb.from("companies").select("*").eq("owner", real.user.id).maybeSingle();
  if (data) real.company = data;
  if (real.company.status === "aprobada") { $("#onboarding-overlay")?.remove(); await enterRealApp(); }
  else { openOnboarding(); showToast("Tu empresa sigue en revisión."); }
}

/* =========================================================
   PUBLICAR CARTERA (entidad vendedora)
   ========================================================= */
function renderPublishForm() {
  const local = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  const start = new Date(Date.now() + 5 * 6e4), end = new Date(Date.now() + 7 * DAY);
  return `
    <div class="card page-card" id="publish-form">
      <div class="section-kicker">PUBLICAR CARTERA · ${escapeHtml(real.company?.name || "")}</div>
      <h2>Publicar una cartera</h2>
      <p>B²GC Brokers la mostrará a las casas de cobranza aprobadas. Tu tarifa mínima nunca la ven las casas de cobranza.</p>
      <div class="offer-alert warn"><strong>Protección de datos (Ley 1581)</strong><span>Los archivos del data room deben ir anonimizados: sin nombres, cédulas ni datos de contacto de los deudores.</span></div>
      <div class="form-grid publish-grid">
        <div class="field"><label for="pf-title">Nombre de la cartera *</label><input id="pf-title" type="text" placeholder="Cartera de consumo castigada 2024"></div>
        <div class="field"><label for="pf-type">Tipo *</label><select id="pf-type">${["Consumo", "Libranza", "Comercial", "Hipotecaria", "PYME", "Tarjeta de crédito", "Vehículo", "Microcrédito", "Otro"].map(t => `<option>${t}</option>`).join("")}</select></div>
        <div class="field"><label for="pf-modality">Modalidad *</label><select id="pf-modality"><option>Subasta privada</option><option>Compra directa</option><option>Híbrida</option></select></div>
        <div class="field"><label for="pf-nominal">Valor nominal (millones COP) *</label><input id="pf-nominal" type="number" min="0.1" step="0.1" placeholder="4850"></div>
        <div class="field"><label for="pf-debtors">Número de deudores *</label><input id="pf-debtors" type="number" min="1" step="1"></div>
        <div class="field"><label for="pf-obligations">Número de obligaciones *</label><input id="pf-obligations" type="number" min="1" step="1"></div>
        <div class="field"><label for="pf-reserve">Tarifa mínima (% del nominal) *</label><input id="pf-reserve" type="number" min="0.1" max="100" step="0.1" placeholder="18"></div>
        <div class="field"><label for="pf-starts">Inicio de la subasta *</label><input id="pf-starts" type="datetime-local" value="${local(start)}"></div>
        <div class="field"><label for="pf-ends">Cierre de la subasta *</label><input id="pf-ends" type="datetime-local" value="${local(end)}"></div>
      </div>
      <div class="field"><label for="pf-desc">Descripción para las casas de cobranza</label><textarea id="pf-desc" rows="3" placeholder="Antigüedad de mora, ciudades, estado de soportes…"></textarea></div>
      <div class="field"><label for="pf-files">Archivos del data room (opcional, máx. 20 MB cada uno)</label><input id="pf-files" type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.docx,.zip"></div>
      <div class="offer-actions" style="justify-content:flex-start">
        <button class="btn btn-navy" id="pf-submit" onclick="submitPortfolio()">Publicar cartera</button>
        <button class="btn btn-ghost" onclick="navigate(null,'cartera')">Cancelar</button>
      </div>
    </div>`;
}

async function submitPortfolio() {
  const v = id => ($(id)?.value || "").trim();
  const data = {
    p_title: v("#pf-title"), p_type: v("#pf-type"), p_modality: v("#pf-modality"),
    p_nominal: Number(v("#pf-nominal")), p_debtors: parseInt(v("#pf-debtors"), 10), p_obligations: parseInt(v("#pf-obligations"), 10),
    p_reserve: Number(v("#pf-reserve")), p_starts: v("#pf-starts") ? new Date(v("#pf-starts")).toISOString() : null,
    p_ends: v("#pf-ends") ? new Date(v("#pf-ends")).toISOString() : null, p_description: v("#pf-desc")
  };
  if (data.p_title.length < 4) return showToast("Escribe el nombre de la cartera.");
  if (!(data.p_nominal > 0)) return showToast("Escribe el valor nominal en millones.");
  if (!(data.p_debtors > 0) || !(data.p_obligations > 0)) return showToast("Escribe deudores y obligaciones.");
  if (!(data.p_reserve >= 0.1 && data.p_reserve <= 100)) return showToast("La tarifa debe estar entre 0,1% y 100%.");
  if (!data.p_starts || !data.p_ends || Date.parse(data.p_ends) <= Date.parse(data.p_starts)) return showToast("El cierre debe ser después del inicio.");
  const files = [...($("#pf-files")?.files || [])];
  if (files.some(f => f.size > 20 * 1024 * 1024)) return showToast("Algún archivo supera 20 MB.");

  const btn = $("#pf-submit");
  if (!appState.realMode) { createDemoPortfolio(data, files.length); return; }
  btn.disabled = true; btn.textContent = "Publicando…";
  const p = await rpcOrToast("create_portfolio", data);
  if (!p) { btn.disabled = false; btn.textContent = "Publicar cartera"; return; }
  let failed = 0;
  for (const f of files) {
    try { await uploadTo("portfolio-docs", `${p.id}/${safeName(f.name)}`, f); } catch { failed++; }
  }
  await loadRealData();
  showToast(failed ? `${p.code} publicada, pero ${failed} archivo(s) no se subieron.` : `${p.code} publicada. Ya la ven las casas de cobranza.`);
  navigate(null, "cartera");
}

/* Demo: la cartera publicada queda en este navegador y aparece para las casas de cobranza demo */
function createDemoPortfolio(data, fileCount) {
  const p = {
    id: `LOTE-DEMO-${Date.now()}`, title: data.p_title, type: data.p_type, modality: data.p_modality,
    nominal: data.p_nominal, debtors: data.p_debtors, obligations: data.p_obligations, reserve: data.p_reserve,
    startsAt: Date.parse(data.p_starts), endsAt: Date.parse(data.p_ends), description: data.p_description
  };
  appState.demoPortfolios = [...(appState.demoPortfolios || []), p];
  addDemoPortfolio(p);
  saveDemoState();
  showToast(`${refOf(p.id)} publicada.${fileCount ? " En el demo los archivos no se guardan." : ""} Ya la ven las casas de cobranza demo.`);
  navigate(null, "cartera");
}

async function cancelPortfolio(code) {
  if (!confirm(`¿Retirar ${code} del mercado? Las ofertas recibidas quedarán sin efecto.`)) return;
  if (!await rpcOrToast("cancel_portfolio", { p_portfolio: real.uuidByCode[code] })) return;
  closeDetail();
  showToast(`${code} retirada del mercado.`);
  await loadRealData();
  rerenderCurrent();
}

/* Data room real de la cartera */
async function renderRealDataRoom(lot) {
  const panel = $("#tab-dataroom");
  if (!panel) return;
  const seller = originatorLots.some(l => l.id === lot.id);
  panel.innerHTML = `<div class="page-placeholder"><strong>Cargando data room…</strong></div>`;
  const { data, error } = await sb.storage.from("portfolio-docs").list(lot.uuid, { limit: 100, sortBy: { column: "name", order: "asc" } });
  const files = (data || []).filter(f => f.name && !f.name.startsWith("."));
  panel.innerHTML = `
    <div class="dataroom-panel-head">
      <div><div class="section-kicker">DATA ROOM · ${lot.id}</div><h3>Documentos de la cartera</h3><p>Archivos anonimizados que publicó la entidad vendedora.</p></div>
      ${seller ? `<div class="documents-head-actions">
        <input id="dr-upload" type="file" multiple class="hidden-file-input" onchange="uploadDataRoom('${lot.id}', this)">
        <button class="btn btn-navy btn-small" type="button" onclick="$('#dr-upload').click()">↑ Subir archivos</button></div>` : ""}
    </div>
    ${error ? `<div class="offer-alert warn"><span>${escapeHtml(friendlyError(error))}</span></div>` : ""}
    <div class="document-list">${files.length ? files.map(f => `
      <div class="document-row document-row-enhanced">
        <div class="document-main"><div class="document-icon test">${escapeHtml((f.name.split(".").pop() || "DOC").toUpperCase().slice(0, 4))}</div>
          <div class="document-info"><strong>${escapeHtml(f.name)}</strong><span>${f.metadata?.size ? formatFileSize(f.metadata.size) : ""}</span></div></div>
        <div class="document-actions"><button class="btn btn-blue-soft btn-small" type="button" onclick="openSignedFile('portfolio-docs','${lot.uuid}/${escapeHtml(f.name)}')">Descargar</button></div>
      </div>`).join("") : `<div class="page-placeholder"><strong>Aún no hay documentos</strong><span>${seller ? "Sube la base anonimizada y los soportes." : "La entidad vendedora todavía no publica archivos."}</span></div>`}
    </div>`;
}

async function uploadDataRoom(code, input) {
  const lot = lotById(code);
  const files = [...(input.files || [])];
  let ok = 0;
  for (const f of files) {
    if (f.size > 20 * 1024 * 1024) { showToast(`${f.name} supera 20 MB.`); continue; }
    try { await uploadTo("portfolio-docs", `${lot.uuid}/${safeName(f.name)}`, f, true); ok++; } catch (e) { showToast(friendlyError(e)); }
  }
  if (ok) showToast(`${ok} archivo(s) subido(s) al data room.`);
  renderRealDataRoom(lot);
}

/* =========================================================
   DASHBOARD REAL
   ========================================================= */
function countBy(items, key) {
  const m = {};
  items.forEach(i => { m[i[key]] = (m[i[key]] || 0) + 1; });
  const total = items.length || 1;
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => [k, Math.round(v / total * 100)]);
}

function renderRealDashboard() {
  const content = $("#content");
  const seller = currentRole === "vendedor";
  const ops = appState.operations.filter(o => o.status !== "Cancelada");
  const closed = ops.filter(o => o.status === "Cerrada");
  const open = ops.filter(o => o.status === "En cierre");
  const myTurn = open.filter(o => nextStep(o)?.role === currentRole).length;
  const pool = seller ? originatorLots : buyerOpportunities;
  const live = pool.filter(l => auctionState(l.id) === "vivo").length;
  const bids = seller ? originatorLots.flatMap(l => bidsFor(l.id)) : appState.offers;
  const kpis = seller ? [
    ["Carteras publicadas", originatorLots.length, `${live} en subasta ahora`, "navigate(null,'cartera')"],
    ["Valor publicado", fmtM(originatorLots.reduce((s, l) => s + parseLotAmount(l), 0)), "Saldo nominal", "navigate(null,'subastas')"],
    ["Ofertas recibidas", bids.length, `${bids.filter(b => !b.decision).length} sin decisión`, "navigate(null,'ofertas')"],
    ["Operaciones cerradas", closed.length, `${fmtM(closed.reduce((s, o) => s + o.value, 0))} vendidos`, "navigate(null,'cierre')"]
  ] : [
    ["Carteras disponibles", buyerOpportunities.length, `${live} en subasta ahora`, "navigate(null,'mercado')"],
    ["Mis ofertas", bids.length, `${new Set(bids.map(b => b.lotId)).size} carteras`, "navigate(null,'ofertas')"],
    ["En cierre", open.length, myTurn ? `${myTurn} esperan tu acción` : "Al día", "navigate(null,'cierre')"],
    ["Compradas", closed.length, `${fmtM(closed.reduce((s, o) => s + o.value, 0))} invertidos`, "navigate(null,'cierre')"]
  ];
  const types = countBy(pool, "type");
  const statuses = seller
    ? [["En subasta", originatorLots.filter(l => !operationForLot(l.id)).length, "active"], ["En cierre", open.length, "negotiation"], ["Vendidas", closed.length, "completed"]]
    : [["Disponibles", buyerOpportunities.filter(l => !operationForLot(l.id)).length, "active"], ["Con oferta", new Set(appState.offers.map(o => o.lotId)).size, "negotiation"], ["Adjudicadas", ops.length, "completed"]];
  const hasStatus = statuses.some(s => s[1] > 0);

  content.innerHTML = `
    <div class="dashboard-welcome reveal visible">
      <div style="margin-bottom:25px;">
        <div class="section-kicker">${seller ? "ENTIDAD VENDEDORA" : "CASA DE COBRANZA"} · ${escapeHtml(real.company.name)}</div>
        <div class="dash-title-row">
          <h2 style="font-size:30px;letter-spacing:-1px;color:var(--navy);margin-top:5px;">${seller ? "Tus carteras y las ofertas que han recibido" : "Carteras disponibles y tus ofertas"}</h2>
          ${seller ? `<button class="btn btn-navy" onclick="navigate(null,'publicar')">＋ Publicar cartera</button>` : ""}
        </div>
        <p style="color:var(--muted);font-size:13px;margin-top:5px;">${seller ? "Publica carteras, revisa ofertas y cierra con B²GC Brokers como intermediario." : "Oferta en las carteras que publican bancos, fintech y cooperativas a través de B²GC Brokers."}</p>
      </div>
      <div class="kpi-grid">${seller ? kpis.map(k => kpiCard(k[0], k[1], k[2], "up", k[3])).join("") : buyerKpiCards()}</div>
      <div class="dashboard-chart-grid">
        <div class="dashboard-chart-card dashboard-chart-large">
          ${seller
            ? `<div class="dashboard-chart-header"><div><div class="chart-kicker">SUBASTAS</div><h3>Mejor oferta vs. tu tarifa</h3><p>La línea dorada marca tu tarifa mínima.</p></div></div>${originatorLots.length ? renderReserveChart(originatorLots) : '<div class="page-placeholder"><strong>Aún no has publicado carteras</strong><span>Usa “Publicar cartera” para empezar.</span></div>'}`
            : renderBuyerProcess()}
        </div>
        <div class="dashboard-chart-card">
          <div class="dashboard-chart-header"><div><div class="chart-kicker">${seller ? "TU PORTAFOLIO" : "MERCADO"}</div><h3>Por tipo de cartera</h3></div><button class="chart-period" onclick="navigate(null,'${seller ? "cartera" : "mercado"}')">Ver todo</button></div>
          ${types.length ? svgDonut(types, String(pool.length), "carteras", "rd") : '<div class="page-placeholder"><strong>Sin carteras todavía</strong></div>'}
        </div>
        <div class="dashboard-chart-card">
          <div class="dashboard-chart-header"><div><div class="chart-kicker">SEGUIMIENTO</div><h3>${seller ? "Estado de tus carteras" : "Tu pipeline de compra"}</h3></div></div>
          ${hasStatus ? renderStatusBars(statuses) : '<div class="page-placeholder"><strong>Sin movimiento todavía</strong></div>'}
        </div>
        <div class="dashboard-chart-card">
          <div class="dashboard-chart-header"><div><div class="chart-kicker">CIERRE</div><h3>Operaciones</h3></div></div>
          ${ops.length ? `<div class="op-list" style="grid-template-columns:1fr;margin-top:0">${ops.slice(0, 2).map(opCard).join("")}</div>` : '<div class="page-placeholder"><strong>Sin operaciones todavía</strong><span>Aparecerán al adjudicar una oferta.</span></div>'}
        </div>
      </div>
      ${pool.length ? renderLotsCard() : ""}
    </div>`;
  startCountdowns();
}

/* =========================================================
   PANEL ADMIN REAL (B²GC Brokers)
   ========================================================= */
let realAdminTab = "empresas";
let realAdminFilter = "pendiente";

async function openRealAdmin() {
  appState.realMode = true;
  appState.demoMode = false;
  currentRole = "admin";
  $("#public-site")?.classList.add("hidden");
  $("#app-shell")?.classList.add("hidden");
  let shell = $("#admin-shell");
  if (!shell) { shell = document.createElement("div"); shell.id = "admin-shell"; document.body.appendChild(shell); }
  shell.classList.remove("hidden");
  await renderRealAdmin();
}

function setRealAdminTab(tab) { realAdminTab = tab; renderRealAdmin(); }
function setRealAdminFilter(f) { realAdminFilter = f; renderRealAdmin(); }

async function renderRealAdmin() {
  const shell = $("#admin-shell");
  shell.innerHTML = `<div class="admin-main"><div class="page-placeholder"><strong>Cargando…</strong></div></div>`;
  const [companies, portfolios, bids, ops] = await Promise.all([
    sb.from("companies").select("*").order("created_at", { ascending: false }),
    sb.from("portfolios").select("*").order("created_at", { ascending: false }),
    sb.from("bids").select("id, portfolio_id, percent, status, buyer_name, created_at"),
    sb.from("operations").select("*, operation_steps(*)").order("created_at", { ascending: false })
  ]);
  const err = companies.error || portfolios.error || bids.error || ops.error;
  const C = companies.data || [], P = portfolios.data || [], B = bids.data || [], O = ops.data || [];
  real.adminCompanies = C;

  // Las operaciones se abren con el mismo detalle de cierre (solo lectura para B²GC)
  appState.operations = O.map(o => {
    const steps = {};
    (o.operation_steps || []).forEach(s => { steps[s.step_key] = { at: new Date(s.created_at).toLocaleString("es-CO"), by: s.company_name, signer: s.signer, reference: s.reference, amount: s.amount, file: s.file_path }; });
    real.opUuidByCode[o.code] = o.id;
    return { id: o.code, uuid: o.id, lotId: o.portfolio_code, lotTitle: o.portfolio_title, offerId: o.bid_id, buyer: o.buyer_name, seller: o.seller_name, broker: BROKER,
      percent: Number(o.percent), value: Number(o.value), nominal: Number(o.nominal), status: { en_cierre: "En cierre", cerrada: "Cerrada", cancelada: "Cancelada" }[o.status],
      createdAt: Date.parse(o.created_at), closedAt: o.closed_at ? new Date(o.closed_at).toLocaleString("es-CO") : null, steps,
      log: STEP_ORDER.filter(k => steps[k]).map(k => ({ at: steps[k].at, text: `${CLOSING_STEPS.find(s => s.key === k).done} · ${steps[k].by}` })) };
  });

  const count = s => C.filter(c => c.status === s).length;
  const rows = realAdminFilter === "todas" ? C : C.filter(c => c.status === realAdminFilter);
  const tabBtn = (k, label) => `<button class="${realAdminTab === k ? "active" : ""}" onclick="setRealAdminTab('${k}')">${label}</button>`;
  const closedValue = appState.operations.filter(o => o.status === "Cerrada").reduce((s, o) => s + o.value, 0);

  shell.innerHTML = `
    <header class="admin-top">
      <a class="brand" href="#">B<span class="sup">2</span>GC Brokers <em class="admin-tag">ADMIN</em></a>
      <nav class="admin-nav">${tabBtn("empresas", "Empresas")}${tabBtn("carteras", "Carteras")}${tabBtn("operaciones", "Operaciones")}${tabBtn("analitica", "Analítica")}</nav>
      <div class="admin-top-right"><span class="admin-user">${escapeHtml(real.user?.email || "")}</span><button class="btn btn-ghost btn-small" onclick="realSignOut()">Cerrar sesión</button></div>
    </header>
    <main class="admin-main">
      <div class="section-kicker">B²GC BROKERS · DATOS REALES</div>
      <h2 class="admin-h2">${{ empresas: "Empresas registradas", carteras: "Carteras publicadas", operaciones: "Operaciones", analitica: "Subastas, tiempos y conversión" }[realAdminTab]}</h2>
      ${err ? `<div class="offer-alert warn"><span>${escapeHtml(friendlyError(err))}</span></div>` : ""}
      ${realAdminTab === "analitica" ? "" : `<div class="kpi-grid">
        ${kpiCard("Pendientes de revisión", count("pendiente"), "Empresas por aprobar", "up", "setRealAdminTab('empresas');setRealAdminFilter('pendiente')")}
        ${kpiCard("Empresas aprobadas", count("aprobada"), `${C.filter(c => c.status === "aprobada" && c.role === "vendedor").length} vendedoras · ${C.filter(c => c.status === "aprobada" && c.role === "comprador").length} casas de cobranza`, "up", "setRealAdminTab('empresas');setRealAdminFilter('aprobada')")}
        ${kpiCard("Carteras publicadas", P.filter(p => p.status !== "cancelada").length, `${B.length} ofertas recibidas`, "up", "setRealAdminTab('carteras')")}
        ${kpiCard("Operaciones cerradas", appState.operations.filter(o => o.status === "Cerrada").length, `${fmtM(closedValue)} intermediados`, "up", "setRealAdminTab('operaciones')")}
      </div>`}
      ${realAdminTab === "empresas" ? `
        <div class="admin-tabs">${[["pendiente", "Pendientes"], ["aprobada", "Aprobadas"], ["rechazada", "Rechazadas"], ["suspendida", "Suspendidas"], ["todas", "Todas"]]
          .map(t => `<button class="${realAdminFilter === t[0] ? "active" : ""}" onclick="setRealAdminFilter('${t[0]}')">${t[1]}${t[0] !== "todas" ? ` <b>${count(t[0])}</b>` : ""}</button>`).join("")}</div>
        <div class="card">${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Empresa</th><th>NIT</th><th>Tipo</th><th>Contacto</th><th>Documentos</th><th>Fecha</th><th>Estado</th><th></th></tr></thead><tbody>
          ${rows.map(c => `<tr>
            <td><strong>${escapeHtml(c.name)}</strong><br><small style="color:var(--muted-2)">${escapeHtml(c.city || "—")}</small></td>
            <td>${escapeHtml(c.nit)}</td><td>${ENTITY_LABEL[c.entity_type] || c.entity_type}</td>
            <td>${escapeHtml(c.contact_name)}<br><small style="color:var(--muted-2)">${escapeHtml(c.email)} · ${escapeHtml(c.phone)}</small></td>
            <td>${REQUIRED_DOCS.filter(d => c.docs?.[d.key]).length}/3</td>
            <td>${new Date(c.created_at).toLocaleDateString("es-CO")}</td>
            <td><span class="badge ${STATUS_CLASS[c.status]}">${STATUS_LABEL[c.status]}</span></td>
            <td><button class="btn btn-ghost btn-small" onclick="openRealReview('${c.id}')">${c.status === "pendiente" ? "Revisar" : "Ver"}</button></td>
          </tr>`).join("")}</tbody></table></div>` : `<div class="page-placeholder" style="margin:22px"><strong>No hay empresas en esta vista</strong><span>Cuando una empresa se registre aparecerá aquí.</span></div>`}</div>` : ""}
      ${realAdminTab === "carteras" ? `
        <div class="card">${P.length ? `<div class="table-wrap"><table><thead><tr><th>Cartera</th><th>Vendedor</th><th>Nominal</th><th>Tarifa</th><th>Ofertas</th><th>Más alta</th><th>Ventana</th><th>Estado</th></tr></thead><tbody>
          ${P.map(p => { const pb = B.filter(b => b.portfolio_id === p.id); const top = pb.filter(b => b.status !== "rechazada").sort((a, b) => b.percent - a.percent)[0]; return `<tr>
            <td><strong>${p.code}</strong><br><small style="color:var(--muted-2)">${escapeHtml(p.title)} · ${escapeHtml(p.type)}</small></td>
            <td>${escapeHtml(p.seller_name)}</td><td>${fmtM(Number(p.nominal))}</td><td>${p.reserve_percent}%</td>
            <td>${pb.length}</td><td>${top ? `${top.percent}% · ${escapeHtml(top.buyer_name)}` : "—"}</td>
            <td><small>${new Date(p.starts_at).toLocaleString("es-CO")}<br>${new Date(p.ends_at).toLocaleString("es-CO")}</small></td>
            <td><span class="badge">${p.status}</span></td></tr>`; }).join("")}</tbody></table></div>` : `<div class="page-placeholder" style="margin:22px"><strong>Aún no hay carteras publicadas</strong></div>`}</div>` : ""}
      ${realAdminTab === "operaciones" ? `
        ${appState.operations.length ? `<div class="op-list">${appState.operations.map(opCard).join("")}</div>` : `<div class="card"><div class="page-placeholder" style="margin:22px"><strong>Aún no hay operaciones</strong><span>Aparecerán cuando una entidad vendedora adjudique una oferta.</span></div></div>`}` : ""}
      ${realAdminTab === "analitica" ? renderRealAnalytics(P, B, O, C) : ""}
    </main>`;
}

function openRealReview(id) {
  const c = (real.adminCompanies || []).find(x => x.id === id);
  if (!c) return;
  $("#admin-review")?.remove();
  const el = document.createElement("div");
  el.id = "admin-review";
  el.className = "overlay";
  el.innerHTML = `
    <div class="modal modal-wrap review-modal">
      <button type="button" class="modal-close" onclick="closeReview()">×</button>
      <div class="meta-line">${ENTITY_LABEL[c.entity_type] || ""}</div>
      <h2 style="margin-bottom:4px">${escapeHtml(c.name)}</h2>
      <span class="badge ${STATUS_CLASS[c.status]}">${STATUS_LABEL[c.status]}</span>
      <div class="review-grid">
        <div><span>NIT</span><strong>${escapeHtml(c.nit)}</strong></div>
        <div><span>Representante legal</span><strong>${escapeHtml(c.contact_name)}</strong></div>
        <div><span>Correo</span><strong>${escapeHtml(c.email)}</strong></div>
        <div><span>Celular</span><strong>${escapeHtml(c.phone)}</strong></div>
        <div><span>Ciudad</span><strong>${escapeHtml(c.city || "—")}</strong></div>
        <div><span>Registrada</span><strong>${new Date(c.created_at).toLocaleString("es-CO")}</strong></div>
      </div>
      <div class="doc-upload-title">Documentos</div>
      <div class="review-docs">${REQUIRED_DOCS.map(d => { const f = c.docs?.[d.key]; return `
        <div class="review-doc"><div class="doc-upload-icon">PDF</div>
          <div class="doc-upload-text"><strong>${d.label}</strong><span class="doc-upload-file">${f ? `${escapeHtml(f.name)} · ${formatFileSize(f.size || 0)}` : "No ha subido este documento"}</span></div>
          ${f ? `<div class="review-doc-actions"><button class="btn btn-ghost btn-small" onclick="openSignedFile('company-docs','${f.path}')">Ver</button></div>` : ""}
        </div>`; }).join("")}</div>
      ${c.review_note ? `<div class="page-placeholder" style="margin-top:14px"><strong>Nota</strong><span>${escapeHtml(c.review_note)}</span></div>` : ""}
      <div class="field" style="margin-top:18px"><label for="rv-note">Nota para la empresa (obligatoria si rechazas)</label><textarea id="rv-note" rows="2" placeholder="Ej: Cámara de Comercio con más de 30 días…"></textarea></div>
      <div class="offer-actions">
        ${c.status !== "rechazada" ? `<button class="btn btn-danger-soft" onclick="realReview('${c.id}','rechazada')">Rechazar</button>` : ""}
        ${c.status === "aprobada" ? `<button class="btn btn-danger-soft" onclick="realReview('${c.id}','suspendida')">Suspender</button>` : ""}
        ${c.status !== "aprobada" ? `<button class="btn btn-navy" onclick="realReview('${c.id}','aprobada')" ${REQUIRED_DOCS.every(d => c.docs?.[d.key]) ? "" : "title='Faltan documentos'"}>Aprobar empresa</button>` : ""}
      </div>
    </div>`;
  el.addEventListener("click", e => { if (e.target === el) closeReview(); });
  document.body.appendChild(el);
}

async function realReview(id, status) {
  const c = (real.adminCompanies || []).find(x => x.id === id);
  if (status === "aprobada" && !REQUIRED_DOCS.every(d => c?.docs?.[d.key]) && !confirm("Esta empresa no ha subido los tres documentos. ¿Aprobar de todas formas?")) return;
  const note = ($("#rv-note")?.value || "").trim();
  if (!await rpcOrToast("admin_review_company", { p_company: id, p_status: status, p_note: note })) return;
  closeReview();
  showToast({ aprobada: "Empresa aprobada. Ya puede entrar a la plataforma.", rechazada: "Empresa rechazada.", suspendida: "Acceso suspendido." }[status]);
  renderRealAdmin();
}

/* =========================================================
   ADMIN REAL · ANALÍTICA DE SUBASTAS Y CONVERSIÓN
   Todo sale de los datos reales de Supabase. La lectura
   automática es un conjunto de reglas; con poco historial lo
   dice en lugar de inventar conclusiones.
   ========================================================= */
function realAnalyticsData(P, B, O, C) {
  const now = Date.now();
  const active = P.filter(p => p.status !== "cancelada");
  const opsLive = O.filter(o => o.status !== "cancelada");
  const won = p => p.status === "adjudicada" || p.status === "vendida";
  const finished = active.filter(p => won(p) || Date.parse(p.ends_at) <= now);
  const bidsOf = id => B.filter(b => b.portfolio_id === id);
  const days = p => (Date.parse(p.ends_at) - Date.parse(p.starts_at)) / DAY;
  const firstBidHours = p => {
    const first = bidsOf(p.id).map(b => Date.parse(b.created_at)).sort((a, b) => a - b)[0];
    return first ? Math.max(0, (first - Date.parse(p.starts_at)) / HOUR) : null;
  };
  const rateOf = list => list.length ? list.filter(won).length / list.length * 100 : null;
  const mean = list => list.length ? list.reduce((s, v) => s + v, 0) / list.length : null;
  return {
    now, active, opsLive, finished, won, bidsOf, days, firstBidHours, rateOf, mean,
    live: active.filter(p => p.status === "publicada" && Date.parse(p.starts_at) <= now && Date.parse(p.ends_at) > now),
    upcoming: active.filter(p => p.status === "publicada" && Date.parse(p.starts_at) > now),
    closedOps: O.filter(o => o.status === "cerrada"),
    pendingCompanies: C.filter(c => c.status === "pendiente").length
  };
}

function realCloseProbability(d, p) {
  const bids = d.bidsOf(p.id).filter(b => b.status !== "rechazada");
  const top = Math.max(0, ...bids.map(b => Number(b.percent)));
  let score = 25 + Math.min(new Set(bids.map(b => b.buyer_name)).size, 5) * 8;
  if (bids.length) score += top >= Number(p.reserve_percent) ? 25 : -10 + (top - Number(p.reserve_percent)) * 3;
  if (Date.parse(p.starts_at) > d.now) score -= 15;
  return Math.round(Math.min(97, Math.max(5, score)));
}

function realInsights(d) {
  const out = [];
  const pct = n => `${Math.round(n)}%`;
  if (d.finished.length < 3) {
    out.push({ tone: "info", title: "Todavía hay poco historial", text: `Hay ${d.finished.length} ${d.finished.length === 1 ? "subasta terminada" : "subastas terminadas"}. Las conclusiones sobre duración y conversión aparecerán cuando haya al menos 3.` });
  } else {
    const short = d.finished.filter(p => d.days(p) <= 7), long = d.finished.filter(p => d.days(p) > 7);
    if (short.length && long.length) {
      const better = d.rateOf(short) >= d.rateOf(long);
      const same = Math.round(d.rateOf(short)) === Math.round(d.rateOf(long));
      out.push({ tone: "ok", title: "Duración de las subastas", text: `Las de 7 días o menos se adjudican en ${pct(d.rateOf(short))} de los casos y las más largas en ${pct(d.rateOf(long))}. ${same ? "Por ahora la duración no marca diferencia." : better ? "Conviene ventanas cortas." : "Las ventanas largas están funcionando mejor."}` });
    }
    const withBid = d.finished.filter(p => d.firstBidHours(p) !== null);
    const fast = withBid.filter(p => d.firstBidHours(p) <= 12), slow = withBid.filter(p => d.firstBidHours(p) > 12);
    if (fast.length && slow.length) {
      const f = d.rateOf(fast), sl = d.rateOf(slow);
      out.push({ tone: "info", title: "Primera oferta", text: Math.round(f) === Math.round(sl)
        ? `Por ahora la rapidez de la primera oferta no cambia el resultado: ambas se adjudican en ${pct(f)} de los casos.`
        : `Cuando la primera oferta llega en menos de 12 h se adjudica el ${pct(f)}; si tarda más, el ${pct(sl)}.` });
    }
    const noBids = d.finished.filter(p => !d.bidsOf(p.id).length).length;
    if (noBids) out.push({ tone: "warn", title: "Subastas sin ofertas", text: `${noBids} de ${d.finished.length} subastas terminaron sin ofertas. Revisa precio de salida, información del data room o la difusión entre casas de cobranza.` });
  }
  d.live.forEach(p => {
    const bids = d.bidsOf(p.id).filter(b => b.status !== "rechazada");
    const top = Math.max(0, ...bids.map(b => Number(b.percent)));
    const hoursIn = (d.now - Date.parse(p.starts_at)) / HOUR, left = Date.parse(p.ends_at) - d.now;
    if (!bids.length && hoursIn > 24) out.push({ tone: "warn", title: `${p.code} sin ofertas`, text: `Lleva ${Math.floor(hoursIn / 24) || 1} día(s) abierta sin ofertas. Avisa a las casas de cobranza que la marcaron como favorita.` });
    else if (bids.length && top < Number(p.reserve_percent)) out.push({ tone: "warn", title: `${p.code} bajo tarifa`, text: `La mejor oferta (${top}%) está bajo la tarifa de ${p.seller_name} (${p.reserve_percent}%).` });
    else if (bids.length && left < DAY) out.push({ tone: "ok", title: `${p.code} cierra en menos de 24 h`, text: `Tiene oferta sobre tarifa (${top}%). Probabilidad de cierre: ${realCloseProbability(d, p)}%.` });
  });
  d.opsLive.filter(o => o.status === "en_cierre").forEach(o => {
    const last = Math.max(Date.parse(o.created_at), ...(o.operation_steps || []).map(s => Date.parse(s.created_at)));
    const idle = (d.now - last) / DAY;
    if (idle >= 3) {
      const done = new Set((o.operation_steps || []).map(s => s.step_key));
      const next = CLOSING_STEPS.find(s => !done.has(s.key));
      out.push({ tone: "warn", title: `${o.code} detenida`, text: `Lleva ${Math.floor(idle)} días sin avanzar. Falta: ${next?.label || "—"} (${next ? ROLE[next.role].el : ""}).` });
    }
  });
  if (d.pendingCompanies) out.push({ tone: "info", title: "Empresas por aprobar", text: `${d.pendingCompanies} ${d.pendingCompanies === 1 ? "empresa espera" : "empresas esperan"} la revisión de documentos.` });
  if (!out.length) out.push({ tone: "ok", title: "Todo en orden", text: "No hay subastas en riesgo ni operaciones detenidas." });
  return out;
}

function renderRealAnalytics(P, B, O, C) {
  const d = realAnalyticsData(P, B, O, C);
  const fmt1 = n => n === null ? "—" : n.toLocaleString("es-CO", { maximumFractionDigits: 1 });
  const conv = d.rateOf(d.finished);
  const firstBids = d.finished.concat(d.live).map(d.firstBidHours).filter(h => h !== null);
  const closeDays = d.closedOps.map(o => (Date.parse(o.closed_at) - Date.parse(o.created_at)) / DAY);
  const funnel = [
    ["Carteras publicadas", d.active.length],
    ["Con al menos una oferta", d.active.filter(p => d.bidsOf(p.id).length).length],
    ["Adjudicadas", d.active.filter(d.won).length],
    ["Vendidas (cierre completo)", d.active.filter(p => p.status === "vendida").length]
  ];
  const buckets = [["Hasta 5 días", p => d.days(p) <= 5], ["6 a 7 días", p => d.days(p) > 5 && d.days(p) <= 7], ["8 días o más", p => d.days(p) > 7]]
    .map(([label, fn]) => { const g = d.finished.filter(fn); return { label, n: g.length, rate: d.rateOf(g) }; });
  const icon = { ok: "✓", warn: "!", info: "i" };

  // Para que la cuenta regresiva funcione en la tabla
  [...d.live, ...d.upcoming].forEach(p => { lotProfiles[p.code] = { obligations: p.obligations, likes: 0, favs: 0, comments: 0, offers: 0, bestPercent: 0, startsAt: Date.parse(p.starts_at), endsAt: Date.parse(p.ends_at) }; });
  setTimeout(startCountdowns, 0);

  return `
    <div class="kpi-grid" style="margin-top:18px">
      ${kpiCard("Subastas en vivo", d.live.length, `${d.upcoming.length} por abrir`, "up")}
      ${kpiCard("Ofertas recibidas", B.length, `${new Set(B.map(b => b.buyer_name)).size} casas de cobranza distintas`, "up")}
      ${kpiCard("Conversión", conv === null ? "—" : `${Math.round(conv)}%`, `${d.active.filter(d.won).length} de ${d.finished.length} subastas terminadas se adjudicaron`, "up")}
      ${kpiCard("Tiempos", `${fmt1(d.mean(d.active.map(d.days)))} días`, `Primera oferta en ${fmt1(d.mean(firstBids))} h · cierre en ${fmt1(d.mean(closeDays))} días`, "up")}
    </div>

    <div class="ai-card">
      <div class="ai-card-head"><div class="ai-avatar">B²</div><div><strong>Lectura automática de tiempos y conversión</strong><span>Reglas sobre los datos reales de la plataforma</span></div></div>
      <div class="ai-insights">${realInsights(d).map(i => `<div class="ai-insight ${i.tone}"><b>${icon[i.tone]}</b><div><strong>${escapeHtml(i.title)}</strong><span>${escapeHtml(i.text)}</span></div></div>`).join("")}</div>
    </div>

    <div class="dashboard-chart-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <div class="dashboard-chart-card">
        <div class="dashboard-chart-header"><div><h3>Conversión del mercado</h3><p>De la publicación a la venta</p></div></div>
        ${d.active.length ? `<div class="funnel">${funnel.map(([label, v], i) => `
          <div class="funnel-row"><span>${label}</span><div class="funnel-track"><b style="width:${Math.max(3, v / (funnel[0][1] || 1) * 100)}%"></b></div><strong>${v}</strong>
          <small>${i && funnel[i - 1][1] ? Math.round(v / funnel[i - 1][1] * 100) + "%" : ""}</small></div>`).join("")}</div>`
          : '<div class="page-placeholder"><strong>Aún no hay carteras publicadas</strong></div>'}
      </div>
      <div class="dashboard-chart-card">
        <div class="dashboard-chart-header"><div><h3>Conversión según duración</h3><p>Subastas terminadas, por días de duración</p></div></div>
        ${d.finished.length ? `<div class="activity-chart" style="grid-template-columns:repeat(3,minmax(0,1fr))">${buckets.map(b => `
          <div class="activity-column">
            <div class="activity-value" style="height:${b.rate === null ? 4 : Math.max(6, b.rate)}%"><b>${b.rate === null ? "—" : Math.round(b.rate) + "%"}</b></div>
            <span>${b.label}<br>${b.n} ${b.n === 1 ? "subasta" : "subastas"}</span>
          </div>`).join("")}</div>`
          : '<div class="page-placeholder"><strong>Sin subastas terminadas todavía</strong><span>La gráfica aparece cuando termine la primera.</span></div>'}
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <div class="card-header"><div><h3>Subastas en curso y por abrir</h3><p>Probabilidad de cierre según postores, tarifa y tiempo</p></div></div>
      ${d.live.length + d.upcoming.length ? `<div class="table-wrap"><table><thead><tr>
        <th>Referencia del proceso</th><th>Entidad vendedora</th><th>Tiempo</th><th>Ofertas</th><th>Postores</th><th>Más alta</th><th>Tarifa</th><th>Prob. de cierre</th>
      </tr></thead><tbody>
        ${[...d.live, ...d.upcoming].map(p => {
          const bids = d.bidsOf(p.id).filter(b => b.status !== "rechazada");
          const top = bids.length ? Math.max(...bids.map(b => Number(b.percent))) : null;
          const prob = realCloseProbability(d, p);
          const upcoming = Date.parse(p.starts_at) > d.now;
          return `<tr>
            <td><strong>${escapeHtml(p.code)}</strong><br><small style="color:var(--muted-2)">${escapeHtml(p.title)}</small></td>
            <td>${escapeHtml(p.seller_name)}</td>
            <td><small class="cd-label">${upcoming ? "Abre en" : "Cierra en"}</small> <span class="cd" data-cd="${p.code}|${upcoming ? "inicio" : "cierre"}">—</span></td>
            <td>${d.bidsOf(p.id).length}</td><td>${new Set(bids.map(b => b.buyer_name)).size}</td>
            <td>${top === null ? "—" : top + "%"}</td>
            <td>${p.reserve_percent}% ${top === null ? "" : reserveBadge(top, Number(p.reserve_percent))}</td>
            <td><div class="prob"><div><b style="width:${prob}%"></b></div><strong>${prob}%</strong></div></td>
          </tr>`;
        }).join("")}
      </tbody></table></div>` : '<div class="page-placeholder" style="margin:22px"><strong>No hay subastas en curso</strong></div>'}
    </div>`;
}

/* =========================================================
   INICIO: retomar la sesión si ya había una
   ========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  if (data?.session?.user) afterRealLogin(data.session.user);
});
