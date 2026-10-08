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
    g.fillStyle = mixHex(theme.bg, '#ffffff', 0.015 + Math.random() * 0.045); g.fillRect(x, y, T, T);
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x, y, T, 1); g.fillRect(x, y, 1, T);
    g.fillStyle = 'rgba(0,0,0,.38)'; g.fillRect(x, y + T - 1, T, 1); g.fillRect(x + T - 1, y, 1, T);
    for (let i = 0; i < 16; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.045)' : 'rgba(0,0,0,.28)';
      g.fillRect(x + randi(2, T - 3), y + randi(2, T - 3), 1 + (Math.random() < 0.2 ? 1 : 0), 1);
    }
    if (deco === 'forge') {
      g.fillStyle = rgba(theme.edge, 0.32);
      if (Math.random() < 0.45) { g.fillRect(x + 3, y + 3, 2, 2); g.fillRect(x + T - 5, y + 3, 2, 2); g.fillRect(x + 3, y + T - 5, 2, 2); g.fillRect(x + T - 5, y + T - 5, 2, 2); }
      if (Math.random() < 0.07) { for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x + 6, y + 8 + k * 7, T - 12, 3); g.fillStyle = rgba(theme.edge, 0.12); g.fillRect(x + 6, y + 11 + k * 7, T - 12, 1); } }
      if (edge && Math.random() < 0.5) {
        for (let k = -T; k < T; k += 10) { g.fillStyle = 'rgba(255,200,40,.2)'; g.beginPath(); g.moveTo(x + k, y + T); g.lineTo(x + k + 5, y + T); g.lineTo(x + k + 11, y + T - 6); g.lineTo(x + k + 6, y + T - 6); g.fill(); }
      }
    } else if (deco === 'moss') {
      if (Math.random() < 0.42) for (let k = randi(2, 5); k > 0; k--) { g.fillStyle = Math.random() < 0.5 ? 'rgba(70,170,90,.22)' : 'rgba(30,90,45,.4)'; g.fillRect(x + randi(0, T - 8), y + randi(0, T - 8), randi(3, 8), randi(2, 5)); }
      if (Math.random() < 0.35) for (let k = randi(2, 4); k > 0; k--) { const gx = x + randi(2, T - 4), gy = y + randi(6, T - 4); g.fillStyle = 'rgba(110,235,130,.5)'; g.fillRect(gx, gy - 4, 1, 4); g.fillRect(gx + 2, gy - 3, 1, 3); g.fillRect(gx - 2, gy - 3, 1, 3); }
      if (edge) { g.fillStyle = 'rgba(30,110,50,.35)'; g.fillRect(x, y, T, 4); g.fillRect(x, y, 4, T); }
      if (Math.random() < 0.05) { g.fillStyle = 'rgba(255,230,120,.7)'; g.fillRect(x + randi(8, 28), y + randi(8, 28), 2, 2); }
    } else {
      if (Math.random() < 0.13) {
        let cx = x + randi(6, T - 6), cy = y + randi(6, T - 6);
        g.strokeStyle = rgba(theme.edge, 0.5); g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy);
        for (let k = 0; k < randi(4, 8); k++) { cx += randi(-8, 8); cy += randi(-8, 8); g.lineTo(cx, cy); }
        g.stroke();
      }
      if (Math.random() < 0.1) { g.fillStyle = rgba(theme.edge, 0.55); g.fillRect(x + randi(4, T - 6), y + randi(4, T - 6), 2, 2); }
    }
  }
  g.restore();
}

function drawObstacle(g, o, theme) {
  const e = theme.edge, d = theme.deco;
  g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(o.x + 6, o.y + 9, o.w, o.h);
  brickFill(g, o.x, o.y, o.w, o.h, d === 'forge' ? '#2a3a52' : d === 'moss' ? '#2a3d2c' : '#2e1a4a');
  g.fillStyle = 'rgba(255,255,255,.13)'; g.fillRect(o.x, o.y, o.w, Math.min(9, Math.floor(o.h / 2)));
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(o.x, o.y + o.h - 5, o.w, 5);
  if (d === 'forge') {
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 3;
    if (o.w > 40 && o.h > 40) { g.beginPath(); g.moveTo(o.x + 4, o.y + 10); g.lineTo(o.x + o.w - 4, o.y + o.h - 4); g.moveTo(o.x + o.w - 4, o.y + 10); g.lineTo(o.x + 4, o.y + o.h - 4); g.stroke(); }
    g.fillStyle = rgba(e, 0.7);
    for (const [px, py] of [[3, 3], [o.w - 6, 3], [3, o.h - 6], [o.w - 6, o.h - 6]]) g.fillRect(o.x + px, o.y + py, 3, 3);
  } else if (d === 'moss') {
    for (let i = 0; i < Math.max(4, o.w / 8); i++) { g.fillStyle = Math.random() < 0.5 ? '#3e8c4a' : '#5cc26a'; g.fillRect(o.x + randi(0, o.w - 6), o.y + randi(0, 5), randi(3, 9), randi(2, 4)); }
    for (let i = 0; i < 3; i++) { g.fillStyle = '#2f7a3c'; g.fillRect(o.x + randi(0, o.w - 2), o.y + randi(6, o.h - 8), 2, randi(6, 14)); }
  } else {
    for (let i = 0; i < Math.max(2, o.w / 30); i++) {
      const bx = o.x + 8 + i * (o.w - 16) / Math.max(1, Math.floor(o.w / 30)), hh = randi(14, 26);
      const gr = g.createLinearGradient(0, o.y - hh, 0, o.y); gr.addColorStop(0, '#e9a6ff'); gr.addColorStop(1, '#7a2fc4');
      g.fillStyle = gr; g.beginPath(); g.moveTo(bx - 6, o.y + 2); g.lineTo(bx, o.y - hh); g.lineTo(bx + 6, o.y + 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(bx, o.y - hh); g.lineTo(bx + 2, o.y - hh * 0.4); g.lineTo(bx - 2, o.y - hh * 0.4); g.fill();
    }
  }
  g.strokeStyle = e; g.lineWidth = 2; g.shadowColor = e; g.shadowBlur = 8;
  g.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2); g.shadowBlur = 0;
}
