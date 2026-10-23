/* =========================================================
   B²GC BROKERS — EFECTOS3D.JS
   La ficha de la portada: su cuenta regresiva avanza y se
   inclina levemente siguiendo el mouse. Es el único movimiento
   del sitio público. Las gráficas 3D del panel son solo CSS.
   ========================================================= */

const REDUCED_MOTION = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const FINE_POINTER = window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

function initPublicSheet() {
  const sheet = $("#pub-sheet");
  const out = $("#pub-sheet-countdown");
  if (!sheet || !out) return;

  const end = Date.now() + ((2 * 24 + 4) * 60 + 12) * 60 * 1000;
  const pad = n => String(n).padStart(2, "0");
  const tick = () => {
    const s = Math.max(0, Math.floor((end - Date.now()) / 1000));
    out.textContent = `${Math.floor(s / 86400)} d ${pad(Math.floor(s % 86400 / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`;
  };
  tick();
  setInterval(tick, 1000);

  if (REDUCED_MOTION || !FINE_POINTER) return;
  const hero = sheet.closest(".pub-hero") || sheet;
  hero.addEventListener("pointermove", e => {
    const r = sheet.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    sheet.style.transform = `perspective(1100px) rotateY(${(-7 + px * 9).toFixed(2)}deg) rotateX(${(4 - py * 7).toFixed(2)}deg)`;
  });
  hero.addEventListener("pointerleave", () => { sheet.style.transform = ""; });
}

document.addEventListener("DOMContentLoaded", initPublicSheet);
