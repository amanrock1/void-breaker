'use strict';
/* ==========================================================
   game.js  -  the game director: state machine, rooms, waves,
   pickups, scoring. Everything else plugs into the global G.
   ========================================================== */
const G = {
  state: 'title', anim: 0, time: 0, runTime: 0,
  player: null, floorNo: 1, floor: null, room: null, theme: THEMES[0],
  enemies: [], bullets: [], ebullets: [], pickups: [], hazards: [], events: [],
  score: 0, kills: 0, combo: 0, comboT: 0, roomsCleared: 0,
  banner: null, toasts: [], fade: 0, boss: null, near: null, dyingT: 0, best: 0,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    Input.init(this.canvas);
    UI.init();
    Render.init(this.ctx);
    try { this.best = +localStorage.getItem('voidbreaker.best') || 0; } catch (e) { }
    UI.refreshBest();
    const fit = () => {
      const wrap = document.getElementById('wrap');
      const w = Math.min(innerWidth, innerHeight * 1.6), h = w / 1.6;
      wrap.style.width = w + 'px'; wrap.style.height = h + 'px';
      wrap.style.fontSize = (w / 960 * 16) + 'px';
    };
    addEventListener('resize', fit); fit();
    addEventListener('blur', () => { if (this.state === 'play') this.pause(); });
    let last = performance.now();
    const frame = now => {
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      try { this.tick(dt); Render.draw(); } catch (err) { console.error(err); window.__err = (window.__err || '') + err.stack + '\n'; }
      Input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },

  /* ---------------- state transitions ---------------- */
  start() {
    Sound.init(); Sound.resume();
    FX.reset();
    this.player = new Player();
    this.floorNo = 1; this.score = 0; this.kills = 0; this.combo = 0; this.roomsCleared = 0;
    this.time = 0; this.runTime = 0; this.events = []; this.toasts = []; this.boss = null;
    this.loadFloor(1);
    this.state = 'play';
    UI.hideAll();
    Sound.play('click');
  },
  loadFloor(n) {
    this.floorNo = n; this.theme = THEMES[n - 1];
    this.floor = generateFloor(n);
    this.enterRoom(this.floor.start, null);
    this.setBanner(this.theme.name, this.theme.sub, this.theme.edge);
    Sound.startMusic(this.theme);
  },
  pause() { if (this.state !== 'play') return; this.state = 'pause'; UI.show('s-pause'); },
  resume() { if (this.state !== 'pause') return; this.state = 'play'; UI.hideAll(); },
  toTitle() {
    this.state = 'title'; this.room = null; Sound.stopMusic(); UI.show('s-title'); UI.refreshBest();
  },
  gameOver() {
    if (this.state !== 'play') return;
    this.state = 'dying'; this.dyingT = 1.1;
    const p = this.player;
    FX.burst(p.x, p.y, 60, '#7df9ff', 450, 1, 4); FX.burst(p.x, p.y, 30, '#ffffff', 300, 0.8, 3);
    FX.ring(p.x, p.y, 10, 200, '#7df9ff', 0.8); FX.addShake(16); Sound.play('explosion'); Sound.play('lose');
    Sound.targetIntensity = 0.1;
    this.saveBest();
  },
  win() {
    if (this.state !== 'play') return;
    this.state = 'win'; this.saveBest(); Sound.play('win');
    UI.showEnd('s-win');
  },
  saveBest() {
    if (this.score > this.best) { this.best = this.score; try { localStorage.setItem('voidbreaker.best', String(this.best)); } catch (e) { } }
  },
  setBanner(title, sub, color) { this.banner = { title, sub, color, t: 0, dur: 3 }; },
  toast(text, color) { this.toasts.push({ text, color: color || '#fff', t: 0 }); if (this.toasts.length > 3) this.toasts.shift(); },
  after(delay, fn) { this.events.push({ t: delay, fn }); },

  /* ---------------- main tick ---------------- */
  tick(dt) {
    this.anim += dt;
    const I = Input, s = this.state;
    if (I.pressed['KeyM']) Sound.toggleMute();
    if (s === 'title') {
      if (I.pressed['Enter']) this.start();
      FX.update(dt);
    } else if (s === 'play') {
      if (I.pressed['Escape'] || I.pressed['KeyP']) this.pause(); else this.updatePlay(dt);
    } else if (s === 'pause') {
      if (I.pressed['Escape'] || I.pressed['KeyP']) this.resume();
    } else if (s === 'cards') {
      for (let i = 0; i < 4; i++) if (I.pressed['Digit' + (i + 1)]) UI.pickCard(i);
    } else if (s === 'dying') {
      FX.update(dt); this.dyingT -= dt;
      for (const e of this.enemies) e.t += dt;
      if (this.dyingT <= 0) { this.state = 'over'; UI.showEnd('s-over'); }
    } else if (s === 'over' || s === 'win') {
      FX.update(dt);
      if (I.pressed['KeyR'] || I.pressed['Enter']) this.start();
    }
  },

  updatePlay(dt) {
    let sdt = dt;
    if (FX.hitstop > 0) { FX.hitstop -= dt; sdt = dt * 0.12; }
    this.time += sdt; this.runTime += sdt;
    this.comboT -= sdt; if (this.comboT <= 0) this.combo = 0;
    const p = this.player, room = this.room;

    p.update(sdt);
    this.roomLogic(sdt);
    for (let i = 0; i < this.enemies.length; i++) this.enemies[i].update(sdt);
    this.updateOrbitBlades(sdt);
    for (const b of this.bullets) b.update(sdt);
    for (const b of this.ebullets) b.update(sdt);
    this.updateHazards(sdt);
    this.updatePickups(sdt);

    this.enemies = this.enemies.filter(e => !e.dead);
    this.bullets = this.bullets.filter(b => !b.dead);
    this.ebullets = this.ebullets.filter(b => !b.dead);

    for (let i = this.events.length - 1; i >= 0; i--) {
      const ev = this.events[i]; ev.t -= sdt;
      if (ev.t <= 0) { this.events.splice(i, 1); ev.fn(); }
    }
    FX.update(sdt);

    // doors
    if (this.state === 'play' && room.open) {
      if (p.y < ARENA.y1 - 8 && room.doors.n) this.changeRoom('n');
      else if (p.y > ARENA.y2 + 8 && room.doors.s) this.changeRoom('s');
      else if (p.x < ARENA.x1 - 8 && room.doors.w) this.changeRoom('w');
      else if (p.x > ARENA.x2 + 8 && room.doors.e) this.changeRoom('e');
    }
    this.fade = Math.max(0, this.fade - dt * 3.5);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.dur) this.banner = null; }
    for (let i = this.toasts.length - 1; i >= 0; i--) { this.toasts[i].t += dt; if (this.toasts[i].t > 2.2) this.toasts.splice(i, 1); }
    Sound.targetIntensity = (room.active || this.boss) ? 1 : 0.3;
  },

  /* ---------------- collision helper for everything that walks ---------------- */
  constrain(e, isPlayer) {
    const r = e.r, room = this.room;
    let minX = ARENA.x1 + r, maxX = ARENA.x2 - r, minY = ARENA.y1 + r, maxY = ARENA.y2 - r;
    if (isPlayer && room.open) {
      const gx = Math.abs(e.x - W / 2) < DOOR_HALF - 4, gy = Math.abs(e.y - H / 2) < DOOR_HALF - 4;
      if (gx && room.doors.n) minY = -r;
      if (gx && room.doors.s) maxY = H + r;
      if (gy && room.doors.w) minX = -r;
      if (gy && room.doors.e) maxX = W + r;
    }
    e.x = clamp(e.x, minX, maxX); e.y = clamp(e.y, minY, maxY);
    for (const o of room.obstacles) circleRectPush(e, o);
  },

  /* ---------------- combat helpers ---------------- */
  enemyShot(x, y, ang, speed, dmg, color) {
    if (this.ebullets.length > 450) return;
    const b = new Bullet(x, y, ang, speed, dmg, false);
    b.r = 5; b.life = 5; b.glowColor = color; b.color = color;
    this.ebullets.push(b);
  },
  explosion(x, y, r, dmg, o) {
    o = o || {};
    FX.ring(x, y, 6, r, '#ffb347', 0.4); FX.ring(x, y, 2, r * 0.6, '#ffffff', 0.25);
    FX.burst(x, y, 26, '#ff8a3d', 330, 0.6, 4); FX.burst(x, y, 12, '#ffe14d', 220, 0.45, 3);
    FX.addShake(Math.min(10, 3 + r / 20)); Sound.play('explosion');
    if (o.enemies) {
      for (const e of this.enemies.slice()) {
        if (e.dead || e.spawnT > 0) continue;
        const d = dist(e, { x, y });
        if (d < r + e.r) e.hurt(dmg * (1 - 0.4 * clamp(d / r, 0, 1)), { ang: Math.atan2(e.y - y, e.x - x), knock: 380 });
      }
    }
    if (o.player) {
      const p = this.player;
      if (dist(p, { x, y }) < r + p.r) p.hurt(dmg);
    }
  },
  updateOrbitBlades() {
    const p = this.player;
    if (!p.orbit) return;
    for (const bl of p.orbitBlades()) {
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0 || e.orbCd > 0) continue;
        if (Math.hypot(e.x - bl.x, e.y - bl.y) < bl.r + e.r) {
          e.hurt(10 * p.dmgMul, { ang: Math.atan2(e.y - p.y, e.x - p.x), knock: 220 }); e.orbCd = 0.28;
        }
      }
      for (const b of this.ebullets) if (Math.hypot(b.x - bl.x, b.y - bl.y) < bl.r + b.r) { b.dead = true; FX.burst(b.x, b.y, 4, '#fff', 120, 0.25, 2); }
    }
  },
  updateHazards(dt) {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i]; h.t += dt;
      if (h.t >= h.fuse) {
        this.explosion(h.x, h.y, h.r, h.dmg, { player: true, enemies: false });
        this.hazards.splice(i, 1);
      }
    }
  },

  killEnemy(e, quiet) {
    if (e.dead) return;
    e.dead = true;
    FX.burst(e.x, e.y, e.boss ? 70 : 14, e.color, e.boss ? 480 : 260, 0.7, 3.2);
    FX.ring(e.x, e.y, e.r, e.r * 3.2, e.color, 0.35);
    if (quiet) return;
    Sound.play('kill');
    this.kills++; this.combo++; this.comboT = 3;
    const pts = Math.round(e.def.score * e.scoreMul * (1 + Math.min(this.combo, 20) * 0.1));
    this.score += pts;
    FX.text(e.x, e.y - e.r - 12, '+' + pts, '#7df9ff', 11);
    FX.addShake(e.boss ? 16 : 2.5);
    if (e.def.ai === 'bomber') this.explosion(e.x, e.y, 80, 26 + this.floorNo * 4, { player: true, enemies: true });
    if (e.boss) { this.bossDefeated(e); return; }
    if (chance(0.38 + (e.elite ? 0.6 : 0))) this.dropPickup('coin', e.x, e.y);
    if (chance(this.player.hp < this.player.maxHp * 0.5 ? 0.12 : 0.05)) this.dropPickup('heart', e.x, e.y);
  },
  dropPickup(type, x, y) {
    const a = rand(0, TAU), sp = rand(60, 200);
    this.room.pickups.push({ type, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: type === 'coin' ? 6 : 9, t: rand(0, 5), life: 14 });
  },

  /* ---------------- rooms ---------------- */
  changeRoom(dir) {
    const d = DIRS[dir], nb = this.floor.get(this.room.gx + d.dx, this.room.gy + d.dy);
    if (nb) this.enterRoom(nb, dir);
  },
  enterRoom(room, moved) {
    const th = this.theme, p = this.player;
    this.room = room; room.visited = true;
    if (!room.built) buildRoom(room, th);
    if (!room.bg) bakeRoom(room, th);
    this.enemies = []; this.bullets = []; this.ebullets = []; this.hazards = [];
    this.pickups = room.pickups; this.boss = null;
    if (moved) {
      p.vx = p.vy = 0; p.dashT = 0;
      if (moved === 'n') { p.x = W / 2; p.y = ARENA.y2 - 20; }
      if (moved === 's') { p.x = W / 2; p.y = ARENA.y1 + 20; }
      if (moved === 'e') { p.x = ARENA.x1 + 20; p.y = H / 2; }
      if (moved === 'w') { p.x = ARENA.x2 - 20; p.y = H / 2; }
    } else { p.x = W / 2; p.y = H / 2 + 70; p.vx = p.vy = 0; }
    FX.parts.length = 0;
    this.fade = 1;
    room.open = room.cleared; room.active = false;
    if (!room.cleared) {
      room.active = true; Sound.play('lock');
      if (room.type === 'combat') { room.wave = 0; room.spawnDelay = 0.8; }
      if (room.type === 'boss') { room.bossDelay = 1.2; }
    }
  },
  roomLogic(dt) {
    const r = this.room;
    if (!r.active) return;
    if (r.type === 'combat') {
      if (r.spawnDelay > 0) { r.spawnDelay -= dt; if (r.spawnDelay <= 0) this.spawnWave(r); }
      else if (this.enemies.length === 0) {
        if (r.wave < r.waves) r.spawnDelay = 0.9; else this.clearRoom(r);
      }
    } else if (r.type === 'boss' && r.bossDelay > 0) {
      r.bossDelay -= dt;
      if (r.bossDelay <= 0) {
        const b = new Boss(this.theme.boss, W / 2, 170);
        this.enemies.push(b); this.boss = b;
        this.setBanner(b.bdef.name, b.bdef.sub, b.color); Sound.play('boss'); FX.addShake(10);
      }
    }
  },
  spawnWave(room) {
    room.wave++;
    const fl = this.floorNo;
    let budget = (6 + fl * 4 + this.roomsCleared * 0.35) * (room.wave === 1 ? 1 : 0.75);
    if (this.roomsCleared === 0) budget *= 0.7;
    const types = Object.keys(ENEMIES).filter(k => ENEMIES[k].minFloor <= fl), list = [];
    while (budget > 0.9 && list.length < 12) {
      const opts = types.filter(k => ENEMIES[k].cost <= budget);
      if (!opts.length) break;
      const t = pick(opts); budget -= ENEMIES[t].cost; list.push(t);
    }
    const p = this.player;
    for (const t of list) {
      const def = ENEMIES[t], n = def.group || 1;
      const c = this.spawnPoint(p, 230, def.r + 6);
      for (let i = 0; i < n; i++) {
        const elite = fl >= 2 && !def.group && t !== 'turret' && chance(0.08 + 0.04 * fl);
        this.enemies.push(new Enemy(t, c.x + (n > 1 ? rand(-26, 26) : 0), c.y + (n > 1 ? rand(-26, 26) : 0), { elite }));
      }
    }
  },
  spawnPoint(p, minDist, r) {
    for (let k = 0; k < 40; k++) {
      const x = rand(ARENA.x1 + 40, ARENA.x2 - 40), y = rand(ARENA.y1 + 40, ARENA.y2 - 40);
      let ok = Math.hypot(x - p.x, y - p.y) > minDist;
      for (const o of this.room.obstacles) if (pointInRect(x, y, o, r + 8)) ok = false;
      if (ok) return { x, y };
    }
    return { x: ARENA.x1 + 60, y: ARENA.y1 + 60 };
  },
  clearRoom(room) {
    room.cleared = true; room.open = true; room.active = false; this.roomsCleared++;
    Sound.play('open'); this.toast('ROOM CLEARED', '#6dff9e');
    const cx = W / 2, cy = H / 2 - 20;
    room.pickups.push({ type: 'orb', x: cx, y: cy, r: 16, t: 0 });
    for (let i = 0; i < randi(3, 6); i++) this.dropPickup('coin', cx, cy);
    if (chance(this.player.hp < this.player.maxHp * 0.6 ? 0.7 : 0.3)) this.dropPickup('heart', cx, cy);
    FX.ring(cx, cy, 10, 100, '#ffe14d', 0.6);
  },
  bossDefeated(b) {
    FX.hitstop = 0.3; FX.addShake(18);
    for (const o of this.enemies) if (o !== b) this.killEnemy(o, true);
    this.ebullets = []; this.hazards = [];
    for (let i = 0; i < 9; i++) this.after(i * 0.17, () => {
      const x = b.x + rand(-b.r, b.r), y = b.y + rand(-b.r, b.r);
      FX.burst(x, y, 20, b.color, 360, 0.7, 4); FX.ring(x, y, 5, 70, '#fff', 0.35); FX.addShake(8); Sound.play('explosion');
    });
    const room = this.room;
    room.cleared = true; room.open = true; room.active = false; this.roomsCleared++;
    this.setBanner('BOSS DEFEATED', b.bdef.name, b.color);
    for (let i = 0; i < 14; i++) this.dropPickup('coin', b.x, b.y);
    for (let i = 0; i < 2; i++) this.dropPickup('heart', b.x, b.y);
    room.pickups.push({ type: 'orb', x: W / 2 - 100, y: H / 2 + 40, r: 16, t: 0 });
    this.boss = null;
    if (this.floorNo >= THEMES.length) this.after(3.2, () => this.win());
    else this.after(1.8, () => {
      room.pickups.push({ type: 'portal', x: W / 2 + 100, y: H / 2 + 40, r: 28, t: 0 });
      Sound.play('open'); this.toast('PORTAL OPENED - DESCEND', '#d65bff');
    });
  },
  nextFloor() {
    this.player.heal(Math.round(this.player.maxHp * 0.3));
    Sound.play('upgrade');
    this.loadFloor(this.floorNo + 1);
  },

  /* ---------------- pickups, upgrades, pedestals ---------------- */
  updatePickups(dt) {
    const p = this.player, list = this.pickups;
    this.near = null;
    let nearD = 1e9;
    for (let i = list.length - 1; i >= 0; i--) {
      const k = list[i]; k.t += dt;
      if (k.type === 'coin' || k.type === 'heart') {
        k.life -= dt;
        if (k.life <= 0) { list.splice(i, 1); continue; }
        k.x += k.vx * dt; k.y += k.vy * dt; const f = Math.exp(-dt * 4); k.vx *= f; k.vy *= f;
        k.x = clamp(k.x, ARENA.x1 + 8, ARENA.x2 - 8); k.y = clamp(k.y, ARENA.y1 + 8, ARENA.y2 - 8);
        const d = Math.hypot(p.x - k.x, p.y - k.y), range = 55 + p.magnet * 110;
        if (d < range && (k.type === 'coin' || p.hp < p.maxHp)) {
          const pull = (1 - d / range) * 700 + 140;
          k.x += (p.x - k.x) / d * pull * dt; k.y += (p.y - k.y) / d * pull * dt;
        }
        if (d < k.r + p.r + 4) {
          if (k.type === 'coin') { p.coins++; Sound.play('coin'); FX.burst(k.x, k.y, 4, '#ffe14d', 120, 0.3, 2); list.splice(i, 1); }
          else if (p.hp < p.maxHp) { p.heal(25); Sound.play('heart'); FX.burst(k.x, k.y, 10, '#6dff9e', 200, 0.4, 3); list.splice(i, 1); }
        }
      } else if (k.type === 'orb') {
        if (Math.hypot(p.x - k.x, p.y - k.y) < k.r + p.r + 6) { list.splice(i, 1); this.openCards(); return; }
      } else if (k.type === 'portal') {
        if (Math.hypot(p.x - k.x, p.y - k.y) < k.r + 4) { list.splice(i, 1); this.nextFloor(); return; }
      } else if (k.type === 'ped') {
        const d = Math.hypot(p.x - k.x, p.y - k.y);
        if (d < 56 && d < nearD) { nearD = d; this.near = k; }
      }
    }
    if (this.near && Input.pressed['KeyE']) this.buy(this.near);
  },
  buy(ped) {
    const p = this.player, it = ped.item;
    if (ped.cost > p.coins) { this.toast('NOT ENOUGH COINS', '#ff5d6c'); Sound.play('warn'); return; }
    p.coins -= ped.cost;
    if (it.kind === 'weapon') this.giveWeapon(it.id);
    else if (it.kind === 'upgrade') this.applyUpgrade(it.id);
    else if (it.kind === 'heal') { p.heal(Math.round(p.maxHp * 0.5)); Sound.play('heart'); }
    else if (it.kind === 'maxhp') { p.maxHp += 20; p.heal(20); Sound.play('upgrade'); }
    FX.ring(ped.x, ped.y, 8, 70, it.color, 0.4); FX.burst(ped.x, ped.y, 16, it.color, 260, 0.6, 3);
    const list = this.room.pickups;
    for (let i = list.length - 1; i >= 0; i--) if (list[i] === ped || (ped.group && list[i].group === ped.group)) list.splice(i, 1);
  },
  giveWeapon(id) {
    const p = this.player;
    if (p.weapons.length < 3) { p.weapons.push(id); p.wi = p.weapons.length - 1; } else p.weapons[p.wi] = id;
    this.toast(WEAPONS[id].name.toUpperCase() + ' EQUIPPED', WEAPONS[id].color); Sound.play('pickup');
  },
  applyUpgrade(id) {
    const u = UPGRADES.find(x => x.id === id), p = this.player;
    p.upg[id] = (p.upg[id] || 0) + 1; u.apply(p);
    this.toast(u.name.toUpperCase(), '#ffe14d'); Sound.play('upgrade');
    FX.ring(p.x, p.y, 10, 90, '#ffe14d', 0.5);
  },
  openCards() {
    const opts = rollUpgrades(this.player, 3);
    if (!opts.length) { this.player.heal(30); return; }
    this.state = 'cards'; Sound.play('pickup');
    UI.showCards('CHOOSE AN UPGRADE', opts.map(u => ({ icon: u.icon, name: u.name, desc: u.desc, rare: !!u.rare, lvl: (this.player.upg[u.id] || 0) + 1 })), i => {
      this.applyUpgrade(opts[i].id); this.state = 'play';
    });
  }
};

