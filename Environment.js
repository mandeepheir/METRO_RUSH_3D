// Endless world: 5 recycled segments, each re-randomised as city / tunnel / station.
// Nothing is created or destroyed while playing, so memory stays flat.
import * as THREE from 'three';
import { LANES, LANE_WIDTH, TRACK_HALF } from './Constants.js';
import * as TX from './Textures.js';

const L = 48, COUNT = 5;
const BOX = new THREE.BoxGeometry(1, 1, 1);
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
const basic = (c) => new THREE.MeshBasicMaterial({ color: c });
const rand = (a) => a[(Math.random() * a.length) | 0];

const M = {
  gravel: new THREE.MeshStandardMaterial({ map: TX.makeGravelTexture(), roughness: 1 }),
  rail: std(0x8890b0, { metalness: 0.8, roughness: 0.3 }),
  tie: std(0x3b2a5e),
  platform: std(0x3a3550), dark: std(0x1a1830), wall: std(0x20203a, { roughness: 0.9 }),
  yellow: basic(0xffd400), cyan: basic(0x00e5ff), magenta: basic(0xff2bd6), warm: basic(0xfff2c0), cool: basic(0xcfe8ff),
  pole: std(0x2b2e3a, { metalness: 0.5 }),
  beaconR: basic(0xff2a2a), beaconC: basic(0x00e5ff),
  ring: std(0xff2bd6, { emissive: 0xff2bd6, emissiveIntensity: 0.6 }),
  holo: new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true }),
};
const glowMat = new THREE.SpriteMaterial({ map: TX.makeGlowTexture(), color: 0xffe0a0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });

// building height classes x 2 facade variants (each with its own UV repeat so windows never stretch)
const HEIGHTS = [14, 26, 38];
const facadeBase = [TX.makeFacadeTexture(0), TX.makeFacadeTexture(1)];
const BGEO = HEIGHTS.map((h) => new THREE.BoxGeometry(9, h, 9));
const BMAT = [];
HEIGHTS.forEach((h) => facadeBase.forEach((base) => {
  const t = base.clone(); t.repeat.set(1, h / 18); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true;
  BMAT.push(new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.8 }));
}));

const neonDefs = [['METRO', '#00e5ff'], ['RUSH', '#ff2bd6'], ['NEON', '#a855ff'], ['CYBER', '#39ffb0'], ['HOTEL', '#ffd23f'], ['RAMEN', '#ff5a1f'], ['ARCADE', '#00e5ff'], ['TAXI', '#ffd23f']];
const stationDefs = [['CENTRAL', '#00e5ff'], ['NEON PARK', '#ff2bd6'], ['CYBER SQ', '#39ffb0'], ['METRO CITY', '#ffd23f']];
const NEON = neonDefs.map(([t, c]) => TX.makeNeonTexture(t, c));
const STATION = stationDefs.map(([t, c]) => TX.makeNeonTexture(t, c));
const SIGN_GEO = new THREE.PlaneGeometry(6, 1.9);
const BANNER_GEO = new THREE.PlaneGeometry(7.5, 2.3);

function neonMaterial(map) {
  return new THREE.MeshBasicMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
}
function box(parent, mat, sx, sy, sz, x, y, z, o = {}) {
  const m = new THREE.Mesh(BOX, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  if (o.receive) m.receiveShadow = true;
  parent.add(m); return m;
}
function instanced(parent, geo, mat, items) {
  const im = new THREE.InstancedMesh(geo, mat, items.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  items.forEach((it, i) => im.setMatrixAt(i, m4.compose(new THREE.Vector3(...it.p), q, new THREE.Vector3(...it.s))));
  im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; parent.add(im); return im;
}

class Segment {
  constructor() {
    this.group = new THREE.Group();
    this.animated = []; // { obj, kind, speed, phase }
    this.city = new THREE.Group(); this.tunnel = new THREE.Group(); this.station = new THREE.Group();
    this.group.add(this.city, this.tunnel, this.station);
    this.buildTrack(); this.buildPlatforms(); this.buildLamps(); this.buildCity(); this.buildTunnel(); this.buildStation();
  }

  buildTrack() {
    const g = this.group;
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_HALF * 2 + 0.4, L), M.gravel);
    bed.rotation.x = -Math.PI / 2; bed.position.set(0, 0, -L / 2); bed.receiveShadow = true; g.add(bed);
    LANES.forEach((x) => [-0.62, 0.62].forEach((o) => box(g, M.rail, 0.1, 0.12, L, x + o, 0.1, -L / 2)));
    const ties = []; for (let i = 0; i < 24; i++) ties.push({ p: [0, 0.04, -1 - i * 2], s: [LANE_WIDTH * 3 + 0.4, 0.08, 0.4] });
    instanced(g, BOX, M.tie, ties).receiveShadow = true;
    box(g, M.cyan, 0.06, 0.02, L, -LANE_WIDTH / 2, 0.03, -L / 2); box(g, M.magenta, 0.06, 0.02, L, LANE_WIDTH / 2, 0.03, -L / 2);
  }

  buildPlatforms() {
    [-1, 1].forEach((s) => {
      box(this.group, M.platform, 6, 0.7, L, s * 7.6, 0.35, -L / 2, { receive: true });
      box(this.group, M.yellow, 0.25, 0.04, L, s * 4.8, 0.72, -L / 2);
    });
  }

  buildLamps() {
    const poles = [], heads = [];
    [-1, 1].forEach((s) => [-8, -24, -40].forEach((z) => {
      poles.push({ p: [s * 5.3, 3.5, z], s: [0.18, 5.6, 0.18] });
      heads.push({ p: [s * 4.75, 6.35, z], s: [1.3, 0.12, 0.4] });
      const sp = new THREE.Sprite(glowMat); sp.scale.set(6, 6, 1); sp.position.set(s * 4.75, 6.2, z); this.group.add(sp);
    }));
    instanced(this.group, BOX, M.pole, poles); instanced(this.group, BOX, M.warm, heads);
  }

  buildCity() {
    this.buildings = [];
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 6; i++) {
        const far = i >= 4;
        const mesh = new THREE.Mesh(BGEO[0], BMAT[0]); this.city.add(mesh);
        const b = { mesh, side, far, i, sign: null, beacon: null, ring: null };
        if (!far) {
          b.sign = new THREE.Mesh(SIGN_GEO, neonMaterial(NEON[0])); b.sign.rotation.y = -side * Math.PI / 2; mesh.add(b.sign);
          this.animated.push({ obj: b.sign, kind: 'flicker', phase: Math.random() * 10 });
          b.beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), i % 2 ? M.beaconR : M.beaconC); mesh.add(b.beacon);
          if (i === 0) { b.ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 8, 24), M.ring); mesh.add(b.ring); this.animated.push({ obj: b.ring, kind: 'spin', speed: 2.2 }); }
        }
        this.buildings.push(b);
      }
    });
  }

  buildTunnel() {
    const t = this.tunnel;
    [-1, 1].forEach((s) => {
      box(t, M.wall, 0.6, 9.4, L, s * 10.9, 4.7, -L / 2);
      box(t, s < 0 ? M.cyan : M.magenta, 0.1, 0.14, L, s * 10.55, 3, -L / 2);
      box(t, M.cool, 0.2, 0.1, L, s * 3.2, 8.7, -L / 2);
    });
    box(t, M.wall, 22.4, 0.6, L, 0, 9.3, -L / 2);
    for (let i = 0; i < 4; i++) {
      const z = -6 - i * 12;
      box(t, M.dark, 0.9, 9.4, 0.9, -10.6, 4.7, z); box(t, M.dark, 0.9, 9.4, 0.9, 10.6, 4.7, z);
      box(t, M.dark, 22, 0.7, 0.9, 0, 8.9, z);
      box(t, M.yellow, 21, 0.06, 0.96, 0, 8.5, z);
    }
  }

  buildStation() {
    const s = this.station, cols = [];
    this.banners = [];
    [-1, 1].forEach((side) => {
      box(s, M.dark, 6.4, 0.25, L, side * 7.6, 6.6, -L / 2);
      box(s, M.cool, 1.0, 0.05, L, side * 7.6, 6.45, -L / 2); box(s, side < 0 ? M.cyan : M.magenta, 0.1, 0.06, L, side * 5.0, 6.45, -L / 2);
      for (let i = 0; i < 4; i++) cols.push({ p: [side * 10.3, 3.6, -6 - i * 12], s: [0.35, 6, 0.35] });
      for (let i = 0; i < 3; i++) box(s, M.dark, 0.6, 0.45, 2, side * 6.6, 0.95, -8 - i * 14);
      const banner = new THREE.Mesh(BANNER_GEO, neonMaterial(STATION[0])); banner.position.set(side * 4.6, 5.2, -24); banner.rotation.y = -side * Math.PI / 2;
      s.add(banner); this.banners.push(banner); this.animated.push({ obj: banner, kind: 'flicker', phase: Math.random() * 10 });
      const holo = new THREE.Mesh(new THREE.TorusKnotGeometry(0.5, 0.13, 56, 8), M.holo); holo.position.set(side * 7.8, 3.4, -10); s.add(holo);
      this.animated.push({ obj: holo, kind: 'spin', speed: 1.4 });
    });
    instanced(s, BOX, M.dark, cols);
  }

  setMode(mode) {
    this.mode = mode;
    this.city.visible = mode !== 'tunnel'; this.tunnel.visible = mode === 'tunnel'; this.station.visible = mode === 'station';
  }

  randomize() {
    for (const b of this.buildings) {
      const k = b.far ? 2 : (Math.random() * 3) | 0, v = (Math.random() * 2) | 0, h = HEIGHTS[k];
      b.mesh.geometry = BGEO[k]; b.mesh.material = BMAT[k * 2 + v];
      const sy = b.far ? 1 + Math.random() * 0.5 : 1; b.mesh.scale.y = sy;
      const x = b.side * (b.far ? 28 + Math.random() * 5 : 15.5 + Math.random() * 3);
      const z = b.far ? -12 - (b.i - 4) * 24 : -6 - b.i * 12 + (Math.random() - 0.5) * 2;
      b.mesh.position.set(x, (h * sy) / 2 - 0.5, z);
      if (b.sign) {
        b.sign.visible = Math.random() < 0.8;
        b.sign.material.map = rand(NEON);
        const wy = 5 + Math.random() * Math.min(10, h - 8);
        b.sign.position.set(-b.side * 4.55, wy - (h / 2 - 0.5), 0);
        b.beacon.position.y = h / 2 + 0.3;
        if (b.ring) b.ring.position.y = h / 2 + 1;
      }
    }
    this.banners.forEach((bn) => { bn.material.map = rand(STATION); });
  }

  animate(t) {
    for (const a of this.animated) {
      if (a.kind === 'spin') a.obj.rotation.y += 0.016 * a.speed;
      else {
        const base = 0.8 + Math.sin(t * 2 + a.phase) * 0.15;
        const off = Math.sin(t * 23 + a.phase * 5) > 0.97 && Math.sin(t * 1.3 + a.phase) > 0.6;
        a.obj.material.opacity = off ? 0.25 : base;
      }
    }
  }
}

export class Environment {
  constructor(scene) {
    this.scene = scene; this.time = 0;
    scene.background = TX.makeSkyTexture();
    scene.fog = new THREE.Fog(0x2a1058, 45, 165);
    this.addLights(scene); this.addSky(scene);
    this.zoneLeft = 3; this.zoneMode = 'city';
    this.segs = [];
    for (let i = 0; i < COUNT; i++) {
      const s = new Segment(); s.group.position.z = 12 - i * L;
      s.setMode(this.nextMode()); s.randomize(); scene.add(s.group); this.segs.push(s);
    }
  }

  nextMode() {
    if (this.zoneLeft <= 0) {
      const r = Math.random();
      this.zoneMode = r < 0.5 ? 'city' : r < 0.78 ? 'tunnel' : 'station';
      this.zoneLeft = 2 + ((Math.random() * 3) | 0);
    }
    this.zoneLeft--; return this.zoneMode;
  }

  addLights(scene) {
    scene.add(new THREE.HemisphereLight(0x9aa8ff, 0x3a1860, 1.05));
    const rim = new THREE.DirectionalLight(0xff4fd8, 0.45); rim.position.set(-8, 6, -12); scene.add(rim);
    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 1.15);
    sun.position.set(7, 16, 6); sun.target.position.set(0, 0, -14); scene.add(sun, sun.target);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005;
    const c = sun.shadow.camera; c.left = -12; c.right = 12; c.top = 34; c.bottom = -34; c.near = 1; c.far = 70;
  }

  addSky(scene) {
    const sun = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ map: TX.makeSunTexture(), transparent: true, fog: false, depthWrite: false }));
    sun.position.set(0, 42, -235); scene.add(sun);
    const pos = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 1.2, r = 250;
      pos.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, color: 0xffffff, fog: false }));
    this.stars.frustumCulled = false; scene.add(this.stars);
  }

  setShadows(on) { this.sun.castShadow = on; }

  update(dt, speed, camera) {
    this.time += dt;
    for (const s of this.segs) {
      s.group.position.z += speed * dt;
      if (s.group.position.z > 12 + L) { s.group.position.z -= L * COUNT; s.setMode(this.nextMode()); s.randomize(); }
      if (s.group.visible) s.animate(this.time);
    }
    if (camera) this.stars.position.copy(camera.position);
  }
}