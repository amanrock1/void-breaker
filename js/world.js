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

  // wall slab with panel lines
  g.fillStyle = theme.wall; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2;
  for (let x = 0; x <= W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, WALL); g.moveTo(x, H - WALL); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y <= H; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(WALL, y); g.moveTo(W - WALL, y); g.lineTo(W, y); g.stroke(); }
  g.fillStyle = rgba(theme.edge, 0.07);
  for (let i = 0; i < 26; i++) g.fillRect(randi(0, W), randi(0, 1) ? randi(6, 36) : H - randi(14, 42), randi(4, 22), 3);

  // floor
  g.fillStyle = theme.bg; g.fillRect(ARENA.x1, ARENA.y1, ax, ay);
  const gr = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 520);
  gr.addColorStop(0, rgba(theme.edge, 0.10)); gr.addColorStop(1, rgba(theme.edge, 0));
  g.fillStyle = gr; g.fillRect(ARENA.x1, ARENA.y1, ax, ay);
  g.strokeStyle = theme.grid; g.lineWidth = 1;
  g.beginPath();
  for (let x = ARENA.x1; x <= ARENA.x2; x += 40) { g.moveTo(x + 0.5, ARENA.y1); g.lineTo(x + 0.5, ARENA.y2); }
  for (let y = ARENA.y1; y <= ARENA.y2; y += 40) { g.moveTo(ARENA.x1, y + 0.5); g.lineTo(ARENA.x2, y + 0.5); }
  g.stroke();
  g.fillStyle = rgba(theme.edge, 0.12);
  for (let i = 0; i < 22; i++) { const x = ARENA.x1 + randi(0, 20) * 40, y = ARENA.y1 + randi(0, 12) * 40; g.fillRect(x - 2, y - 2, 5, 5); }
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
  for (const o of room.obstacles) {
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(o.x + 5, o.y + 7, o.w, o.h);
    g.fillStyle = theme.wall; g.fillRect(o.x, o.y, o.w, o.h);
    g.fillStyle = rgba(theme.edge, 0.08); g.fillRect(o.x + 3, o.y + 3, o.w - 6, o.h - 6);
    g.strokeStyle = theme.edge; g.lineWidth = 2; g.shadowColor = theme.edge; g.shadowBlur = 10;
    g.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2); g.shadowBlur = 0;
  }
  room.bg = c;
}
