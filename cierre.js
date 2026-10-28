/* =========================================================
   B²GC BROKERS — CIERRE.JS
   Cierre de operaciones de punta a punta:
   adjudicación → firma del vendedor → firma del comprador →
   pago → confirmación del pago → entrega de la cartera →
   recepción y paz y salvo → operación cerrada.

   Cada paso tiene un responsable (vendedor o comprador), solo
   se habilita cuando el anterior terminó y valida sus datos.

   ⚠ DEMO: el pago solo se registra (referencia y valor); no
   mueve dinero. En producción, firma electrónica, pagos y
   entrega de archivos deben ir en un backend.
   ========================================================= */

const CLOSING_STEPS = [
  { key: "adjudicacion", label: "Adjudicación", role: "vendedor", action: "Adjudicar oferta", done: "Oferta adjudicada" },
  { key: "firmaVendedor", label: "Firma del vendedor", role: "vendedor", action: "Firmar contrato de cesión", done: "Contrato firmado por el vendedor", kind: "firma" },
  { key: "firmaComprador", label: "Firma del comprador", role: "comprador", action: "Firmar contrato de cesión", done: "Contrato firmado por el comprador", kind: "firma" },
  { key: "pago", label: "Pago", role: "comprador", action: "Registrar pago", done: "Pago registrado", kind: "pago" },
  { key: "confirmacionPago", label: "Confirmación del pago", role: "vendedor", action: "Confirmar recepción del pago", done: "Pago confirmado por el vendedor", kind: "check", check: "Confirmo que el valor adjudicado llegó a la cuenta de la empresa." },
  { key: "entrega", label: "Entrega de la cartera", role: "vendedor", action: "Entregar base y soportes", done: "Base de datos y soportes entregados", kind: "check", check: "Entregué la base de datos completa, los soportes y la notificación de cesión a los deudores." },
  { key: "recepcion", label: "Recepción y paz y salvo", role: "comprador", action: "Confirmar recepción y cerrar", done: "Recepción confirmada · operación cerrada", kind: "check", check: "Recibí la cartera completa y declaro a paz y salvo esta operación." }
];

// Cómo nombrar a cada parte en los textos. B²GC Brokers es el intermediario entre ambas.
const BROKER = "B²GC Brokers";
const ROLE = {
  vendedor: { al: "a la entidad vendedora", el: "la entidad vendedora", del: "de la entidad vendedora", name: "Entidad vendedora (banco, fintech o cooperativa)" },
  comprador: { al: "a la casa de cobranza", el: "la casa de cobranza", del: "de la casa de cobranza", name: "Casa de cobranza" }
};

/* ===== Consultas ===== */
const allOperations = () => appState.operations || (appState.operations = []);
const opById = id => allOperations().find(o => o.id === id);
const operationForLot = lotId => allOperations().find(o => o.lotId === lotId && o.status !== "Cancelada");
const nextStep = op => CLOSING_STEPS.find(s => !op.steps[s.key]) || null;
const stepsDone = op => CLOSING_STEPS.filter(s => op.steps[s.key]).length;
const findBid = offerId => lots.flatMap(l => bidsFor(l.id)).find(b => b.id === offerId);
const sellerLotIds = () => originatorLots.map(l => l.id);
const isMyOp = op => currentRole === "vendedor" ? sellerLotIds().includes(op.lotId) : op.buyer === appState.company;
const nowText = () => new Date().toLocaleString("es-CO");

/* Estado visible de cada lote según su operación */
function syncLotStatuses() {
  [lots, originatorLots, buyerOpportunities].forEach(list => list.forEach(lot => {
    if (!lot._base) lot._base = { status: lot.status, statusClass: lot.statusClass };
    const op = operationForLot(lot.id);
    if (op?.status === "Cerrada") { lot.status = "Vendida"; lot.statusClass = "badge-green"; }
    else if (op) { lot.status = "En cierre"; lot.statusClass = "badge-gold"; }
    else { lot.status = lot._base.status; lot.statusClass = lot._base.statusClass; }
  }));
}

/* ===== Reglas del flujo (sin interfaz, para poder probarlas) ===== */
function adjudicateOffer(offerId) {
  const bid = findBid(offerId);
  if (!bid) return { error: "No encontramos esa oferta." };
  const lot = lotById(bid.lotId);
  if (!lot || !sellerLotIds().includes(lot.id)) return { error: "Solo el vendedor dueño de la cartera puede adjudicarla." };
  if (operationForLot(lot.id)) return { error: `${refOf(lot.id)} ya fue adjudicada (${operationForLot(lot.id).id}).` };
  if (bid.decision === "Rechazada") return { error: "Esa oferta fue rechazada; deshaz el rechazo antes de adjudicarla." };

  const seq = allOperations().length + 1;
  const seller = originatorLots.find(l => l.id === lot.id)?.vendedor || appState.company;
  // B²GC Brokers queda registrado como intermediario de la operación
  const op = {
    id: `OP-${new Date().getFullYear()}-${String(seq).padStart(3, "0")}`,
    lotId: lot.id, lotTitle: lot.title, offerId: bid.id,
    buyer: bid.buyer, seller, broker: BROKER, percent: bid.percent,
    value: +(parseLotAmount(lot) * bid.percent / 100).toFixed(1),
    nominal: parseLotAmount(lot),
    status: "En cierre", createdAt: Date.now(),
    steps: { adjudicacion: { at: nowText(), ts: Date.now(), by: seller } },
    log: [{ at: nowText(), text: `${BROKER} registra la adjudicación: oferta ${bid.id} de ${bid.buyer} por ${bid.percent}% (${fmtM(parseLotAmount(lot) * bid.percent / 100)}).` }]
  };
  allOperations().push(op);
  if (!appState.decisions) appState.decisions = {};
  appState.decisions[bid.id] = "Aceptada";
  saveDemoState();
  syncLotStatuses();
  return { ok: true, op };
}

function advanceOperation(opId, key, payload = {}, role = currentRole) {
  const op = opById(opId);
  if (!op) return { error: "No encontramos la operación." };
  if (op.status !== "En cierre") return { error: `La operación está ${op.status.toLowerCase()}.` };
  const step = nextStep(op);
  if (!step || step.key !== key) return { error: `Este paso aún no está habilitado. Primero: ${step?.label || "—"}.` };
  if (step.role !== role) return { error: `Este paso le corresponde ${ROLE[step.role].al}.` };

  const record = { at: nowText(), ts: Date.now(), by: step.role === "vendedor" ? op.seller : op.buyer };
  if (step.kind === "firma") {
    const signer = String(payload.signer || "").trim();
    if (signer.length < 3) return { error: "Escribe el nombre completo de quien firma." };
    if (!payload.accept) return { error: "Debes aceptar los términos del contrato de cesión." };
    record.signer = signer;
  } else if (step.kind === "pago") {
    const reference = String(payload.reference || "").trim();
    const amount = Number(String(payload.amount ?? "").replace(",", "."));
    if (reference.length < 4) return { error: "Escribe la referencia de la transferencia (mínimo 4 caracteres)." };
    if (!Number.isFinite(amount) || Math.abs(amount - op.value) > 0.05) return { error: `El valor pagado (${Number.isFinite(amount) ? fmtM(amount) : "vacío"}) no coincide con el valor adjudicado (${fmtM(op.value)}).` };
    record.reference = reference;
    record.amount = amount;
  } else if (step.kind === "check") {
    if (!payload.accept) return { error: "Marca la confirmación para continuar." };
  }

  op.steps[key] = record;
  op.log.push({ at: record.at, text: `${step.done}${record.signer ? ` (${record.signer})` : ""}${record.reference ? ` · ref. ${record.reference} · ${fmtM(record.amount)}` : ""}.` });
  if (!nextStep(op)) {
    op.status = "Cerrada";
    op.closedAt = record.at;
    op.log.push({ at: record.at, text: "Operación cerrada con éxito. Acta de cierre disponible." });
  }
  saveDemoState();
  syncLotStatuses();
  return { ok: true, op, closed: op.status === "Cerrada" };
}

function cancelOperation(opId) {
  const op = opById(opId);
  if (!op) return { error: "No encontramos la operación." };
  if (stepsDone(op) > 1) return { error: "Ya hay firmas o pagos registrados; la operación no se puede deshacer desde aquí." };
  op.status = "Cancelada";
  op.log.push({ at: nowText(), text: "Adjudicación deshecha por el vendedor." });
  delete appState.decisions[op.offerId];
  saveDemoState();
  syncLotStatuses();
  return { ok: true };
}

/* Datos válidos para que la contraparte responda en el entorno demo */
function demoPayload(op, step) {
  if (step.kind === "firma") return { signer: step.role === "vendedor" ? "Representante legal vendedor" : "Representante legal comprador", accept: true };
  if (step.kind === "pago") return { reference: `TRF-${op.id.slice(-3)}-${Date.now().toString().slice(-5)}`, amount: op.value };
  return { accept: true };
}

/* ===== Interfaz: adjudicar ===== */
function uiAdjudicate(offerId) {
  const bid = findBid(offerId);
  const lot = bid && lotById(bid.lotId);
  if (!bid || !lot) return;
  const others = bidsFor(lot.id).filter(b => b.id !== bid.id).length;
  $("#op-confirm-overlay")?.remove();
  const el = document.createElement("div");
  el.id = "op-confirm-overlay";
  el.className = "offer-overlay";
  el.innerHTML = `
    <div class="offer-modal">
      <button class="detail-close" type="button" onclick="$('#op-confirm-overlay').remove()">×</button>
      <div class="meta-line">${refOf(lot.id)}</div>
      <h2>¿Adjudicar esta oferta?</h2>
      <p>${escapeHtml(lot.title)}</p>
      <div class="op-parties">
        <div><small>Casa de cobranza</small><strong>${escapeHtml(bid.buyer)}</strong></div>
        <div><small>Oferta</small><strong>${bid.percent}%</strong></div>
        <div><small>Valor a pagar</small><strong>${fmtM(parseLotAmount(lot) * bid.percent / 100)}</strong></div>
        <div><small>Tu tarifa</small><strong>${reserveOf(lot.id)}%</strong></div>
      </div>
      ${bid.percent < reserveOf(lot.id) ? `<div class="offer-alert warn"><strong>⚠ Esta oferta está bajo tu tarifa.</strong><span>Puedes adjudicarla igual si te conviene.</span></div>` : ""}
      <div class="offer-alert ok"><strong>Qué pasa al adjudicar</strong><span>La subasta se cierra, las otras ${others} ofertas quedan como “No adjudicada” y se abre el cierre: firmas, pago, entrega y paz y salvo.</span></div>
      <div class="offer-actions">
        <button class="btn btn-ghost" onclick="$('#op-confirm-overlay').remove()">Cancelar</button>
        <button class="btn btn-navy" onclick="confirmAdjudicate('${bid.id}')">Adjudicar y abrir cierre</button>
      </div>
    </div>`;
  el.addEventListener("click", e => { if (e.target === el) el.remove(); });
  document.body.appendChild(el);
}

function confirmAdjudicate(offerId) {
  if (appState.realMode) { realAdjudicate(offerId); return; }
  const res = adjudicateOffer(offerId);
  $("#op-confirm-overlay")?.remove();
  if (res.error) { showToast(res.error); return; }
  showToast(`${res.op.id} creada. Siguiente paso: firma del vendedor.`);
  navigate(null, "cierre");
  openOperation(res.op.id);
}

/* ===== Interfaz: página de cierre ===== */
function renderClosingPage() {
  const seller = currentRole === "vendedor";
  const mine = allOperations().filter(o => o.status !== "Cancelada" && isMyOp(o)).sort((a, b) => b.createdAt - a.createdAt);
  const open = mine.filter(o => o.status === "En cierre");
  const closed = mine.filter(o => o.status === "Cerrada");
  const myTurn = open.filter(o => nextStep(o)?.role === currentRole);

  return `
    <div class="card page-card">
      <div class="section-kicker">CIERRE DE OPERACIONES · ${seller ? "VENDEDOR" : "COMPRADOR"}</div>
      <h2>Cierre de operaciones</h2>
      <p>Cada operación avanza paso a paso: adjudicación, firmas, pago, entrega y paz y salvo. Solo se habilita el paso siguiente y cada uno tiene su responsable.</p>
      <div class="report-kpi-grid">
        <div class="report-kpi"><span>En cierre</span><strong>${open.length}</strong><small>Operaciones activas</small></div>
        <div class="report-kpi warn"><span>Te toca a ti</span><strong>${myTurn.length}</strong><small>Pasos pendientes de tu parte</small></div>
        <div class="report-kpi"><span>Cerradas</span><strong>${closed.length}</strong><small>Con acta de cierre</small></div>
        <div class="report-kpi"><span>Valor cerrado</span><strong>${fmtM(closed.reduce((s, o) => s + o.value, 0))}</strong><small>Suma de operaciones cerradas</small></div>
      </div>
      ${mine.length ? `<div class="op-list">${mine.map(opCard).join("")}</div>` : `
        <div class="page-placeholder"><strong>Aún no hay operaciones en cierre</strong>
          <span>${seller ? "Ve a “Ofertas recibidas” y adjudica una oferta para abrir el cierre." : "Cuando una entidad vendedora adjudique tu oferta, la operación aparecerá aquí."}</span>
          <button class="btn btn-navy btn-small" style="margin-top:12px" onclick="navigate(null,'${seller ? "ofertas" : "subastas"}')">${seller ? "Ir a ofertas recibidas" : "Ver carteras en subasta"}</button></div>`}
    </div>`;
}

function opCard(op) {
  const step = nextStep(op);
  const done = stepsDone(op);
  const mine = step && step.role === currentRole;
  const counterpart = currentRole === "vendedor" ? op.buyer : op.seller;
  return `
    <article class="op-card ${op.status === "Cerrada" ? "closed" : mine ? "my-turn" : ""}" onclick="openOperation('${op.id}')" role="button" tabindex="0">
      <div class="op-card-head">
        <div><div class="lot-number">${op.id} · ${refOf(op.lotId)}</div><h3>${escapeHtml(op.lotTitle)}</h3><span>${currentRole === "vendedor" ? "Casa de cobranza" : "Entidad vendedora"}: ${escapeHtml(counterpart)} · vía ${BROKER}</span></div>
        <div class="op-card-value"><strong>${fmtM(op.value)}</strong><small>${op.percent}% del nominal</small></div>
      </div>
      <div class="op-mini-steps">${CLOSING_STEPS.map(s => `<i class="${op.steps[s.key] ? "done" : step?.key === s.key ? "current" : ""}" title="${s.label}"></i>`).join("")}</div>
      <div class="op-card-foot">
        <span>${done} de ${CLOSING_STEPS.length} pasos</span>
        ${op.status === "Cerrada"
          ? '<span class="badge badge-green">✓ Cerrada</span>'
          : mine ? `<span class="chip chip-warn">Te toca: ${step.label}</span>` : `<span class="chip">Esperando ${ROLE[step.role].al}: ${step.label}</span>`}
      </div>
    </article>`;
}

/* Tabla corta para la página de adjudicaciones */
function renderOpsMiniTable() {
  const mine = allOperations().filter(o => o.status !== "Cancelada" && isMyOp(o));
  if (!mine.length) return "";
  return `
    <div class="op-inline">
      <div class="section-kicker">OPERACIONES DE LA PLATAFORMA</div>
      <div class="op-list">${mine.map(opCard).join("")}</div>
    </div>`;
}

/* ===== Interfaz: detalle de la operación ===== */
function openOperation(opId) {
  const op = opById(opId);
  if (!op) return;
  $("#op-overlay")?.remove();
  const step = nextStep(op);
  const myTurn = step && step.role === currentRole;
  const el = document.createElement("div");
  el.id = "op-overlay";
  el.className = "offer-overlay";
  el.innerHTML = `
    <div class="offer-modal op-modal">
      <button class="detail-close" type="button" onclick="closeOperation()">×</button>
      <div class="meta-line">${op.id} · ${refOf(op.lotId)}</div>
      <h2>${escapeHtml(op.lotTitle)}</h2>
      <span class="badge ${op.status === "Cerrada" ? "badge-green" : op.status === "Cancelada" ? "badge-red" : "badge-gold"}">${op.status}</span>

      <div class="op-parties">
        <div><small>Entidad vendedora</small><strong>${escapeHtml(op.seller)}</strong></div>
        <div><small>Casa de cobranza</small><strong>${escapeHtml(op.buyer)}</strong></div>
        <div class="op-broker"><small>Intermediario</small><strong>${BROKER}</strong><span>Conecta a las partes, custodia el data room y verifica cada paso del cierre.</span></div>
        <div><small>Valor adjudicado</small><strong>${fmtM(op.value)}</strong></div>
        <div><small>Precio</small><strong>${op.percent}% de ${fmtM(op.nominal)}</strong></div>
      </div>

      ${op.status === "Cerrada" ? `
        <div class="op-success"><div class="success-mark">✓</div><div><strong>Operación cerrada con éxito</strong><span>Cerrada el ${escapeHtml(op.closedAt)} · ya puedes descargar el acta de cierre.</span></div></div>` : ""}

      <ol class="op-steps">
        ${CLOSING_STEPS.map((s, i) => {
          const rec = op.steps[s.key];
          const current = step?.key === s.key && op.status === "En cierre";
          return `<li class="${rec ? "done" : current ? "current" : ""}">
            <span class="op-step-dot">${rec ? "✓" : i + 1}</span>
            <div><strong>${s.label}</strong><small>${rec ? `${escapeHtml(rec.at)} · ${escapeHtml(rec.by)}${rec.signer ? ` · firmó ${escapeHtml(rec.signer)}` : ""}${rec.reference ? ` · ref. ${escapeHtml(rec.reference)}` : ""}` : `Responsable: ${ROLE[s.role].el}`}</small>
              ${rec?.file ? `<button class="btn-text" onclick="openSignedFile('operation-docs','${escapeHtml(rec.file)}')">Ver documento adjunto</button>` : ""}
              ${current ? (myTurn ? stepForm(op, s) : waitingBox(op, s)) : ""}
            </div>
          </li>`;
        }).join("")}
      </ol>

      <div class="op-log"><div class="meta-line"><strong>Historial</strong></div>${op.log.slice().reverse().map(l => `<div><small>${escapeHtml(l.at)}</small><span>${escapeHtml(l.text)}</span></div>`).join("")}</div>

      <div class="offer-actions">
        ${currentRole === "vendedor" && op.status === "En cierre" && stepsDone(op) === 1 ? `<button class="btn btn-danger-soft" onclick="uiCancelOperation('${op.id}')">Deshacer adjudicación</button>` : ""}
        <button class="btn btn-ghost" onclick="downloadOpDoc('${op.id}','contrato')">${op.steps.firmaComprador ? "Descargar contrato" : "Descargar borrador del contrato"}</button>
        ${op.status === "Cerrada" ? `<button class="btn btn-navy" onclick="downloadOpDoc('${op.id}','acta')">Descargar acta de cierre</button>` : `<button class="btn btn-ghost" onclick="closeOperation()">Cerrar</button>`}
      </div>
    </div>`;
  el.addEventListener("click", e => { if (e.target === el) closeOperation(); });
  document.body.appendChild(el);
}

function closeOperation() { $("#op-overlay")?.remove(); }

function stepForm(op, s) {
  let fields = "";
  if (s.kind === "firma") fields = `
    <label class="offer-field"><span>Nombre de quien firma (representante legal)</span><input id="op-signer" type="text" placeholder="Nombre completo"></label>
    <label class="consent"><input type="checkbox" id="op-accept"><span>Acepto los términos del contrato de cesión de cartera por ${fmtM(op.value)}.</span></label>`;
  else if (s.kind === "pago") fields = `
    <div class="offer-summary"><span>Valor a pagar</span><strong>${fmtM(op.value)}</strong></div>
    <label class="offer-field"><span>Referencia de la transferencia</span><input id="op-ref" type="text" placeholder="Ej: TRF-2026-00981"></label>
    <label class="offer-field"><span>Valor pagado (millones COP)</span><input id="op-amount" type="number" step="0.1" value="${op.value}"></label>
    <small class="op-note">${appState.realMode ? "Haz la transferencia desde tu banco a la cuenta de la entidad vendedora y registra aquí la referencia y el comprobante." : "Demo: aquí solo se registra el pago; no se mueve dinero."}</small>`;
  else fields = `<label class="consent"><input type="checkbox" id="op-accept"><span>${s.check}</span></label>`;
  return `
    <div class="op-form">
      <div class="chip chip-warn">Te toca a ti</div>
      ${fields}
      ${appState.realMode ? `<label class="offer-field"><span>${{ firma: "Contrato firmado (PDF, opcional)", pago: "Comprobante de pago (PDF o imagen) *" }[s.kind] || "Soporte (opcional)"}</span><input id="op-file" type="file" accept=".pdf,.png,.jpg,.jpeg"></label>` : ""}
      <div id="op-error" class="offer-alert warn hidden"></div>
      <button class="btn btn-navy btn-small" onclick="submitStep('${op.id}','${s.key}')">${s.action}</button>
    </div>`;
}

function waitingBox(op, s) {
  return `
    <div class="op-form waiting">
      <span>Esperando que ${ROLE[s.role].el} complete este paso. ${BROKER} le notifica y hace seguimiento.</span>
      ${appState.demoMode ? `<button class="btn btn-ghost btn-small" onclick="simulateCounterparty('${op.id}')">Simular respuesta ${ROLE[s.role].del} (demo)</button>` : ""}
    </div>`;
}

function submitStep(opId, key) {
  const payload = {
    signer: $("#op-signer")?.value,
    accept: $("#op-accept")?.checked,
    reference: $("#op-ref")?.value,
    amount: $("#op-amount")?.value
  };
  if (appState.realMode) {
    if (key === "pago" && !$("#op-file")?.files?.length) { showToast("Adjunta el comprobante de pago."); return; }
    realAdvance(opId, key, payload, $("#op-file"));
    return;
  }
  const res = advanceOperation(opId, key, payload, currentRole);
  if (res.error) {
    const box = $("#op-error");
    if (box) { box.classList.remove("hidden"); box.innerHTML = `<strong>${escapeHtml(res.error)}</strong>`; }
    showToast(res.error);
    return;
  }
  afterStep(res);
}

function simulateCounterparty(opId) {
  const op = opById(opId);
  const step = op && nextStep(op);
  if (!step) return;
  afterStep(advanceOperation(opId, step.key, demoPayload(op, step), step.role));
}

function afterStep(res) {
  if (res.error) { showToast(res.error); return; }
  const step = nextStep(res.op);
  showToast(res.closed ? `${res.op.id} cerrada con éxito.` : `Listo. Siguiente paso: ${step.label} (${ROLE[step.role].el}).`);
  rerenderCurrent();
  openOperation(res.op.id);
}

function uiCancelOperation(opId) {
  if (!confirm("¿Deshacer la adjudicación? La subasta vuelve a quedar abierta.")) return;
  if (appState.realMode) { realCancelOperation(opId); return; }
  const res = cancelOperation(opId);
  if (res.error) { showToast(res.error); return; }
  closeOperation();
  showToast("Adjudicación deshecha.");
  rerenderCurrent();
}

function downloadOpDoc(opId, kind) {
  const op = opById(opId);
  if (!op) return;
  const s = op.steps;
  const head = kind === "acta" ? "ACTA DE CIERRE DE OPERACIÓN" : "CONTRATO DE CESIÓN DE CARTERA";
  const text = [
    `${head} — ${op.id}`, "Documento de prueba generado por B²GC Brokers (entorno demo).", "",
    `Referencia del proceso: ${refOf(op.lotId)} · ${op.lotTitle}`,
    `Cedente (entidad vendedora): ${op.seller}`, `Cesionario (casa de cobranza): ${op.buyer}`,
    `Intermediario: ${BROKER} — conecta a las partes y verifica el cierre.`,
    `Valor nominal: ${fmtM(op.nominal)}`, `Precio: ${op.percent}% · ${fmtM(op.value)}`, "",
    `Firma vendedor: ${s.firmaVendedor?.signer || "—"} · ${s.firmaVendedor?.at || ""}`,
    `Firma comprador: ${s.firmaComprador?.signer || "—"} · ${s.firmaComprador?.at || ""}`,
    ...(kind === "acta" ? ["",
      `Pago: ref. ${s.pago?.reference || "—"} · ${s.pago ? fmtM(s.pago.amount) : ""} · ${s.pago?.at || ""}`,
      `Pago confirmado: ${s.confirmacionPago?.at || "—"}`,
      `Entrega de cartera: ${s.entrega?.at || "—"}`,
      `Recepción y paz y salvo: ${s.recepcion?.at || "—"}`, "",
      "HISTORIAL", ...op.log.map(l => `- ${l.at}: ${l.text}`)] : [])
  ].join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${op.id}-${kind}.txt`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  showToast(`Descarga preparada: ${kind === "acta" ? "acta de cierre" : "contrato"}.`);
}

/* ===== Prueba automática: una operación completa de punta a punta ===== */
function runClosingFlowTest(show = true) {
  const snapshot = JSON.stringify({ offers: appState.offers, decisions: appState.decisions, operations: appState.operations });
  const role = currentRole;
  const results = [];
  const check = (name, ok) => results.push({ name, ok: Boolean(ok) });
  try {
    const lot = originatorLots.find(l => !operationForLot(l.id));
    check("Hay una cartera del vendedor disponible para adjudicar", lot);
    if (!lot) throw new Error("sin lote");

    const top = topBid(lot.id);
    const offer = { id: `OF-QA-${Date.now()}`, lotId: lot.id, percent: Math.min(100, +((top?.percent || 80) + 1).toFixed(1)), status: "Enviada", date: new Date().toLocaleDateString("es-CO"), at: Date.now(), buyer: demoAccounts.comprador.company };
    appState.offers.unshift(offer);
    check("El comprador presenta una oferta que supera la más alta", topBid(lot.id)?.id === offer.id);

    const adj = adjudicateOffer(offer.id);
    check("El vendedor adjudica la oferta y se crea la operación", adj.ok);
    const op = adj.op;
    check("La subasta queda cerrada y el lote 'En cierre'", auctionState(lot.id) === "cerrada" && lotById(lot.id).status === "En cierre");
    check("No se puede adjudicar dos veces la misma cartera", adjudicateOffer(bidsFor(lot.id).find(b => b.id !== offer.id)?.id || offer.id).error);
    check("No se puede saltar pasos (pago antes de las firmas)", advanceOperation(op.id, "pago", { reference: "TRF-1", amount: op.value }, "comprador").error);
    check("Cada paso solo lo hace su responsable", advanceOperation(op.id, "firmaVendedor", { signer: "Ana Pérez", accept: true }, "comprador").error);
    check("La firma exige aceptar los términos", advanceOperation(op.id, "firmaVendedor", { signer: "Ana Pérez", accept: false }, "vendedor").error);
    check("Firma del vendedor", advanceOperation(op.id, "firmaVendedor", { signer: "Ana Pérez", accept: true }, "vendedor").ok);
    check("Firma del comprador", advanceOperation(op.id, "firmaComprador", { signer: "Luis Gómez", accept: true }, "comprador").ok);
    check("Rechaza un pago con valor distinto al adjudicado", advanceOperation(op.id, "pago", { reference: "TRF-2026-1", amount: op.value - 10 }, "comprador").error);
    check("Pago registrado por el valor exacto", advanceOperation(op.id, "pago", { reference: "TRF-2026-1", amount: op.value }, "comprador").ok);
    check("El vendedor confirma el pago", advanceOperation(op.id, "confirmacionPago", { accept: true }, "vendedor").ok);
    check("El vendedor entrega la cartera", advanceOperation(op.id, "entrega", { accept: true }, "vendedor").ok);
    const last = advanceOperation(op.id, "recepcion", { accept: true }, "comprador");
    check("El comprador confirma recepción y la operación se cierra", last.ok && last.closed && op.status === "Cerrada");
    check("El lote queda como 'Vendida'", lotById(lot.id).status === "Vendida");
    check("Una operación cerrada no admite más pasos", advanceOperation(op.id, "recepcion", { accept: true }, "comprador").error);
  } catch (e) {
    if (e.message !== "sin lote") check(`Error inesperado: ${e.message}`, false);
  } finally {
    const s = JSON.parse(snapshot);
    appState.offers = s.offers; appState.decisions = s.decisions; appState.operations = s.operations || [];
    currentRole = role;
    saveDemoState();
    syncLotStatuses();
  }

  const passed = results.filter(r => r.ok).length;
  const ok = passed === results.length;
  const target = $("#test-results");
  if (show && target) {
    target.innerHTML = `<div class="test-result ${ok ? "pass" : "fail"}"><span>${ok ? "✓" : "×"}</span><strong>Operación completa de punta a punta</strong><small>${passed}/${results.length}</small></div>` +
      results.map(r => `<div class="test-result ${r.ok ? "pass" : "fail"}"><span>${r.ok ? "✓" : "×"}</span><strong>${r.name}</strong><small>${r.ok ? "OK" : "REVISAR"}</small></div>`).join("");
  }
  if (show) showToast(ok ? `Operación completa: ${passed}/${results.length} pasos correctos. Los datos se restauraron.` : `Revisar: ${passed}/${results.length} pasos correctos.`);
  return { ok, results };
}

document.addEventListener("keydown", e => { if (e.key === "Escape") { closeOperation(); $("#op-confirm-overlay")?.remove(); } });

syncLotStatuses();
