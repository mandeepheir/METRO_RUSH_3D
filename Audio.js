// All sound is synthesized with the Web Audio API: no audio files required.
export class AudioManager {
  constructor(settings) {
    this.muted = !!settings.muted;
    this.musicVol = settings.music;
    this.sfxVol = settings.sfx;
    this.ctx = null; this.running = false; this.timer = null;
    this.step = 0; this.nextTime = 0; this.ducked = false;
    this.stepDur = 60 / 124 / 4;
  }

  ensure() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 1; this.master.connect(ctx.destination);
    this.musicGain = ctx.createGain(); this.musicGain.connect(this.master);
    this.sfxGain = ctx.createGain(); this.sfxGain.gain.value = this.sfxVol; this.sfxGain.connect(this.master);
    this.applyMusicVol();
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    // ambient rail rumble
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    this.ambGain = ctx.createGain(); this.ambGain.gain.value = 0;
    src.connect(lp); lp.connect(this.ambGain); this.ambGain.connect(this.sfxGain); src.start();
    return true;
  }

  unlock() { if (this.ensure() && this.ctx.state === 'suspended') this.ctx.resume(); }
  pause() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  applyMusicVol() {
    if (!this.musicGain) return;
    const v = this.musicVol * 0.3 * (this.ducked ? 0.25 : 1);
    this.musicGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02); }
  setMusicVolume(v) { this.musicVol = v; this.applyMusicVol(); }
  setSfxVolume(v) { this.sfxVol = v; if (this.sfxGain) this.sfxGain.gain.value = v; }
  duckMusic(on) { this.ducked = on; this.applyMusicVol(); }
  setRunLevel(f) { if (this.ambGain) this.ambGain.gain.setTargetAtTime(f * 0.5, this.ctx.currentTime, 0.2); }

  // ---------- building blocks ----------
  tone(freq, o = {}) {
    if (!this.ctx) return;
    const { end = 0, type = 'sine', dur = 0.15, vol = 0.3, at = this.ctx.currentTime + (o.delay || 0), dest = this.sfxGain } = o;
    const osc = this.ctx.createOscillator(), g = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, at);
    if (end) osc.frequency.exponentialRampToValueAtTime(end, at + dur);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g); g.connect(dest); osc.start(at); osc.stop(at + dur + 0.05);
  }
  noise(o = {}) {
    if (!this.ctx) return;
    const { dur = 0.1, vol = 0.2, type = 'lowpass', freq = 1000, end = 0, at = this.ctx.currentTime + (o.delay || 0), dest = this.sfxGain } = o;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, at);
    if (end) f.frequency.exponentialRampToValueAtTime(end, at + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(at, Math.random(), dur + 0.05);
  }

  // ---------- sound effects ----------
  playCoin() { this.tone(988, { type: 'square', dur: 0.07, vol: 0.12 }); this.tone(1319, { type: 'square', dur: 0.14, vol: 0.12, delay: 0.06 }); }
  playJump() { this.tone(260, { end: 620, type: 'triangle', dur: 0.2, vol: 0.28 }); }
  playSlide() { this.noise({ dur: 0.35, vol: 0.3, type: 'bandpass', freq: 2400, end: 500 }); }
  playSwitch() { this.noise({ dur: 0.12, vol: 0.12, type: 'bandpass', freq: 1500, end: 700 }); }
  playStep() { this.noise({ dur: 0.05, vol: 0.12, freq: 900 }); this.tone(90, { end: 50, dur: 0.08, vol: 0.16 }); }
  playBump() { this.tone(120, { end: 60, type: 'square', dur: 0.15, vol: 0.25 }); this.noise({ dur: 0.1, vol: 0.2, freq: 600 }); }
  playShieldBreak() { this.noise({ dur: 0.4, vol: 0.3, type: 'highpass', freq: 1200 }); this.tone(900, { end: 200, type: 'sawtooth', dur: 0.3, vol: 0.2 }); }
  playCrash() { this.noise({ dur: 0.7, vol: 0.6, freq: 1800, end: 80 }); this.tone(140, { end: 35, type: 'sawtooth', dur: 0.6, vol: 0.4 }); }
  playPowerup() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, { type: 'square', dur: 0.12, vol: 0.14, delay: i * 0.06 })); }
  playPowerdown() { this.tone(500, { end: 200, type: 'triangle', dur: 0.25, vol: 0.18 }); }
  playGameOver() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, { type: 'triangle', dur: 0.35, vol: 0.28, delay: 0.2 + i * 0.22 })); }
  playClick() { this.tone(660, { type: 'square', dur: 0.05, vol: 0.1 }); }

  // ---------- music (16-step sequencer, 4 bars, A minor loop) ----------
  startMusic() {
    if (!this.ensure() || this.running) return;
    this.running = true; this.step = 0; this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 30);
  }
  stopMusic() { this.running = false; clearInterval(this.timer); }

  schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (this.nextTime < this.ctx.currentTime - 0.5) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this.playStepAt(this.step, this.nextTime);
      this.nextTime += this.stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  playStepAt(step, t) {
    const bar = step >> 4, s = step & 15, d = this.musicGain;
    const roots = [55, 43.65, 65.41, 49];
    const chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
    if (s % 4 === 0) this.tone(150, { end: 40, dur: 0.18, vol: 0.9, at: t, dest: d });
    if (s === 4 || s === 12) this.noise({ dur: 0.12, vol: 0.35, type: 'bandpass', freq: 1800, at: t, dest: d });
    this.noise({ dur: s % 2 ? 0.07 : 0.03, vol: s % 2 ? 0.14 : 0.08, type: 'highpass', freq: 7000, at: t, dest: d });
    if ([0, 3, 6, 8, 11, 14].includes(s)) this.tone(roots[bar], { type: 'sawtooth', dur: 0.2, vol: 0.45, at: t, dest: d });
    const idx = [0, 1, 2, 1, 0, 1, 2, 1, 2, 1, 0, 1, 2, 1, 0, 2][s];
    this.tone(chords[bar][idx] * (s % 8 > 3 ? 2 : 1), { type: 'square', dur: 0.1, vol: 0.12, at: t, dest: d });
  }
}