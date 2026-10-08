'use strict';
/* ==========================================================
   util.js  -  math helpers, constants, input handling
   ========================================================== */
const TAU = Math.PI * 2;
const W = 960, H = 600, WALL = 48;
const ARENA = { x1: WALL, y1: WALL, x2: W - WALL, y2: H - WALL };
const DOOR_HALF = 44;

function rand(a, b) { return a + Math.random() * (b - a); }
function randi(a, b) { return Math.floor(rand(a, b + 1)); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angTo(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function chance(p) { return Math.random() < p; }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
}
function fmtTime(s) {
  s = Math.floor(s);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/* Push circle `e` {x,y,r} out of rectangle `r` {x,y,w,h}. Returns true on contact. */
function circleRectPush(e, r) {
  const cx = clamp(e.x, r.x, r.x + r.w), cy = clamp(e.y, r.y, r.y + r.h);
  const dx = e.x - cx, dy = e.y - cy, d2 = dx * dx + dy * dy;
  if (d2 >= e.r * e.r) return false;
  if (d2 < 0.0001) {
    const l = e.x - r.x, rr = r.x + r.w - e.x, t = e.y - r.y, b = r.y + r.h - e.y;
    const m = Math.min(l, rr, t, b);
    if (m === l) e.x = r.x - e.r; else if (m === rr) e.x = r.x + r.w + e.r;
    else if (m === t) e.y = r.y - e.r; else e.y = r.y + r.h + e.r;
    return true;
  }
  const d = Math.sqrt(d2), p = e.r - d;
  e.x += dx / d * p; e.y += dy / d * p;
  return true;
}
function pointInRect(x, y, r, pad) {
  pad = pad || 0;
  return x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
}

/* ---------------- Input ---------------- */
const Input = {
  keys: {}, pressed: {}, wheel: 0,
  mouse: { x: W / 2, y: H / 2, down: false, pressed: false },
  down(c) { return !!this.keys[c]; },
  init(canvas) {
    addEventListener('keydown', e => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed[e.code] = true;
      this.keys[e.code] = true;
      Sound.init(); Sound.resume();
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    const upd = e => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * W / r.width;
      this.mouse.y = (e.clientY - r.top) * H / r.height;
    };
    canvas.addEventListener('mousemove', upd);
    canvas.addEventListener('mousedown', e => {
      upd(e);
      if (e.button === 0) { this.mouse.down = true; this.mouse.pressed = true; }
      Sound.init(); Sound.resume();
    });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouse.down = false; });
    canvas.addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('blur', () => { this.keys = {}; this.mouse.down = false; });
  },
  endFrame() { this.pressed = {}; this.mouse.pressed = false; this.wheel = 0; }
};
