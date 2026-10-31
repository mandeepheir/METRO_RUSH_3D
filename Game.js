// Game: owns the renderer, the state machine and the main loop. Other modules do the specialised work.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { START_SPEED, MAX_SPEED, SPEED_RAMP, POWERUP_DURATION, POWERUP_INFO, CHARACTERS, LEVEL_XP, LEVEL_REWARD } from './Constants.js';
import { save } from './Storage.js';
import { Environment } from './Environment.js';
import { Player } from './Player.js';
import { ObstacleManager } from './Obstacles.js';
import { Collectibles } from './Collectibles.js';
import { CollisionSystem } from './Collision.js';
import { ParticleSystem, SpeedLines } from './Effects.js';
import { AudioManager } from './Audio.js';
import { Controls } from './Controls.js';
import { UI } from './Ui.js';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export class Game {
  constructor(container) {
    this.state = 'menu';
    this.settings = save.data.settings;
    this.time = 0; this.speed = START_SPEED; this.worldSpeed = 6;
    this.powerups = { magnet: 0, multiplier: 0, jetpack: 0, shield: 0 };
    this._pbox = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };

    // renderer + post-processing
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 320);
    this.camPos = new THREE.Vector3(-1.3, 2, 5.4); this.camLook = new THREE.Vector3(-1.9, 1.2, 0);
    this.camK = 3; this.shake = 0; this.baseFov = 62;

    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.55, 0.55);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // systems
    this.environment = new Environment(this.scene);
    this.player = new Player(this.scene);
    this.effects = new ParticleSystem(this.scene);
    this.speedLines = new SpeedLines(this.scene);
    this.collectibles = new Collectibles(this.scene);
    this.obstacles = new ObstacleManager(this.scene);
    this.collision = new CollisionSystem();
    this.audio = new AudioManager(this.settings);
    this.obstacles.onRow = (info) => this.collectibles.onRow(info, { jetpack: this.powerups.jetpack > 1.2 });
    this.cb = {
      onCoin: (x, y, z) => this.onCoin(x, y, z),
      onPowerup: (type, x, y, z) => this.activate(type, x, y, z),
    };

    this.ui = new UI({
      onClick: () => this.audio.playClick(),
      onPlay: () => this.startRun(),
      onPause: () => this.pause(),
      onResume: () => this.resume(),
      onMenu: () => this.goMenu(),
      onMute: () => this.toggleMute(),
      onCharacter: (id) => this.applyCharacter(id),
      onSettings: (p) => this.applySettings(p),
      onReset: () => { this.applySettings({}); this.applyCharacter('volt'); },
    });
    this.controls = new Controls({
      onLeft: () => this.state === 'playing' && this.player.moveLeft() && this.audio.playSwitch(),
      onRight: () => this.state === 'playing' && this.player.moveRight() && this.audio.playSwitch(),
      onJump: () => this.state === 'playing' && this.doJump(),
      onSlide: () => this.state === 'playing' && this.doSlide(),
      onPause: () => (this.state === 'playing' ? this.pause() : this.state === 'paused' ? this.resume() : null),
      onMute: () => this.toggleMute(),
    });

    const unlock = () => { this.audio.unlock(); this.audio.startMusic(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => document.hidden && this.pause());
    window.addEventListener('blur', () => this.pause());

    this.clock = new THREE.Clock();
    this.fpsAcc = 0; this.fpsFrames = 0; this.lowStrikes = 0;
    this.setQuality(this.settings.quality);
    this.applyCharacter(save.data.selected);
    this.ui.setMuted(this.audio.muted);
  }

  init() { this.goMenu(); this.renderer.setAnimationLoop(() => this.loop()); }

  // ---------- settings / quality ----------
  setQuality(q) {
    this.quality = q; this.useBloom = q === 'high';
    this.environment.setShadows(q === 'high');
    this.pixelRatio = q === 'high' ? Math.min(window.devicePixelRatio, 2) : Math.min(window.devicePixelRatio, 1.25);
    this.resize();
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight, a = w / h;
    this.renderer.setPixelRatio(this.pixelRatio); this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.pixelRatio); this.composer.setSize(w, h);
    this.camera.aspect = a;
    this.baseFov = a < 1 ? Math.min(92, 62 + (1 - a) * 55) : 62; // wider view on portrait phones
    this.camera.fov = this.baseFov; this.camera.updateProjectionMatrix();
  }
  applySettings(p) {
    Object.assign(this.settings, p); save.save();
    if ('muted' in p) { this.audio.setMuted(p.muted); this.ui.setMuted(p.muted); }
    if ('music' in p) this.audio.setMusicVolume(p.music);
    if ('sfx' in p) this.audio.setSfxVolume(p.sfx);
    if ('quality' in p) this.setQuality(p.quality);
    if (!Object.keys(p).length) { this.audio.setMuted(this.settings.muted); this.audio.setMusicVolume(this.settings.music); this.audio.setSfxVolume(this.settings.sfx); this.setQuality(this.settings.quality); this.ui.setMuted(this.settings.muted); }
  }
  toggleMute() { this.applySettings({ muted: !this.audio.muted }); }
  applyCharacter(id) { this.player.setCharacter(CHARACTERS.find((c) => c.id === id) || CHARACTERS[0]); }

  // ---------- state transitions ----------
  goMenu() {
    this.audio.resume(); this.audio.duckMusic(false); this.audio.setRunLevel(0);
    this.state = 'menu'; this.worldSpeed = 6;
    this.obstacles.clear(); this.collectibles.reset(); this.effects.clear();
    this.player.reset(); this.player.idle = true;
    Object.keys(this.powerups).forEach((k) => (this.powerups[k] = 0));
    this.ui.setPowerups(this.powerups); this.ui.setCountdown(0); this.ui.refreshMenu(); this.ui.show('menu');
    this.camK = 3;
  }

  startRun() {
    this.audio.unlock(); this.audio.startMusic(); this.audio.resume(); this.audio.duckMusic(false);
    this.runTime = 0; this.speed = START_SPEED; this.distance = 0; this.scoreF = 0; this.coins = 0; this.mult = 1;
    this.crashTimer = 0; this.stepTimer = 0; this.shake = 0; this.decay = 1;
    Object.keys(this.powerups).forEach((k) => (this.powerups[k] = 0));
    this.effects.clear(); this.player.reset(); this.applyCharacter(save.data.selected);
    this.collectibles.reset();                  // before obstacles: the prefill spawns coins through onRow
    this.obstacles.reset(0, START_SPEED);
    this.ui.updateHUD({ score: 0, distance: 0, coins: 0, mult: 1 }); this.ui.setPowerups(this.powerups);
    this.ui.setCountdown(0); this.ui.show('hud');
    this.state = 'playing'; this.camK = 2.5;
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this.audio.pause(); this.ui.show('hud', 'pause');
  }
  resume() {
    if (this.state !== 'paused') return;
    this.audio.resume(); this.ui.show('hud'); this.state = 'countdown'; this.countTimer = 3; this.ui.setCountdown(3);
  }

  crash() {
    this.state = 'crashing'; this.crashTimer = 0; this.decay = 1;
    this.player.crash(); this.shake = 1;
    this.effects.emit(this.player.group.position.x, 1.2, 0, 50, { color: 0xff5a3c, speed: 7, life: 0.9, size: 0.25, gravity: 16 });
    this.effects.emit(this.player.group.position.x, 1.2, 0, 20, { color: 0xffffff, speed: 5, life: 0.5, size: 0.15, gravity: 10 });
    this.audio.playCrash(); this.audio.duckMusic(true); this.audio.setRunLevel(0);
  }

  gameOver() {
    const d = save.data, score = Math.floor(this.scoreF), dist = Math.floor(this.distance);
    const newBest = score > d.highScore;
    if (newBest) d.highScore = score;
    d.bestDistance = Math.max(d.bestDistance, dist); d.totalCoins += this.coins; d.runs++;
    d.xp += Math.floor(score / 8);
    let reward = 0;
    while (d.xp >= LEVEL_XP(d.level)) { d.xp -= LEVEL_XP(d.level); reward += LEVEL_REWARD(d.level); d.level++; }
    d.totalCoins += reward; save.save();
    this.state = 'over'; this.audio.playGameOver();
    this.ui.showGameOver({
      score, coins: this.coins, distance: dist, best: d.highScore, newBest, level: d.level, xp: d.xp, xpNeed: LEVEL_XP(d.level),
      reward, bank: d.totalCoins, nextUnlock: CHARACTERS.find((c) => !d.unlocked.includes(c.id)),
    });
  }

  // ---------- player actions & pickups ----------
  doJump() {
    if (!this.player.jump()) return;
    this.audio.playJump();
    this.effects.emit(this.player.group.position.x, 0.1, 0.2, 8, { color: 0xbbbbcc, speed: 2, life: 0.4, size: 0.15, gravity: 2, up: 0.6 });
  }
  doSlide() { const r = this.player.slide(); if (r) this.audio.playSlide(); }

  onCoin(x, y, z) {
    this.coins++; this.scoreF += 10 * this.mult; this.audio.playCoin();
    this.effects.emit(x, y, z, 6, { color: 0xffd23f, speed: 3, life: 0.4, size: 0.12, gravity: 4 });
  }

  activate(type, x, y, z) {
    this.powerups[type] = POWERUP_DURATION[type];
    if (type === 'jetpack') this.player.startJetpack();
    if (type === 'shield') this.player.setShield(true);
    this.audio.playPowerup(); this.ui.toast(POWERUP_INFO[type].label + '!');
    this.effects.emit(x, y, z, 24, { color: parseInt(POWERUP_INFO[type].color.slice(1), 16), speed: 5, life: 0.7, size: 0.2, gravity: 2 });
  }
  expire(type) {
    if (type === 'jetpack') { this.player.stopJetpack(); this.player.invuln = 2.5; }
    if (type === 'shield') this.player.setShield(false);
    this.audio.playPowerdown();
  }

  handleHit(hit) {
    const p = this.player;
    if (hit.side && p.changingLane) {
      if (p.tryBump()) { this.shake = 0.35; this.audio.playBump(); this.effects.emit(p.group.position.x, 1, 0, 12, { color: 0xffe08a, speed: 4, life: 0.4, size: 0.12 }); return; }
      if (p.bumpTimer > 0) return;
    }
    if (this.powerups.shield > 0) {
      this.powerups.shield = 0; p.setShield(false); p.invuln = 1.5;
      this.obstacles.destroy(hit.obstacle, this.effects); this.shake = 0.5; this.audio.playShieldBreak();
      return;
    }
    this.crash();
  }

  // ---------- main loop ----------
  loop() {
    const dt = Math.min(this.clock.getDelta(), 0.04);
    this.time += dt;
    switch (this.state) {
      case 'menu': this.updateMenu(dt); break;
      case 'playing': this.updatePlaying(dt); break;
      case 'crashing': this.updateCrashing(dt); break;
      case 'countdown': this.updateCountdown(dt); break;
      case 'over': this.updateOver(dt); break;
      default: break; // paused: freeze everything
    }
    if (this.state !== 'paused' && this.state !== 'countdown') this.effects.update(dt, this.worldSpeed);
    this.updateCamera(dt);
    if (this.useBloom) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    this.monitorFps(dt);
  }

  updateMenu(dt) {
    this.environment.update(dt, 6, this.camera);
    this.player.yaw = Math.sin(this.time * 0.6) * 0.8 + 0.3;
    this.player.update(dt, 0);
    this.speedLines.update(dt, 0);
  }

  updatePlaying(dt) {
    this.runTime += dt;
    this.speed = Math.min(MAX_SPEED, START_SPEED + SPEED_RAMP * this.runTime);
    const jet = this.powerups.jetpack > 0, ws = this.speed * (jet ? 1.3 : 1), diff = (this.speed - START_SPEED) / (MAX_SPEED - START_SPEED);
    this.worldSpeed = ws;
    this.distance += ws * dt;
    this.mult = this.powerups.multiplier > 0 ? 2 : 1;
    this.scoreF += ws * dt * this.mult * 0.9;

    for (const t in this.powerups) if (this.powerups[t] > 0) { this.powerups[t] -= dt; if (this.powerups[t] <= 0) { this.powerups[t] = 0; this.expire(t); } }

    const p = this.player;
    this.environment.update(dt, ws, this.camera);
    p.update(dt, ws);
    const pbox = p.getBox(this._pbox);
    this.obstacles.update(dt, ws, this.distance, diff, true);
    this.collectibles.update(dt, ws, p, pbox, this.powerups.magnet > 0, this.cb, true);

    if (!p.invulnerable) { const hit = this.collision.checkObstacles(pbox, this.obstacles.active); if (hit) this.handleHit(hit); }

    // feedback: landing dust, footsteps, slide sparks, jetpack flames
    const x = p.group.position.x;
    if (p.landed) { this.effects.emit(x, 0.1, 0.2, 8, { color: 0xbbbbcc, speed: 2, life: 0.4, size: 0.15, gravity: 2, up: 0.6 }); this.audio.playStep(); }
    if (p.onGround && !p.sliding && !p.jetpack) {
      this.stepTimer += dt;
      if (this.stepTimer > 5.4 / this.speed) { this.stepTimer = 0; this.audio.playStep(); if (Math.random() < 0.6) this.effects.emit(x, 0.1, 0.3, 1, { color: 0x8c88a8, speed: 1, life: 0.35, size: 0.1, gravity: 1, up: 0.5 }); }
    }
    if (p.sliding && Math.random() < 0.6) this.effects.emit(x, 0.1, 0.4, 1, { color: 0x66f6ff, speed: 2, life: 0.3, size: 0.1, gravity: 6 });
    if (p.jetpack) this.effects.emit(x, p.y + 0.5, 0.6, 2, { color: 0xffa347, speed: 1.5, life: 0.35, size: 0.2, gravity: 4, up: -1 });

    this.speedLines.update(dt, ws);
    this.audio.setRunLevel(0.35 + diff * 0.65);
    this.ui.updateHUD({ score: Math.floor(this.scoreF), distance: Math.floor(this.distance), coins: this.coins, mult: this.mult });
    this.ui.setPowerups(this.powerups);
  }

  updateCrashing(dt) {
    this.crashTimer += dt;
    this.decay = Math.max(0, this.decay - dt * 2.2);
    const ws = this.speed * this.decay; this.worldSpeed = ws;
    this.environment.update(dt, ws, this.camera);
    this.player.update(dt, 0);
    this.obstacles.update(dt, ws, this.distance, 0, false);
    this.collectibles.update(dt, ws, this.player, this.player.getBox(this._pbox), false, this.cb, false);
    this.speedLines.update(dt, ws);
    if (this.crashTimer > 1.3) this.gameOver();
  }

  updateCountdown(dt) {
    this.countTimer -= dt;
    this.ui.setCountdown(Math.max(1, Math.ceil(this.countTimer)));
    if (this.countTimer <= 0) { this.ui.setCountdown(0); this.state = 'playing'; }
  }

  updateOver(dt) {
    this.worldSpeed = 0; this.player.update(dt, 0);
    this.speedLines.update(dt, 0);
  }

  // ---------- camera ----------
  updateCamera(dt) {
    const p = this.player, px = p.group.position.x, tp = new THREE.Vector3(), tl = new THREE.Vector3();
    let fov = this.baseFov;
    if (this.state === 'menu') { tp.set(-1.3, 2.0, 5.4); tl.set(-1.9, 1.2, 0); fov = this.baseFov * 0.92; }
    else {
      const sf = Math.max(0, (this.speed - START_SPEED) / (MAX_SPEED - START_SPEED));
      tp.set(px * 0.6, 4.4 + p.y * 0.4, 8.4); tl.set(px * 0.45, 1.7 + p.y * 0.35, -10);
      fov = this.baseFov + 12 * sf + (p.jetpack ? 4 : 0);
    }
    this.camK = damp(this.camK, 9, 1.5, dt);
    const k = this.state === 'menu' ? 4 : this.camK;
    this.camPos.x = damp(this.camPos.x, tp.x, k, dt); this.camPos.y = damp(this.camPos.y, tp.y, k, dt); this.camPos.z = damp(this.camPos.z, tp.z, k, dt);
    this.camLook.x = damp(this.camLook.x, tl.x, k, dt); this.camLook.y = damp(this.camLook.y, tl.y, k, dt); this.camLook.z = damp(this.camLook.z, tl.z, k, dt);
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const s = this.shake * this.shake * 0.5;
    this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * s, this.camPos.y + (Math.random() - 0.5) * s, this.camPos.z);
    this.camera.lookAt(this.camLook);
    const f = damp(this.camera.fov, fov, 5, dt);
    if (Math.abs(f - this.camera.fov) > 0.01) { this.camera.fov = f; this.camera.updateProjectionMatrix(); }
  }

  // ---------- performance ----------
  monitorFps(dt) {
    if (this.state !== 'playing') { this.fpsAcc = 0; this.fpsFrames = 0; return; }
    this.fpsAcc += dt; this.fpsFrames++;
    if (this.fpsAcc < 2) return;
    const fps = this.fpsFrames / this.fpsAcc; this.fpsAcc = 0; this.fpsFrames = 0;
    if (this.quality === 'high' && fps < 38) {
      if (++this.lowStrikes >= 2) { this.lowStrikes = 0; this.setQuality('low'); this.ui.toast('GRAPHICS LOWERED FOR SPEED'); }
    } else this.lowStrikes = 0;
  }
}