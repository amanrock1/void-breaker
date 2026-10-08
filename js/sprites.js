'use strict';
/* ==========================================================
   sprites.js  -  hand-built pixel-art characters.
   A tiny pixel painter (Px) draws every character once at start-up
   into cached canvases: shaded body parts, auto outline, eyes that
   track the player. No image files needed.
   ========================================================== */
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
/* 4-tone ramp: darkest -> lightest */
function ramp(hex) { return [mixHex(hex, '#000000', 0.6), mixHex(hex, '#000000', 0.32), hex, mixHex(hex, '#ffffff', 0.38)]; }

class Px {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); this.sym = false; this.eyes = []; }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (this.in(x, y)) this.d[y * this.w + x] = c;
    if (this.sym) { const mx = this.w - 1 - x; if (this.in(mx, y)) this.d[y * this.w + mx] = c; }
  }
  get(x, y) { return this.in(x, y) ? this.d[y * this.w + x] : null; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  /* vertically lit block with darker side edges; `round` clips the corners */
  shadedRect(x, y, w, h, rp, round) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (round && ((i === 0 || i === w - 1) && (j === 0 || j === h - 1))) continue;
      const t = h > 1 ? j / (h - 1) : 0;
      let idx = t < 0.22 ? 3 : t < 0.6 ? 2 : t < 0.88 ? 1 : 0;
      if ((i === 0 || i === w - 1) && w > 3) idx = Math.max(0, idx - 1);
      this.set(x + i, y + j, rp[idx]);
    }
  }
  /* sphere-shaded ellipse lit from above; pass `flat` for a single colour */
  ellipse(cx, cy, rx, ry, rp, flat) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
      if (d > 1) continue;
      if (flat) { this.set(x, y, flat); continue; }
      const z = Math.sqrt(1 - d), lum = -ny * 0.62 + z * 0.8, t = (lum + 0.62) / 1.42;
      this.set(x, y, rp[Math.max(0, Math.min(rp.length - 1, Math.floor(t * rp.length)))]);
    }
  }
  line(x0, y0, x1, y1, c, th) {
    th = th || 1; x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      for (let a = 0; a < th; a++) for (let b = 0; b < th; b++) this.set(x0 + a, y0 + b, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
  /* scanline polygon fill, lit from the top */
  poly(pts, rp, flat) {
    let minY = 1e9, maxY = -1e9;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
      const yy = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) xs.push(a[0] + (yy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) {
          const t = (yy - minY) / Math.max(1, maxY - minY);
          this.set(x, y, flat || rp[t < 0.28 ? 3 : t < 0.62 ? 2 : t < 0.86 ? 1 : 0]);
        }
      }
    }
  }
  /* recolour already-painted pixels where fn(x,y,colour) returns a new colour */
  paint(fn) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.d[y * this.w + x]; if (!c) continue;
      const n = fn(x, y, c); if (n) this.d[y * this.w + x] = n;
    }
  }
  eye(x, y) { // 3x3 eye socket; pupil is drawn at run-time so it follows the player
    const w = this.sym; this.sym = false;
    const put = (px, py, c) => { this.set(px, py, c); if (w) this.set(this.w - 1 - px, py, c); };
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) put(x + i, y + j, j === 2 ? '#d4d6ea' : '#ffffff');
    this.eyes.push({ x: x + 1, y: y + 1, s: 1 });
    if (w) this.eyes.push({ x: this.w - 1 - (x + 1), y: y + 1, s: 1 });
    this.sym = w;
  }
  bigEye(cx, cy, rx, ry, ps, tone) {
    this.ellipse(cx, cy, rx, ry, null, tone || '#ffffff');
    this.ellipse(cx, cy + ry * 0.25, rx * 0.8, ry * 0.6, null, mixHex(tone || '#ffffff', '#8890b8', 0.35));
    this.ellipse(cx, cy - ry * 0.1, rx * 0.85, ry * 0.75, null, tone || '#ffffff');
    this.eyes.push({ x: Math.round(cx - ps / 2), y: Math.round(cy - ps / 2), s: ps });
  }
  outline(c) {
    const src = this.d.slice();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (src[y * this.w + x]) continue;
      if ((x > 0 && src[y * this.w + x - 1]) || (x < this.w - 1 && src[y * this.w + x + 1]) || (y > 0 && src[(y - 1) * this.w + x]) || (y < this.h - 1 && src[(y + 1) * this.w + x]))
        this.d[y * this.w + x] = c;
    }
  }
  toCanvas() {
    const cv = document.createElement('canvas'); cv.width = this.w; cv.height = this.h;
    const g = cv.getContext('2d');
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.d[y * this.w + x]; if (!c) continue;
      g.fillStyle = c; g.fillRect(x, y, 1, 1);
    }
    return cv;
  }
}

const Sprites = {
  list: {}, ready: false,

  /* register: name -> { px, anchor } */
  def(name, px, anchor) {
    const img = px.toCanvas(), white = document.createElement('canvas');
    white.width = img.width; white.height = img.height;
    const g = white.getContext('2d'); g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, white.width, white.height);
    this.list[name] = { img, white, w: px.w, h: px.h, eyes: px.eyes, anchor: anchor === undefined ? 0.5 : anchor };
  },

  /* o: scale, flip(+1/-1), flash, alpha, bob, sx, sy, rot, look{x,y} (direction to look at) */
  draw(g, name, x, y, o) {
    const s = this.list[name]; if (!s) return;
    o = o || {};
    const sc = o.scale || 2, flip = o.flip || 1;
    g.save();
    g.translate(Math.round(x), Math.round(y + (o.bob || 0)));
    if (o.rot) g.rotate(o.rot);
    g.scale(flip * sc * (o.sx || 1), sc * (o.sy || 1));
    g.imageSmoothingEnabled = false;
    if (o.alpha !== undefined) g.globalAlpha = o.alpha;
    const ox = -s.w / 2, oy = -s.h * s.anchor;
    if (o.flash === true) g.drawImage(s.white, ox, oy);
    else {
      g.drawImage(s.img, ox, oy);
      if (o.flash) { const a = g.globalAlpha; g.globalAlpha = a * o.flash; g.drawImage(s.white, ox, oy); g.globalAlpha = a; }
    }
    if (o.flash !== true && o.look && s.eyes.length) {
      const lx = clamp(Math.round(o.look.x * flip / 28), -1, 1), ly = clamp(Math.round(o.look.y / 28), -1, 1);
      g.fillStyle = o.pupil || '#1a0814';
      for (const e of s.eyes) {
        const m = e.s > 1 ? 1 : 1; // pupil travel
        g.fillRect(ox + e.x + lx * m, oy + e.y + ly * m, e.s, e.s);
      }
    }
    g.restore();
  },

  /* gun drawn around its grip (3px from the back), mirrored when aiming left */
  drawGun(g, name, x, y, aim) {
    const s = this.list[name]; if (!s) return;
    g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(aim);
    if (Math.cos(aim) < 0) g.scale(1, -1);
    g.scale(2, 2); g.imageSmoothingEnabled = false;
    g.drawImage(s.img, -3, -s.h / 2);
    g.restore();
  },

  init() {
    if (this.ready) return; this.ready = true;
    const OUT = '#050b18';

    /* ---------------- PLAYER: yellow submarine (faces right) ---------------- */
    {
      const P = new Px(32, 20);
      const hull = ramp('#ffd23f'), dk = ramp('#c98a12'), steel = ramp('#8a97ab'), glass = ramp('#7df9ff');
      P.poly([[3, 3], [10, 8], [3, 10]], dk);                  // rear top fin
      P.poly([[3, 12], [10, 12], [3, 18]], dk);                // rear bottom fin
      P.shadedRect(0, 7, 3, 7, steel, true);                   // propeller hub
      P.rect(0, 5, 1, 2, steel[3]); P.rect(0, 14, 1, 2, steel[3]);
      P.ellipse(17, 11.5, 13.5, 6.2, hull);                    // hull
      P.paint((x, y) => (y === 13 || y === 14) && x > 4 && x < 29 ? dk[2] : null); // stripe
      P.shadedRect(12, 3, 9, 5, hull, true);                   // conning tower
      P.rect(16, 0, 1, 3, steel[2]); P.rect(17, 0, 4, 1, steel[2]); P.set(20, 1, '#ff5d6c');   // periscope
      for (const x of [11, 17, 23]) {                          // portholes
        P.ellipse(x, 11, 2.4, 2.4, null, '#243b5a');
        P.ellipse(x, 11, 1.7, 1.7, null, glass[2]); P.set(x - 1, 10, '#ffffff');
      }
      P.ellipse(29.5, 11.5, 2.4, 3, glass);                    // nose window
      P.set(28, 10, '#ffffff');
      P.outline(OUT); this.def('player', P, 0.5);
    }

    /* guns: deck cannons mounted on top of the sub (drawn rotated around the grip) */
    {
      const metal = ramp('#7d8aa8'), dk = ramp('#3a4258');
      const gun = (name, len, h, col, extra) => {
        const P = new Px(len, h + 2);
        P.shadedRect(0, 1, len - 3, h, metal);
        P.shadedRect(len - 5, 1 + Math.floor(h / 4), 5, Math.max(2, h - 2), dk);
        P.rect(3, 1 + Math.floor(h / 2), len - 9, 1, col);
        if (extra) extra(P, len, h, col, metal, dk);
        P.outline(OUT);
        this.def(name, P, 0.5);
      };
      gun('gun_pistol', 12, 3, '#7df9ff', (P) => { P.shadedRect(1, 3, 3, 3, dk); });
      gun('gun_smg', 15, 3, '#a5ff7d', (P) => { P.shadedRect(5, 3, 3, 5, dk); P.shadedRect(1, 3, 3, 3, dk); });
      gun('gun_shotgun', 19, 4, '#ffb347', (P, len) => { P.shadedRect(2, 4, 4, 3, dk); P.rect(len - 12, 1, 8, 1, '#caa77a'); });
      gun('gun_rail', 21, 4, '#fff27d', (P, len, h, col) => { P.rect(5, 0, len - 10, 1, col); P.rect(5, h + 1, len - 10, 1, col); P.shadedRect(2, 4, 3, 3, dk); });
      gun('gun_launcher', 19, 5, '#ff7a3d', (P, len) => { P.ellipse(len - 2, 3.5, 3, 3, ramp('#ff7a3d')); P.shadedRect(3, 5, 3, 3, dk); });
    }

    /* ---------------- ENEMIES ---------------- */
    { // GRUNT - piranha (faces right)
      const P = new Px(24, 18), r = ramp('#ff5d6c'), dk = ramp('#a01e36');
      P.poly([[0, 3], [7, 9], [0, 15]], dk);                   // tail
      P.poly([[9, 2], [15, 3], [17, 6]], dk);                  // dorsal fin
      P.poly([[11, 14], [15, 14], [12, 18]], dk);              // belly fin
      P.ellipse(14, 9.5, 9.5, 6.5, r);
      P.ellipse(14, 12.5, 7.5, 3, null, '#ffb0a8');            // belly
      P.line(13, 3, 19, 6, dk[0]);                             // angry brow
      P.rect(19, 10, 5, 3, '#2a0610');                         // mouth
      for (const x of [19, 21, 23]) P.set(x, 10, '#fff'); for (const x of [20, 22]) P.set(x, 12, '#fff');
      P.eye(15, 5);
      P.outline(OUT); this.def('grunt', P);
    }
    { // SWARMER - minnow
      const P = new Px(14, 9), r = ramp('#ffb347');
      P.poly([[0, 0], [5, 4], [0, 8]], ramp('#d9822b'));
      P.ellipse(9, 4.5, 5, 3.6, r);
      P.set(10, 3, '#fff'); P.set(11, 3, '#fff'); P.set(10, 4, '#fff'); P.set(11, 4, '#fff'); P.eyes.push({ x: 11, y: 4, s: 1 });
      P.outline(OUT); this.def('swarmer', P);
    }
    { // SHOOTER - squid
      const P = new Px(20, 24); P.sym = true; const r = ramp('#ff7bd5'), dk = ramp('#b83a9a');
      P.poly([[2, 9], [6, 4], [7, 12]], dk);                   // fins
      P.ellipse(10, 8.5, 5.2, 7.8, r);                         // mantle
      P.ellipse(10, 14, 6.2, 4.2, r);                          // head
      for (const [x, len] of [[5, 7], [7.5, 8], [9.5, 6]]) { P.line(x, 17, x - 1, 17 + len - 2, r[1], 1); P.set(x - 1, 17 + len - 1, r[3]); }
      P.eye(3, 12);
      P.set(9, 3, r[3]); P.set(9, 4, r[3]); P.set(10, 5, r[3]);
      P.outline(OUT); this.def('shooter', P);
    }
    { // DASHER - swordfish (faces right)
      const P = new Px(30, 14), r = ramp('#ffe14d'), bl = ramp('#4d8aff');
      P.poly([[0, 0], [7, 7], [0, 14]], bl);                   // tail
      P.poly([[10, 0], [17, 1], [17, 5]], bl);                 // dorsal
      P.ellipse(15, 7.5, 9.5, 5.2, r);
      P.ellipse(15, 10, 7.5, 2.4, null, '#fff3b0');
      P.rect(23, 7, 7, 1, '#d8ecff'); P.set(29, 7, '#ffffff');  // sword
      P.eye(17, 4);
      P.outline(OUT); this.def('dasher', P);
    }
    { // BOMBER - pufferfish
      const P = new Px(24, 24); P.sym = true; const r = ramp('#ff8a3d');
      P.poly([[1, 10], [5, 8], [5, 17], [1, 15]], ramp('#c9591a'));
      P.ellipse(12, 12.5, 8.4, 8.4, r);
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * TAU, x1 = 12 + Math.cos(a) * 8.2, y1 = 12.5 + Math.sin(a) * 8.2, x2 = 12 + Math.cos(a) * 11, y2 = 12.5 + Math.sin(a) * 11;
        P.line(x1, y1, x2, y2, '#ffe9b8', 1);
      }
      P.ellipse(12, 16.5, 5.2, 3, null, '#ffd9ae');
      P.eye(5, 8);
      P.rect(10, 15, 4, 2, '#3a1206');
      P.outline(OUT); this.def('bomber', P);
    }
    { // TANK - armoured crab
      const P = new Px(34, 26); P.sym = true; const r = ramp('#ff7a5c'), dk = ramp('#b3382a');
      for (let i = 0; i < 3; i++) { P.line(9 + i, 16 + i, 4 - i, 19 + i * 1, dk[1], 1); P.line(4 - i, 19 + i, 3 - i, 24, dk[0], 1); }
      P.ellipse(17, 15, 11.5, 7.5, r);                         // shell
      for (const [x, y] of [[11, 12], [14, 10], [20, 10], [22, 13], [17, 14]]) P.set(x, y, r[3]);
      P.line(7, 13, 5, 9, r[1], 3);                            // arm
      P.ellipse(5, 6.5, 4.6, 5, r);                            // claw
      P.rect(4, 0, 2, 4, null); P.ellipse(3, 10, 2.2, 1.6, dk);
      P.line(13, 8, 13, 5, dk[1], 1); P.eye(11, 2);            // eye stalks
      P.rect(14, 18, 6, 1, dk[0]);
      P.outline(OUT); this.def('tank', P);
    }
    { // TURRET - sea urchin (long spines are drawn rotating at run-time)
      const P = new Px(26, 26); P.sym = true; const pu = ramp('#c77dff'), dk = ramp('#5a2a8a');
      for (let i = 0; i < 22; i++) {
        const a = i / 22 * TAU;
        P.line(13 + Math.cos(a) * 6, 13 + Math.sin(a) * 6, 13 + Math.cos(a) * 11.5, 13 + Math.sin(a) * 11.5, dk[2], 1);
        P.set(13 + Math.cos(a) * 11.5, 13 + Math.sin(a) * 11.5, pu[3]);
      }
      P.ellipse(13, 13, 7, 7, dk);
      P.ellipse(13, 13, 4.6, 4.6, pu);
      P.bigEye(13, 13, 3, 3, 2, '#ffffff');
      P.outline(OUT); this.def('turret', P, 0.5);
      const B = new Px(14, 5); B.shadedRect(0, 1, 9, 3, dk); B.poly([[8, 0], [14, 2.5], [8, 5]], pu); B.outline(OUT);
      this.def('turret_barrel', B, 0.5);
    }
    { // SPAWNER - giant clam
      const P = new Px(30, 24); P.sym = true; const g1 = ramp('#6dff9e'), dk = ramp('#2a8a52');
      P.ellipse(15, 16, 13, 6.5, dk);
      P.ellipse(15, 13.5, 11, 4.4, null, '#14281c');
      P.sym = false; P.bigEye(15, 12.5, 4.4, 4, 3, '#fff4c2'); P.sym = true;
      P.ellipse(15, 7, 13, 6.5, g1);
      P.paint((x, y) => { if (y > 12) return null; const k = Math.floor(Math.atan2(x - 14.5, 13 - y) * 6); return (k % 2 === 0) ? dk[2] : null; });
      for (let i = 0; i < 6; i++) { P.set(7 + i * 3, 13, '#fff'); P.set(7 + i * 3, 14, '#fff'); }
      P.outline(OUT); this.def('spawner', P);
    }

    /* ---------------- BOSSES ---------------- */
    { // KING CRAB
      const P = new Px(52, 42); P.sym = true;
      const r = ramp('#e8553d'), dk = ramp('#8f2a1f'), bone = ramp('#f2e6cc');
      for (let i = 0; i < 4; i++) { P.line(14, 24 + i * 2, 7 - i, 28 + i * 3, dk[1], 2); P.line(7 - i, 28 + i * 3, 5 - i, 40, dk[0], 2); }
      P.ellipse(26, 25, 16.5, 11.5, r);                        // shell
      P.paint((x, y, c) => (y % 6 === 0 && y > 17 && y < 33 && Math.abs(x - 26) < 14) ? dk[2] : null);
      for (const [x, y] of [[18, 22], [22, 19], [30, 19], [34, 22], [26, 27], [20, 28], [32, 28]]) P.set(x, y, r[3]);
      for (let k = -2; k <= 2; k++) P.poly([[26 + k * 5 - 2, 15], [26 + k * 5, 9], [26 + k * 5 + 2, 15]], bone);
      P.line(12, 19, 8, 13, r[1], 4);                          // arm
      P.ellipse(7, 9, 6.6, 6.6, r); P.rect(5, 0, 3, 7, null); P.ellipse(3.6, 14.4, 3.2, 2.6, dk);
      P.line(19, 14, 19, 8, dk[1], 2); P.eye(18, 3);           // eye stalks
      P.rect(22, 31, 8, 2, dk[0]); P.set(23, 33, bone[3]); P.set(28, 33, bone[3]);
      P.outline(OUT); this.def('boss_warden', P, 0.5);
    }
    { // THE ANGLER - deep sea anglerfish
      const P = new Px(52, 46); P.sym = true;
      const b = ramp('#3a7fa8'), dk = ramp('#16405a');
      P.poly([[1, 26], [12, 16], [12, 34]], dk);               // side fins
      for (let k = 0; k < 5; k++) P.poly([[10 + k * 4, 14 - (k % 2) * 2], [13 + k * 4, 6 + k % 2 * 2], [15 + k * 4, 15]], dk);   // back spikes
      P.ellipse(26, 27, 19.5, 16.5, b);
      for (const [x, y] of [[14, 20], [18, 16], [12, 26], [22, 14], [16, 32]]) { P.set(x, y, b[3]); P.set(x + 1, y, b[3]); }
      P.ellipse(26, 32, 15.5, 8.5, null, '#1a0a14');           // mouth
      for (let i = 0; i < 9; i++) {
        const x = 12 + i * 3.4;
        P.poly([[x, 25], [x + 1.8, 25], [x + 0.9, 30]], null, '#f4f7ff');
        P.poly([[x, 39], [x + 1.8, 39], [x + 0.9, 34]], null, '#f4f7ff');
      }
      P.sym = false; P.bigEye(14, 19, 4.2, 4.2, 2, '#fff7c2'); P.bigEye(38, 19, 4.2, 4.2, 2, '#fff7c2');
      P.line(26, 12, 26, 5, dk[1], 2); P.line(26, 5, 31, 3, dk[1], 1);     // lure stalk
      P.ellipse(32, 3, 3.2, 3.2, ramp('#ffe14d')); P.set(31, 2, '#ffffff');
      P.sym = true;
      P.outline(OUT); this.def('boss_hive', P, 0.5);
    }
    { // THE KRAKEN - giant tentacled eye
      const P = new Px(60, 56); P.sym = true;
      const b = ramp('#9a5dff'), dk = ramp('#4a1f8a'), suck = ramp('#e0c4ff');
      const tent = pts => {
        for (let i = 0; i + 1 < pts.length; i++) { const t = Math.max(1, 4 - i); P.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], dk[2], t); }
        for (let i = 0; i + 1 < pts.length; i++) P.line(pts[i][0] + 1, pts[i][1], pts[i + 1][0] + 1, pts[i + 1][1], b[2], 1);
        for (const p of pts) P.set(p[0] - 1, p[1] + 1, suck[3]);
      };
      tent([[16, 26], [9, 34], [7, 44], [11, 51], [16, 52]]);
      tent([[20, 30], [15, 40], [15, 49], [21, 54]]);
      tent([[24, 32], [23, 42], [27, 50]]);
      tent([[10, 18], [3, 27], [2, 38], [5, 46]]);
      P.ellipse(30, 21, 18.5, 17, b);                          // head
      for (const [x, y] of [[16, 12], [20, 8], [14, 20], [22, 14], [12, 26]]) { P.set(x, y, b[3]); P.set(x + 1, y + 1, b[3]); }
      for (let k = 0; k < 4; k++) P.poly([[17 + k * 4, 8 - k], [19 + k * 4, 0 + (k === 3 ? 4 : 0)], [22 + k * 4, 7 - k]], dk);   // crown
      P.bigEye(30, 24, 10, 7.5, 5, '#fff6c8');
      P.ellipse(30, 24, 5.6, 5.2, null, '#7a2fe0');
      P.ellipse(30, 24, 2.4, 2.4, null, '#7a2fe0');
      P.outline(OUT); this.def('boss_core', P, 0.5);
      const S = new Px(9, 9); S.ellipse(4.5, 4.5, 3.8, 3.8, ramp('#e8d4ff')); S.set(3, 3, '#ffffff'); S.outline(OUT);
      this.def('shard', S, 0.5);
    }

    /* ---------------- pickups ---------------- */
    {
      const P = new Px(12, 12); const gold = ramp('#ffe14d');
      P.ellipse(6, 6, 5, 5.5, gold); P.ellipse(6, 6, 3, 3.5, null, gold[2]); P.rect(5, 4, 2, 4, gold[1]); P.set(4, 3, '#fff');
      P.outline('#6a4a00'); this.def('coin', P);
      const H = new Px(14, 13); H.sym = true; const red = ramp('#ff5d7a');
      H.ellipse(4, 4.5, 3.6, 3.6, red); H.poly([[0.5, 6], [7, 12.5], [13.5, 6]], red); H.set(3, 3, '#fff');
      H.outline('#0b3a20'); this.def('heart', H);
    }
  }
};
