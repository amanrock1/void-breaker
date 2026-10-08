'use strict';
/* ==========================================================
   player.js  -  the player ship, weapons and projectiles
   ========================================================== */
class Player {
  constructor() {
    this.x = W / 2; this.y = H / 2; this.r = 11; this.vx = 0; this.vy = 0;
    this.maxHp = 100; this.hp = 100; this.speed = 235;
    // upgrade-driven stats
    this.dmgMul = 1; this.rateMul = 1; this.crit = 0.05; this.multi = 0; this.pierce = 0; this.bounce = 0;
    this.explode = 0; this.homing = 0; this.magnet = 0; this.dashCdMul = 1; this.orbit = 0;
    this.shieldLvl = 0; this.shield = 0; this.shieldT = 0; this.dashBlast = 0; this.slow = 0;
    // state
    this.dashT = 0; this.dashCd = 0; this.dx = 1; this.dy = 0; this.invuln = 0; this.hurtT = 0;
    this.weapons = ['pistol']; this.wi = 0; this.fireT = 0; this.aim = 0;
    this.coins = 0; this.upg = {}; this.orbAng = 0; this.trailT = 0; this.dead = false; this.moving = false;
  }
  get weapon() { return WEAPONS[this.weapons[this.wi]]; }

  heal(n) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    if (this.hp > before) FX.text(this.x, this.y - 22, '+' + Math.round(this.hp - before), '#6dff9e', 14);
  }

  hurt(dmg) {
    if (this.invuln > 0 || this.dead) return false;
    if (this.shield > 0) {
      this.shield = 0; this.shieldT = 12; this.invuln = 0.7;
      FX.ring(this.x, this.y, 14, 60, '#7df9ff', 0.4); Sound.play('shield');
      return false;
    }
    this.hp -= dmg; this.invuln = 0.85; this.hurtT = 0.3;
    FX.addShake(9); FX.hitstop = 0.07; FX.flash = 1;
    FX.burst(this.x, this.y, 16, '#ff5d6c', 280, 0.5, 3);
    FX.text(this.x, this.y - 20, '-' + Math.round(dmg), '#ff5d6c', 16);
    Sound.play('hurt');
    G.combo = 0;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; G.gameOver(); }
    return true;
  }

  update(dt) {
    const I = Input;
    this.aim = Math.atan2(I.mouse.y - this.y, I.mouse.x - this.x);
    let mx = (I.down('KeyD') || I.down('ArrowRight') ? 1 : 0) - (I.down('KeyA') || I.down('ArrowLeft') ? 1 : 0);
    let my = (I.down('KeyS') || I.down('ArrowDown') ? 1 : 0) - (I.down('KeyW') || I.down('ArrowUp') ? 1 : 0);
    const ml = Math.hypot(mx, my);
    if (ml > 0) { mx /= ml; my /= ml; }
    this.moving = ml > 0;

    // dash
    this.dashCd -= dt;
    if ((I.pressed['Space'] || I.pressed['ShiftLeft'] || I.pressed['ShiftRight']) && this.dashCd <= 0 && this.dashT <= 0) {
      this.dashT = 0.17;
      this.dx = ml > 0 ? mx : Math.cos(this.aim); this.dy = ml > 0 ? my : Math.sin(this.aim);
      this.dashCd = 1.1 * this.dashCdMul;
      this.invuln = Math.max(this.invuln, 0.3);
      Sound.play('dash');
      if (this.dashBlast) this.doDashBlast();
    }
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dx * 780; this.vy = this.dy * 780;
      this.trailT -= dt;
      if (this.trailT <= 0) { this.trailT = 0.02; FX.parts.push({ x: this.x, y: this.y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: 14, color: '#7df9ff' }); }
    } else {
      const k = Math.min(1, (ml > 0 ? 14 : 10) * dt);
      this.vx = lerp(this.vx, mx * this.speed, k); this.vy = lerp(this.vy, my * this.speed, k);
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    G.constrain(this, true);

    // weapon switching
    for (let i = 0; i < 3; i++) if (I.pressed['Digit' + (i + 1)] && this.weapons[i]) this.switchTo(i);
    if (I.pressed['KeyQ']) this.switchTo((this.wi + 1) % this.weapons.length);
    if (I.wheel) this.switchTo((this.wi + I.wheel + this.weapons.length * 8) % this.weapons.length);

    // shooting
    this.fireT -= dt;
    if (I.mouse.down && this.fireT <= 0) this.fire();

    // shield
    if (this.shieldLvl && this.shield <= 0) {
      this.shieldT -= dt * (this.shieldLvl > 1 ? 1.6 : 1);
      if (this.shieldT <= 0) { this.shield = 1; Sound.play('shield'); FX.ring(this.x, this.y, 10, 40, '#7df9ff', 0.4); }
    }
    this.orbAng += dt * 4.2;
    this.invuln -= dt; this.hurtT -= dt;
  }

  switchTo(i) {
    if (i !== this.wi) { this.wi = i; this.fireT = Math.max(this.fireT, 0.12); Sound.play('click'); }
  }

  doDashBlast() {
    const R = 70 + this.dashBlast * 25;
    FX.ring(this.x, this.y, 10, R, '#7df9ff', 0.35);
    for (const e of G.enemies) {
      const d = dist(e, this); if (d > R + e.r) continue;
      const a = angTo(this, e);
      e.hurt(14 * this.dmgMul * this.dashBlast, { ang: a, knock: 520 });
    }
  }

  fire() {
    const w = this.weapon, n = w.pellets + this.multi;
    for (let i = 0; i < n; i++) {
      const a = this.aim + (n > 1 ? (i - (n - 1) / 2) * w.fan : 0) + rand(-w.spread, w.spread);
      const crit = Math.random() < this.crit;
      let dmg = w.dmg * this.dmgMul * (1 - 0.07 * this.multi);
      if (crit) dmg *= 2.5;
      const b = new Bullet(this.x + Math.cos(this.aim) * w.muzzle, this.y + 2 + Math.sin(this.aim) * w.muzzle, a, w.speed, dmg, true);
      b.r = w.size; b.color = crit ? '#ffffff' : w.color; b.glowColor = w.color; b.life = w.life;
      b.pierce = (w.pierce || 0) + this.pierce; b.bounce = this.bounce;
      b.explode = Math.max(w.explode || 0, this.explode ? 38 + this.explode * 16 : 0);
      b.explodeFull = !!w.explode;
      b.homing = this.homing; b.crit = crit; b.slow = this.slow; b.knock = w.kick * 0.9;
      G.bullets.push(b);
    }
    this.fireT = 1 / (w.rate * this.rateMul);
    Sound.play(w.sfx); FX.addShake(w.shake);
    const mx = this.x + Math.cos(this.aim) * w.muzzle, my = this.y + 2 + Math.sin(this.aim) * w.muzzle;
    FX.spark(mx, my, this.aim, 3, w.color, 240);
    this.vx -= Math.cos(this.aim) * w.kick * 0.25; this.vy -= Math.sin(this.aim) * w.kick * 0.25;
  }

  orbitBlades() {
    const out = [];
    for (let k = 0; k < this.orbit; k++) {
      const a = this.orbAng + k * TAU / this.orbit;
      out.push({ x: this.x + Math.cos(a) * 54, y: this.y + Math.sin(a) * 54, r: 11, a });
    }
    return out;
  }

  draw(g) {
    const flick = this.invuln > 0 && Math.floor(this.invuln * 25) % 2 === 0 && this.hurtT > 0;
    if (flick) return;
    const dashing = this.dashT > 0, moving = this.moving || dashing;
    const flip = Math.cos(this.aim) < 0 ? -1 : 1;
    const bob = moving ? -Math.abs(Math.sin(G.anim * 15)) * 3 : Math.sin(G.anim * 3) * 0.8;
    // shadow + glow
    g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(this.x, this.y + 17, 12, 4.5, 0, 0, TAU); g.fill();
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.28;
    g.drawImage(FX.glow('#7df9ff', 64), this.x - 38, this.y - 38, 76, 76);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const gun = 'gun_' + this.weapons[this.wi], behind = Math.sin(this.aim) < -0.45;
    const gy = this.y + 3 + bob * 0.6, kick = Math.max(0, this.fireT * 0.6) * 2;
    if (behind) Sprites.drawGun(g, gun, this.x - Math.cos(this.aim) * kick, gy - Math.sin(this.aim) * kick, this.aim);
    Sprites.draw(g, 'player', this.x, this.y + 2, {
      scale: 2, flip, bob, flash: dashing || this.hurtT > 0.22,
      sx: dashing ? 1.25 : 1 + (moving ? Math.sin(G.anim * 30) * 0.03 : 0), sy: dashing ? 0.85 : 1,
      rot: moving ? Math.sin(G.anim * 15) * 0.07 : 0
    });
    if (!behind) Sprites.drawGun(g, gun, this.x - Math.cos(this.aim) * kick, gy - Math.sin(this.aim) * kick, this.aim);
    // shield
    if (this.shield > 0) {
      g.strokeStyle = 'rgba(125,249,255,' + (0.5 + Math.sin(G.anim * 6) * 0.2) + ')'; g.lineWidth = 2;
      g.beginPath(); g.arc(this.x, this.y, 20, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(125,249,255,.08)'; g.fill();
    }
    // orbital blades
    for (const o of this.orbitBlades()) {
      g.save(); g.translate(o.x, o.y); g.rotate(o.a * 3);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.6; g.drawImage(FX.glow('#ff5d6c', 64), -22, -22, 44, 44);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#ffd0d6'; g.strokeStyle = '#ff5d6c'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(11, 0); g.lineTo(-3, 5); g.lineTo(-3, -5); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
  }
}

/* ---------------- Bullets (player + enemy) ---------------- */
class Bullet {
  constructor(x, y, a, sp, dmg, friendly) {
    this.x = x; this.y = y; this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
    this.dmg = dmg; this.friendly = friendly; this.r = 4; this.life = 1.2;
    this.color = '#fff'; this.glowColor = null; this.pierce = 0; this.bounce = 0; this.explode = 0; this.explodeFull = false;
    this.homing = 0; this.hit = null; this.dead = false; this.slow = 0; this.crit = false; this.knock = 0; this.tr = 0;
  }

  detonate() {
    if (!this.explode) return;
    G.explosion(this.x, this.y, this.explode, this.dmg * (this.explodeFull ? 1 : 0.7), { enemies: true, player: false });
    this.explode = 0;
  }
  kill() { this.detonate(); this.dead = true; }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.kill(); return; }

    if (this.homing && this.friendly) {
      let best = null, bd = 300;
      for (const e of G.enemies) {
        if (e.spawnT > 0) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const sp = Math.hypot(this.vx, this.vy), cur = Math.atan2(this.vy, this.vx);
        let diff = Math.atan2(best.y - this.y, best.x - this.x) - cur;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        const na = cur + clamp(diff, -this.homing * 2.6 * dt, this.homing * 2.6 * dt);
        this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
      }
    }

    const steps = Math.max(1, Math.ceil(Math.hypot(this.vx, this.vy) * dt / 9)), sdt = dt / steps;
    for (let s = 0; s < steps && !this.dead; s++) {
      const px = this.x;
      this.x += this.vx * sdt;
      if (this.wallHit('x', px)) return;
      const py = this.y;
      this.y += this.vy * sdt;
      if (this.wallHit('y', py)) return;
      if (this.friendly) this.hitEnemies(); else this.hitPlayer();
    }
    if (this.friendly && this.life > 0) {
      this.tr -= dt;
      if (this.tr <= 0) { this.tr = 0.03; FX.parts.push({ x: this.x, y: this.y, vx: 0, vy: 0, life: 0.18, max: 0.18, size: this.r * 1.3, color: this.glowColor || this.color }); }
    }
  }

  /* axis = 'x' | 'y', prev = coordinate before the move. Returns true if the bullet was destroyed. */
  wallHit(axis, prev) {
    let hit = false;
    const r = this.r;
    if (axis === 'x') {
      if (this.x < ARENA.x1 + r || this.x > ARENA.x2 - r) { this.x = clamp(this.x, ARENA.x1 + r, ARENA.x2 - r); hit = true; }
    } else if (this.y < ARENA.y1 + r || this.y > ARENA.y2 - r) {
      this.y = clamp(this.y, ARENA.y1 + r, ARENA.y2 - r); hit = true;
    }
    if (!hit) {
      for (const o of G.room.obstacles) {
        if (pointInRect(this.x, this.y, o, r * 0.6)) { hit = true; if (axis === 'x') this.x = prev; else this.y = prev; break; }
      }
    }
    if (!hit) return false;
    FX.spark(this.x, this.y, Math.atan2(-this.vy, -this.vx), 4, this.glowColor || this.color, 160);
    if (this.bounce > 0 && this.friendly) {
      this.bounce--;
      if (axis === 'x') this.vx = -this.vx; else this.vy = -this.vy;
      Sound.play('click');
      return false;
    }
    this.kill();
    return true;
  }

  hitEnemies() {
    for (const e of G.enemies) {
      if (e.spawnT > 0 || e.dead) continue;
      const rr = e.r + this.r;
      if ((e.x - this.x) * (e.x - this.x) + (e.y - this.y) * (e.y - this.y) > rr * rr) continue;
      if (this.hit && this.hit.has(e)) continue;
      const ang = Math.atan2(this.vy, this.vx);
      e.hurt(this.dmg, { ang, knock: this.knock, crit: this.crit, slow: this.slow });
      FX.spark(this.x, this.y, ang + Math.PI, 3, this.color, 200);
      if (this.pierce > 0) {
        this.pierce--; (this.hit = this.hit || new Set()).add(e);
      } else { this.kill(); return; }
    }
  }

  hitPlayer() {
    const p = G.player, rr = p.r + this.r - 2;
    if ((p.x - this.x) * (p.x - this.x) + (p.y - this.y) * (p.y - this.y) < rr * rr) {
      if (p.invuln > 0 && p.dashT > 0) return; // dash i-frames: bullets pass through
      p.hurt(this.dmg);
      this.dead = true;
    }
  }

  draw(g) {
    const sp = Math.hypot(this.vx, this.vy) || 1, ux = this.vx / sp, uy = this.vy / sp;
    const c = this.glowColor || this.color;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.7;
    const gs = this.r * 5;
    g.drawImage(FX.glow(c, 64), this.x - gs, this.y - gs, gs * 2, gs * 2);
    g.globalAlpha = 1;
    g.strokeStyle = c; g.lineCap = 'round'; g.lineWidth = this.r * 1.5;
    const len = this.friendly ? (this.explodeFull ? 0.012 : 0.026) * sp : 0.012 * sp;
    g.beginPath(); g.moveTo(this.x - ux * len, this.y - uy * len); g.lineTo(this.x, this.y); g.stroke();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = this.friendly ? '#fff' : '#ffe6ea';
    g.beginPath(); g.arc(this.x, this.y, this.r * 0.65, 0, TAU); g.fill();
  }
}
