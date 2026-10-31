import * as THREE from 'three';
import { LANES, DESPAWN_Z, JETPACK_HEIGHT, MAGNET_RADIUS, POWERUP_INFO } from './Constants.js';
import { makeGlowTexture, makeBadgeTexture } from './Textures.js';

const COIN_MAX = 130, SPACING = 1.6;
const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.12, 18); coinGeo.rotateX(Math.PI / 2);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc928, emissive: 0xff9a00, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.4 });
const GLOW = makeGlowTexture();

function buildPowerup(type) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const col = new THREE.Color(POWERUP_INFO[type].color);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  glow.scale.set(2.8, 2.8, 1); g.add(glow);
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, ...o });
  if (type === 'magnet') {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.12, 10, 18, Math.PI), std(0xff3355, { emissive: 0xaa0022 })); body.add(m);
    [-0.34, 0.34].forEach((x) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.4, 0.24), std(0xff3355)); l.position.set(x, -0.2, 0); body.add(l);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.26), std(0xdddddd)); t.position.set(x, -0.42, 0); body.add(t); });
    body.position.y = 0.1;
  } else if (type === 'jetpack') {
    [-0.2, 0.2].forEach((x) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.8, 12), std(0xff8a1f, { metalness: 0.4 })); c.position.x = x; body.add(c);
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 8), new THREE.MeshBasicMaterial({ color: 0xffd36a })); f.position.set(x, -0.55, 0); f.rotation.x = Math.PI; body.add(f); });
  } else if (type === 'multiplier') {
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28), new THREE.MeshBasicMaterial({ map: makeBadgeTexture('2x'), side: THREE.DoubleSide, transparent: true })); body.add(b);
    body.add(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffffff })));
  } else {
    body.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshBasicMaterial({ color: 0x3dd9ff, wireframe: true })));
    body.add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), new THREE.MeshBasicMaterial({ color: 0x3dd9ff, transparent: true, opacity: 0.35 })));
  }
  g.userData = { type, active: false, body, bob: Math.random() * 6 };
  g.visible = false;
  return g;
}

export class Collectibles {
  constructor(scene) {
    this.scene = scene;
    this.coins = []; this.freeCoins = [];
    for (let i = 0; i < COIN_MAX; i++) {
      const m = new THREE.Mesh(coinGeo, coinMat); m.visible = false; m.userData.active = false; scene.add(m);
      this.coins.push(m); this.freeCoins.push(m);
    }
    this.powerups = []; this.powerPool = { magnet: [], jetpack: [], multiplier: [], shield: [] };
    this.time = 0; this.reset();
  }

  reset() {
    this.coins.forEach((c) => { c.visible = false; c.userData.active = false; });
    this.freeCoins = this.coins.slice();
    this.powerups.forEach((p) => { p.visible = false; p.userData.active = false; this.powerPool[p.userData.type].push(p); });
    this.powerups.length = 0;
    this.untilPowerup = 6 + ((Math.random() * 5) | 0);
  }

  addCoin(lane, y, z, x = LANES[lane]) {
    const c = this.freeCoins.pop(); if (!c) return;
    c.visible = true; c.userData.active = true; c.position.set(x, y, z);
  }
  addPowerup(type, lane, y, z) {
    const p = this.powerPool[type].pop() || (() => { const n = buildPowerup(type); this.scene.add(n); return n; })();
    p.visible = true; p.userData.active = true; p.position.set(LANES[lane], y, z); this.powerups.push(p);
  }

  // Called by the obstacle manager every time a new row appears.
  onRow(info, ctx) {
    const { z, plan, prevPlan, gap, locked } = info;
    const rand = (a) => a[(Math.random() * a.length) | 0];

    if (ctx.jetpack) { // sky coin trail while flying
      let lane = (Math.random() * 3) | 0;
      for (let i = 0; i < 9; i++) { if (i % 3 === 0 && Math.random() < 0.5) lane = Math.max(0, Math.min(2, lane + (Math.random() < 0.5 ? -1 : 1))); this.addCoin(lane, JETPACK_HEIGHT + 1.0, z - 6 + i * SPACING); }
      return;
    }
    // coin arcs over barriers and low lines under overhead signs
    for (const it of plan.items) {
      if (it.type === 'barrier' && Math.random() < 0.5) {
        for (let i = 0; i < 7; i++) this.addCoin(it.lane, 1.0 + 1.5 * Math.sin((Math.PI * i) / 6), z + (i - 3) * 1.0);
      } else if (it.type === 'overhead' && Math.random() < 0.35) {
        for (let i = 0; i < 4; i++) this.addCoin(it.lane, 0.55, z + (i - 1.5) * 1.2);
      }
    }
    if (!prevPlan || gap <= 0) return;
    const used = new Set([...plan.items.map((i) => i.lane), ...prevPlan.items.map((i) => i.lane), ...locked]);
    const allowed = [0, 1, 2].filter((l) => !used.has(l));
    const avail = Math.min(14, gap - prevPlan.halfD - plan.halfD - 2);
    if (!allowed.length || avail < 4) return;

    const count = Math.min(9, Math.floor(avail / SPACING) + 1), zc = z + gap / 2, z0 = zc - ((count - 1) * SPACING) / 2;
    const lane = rand(allowed);
    const adj = allowed.find((l) => Math.abs(l - lane) === 1);
    if (Math.random() < 0.7) {
      if (adj !== undefined && Math.random() < 0.3 && count >= 6) { // zig-zag between two lanes
        for (let i = 0; i < count; i++) this.addCoin(i < count / 2 ? lane : adj, 1.0, z0 + i * SPACING);
      } else for (let i = 0; i < count; i++) this.addCoin(lane, 1.0, z0 + i * SPACING);
    }
    if (--this.untilPowerup <= 0) {
      const w = [['shield', 3], ['magnet', 3], ['multiplier', 2.5], ['jetpack', 1.5]];
      let t = w.reduce((s, x) => s + x[1], 0) * Math.random(), type = 'shield';
      for (const [v, k] of w) { t -= k; if (t <= 0) { type = v; break; } }
      this.addPowerup(type, rand(allowed), 1.2, zc);
      this.untilPowerup = 9 + ((Math.random() * 7) | 0);
    }
  }

  update(dt, speed, player, pbox, magnet, cb, collect = true) {
    this.time += dt;
    const px = player.group.position.x, py = player.y + 1.0;
    for (const c of this.coins) {
      const u = c.userData; if (!u.active) continue;
      c.rotation.y += dt * 4;
      const dx = px - c.position.x, dy = py - c.position.y, dz = -c.position.z;
      const dist = Math.hypot(dx, dy, dz);
      if (collect && magnet && dist < MAGNET_RADIUS && c.position.z < 3) {
        const k = Math.min(1, (34 * dt) / Math.max(dist, 0.01));
        c.position.x += dx * k; c.position.y += dy * k; c.position.z += dz * k;
      } else c.position.z += speed * dt;
      if (collect && Math.abs(c.position.x - px) < 0.95 && Math.abs(c.position.z) < 0.9 && c.position.y > pbox.minY - 0.3 && c.position.y < pbox.maxY + 0.3) {
        cb.onCoin?.(c.position.x, c.position.y, c.position.z); this.freeCoin(c);
      } else if (c.position.z > DESPAWN_Z) this.freeCoin(c);
    }
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i], u = p.userData;
      p.position.z += speed * dt;
      u.body.rotation.y += dt * 2.5;
      u.body.position.y = Math.sin(this.time * 3 + u.bob) * 0.12;
      const hit = collect && Math.abs(p.position.x - px) < 1.1 && Math.abs(p.position.z) < 1.2 && p.position.y > pbox.minY - 0.7 && p.position.y < pbox.maxY + 0.5;
      if (hit || p.position.z > DESPAWN_Z) {
        if (hit) cb.onPowerup?.(u.type, p.position.x, p.position.y, p.position.z);
        p.visible = false; u.active = false; this.powerPool[u.type].push(p); this.powerups.splice(i, 1);
      }
    }
  }

  freeCoin(c) { c.visible = false; c.userData.active = false; this.freeCoins.push(c); }
}