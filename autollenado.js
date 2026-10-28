/* =========================================================
   B²GC BROKERS — AUTOLLENADO.JS
   En "Publicar cartera", la entidad vendedora sube el archivo
   de la cartera (Excel o CSV) y el formulario se llena solo.

   Acepta dos formatos:
   · Base de obligaciones: una fila por obligación. Se calculan
     valor nominal, deudores, obligaciones, tipo y una
     descripción con mora y ciudades.
   · Ficha de parámetros: dos columnas (parámetro | valor).

   Todo se lee en el navegador; el archivo no se envía a ningún
   lado salvo que la entidad lo deje en el data room.
   ========================================================= */

const SHEETJS_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
const PORTFOLIO_TYPES = ["Consumo", "Libranza", "Comercial", "Hipotecaria", "PYME", "Tarjeta de crédito", "Vehículo", "Microcrédito", "Otro"];

function loadSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SHEETJS_URL;
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error("No se pudo cargar el lector de Excel. Revisa tu conexión a internet."));
    document.head.appendChild(s);
  });
}

/* ----- Utilidades de lectura ----- */
const normKey = v => String(v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function parseNumber(v) {
  if (typeof v === "number") return v;
  if (v instanceof Date || v == null) return NaN;
  let s = String(v).replace(/[$\s%]/g, "").replace(/cop/i, "");
  if (!s) return NaN;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");      // 1.234.567,89
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");                  // 1,234,567.89
  else s = s.replace(",", ".");
  return parseFloat(s);
}

function parseDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * DAY)); // número de serie de Excel
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);                 // dd/mm/aaaa [hh:mm]
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 9), +(m[5] || 0));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function matchType(v) {
  const s = normKey(v);
  if (!s) return null;
  if (/libranza|nomina/.test(s)) return "Libranza";
  if (/tarjeta|^tc$|credito_rotativo/.test(s)) return "Tarjeta de crédito";
  if (/hipotec|vivienda/.test(s)) return "Hipotecaria";
  if (/vehic|auto|moto/.test(s)) return "Vehículo";
  if (/micro/.test(s)) return "Microcrédito";
  if (/pyme|mipyme|empresa/.test(s)) return "PYME";
  if (/comercial/.test(s)) return "Comercial";
  if (/consumo|libre|personal|sobregiro/.test(s)) return "Consumo";
  return null;
}

function matchModality(v) {
  const s = normKey(v);
  if (/subasta/.test(s)) return "Subasta privada";
  if (/directa/.test(s)) return "Compra directa";
  if (/hibrida/.test(s)) return "Híbrida";
  return null;
}

/* ----- Formato 1: ficha de parámetros (parámetro | valor) ----- */
const FICHA_KEYS = [
  ["title", /^(nombre|titulo|nombre_de_la_cartera|cartera)$/],
  ["type", /tipo/],
  ["modality", /modalidad/],
  ["nominal", /nominal|valor_total|saldo_total|saldo_capital|valor_cartera/],
  ["debtors", /deudor/],
  ["obligations", /obligacion|creditos/],
  ["reserve", /tarifa|precio_minimo|reserva/],
  ["starts", /inicio|apertura/],
  ["ends", /cierre|fin|vence/],
  ["description", /descripcion|observacion/]
];

function parseFicha(rows) {
  const pairs = rows.filter(r => r.filter(c => c !== "" && c != null).length >= 2 && r.filter(c => c !== "" && c != null).length <= 3);
  const fields = {};
  pairs.forEach(r => {
    const key = normKey(r[0]);
    const value = r.slice(1).find(c => c !== "" && c != null);
    const hit = FICHA_KEYS.find(([, re]) => re.test(key));
    if (!hit || fields[hit[0]] !== undefined) return;
    const k = hit[0];
    if (k === "type") fields.type = matchType(value) || "Otro";
    else if (k === "modality") { const m = matchModality(value); if (m) fields.modality = m; }
    else if (k === "nominal") { const n = parseNumber(value); if (n > 0) fields.nominal = n >= 1e6 ? n / 1e6 : n; }
    else if (k === "debtors" || k === "obligations") { const n = Math.round(parseNumber(value)); if (n > 0) fields[k] = n; }
    else if (k === "reserve") { let n = parseNumber(value); if (n > 0 && n <= 1) n *= 100; if (n > 0 && n <= 100) fields.reserve = n; }
    else if (k === "starts" || k === "ends") { const d = parseDate(value); if (d) fields[k] = d; }
    else fields[k] = String(value).trim();
  });
  if (Object.keys(fields).length < 2) return null;
  return { kind: "ficha", fields, summary: [`Leímos ${Object.keys(fields).length} parámetros de la ficha.`], pii: false };
}

/* ----- Formato 2: base de obligaciones ----- */
const COLS = {
  balance: [/saldo_capital|capital_insoluto/, /^saldo|saldo$|saldo_total/, /^capital$|valor_capital/, /^valor$|monto/],
  debtor: [/id_deudor|deudor_id|identificacion|cedula|^cc$|^nit$|num(ero)?_documento|documento/, /deudor|cliente_id|id_cliente/],
  obligation: [/num(ero)?_obligacion|obligacion|pagare/, /credito|cuenta|contrato/],
  type: [/tipo_producto|producto|linea/, /tipo/],
  mora: [/dias_mora|dias_de_mora|altura_mora|mora_dias/, /mora/],
  city: [/ciudad|municipio/]
};
const PII = /nombre|apellido|telefono|celular|movil|correo|email|direccion/;

function findCol(headers, patterns) {
  for (const re of patterns) {
    const i = headers.findIndex(h => re.test(h));
    if (i >= 0) return i;
  }
  return -1;
}

function parseBase(rows) {
  // La fila de encabezados es la que más columnas reconocidas tiene entre las primeras 10
  let best = { i: -1, score: 0 };
  rows.slice(0, 10).forEach((r, i) => {
    const h = r.map(normKey);
    const score = Object.values(COLS).filter(p => findCol(h, p) >= 0).length;
    if (score > best.score) best = { i, score };
  });
  if (best.i < 0) return null;
  const headers = rows[best.i].map(normKey);
  const c = Object.fromEntries(Object.entries(COLS).map(([k, p]) => [k, findCol(headers, p)]));
  if (c.balance < 0) return null;

  const data = rows.slice(best.i + 1).filter(r => r.some(v => v !== "" && v != null));
  const items = data.map(r => ({
    balance: parseNumber(r[c.balance]),
    debtor: c.debtor >= 0 ? String(r[c.debtor]).trim() : "",
    obligation: c.obligation >= 0 ? String(r[c.obligation]).trim() : "",
    type: c.type >= 0 ? matchType(r[c.type]) : null,
    mora: c.mora >= 0 ? parseNumber(r[c.mora]) : NaN,
    city: c.city >= 0 ? String(r[c.city]).trim() : ""
  })).filter(x => isFinite(x.balance) && x.balance > 0);
  if (!items.length) return null;

  const total = items.reduce((s, x) => s + x.balance, 0);
  const nominal = total >= 1e6 ? total / 1e6 : total; // si viene en pesos, se pasa a millones
  const obligations = c.obligation >= 0 ? new Set(items.map(x => x.obligation).filter(Boolean)).size || items.length : items.length;
  const debtors = c.debtor >= 0 ? new Set(items.map(x => x.debtor).filter(Boolean)).size : null;

  const byType = {};
  items.forEach(x => { if (x.type) byType[x.type] = (byType[x.type] || 0) + x.balance; });
  const type = Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const withMora = items.filter(x => isFinite(x.mora) && x.mora >= 0);
  const pctOf = n => Math.round(n / total * 100);
  const desc = [`Base de ${fmtN(obligations)} obligaciones${debtors ? ` de ${fmtN(debtors)} deudores` : ""} por ${fmtM(nominal)} de saldo a capital.`];
  if (withMora.length) {
    const avg = withMora.reduce((s, x) => s + x.mora, 0) / withMora.length;
    const buckets = [["al día", 0, 0], ["1 a 90 días", 1, 90], ["91 a 180 días", 91, 180], ["181 a 360 días", 181, 360], ["más de 360 días", 361, Infinity]]
      .map(([label, lo, hi]) => [label, withMora.filter(x => x.mora >= lo && x.mora <= hi).reduce((s, x) => s + x.balance, 0)])
      .filter(b => b[1] > 0)
      .map(([label, v]) => `${label} ${pctOf(v)}%`);
    desc.push(`Mora promedio de ${Math.round(avg)} días. Saldo por altura de mora: ${buckets.join(", ")}.`);
  }
  if (c.city >= 0) {
    const byCity = {};
    items.forEach(x => { if (x.city) byCity[x.city] = (byCity[x.city] || 0) + 1; });
    const top = Object.entries(byCity).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, v]) => `${n} (${Math.round(v / items.length * 100)}%)`);
    if (top.length) desc.push(`Ciudades principales: ${top.join(", ")}.`);
  }
  if (Object.keys(byType).length > 1) desc.push(`Productos: ${Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, v]) => `${t} ${pctOf(v)}%`).join(", ")}.`);

  const fields = { nominal: +nominal.toFixed(1), obligations, description: desc.join(" ") };
  if (debtors) fields.debtors = debtors;
  if (type) { fields.type = type; fields.title = `Cartera de ${type.toLowerCase()} · ${fmtN(obligations)} obligaciones`; }

  const missing = [];
  if (!debtors) missing.push("deudores (no encontramos una columna de cédula o identificación)");
  if (!type) missing.push("tipo de cartera");
  const summary = [`Leímos ${fmtN(items.length)} filas con saldo.`];
  if (data.length > items.length) summary.push(`${fmtN(data.length - items.length)} filas sin saldo válido se ignoraron.`);
  if (missing.length) summary.push(`Revisa a mano: ${missing.join(" y ")}.`);
  return { kind: "base", fields, summary, pii: headers.some(h => PII.test(h)) };
}

/* ----- Llenar el formulario ----- */
const localInput = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);

function applyAutofill(fields) {
  const set = (id, value, onlyIfEmpty = false) => {
    const el = $(id);
    if (!el || value === undefined || value === null || value === "") return false;
    if (onlyIfEmpty && el.value.trim()) return false;
    el.value = value;
    el.classList.add("autofilled");
    el.addEventListener("input", () => el.classList.remove("autofilled"), { once: true });
    return true;
  };
  const filled = [
    set("#pf-title", fields.title, true) && "nombre",
    set("#pf-type", fields.type) && "tipo",
    set("#pf-modality", fields.modality) && "modalidad",
    set("#pf-nominal", fields.nominal) && "valor nominal",
    set("#pf-debtors", fields.debtors) && "deudores",
    set("#pf-obligations", fields.obligations) && "obligaciones",
    set("#pf-reserve", fields.reserve) && "tarifa",
    set("#pf-starts", fields.starts && localInput(fields.starts)) && "inicio",
    set("#pf-ends", fields.ends && localInput(fields.ends)) && "cierre",
    set("#pf-desc", fields.description, true) && "descripción"
  ].filter(Boolean);
  return filled;
}

// La base sin datos personales se deja también en el data room
function attachToDataRoom(file) {
  const input = $("#pf-files");
  if (!input || typeof DataTransfer === "undefined") return false;
  const dt = new DataTransfer();
  [...(input.files || [])].forEach(f => { if (f.name !== file.name) dt.items.add(f); });
  dt.items.add(file);
  input.files = dt.files;
  return true;
}

async function handlePortfolioFile(input) {
  const file = input.files?.[0];
  const box = $("#pf-autofill");
  if (!file || !box) return;
  const say = (cls, html) => { box.className = `offer-alert ${cls}`; box.innerHTML = html; };
  if (file.size > 20 * 1024 * 1024) { say("warn", "<strong>El archivo supera 20 MB.</strong><span>Sube un archivo más liviano o divídelo.</span>"); return; }
  say("ok", `<strong>Leyendo ${escapeHtml(file.name)}…</strong>`);
  try {
    const XLSX = await loadSheetJS();
    const isText = /\.(csv|txt)$/i.test(file.name);
    // En CSV se leen los valores como texto para respetar el formato colombiano (1.234.567,89)
    const wb = isText ? XLSX.read(await file.text(), { type: "string", raw: true }) : XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
    const result = parseFicha(rows) || parseBase(rows);
    if (!result) {
      say("warn", `<strong>No reconocimos el formato del archivo.</strong><span>Necesitamos una columna de saldo (y, si es posible, cédula del deudor, número de obligación, producto, días de mora y ciudad), o una ficha con parámetro y valor. <button type="button" class="btn-text" onclick="downloadPortfolioTemplate()">Descarga la plantilla</button>.</span>`);
      return;
    }
    const filled = applyAutofill(result.fields);
    const attached = result.kind === "base" && !result.pii && attachToDataRoom(file);
    say(result.pii ? "warn" : "ok", `
      <strong>Llenamos ${filled.length ? filled.join(", ") : "ningún campo"} a partir de ${escapeHtml(file.name)}.</strong>
      <span>${result.summary.map(escapeHtml).join(" ")} Revisa los datos antes de publicar; puedes cambiar cualquier campo.</span>
      ${result.pii ? `<span><strong>La base tiene columnas con datos personales</strong> (nombres, teléfonos, correos o direcciones). No la agregamos al data room: anonimízala antes de compartirla (Ley 1581).</span>` : ""}
      ${attached ? "<span>También la dejamos en los archivos del data room.</span>" : ""}`);
  } catch (e) {
    say("warn", `<strong>No pudimos leer el archivo.</strong><span>${escapeHtml(e.message || String(e))}</span>`);
  } finally {
    input.value = "";
  }
}

/* Plantilla con las columnas que reconocemos (datos ficticios, sin datos personales) */
function downloadPortfolioTemplate() {
  const csv = [
    "id_deudor;numero_obligacion;tipo_producto;saldo_capital;dias_mora;ciudad",
    "D0001;OB-10001;Consumo;2.350.000;95;Bogotá",
    "D0001;OB-10002;Tarjeta de crédito;1.120.000;210;Bogotá",
    "D0002;OB-10003;Consumo;4.800.000;400;Medellín",
    "D0003;OB-10004;Libranza;3.050.000;35;Cali"
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = "plantilla-base-cartera.csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
