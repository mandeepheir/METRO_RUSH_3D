// All DOM work lives here. The game only calls these methods and listens to handlers.
import { CHARACTERS, POWERUP_INFO, POWERUP_DURATION } from './Constants.js';
import { save } from './Storage.js';

const $ = (id) => document.getElementById(id);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export class UI {
  constructor(h) {
    this.h = h; this.cache = {}; this.toastTimer = 0;
    const click = (id, fn) => $(id).addEventListener('click', () => { h.onClick?.(); fn(); });

    click('btn-play', () => h.onPlay());
    click('btn-characters', () => { this.renderCharacters(); this.show('characters'); });
    click('btn-characters-back', () => this.show('menu'));
    click('btn-settings', () => { this.syncSettings(); this.show('settings'); });
    click('btn-settings-back', () => this.show('menu'));
    click('btn-howto', () => this.show('instructions'));
    click('btn-howto-back', () => this.show('menu'));
    click('btn-pause', () => h.onPause());
    click('btn-hud-mute', () => h.onMute());
    click('btn-resume', () => h.onResume());
    click('btn-restart-p', () => h.onPlay());
    click('btn-menu-p', () => h.onMenu());
    click('btn-restart', () => h.onPlay());
    click('btn-menu', () => h.onMenu());
    click('btn-reset', () => { if (confirm('Erase all coins, unlocks and high scores?')) { save.reset(); h.onReset(); this.refreshMenu(); this.syncSettings(); this.toast('PROGRESS RESET'); } });

    $('set-sound').addEventListener('change', (e) => h.onSettings({ muted: !e.target.checked }));
    $('set-music').addEventListener('input', (e) => h.onSettings({ music: +e.target.value }));
    $('set-sfx').addEventListener('input', (e) => h.onSettings({ sfx: +e.target.value }));
    $('set-quality').addEventListener('change', (e) => h.onSettings({ quality: e.target.value }));

    this.chips = {};
    for (const [type, info] of Object.entries(POWERUP_INFO)) {
      const c = document.createElement('div'); c.className = 'chip hidden'; c.style.setProperty('--c', info.color);
      c.innerHTML = `<span>${info.icon}</span><i><b></b></i>`; $('hud-powerups').appendChild(c); this.chips[type] = c;
    }
    this.refreshMenu(); this.syncSettings();
  }

  show(...names) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('active', names.includes(el.dataset.screen)));
    if (document.activeElement) document.activeElement.blur();
  }

  refreshMenu() {
    const d = save.data;
    $('menu-best').textContent = d.highScore.toLocaleString(); $('menu-coins').textContent = d.totalCoins.toLocaleString(); $('menu-level').textContent = d.level;
  }

  syncSettings() {
    const s = save.data.settings;
    $('set-sound').checked = !s.muted; $('set-music').value = s.music; $('set-sfx').value = s.sfx; $('set-quality').value = s.quality;
    this.setMuted(s.muted);
  }
  setMuted(m) { $('btn-hud-mute').textContent = m ? '🔇' : '🔊'; $('set-sound').checked = !m; }

  renderCharacters() {
    const d = save.data, grid = $('character-grid'); grid.innerHTML = '';
    $('char-coins').textContent = d.totalCoins.toLocaleString();
    CHARACTERS.forEach((c) => {
      const owned = d.unlocked.includes(c.id), card = document.createElement('div');
      card.className = 'card' + (d.selected === c.id ? ' selected' : '') + (owned ? '' : ' locked');
      card.innerHTML = `<div class="swatch" style="background:linear-gradient(135deg,${hex(c.suit)} 55%,${hex(c.accent)} 55%)"></div><b>${c.name}</b><span>${d.selected === c.id ? 'SELECTED' : owned ? 'OWNED' : '🔒 ' + c.cost + ' coins'}</span>`;
      card.addEventListener('click', () => {
        this.h.onClick?.();
        if (!owned) {
          if (d.totalCoins < c.cost) { this.toast(`NEED ${c.cost - d.totalCoins} MORE COINS`); return; }
          d.totalCoins -= c.cost; d.unlocked.push(c.id); this.toast('UNLOCKED ' + c.name);
        }
        d.selected = c.id; save.save(); this.h.onCharacter(c.id); this.renderCharacters(); this.refreshMenu();
      });
      grid.appendChild(card);
    });
  }

  updateHUD(s) {
    const c = this.cache;
    if (c.score !== s.score) { c.score = s.score; $('hud-score').textContent = s.score.toLocaleString(); }
    if (c.dist !== s.distance) { c.dist = s.distance; $('hud-distance').textContent = s.distance + ' m'; }
    if (c.coins !== s.coins) { c.coins = s.coins; $('hud-coins').lastElementChild.textContent = s.coins; }
    if (c.mult !== s.mult) { c.mult = s.mult; $('hud-mult').classList.toggle('hidden', s.mult <= 1); $('hud-mult').textContent = 'x' + s.mult; }
  }

  setPowerups(rem) {
    for (const type in this.chips) {
      const chip = this.chips[type], r = rem[type];
      chip.classList.toggle('hidden', !(r > 0));
      if (r > 0) chip.querySelector('b').style.transform = `scaleX(${Math.min(1, r / POWERUP_DURATION[type])})`;
    }
  }

  setCountdown(n) { const el = $('countdown'); el.classList.toggle('hidden', !n); if (n && el.textContent !== String(n)) el.textContent = n; }

  toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
  }

  showGameOver(r) {
    $('go-score').textContent = r.score.toLocaleString(); $('go-coins').textContent = r.coins; $('go-distance').textContent = r.distance + ' m';
    $('go-best').textContent = r.best.toLocaleString(); $('go-newbest').classList.toggle('hidden', !r.newBest);
    $('go-level').textContent = r.level; $('go-xptext').textContent = `${r.xp} / ${r.xpNeed} XP`;
    $('go-xpbar').style.width = '0%';
    requestAnimationFrame(() => requestAnimationFrame(() => { $('go-xpbar').style.width = Math.min(100, (r.xp / r.xpNeed) * 100) + '%'; }));
    const rw = $('go-reward'); rw.classList.toggle('hidden', !r.reward); if (r.reward) rw.textContent = `LEVEL UP! +${r.reward} bonus coins`;
    $('go-next').textContent = r.nextUnlock ? `Next unlock: ${r.nextUnlock.name} — ${r.nextUnlock.cost - r.bank > 0 ? r.nextUnlock.cost - r.bank + ' coins to go' : 'you can buy it now!'}` : 'All runners unlocked!';
    this.show('gameover');
  }
}