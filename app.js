/* Filling Vessels — VCE Year 11 introduction to calculus
 * Constant flow rate Q pours water into a vessel of revolution with radius r(y).
 * Volume to height y is V(y) = ∫ π r(y)² dy, so h(V) is the inverse of that integral.
 * Every vessel is scaled to the same capacity and height so the four graphs compare directly.
 */
'use strict';

const HEIGHT_CM   = 20;    // vessel height
const CAPACITY_ML = 1000;  // every vessel holds exactly this much
const BASE_FLOW   = 100;   // mL per second at 1x
const N           = 720;   // profile samples

/* ---------- vessel profiles: relative radius at normalised height u (0 = base, 1 = rim) ---------- */
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const lerp   = (a, b, t) => a + (b - a) * t;

const SHAPES = [
  {
    id: 'straight',
    name: 'Constant width',
    icon: 'M6,2 L6,22 L18,22 L18,2',
    hint: 'The width never changes, so equal volumes always add equal height — the graph is a <strong>straight line</strong>.',
    r: () => 1
  },
  {
    id: 'wider',
    name: 'Wider at the top',
    icon: 'M8,2 L4,22 L20,22 L16,2',
    hint: 'Higher up there is more room to fill, so <em>h</em> rises more and more slowly — the graph <strong>bends over</strong> (concave down).',
    r: (u) => 0.45 + 0.75 * u
  },
  {
    id: 'narrower',
    name: 'Narrower at the top',
    icon: 'M4,2 L8,22 L16,22 L20,2',
    hint: 'Higher up there is less room to fill, so <em>h</em> rises faster and faster — the graph <strong>curves upwards</strong> (concave up).',
    r: (u) => 1.2 - 0.75 * u
  },
  {
    id: 'irregular',
    name: 'Irregular width',
    icon: 'M9,2 L9,9 C9,14 4,15 4,22 L20,22 C20,15 15,14 15,9 L15,2',
    hint: 'Straight sections give <strong>straight pieces</strong> of graph; where the width changes the graph <strong>curves</strong>. Watch the gradient change four times.',
    r: (u) => {
      if (u < 0.38) return 0.42;                                  // narrow stem
      if (u < 0.68) return lerp(0.42, 1.15, smooth((u - 0.38) / 0.30)); // flares out
      if (u < 0.86) return 1.15;                                  // wide body
      return lerp(1.15, 0.55, smooth((u - 0.86) / 0.14));         // neck
    }
  }
];

/* ---------- build the h(V) lookup table for each shape ---------- */
function buildModel(shape) {
  const du = 1 / N;
  const rRel = new Float64Array(N + 1);
  const vRaw = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) rRel[i] = shape.r(i * du);

  // cumulative ∫ π r² dy with y in cm (trapezoidal)
  const dy = HEIGHT_CM * du;
  for (let i = 1; i <= N; i++) {
    const a0 = Math.PI * rRel[i - 1] ** 2;
    const a1 = Math.PI * rRel[i] ** 2;
    vRaw[i] = vRaw[i - 1] + 0.5 * (a0 + a1) * dy;
  }

  // scale radii by k so the capacity is exactly CAPACITY_ML (volume scales with k²)
  const k = Math.sqrt(CAPACITY_ML / vRaw[N]);
  const radius = new Float64Array(N + 1);
  const volume = new Float64Array(N + 1);
  const height = new Float64Array(N + 1);
  let rMax = 0;
  for (let i = 0; i <= N; i++) {
    radius[i] = rRel[i] * k;
    volume[i] = vRaw[i] * k * k;
    height[i] = i * du * HEIGHT_CM;
    if (radius[i] > rMax) rMax = radius[i];
  }
  return { shape, radius, volume, height, rMax, capacity: volume[N] };
}

const MODELS = SHAPES.map(buildModel);
const R_MAX_ALL = Math.max(...MODELS.map(m => m.rMax)); // one drawing scale for all vessels

/* height reached after pouring V, plus the radius there */
function stateAt(model, V) {
  const { volume, height, radius } = model;
  if (V <= 0) return { h: 0, r: radius[0], i: 0 };
  if (V >= model.capacity) return { h: HEIGHT_CM, r: radius[N], i: N };
  let lo = 0, hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (volume[mid] <= V) lo = mid; else hi = mid;
  }
  const span = volume[hi] - volume[lo];
  const t = span > 0 ? (V - volume[lo]) / span : 0;
  return { h: lerp(height[lo], height[hi], t), r: lerp(radius[lo], radius[hi], t), i: lo };
}

/* radius of the vessel at height h (for the water surface / gradient) */
function radiusAtHeight(model, h) {
  const t = Math.min(1, Math.max(0, h / HEIGHT_CM)) * N;
  const i = Math.min(N - 1, Math.floor(t));
  return lerp(model.radius[i], model.radius[i + 1], t - i);
}

/* ---------- state ---------- */
const state = { modelIndex: 0, V: 0, running: false, speed: 1, tangent: false, t: 0 };
const model = () => MODELS[state.modelIndex];

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const vesselCanvas = $('vesselCanvas'), graphCanvas = $('graphCanvas');
const vctx = vesselCanvas.getContext('2d'), gctx = graphCanvas.getContext('2d');
const btnStart = $('btnStart'), btnReset = $('btnReset');
const readoutH = $('readoutH').querySelector('.v');
const readoutV = $('readoutV').querySelector('.v');
const shapeHint = $('shapeHint'), gradientHint = $('gradientHint');
const speedInput = $('speed'), speedOut = $('speedOut'), tangentBox = $('showTangent');

/* shape buttons */
const shapeButtons = SHAPES.map((s, idx) => {
  const b = document.createElement('button');
  b.className = 'shape-btn';
  b.type = 'button';
  b.setAttribute('role', 'radio');
  b.innerHTML = `<svg width="20" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="${s.icon}"/></svg><span>${s.name}</span>`;
  b.addEventListener('click', () => selectShape(idx));
  $('shapeButtons').appendChild(b);
  return b;
});

function selectShape(idx) {
  state.modelIndex = idx;
  state.V = 0;
  setRunning(false);
  shapeButtons.forEach((b, i) => b.setAttribute('aria-checked', String(i === idx)));
  shapeHint.innerHTML = SHAPES[idx].hint;
  gradientHint.innerHTML = 'Press <strong>Start</strong> — watch how steeply the graph rises.';
  draw();
}

function setRunning(on) {
  const full = state.V >= model().capacity - 1e-9;
  state.running = on && !full;
  btnStart.textContent = full ? '✓ Full' : state.running ? '❚❚ Pause' : '▶ Start';
  btnStart.disabled = full;
}

btnStart.addEventListener('click', () => setRunning(!state.running));
btnReset.addEventListener('click', () => { state.V = 0; setRunning(false); draw(); });
speedInput.addEventListener('input', () => {
  state.speed = parseFloat(speedInput.value);
  speedOut.textContent = `${Math.round(BASE_FLOW * state.speed)} mL/s`;
});
tangentBox.addEventListener('change', () => { state.tangent = tangentBox.checked; draw(); });
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); setRunning(!state.running); }
  if (e.key === 'r' || e.key === 'R') { state.V = 0; setRunning(false); draw(); }
});

/* ---------- canvas sizing ---------- */
function fit(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { w, h };
}
new ResizeObserver(() => draw()).observe(document.querySelector('.stage'));

/* ---------- vessel drawing ---------- */
function drawVessel() {
  const { w, h } = fit(vesselCanvas, vctx);
  const m = model();
  const fs = Math.max(10, Math.min(16, w / 22));
  const padL = fs * 4.6, padR = fs * 3.0, padT = fs * 3.6, padB = fs * 2.2;
  const boxW = w - padL - padR, boxH = h - padT - padB;
  if (boxW <= 20 || boxH <= 20) return;

  // one scale for every vessel: same cm → px both ways
  const scale = Math.min(boxW / (2 * R_MAX_ALL), boxH / HEIGHT_CM);
  const baseY = padT + boxH;
  const cx = padL + boxW / 2;
  const X = (rcm) => cx + rcm * scale;
  const Y = (hcm) => baseY - hcm * scale;

  const st = stateAt(m, state.V);
  const waterY = Y(st.h);
  const rSurface = radiusAtHeight(m, st.h);

  // ---- h scale beside the vessel ----
  vctx.strokeStyle = '#c7d3e6';
  vctx.lineWidth = 1.5;
  const axX = Math.max(padL - fs * 1.6, fs * 3.2);
  vctx.beginPath(); vctx.moveTo(axX, Y(0)); vctx.lineTo(axX, Y(HEIGHT_CM) - fs * 0.9); vctx.stroke();
  vctx.beginPath();
  vctx.moveTo(axX, Y(HEIGHT_CM) - fs * 1.5);
  vctx.lineTo(axX - fs * 0.34, Y(HEIGHT_CM) - fs * 0.5);
  vctx.lineTo(axX + fs * 0.34, Y(HEIGHT_CM) - fs * 0.5);
  vctx.closePath(); vctx.fillStyle = '#c7d3e6'; vctx.fill();

  vctx.font = `600 ${fs * 0.82}px ui-sans-serif, system-ui, sans-serif`;
  vctx.fillStyle = '#7787a1';
  vctx.textAlign = 'right'; vctx.textBaseline = 'middle';
  for (let cm = 0; cm <= HEIGHT_CM; cm += 5) {
    const y = Y(cm);
    vctx.strokeStyle = '#c7d3e6';
    vctx.beginPath(); vctx.moveTo(axX, y); vctx.lineTo(axX + fs * 0.42, y); vctx.stroke();
    vctx.fillText(String(cm), axX - fs * 0.3, y);
  }
  vctx.save();
  vctx.translate(axX - fs * 2.5, Y(HEIGHT_CM / 2));
  vctx.rotate(-Math.PI / 2);
  vctx.textAlign = 'center';
  vctx.fillStyle = '#4e6180';
  vctx.font = `italic 700 ${fs}px "Iowan Old Style", Georgia, serif`;
  vctx.fillText('h (cm)', 0, 0);
  vctx.restore();

  // ---- vessel outline path (used for clipping the water) ----
  const wall = () => {
    vctx.beginPath();
    vctx.moveTo(X(-m.radius[0]), Y(0));
    for (let i = 1; i <= N; i++) vctx.lineTo(X(-m.radius[i]), Y(m.height[i]));
    vctx.lineTo(X(m.radius[N]), Y(HEIGHT_CM));
    for (let i = N - 1; i >= 0; i--) vctx.lineTo(X(m.radius[i]), Y(m.height[i]));
    vctx.closePath();
  };

  // ---- pouring stream ----
  if (state.running) {
    const topY = Y(HEIGHT_CM) - fs * 2.6;
    const wob = Math.sin(state.t * 9) * 1.1;
    const streamW = 3.2 + Math.sin(state.t * 14) * 0.5;
    const g = vctx.createLinearGradient(0, topY, 0, waterY);
    g.addColorStop(0, 'rgba(120,200,245,.55)');
    g.addColorStop(1, 'rgba(40,130,220,.85)');
    vctx.fillStyle = g;
    vctx.beginPath();
    vctx.moveTo(cx - streamW, topY);
    vctx.quadraticCurveTo(cx - streamW + wob, (topY + waterY) / 2, cx - streamW * 0.75, waterY);
    vctx.lineTo(cx + streamW * 0.75, waterY);
    vctx.quadraticCurveTo(cx + streamW + wob, (topY + waterY) / 2, cx + streamW, topY);
    vctx.closePath(); vctx.fill();

    // tap
    vctx.fillStyle = '#8fa3bf';
    vctx.beginPath();
    if (vctx.roundRect) vctx.roundRect(cx - fs * 1.1, topY - fs * 1.5, fs * 2.2, fs * 1.5, fs * 0.35);
    else vctx.rect(cx - fs * 1.1, topY - fs * 1.5, fs * 2.2, fs * 1.5);
    vctx.fill();
  }

  // ---- water ----
  vctx.save();
  wall();
  vctx.clip();
  const wg = vctx.createLinearGradient(0, waterY, 0, Y(0));
  wg.addColorStop(0, '#7fd6f7');
  wg.addColorStop(1, '#1668d8');
  vctx.fillStyle = wg;
  const waveA = state.running ? 1.8 : 0.6;
  vctx.beginPath();
  vctx.moveTo(X(-R_MAX_ALL) - 10, Y(0) + 4);
  vctx.lineTo(X(-R_MAX_ALL) - 10, waterY);
  const steps = 40, x0 = X(-R_MAX_ALL) - 10, x1 = X(R_MAX_ALL) + 10;
  for (let i = 0; i <= steps; i++) {
    const x = lerp(x0, x1, i / steps);
    const y = waterY + Math.sin(i / steps * Math.PI * 3 + state.t * 4) * waveA;
    vctx.lineTo(x, y);
  }
  vctx.lineTo(x1, Y(0) + 4);
  vctx.closePath();
  vctx.fill();

  // impact ripple
  if (state.running && state.V > 0) {
    vctx.strokeStyle = 'rgba(255,255,255,.55)';
    vctx.lineWidth = 1.6;
    for (let k = 0; k < 2; k++) {
      const ph = ((state.t * 1.6 + k * 0.5) % 1);
      vctx.globalAlpha = (1 - ph) * 0.8;
      vctx.beginPath();
      vctx.ellipse(cx, waterY + 2, 6 + ph * rSurface * scale * 0.9, (6 + ph * rSurface * scale * 0.9) * 0.22, 0, 0, Math.PI * 2);
      vctx.stroke();
    }
    vctx.globalAlpha = 1;
  }
  vctx.restore();

  // water surface ellipse
  if (state.V > 0) {
    vctx.fillStyle = 'rgba(255,255,255,.42)';
    vctx.strokeStyle = 'rgba(255,255,255,.85)';
    vctx.lineWidth = 1.4;
    vctx.beginPath();
    vctx.ellipse(cx, waterY, rSurface * scale, Math.max(2, rSurface * scale * 0.16), 0, 0, Math.PI * 2);
    vctx.fill(); vctx.stroke();
  }

  // ---- glass ----
  vctx.save();
  wall();
  const glassG = vctx.createLinearGradient(X(-R_MAX_ALL), 0, X(R_MAX_ALL), 0);
  glassG.addColorStop(0, 'rgba(255,255,255,.55)');
  glassG.addColorStop(0.35, 'rgba(255,255,255,.06)');
  glassG.addColorStop(1, 'rgba(160,185,215,.22)');
  vctx.fillStyle = glassG;
  vctx.fill();
  vctx.lineJoin = 'round';
  vctx.strokeStyle = '#7d93b3';
  vctx.lineWidth = Math.max(2.5, fs * 0.24);
  vctx.stroke();
  vctx.restore();

  // dashed level line to the panel edge
  if (state.V > 0) {
    vctx.save();
    vctx.setLineDash([5, 5]);
    vctx.strokeStyle = '#1668d8';
    vctx.lineWidth = 1.4;
    vctx.beginPath(); vctx.moveTo(axX, waterY); vctx.lineTo(w - padR, waterY); vctx.stroke();
    vctx.restore();
    vctx.fillStyle = '#1668d8';
    vctx.font = `700 ${fs * 0.86}px ui-sans-serif, system-ui, sans-serif`;
    vctx.textAlign = 'right'; vctx.textBaseline = 'bottom';
    vctx.fillText(`${st.h.toFixed(1)} cm`, w - padR, waterY - 4);
  }
}

/* ---------- graph drawing ---------- */
function drawGraph() {
  const { w, h } = fit(graphCanvas, gctx);
  const m = model();
  const fs = Math.max(10, Math.min(17, w / 40));
  const padL = fs * 4.6, padR = fs * 2.4, padT = fs * 1.8, padB = fs * 4.2;
  const pw = w - padL - padR, ph = h - padT - padB;
  if (pw <= 30 || ph <= 30) return;

  const Vmax = CAPACITY_ML, Hmax = HEIGHT_CM;
  const X = (V) => padL + (V / Vmax) * pw;
  const Y = (hh) => padT + ph - (hh / Hmax) * ph;

  // plot background
  gctx.fillStyle = '#fbfdff';
  gctx.fillRect(padL, padT, pw, ph);

  // grid
  gctx.font = `600 ${fs * 0.85}px ui-sans-serif, system-ui, sans-serif`;
  gctx.strokeStyle = '#e6ecf7';
  gctx.lineWidth = 1;
  gctx.fillStyle = '#7787a1';
  gctx.textAlign = 'center'; gctx.textBaseline = 'top';
  for (let V = 0; V <= Vmax; V += 200) {
    gctx.beginPath(); gctx.moveTo(X(V), padT); gctx.lineTo(X(V), padT + ph); gctx.stroke();
    gctx.beginPath(); gctx.strokeStyle = '#c7d3e6';
    gctx.moveTo(X(V), padT + ph); gctx.lineTo(X(V), padT + ph + fs * 0.4); gctx.stroke();
    gctx.strokeStyle = '#e6ecf7';
    gctx.fillText(String(V), X(V), padT + ph + fs * 0.7);
  }
  gctx.textAlign = 'right'; gctx.textBaseline = 'middle';
  for (let hh = 0; hh <= Hmax; hh += 5) {
    gctx.beginPath(); gctx.moveTo(padL, Y(hh)); gctx.lineTo(padL + pw, Y(hh)); gctx.stroke();
    gctx.beginPath(); gctx.strokeStyle = '#c7d3e6';
    gctx.moveTo(padL - fs * 0.4, Y(hh)); gctx.lineTo(padL, Y(hh)); gctx.stroke();
    gctx.strokeStyle = '#e6ecf7';
    gctx.fillText(String(hh), padL - fs * 0.75, Y(hh));
  }

  // axes with arrowheads
  gctx.strokeStyle = '#3a4f70';
  gctx.lineWidth = 2;
  gctx.beginPath();
  gctx.moveTo(padL, padT - fs * 0.2); gctx.lineTo(padL, padT + ph); gctx.lineTo(padL + pw + fs * 0.9, padT + ph);
  gctx.stroke();
  gctx.fillStyle = '#3a4f70';
  const arrow = (x, y, dir) => {
    gctx.beginPath();
    if (dir === 'x') { gctx.moveTo(x + fs * 0.7, y); gctx.lineTo(x, y - fs * 0.32); gctx.lineTo(x, y + fs * 0.32); }
    else { gctx.moveTo(x, y - fs * 0.7); gctx.lineTo(x - fs * 0.32, y); gctx.lineTo(x + fs * 0.32, y); }
    gctx.closePath(); gctx.fill();
  };
  arrow(padL + pw + fs * 0.9, padT + ph, 'x');
  arrow(padL, padT - fs * 0.2, 'y');

  // axis titles
  gctx.fillStyle = '#12203a';
  gctx.font = `italic 700 ${fs * 1.15}px "Iowan Old Style", Georgia, serif`;
  gctx.textAlign = 'center'; gctx.textBaseline = 'alphabetic';
  gctx.fillText('V  (mL of water poured)', padL + pw / 2, h - fs * 0.6);
  gctx.save();
  gctx.translate(fs * 1.15, padT + ph / 2);
  gctx.rotate(-Math.PI / 2);
  gctx.fillText('h  (cm)', 0, 0);
  gctx.restore();

  // ---- the curve so far ----
  const st = stateAt(m, state.V);
  if (state.V > 0) {
    const tracePath = () => {
      gctx.beginPath();
      gctx.moveTo(X(0), Y(0));
      for (let i = 1; i <= N; i++) {
        if (m.volume[i] > state.V) break;
        gctx.lineTo(X(m.volume[i]), Y(m.height[i]));
      }
      gctx.lineTo(X(state.V), Y(st.h));
    };

    // soft fill under the curve
    tracePath();
    gctx.lineTo(X(state.V), Y(0));
    gctx.lineTo(X(0), Y(0));
    gctx.closePath();
    const fill = gctx.createLinearGradient(0, padT, 0, padT + ph);
    fill.addColorStop(0, 'rgba(22,104,216,.16)');
    fill.addColorStop(1, 'rgba(22,104,216,.02)');
    gctx.fillStyle = fill;
    gctx.fill();

    // curve
    tracePath();
    gctx.strokeStyle = '#1668d8';
    gctx.lineWidth = Math.max(2.6, fs * 0.28);
    gctx.lineJoin = 'round'; gctx.lineCap = 'round';
    gctx.stroke();

    // tangent (gradient) line
    if (state.tangent) {
      const slope = 1 / (Math.PI * radiusAtHeight(m, st.h) ** 2); // dh/dV = 1/A
      const dV = Vmax * 0.17;
      const p = [[state.V - dV, st.h - slope * dV], [state.V + dV, st.h + slope * dV]];
      gctx.save();
      gctx.setLineDash([7, 5]);
      gctx.strokeStyle = '#e0642b';
      gctx.lineWidth = 2;
      gctx.beginPath(); gctx.moveTo(X(p[0][0]), Y(p[0][1])); gctx.lineTo(X(p[1][0]), Y(p[1][1])); gctx.stroke();
      gctx.restore();
      gctx.font = `700 ${fs * 0.9}px ui-sans-serif, system-ui, sans-serif`;
      gctx.textAlign = 'left'; gctx.textBaseline = 'middle';
      const label = `dh/dV \u2248 ${slope.toFixed(3)} cm/mL`;
      const tw = gctx.measureText(label).width;
      const lx = Math.min(X(state.V) + fs * 1.1, padL + pw - tw - fs * 0.6);
      const ly = Math.max(Y(st.h) - fs * 1.9, padT + fs * 1.2);
      gctx.fillStyle = 'rgba(255,255,255,.92)';
      gctx.beginPath();
      if (gctx.roundRect) gctx.roundRect(lx - fs * 0.4, ly - fs * 0.72, tw + fs * 0.8, fs * 1.44, fs * 0.45);
      else gctx.rect(lx - fs * 0.4, ly - fs * 0.72, tw + fs * 0.8, fs * 1.44);
      gctx.fill();
      gctx.strokeStyle = 'rgba(224,100,43,.35)';
      gctx.lineWidth = 1;
      gctx.stroke();
      gctx.fillStyle = '#e0642b';
      gctx.fillText(label, lx, ly);
    }

    // guide lines + moving point
    gctx.save();
    gctx.setLineDash([4, 5]);
    gctx.strokeStyle = 'rgba(22,104,216,.55)';
    gctx.lineWidth = 1.3;
    gctx.beginPath();
    gctx.moveTo(padL, Y(st.h)); gctx.lineTo(X(state.V), Y(st.h)); gctx.lineTo(X(state.V), padT + ph);
    gctx.stroke();
    gctx.restore();

    gctx.fillStyle = '#1668d8';
    gctx.beginPath(); gctx.arc(X(state.V), Y(st.h), Math.max(4.5, fs * 0.42), 0, Math.PI * 2); gctx.fill();
    gctx.strokeStyle = '#fff'; gctx.lineWidth = 2; gctx.stroke();
  }
}

/* ---------- readouts + commentary ---------- */
function updateReadouts() {
  const m = model();
  const st = stateAt(m, state.V);
  readoutH.textContent = st.h.toFixed(1);
  readoutV.textContent = String(Math.round(state.V));

  if (state.V <= 0) return;
  const rNow = radiusAtHeight(m, st.h);
  const rAvg = Math.sqrt(CAPACITY_ML / (Math.PI * HEIGHT_CM)); // radius of the equal-volume cylinder
  const ratio = rNow / rAvg;
  let msg;
  if (ratio > 1.12) msg = 'The vessel is <strong>wide</strong> here, so <em>h</em> rises slowly — the graph is <strong>flat</strong>.';
  else if (ratio < 0.89) msg = 'The vessel is <strong>narrow</strong> here, so <em>h</em> rises quickly — the graph is <strong>steep</strong>.';
  else msg = 'Average width here — the graph rises at a <strong>middling</strong> gradient.';
  if (state.V >= m.capacity - 1e-9) msg = 'Full: 1000 mL gave 20 cm. Compare this curve with the other vessels.';
  if (gradientHint.dataset.msg !== msg) { gradientHint.innerHTML = msg; gradientHint.dataset.msg = msg; }
}

/* ---------- loop ---------- */
function draw() { drawVessel(); drawGraph(); updateReadouts(); }

let last = null;
function frame(now) {
  const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.running) {
    state.t += dt;
    state.V = Math.min(model().capacity, state.V + BASE_FLOW * state.speed * dt);
    if (state.V >= model().capacity - 1e-9) setRunning(false);
    draw();
  }
  requestAnimationFrame(frame);
}

selectShape(0);
speedOut.textContent = `${BASE_FLOW} mL/s`;
requestAnimationFrame(frame);
