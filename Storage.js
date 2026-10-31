// LocalStorage wrapper. Everything is try/catch'd so private-mode browsers don't crash the game.
const KEY = 'metroRush3D.save.v1';
const DEFAULTS = {
  highScore: 0, bestDistance: 0, totalCoins: 0, runs: 0, xp: 0, level: 1,
  unlocked: ['volt'], selected: 'volt',
  settings: { muted: false, music: 0.6, sfx: 0.8, quality: 'high' },
};
const clone = (o) => JSON.parse(JSON.stringify(o));

class SaveData {
  constructor() { this.data = this.load(); }
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULTS);
      const p = JSON.parse(raw);
      return { ...clone(DEFAULTS), ...p, settings: { ...DEFAULTS.settings, ...(p.settings || {}) } };
    } catch { return clone(DEFAULTS); }
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ } }
  reset() { this.data = clone(DEFAULTS); this.save(); }
}
export const save = new SaveData();