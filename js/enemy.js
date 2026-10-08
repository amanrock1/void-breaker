'use strict';
/* ==========================================================
   enemy.js  -  regular enemies and their AI behaviours
   ========================================================== */
function polygon(g, x, y, r, n, rot) {
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + i * TAU / n;
    if (i === 0) g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.closePath();
}

class Enemy {
  constructor(type, x, y, opts) {
    opts = opts || {};
    const d = this.def = ENEMIES[type];
    this.type = type; this.x = x; this.y = y;
    const fl = G.floorNo || 1, sc = 1 + 0.32 * (fl - 1) + 0.025 * (G.roomsCleared || 0);
    this.elite = !!opts.elite;
    this.maxHp = d.hp * sc * (this.elite ? 2.3 : 1); this.hp = this.maxHp;
    this.r = d.r * (this.elite ? 1.25 : 1);
    this.speed = d.speed * (this.elite ? 1.1 : 1);
    this.dmg = d.dmg * (1 + 0.15 * (fl - 1)) * (this.elite ? 1.3 : 1);
    this.shotDmg = 8 * (1 + 0.16 * (fl - 1));
    this.color = d.color; this.boss = false; this.dead = false;
    this.vx = 0; this.vy = 0; this.kx = 0; this.ky = 0;
    this.spawnT = opts.instant ? 0 : 0.85;
    this.hitT = 0; this.slowT = 0; this.orbCd = 0;
    this.t = rand(0, 10); this.ang = rand(0, TAU); this.face = 0;
    this.state = 'move'; this.st = rand(0.6, 1.6); this.fireT = rand(1, 2.2); this.lockA = 0;
    this.scoreMul = this.elite ? 3 : 1;
  }

  hurt(dmg, o) {
    if (this.spawnT > 0 || this.dead) return;
    o = o || {};
    this.hp -= dmg; this.hitT = 0.08;
    FX.text(this.x, this.y - this.r - 4, String(Math.round(dmg)), o.crit ? '#ffe14d' : '#ffffff', o.crit ? 19 : 12);
    if (o.slow && Math.random() < o.slow) this.slowT = 2.2;
    if (o.knock && !this.boss) {
      const k = o.knock / (this.r > 16 ? 2.2 : 1);
      this.kx += Math.cos(o.ang) * k; this.ky += Math.sin(o.ang) * k;
    }
    FX.burst(this.x, this.y, o.crit ? 8 : 3, this.color, 170, 0.3, 2.2);
    Sound.play('hit');
    if (this.hp <= 0) G.killEnemy(this);
  }

  update(dt) {
    if (this.spawnT > 0) { this.spawnT -= dt; return; }
    this.t += dt; this.hitT -= dt; this.orbCd -= dt;
    if (this.slowT > 0) this.slowT -= dt;
    const sm = this.slowT > 0 ? 0.55 : 1, p = G.player;
    const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
    const sp = this.speed * sm;
    let mvx = 0, mvy = 0;
    this.face = Math.atan2(ny, nx);

    switch (this.def.ai) {
      case 'chase': case 'swarm': {
        let a = this.face;
        if (this.def.ai === 'swarm') a += Math.sin(this.t * 5 + this.ang) * 0.7;
        mvx = Math.cos(a) * sp; mvy = Math.sin(a) * sp;
        break;
      }
      case 'shoot': {
        const dir = d > 270 ? 1 : d < 190 ? -1 : 0, strafe = Math.sin(this.t * 0.9 + this.ang) * 0.7;
        mvx = (nx * dir - ny * strafe) * sp; mvy = (ny * dir + nx * strafe) * sp;
        this.fireT -= dt;
        if (this.fireT <= 0) {
          this.fireT = this.def.fireRate * rand(0.9, 1.25);
          G.enemyShot(this.x, this.y, this.face, 270, this.shotDmg, this.color);
          Sound.play('eshoot');
        }
        break;
      }
      case 'dash': {
        this.st -= dt;
        if (this.state === 'move') {
          const a = this.face + Math.sin(this.t * 2) * 0.8;
          mvx = Math.cos(a) * sp * 0.9; mvy = Math.sin(a) * sp * 0.9;
          if (this.st <= 0 && d < 420) { this.state = 'wind'; this.st = 0.8; this.lockA = this.face; Sound.play('warn'); }
        } else if (this.state === 'wind') {
          if (this.st > 0.3) this.lockA = this.face;
          if (this.st <= 0) { this.state = 'dash'; this.st = 0.42; }
        } else if (this.state === 'dash') {
          mvx = Math.cos(this.lockA) * 560; mvy = Math.sin(this.lockA) * 560;
          if (Math.random() < 0.6) FX.parts.push({ x: this.x, y: this.y, vx: 0, vy: 0, life: 0.25, max: 0.25, size: this.r, color: this.color });
          if (this.st <= 0) { this.state = 'rest'; this.st = 0.8; }
        } else if (this.st <= 0) { this.state = 'move'; this.st = rand(1, 2); }
        break;
      }
      case 'bomber': {
        if (this.state === 'move') {
          mvx = nx * sp; mvy = ny * sp;
          if (d < this.r + p.r + 36) { this.state = 'fuse'; this.st = 0.6; Sound.play('warn'); }
        } else {
          this.st -= dt;
          if (this.st <= 0) { G.killEnemy(this); return; }
        }
        break;
      }
      case 'tank': {
        this.fireT -= dt;
        if (this.state === 'move') {
          mvx = nx * sp; mvy = ny * sp;
          if (this.fireT <= 0) { this.state = 'fire'; this.st = 0.55; Sound.play('warn'); }
        } else {
          this.st -= dt;
          if (this.st <= 0) {
            for (let k = -2; k <= 2; k++) G.enemyShot(this.x, this.y, this.face + k * 0.17, 230, this.shotDmg * 1.1, this.color);
            Sound.play('eshoot2'); FX.addShake(2);
            this.state = 'move'; this.fireT = rand(2.2, 3);
          }
        }
        break;
      }
      case 'turret': {
        this.ang += dt * 0.7 * (G.floorNo >= 3 ? 1.5 : 1);
        this.fireT -= dt;
        if (this.fireT <= 0) {
          this.fireT = G.floorNo >= 3 ? 1.9 : 2.4;
          const n = 8;
          for (let i = 0; i < n; i++) G.enemyShot(this.x, this.y, this.ang + i * TAU / n, 190, this.shotDmg, this.color);
          Sound.play('eshoot2');
        }
        break;
      }
      case 'spawner': {
        const a = this.face + Math.PI / 2 * Math.sin(this.t * 0.3);
        mvx = Math.cos(a) * sp * (d < 220 ? -1 : 0.6); mvy = Math.sin(a) * sp * (d < 220 ? -1 : 0.6);
        this.ang += dt;
        this.fireT -= dt;
        if (this.fireT <= 0 && G.enemies.length < 26) {
          this.fireT = 4.2;
          for (let i = 0; i < 2; i++) G.enemies.push(new Enemy('swarmer', this.x + rand(-26, 26), this.y + rand(-26, 26)));
          FX.ring(this.x, this.y, this.r, this.r * 3, this.color, 0.4); Sound.play('open');
        }
        break;
      }
    }

    this.x += (mvx + this.kx) * dt; this.y += (mvy + this.ky) * dt;
    const kd = Math.exp(-dt * 7); this.kx *= kd; this.ky *= kd;

    // separation from other enemies
    for (const o of G.enemies) {
      if (o === this || o.spawnT > 0 || o.boss) continue;
      const ox = this.x - o.x, oy = this.y - o.y, min = this.r + o.r, dd = Math.hypot(ox, oy);
      if (dd < min && dd > 0.01) { const push = (min - dd) * 0.5; this.x += ox / dd * push; this.y += oy / dd * push; }
    }
    G.constrain(this, false);

    // contact damage
    if (this.dmg > 0 && d < this.r + p.r - 1) p.hurt(this.dmg);
  }

  draw(g) {
    const d = this.def, c = this.color;
    if (this.spawnT > 0) {
      const k = 1 - this.spawnT / 0.85;
      g.strokeStyle = c; g.globalAlpha = 0.3 + k * 0.7; g.lineWidth = 2;
      g.beginPath(); g.arc(this.x, this.y, this.r * (2.2 - k * 1.2), 0, TAU); g.stroke();
      polygon(g, this.x, this.y, this.r * k, d.sides, this.t + k * 6); g.stroke();
      g.globalAlpha = 1; return;
    }
    // telegraphs
    if (this.def.ai === 'dash' && this.state === 'wind') {
      g.strokeStyle = 'rgba(255,225,77,' + (0.35 + Math.sin(this.t * 40) * 0.25) + ')'; g.lineWidth = this.r * 1.4;
      g.beginPath(); g.moveTo(this.x, this.y); g.lineTo(this.x + Math.cos(this.lockA) * 240, this.y + Math.sin(this.lockA) * 240); g.stroke();
    }
    if (this.def.ai === 'bomber' && this.state === 'fuse') {
      const k = 1 - this.st / 0.6;
      g.fillStyle = 'rgba(255,90,40,' + (0.12 + k * 0.25) + ')'; g.strokeStyle = 'rgba(255,140,60,.8)'; g.lineWidth = 2;
      g.beginPath(); g.arc(this.x, this.y, 80, 0, TAU); g.fill(); g.stroke();
    }
    // shadow & glow
    const sc = 2 * (this.r / d.r), floaty = d.ai === 'shoot' || d.ai === 'spawner';
    g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(this.x, this.y + this.r * (floaty ? 1.5 : 1), this.r * (floaty ? 0.8 : 1), this.r * 0.38, 0, 0, TAU); g.fill();
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = this.elite ? 0.6 : 0.24;
    g.drawImage(FX.glow(this.elite ? '#ffd24d' : c, 64), this.x - this.r * 2.4, this.y - this.r * 2.4, this.r * 4.8, this.r * 4.8);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

    const p = G.player, fusing = this.state === 'fuse';
    const flash = this.hitT > 0 || (fusing && Math.floor(this.t * 18) % 2 === 0);
    const wob = Math.sin(this.t * (d.ai === 'swarm' ? 22 : 9) + this.ang);
    const bob = wob * (floaty ? 2.6 : d.ai === 'turret' ? 0 : 1.6);
    let sx = 1 + wob * 0.045, sy = 1 - wob * 0.045;
    if (d.ai === 'spawner') { const pl = 1 + Math.sin(this.t * 4) * 0.06; sx = pl; sy = pl; }
    if (this.state === 'wind' || this.state === 'fire') { sx = 1.12; sy = 0.88; }
    if (fusing) { const k = 1 + (1 - this.st / 0.6) * 0.25; sx = k; sy = k; }
    const look = { x: p.x - this.x, y: p.y - this.y }, flip = p.x < this.x ? -1 : 1;
    if (d.ai === 'turret') {
      for (let i = 0; i < 4; i++) { const a = this.ang + i * TAU / 4; Sprites.draw(g, 'turret_barrel', this.x + Math.cos(a) * 17, this.y + Math.sin(a) * 17, { scale: 2, rot: a, flash }); }
    }
    Sprites.draw(g, this.type, this.x, this.y, { scale: sc, flip, bob, sx, sy, flash, look });
    if (this.elite) {
      g.strokeStyle = 'rgba(255,210,77,.85)'; g.lineWidth = 2; g.setLineDash([5, 4]); g.lineDashOffset = -this.t * 20;
      g.beginPath(); g.arc(this.x, this.y, this.r + 7, 0, TAU); g.stroke(); g.setLineDash([]);
    }
    if (this.slowT > 0) { g.strokeStyle = '#9fe8ff'; g.lineWidth = 1.5; g.beginPath(); g.arc(this.x, this.y, this.r + 3, 0, TAU); g.stroke(); }
    // health bar when damaged
    if (this.hp < this.maxHp) {
      const w = Math.max(22, this.r * 2), bx = this.x - w / 2, by = this.y - this.r - 10;
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(bx - 1, by - 1, w + 2, 5);
      g.fillStyle = c; g.fillRect(bx, by, w * Math.max(0, this.hp / this.maxHp), 3);
    }
  }
}
