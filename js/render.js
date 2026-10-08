'use strict';
/* ==========================================================
   render.js  -  everything drawn on the canvas: world, HUD, minimap
   ========================================================== */
const Render = {
  ctx: null, vignette: null, stars: [], bubbles: [],

  init(ctx) {
    this.ctx = ctx;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), gr = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.65)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    this.vignette = c;
    for (let i = 0; i < 44; i++) this.bubbles.push({ x: rand(0, W), y: rand(0, H), r: rand(1.5, 5), s: rand(14, 42), ph: rand(0, 6) });
    for (let i = 0; i < 0; i++) this.stars.push({ x: rand(0, W), y: rand(0, H), s: rand(0.3, 1.4), c: pick(['#38e1ff', '#4de1ff', '#5dff8a', '#ff5d6c']), z: rand(0.2, 1) });
  },

  draw() {
    const g = this.ctx, s = G.state;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (!G.room || s === 'title') { this.drawTitleBg(g); return; }

    const sh = FX.shake, ox = sh ? rand(-sh, sh) : 0, oy = sh ? rand(-sh, sh) : 0;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.save(); g.translate(ox, oy);
    g.drawImage(G.room.bg, 0, 0);
    this.drawDoors(g);
    this.drawHints(g);
    this.drawHazards(g);
    this.drawPickups(g);
    for (const e of G.enemies) e.draw(g);
    if (s !== 'dying' && s !== 'over') G.player.draw(g);
    for (const b of G.bullets) b.draw(g);
    for (const b of G.ebullets) b.draw(g);
    this.drawWater(g);
    FX.drawBelow(g);
    FX.drawText(g);
    g.restore();

    g.drawImage(this.vignette, 0, 0);
    if (FX.flash > 0) { g.fillStyle = 'rgba(255,40,60,' + FX.flash * 0.28 + ')'; g.fillRect(0, 0, W, H); }
    if (G.player.hp < G.player.maxHp * 0.3 && s === 'play') {
      g.fillStyle = 'rgba(255,0,40,' + (0.05 + Math.sin(G.anim * 6) * 0.04) + ')'; g.fillRect(0, 0, W, H);
    }
    this.drawHUD(g);
    this.drawBanner(g);
    if (G.fade > 0) { g.fillStyle = 'rgba(0,0,0,' + G.fade + ')'; g.fillRect(0, 0, W, H); }
  },

  /* underwater overlay: tint, drifting light rays, rising bubbles */
  drawWater(g) {
    const t = G.anim, th = G.theme;
    g.fillStyle = th.tint; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x = ((i * 260 + t * 12) % (W + 360)) - 180, gr = g.createLinearGradient(x, 0, x - 120, H);
      gr.addColorStop(0, rgba(th.edge, 0.07)); gr.addColorStop(1, rgba(th.edge, 0));
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 90, 0); g.lineTo(x - 90, H); g.lineTo(x - 220, H); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    for (const b of this.bubbles) {
      const y = (((b.y - t * b.s) % (H + 20)) + H + 20) % (H + 20) - 10, x = b.x + Math.sin(t * 0.9 + b.ph) * 9;
      g.strokeStyle = 'rgba(210,240,255,.28)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, b.r, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x - b.r * 0.4, y - b.r * 0.5, 1.5, 1.5);
    }
  },

  /* animated menu background */
  drawTitleBg(g) {
    const t = G.anim, gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#0c4a6e'); gr.addColorStop(0.55, '#06203a'); gr.addColorStop(1, '#020812');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const x = ((i * 190 + t * 10) % (W + 300)) - 150, rg = g.createLinearGradient(x, 0, x - 160, H);
      rg.addColorStop(0, 'rgba(120,220,255,.12)'); rg.addColorStop(1, 'rgba(120,220,255,0)');
      g.fillStyle = rg; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 70, 0); g.lineTo(x - 130, H); g.lineTo(x - 260, H); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    const crew = [['grunt', 0.9, 120, 3], ['swarmer', 1.4, 230, 3], ['shooter', 0.4, 330, 3], ['dasher', 1.8, 420, 3], ['bomber', 0.6, 190, 3], ['tank', 0.5, 520, 3], ['swarmer', 1.1, 460, 3], ['player', 1.2, 300, 3]];
    crew.forEach((c, i) => {
      const dir = i % 2 ? -1 : 1, span = W + 200, x = dir > 0 ? ((i * 211 + t * 28 * c[1]) % span) - 100 : W + 100 - ((i * 173 + t * 28 * c[1]) % span);
      Sprites.draw(g, c[0], x, c[2] + Math.sin(t * 0.8 + i) * 12, { scale: c[3], flip: dir, alpha: c[0] === 'player' ? 0.9 : 0.3 });
    });
    for (const b of this.bubbles) {
      const y = (((b.y - t * b.s) % (H + 20)) + H + 20) % (H + 20) - 10, x = b.x + Math.sin(t * 0.9 + b.ph) * 9;
      g.strokeStyle = 'rgba(210,240,255,.35)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, b.r * 1.3, 0, TAU); g.stroke();
    }
    g.drawImage(this.vignette, 0, 0);
  },

  drawDoors(g) {
    const r = G.room, dd = DOOR_HALF, t = G.anim, edge = G.theme.edge;
    const defs = {
      n: { x: W / 2 - dd, y: ARENA.y1 - 4, w: dd * 2, h: 8, ax: W / 2, ay: ARENA.y1 - 20, rot: -Math.PI / 2 },
      s: { x: W / 2 - dd, y: ARENA.y2 - 4, w: dd * 2, h: 8, ax: W / 2, ay: ARENA.y2 + 20, rot: Math.PI / 2 },
      w: { x: ARENA.x1 - 4, y: H / 2 - dd, w: 8, h: dd * 2, ax: ARENA.x1 - 20, ay: H / 2, rot: Math.PI },
      e: { x: ARENA.x2 - 4, y: H / 2 - dd, w: 8, h: dd * 2, ax: ARENA.x2 + 20, ay: H / 2, rot: 0 }
    };
    g.globalCompositeOperation = 'lighter';
    for (const k in r.doors) {
      const d = defs[k];
      if (r.open) {
        const a = 0.35 + Math.sin(t * 5) * 0.2;
        g.fillStyle = rgba('#6dff9e', a * 0.5); g.fillRect(d.x, d.y, d.w, d.h);
        g.save(); g.translate(d.ax, d.ay); g.rotate(d.rot); g.strokeStyle = rgba('#6dff9e', a + 0.2); g.lineWidth = 3;
        g.beginPath(); g.moveTo(-5, -8); g.lineTo(5, 0); g.lineTo(-5, 8); g.stroke(); g.restore();
      } else {
        g.fillStyle = 'rgba(255,60,80,' + (0.45 + Math.sin(t * 12) * 0.15) + ')';
        g.fillRect(d.x, d.y, d.w, d.h);
        g.strokeStyle = 'rgba(255,90,100,.35)'; g.lineWidth = 2;
        g.strokeRect(d.x - (d.w < d.h ? 6 : 0), d.y - (d.h < d.w ? 6 : 0), d.w + (d.w < d.h ? 12 : 0), d.h + (d.h < d.w ? 12 : 0));
      }
    }
    g.globalCompositeOperation = 'source-over';
  },

  drawHints(g) {
    const r = G.room;
    if (r.type === 'start' && G.floorNo === 1) {
      g.textAlign = 'center'; g.font = 'bold 14px Orbitron, "Segoe UI", sans-serif';
      g.fillStyle = 'rgba(125,249,255,.75)';
      g.fillText('WASD - SWIM     MOUSE - AIM & FIRE     SPACE - BOOST', W / 2, H / 2 - 110);
      g.fillStyle = 'rgba(125,249,255,.45)'; g.font = '12px Orbitron, "Segoe UI", sans-serif';
      g.fillText('Swim through a lit gap to begin. Gates seal until the room is cleared.', W / 2, H / 2 - 88);
    }
    if (r.type === 'treasure') { g.textAlign = 'center'; g.font = 'bold 16px Orbitron, sans-serif'; g.fillStyle = 'rgba(255,225,77,.8)'; g.fillText('TREASURE ROOM  -  TAKE ONE', W / 2, H / 2 - 70); }
    if (r.type === 'shop') { g.textAlign = 'center'; g.font = 'bold 16px Orbitron, sans-serif'; g.fillStyle = 'rgba(109,255,158,.8)'; g.fillText('SALVAGE SHOP  -  SPEND YOUR COINS', W / 2, H / 2 - 70); }
  },

  drawHazards(g) {
    for (const h of G.hazards) {
      const k = h.t / h.fuse;
      g.fillStyle = rgba(h.color, 0.08 + k * 0.28); g.strokeStyle = rgba(h.color, 0.5 + 0.5 * Math.sin(h.t * 25));
      g.lineWidth = 2;
      g.beginPath(); g.arc(h.x, h.y, h.r, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = rgba(h.color, 0.35);
      g.beginPath(); g.arc(h.x, h.y, h.r * k, 0, TAU); g.fill();
    }
  },

  drawPickups(g) {
    const t = G.anim;
    for (const k of G.pickups) {
      const bob = Math.sin(k.t * 4) * 2;
      switch (k.type) {
        case 'coin': {
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5;
          g.drawImage(FX.glow('#ffe14d', 64), k.x - 14, k.y - 14, 28, 28);
          g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
          Sprites.draw(g, 'coin', k.x, k.y + bob, { scale: 1.5, sx: Math.abs(Math.cos(k.t * 5)) * 0.8 + 0.2 });
          break;
        }
        case 'heart': {
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; g.drawImage(FX.glow('#ff5d7a', 64), k.x - 18, k.y - 18, 36, 36);
          g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
          Sprites.draw(g, 'heart', k.x, k.y + bob, { scale: 1.5, sy: 1 + Math.sin(k.t * 7) * 0.08, sx: 1 + Math.sin(k.t * 7) * 0.08 });
          break;
        }
        case 'orb': {
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.7;
          g.drawImage(FX.glow('#ffe14d', 128), k.x - 50, k.y - 50, 100, 100);
          g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
          g.strokeStyle = '#ffe14d'; g.lineWidth = 2.5; g.fillStyle = 'rgba(255,225,77,.25)';
          polygon(g, k.x, k.y + bob, 14, 4, t * 2); g.fill(); g.stroke();
          polygon(g, k.x, k.y + bob, 9, 4, -t * 3); g.stroke();
          g.fillStyle = '#ffe14d'; g.font = 'bold 11px Orbitron, sans-serif'; g.textAlign = 'center'; g.fillText('UPGRADE', k.x, k.y - 28);
          break;
        }
        case 'portal': {
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.8; g.drawImage(FX.glow('#4de1ff', 128), k.x - 70, k.y - 70, 140, 140);
          g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
          for (let i = 0; i < 4; i++) {
            g.strokeStyle = rgba('#4de1ff', 0.9 - i * 0.18); g.lineWidth = 3 - i * 0.5;
            g.beginPath(); g.ellipse(k.x, k.y, 30 - i * 6, 30 - i * 6, t * (1 + i * 0.5), 0.2, TAU - 0.4); g.stroke();
          }
          g.fillStyle = '#4de1ff'; g.font = 'bold 11px Orbitron, sans-serif'; g.textAlign = 'center'; g.fillText('NEXT DEPTH', k.x, k.y - 44);
          break;
        }
        case 'ped': {
          const it = k.item, near = G.near === k, afford = k.cost <= G.player.coins;
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = near ? 0.7 : 0.4; g.drawImage(FX.glow(it.color, 128), k.x - 48, k.y - 48, 96, 96);
          g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
          g.fillStyle = '#0a0f1a'; g.strokeStyle = it.color; g.lineWidth = 2.5;
          g.beginPath(); g.ellipse(k.x, k.y + 16, 22, 8, 0, 0, TAU); g.fill(); g.stroke();
          g.font = '24px "Segoe UI Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(it.icon, k.x, k.y - 4 + Math.sin(k.t * 3) * 3);
          g.textBaseline = 'alphabetic';
          g.font = 'bold 11px Orbitron, "Segoe UI", sans-serif'; g.fillStyle = it.color;
          g.fillText(it.name.toUpperCase(), k.x, k.y + 38);
          if (k.cost > 0) { g.fillStyle = afford ? '#ffe14d' : '#ff5d6c'; g.fillText(k.cost + ' COINS', k.x, k.y + 52); }
          else { g.fillStyle = '#9fb3c8'; g.font = '10px Orbitron, "Segoe UI", sans-serif'; g.fillText('FREE', k.x, k.y + 52); }
          if (near) {
            g.fillStyle = 'rgba(8,12,22,.92)'; g.strokeStyle = it.color; g.lineWidth = 1.5;
            const bw = 230, bx = clamp(k.x - bw / 2, 10, W - bw - 10), by = k.y - 92;
            g.fillRect(bx, by, bw, 46); g.strokeRect(bx, by, bw, 46);
            g.fillStyle = '#fff'; g.font = '11px "Segoe UI", sans-serif'; g.fillText(it.desc, bx + bw / 2, by + 18);
            g.fillStyle = it.color; g.font = 'bold 11px Orbitron, sans-serif'; g.fillText('[E]  TAKE', bx + bw / 2, by + 36);
          }
          break;
        }
      }
    }
    g.textAlign = 'left';
  },

  /* ---------------- HUD ---------------- */
  drawHUD(g) {
    const p = G.player, F = 'Orbitron, "Segoe UI", sans-serif';
    g.textBaseline = 'alphabetic';
    // top-left info
    g.textAlign = 'left';
    g.font = 'bold 15px ' + F; g.fillStyle = G.theme.edge;
    g.fillText(G.theme.name, 18, 24);
    g.font = '11px ' + F; g.fillStyle = 'rgba(255,255,255,.55)';
    g.fillText('FLOOR ' + G.floorNo + '/' + THEMES.length + '   -   ' + fmtTime(G.runTime), 18, 40);
    g.font = 'bold 20px ' + F; g.fillStyle = '#fff'; g.fillText(String(G.score).padStart(7, '0'), 18, 66);
    if (G.combo > 1) {
      g.font = 'bold 13px ' + F; g.fillStyle = '#ffe14d';
      g.fillText('x' + (1 + Math.min(G.combo, 20) * 0.1).toFixed(1) + ' COMBO', 18, 84);
      g.fillStyle = 'rgba(255,225,77,.5)'; g.fillRect(18, 90, 90 * clamp(G.comboT / 3, 0, 1), 3);
    }
    // coins
    g.font = 'bold 14px ' + F; g.fillStyle = '#ffe14d'; g.fillText('● ' + p.coins, 18, G.combo > 1 ? 114 : 92);
    // upgrade icons
    const ups = UPGRADES.filter(u => p.upg[u.id]);
    g.font = '15px "Segoe UI Emoji", sans-serif';
    ups.forEach((u, i) => {
      const x = 18 + (i % 10) * 24, y = H - 92 - Math.floor(i / 10) * 24;
      g.globalAlpha = 0.9; g.fillStyle = '#fff'; g.fillText(u.icon, x, y);
      if (p.upg[u.id] > 1) { g.font = 'bold 9px ' + F; g.fillStyle = '#ffe14d'; g.fillText(p.upg[u.id], x + 12, y + 4); g.font = '15px "Segoe UI Emoji", sans-serif'; }
    });
    g.globalAlpha = 1;
    // HP bar
    const bx = 18, by = H - 62, bw = 230;
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(bx - 2, by - 2, bw + 4, 20);
    const hf = clamp(p.hp / p.maxHp, 0, 1), hc = hf > 0.5 ? '#6dff9e' : hf > 0.25 ? '#ffb347' : '#ff5d6c';
    g.fillStyle = hc; g.fillRect(bx, by, bw * hf, 16);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(bx, by, bw * hf, 6);
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.strokeRect(bx - 2, by - 2, bw + 4, 20);
    g.font = 'bold 11px ' + F; g.fillStyle = '#fff'; g.textAlign = 'left';
    g.fillText(Math.ceil(p.hp) + ' / ' + p.maxHp, bx + 6, by + 12);
    if (p.shieldLvl) { g.fillStyle = p.shield > 0 ? '#7df9ff' : 'rgba(125,249,255,.25)'; g.fillText('SHIELD', bx + bw - 52, by + 12); }
    // dash bar
    const dc = p.dashCd <= 0;
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(bx - 2, by + 22, bw + 4, 10);
    g.fillStyle = dc ? '#7df9ff' : '#2a6a7a'; g.fillRect(bx, by + 24, bw * (dc ? 1 : 1 - clamp(p.dashCd / (1.1 * p.dashCdMul), 0, 1)), 6);
    g.font = '9px ' + F; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(dc ? 'DASH READY [SPACE]' : 'DASH', bx + 4, by + 30);

    // weapon slots
    const n = 3, sw = 118, gap = 8, total = n * sw + (n - 1) * gap, sx = W / 2 - total / 2 + 60, sy = H - 52;
    for (let i = 0; i < n; i++) {
      const wk = p.weapons[i], x = sx + i * (sw + gap), cur = i === p.wi;
      g.fillStyle = cur ? 'rgba(10,20,34,.9)' : 'rgba(0,0,0,.5)'; g.fillRect(x, sy, sw, 38);
      const col = wk ? WEAPONS[wk].color : '#334';
      g.strokeStyle = cur ? col : 'rgba(255,255,255,.18)'; g.lineWidth = cur ? 2 : 1; g.strokeRect(x, sy, sw, 38);
      g.fillStyle = 'rgba(255,255,255,.4)'; g.font = 'bold 10px ' + F; g.textAlign = 'left'; g.fillText(String(i + 1), x + 5, sy + 13);
      if (wk) {
        g.fillStyle = cur ? col : 'rgba(255,255,255,.6)'; g.font = 'bold 10px ' + F; g.fillText(WEAPONS[wk].name.toUpperCase(), x + 18, sy + 14);
        if (cur) {
          const w = WEAPONS[wk], dps = Math.round(w.dmg * (w.pellets + p.multi) * w.rate * p.rateMul * p.dmgMul);
          g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '9px ' + F; g.fillText('DPS ' + dps, x + 18, sy + 30);
        }
      } else { g.fillStyle = 'rgba(255,255,255,.18)'; g.font = '10px ' + F; g.fillText('EMPTY', x + 18, sy + 24); }
    }

    this.drawMinimap(g);

    // boss bar
    const b = G.boss;
    if (b) {
      const w = 460, x = W / 2 - w / 2, y = 18;
      g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x - 3, y - 3, w + 6, 20);
      const k = clamp(b.hp / b.maxHp, 0, 1);
      g.fillStyle = b.color; g.fillRect(x, y, w * k, 14);
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x, y, w * k, 5);
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(x - 3, y - 3, w + 6, 20);
      g.fillStyle = 'rgba(255,255,255,.7)';
      for (const m of [0.3, 0.62]) g.fillRect(x + w * m - 1, y - 3, 2, 20);
      g.textAlign = 'center'; g.font = 'bold 12px ' + F; g.fillStyle = '#fff';
      g.fillText(b.bdef.name, W / 2, y + 36);
    }

    // toasts
    g.textAlign = 'center';
    G.toasts.forEach((t, i) => {
      const a = t.t < 0.2 ? t.t / 0.2 : t.t > 1.7 ? Math.max(0, (2.2 - t.t) / 0.5) : 1;
      g.globalAlpha = a; g.font = 'bold 15px ' + F;
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(t.text, W / 2, 112 + i * 22 - (1 - a) * 6);
      g.fillStyle = t.color; g.fillText(t.text, W / 2, 112 + i * 22 - (1 - a) * 6);
    });
    g.globalAlpha = 1;

    // aim crosshair
    if (G.state === 'play') {
      const m = Input.mouse;
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(m.x, m.y, 9, 0, TAU); g.moveTo(m.x - 15, m.y); g.lineTo(m.x - 5, m.y); g.moveTo(m.x + 5, m.y); g.lineTo(m.x + 15, m.y);
      g.moveTo(m.x, m.y - 15); g.lineTo(m.x, m.y - 5); g.moveTo(m.x, m.y + 5); g.lineTo(m.x, m.y + 15); g.stroke();
    }
  },

  drawMinimap(g) {
    const f = G.floor, cw = 17, ch = 12, ox = W - 18 - 5 * cw - 8, oy = 16;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(ox - 8, oy - 8, 5 * cw + 16 + 0, 5 * ch + 16);
    g.strokeStyle = 'rgba(255,255,255,.2)'; g.strokeRect(ox - 8, oy - 8, 5 * cw + 16, 5 * ch + 16);
    const show = r => {
      if (r.visited) return true;
      for (const k in r.doors) { const d = DIRS[k], nb = f.get(r.gx + d.dx, r.gy + d.dy); if (nb && nb.visited) return true; }
      return false;
    };
    for (const r of f.list) {
      if (!show(r)) continue;
      const x = ox + r.gx * cw, y = oy + r.gy * ch;
      for (const k in r.doors) {
        const hasN = (f.get(r.gx + DIRS[k].dx, r.gy + DIRS[k].dy)); if (!hasN || !(hasN.visited || r.visited)) continue;
        g.fillStyle = 'rgba(255,255,255,.35)';
        if (k === 'e') g.fillRect(x + cw - 4, y + ch / 2 - 1, 5, 2); if (k === 's') g.fillRect(x + cw / 2 - 1, y + ch - 3, 2, 4);
      }
      let col = 'rgba(255,255,255,.28)';
      if (r.visited) col = r.cleared ? 'rgba(125,249,255,.55)' : 'rgba(255,255,255,.8)';
      if (r.type === 'boss') col = r.visited ? '#ff5d6c' : 'rgba(255,93,108,.55)';
      if (r.type === 'treasure') col = '#ffe14d';
      if (r.type === 'shop') col = '#6dff9e';
      g.fillStyle = col; g.fillRect(x, y, cw - 5, ch - 4);
      if (r === G.room) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(x - 1.5, y - 1.5, cw - 2, ch - 1); if (Math.floor(G.anim * 3) % 2) { g.fillStyle = '#000'; g.fillRect(x + 3, y + 2, 4, 4); } }
    }
  },

  drawBanner(g) {
    const b = G.banner; if (!b) return;
    const k = b.t / b.dur, a = k < 0.12 ? k / 0.12 : k > 0.75 ? Math.max(0, (1 - k) / 0.25) : 1;
    g.save(); g.globalAlpha = a; g.textAlign = 'center';
    const y = H * 0.30, slide = (1 - Math.min(1, b.t / 0.35)) * 40;
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, y - 46, W, 92);
    g.fillStyle = b.color; g.fillRect(0, y - 46, W, 2); g.fillRect(0, y + 44, W, 2);
    g.font = 'bold 40px Orbitron, "Segoe UI", sans-serif';
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(b.title, W / 2 - slide, y + 8);
    g.fillStyle = '#fff'; g.fillText(b.title, W / 2 - slide, y + 8);
    g.font = '14px Orbitron, "Segoe UI", sans-serif'; g.fillStyle = b.color; g.fillText(b.sub.toUpperCase(), W / 2 + slide, y + 32);
    g.restore();
  }
};
