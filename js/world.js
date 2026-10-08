'use strict';
/* ==========================================================
   world.js  -  procedural floor generation + room rendering cache
   ========================================================== */
const DIRS = {
  n: { dx: 0, dy: -1, o: 's' }, e: { dx: 1, dy: 0, o: 'w' },
  s: { dx: 0, dy: 1, o: 'n' }, w: { dx: -1, dy: 0, o: 'e' }
};

function newRoom(gx, gy, type, depth) {
  return {
    gx, gy, type, depth, doors: {}, cleared: false, visited: false, open: false, active: false,
    obstacles: [], pickups: [], built: false, bg: null, wave: 0, waves: 2, spawnDelay: 0, bossDelay: 0
  };
}

/* Builds a random tree-shaped dungeon on a 5x5 grid. */
function generateFloor(n) {
  const rooms = {}, key = (x, y) => x + ',' + y, list = [];
  const start = newRoom(2, 2, 'start', 0);
  rooms[key(2, 2)] = start; list.push(start);
  const target = 6 + n + randi(0, 1);
  let guard = 0;
  while (list.length < target && guard++ < 600) {
    const p = pick(list);
    for (const d of shuffle(Object.keys(DIRS))) {
      const nx = p.gx + DIRS[d].dx, ny = p.gy + DIRS[d].dy;
      if (nx < 0 || ny < 0 || nx > 4 || ny > 4 || rooms[key(nx, ny)]) continue;
      let nb = 0;
      for (const dd of Object.values(DIRS)) if (rooms[key(nx + dd.dx, ny + dd.dy)]) nb++;
      if (nb !== 1) continue;
      const r = newRoom(nx, ny, 'combat', p.depth + 1);
      p.doors[d] = true; r.doors[DIRS[d].o] = true;
      rooms[key(nx, ny)] = r; list.push(r);
      break;
    }
  }
  const leaves = list.filter(r => r !== start && Object.keys(r.doors).length === 1).sort((a, b) => b.depth - a.depth);
  const boss = leaves.length ? leaves[0] : list[list.length - 1];
  boss.type = 'boss';
  const rest = list.filter(r => r !== start && r !== boss);
  const spare = shuffle(leaves.filter(r => r !== boss));
  const pool = spare.concat(shuffle(rest.filter(r => !spare.includes(r) && r.depth >= 2)));
  if (pool[0]) pool[0].type = 'treasure';
  if (pool[1]) pool[1].type = 'shop';
  start.cleared = true;
  const arr = list;
  return { rooms, list: arr, start, boss, get(x, y) { return rooms[key(x, y)]; } };
}

/* Fill in obstacles / pedestals the first time a room is entered. */
function buildRoom(room, theme) {
  room.built = true;
  if (room.type === 'combat') room.obstacles = pick(ROOM_TEMPLATES).map(a => ({ x: a[0], y: a[1], w: a[2], h: a[3] }));
  if (room.type === 'start' && G.floorNo > 1) room.obstacles = [];
  if (room.type !== 'combat' && room.type !== 'boss') { room.cleared = true; }
  if (room.type === 'treasure') {
    const owned = G.player.weapons, avail = shuffle(Object.keys(WEAPONS).filter(k => !owned.includes(k)));
    const items = [];
    for (let i = 0; i < 2; i++) {
      if (avail[i]) items.push({ kind: 'weapon', id: avail[i], name: WEAPONS[avail[i]].name, desc: WEAPONS[avail[i]].desc, color: WEAPONS[avail[i]].color, icon: '🔫' });
    }
    const ups = rollUpgrades(G.player, 1);
    if (ups[0]) items.push({ kind: 'upgrade', id: ups[0].id, name: ups[0].name, desc: ups[0].desc, color: '#ffe14d', icon: ups[0].icon });
    placePedestals(room, items, 0, 'treasure');
  }
  if (room.type === 'shop') {
    const items = [
      { kind: 'heal', name: 'Repair Kit', desc: 'Restore 50% HP', color: '#6dff9e', icon: '❤️', cost: 12 },
      { kind: 'maxhp', name: 'Hull Plating', desc: '+20 max HP', color: '#ff7b8a', icon: '🛡️', cost: 22 }
    ];
    const ups = rollUpgrades(G.player, 1);
    if (ups[0]) items.push({ kind: 'upgrade', id: ups[0].id, name: ups[0].name, desc: ups[0].desc, color: '#ffe14d', icon: ups[0].icon, cost: 28 });
    const avail = Object.keys(WEAPONS).filter(k => !G.player.weapons.includes(k));
    if (avail.length) { const k = pick(avail); items.push({ kind: 'weapon', id: k, name: WEAPONS[k].name, desc: WEAPONS[k].desc, color: WEAPONS[k].color, icon: '🔫', cost: 38 }); }
    placePedestals(room, items, null, 'shop');
  }
}

function placePedestals(room, items, forceCost, group) {
  const n = items.length;
  items.forEach((it, i) => {
    room.pickups.push({
      type: 'ped', x: W / 2 + (i - (n - 1) / 2) * 150, y: H / 2 + 10, r: 16, t: rand(0, 5),
      item: it, cost: forceCost === 0 ? 0 : it.cost, group: group === 'treasure' ? 'treasure' : null
    });
  });
}

function rollUpgrades(p, n) {
  const avail = UPGRADES.filter(u => (p.upg[u.id] || 0) < u.max);
  const out = [];
  while (out.length < n && avail.length) {
    const total = avail.reduce((s, u) => s + u.w, 0);
    let r = Math.random() * total, idx = 0;
    for (; idx < avail.length - 1; idx++) { r -= avail[idx].w; if (r <= 0) break; }
    out.push(avail.splice(idx, 1)[0]);
  }
  return out;
}

/* ---------- pre-rendered room background ---------- */
function bakeRoom(room, theme) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), dd = DOOR_HALF, doors = room.doors;
  const ax = ARENA.x2 - ARENA.x1, ay = ARENA.y2 - ARENA.y1;

  // brick walls
  g.fillStyle = theme.wall; g.fillRect(0, 0, W, H);
  brickFill(g, 0, 0, W, WALL, theme.brick); brickFill(g, 0, H - WALL, W, WALL, theme.brick);
  brickFill(g, 0, WALL, WALL, H - WALL * 2, theme.brick); brickFill(g, W - WALL, WALL, WALL, H - WALL * 2, theme.brick);
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(ARENA.x1, ARENA.y1, ax, 10); g.fillRect(ARENA.x1, ARENA.y1, 8, ay);   // wall shadow on the floor

  // floor
  g.fillStyle = theme.bg; g.fillRect(ARENA.x1, ARENA.y1, ax, ay);
  const gr = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 520);
  gr.addColorStop(0, rgba(theme.edge, 0.10)); gr.addColorStop(1, rgba(theme.edge, 0));
  g.fillStyle = gr; g.fillRect(ARENA.x1, ARENA.y1, ax, ay);
  bakeFloor(g, theme);
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(ARENA.x1, ARENA.y1, ax, 10); g.fillRect(ARENA.x1, ARENA.y1, 8, ay);
  // centre emblem
  g.strokeStyle = rgba(theme.edge, 0.12); g.lineWidth = 2;
  g.beginPath(); g.arc(W / 2, H / 2, 90, 0, TAU); g.stroke();
  g.beginPath(); g.arc(W / 2, H / 2, 70, 0, TAU); g.stroke();
  if (room.type === 'boss') { g.strokeStyle = 'rgba(255,80,80,.22)'; g.beginPath(); g.arc(W / 2, H / 2, 150, 0, TAU); g.stroke(); }

  // door corridors
  g.fillStyle = '#04070c';
  if (doors.n) g.fillRect(W / 2 - dd, 0, dd * 2, WALL);
  if (doors.s) g.fillRect(W / 2 - dd, H - WALL, dd * 2, WALL);
  if (doors.w) g.fillRect(0, H / 2 - dd, WALL, dd * 2);
  if (doors.e) g.fillRect(W - WALL, H / 2 - dd, WALL, dd * 2);

  // glowing edge, broken at doors
  g.strokeStyle = theme.edge; g.lineWidth = 2.5; g.shadowColor = theme.edge; g.shadowBlur = 14;
  const seg = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  const mid = (a, b, door, vertical) => {
    if (!door) return vertical ? seg(a.x, a.y, b.x, b.y) : seg(a.x, a.y, b.x, b.y);
    if (!vertical) { seg(a.x, a.y, W / 2 - dd, a.y); seg(W / 2 + dd, a.y, b.x, b.y); }
    else { seg(a.x, a.y, a.x, H / 2 - dd); seg(a.x, H / 2 + dd, b.x, b.y); }
  };
  mid({ x: ARENA.x1, y: ARENA.y1 }, { x: ARENA.x2, y: ARENA.y1 }, doors.n, false);
  mid({ x: ARENA.x1, y: ARENA.y2 }, { x: ARENA.x2, y: ARENA.y2 }, doors.s, false);
  mid({ x: ARENA.x1, y: ARENA.y1 }, { x: ARENA.x1, y: ARENA.y2 }, doors.w, true);
  mid({ x: ARENA.x2, y: ARENA.y1 }, { x: ARENA.x2, y: ARENA.y2 }, doors.e, true);
  // door posts
  g.lineWidth = 4;
  if (doors.n) { seg(W / 2 - dd, 0, W / 2 - dd, ARENA.y1); seg(W / 2 + dd, 0, W / 2 + dd, ARENA.y1); }
  if (doors.s) { seg(W / 2 - dd, H, W / 2 - dd, ARENA.y2); seg(W / 2 + dd, H, W / 2 + dd, ARENA.y2); }
  if (doors.w) { seg(0, H / 2 - dd, ARENA.x1, H / 2 - dd); seg(0, H / 2 + dd, ARENA.x1, H / 2 + dd); }
  if (doors.e) { seg(W, H / 2 - dd, ARENA.x2, H / 2 - dd); seg(W, H / 2 + dd, ARENA.x2, H / 2 + dd); }
  g.shadowBlur = 0;

  // obstacles
  for (const o of room.obstacles) drawObstacle(g, o, theme);
  room.bg = c;
}


/* ---------- texture helpers ---------- */
function brickFill(g, x, y, w, h, base) {
  const bh = 12, bw = 24;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  for (let row = 0, yy = y; yy < y + h; row++, yy += bh) {
    const off = row % 2 ? bw / 2 : 0;
    for (let xx = x - off; xx < x + w; xx += bw) {
      g.fillStyle = mixHex(base, Math.random() < 0.5 ? '#000000' : '#ffffff', Math.random() * 0.13);
      g.fillRect(xx, yy, bw, bh);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(xx, yy, bw, 1);
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(xx, yy + bh - 1, bw, 1); g.fillRect(xx + bw - 1, yy, 1, bh);
      if (Math.random() < 0.12) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(xx + randi(2, 16), yy + randi(2, 8), randi(2, 5), 2); }
    }
  }
  g.restore();
}

function bakeFloor(g, theme) {
  const T = 40, deco = theme.deco;
  g.save(); g.beginPath(); g.rect(ARENA.x1, ARENA.y1, ARENA.x2 - ARENA.x1, ARENA.y2 - ARENA.y1); g.clip();
  const cols = Math.ceil((ARENA.x2 - ARENA.x1) / T), rows = Math.ceil((ARENA.y2 - ARENA.y1) / T);
  for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
    const x = ARENA.x1 + tx * T, y = ARENA.y1 + ty * T, edge = tx === 0 || ty === 0 || tx === cols - 1 || ty === rows - 1;
    if (deco === 'reef') g.fillStyle = mixHex(theme.bg, '#d8c590', 0.10 + Math.random() * 0.08);
    else if (deco === 'wreck') g.fillStyle = mixHex('#33281a', '#000000', Math.random() * 0.28);
    else g.fillStyle = mixHex(theme.bg, '#ffffff', 0.012 + Math.random() * 0.035);
    g.fillRect(x, y, T, T);
    if (deco !== 'wreck') {
      g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x, y, T, 1); g.fillRect(x, y, 1, T);
      g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, y + T - 1, T, 1); g.fillRect(x + T - 1, y, 1, T);
    }
    for (let i = 0; i < 16; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.25)';
      g.fillRect(x + randi(2, T - 3), y + randi(2, T - 3), 1 + (Math.random() < 0.2 ? 1 : 0), 1);
    }
    if (deco === 'reef') {
      g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1;
      for (let k = 0; k < 2; k++) { const cx = x + randi(6, T - 6), cy = y + randi(6, T - 6); g.beginPath(); g.arc(cx, cy, randi(5, 10), 0.2, 2.2); g.stroke(); }
      if (Math.random() < 0.08) { const sx = x + randi(8, T - 8), sy = y + randi(8, T - 8); g.fillStyle = '#ff9a5c'; g.fillRect(sx - 1, sy - 3, 2, 7); g.fillRect(sx - 3, sy - 1, 7, 2); g.fillStyle = '#ffd0a8'; g.fillRect(sx, sy, 1, 1); }
      if (Math.random() < 0.08) { const sx = x + randi(6, T - 8), sy = y + randi(6, T - 8); g.fillStyle = '#ffb3c8'; g.fillRect(sx, sy, 4, 3); g.fillStyle = '#ff7aa8'; g.fillRect(sx + 1, sy + 1, 2, 1); }
      if (Math.random() < 0.1 || (edge && Math.random() < 0.3)) {
        const sx = x + randi(4, T - 4), sy = y + T - 2;
        for (let b = 0; b < 3; b++) { g.fillStyle = b === 1 ? '#3fbf6a' : '#2a8f4e'; for (let k = 0; k < 9 + b * 3; k++) g.fillRect(sx + b * 3 + Math.round(Math.sin(k * 0.6 + b) * 1.5), sy - k, 1, 1); }
      }
    } else if (deco === 'wreck') {
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x, y + 19, T, 2); g.fillRect(x, y + T - 1, T, 1);
      g.fillStyle = 'rgba(255,220,160,.05)'; g.fillRect(x, y, T, 1); g.fillRect(x, y + 20, T, 1);
      const sx = randi(0, 1) ? 14 : 26, sx2 = randi(0, 1) ? 8 : 30;
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x + sx, y, 1, 19); g.fillRect(x + sx2, y + 21, 1, 19);
      g.fillStyle = 'rgba(180,170,150,.5)'; for (const nx of [3, T - 5]) { g.fillRect(x + nx, y + 4, 2, 2); g.fillRect(x + nx, y + 26, 2, 2); }
      if (Math.random() < 0.12) { g.fillStyle = 'rgba(160,70,30,.3)'; g.fillRect(x + randi(2, 26), y + randi(2, 26), randi(6, 12), randi(4, 8)); }
      if (Math.random() < 0.1) { g.fillStyle = 'rgba(60,150,90,.35)'; g.fillRect(x + randi(2, 30), y + randi(2, 30), randi(4, 9), randi(2, 5)); }
    } else {
      if (Math.random() < 0.14) {
        let cx = x + randi(6, T - 6), cy = y + randi(6, T - 6);
        g.strokeStyle = rgba(theme.edge, 0.55); g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy);
        for (let k = 0; k < randi(4, 8); k++) { cx += randi(-8, 8); cy += randi(-8, 8); g.lineTo(cx, cy); }
        g.stroke();
      }
      if (Math.random() < 0.12) { const c = Math.random() < 0.5 ? '#4de1ff' : '#ff5de1'; g.fillStyle = rgba(c, 0.7); g.fillRect(x + randi(4, T - 6), y + randi(4, T - 6), 2, 2); }
    }
  }
  g.restore();
}

function drawObstacle(g, o, theme) {
  const e = theme.edge, d = theme.deco;
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(o.x + 6, o.y + 9, o.w, o.h);
  if (d === 'wreck') {
    g.fillStyle = '#5a4228'; g.fillRect(o.x, o.y, o.w, o.h);
    for (let yy = o.y + 10; yy < o.y + o.h; yy += 10) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(o.x, yy, o.w, 1); }
    for (let i = 0; i < 6; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,220,160,.1)' : 'rgba(0,0,0,.14)'; g.fillRect(o.x + randi(0, o.w - 8), o.y + randi(0, o.h - 4), randi(4, 14), 2); }
    g.fillStyle = '#2b2b33';
    const horiz = o.w >= o.h;
    for (const k of [0.15, 0.85]) {
      if (horiz) g.fillRect(o.x + o.w * k - 3, o.y, 6, o.h); else g.fillRect(o.x, o.y + o.h * k - 3, o.w, 6);
    }
    g.fillStyle = '#8a8a98'; for (const k of [0.15, 0.85]) { for (const q of [0.2, 0.8]) { if (horiz) g.fillRect(o.x + o.w * k - 1, o.y + o.h * q, 2, 2); else g.fillRect(o.x + o.w * q, o.y + o.h * k - 1, 2, 2); } }
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(o.x, o.y, o.w, 3);
    g.fillStyle = 'rgba(60,150,90,.5)'; for (let i = 0; i < 4; i++) g.fillRect(o.x + randi(0, o.w - 6), o.y + o.h - randi(2, 6), randi(3, 8), 3);
  } else if (d === 'reef') {
    brickFill(g, o.x, o.y, o.w, o.h, '#2f6a78');
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(o.x, o.y, o.w, Math.min(8, Math.floor(o.h / 2)));
    const n = Math.max(3, Math.round(o.w / 14));
    for (let i = 0; i < n; i++) {
      const bx = o.x + 6 + i * (o.w - 12) / Math.max(1, n - 1), col = ['#ff7aa8', '#ff9f5a', '#ffb3c8', '#ff6b6b'][i % 4];
      g.strokeStyle = col; g.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const ang = -Math.PI / 2 + (k - 1) * 0.5, len = randi(10, 20);
        g.lineWidth = 3; g.beginPath(); g.moveTo(bx, o.y + 3); g.lineTo(bx + Math.cos(ang) * len, o.y + 3 + Math.sin(ang) * len); g.stroke();
        g.fillStyle = '#fff2e8'; g.fillRect(bx + Math.cos(ang) * len - 1, o.y + 3 + Math.sin(ang) * len - 1, 3, 3);
      }
    }
    g.lineCap = 'butt';
  } else {
    brickFill(g, o.x, o.y, o.w, o.h, '#1c1a44');
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(o.x, o.y, o.w, Math.min(8, Math.floor(o.h / 2)));
    for (let i = 0; i < Math.max(2, o.w / 30); i++) {
      const bx = o.x + 8 + i * (o.w - 16) / Math.max(1, Math.floor(o.w / 30)), hh = randi(14, 26);
      const gr = g.createLinearGradient(0, o.y - hh, 0, o.y); gr.addColorStop(0, '#8ffcff'); gr.addColorStop(1, '#3a6bd8');
      g.fillStyle = gr; g.beginPath(); g.moveTo(bx - 6, o.y + 2); g.lineTo(bx, o.y - hh); g.lineTo(bx + 6, o.y + 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.moveTo(bx, o.y - hh); g.lineTo(bx + 2, o.y - hh * 0.4); g.lineTo(bx - 2, o.y - hh * 0.4); g.fill();
    }
  }
  g.strokeStyle = rgba(e, 0.7); g.lineWidth = 2; g.shadowColor = e; g.shadowBlur = 6;
  g.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2); g.shadowBlur = 0;
}
