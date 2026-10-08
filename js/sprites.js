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
    const OUT = '#0b0714';

    /* ---------------- PLAYER: space marine ---------------- */
    {
      const P = new Px(18, 24); P.sym = true;
      const armor = ramp('#d4e6ff'), navy = ramp('#34588f'), orange = ramp('#ff9f43'), visor = ramp('#38e1ff'), dark = ramp('#2a3350');
      P.shadedRect(2, 10, 14, 8, dark, true);               // backpack
      P.shadedRect(4, 17, 4, 5, navy);                       // legs
      P.shadedRect(3, 21, 5, 3, dark, true);                 // boots
      P.shadedRect(4, 11, 10, 7, armor, true);               // torso
      P.rect(4, 16, 10, 1, orange[1]);                       // belt
      P.set(8, 16, orange[3]);
      P.rect(8, 12, 2, 3, visor[2]); P.set(8, 12, visor[3]); // chest light
      P.ellipse(4.2, 12.5, 3, 3, orange);                    // shoulder pads
      P.shadedRect(0, 13, 3, 6, armor, true);                // arms
      P.rect(0, 18, 3, 2, dark[1]);                          // gloves
      P.ellipse(9, 7, 6.2, 6.2, armor);                      // helmet
      P.ellipse(9, 7.6, 4.4, 3.3, visor);                    // visor
      P.sym = false;
      P.set(6, 6, '#ffffff'); P.set(7, 5, '#eaffff'); P.set(6, 7, '#aaf4ff');
      P.rect(14, 0, 1, 3, orange[2]); P.set(14, 0, '#ff5d6c');   // antenna
      P.outline(OUT);
      this.def('player', P, 0.55);
    }

    /* guns (drawn rotated around the grip at x=3) */
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
      gun('gun_launcher', 19, 5, '#ff7a3d', (P, len, h, col) => { P.ellipse(len - 2, 3.5, 3, 3, ramp('#ff7a3d')); P.shadedRect(3, 5, 3, 3, dk); });
    }

    /* ---------------- ENEMIES ---------------- */
    { // GRUNT - snarling red crawler
      const P = new Px(16, 16); P.sym = true; const r = ramp('#ff5d6c'), bone = ramp('#efe3cc');
      P.ellipse(2.5, 11, 2.2, 3.4, r);                       // claws
      P.set(1, 14, bone[3]); P.set(0, 13, bone[3]);
      P.ellipse(8, 9.6, 6.7, 5.8, r);                        // body
      P.rect(3, 2, 1, 4, bone[2]); P.set(3, 1, bone[3]);     // horns
      P.rect(4, 5, 1, 1, bone[1]);
      P.eye(3, 6);
      P.rect(4, 5, 3, 1, r[0]); P.set(7, 6, r[0]);           // angry brows
      P.rect(5, 11, 6, 3, '#2a0610');                        // mouth
      P.set(5, 11, '#fff'); P.set(7, 11, '#fff'); P.set(6, 13, '#fff');
      P.outline(OUT); this.def('grunt', P);
    }
    { // SWARMER - little glowing bug
      const P = new Px(12, 11); P.sym = true; const r = ramp('#ffb347');
      P.ellipse(1.8, 4.5, 1.8, 3, null, 'rgba(255,240,200,.75)'); // wings
      P.ellipse(6, 6.5, 3.8, 3.5, r);
      P.line(4, 3, 3, 0, r[1]); P.set(3, 0, r[3]);           // antennae
      P.eye(2, 5);
      P.rect(5, 9, 2, 1, r[0]);
      P.outline(OUT); this.def('swarmer', P);
    }
    { // SHOOTER - floating one-eyed drone
      const P = new Px(18, 18); P.sym = true; const r = ramp('#ff7bd5'), steel = ramp('#7d6a9a');
      P.shadedRect(0, 7, 4, 5, steel, true);                 // side fins
      P.rect(1, 6, 1, 1, steel[3]);
      P.ellipse(9, 9, 7, 7, r);                              // body
      P.rect(3, 9, 12, 1, r[0]);                             // panel seam
      P.sym = false; P.bigEye(9, 8, 4.5, 4.5, 3); P.sym = true;
      P.rect(8, 15, 2, 2, steel[1]);                         // nozzle
      P.set(4, 3, r[3]); P.set(5, 2, r[3]);
      P.outline(OUT); this.def('shooter', P);
    }
    { // DASHER - sleek yellow raptor
      const P = new Px(18, 18); P.sym = true; const r = ramp('#ffe14d'), dk = ramp('#9a7a14');
      P.poly([[0, 7], [5, 9], [4, 14], [1, 12]], dk);        // blade wings
      P.ellipse(9, 10, 5.6, 6.4, r);
      P.poly([[9, 0], [11, 5], [9, 6.5], [7, 5]], null, dk[1]); // crest (centre)
      P.poly([[6, 3], [8, 6], [5, 7]], dk);
      P.eye(4, 8);
      P.line(3, 7, 7, 9, dk[0], 1);                          // slanted brow
      P.rect(7, 13, 4, 2, dk[0]); P.set(8, 13, '#fff');
      P.outline(OUT); this.def('dasher', P);
    }
    { // BOMBER - cartoon bomb with fuse
      const P = new Px(18, 20); P.sym = false; const r = ramp('#ff8a3d'), steel = ramp('#8892a8');
      P.ellipse(9, 12, 7.5, 7.5, r);
      P.shadedRect(6, 3, 6, 3, steel);                       // cap
      P.rect(8, 2, 2, 1, steel[3]);
      P.line(9, 2, 10, 1, '#8a6a3a'); P.line(10, 1, 12, 1, '#8a6a3a'); P.set(13, 0, '#8a6a3a');
      P.sym = true; P.eye(4, 9);
      P.sym = false;
      for (let i = 0; i < 6; i++) P.set(5 + i * 1.2, i % 2 ? 16 : 15, '#2a0f06');   // stitched grin
      P.set(5, 14, r[0]); P.set(12, 14, r[0]);
      P.outline(OUT); this.def('bomber', P);
    }
    { // TANK - armoured brute
      const P = new Px(28, 28); P.sym = true; const steel = ramp('#8aa0ff'), dk = ramp('#3a4a8a'), gy = ramp('#9aa4b8');
      P.shadedRect(2, 20, 8, 7, dk, true);                   // treads
      P.rect(3, 22, 6, 1, dk[0]); P.rect(3, 24, 6, 1, dk[0]);
      P.shadedRect(4, 9, 20, 14, steel, true);               // torso
      P.rect(7, 12, 14, 1, steel[3]);
      P.poly([[9, 14], [19, 14], [14, 21]], null, dk[1]);    // chest plate
      P.set(14, 16, '#ffe14d'); P.set(13, 16, '#ffe14d');
      P.shadedRect(0, 10, 5, 9, gy, true);                   // shoulder cannons
      P.rect(0, 17, 5, 3, '#222a40'); P.set(2, 19, '#ff7bd5');
      P.ellipse(14, 7, 5.5, 4.5, steel);                     // head
      P.rect(9, 6, 10, 2, '#ff4d6d'); P.set(10, 6, '#ffc0c8'); // visor
      P.rect(4, 10, 1, 1, '#fff'); P.rect(23, 10, 1, 1, '#fff'); P.rect(4, 21, 1, 1, '#fff'); P.rect(23, 21, 1, 1, '#fff');
      P.outline(OUT); this.def('tank', P);
    }
    { // TURRET (static base; barrels are drawn rotating at run-time)
      const P = new Px(22, 20); P.sym = true; const pu = ramp('#c77dff'), gy = ramp('#6a6a88');
      P.ellipse(11, 14, 10, 5, gy);
      P.rect(4, 14, 14, 1, gy[0]);
      P.ellipse(11, 9.5, 7, 7, pu);
      P.ellipse(11, 9.5, 4, 4, null, '#1b0a2e');
      P.ellipse(11, 9.5, 2.4, 2.4, null, '#ff7bd5'); P.set(10, 8, '#fff');
      P.outline(OUT); this.def('turret', P, 0.5);
      const B = new Px(12, 5); B.shadedRect(0, 0, 9, 5, gy); B.shadedRect(8, 1, 4, 3, ramp('#c77dff')); B.outline(OUT);
      this.def('turret_barrel', B, 0.5);
    }
    { // SPAWNER (hive) - pulsing egg sac
      const P = new Px(26, 26); P.sym = true; const g1 = ramp('#6dff9e'), dk = ramp('#2a8a52');
      P.line(5, 22, 2, 25, dk[1]); P.line(9, 23, 7, 25, dk[1]);
      P.ellipse(13, 13, 11, 11.5, g1);
      P.ellipse(6.5, 9, 2.2, 2.6, null, dk[0]); P.ellipse(6, 16.5, 1.8, 2.2, null, dk[0]); P.ellipse(9.5, 20, 1.5, 1.7, null, dk[0]);
      P.ellipse(6.5, 8.5, 1.2, 1.4, null, g1[3]);
      P.sym = false;
      P.bigEye(13, 12, 5, 5.5, 3, '#fff7c2');
      P.sym = true;
      P.line(13, 2, 13, 5, g1[3]);
      P.outline(OUT); this.def('spawner', P);
    }

    /* ---------------- BOSSES ---------------- */
    { // THE WARDEN - horned iron golem
      const P = new Px(38, 40); P.sym = true;
      const steel = ramp('#9a4a58'), dk = ramp('#3c2430'), hot = ramp('#ff5d4d'), bone = ramp('#efe3cc');
      P.shadedRect(9, 29, 8, 9, dk, true); P.shadedRect(7, 36, 10, 4, steel, true);        // legs/feet
      P.shadedRect(2, 17, 7, 14, steel, true);                                               // arms
      P.shadedRect(1, 29, 8, 7, dk, true); P.rect(2, 33, 6, 1, dk[0]);                       // fists
      P.shadedRect(9, 14, 20, 17, steel, true);                                              // torso
      P.rect(10, 22, 18, 2, dk[1]);                                                          // belt
      P.ellipse(19, 21, 4.2, 4.2, hot);                                                      // chest core
      P.ellipse(19, 21, 2.2, 2.2, null, '#ffe9a0');
      P.ellipse(7, 16, 6.2, 5.2, steel);                                                     // pauldrons
      P.set(3, 13, dk[0]); P.rect(5, 9, 2, 5, bone[2]); P.set(5, 8, bone[3]); P.set(6, 8, bone[3]);   // shoulder spikes
      P.ellipse(19, 9, 7.6, 7.2, steel);                                                     // helmet
      P.rect(12, 8, 14, 3, '#0b0714');                                                       // visor slit
      P.sym = false;
      P.rect(13, 9, 5, 1, '#ff3030'); P.rect(20, 9, 5, 1, '#ff3030'); P.set(14, 9, '#ffd0a0'); P.set(21, 9, '#ffd0a0');
      P.sym = true;
      P.poly([[10, 5], [5, 3], [3, -1], [8, 2], [11, 3]], null, bone[2]);                    // horns
      P.line(9, 4, 4, 0, bone[3], 1);
      P.rect(15, 12, 8, 2, dk[1]);                                                           // grille
      P.outline(OUT); this.def('boss_warden', P, 0.5);
    }
    { // HIVE MOTHER - winged insect queen
      const P = new Px(44, 44); P.sym = true;
      const g1 = ramp('#58d68a'), dk = ramp('#1f7a45'), bone = ramp('#efe3cc'), gold = ramp('#ffd24d');
      P.ellipse(5, 14, 5.5, 10, null, 'rgba(190,255,215,.42)'); P.ellipse(6, 13, 3.2, 7, null, 'rgba(255,255,255,.28)'); // wings
      for (let i = 0; i < 3; i++) { P.line(10 - i * 2, 28 + i * 3, 2 - i, 36 + i * 3, dk[1], 1); P.line(2 - i, 36 + i * 3, 3 - i, 40 + i * 2, dk[0], 1); } // legs
      P.ellipse(22, 29, 14, 12.5, g1);                                                       // abdomen
      P.paint((x, y, c) => (y >= 22 && y <= 39 && (y - 22) % 5 === 0) ? dk[1] : null);       // segments
      for (let i = 0; i < 3; i++) P.ellipse(13 + i * 1.6, 27 + i * 4, 2.2, 2.2, null, gold[2 - (i % 2)]); // glowing pustules
      P.ellipse(22, 14, 9, 8.5, ramp('#7be8a2'));                                            // head
      P.poly([[13, 9], [10, 3], [14, 6]], null, gold[2]); P.poly([[16, 7], [15, 0], [18, 5]], null, gold[3]); // crown spikes
      P.eye(14, 9); P.rect(15, 8, 4, 1, dk[0]);                                              // main eyes
      P.ellipse(19.5, 15.5, 1.4, 1.4, null, '#ffd24d');                                      // small eyes
      P.line(18, 20, 14, 26, bone[2], 2); P.line(14, 26, 17, 28, bone[3], 1);               // mandibles
      P.outline(OUT); this.def('boss_hive', P, 0.5);
    }
    { // THE VOID CORE - crystal eye
      const P = new Px(48, 48); P.sym = true;
      const cr = ramp('#b84dff'), dk = ramp('#4a1b88'), glow = ramp('#ff8bf0');
      P.poly([[24, 0], [30, 9], [24, 14], [18, 9]], cr);                                     // top shard
      P.poly([[24, 48], [30, 39], [24, 34], [18, 39]], cr);                                  // bottom shard
      P.poly([[0, 24], [9, 18], [14, 24], [9, 30]], cr);                                     // side shards
      P.poly([[6, 6], [13, 9], [14, 14], [8, 13]], dk); P.poly([[6, 42], [13, 39], [14, 34], [8, 35]], dk);
      P.ellipse(24, 24, 13, 13.5, dk);                                                       // core
      P.ellipse(24, 24, 11, 11.5, cr);
      for (let a = 0; a < 16; a++) {                                                         // rune ring
        const an = a / 16 * TAU; P.set(24 + Math.cos(an) * 12.2, 24 + Math.sin(an) * 12.7, a % 2 ? glow[3] : glow[1]);
      }
      P.sym = false; P.bigEye(24, 24, 8.5, 7.5, 5, '#fff2ff'); P.sym = true;
      P.sym = false; P.ellipse(24, 24, 4.2, 4.2, null, '#7a1fc4'); P.eyes.length = 0; P.eyes.push({ x: 22, y: 22, s: 5 });
      P.ellipse(24, 24, 2.4, 2.4, null, '#1a0630'); P.sym = true;
      P.outline(OUT); this.def('boss_core', P, 0.5);
      const S = new Px(8, 12); S.sym = true; S.poly([[4, 0], [8, 6], [4, 12], [0, 6]], cr); S.outline(OUT);
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
