'use strict';
/* ==========================================================
   audio.js  -  100% procedural sound (WebAudio). No audio files!
   Sound effects + a generative adaptive music loop.
   ========================================================== */
const Sound = {
  ctx: null, master: null, sfx: null, mus: null, noiseBuf: null,
  muted: false, last: {}, timer: null,
  theme: null, step: 0, next: 0, on: false, intensity: 0.2, targetIntensity: 0.2,

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.7; this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain(); this.sfx.gain.value = 0.6; this.sfx.connect(this.master);
      this.mus = this.ctx.createGain(); this.mus.gain.value = 0.32; this.mus.connect(this.master);
      const len = this.ctx.sampleRate, buf = this.ctx.createBuffer(1, len, len), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      if (this.pendingTheme) { this.startMusic(this.pendingTheme); this.pendingTheme = null; }
    } catch (e) { this.ctx = null; }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.7;
    return this.muted;
  },

  tone(o) {
    const c = this.ctx; if (!c) return;
    const t = o.at || c.currentTime, osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + o.d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.v || 0.2, t + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    osc.connect(g); g.connect(o.dest || this.sfx);
    osc.start(t); osc.stop(t + o.d + 0.03);
  },
  noise(o) {
    const c = this.ctx; if (!c) return;
    const t = o.at || c.currentTime, src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf;
    fl.type = o.ft || 'lowpass'; fl.frequency.setValueAtTime(o.f || 2000, t);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + o.d);
    g.gain.setValueAtTime(o.v || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    src.connect(fl); fl.connect(g); g.connect(o.dest || this.sfx);
    src.start(t, Math.random() * 0.5); src.stop(t + o.d + 0.03);
  },

  play(name) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.035) return;
    this.last[name] = now;
    const T = (type, f, f2, d, v, at) => this.tone({ type, f, f2, d, v, at });
    switch (name) {
      case 'pistol': T('square', 900, 220, 0.09, 0.1); break;
      case 'smg': T('square', 700, 300, 0.05, 0.07); break;
      case 'shotgun': this.noise({ d: 0.2, f: 3500, f2: 300, v: 0.4 }); T('sawtooth', 170, 50, 0.16, 0.25); break;
      case 'rail': T('sawtooth', 2000, 90, 0.35, 0.18); this.noise({ d: 0.25, f: 6000, f2: 400, v: 0.25, ft: 'highpass' }); break;
      case 'launcher': T('square', 320, 90, 0.25, 0.2); this.noise({ d: 0.15, f: 1200, f2: 200, v: 0.2 }); break;
      case 'eshoot': T('triangle', 500, 200, 0.12, 0.08); break;
      case 'eshoot2': T('sawtooth', 240, 100, 0.2, 0.1); break;
      case 'hit': T('square', 220, 90, 0.05, 0.07); break;
      case 'kill': this.noise({ d: 0.22, f: 2500, f2: 200, v: 0.22 }); T('triangle', 420, 60, 0.2, 0.18); break;
      case 'hurt': T('sawtooth', 320, 50, 0.3, 0.3); this.noise({ d: 0.25, f: 1500, f2: 150, v: 0.3 }); break;
      case 'dash': this.noise({ d: 0.22, f: 500, f2: 4000, v: 0.2, ft: 'bandpass' }); break;
      case 'pickup': T('sine', 660, 990, 0.12, 0.18); T('sine', 990, 1320, 0.12, 0.14, now + 0.07); break;
      case 'coin': T('square', 1250, 1900, 0.07, 0.08); break;
      case 'heart': T('sine', 440, 880, 0.2, 0.22); T('sine', 660, 1320, 0.2, 0.15, now + 0.08); break;
      case 'open': T('square', 200, 520, 0.35, 0.12); T('sine', 400, 800, 0.35, 0.12); break;
      case 'lock': T('square', 140, 70, 0.3, 0.2); this.noise({ d: 0.2, f: 800, f2: 100, v: 0.25 }); break;
      case 'upgrade': [523, 659, 784, 1047, 1319].forEach((f, i) => T('sine', f, f, 0.22, 0.17, now + i * 0.06)); break;
      case 'explosion': this.noise({ d: 0.55, f: 1800, f2: 80, v: 0.55 }); T('sine', 130, 28, 0.45, 0.45); break;
      case 'boss': T('sawtooth', 90, 38, 1.2, 0.35); this.noise({ d: 1.1, f: 500, f2: 60, v: 0.3 }); break;
      case 'click': T('square', 600, 900, 0.05, 0.08); break;
      case 'shield': T('sine', 800, 1700, 0.25, 0.22); break;
      case 'warn': T('square', 520, 520, 0.09, 0.09); break;
      case 'win': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => T('triangle', f, f, 0.4, 0.2, now + i * 0.13)); break;
      case 'lose': [330, 262, 196, 131].forEach((f, i) => T('sawtooth', f, f * 0.9, 0.5, 0.2, now + i * 0.22)); break;
    }
  },

  /* ------------- generative music ------------- */
  startMusic(theme) {
    if (!this.ctx) { this.pendingTheme = theme; return; }
    this.theme = theme; this.step = 0; this.next = this.ctx.currentTime + 0.15; this.on = true;
    if (!this.timer) this.timer = setInterval(() => this.sched(), 60);
  },
  stopMusic() { this.on = false; this.pendingTheme = null; },
  sched() {
    if (!this.on || !this.ctx) return;
    const spb = 60 / this.theme.bpm / 4;
    while (this.next < this.ctx.currentTime + 0.22) {
      this.musicStep(this.step, this.next, spb);
      this.next += spb; this.step++;
    }
    this.intensity += (this.targetIntensity - this.intensity) * 0.04;
  },
  musicStep(s, t, spb) {
    const th = this.theme, i = s % 16, bar = Math.floor(s / 16) % th.prog.length, root = th.prog[bar], I = this.intensity;
    const f = m => 440 * Math.pow(2, (m - 69) / 12), D = this.mus;
    if (i === 0) {
      this.tone({ type: 'sine', f: f(root + 12), d: spb * 15, v: 0.07, a: 0.3, at: t, dest: D });
      this.tone({ type: 'sine', f: f(root + 19), d: spb * 15, v: 0.05, a: 0.4, at: t, dest: D });
      this.tone({ type: 'triangle', f: f(root + 15), d: spb * 15, v: 0.04, a: 0.5, at: t, dest: D });
    }
    if (i % 2 === 0) {
      const n = root + (i % 8 === 6 ? 7 : i % 8 === 4 ? 12 : 0);
      this.tone({ type: 'sawtooth', f: f(n), d: spb * 1.8, v: 0.11 + I * 0.05, at: t, dest: D });
    }
    if (I > 0.3 && i % 2 === 1) {
      const sc = [0, 3, 7, 10, 12, 15, 19], n = root + 24 + sc[(s * 3 + bar * 2) % sc.length];
      this.tone({ type: 'square', f: f(n), d: spb * 1.2, v: 0.025 + I * 0.025, at: t, dest: D });
    }
    if (I > 0.5) {
      if (i % 4 === 0) this.tone({ type: 'sine', f: 150, f2: 38, d: 0.2, v: 0.5, at: t, dest: D });
      if (i % 4 === 2) this.noise({ d: 0.05, f: 7000, v: 0.07, ft: 'highpass', at: t, dest: D });
      if (i === 4 || i === 12) this.noise({ d: 0.14, f: 2500, v: 0.16, ft: 'bandpass', at: t, dest: D });
    } else if (i % 8 === 0) {
      this.tone({ type: 'sine', f: 130, f2: 40, d: 0.2, v: 0.3, at: t, dest: D });
    }
  }
};
