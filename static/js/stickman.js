/*! stickman.js — pop-culture stickman cursor. Drop-in: <script src="stickman.js" defer></script>
   Every colour, the size, outline width and shadow offset come from the --sm-* custom properties in your
   stylesheet, which in turn point at your design tokens, so the stickman follows your theme (incl. light/dark).
   Optional overrides: set window.StickmanConfig = { selectors: {...}, fightMs: 3000 } before this script. */
(() => {
'use strict';
if (!matchMedia('(hover:hover) and (pointer:fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return; // touch / reduced motion: native cursor stays
const start = () => {

const USER = window.StickmanConfig || {};
const SEL = Object.assign({
  fight: '[data-state="fight"], .btn-strong',                 // button turns into a boss; hold to beat it
  goku: '[data-state="goku"], .chips li, .badge',             // skill blocks: power-up, hold = Kamehameha
  wall: '[data-wall], .nav a, .btn, .theme-toggle, .brand'    // parkour
}, USER.selectors);
const CFG = Object.assign({ idleBelow: 220, swingOn: 380, kineticOn: 1100, follow: 34, fightMs: 2600 }, USER);
let S = .5, FONT_T, FONT_S; const TAU = Math.PI * 2;
const T = {}; // design tokens, read from your CSS custom properties
function readTokens() {
  const cs = getComputedStyle(document.documentElement), g = (n, d) => cs.getPropertyValue(n).trim() || d;
  T.ink = g('--sm-ink', '#f4f5f6'); T.line = g('--sm-outline', '#0d0e10'); T.skin = g('--sm-skin', '#2b3036');
  T.accent = g('--sm-accent', '#d9a05b'); T.onAccent = g('--sm-on-accent', '#1a1d20'); T.shadow = g('--sm-shadow', '#687079');
  T.danger = g('--sm-danger', '#c4503f'); T.beam = g('--sm-beam', '#7fd6e0');
  T.bg = g('--sm-bubble-bg', T.skin); T.bgInk = g('--sm-bubble-ink', T.ink);
  T.stroke = parseFloat(g('--sm-border', '3')) || 3; T.off = parseFloat(g('--sm-offset', '4')) || 4;
  S = parseFloat(g('--sm-scale', '.5')) || .5;
  const f = g('--sm-font', 'system-ui,sans-serif') + ',"Segoe UI Emoji","Apple Color Emoji",sans-serif';
  FONT_T = '600 11px ' + f; FONT_S = 'italic 800 12px ' + f; text = ''; // force bubble re-measure
}
const cv = document.createElement('canvas'); cv.id = 'sm-canvas'; cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(cv);
const ctx = cv.getContext('2d');
let W = 0, H = 0, dpr = 1;
const resize = () => { dpr = devicePixelRatio || 1; W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); };
resize(); addEventListener('resize', resize);
const rnd = (a, b) => a + Math.random() * (b - a), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

/* ---------- input ---------- */
const m = { x: 0, y: 0, tx: 0, ty: 0, px: 0, py: 0, vx: 0, vy: 0, speed: 0, ang: 0, vis: false, ctx: null, el: null, down: false, downCtx: null, downAt: 0 };
let state = 'idle', text = '', textW = 0, bubbleAt = 0, transitUntil = 0, still = 0;
let hp = 100, victoryUntil = 0, fightEl = null, lastHp = -1, lastVic = false;

function pick(el) {
  const c = q => (el && el.closest ? el.closest(q) : null); let n;
  m.el = null; m.ctx = null;
  if ((n = c(SEL.fight))) { m.ctx = 'fight'; m.el = n; }
  else if ((n = c(SEL.goku))) { m.ctx = 'goku'; m.el = n; }
  else if ((n = c(SEL.wall))) { m.ctx = 'wall'; m.el = n; }
}
addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  m.tx = e.clientX; m.ty = e.clientY;
  if (!m.vis) { m.vis = true; m.x = m.px = m.tx; m.y = m.py = m.ty; m.vx = m.vy = 0; }
  pick(e.target);
}, { passive: true });
addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  m.down = true; m.downCtx = m.ctx; m.downAt = performance.now();
  if (m.ctx === 'fight') { fightEl = m.el; arm(fightEl); }
});
const release = () => { m.down = false; };
addEventListener('pointerup', release); addEventListener('pointercancel', release); addEventListener('blur', release);
document.documentElement.addEventListener('mouseleave', () => { m.vis = false; m.down = false; });
addEventListener('scroll', () => { transitUntil = performance.now() + 450; if (m.vis) pick(document.elementFromPoint(m.tx, m.ty)); }, { passive: true, capture: true });

/* ---------- boss bar ---------- */
function arm(el) { // two stacked labels: the clipped top one sits on the amber fill, so text stays readable on both sides
  if (!el || el._lbl) return;
  const o = el.innerHTML; el.setAttribute('data-sm-armed', '');
  el.innerHTML = '<span class="sm-lbl">' + o + '</span><span class="sm-hp" aria-hidden="true"><span class="sm-lbl">' + o + '</span></span>';
  el._lbl = [...el.querySelectorAll('.sm-lbl')]; el._orig = o; el.style.minWidth = el.offsetWidth + 'px';
}
document.querySelectorAll(SEL.fight).forEach(arm);
function updateFight(dt, now) {
  const fighting = state === 'fight' && m.down && m.downCtx === 'fight';
  if (victoryUntil) { if (now > victoryUntil) { victoryUntil = 0; hp = 100; } }
  else if (fighting) { hp = Math.max(0, hp - 100 * dt / (CFG.fightMs / 1000)); if (hp === 0) victoryUntil = now + 1800; }
  else if (hp < 100) hp = Math.min(100, hp + 70 * dt);
  const v = Math.round(hp), vic = !!victoryUntil;
  if (!fightEl || (v === lastHp && vic === lastVic)) return;
  lastHp = v; lastVic = vic;
  for (const L of fightEl._lbl) { // the button is the loading bar: it fills as the boss falls
    if (vic) L.textContent = 'VICTORY! 🏆'; else if (v < 100) L.textContent = 'LOADING ' + (100 - v) + '%'; else L.innerHTML = fightEl._orig;
  }
  fightEl.style.setProperty('--sm-p', (100 - v) + '%'); fightEl.style.setProperty('--sm-w', fightEl.clientWidth + 'px');
}

/* ---------- particles (world space) ---------- */
const P = [];
function emit(x, y, vx, vy, life, size, col, kind, txt) {
  if (P.length < 240) P.push({ x, y, vx, vy, l: life, m: life, s: size, c: col, k: kind || 0, t: txt });
}
function stepP(dt) {
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.l -= dt;
    if (p.l <= 0) { P[i] = P[P.length - 1]; P.pop(); continue; }
    if (p.k === 3) p.vy += 320 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
function drawP() {
  ctx.lineCap = 'round'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of P) {
    const a = p.l / p.m; ctx.globalAlpha = a; ctx.fillStyle = ctx.strokeStyle = p.c;
    if (p.k === 2) { ctx.font = '900 ' + p.s + 'px system-ui'; ctx.lineWidth = 3; ctx.strokeStyle = T.line; ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1 + (1 - a) * .6, 1 + (1 - a) * .6); ctx.strokeText(p.t, 0, 0); ctx.fillText(p.t, 0, 0); ctx.restore(); }
    else if (p.k === 1) { ctx.lineWidth = p.s; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .05, p.y - p.vy * .05); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (.4 + a * .6), 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

/* ---------- drawing helpers (local, pre-scale units) ---------- */
const pl = (...p) => { ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); };
const circ = (x, y, r) => { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); };
const glow = () => {}; // neobrutalist: no soft glows
const hard = on => { ctx.shadowColor = on ? T.shadow : 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = ctx.shadowOffsetY = on ? T.off * dpr * .75 : 0; }; // hard offset shadow (px, ignores CTM)
const conf = () => [T.accent, T.danger, T.beam, T.ink][Math.random() * 4 | 0];
function ink(col) {
  ctx.lineCap = ctx.lineJoin = 'round';
  hard(true); ctx.strokeStyle = T.line; ctx.lineWidth = 7; ctx.stroke(); hard(false);
  ctx.strokeStyle = col || T.ink; ctx.lineWidth = 3.8; ctx.stroke(); ctx.beginPath();
}
function cape(len, w, amp, t, col, edge) { // procedural flutter, trails toward -x
  const a = Math.sin(t * 6) * amp, b = Math.sin(t * 6 + 1.7) * amp, c = Math.sin(t * 6 + 3.1) * amp;
  ctx.beginPath(); ctx.moveTo(0, -w);
  ctx.quadraticCurveTo(-len * .5, -w * 1.6 + a, -len, -w * 1.3 + b);
  ctx.quadraticCurveTo(-len * 1.12 + c * .4, c, -len + b * .3, w * 1.3 + a);
  ctx.quadraticCurveTo(-len * .5, w * 1.6 + c, 0, w);
  ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.stroke();
}

/* ---------- spring rig: joints blend between poses with overshoot ---------- */
// order: Head, Neck, Pelvis, ElbowL, HandL, ElbowR, HandR, KneeL, FootL, KneeR, FootR
const jp = new Float32Array(22), jv = new Float32Array(22); let rigInit = false;
function pose(s, t, f) {
  const b = Math.sin(t * 2.2), sw = Math.sin(t * 1.7) * 3;
  if (s === 'kinetic') { const w = Math.sin(t * 16) * 2; return [-4,-15, 0,-8, 2,14, 2,-22,0,-34, 6,-20,6,-32, 4,26+w,1,37+w, 8,25-w,7,36-w]; }
  if (s === 'swing') { const l = Math.sin(t * 9) * 2; return [0,-20, 0,-9, 2,13, -6,-4,-10,3, 3,-20,5,-35, 6,24+l,10,33, -2,25-l,-6,35]; }
  if (s === 'transit') return [4,-10, 0,-5, -3,5, 8,0,6,7, 8,-1,5,6, 7,6,2,12, 8,8,4,13];
  if (s === 'goku') {
    if (f.holding) return [2,-21, 0,-9, -3,13, 10,-6,21,-4, 10,-3,21,-2, -16,25,-20,37, 11,25,15,36];
    const p = Math.sin(t * 10);
    return [0,-21+p*.8, 0,-9, 0,13, -13,-5,-17,-16+p, 13,-5,17,-16+p, -14,25,-18,37, 14,25,18,37];
  }
  if (s === 'fight') {
    if (f.vic) { const j = Math.abs(Math.sin(t * 9)) * 6; return [0,-21-j, 0,-9-j, 0,13-j, -9,-16-j,-12,-27-j, 9,-16-j,12,-27-j, -10,24,-14,34, 10,24,14,34]; }
    const A = f.A, B = f.B, n = Math.sin(t * 10) * 1.5, tw = 2 * (A - B);
    return [tw+2,-21+n, tw+1,-9+n, -1,13+n*.5, 6+9*A,-3+(1-A)*3+n,10+18*A,-9+n, 5+9*B,-2+(1-B)*3+n,9+18*B,-8+n, 8,24,13,34, -9,24,-14,34];
  }
  return [0,-20+b, 0,-9+b*.5, 0,13, 8,-2,-6,-5, -8,-2,6,-5, -3+sw*.3,23,-4+sw,33, 3+sw*.3,23,4+sw,32]; // idle: arms crossed
}
function rig(skin) {
  const j = jp;
  ctx.beginPath(); ctx.arc(j[0], j[1], 7.5, 0, TAU); ctx.fillStyle = skin; ctx.fill();
  ctx.beginPath(); circ(j[0], j[1], 7.5);
  pl([j[0], j[1] + 7.5], [j[2], j[3]], [j[4], j[5]]);
  pl([j[2], j[3]], [j[6], j[7]], [j[8], j[9]]); pl([j[2], j[3]], [j[10], j[11]], [j[12], j[13]]);
  pl([j[4], j[5]], [j[14], j[15]], [j[16], j[17]]); pl([j[4], j[5]], [j[18], j[19]], [j[20], j[21]]);
  ink();
}
function eyes(col, t, angry) {
  const x = jp[0] + Math.max(-1.5, Math.min(1.5, m.vx * .003)), y = jp[1] + 1, blink = (t % 3.4) > 3.3;
  ctx.save(); glow(col, 8); ctx.fillStyle = ctx.strokeStyle = col; ctx.lineWidth = 1.4;
  for (const s of [-1, 1]) {
    if (blink) { ctx.beginPath(); ctx.moveTo(x + s * 3 - 1.6, y); ctx.lineTo(x + s * 3 + 1.6, y); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(x + s * 3, y, 1.7, 0, TAU); ctx.fill(); }
    if (angry) { ctx.beginPath(); ctx.moveTo(x + s * 5.6, y - 4.2 + (s > 0 ? 0 : 0)); ctx.lineTo(x + s * 1.2, y - 2.2); ctx.stroke(); }
  }
  ctx.restore();
}

/* ---------- per-state decorations ---------- */
function aura(t) { // flat spiked aura with outline + hard shadow
  ctx.beginPath();
  for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + i / 16 * TAU, r = i % 2 ? 40 : 66 + Math.sin(t * 13 + i * 2) * 9; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.globalAlpha = .6; ctx.fillStyle = T.accent; hard(true); ctx.fill(); hard(false); ctx.globalAlpha = 1;
  ctx.strokeStyle = T.line; ctx.lineWidth = 4; ctx.lineJoin = 'miter'; ctx.stroke();
}
function hair(t) {
  const x = jp[0], y = jp[1] - 20 + 21, k = Math.sin(t * 12) * 1.5; // spikes sway
  ctx.beginPath(); pl([x-8,y-21],[x-12,y-32+k],[x-4,y-27],[x-3,y-38-k],[x+2,y-28],[x+6,y-37+k],[x+8,y-27],[x+14,y-32-k],[x+8,y-19]); ctx.closePath();
  ctx.fillStyle = T.accent; ctx.fill(); ctx.strokeStyle = T.line; ctx.lineWidth = 3; ctx.lineJoin = 'miter'; ctx.stroke();
}
function beam(t, len, k) { // flat layers: outline, beam, core
  const w = (11 + Math.sin(t * 50) * 2) * k;
  ctx.save(); ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(22, -3); ctx.lineTo(22 + len * k, -3);
  hard(true); ctx.strokeStyle = T.line; ctx.lineWidth = w + 7; ctx.stroke(); hard(false);
  ctx.strokeStyle = T.beam; ctx.lineWidth = w; ctx.stroke(); ctx.strokeStyle = T.ink; ctx.lineWidth = w * .35; ctx.stroke();
  ctx.beginPath(); ctx.arc(22, -3, (10 + Math.sin(t * 30) * 3) * k, 0, TAU); ctx.fillStyle = T.ink; hard(true); ctx.fill(); hard(false);
  ctx.strokeStyle = T.line; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
}
function laserEyes(t) { // idle flex: every few seconds the eyes flare and fire
  const ph = (t % 5) - 4.2; if (ph < 0 || ph > .7) return;
  const f = Math.sin(ph / .7 * Math.PI), L = 150 * f;
  ctx.save(); ctx.lineCap = 'round'; glow('#ff2a2a', 14);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(jp[0] + s * 3, jp[1] + 1); ctx.lineTo(jp[0] + s * 3 + L, jp[1] + 1 + L * .25); ctx.strokeStyle = T.danger; ctx.lineWidth = 3.2 * f; ctx.stroke(); }
  ctx.restore();
}

/* ---------- bubbles: thought clouds for calm lines, anime shout-bursts for power moves ---------- */
const SHOUTS = new Set(['goku', 'fight', 'kinetic', 'swing']);
function drawBubble(x, y, now, t, holding, vic) {
  const shout = SHOUTS.has(state), k = Math.min(1, (now - bubbleAt) / 200), hot = state === 'goku' || vic;
  const e = 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);
  const pw = textW + (shout ? 34 : 18), ph = shout ? 30 : 20;
  const cx = Math.min(Math.max(x, pw / 2 + 6), W - pw / 2 - 6);
  let cy = y - ph / 2 - (shout ? 0 : 10); const above = cy - ph / 2 >= 4;
  if (!above) cy = 2 * m.y - cy;
  ctx.save(); ctx.globalAlpha = k; ctx.translate(x, y); ctx.scale(.6 + .4 * e, .6 + .4 * e); ctx.translate(-x, -y);
  if (shout) { // anime shout burst
    const sh = holding ? 1 : .4;
    ctx.translate(cx + rnd(-sh, sh), cy + rnd(-sh, sh)); ctx.rotate(-.05); ctx.beginPath();
    for (let i = 0; i < 28; i++) {
      const a = i * Math.PI / 14, r = (i % 2 ? .8 : 1.1) + Math.sin(t * 38 + i * 5) * .04, px = Math.cos(a) * pw / 2 * r, py = Math.sin(a) * ph / 2 * r * 1.1;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fillStyle = hot ? T.accent : T.bg; hard(true); ctx.fill(); hard(false);
    ctx.strokeStyle = T.line; ctx.lineWidth = T.stroke; ctx.lineJoin = 'miter'; ctx.stroke();
    ctx.font = FONT_S; ctx.fillStyle = hot ? T.onAccent : T.bgInk;
  } else { // thought cloud
    const r = ph * .46, c = [], n = Math.max(8, Math.round(pw / 9));
    for (let i = 0; i < n; i++) { const a = i / n * TAU; c.push([cx + Math.cos(a) * (pw / 2 - r * .3), cy + Math.sin(a) * (ph / 2 - r * .25), r]); }
    const bot = above ? cy + ph / 2 : cy - ph / 2, sg = above ? 1 : -1;
    [[4, 3.2], [11, 2.3], [17, 1.5]].forEach(([d, rr], i) => c.push([cx + (m.x - cx) * (i + 1) / 3, bot + sg * d, rr]));
    ctx.beginPath(); for (const [px, py, rr] of c) { ctx.moveTo(px + rr, py); ctx.arc(px, py, rr, 0, TAU); }
    ctx.strokeStyle = T.line; ctx.lineWidth = T.stroke * 2; hard(true); ctx.stroke(); hard(false); // outline pass, then fill pass = clean edge
    ctx.fillStyle = T.bg; ctx.fill(); ctx.beginPath(); ctx.ellipse(cx, cy, pw / 2 - 2, ph / 2 - 2, 0, 0, TAU); ctx.fill();
    ctx.translate(cx, cy); ctx.font = FONT_T; ctx.fillStyle = T.bgInk;
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 1); ctx.restore();
}
// manga sound effects drifting off the character
const SFX = { idle: ['ゴ ゴ ゴ', 'danger', 10, .02], goku: ['ゴゴゴゴ', 'accent', 12, .09], kinetic: ['ビュン', 'beam', 12, .12], swing: ['シュッ', 'ink', 11, .1], transit: ['ザッ', 'shadow', 12, .18], fight: ['ドドド', 'accent', 11, .07] };
function sfx(dt, beamOn) {
  const s = beamOn ? ['ズドォォン!', 'beam', 15, .25] : SFX[state];
  if (s && Math.random() < s[3] * 20 * dt) emit(m.x + rnd(-20, 20), m.y - rnd(4, 26), rnd(-12, 12), -rnd(15, 35), .9, s[2], T[s[1]], 2, s[0]);
}

/* ---------- spider-web swing line ---------- */
function drawWeb(t) {
  const c = Math.cos(rot), s = Math.sin(rot), hx = jp[12], hy = jp[13], wx = m.x + (hx * c - hy * s) * S, wy = m.y + (hx * s + hy * c) * S;
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = T.ink; ctx.lineWidth = 2; glow('#bfe3ff', 4);
  ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo((wx + anc.x) / 2 + Math.sin(t * 20) * 1.5, (wy + anc.y) / 2, anc.x, anc.y); ctx.stroke();
  ctx.shadowBlur = 0; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + .3; ctx.moveTo(anc.x, anc.y); ctx.lineTo(anc.x + Math.cos(a) * 5, anc.y + Math.sin(a) * 5); }
  ctx.stroke(); ctx.restore();
}

/* ---------- boss: the button becomes a stickman; beating it fills the loading bar ---------- */
function drawEnemy(t, now, dir, vic) {
  const k0 = Math.min(1, (now - fightAt) / 320), k = 1 + 2.70158 * Math.pow(k0 - 1, 3) + 1.70158 * Math.pow(k0 - 1, 2);
  const w = 1 - hp / 100, drop = w * 8, sway = Math.sin(t * 7) * (1 + w * 3) * .5, ex = m.x + dir * (40 + eShake * 5), ey = m.y + 4 + eFall * 10;
  ctx.save(); ctx.translate(ex, ey); ctx.scale(-dir * S * 1.05 * k, S * 1.05 * k);
  ctx.rotate(eFall * 1.5 - eShake * .25 + Math.sin(t * 9) * .03 * (1 - eFall));
  ctx.beginPath(); ctx.arc(sway, -20, 7.5, 0, TAU); ctx.fillStyle = T.skin; ctx.fill();
  ctx.beginPath(); circ(sway, -20, 7.5);
  pl([sway - 5, -26], [sway - 9, -34]); pl([sway + 5, -26], [sway + 9, -34]); // horns
  pl([0, -12], [0, 14]); pl([0, -8], [9, -3 + drop * .3], [9, -14 + drop]); pl([0, -8], [4, -1], [-3, -9 + drop * .5]);
  pl([0, 14], [8, 24], [11, 34]); pl([0, 14], [-7, 24], [-11, 34]); ink(T.danger);
  ctx.strokeStyle = ctx.fillStyle = T.accent; ctx.lineWidth = 1.5;
  for (const sd of [-3, 3]) {
    const x = sway + sd; ctx.beginPath();
    if (vic) { ctx.moveTo(x - 1.5, -22); ctx.lineTo(x + 1.5, -19); ctx.moveTo(x + 1.5, -22); ctx.lineTo(x - 1.5, -19); ctx.stroke(); }
    else { ctx.arc(x, -20, 1.6, 0, TAU); ctx.fill(); }
  }
  if (w > .7 && !vic) for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; ctx.beginPath(); ctx.arc(Math.cos(a) * 9, -33 + Math.sin(a) * 3, 1.6, 0, TAU); ctx.fill(); } // dizzy
  ctx.restore();
  ctx.globalAlpha = 1 - eFall * .6; ctx.fillStyle = T.line; ctx.fillRect(ex - 23, m.y - 28, 46, 6);
  ctx.fillStyle = hp < 30 ? T.accent : T.danger; ctx.fillRect(ex - 22, m.y - 27, 44 * Math.max(0, hp / 100), 4); ctx.globalAlpha = 1;
}

/* ---------- state machine ---------- */
function resolve(now) {
  if (m.ctx === 'goku' || m.ctx === 'fight') return m.ctx;
  if (m.ctx === 'wall' || now < transitUntil) return 'transit';
  if (m.speed > CFG.kineticOn || (state === 'kinetic' && m.speed > CFG.kineticOn * .55)) return 'kinetic';
  if (m.speed > CFG.swingOn || ((state === 'swing' || state === 'kinetic') && m.speed > CFG.idleBelow)) return 'swing';
  return 'idle';
}
const OFF = { idle: 34, swing: 34, kinetic: 34, transit: 26, goku: 54, fight: 38 };
function line(s, holding) {
  if (s === 'goku') return holding ? 'KAMEHAMEHA! 🌊' : 'GOING BEYOND! ⚡';
  if (s === 'fight') return victoryUntil ? 'VICTORY! 🏆' : 'ORA ORA ORA! 👊';
  return { idle: 'I can do whatever I want. 👑', swing: 'Thwip! 🕸️', kinetic: 'Up and away! 🚀', transit: 'Parkour! 🤸‍♂️' }[s];
}

/* ---------- loop ---------- */
let last = performance.now(), t = 0, drawn = false, rot = 0, omega = 0, pop = 1, popV = 0, em = 0, hitA = false, hitB = false, wasVic = false, fightAt = 0, eShake = 0, eFall = 0;
const anc = { x: 0, y: 0 };
readTokens();
new MutationObserver(readTokens).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
matchMedia('(prefers-color-scheme: light)').addEventListener('change', readTokens);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(readTokens);
document.documentElement.classList.add('sm-on');
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now; if (dt <= 0) return;
  t += dt; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!m.vis) { if (drawn) { ctx.clearRect(0, 0, W, H); P.length = 0; drawn = false; } return; }

  const k = 1 - Math.exp(-CFG.follow * dt), kv = 1 - Math.exp(-14 * dt);
  m.x += (m.tx - m.x) * k; m.y += (m.ty - m.y) * k;
  m.vx += ((m.tx - m.px) / dt - m.vx) * kv; m.vy += ((m.ty - m.py) / dt - m.vy) * kv;
  m.px = m.tx; m.py = m.ty; m.speed = Math.hypot(m.vx, m.vy);
  if (m.speed > 60) m.ang += wrap(Math.atan2(m.vy, m.vx) - m.ang) * (1 - Math.exp(-18 * dt));

  const prev = state; state = resolve(now); updateFight(dt, now);
  if (state !== prev) { pop = 1.4; popV = 0; if (state === 'fight') fightAt = now; if (state === 'transit') omega = (m.vx < 0 ? -1 : 1) * 16; }
  const holding = m.down && m.downCtx === state, dir = m.x < W / 2 ? 1 : -1, vic = !!victoryUntil;
  const nt = line(state, holding);
  if (nt !== text) { text = nt; bubbleAt = now; ctx.font = SHOUTS.has(state) ? FONT_S : FONT_T; textW = ctx.measureText(text).width; }
  popV += ((1 - pop) * 240 - popV * 14) * dt; pop += popV * dt;
  eShake = Math.max(0, eShake - dt * 5); eFall += ((vic ? 1 : 0) - eFall) * (1 - Math.exp(-8 * dt));
  { const ax = m.x + m.vx * .18, ay = m.y - 130; // web anchor
    if (state === 'swing' && prev !== 'swing') { anc.x = ax; anc.y = ay; } else { const q = 1 - Math.exp(-6 * dt); anc.x += (ax - anc.x) * q; anc.y += (ay - anc.y) * q; } }

  // rotation: lean while idle, point along travel while flying, spin while tumbling
  if (state === 'transit') { omega += ((m.vx < 0 ? -1 : 1) * 13 - omega) * dt * 3; rot += omega * dt; }
  else {
    const tg = state === 'kinetic' ? m.ang + Math.PI / 2 : state === 'swing' ? Math.max(-.6, Math.min(.6, m.vx * .0009)) : state === 'idle' ? Math.max(-.3, Math.min(.3, m.vx * .0005)) + Math.sin(t * 1.3) * .05 : (state === 'goku' && holding ? -.08 : 0);
    rot += wrap(tg - rot) * (1 - Math.exp(-(state === 'kinetic' ? 20 : 12) * dt));
  }

  // joints
  const ph = Math.sin(t * (holding ? 26 : 15)), A = state === 'fight' ? Math.max(0, ph) : 0, B = state === 'fight' ? Math.max(0, -ph) : 0;
  const tg = pose(state, t, { holding, A, B, vic }), K = state === 'kinetic' ? 380 : 260;
  for (let i = 0; i < 22; i++) { if (!rigInit) jp[i] = tg[i]; jv[i] += ((tg[i] - jp[i]) * K - jv[i] * 17) * dt; jp[i] += jv[i] * dt; }
  rigInit = true;

  // particles
  const sx = m.x, sy = m.y; em += dt;
  while (em > .05) {
    em -= .05;
    if (state === 'idle') emit(sx + rnd(-8, 8), sy + 8, rnd(-8, 8), -rnd(25, 55), .9, 1.6, T.danger);
    else if (state === 'transit') emit(sx + rnd(-8, 8), sy + 10, rnd(-35, 35), -rnd(5, 30), .5, 3, T.shadow);
    else if (state === 'goku') for (let i = 0; i < 2; i++) emit(sx + rnd(-20, 20), sy + rnd(8, 24), rnd(-20, 20), -rnd(70, 150), .6, 3, T.accent, 1);
    else if (state === 'fight' && vic) for (let i = 0; i < 3; i++) emit(sx + rnd(-10, 10), sy - 20, rnd(-90, 90), -rnd(120, 220), 1.2, 3, conf(), 3);
  }
  if (state === 'kinetic') for (let i = 0; i < 2; i++) emit(sx - Math.cos(m.ang) * 14 + rnd(-3, 3), sy - Math.sin(m.ang) * 14 + rnd(-3, 3), -m.vx * .08 + rnd(-15, 15), -m.vy * .08 + rnd(-15, 15), .45, 2, T.beam, 1);
  if (state === 'fight' && !vic) {
    for (const [v, hit, y] of [[A, hitA, -9], [B, hitB, -8]]) {
      if (v > .96 && !hit) {
        eShake = 1; const wx = sx + dir * 32, wy = sy + y * S;
        emit(wx + dir * 12, wy - 8, dir * rnd(30, 80), -rnd(30, 70), .65, rnd(14, 19), T.accent, 2, Math.random() < .5 ? 'ORA!' : 'ORA ORA!');
        for (let i = 0; i < 6; i++) emit(wx, wy, dir * rnd(20, 140), rnd(-90, 90), .3, 2, T.ink, 1);
      }
    }
    if (A > .96) hitA = true; else if (A < .5) hitA = false;
    if (B > .96) hitB = true; else if (B < .5) hitB = false;
  }
  if (vic && !wasVic) for (let i = 0; i < 36; i++) emit(sx, sy - 10, rnd(-160, 160), -rnd(80, 260), 1.4, 3.2, conf(), 3);
  wasVic = vic;
  const beamOn = state === 'goku' && holding, bk = Math.min(1, (now - m.downAt) / 110), bl = (dir > 0 ? W - m.x : m.x) + 80;
  if (beamOn) {
    const x0 = sx + dir * 22 * S;
    for (let i = 0; i < 3; i++) emit(x0 + dir * rnd(0, bl * bk), sy - 3 * S + rnd(-6, 6), dir * rnd(100, 300), rnd(-40, 40), .3, 2, T.beam, 1);
    emit(dir > 0 ? W - 4 : 4, sy - 3 * S, -dir * rnd(40, 220), rnd(-200, 200), .35, 2.5, T.ink, 1);
  }
  sfx(dt, beamOn); stepP(dt);

  // draw
  ctx.clearRect(0, 0, W, H); drawn = true;
  ctx.save();
  ctx.translate(m.x + (beamOn ? rnd(-1.2, 1.2) : 0), m.y + (beamOn ? rnd(-1.2, 1.2) : 0));
  ctx.scale(S * (2 - pop), S * pop); ctx.rotate(rot);
  if (state === 'goku' || state === 'fight') ctx.scale(dir, 1);
  if (state === 'goku') aura(t);
  if (state === 'idle' || state === 'kinetic') { ctx.save(); ctx.translate(jp[2], jp[3]); ctx.rotate(-Math.PI / 2); cape(state === 'idle' ? 34 : 38, 9, state === 'idle' ? 5 : 8, t, T.danger, T.line); ctx.restore(); }
  if (state === 'kinetic') {
    ctx.strokeStyle = T.shadow; ctx.lineWidth = 2; ctx.beginPath();
    const L = Math.min(34, m.speed / 40); for (const x of [-10, -3, 5, 12]) { ctx.moveTo(x, 42); ctx.lineTo(x, 42 + L + Math.abs(x)); } ctx.stroke();
  }
  if (state === 'transit') { ctx.strokeStyle = T.shadow; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 1.8); ctx.stroke(); }
  if (state === 'fight' && !vic) { // afterimage fists
    ctx.fillStyle = T.shadow;
    for (const [v, hy] of [[A, -9], [B, -8]]) if (v > .3) for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(10 + 18 * v - i * 7 * v, hy, 4, 0, TAU); ctx.fill(); }
  }
  rig(state === 'swing' ? T.danger : T.skin);
  if (state === 'idle') { eyes(T.danger, t); laserEyes(t); }
  else if (state === 'goku') { hair(t); eyes(T.beam, t, true); }
  else if (state === 'fight') { ctx.save(); ctx.translate(jp[0] - 6, jp[1] - 3); cape(14, 2.2, 3, t, T.accent, T.line); ctx.restore(); eyes(T.ink, t, !vic); }
  else eyes(T.ink, t, state === 'kinetic' || state === 'swing');
  if (state === 'fight' && !vic) { ctx.fillStyle = T.ink; ctx.beginPath(); circ(jp[8], jp[9], 3.4); circ(jp[12], jp[13], 3.4); ctx.fill(); }
  if (beamOn) beam(t, bl / S, bk);
  ctx.restore();
  if (state === 'swing') drawWeb(t);
  if (state === 'fight') drawEnemy(t, now, dir, vic);
  drawP();
  drawBubble(m.x, m.y - OFF[state], now, t, holding, vic);
  ctx.beginPath(); ctx.arc(m.tx, m.ty, 2.5, 0, TAU); // true hotspot
  ctx.strokeStyle = T.line; ctx.lineWidth = 3.2; ctx.stroke(); ctx.strokeStyle = T.ink; ctx.lineWidth = 1.4; ctx.stroke();
}
requestAnimationFrame(frame);
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
