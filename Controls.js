// Keyboard + swipe input. Reports intent only; the game decides what to do.
export class Controls {
  constructor(h) {
    this.h = h; // { onLeft, onRight, onJump, onSlide, onPause, onMute }
    this.start = null;
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', () => (this.start = null));
    window.addEventListener('pointercancel', () => (this.start = null));
  }

  onKey(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    const map = {
      ArrowLeft: 'onLeft', KeyA: 'onLeft', ArrowRight: 'onRight', KeyD: 'onRight',
      ArrowUp: 'onJump', KeyW: 'onJump', Space: 'onJump', ArrowDown: 'onSlide', KeyS: 'onSlide',
      KeyP: 'onPause', Escape: 'onPause', KeyM: 'onMute',
    };
    const fn = map[e.code];
    if (!fn) return;
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    if (e.repeat && fn !== 'onJump') return;
    this.h[fn]?.();
  }

  onDown(e) {
    if (e.target.closest && e.target.closest('button, input, select, .panel')) { this.start = null; return; }
    this.start = { x: e.clientX, y: e.clientY };
  }

  onMove(e) {
    if (!this.start) return;
    const dx = e.clientX - this.start.x, dy = e.clientY - this.start.y;
    const T = 28;
    if (Math.abs(dx) < T && Math.abs(dy) < T) return;
    if (Math.abs(dx) > Math.abs(dy)) this.h[dx < 0 ? 'onLeft' : 'onRight']?.();
    else this.h[dy < 0 ? 'onJump' : 'onSlide']?.();
    this.start = { x: e.clientX, y: e.clientY }; // allow chained swipes in one drag
  }
}