import * as THREE from 'three';
import { LANES, SPAWN_Z, DESPAWN_Z, MOVING_TRAIN_FACTOR } from './Constants.js';
import { makeHazardTexture } from './Textures.js';

const F = MOVING_TRAIN_FACTOR;
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
const hazard = makeHazardTexture(); hazard.repeat.set(3, 1);

const mats = {
  hazard: new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.7 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x8a8c9e, roughness: 0.9 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x2b2e3a, roughness: 0.5, metalness: 0.5 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xffc400, roughness: 0.5 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x9aa0b4, roughness: 0.6 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x0a2a3a, emissive: 0x22c8ff, emissiveIntensity: 0.55, roughness: 0.2 }),
  stripe: new THREE.MeshBasicMaterial({ color: 0xeaf6ff }),
  light: new THREE.MeshBasicMaterial({ color: 0xfff6c8 }),
  lampRed: new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
  lampAmber: new THREE.MeshBasicMaterial({ color: 0xffa400 }),
  train: [0x2c7be5, 0xe5384f, 0x23b58a, 0xb25cff].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.3 })),
};

const HALF = { barrier: 0.3, overhead: 0.3, roadblock: 0.5, equipment: 1.1, train: 7, mtrain: 6 };

function add(parent, geo, mat, w, h, d, x, y, z, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = shadow; parent.add(m); return m;
}
const bx = (p, mat, w, h, d, x, y, z, s) => add(p, BOX, mat, w, h, d, x, y, z, s);

// Each builder returns a Group whose userData describes its hitbox.
function build(type) {
  const g = new THREE.Group();
  const u = (g.userData = { type, halfW: 1.05, halfD: HALF[type], minY: 0, maxY: 1, speedMul: 1, body: null });
  if (type === 'barrier') {
    bx(g, mats.hazard, 2.1, 0.5, 0.35, 0, 0.7, 0);
    bx(g, mats.metal, 0.14, 0.95, 0.3, -0.9, 0.47, 0); bx(g, mats.metal, 0.14, 0.95, 0.3, 0.9, 0.47, 0);
    bx(g, mats.lampRed, 0.18, 0.18, 0.18, -0.9, 1.1, 0, false); bx(g, mats.lampRed, 0.18, 0.18, 0.18, 0.9, 1.1, 0, false);
    u.maxY = 1.0;
  } else if (type === 'overhead') {
    bx(g, mats.metal, 0.12, 3.0, 0.12, -1.2, 1.5, -0.05); bx(g, mats.metal, 0.12, 3.0, 0.12, 1.2, 1.5, -0.05);
    bx(g, mats.metal, 2.5, 0.18, 0.25, 0, 2.95, -0.05);
    bx(g, mats.metal, 0.08, 0.35, 0.08, -0.8, 2.75, 0); bx(g, mats.metal, 0.08, 0.35, 0.08, 0.8, 2.75, 0);
    bx(g, mats.hazard, 2.2, 0.95, 0.2, 0, 2.05, 0);
    bx(g, mats.lampAmber, 0.2, 0.2, 0.2, 0, 3.15, 0, false);
    u.halfW = 1.15; u.minY = 1.5; u.maxY = 2.55;
  } else if (type === 'roadblock') {
    bx(g, mats.concrete, 2.2, 1.5, 0.9, 0, 0.75, 0);
    bx(g, mats.hazard, 2.2, 0.7, 0.92, 0, 1.85, 0);
    bx(g, mats.lampRed, 0.25, 0.25, 0.25, 0, 2.35, 0, false);
    u.halfW = 1.1; u.maxY = 2.25;
  } else if (type === 'equipment') {
    bx(g, mats.yellow, 2.0, 0.7, 2.2, 0, 0.75, 0);
    bx(g, mats.yellow, 1.3, 0.9, 1.0, 0, 1.55, 0.5);
    bx(g, mats.glass, 1.1, 0.5, 0.05, 0, 1.6, -0.02);
    bx(g, mats.metal, 0.15, 1.5, 0.15, 0.6, 1.9, -0.6); bx(g, mats.metal, 1.2, 0.12, 0.12, 0.0, 2.65, -0.6);
    bx(g, mats.lampAmber, 0.22, 0.22, 0.22, 0, 2.15, 0.5, false);
    [-0.85, 0.85].forEach((x) => [-0.7, 0.7].forEach((z) => { const w = add(g, CYL, mats.metal, 0.5, 0.3, 0.5, x, 0.28, z); w.rotation.z = Math.PI / 2; }));
    u.halfW = 1.05; u.maxY = 2.0;
  } else { // train / mtrain
    const len = HALF[type] * 2;
    u.halfW = 1.15; u.maxY = 3.3;
    u.body = bx(g, mats.train[0], 2.3, 2.8, len, 0, 1.85, 0);
    bx(g, mats.metal, 2.0, 0.45, len - 1, 0, 0.3, 0);
    bx(g, mats.roof, 2.0, 0.2, len - 0.6, 0, 3.3, 0, false);
    for (let i = -1; i <= 1; i++) bx(g, mats.metal, 0.9, 0.25, 1.4, 0, 3.5, i * len * 0.28, false);
    [-1.16, 1.16].forEach((x) => {
      bx(g, mats.glass, 0.05, 0.85, len * 0.8, x, 2.55, 0, false);
      bx(g, mats.stripe, 0.05, 0.2, len, x, 1.35, 0, false);
    });
    bx(g, mats.glass, 1.9, 0.95, 0.05, 0, 2.6, len / 2 + 0.02, false);
    bx(g, mats.light, 0.28, 0.28, 0.06, -0.7, 1.0, len / 2 + 0.03, false); bx(g, mats.light, 0.28, 0.28, 0.06, 0.7, 1.0, len / 2 + 0.03, false);
    bx(g, mats.stripe, 2.0, 0.12, 0.06, 0, 1.45, len / 2 + 0.03, false);
    if (type === 'mtrain') u.speedMul = 1 + F;
  }
  return g;
}

export class ObstacleManager {
  constructor(scene) {
    this.scene = scene;
    this.pools = {}; this.active = [];
    this.onRow = null; // callback(rowInfo)
    this.time = 0;
    this.reset(0, 0);
  }

  acquire(type, lane, z) {
    const pool = (this.pools[type] ||= []);
    const o = pool.pop() || (() => { const n = build(type); this.scene.add(n); return n; })();
    o.visible = true;
    if (o.userData.body) o.userData.body.material = mats.train[(Math.random() * mats.train.length) | 0];
    o.position.set(LANES[lane], 0, z);
    this.active.push(o);
    return o;
  }
  release(o) {
    const i = this.active.indexOf(o);
    if (i >= 0) { this.active[i] = this.active[this.active.length - 1]; this.active.pop(); }
    o.visible = false;
    this.pools[o.userData.type].push(o);
  }
  clear() { while (this.active.length) this.release(this.active[this.active.length - 1]); }
  destroy(o, fx) {
    fx.emit(o.position.x, 1.2, o.position.z, 30, { color: 0xffc400, speed: 6, life: 0.7, size: 0.22, gravity: 14 });
    this.release(o);
  }

  // ---------- generation ----------
  reset(distance, speed) {
    this.clear();
    this.laneLock = [0, 0, 0];
    this.lastFree = 1; this.rowCount = 0; this.lastWall = false; this.prevPlan = null;
    this.pendingGap = 0;
    this.prefill(distance, speed || 15);
  }

  gapFor(prev, cur, speed) {
    let g = Math.max(18, speed * 1.1, (prev ? prev.halfD : 0) + cur.halfD + 10);
    if (prev && prev.wall) g = Math.max(g, speed * 1.4);
    return g;
  }

  prefill(distance, speed) {
    let z = -50, prev = null;
    for (let n = 0; n < 40; n++) {
      const plan = this.planRow(0, 0, speed, false);
      if (prev) z -= this.gapFor(prev, plan, speed);
      if (z <= SPAWN_Z) {
        this.pending = plan; this.pendingGap = prev ? this.gapFor(prev, plan, speed) : 20;
        this.nextSpawnDistance = distance + (SPAWN_Z - z);
        return;
      }
      this.spawnPlan(plan, z, distance);
      this.onRow?.({ z, gap: prev ? this.gapFor(prev, plan, speed) : 0, plan, prevPlan: prev, locked: [] });
      prev = plan; this.prevPlan = plan;
    }
  }

  planRow(d, spawnDist, speed, allowMoving = true) {
    const L = [0, 1, 2], rand = (a) => a[(Math.random() * a.length) | 0];
    const weighted = (o) => { let t = o.reduce((s, x) => s + x[1], 0) * Math.random(); for (const [v, w] of o) { t -= w; if (t <= 0) return v; } return o[0][0]; };
    const locked = L.filter((l) => spawnDist < this.laneLock[l]);
    const unlocked = L.filter((l) => !locked.includes(l));
    const blocker = () => {
      const o = [['barrier', 3], ['overhead', 2], ['roadblock', 1 + d * 2], ['equipment', 1 + d]];
      if (d > 0.1) o.push(['train', 1 + 2 * d]);
      return weighted(o);
    };
    const pickFree = () => { // lane that stays open; must include every locked lane
      if (locked.length >= 2) return null;
      let c = d < 0.7 ? L.filter((l) => Math.abs(l - this.lastFree) <= 1) : L;
      if (locked.length === 1) c = c.filter((l) => l === locked[0]);
      return c.length ? rand(c) : null;
    };
    const neighbour = (blocked) => (this.lastFree !== blocked ? this.lastFree : blocked === 1 ? rand([0, 2]) : 1);

    const opts = [['single', 3]];
    if (this.rowCount >= 3) {
      if (!locked.length) opts.push(['wallJump', 0.8], ['wallSlide', 0.6]);
      if (d > 0.05) opts.push(['double', 1 + 2 * d]);
      if (d > 0.2) opts.push(['mixed', 1 + d]);
      if (d > 0.08) opts.push(['trains', 1 + d]);
      if (d > 0.35 && !locked.length) opts.push(['jumpSlide', 0.8]);
    }
    let name = weighted(opts);
    if (this.lastWall && ['wallJump', 'wallSlide'].includes(name)) name = 'single';

    let items = [], free = this.lastFree, wall = false;
    const single = () => {
      if (!unlocked.length) return;
      const b = rand(unlocked); items = [{ lane: b, type: blocker() }]; free = neighbour(b);
    };
    if (name === 'single') single();
    else if (name === 'wallJump' || name === 'wallSlide') {
      items = L.map((l) => ({ lane: l, type: name === 'wallJump' ? 'barrier' : 'overhead' })); wall = true;
    } else if (name === 'jumpSlide') {
      const t = L.slice().sort(() => Math.random() - 0.5); const types = ['barrier', 'overhead', 'roadblock'];
      items = t.map((l, i) => ({ lane: l, type: types[i] })); free = t[0];
    } else {
      const f = pickFree();
      if (f === null) single();
      else if (name === 'double') { free = f; items = L.filter((l) => l !== f).map((l) => ({ lane: l, type: blocker() })); }
      else if (name === 'mixed') {
        free = f;
        items = L.map((l) => ({ lane: l, type: l === f ? rand(['barrier', 'overhead']) : rand(['roadblock', 'equipment', 'train']) }));
      } else if (name === 'trains') {
        const two = d > 0.35 && Math.random() < 0.55;
        const lanes = two ? L.filter((l) => l !== f) : [rand(unlocked.length ? unlocked : [f])];
        free = two ? f : neighbour(lanes[0]);
        items = lanes.map((l) => ({ lane: l, type: allowMoving && !locked.includes(l) && Math.random() < 0.25 + 0.4 * d ? 'mtrain' : 'train' }));
      }
    }
    this.lastFree = free; this.lastWall = wall; this.rowCount++;
    return { name, items, wall, halfD: items.reduce((m, i) => Math.max(m, HALF[i.type]), 0.5) };
  }

  spawnPlan(plan, z, distance) {
    for (const it of plan.items) {
      const moving = it.type === 'mtrain';
      this.acquire(it.type, it.lane, moving ? z * (1 + F) : z); // moving trains start further away so they arrive on schedule
      if (moving) this.laneLock[it.lane] = distance + (-SPAWN_Z * F) / (1 + F) + 15;
    }
  }

  update(dt, speed, distance, difficulty, canSpawn) {
    this.time += dt;
    const on = Math.floor(this.time * 4) % 2 === 0;
    mats.lampRed.color.setHex(on ? 0xff2a2a : 0x551111);
    mats.lampAmber.color.setHex(on ? 0x553300 : 0xffa400);

    for (let i = this.active.length - 1; i >= 0; i--) {
      const o = this.active[i];
      o.position.z += speed * o.userData.speedMul * dt;
      if (o.position.z - o.userData.halfD > DESPAWN_Z) this.release(o);
    }
    if (canSpawn && distance >= this.nextSpawnDistance) {
      const plan = this.pending, gap = this.pendingGap;
      const locked = [0, 1, 2].filter((l) => distance < this.laneLock[l]);
      this.spawnPlan(plan, SPAWN_Z, distance);
      this.onRow?.({ z: SPAWN_Z, gap, plan, prevPlan: this.prevPlan, locked });
      this.prevPlan = plan;
      this.pending = this.planRow(difficulty, distance + 18, speed);
      this.pendingGap = this.gapFor(plan, this.pending, speed);
      this.nextSpawnDistance = Math.max(this.nextSpawnDistance, distance - 1) + this.pendingGap;
    }
  }
}