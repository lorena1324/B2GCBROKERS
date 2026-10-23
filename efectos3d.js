/* =========================================================
   B²GC BROKERS — EFECTOS3D.JS
   · Escena 3D del inicio (Three.js): entidades vendedoras →
     B²GC Brokers → casas de cobranza, con la cartera fluyendo.
   · Inclinación 3D de tarjetas y gráficas al pasar el mouse.
   · Contadores animados en KPIs y cifras.
   Respeta "reducir movimiento" del sistema y pausa la escena
   cuando no está visible.
   ========================================================= */

const REDUCED_MOTION = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const FINE_POINTER = window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

/* ===== Escena 3D del inicio ===== */
function initHeroScene() {
  const hero = $(".hero");
  if (!hero || typeof THREE === "undefined" || REDUCED_MOTION) return;

  const canvas = document.createElement("canvas");
  canvas.className = "hero-scene";
  canvas.setAttribute("aria-hidden", "true");
  hero.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 17);

  // Textura circular suave para los puntos
  const dot = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.45, "rgba(255,255,255,.85)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  const world = new THREE.Group();
  scene.add(world);

  const CLUSTERS = [
    { x: -7.2, color: 0x2563eb, n: 46, r: 2.3 },  // bancos, fintech y cooperativas
    { x: 0, color: 0xd89b2b, n: 34, r: 1.4 },     // B²GC Brokers
    { x: 7.2, color: 0x102a56, n: 46, r: 2.3 }    // casas de cobranza
  ];

  const nodesOf = CLUSTERS.map(cl => {
    const pts = [];
    for (let i = 0; i < cl.n; i++) {
      const u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1), rr = cl.r * Math.cbrt(Math.random());
      pts.push(new THREE.Vector3(cl.x + rr * Math.sin(v) * Math.cos(u), rr * Math.sin(v) * Math.sin(u) * 0.9, rr * Math.cos(v)));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.PointsMaterial({ color: cl.color, size: cl.x === 0 ? 0.36 : 0.26, map: dot, transparent: true, depthWrite: false, opacity: 0.95 });
    world.add(new THREE.Points(geo, mat));
    return pts;
  });

  // Núcleo de B²GC: anillos que giran
  const rings = [1.9, 2.5].map((r, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.025, 8, 120),
      new THREE.MeshBasicMaterial({ color: i ? 0x2563eb : 0xd89b2b, transparent: true, opacity: 0.45 })
    );
    ring.rotation.x = Math.PI / 2.4 + i * 0.5;
    world.add(ring);
    return ring;
  });

  // Conexiones entre cada lado y el centro
  const linePos = [];
  [0, 2].forEach(side => nodesOf[side].forEach((p, i) => {
    if (i % 2) return;
    const q = nodesOf[1][i % nodesOf[1].length];
    linePos.push(p.x, p.y, p.z, q.x, q.y, q.z);
  }));
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
  world.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x7aa2f7, transparent: true, opacity: 0.14 })));

  // Flujo: la cartera viaja del vendedor a B²GC y de B²GC a la casa de cobranza
  const FLOW = 70;
  const flows = Array.from({ length: FLOW }, () => newFlow(Math.random()));
  function newFlow(t = 0) {
    const a = nodesOf[0][Math.floor(Math.random() * nodesOf[0].length)];
    const b = nodesOf[1][Math.floor(Math.random() * nodesOf[1].length)];
    const c = nodesOf[2][Math.floor(Math.random() * nodesOf[2].length)];
    return { a, b, c, t, speed: 0.0018 + Math.random() * 0.0025, lift: (Math.random() - 0.5) * 3 };
  }
  const flowArr = new Float32Array(FLOW * 3);
  const flowGeo = new THREE.BufferGeometry();
  flowGeo.setAttribute("position", new THREE.BufferAttribute(flowArr, 3));
  world.add(new THREE.Points(flowGeo, new THREE.PointsMaterial({ color: 0xf0bd58, size: 0.3, map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));

  const tmp = new THREE.Vector3();
  function flowPoint(f) {
    // Primera mitad: vendedor → B²GC; segunda mitad: B²GC → casa de cobranza
    const half = f.t < 0.5;
    const from = half ? f.a : f.b, to = half ? f.b : f.c;
    const k = half ? f.t * 2 : (f.t - 0.5) * 2;
    const mid = tmp.set((from.x + to.x) / 2, (from.y + to.y) / 2 + f.lift, (from.z + to.z) / 2 + 1.5);
    const x = (1 - k) * (1 - k) * from.x + 2 * (1 - k) * k * mid.x + k * k * to.x;
    const y = (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * mid.y + k * k * to.y;
    const z = (1 - k) * (1 - k) * from.z + 2 * (1 - k) * k * mid.z + k * k * to.z;
    return [x, y, z];
  }

  // Interacción: parallax con el mouse
  const mouse = { x: 0, y: 0 };
  hero.addEventListener("pointermove", e => {
    const r = hero.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width - 0.5;
    mouse.y = (e.clientY - r.top) / r.height - 0.5;
  });

  function resize() {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // En pantallas angostas se aleja la cámara para que quepan los tres grupos
    camera.position.z = w < 700 ? 30 : w < 1100 ? 21 : 17;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  let visible = true, running = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
  document.addEventListener("visibilitychange", () => { running = !document.hidden; });

  const clock = new THREE.Clock();
  (function frame() {
    requestAnimationFrame(frame);
    if (!visible || !running || $("#public-site")?.classList.contains("hidden")) return;
    const t = clock.getElapsedTime();
    world.rotation.y += ((mouse.x * 0.5 + Math.sin(t * 0.15) * 0.18) - world.rotation.y) * 0.04;
    world.rotation.x += ((mouse.y * 0.3) - world.rotation.x) * 0.04;
    world.position.y = Math.sin(t * 0.6) * 0.15;
    rings[0].rotation.z = t * 0.4;
    rings[1].rotation.z = -t * 0.3;
    flows.forEach((f, i) => {
      f.t += f.speed;
      if (f.t >= 1) flows[i] = newFlow(0);
      const [x, y, z] = flowPoint(flows[i]);
      flowArr[i * 3] = x; flowArr[i * 3 + 1] = y; flowArr[i * 3 + 2] = z;
    });
    flowGeo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  })();
}

/* ===== Inclinación 3D de tarjetas ===== */
const TILT_SELECTOR = [
  ".hero-dashboard", ".public-portfolio-card", ".modalidad", ".bridge-node", ".info-box",
  ".kpi-card", ".dashboard-chart-card", ".auction-card", ".market-card", ".op-card",
  ".spotlight-card", ".report-kpi", ".test-lot-card", ".simulator-main-value", ".chart-card", ".ai-insight"
].join(",");

let tiltEl = null;

function resetTilt(el) {
  if (!el) return;
  el.style.transform = "";
  el.classList.remove("is-tilting");
}

function initTilt() {
  if (!FINE_POINTER || REDUCED_MOTION) return;
  document.addEventListener("pointermove", e => {
    const el = e.target.closest?.(TILT_SELECTOR);
    if (el !== tiltEl) { resetTilt(tiltEl); tiltEl = el; }
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    // Tarjetas grandes se inclinan menos
    const max = r.width > 600 ? 3 : r.width > 360 ? 6 : 9;
    el.classList.add("is-tilting");
    el.style.transform = `perspective(1000px) rotateX(${((0.5 - py) * max).toFixed(2)}deg) rotateY(${((px - 0.5) * max).toFixed(2)}deg) translateZ(0) scale(1.012)`;
    el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
  }, { passive: true });
  document.addEventListener("pointerleave", () => { resetTilt(tiltEl); tiltEl = null; });
}

/* ===== Contadores animados ===== */
const COUNT_SELECTOR = [
  ".kpi-card .value", ".report-kpi strong", ".donut-premium-center strong", ".op-card-value strong",
  ".market-card-stats b", ".hero-mini-stats strong", ".info-stat strong", ".public-portfolio-metrics strong",
  ".status-row strong", ".trend-value"
].join(",");

function parseDisplayNumber(raw) {
  const m = raw.match(/\d[\d.,]*/);
  if (!m) return null;
  const token = m[0].replace(/[.,]$/, "");
  let value, decimals = 0, style;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(token) || /^\d+,\d+$/.test(token)) {
    style = "es";
    decimals = (token.split(",")[1] || "").length;
    value = Number(token.replace(/\./g, "").replace(",", "."));
  } else if (/^\d+\.\d+$/.test(token)) {
    style = "dot";
    decimals = token.split(".")[1].length;
    value = Number(token);
  } else {
    style = "es";
    value = Number(token.replace(/[.,]/g, ""));
  }
  if (!Number.isFinite(value) || value === 0) return null;
  return { token, value, decimals, style, index: m.index };
}

function countUp(el) {
  if (el.dataset.counted || el.querySelector("[data-cd]") || el.hasAttribute("data-cd")) return;
  el.dataset.counted = "1";
  const node = [...el.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.textContent));
  if (!node) return;
  const original = node.textContent;
  const p = parseDisplayNumber(original);
  if (!p) return;
  const fmt = v => p.style === "dot" ? v.toFixed(p.decimals) : v.toLocaleString("es-CO", { minimumFractionDigits: p.decimals, maximumFractionDigits: p.decimals });
  const before = original.slice(0, p.index), after = original.slice(p.index + p.token.length);
  const start = performance.now(), dur = 1100;
  (function step(now) {
    const k = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    node.textContent = k < 1 ? before + fmt(p.value * eased) + after : original;
    if (k < 1) requestAnimationFrame(step);
  })(start);
}

function initCounters() {
  if (REDUCED_MOTION) return;
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { countUp(e.target); io.unobserve(e.target); }
  }), { threshold: 0.3 });
  const scan = root => root.querySelectorAll?.(COUNT_SELECTOR).forEach(el => { if (!el.dataset.counted) io.observe(el); });
  scan(document);
  new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType !== 1) return;
    if (n.matches?.(COUNT_SELECTOR)) io.observe(n);
    scan(n);
  }))).observe(document.body, { childList: true, subtree: true });
}

document.addEventListener("DOMContentLoaded", () => {
  try { initHeroScene(); } catch (err) { console.warn("Escena 3D no disponible.", err); }
  initTilt();
  initCounters();
});
