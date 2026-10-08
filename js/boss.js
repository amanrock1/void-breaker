'use strict';
/* ==========================================================
   boss.js  -  three multi-phase bosses built from reusable attacks
   Every attack is a method atk_<name>(dt) that returns true when finished.
   ========================================================== */
class Boss extends Enemy {
  constructor(key, x, y) {
    super('grunt', x, y, { instant: true });
    const b = this.bdef = BOSSES[key];
    this.key = key; this.boss = true; this.def = { ai: 'boss', score: b.score, sides: b.sides, dmg: b.dmg, name: b.name };
    this.maxHp = this.hp = b.hp; this.r = b.r; this.color = b.color; this.dmg = b.dmg;
    this.spawnT = 1.6;          // intro: invulnerable while the banner plays
    this.cd = 1.2; this.cur = null; this.a = {}; this.last = ''; this.phase = 1; this.alpha = 1;
    this.shotDmg = 9 + G.floorNo * 1.5;
  }

  hurt(dmg, o) {
    if (this.spawnT > 0 || this.dead) return;
    super.hurt(dmg, o);
  }

  ring(count, off, speed) {
    for (let i = 0; i < count; i++) G.enemyShot(this.x, this.y, off + i * TAU / count, speed, this.shotDmg, this.color);
  }

  pickAttack() {
    const opts = this.bdef.attacks.filter(a => a[1] <= this.phase && a[0] !== this.last);
    return pick(opts)[0];
  }

  update(dt) {
    if (this.spawnT > 0) { this.spawnT -= dt; this.t += dt; return; }
    this.t += dt; this.hitT -= dt; this.orbCd -= dt;
    const p = G.player, hpf = this.hp / this.maxHp;
    const np = hpf > 0.62 ? 1 : hpf > 0.3 ? 2 : 3;
    if (np > this.phase) {
      this.phase = np; FX.addShake(12); FX.ring(this.x, this.y, this.r, 260, this.color, 0.7);
      Sound.play('boss'); G.toast('PHASE ' + np, this.color);
      this.cur = null; this.cd = 0.9;
    }
    if (!this.cur) {
      // drift around the arena centre
      const tx = W / 2 + Math.cos(this.t * 0.5) * 190, ty = H / 2 + Math.sin(this.t * 0.8) * 90;
      this.x += (tx - this.x) * Math.min(1, dt * 1.2); this.y += (ty - this.y) * Math.min(1, dt * 1.2);
      this.cd -= dt;
      if (this.cd <= 0) { this.cur = this.pickAttack(); this.last = this.cur; this.a = {}; }
    } else if (this['atk_' + this.cur](dt)) {
      this.cur = null; this.cd = rand(0.7, 1.2) / (1 + 0.25 * (this.phase - 1));
    }
    this.face = angTo(this, p);
    this.x = clamp(this.x, ARENA.x1 + this.r, ARENA.x2 - this.r);
    this.y = clamp(this.y, ARENA.y1 + this.r, ARENA.y2 - this.r);
    if (this.alpha > 0.6 && dist(this, p) < this.r + p.r - 2) p.hurt(this.dmg);
  }

  /* ---------- attack library ---------- */
  atk_ring(dt) {
    const a = this.a, total = 2 + this.phase;
    a.t = (a.t || 0) + dt; a.n = a.n || 0;
    if (a.n < total && a.t > 0.5 + a.n * 0.55) {
      this.ring(12 + this.phase * 4, a.n * 0.17, 200 + this.phase * 15);
      a.n++; Sound.play('eshoot2'); FX.addShake(3);
    }
    return a.n >= total && a.t > 0.7 + total * 0.55;
  }
  atk_aimed(dt) {
    const a = this.a, total = 2 + this.phase;
    a.t = (a.t || 0) + dt; a.n = a.n || 0;
    if (a.n < total && a.t > 0.4 + a.n * 0.5) {
      const ang = angTo(this, G.player);
      for (let k = -2; k <= 2; k++) G.enemyShot(this.x, this.y, ang + k * 0.13, 300 + this.phase * 20, this.shotDmg, this.color);
      a.n++; Sound.play('eshoot2');
    }
    return a.n >= total && a.t > 0.6 + total * 0.5;
  }
  atk_spiral(dt) {
    const a = this.a;
    a.t = (a.t || 0) + dt; a.e = (a.e || 0) - dt;
    if (a.t > 0.4 && a.t < 3.3 && a.e <= 0) {
      a.e = 0.075 / (1 + 0.15 * this.phase);
      const arms = 3;
      for (let i = 0; i < arms; i++) G.enemyShot(this.x, this.y, a.t * 2.3 + i * TAU / arms, 175, this.shotDmg * 0.9, this.color);
      if (Math.floor(a.t * 10) % 4 === 0) Sound.play('eshoot');
    }
    return a.t > 3.8;
  }
  atk_beams(dt) {
    const a = this.a, arms = this.phase >= 3 ? 6 : 4;
    a.t = (a.t || 0) + dt; a.e = (a.e || 0) - dt;
    if (a.t > 0.5 && a.t < 3.6 && a.e <= 0) {
      a.e = 0.09;
      const dir = this.phase === 2 ? -1 : 1;
      for (let i = 0; i < arms; i++) G.enemyShot(this.x, this.y, dir * a.t * 1.2 + i * TAU / arms, 210, this.shotDmg * 0.9, this.color);
      if (Math.floor(a.t * 10) % 3 === 0) Sound.play('eshoot');
    }
    return a.t > 4.1;
  }
  atk_charge(dt) {
    const a = this.a, total = this.phase > 1 ? 2 : 1;
    if (a.state === undefined) { a.state = 'wind'; a.st = 0.85; a.ang = angTo(this, G.player); a.k = 0; Sound.play('warn'); }
    a.st -= dt;
    if (a.state === 'wind') {
      if (a.st > 0.25) a.ang = angTo(this, G.player);
      if (a.st <= 0) { a.state = 'go'; a.st = 0.85; a.vx = Math.cos(a.ang) * 640; a.vy = Math.sin(a.ang) * 640; Sound.play('dash'); }
    } else {
      this.x += a.vx * dt; this.y += a.vy * dt;
      if (this.x < ARENA.x1 + this.r) { this.x = ARENA.x1 + this.r; a.vx = Math.abs(a.vx); FX.addShake(6); }
      if (this.x > ARENA.x2 - this.r) { this.x = ARENA.x2 - this.r; a.vx = -Math.abs(a.vx); FX.addShake(6); }
      if (this.y < ARENA.y1 + this.r) { this.y = ARENA.y1 + this.r; a.vy = Math.abs(a.vy); FX.addShake(6); }
      if (this.y > ARENA.y2 - this.r) { this.y = ARENA.y2 - this.r; a.vy = -Math.abs(a.vy); FX.addShake(6); }
      FX.parts.push({ x: this.x, y: this.y, vx: 0, vy: 0, life: 0.35, max: 0.35, size: this.r * 1.1, color: this.color });
      if (a.st <= 0) { a.k++; if (a.k >= total) return true; a.state = 'wind'; a.st = 0.6; a.ang = angTo(this, G.player); Sound.play('warn'); }
    }
    return false;
  }
  atk_summon(dt) {
    const a = this.a;
    a.t = (a.t || 0) + dt;
    if (!a.done && a.t > 0.7) {
      a.done = true;
      const n = 2 + this.phase;
      for (let i = 0; i < n && G.enemies.length < 14; i++) {
        const ang = i * TAU / n + rand(0, 1), type = pick(this.bdef.summon);
        G.enemies.push(new Enemy(type, clamp(this.x + Math.cos(ang) * 110, 90, W - 90), clamp(this.y + Math.sin(ang) * 110, 90, H - 90)));
      }
      FX.ring(this.x, this.y, this.r, 200, this.color, 0.6); Sound.play('open'); FX.addShake(4);
    }
    return a.t > 1.5;
  }
  atk_bombs(dt) {
    const a = this.a, total = 4 + this.phase * 2;
    a.t = (a.t || 0) + dt; a.n = a.n || 0;
    if (a.n < total && a.t > 0.3 + a.n * 0.42) {
      const p = G.player, spread = a.n % 2 ? 90 : 25;
      G.hazards.push({ x: clamp(p.x + rand(-spread, spread), 80, W - 80), y: clamp(p.y + rand(-spread, spread), 80, H - 80), r: 64, t: 0, fuse: 1.0, dmg: 20 + G.floorNo * 3, color: this.color });
      a.n++; Sound.play('warn');
    }
    return a.n >= total && a.t > 0.5 + total * 0.42 + 0.7;
  }
  atk_teleport(dt) {
    const a = this.a, total = 3;
    if (a.state === undefined) { a.state = 'out'; a.st = 0.4; a.k = 0; }
    a.st -= dt;
    if (a.state === 'out') {
      this.alpha = Math.max(0, a.st / 0.4);
      if (a.st <= 0) {
        this.x = rand(ARENA.x1 + 90, ARENA.x2 - 90); this.y = rand(ARENA.y1 + 90, ARENA.y2 - 90);
        a.state = 'in'; a.st = 0.4; FX.ring(this.x, this.y, 10, 120, this.color, 0.4);
      }
    } else if (a.state === 'in') {
      this.alpha = 1 - Math.max(0, a.st / 0.4);
      if (a.st <= 0) {
        this.alpha = 1; this.ring(18 + this.phase * 2, rand(0, TAU), 215);
        Sound.play('eshoot2'); FX.addShake(4);
        a.k++; a.state = a.k >= total ? 'end' : 'wait'; a.st = 0.45;
      }
    } else if (a.state === 'wait') {
      if (a.st <= 0) { a.state = 'out'; a.st = 0.4; }
    } else if (a.st <= 0) return true;
    return false;
  }

  draw(g) {
    const c = this.color, intro = this.spawnT > 0;
    g.globalAlpha = intro ? 0.5 : this.alpha;
    // telegraphs
    if (this.cur === 'charge' && this.a.state === 'wind') {
      g.strokeStyle = 'rgba(255,80,80,' + (0.3 + Math.sin(this.t * 40) * 0.2) + ')'; g.lineWidth = this.r * 1.6;
      g.beginPath(); g.moveTo(this.x, this.y); g.lineTo(this.x + Math.cos(this.a.ang) * 700, this.y + Math.sin(this.a.ang) * 700); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(this.x, this.y + this.r * 0.95, this.r, this.r * 0.4, 0, 0, TAU); g.fill();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha *= 0.55 + Math.sin(this.t * 3) * 0.1;
    g.drawImage(FX.glow(c, 128), this.x - this.r * 3, this.y - this.r * 3, this.r * 6, this.r * 6);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = intro ? 0.5 : this.alpha;

    const flash = this.hitT > 0;
    g.lineJoin = 'round';
    // outer rotating shell
    g.strokeStyle = flash ? '#fff' : c; g.lineWidth = 3;
    polygon(g, this.x, this.y, this.r + 8, this.def.sides, this.t * 0.6); g.stroke();
    polygon(g, this.x, this.y, this.r + 15, this.def.sides, -this.t * 0.4); g.globalAlpha *= 0.4; g.stroke();
    g.globalAlpha = intro ? 0.5 : this.alpha;
    // body
    g.fillStyle = flash ? '#fff' : rgba(c, 0.25); g.lineWidth = 4;
    polygon(g, this.x, this.y, this.r, this.def.sides, this.face * 0.2 + this.t * 0.3); g.fill(); g.stroke();
    // core eye
    const pulse = 0.5 + Math.sin(this.t * 6) * 0.15 + (this.cur ? 0.2 : 0);
    g.fillStyle = flash ? '#fff' : c;
    g.beginPath(); g.arc(this.x + Math.cos(this.face) * 6, this.y + Math.sin(this.face) * 6, this.r * 0.4 * pulse + 6, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(this.x + Math.cos(this.face) * 10, this.y + Math.sin(this.face) * 10, this.r * 0.14, 0, TAU); g.fill();
    g.globalAlpha = 1;
  }
}
