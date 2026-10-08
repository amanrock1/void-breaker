'use strict';
/* ==========================================================
   ui.js  -  HTML/CSS menus layered above the canvas
   (title, help, credits, upgrade cards, pause, game over, victory)
   ========================================================== */
const UI = {
  cardCb: null, cardCount: 0,

  init() {
    const $ = id => document.getElementById(id);
    this.screens = Array.from(document.querySelectorAll('.screen'));
    $('game-title').innerHTML = CONFIG.title.split(' ').map((w, i) => '<span class="w' + i + '">' + w + '</span>').join('');
    $('team-name').textContent = CONFIG.teamName;
    $('course').textContent = CONFIG.course;
    $('credits-list').innerHTML = CONFIG.team.map(m =>
      '<div class="member"><b>' + m.name + '</b><i>' + m.role + '</i></div>').join('');
    const click = (id, fn) => $(id).addEventListener('click', () => { Sound.init(); Sound.resume(); Sound.play('click'); fn(); });
    click('b-play', () => G.start());
    click('b-help', () => this.show('s-help'));
    click('b-credits', () => this.show('s-credits'));
    document.querySelectorAll('.back').forEach(b => b.addEventListener('click', () => { Sound.play('click'); this.show('s-title'); }));
    click('b-resume', () => G.resume());
    click('b-quit', () => G.toTitle());
    click('b-retry', () => G.start());
    click('b-menu', () => G.toTitle());
    click('b-retry2', () => G.start());
    click('b-menu2', () => G.toTitle());
    // keep the mouse from leaking clicks into the game canvas through the overlay
    $('ui').addEventListener('mousedown', e => e.stopPropagation());
  },

  show(id) {
    this.screens.forEach(s => s.classList.toggle('show', s.id === id));
    document.getElementById('ui').classList.add('on');
  },
  hideAll() {
    this.screens.forEach(s => s.classList.remove('show'));
    document.getElementById('ui').classList.remove('on');
  },
  refreshBest() {
    document.getElementById('best').textContent = G.best ? 'BEST SCORE  ' + String(G.best).padStart(7, '0') : 'Reach the Void Core to win';
  },

  showCards(title, cards, cb) {
    document.getElementById('cards-title').textContent = title;
    const box = document.getElementById('cards');
    box.innerHTML = '';
    this.cardCb = cb; this.cardCount = cards.length;
    cards.forEach((c, i) => {
      const el = document.createElement('button');
      el.className = 'card' + (c.rare ? ' rare' : '');
      el.style.animationDelay = (i * 0.08) + 's';
      el.innerHTML = '<span class="key">' + (i + 1) + '</span><span class="icon">' + c.icon + '</span><h3>' + c.name + '</h3><p>' + c.desc + '</p>' +
        (c.rare ? '<em>RARE</em>' : '') + (c.lvl > 1 ? '<small>LEVEL ' + c.lvl + '</small>' : '');
      el.addEventListener('click', () => this.pickCard(i));
      box.appendChild(el);
    });
    this.show('s-cards');
  },
  pickCard(i) {
    if (!this.cardCb || i >= this.cardCount) return;
    const cb = this.cardCb; this.cardCb = null;
    Sound.play('click'); this.hideAll(); cb(i);
  },

  showEnd(id) {
    const p = G.player, win = id === 's-win', pre = win ? 'w-' : 'o-';
    const set = (k, v) => { document.getElementById(pre + k).textContent = v; };
    set('score', String(G.score).padStart(7, '0'));
    set('floor', G.floorNo + ' / ' + THEMES.length);
    set('kills', G.kills);
    set('time', fmtTime(G.runTime));
    set('upg', Object.values(p.upg).reduce((a, b) => a + b, 0));
    set('best', String(G.best).padStart(7, '0') + (G.score >= G.best && G.score > 0 ? '  NEW!' : ''));
    this.show(id);
  }
};
