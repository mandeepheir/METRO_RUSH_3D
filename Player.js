import * as THREE from 'three';
import { LANES, GRAVITY, JUMP_VELOCITY, SLIDE_TIME, STAND_HEIGHT, SLIDE_HEIGHT, JETPACK_HEIGHT } from './Constants.js';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export class Player {
  constructor(scene) {
    this.group = new THREE.Group();
    this.model = new THREE.Group();
    this.group.add(this.model);
    this.m = {
      suit: new THREE.MeshStandardMaterial({ roughness: 0.55 }),
      accent: new THREE.MeshStandardMaterial({ roughness: 0.4, emissiveIntensity: 0.35 }),
      skin: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      hair: new THREE.MeshStandardMaterial({ roughness: 0.7 }),
      visor: new THREE.MeshBasicMaterial({ color: 0x66f6ff }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1b1d2a, roughness: 0.6 }),
    };
    this.build();
    scene.add(this.group);
    this.time = 0;
    this.reset();
  }

  part(geo, mat, x, y, z, parent = this.model) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
  }
  pivot(x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); this.model.add(g); return g; }

  build() {
    const { suit, accent, skin, hair, visor, dark } = this.m;
    this.part(new THREE.BoxGeometry(0.72, 0.85, 0.42), suit, 0, 1.25, 0);
    this.part(new THREE.BoxGeometry(0.75, 0.12, 0.45), accent, 0, 0.88, 0);
    this.part(new THREE.SphereGeometry(0.3, 20, 16), skin, 0, 1.95, 0);
    this.part(new THREE.SphereGeometry(0.33, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), hair, 0, 2.0, 0.02);
    this.part(new THREE.BoxGeometry(0.4, 0.05, 0.3), accent, 0, 1.99, -0.3);
    this.part(new THREE.BoxGeometry(0.46, 0.11, 0.1), visor, 0, 1.93, -0.27);
    this.part(new THREE.BoxGeometry(0.5, 0.6, 0.22), dark, 0, 1.3, 0.32);
    // arms and legs hang from pivot groups so they swing from the shoulder/hip
    this.armL = this.pivot(-0.5, 1.6, 0); this.armR = this.pivot(0.5, 1.6, 0);
    this.legL = this.pivot(-0.2, 0.85, 0); this.legR = this.pivot(0.2, 0.85, 0);
    [this.armL, this.armR].forEach((a) => {
      this.part(new THREE.BoxGeometry(0.2, 0.62, 0.2), suit, 0, -0.3, 0, a);
      this.part(new THREE.SphereGeometry(0.11, 10, 8), skin, 0, -0.66, 0, a);
    });
    [this.legL, this.legR].forEach((l) => {
      this.part(new THREE.BoxGeometry(0.27, 0.7, 0.29), dark, 0, -0.35, 0, l);
      this.part(new THREE.BoxGeometry(0.31, 0.16, 0.44), accent, 0, -0.74, -0.06, l);
    });
    // jetpack tanks + flames
    this.jet = new THREE.Group(); this.jet.position.set(0, 1.25, 0.5); this.model.add(this.jet);
    const tank = new THREE.MeshStandardMaterial({ color: 0xff8a1f, roughness: 0.4, metalness: 0.4 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    this.flames = [];
    [-0.17, 0.17].forEach((x) => {
      this.part(new THREE.CylinderGeometry(0.13, 0.13, 0.75, 12), tank, x, 0, 0, this.jet);
      const f = this.part(new THREE.ConeGeometry(0.12, 0.7, 10), flameMat, x, -0.72, 0, this.jet);
      f.rotation.x = Math.PI; f.castShadow = false; this.flames.push(f);
    });
    this.jet.visible = false;
    // shield bubble
    this.shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x3dd9ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.shieldMesh.position.y = 1.1; this.shieldMesh.visible = false; this.group.add(this.shieldMesh);
  }

  setCharacter(def) {
    this.m.suit.color.set(def.suit);
    this.m.accent.color.set(def.accent); this.m.accent.emissive.set(def.accent);
    this.m.skin.color.set(def.skin); this.m.hair.color.set(def.hair);
  }

  reset() {
    this.lane = 1; this.prevLane = 1; this.targetX = LANES[1];
    this.y = 0; this.vy = 0; this.onGround = true; this.landed = false;
    this.sliding = false; this.slideTimer = 0; this.wantSlide = false;
    this.jetpack = false; this.shield = false; this.dead = false;
    this.invuln = 0; this.bumpTimer = 0; this.idle = false; this.yaw = 0;
    this.animTime = 0;
    this.group.position.set(LANES[1], 0, 0); this.group.rotation.set(0, 0, 0);
    this.model.rotation.set(0, 0, 0); this.model.position.set(0, 0, 0); this.model.visible = true;
    this.jet.visible = false; this.shieldMesh.visible = false;
  }

  get invulnerable() { return this.invuln > 0 || this.jetpack; }
  get changingLane() { return Math.abs(this.targetX - this.group.position.x) > 0.15; }

  moveLeft() { return this.setLane(this.lane - 1); }
  moveRight() { return this.setLane(this.lane + 1); }
  setLane(i) {
    if (this.dead || i < 0 || i > 2 || i === this.lane) return false;
    this.prevLane = this.lane; this.lane = i; this.targetX = LANES[i];
    return true;
  }
  tryBump() { // scraped sideways into something: go back instead of crashing
    if (!this.changingLane || this.lane === this.prevLane || this.bumpTimer > 0) return false;
    this.lane = this.prevLane; this.targetX = LANES[this.lane]; this.bumpTimer = 0.35;
    return true;
  }

  jump() {
    if (this.dead || this.jetpack || !this.onGround) return false;
    this.vy = JUMP_VELOCITY; this.onGround = false; this.sliding = false; this.slideTimer = 0;
    return true;
  }
  slide() { // returns 'slide', 'dive' or null
    if (this.dead || this.jetpack) return null;
    if (this.onGround) { this.sliding = true; this.slideTimer = SLIDE_TIME; return 'slide'; }
    this.vy = -JUMP_VELOCITY * 1.6; this.wantSlide = true; return 'dive';
  }

  startJetpack() { this.jetpack = true; this.jet.visible = true; this.sliding = false; }
  stopJetpack() { this.jetpack = false; this.jet.visible = false; this.vy = 0; }
  setShield(on) { this.shield = on; this.shieldMesh.visible = on; }
  crash() { this.dead = true; this.sliding = false; this.vy = 6; this.onGround = false; this.targetX = this.group.position.x; this.jet.visible = false; this.shieldMesh.visible = false; }

  getBox(o) {
    const x = this.group.position.x, h = this.sliding ? SLIDE_HEIGHT : STAND_HEIGHT;
    o.minX = x - 0.36; o.maxX = x + 0.36; o.minY = this.y + 0.05; o.maxY = this.y + h; o.minZ = -0.5; o.maxZ = 0.5;
    return o;
  }

  update(dt, speed) {
    this.time += dt;
    const p = this.group.position;
    p.x = damp(p.x, this.targetX, 16, dt);
    const dx = this.targetX - p.x;

    // vertical motion
    this.landed = false;
    if (this.jetpack) {
      this.y = damp(this.y, JETPACK_HEIGHT, 3.5, dt); this.vy = 0; this.onGround = false;
    } else if (!this.onGround) {
      this.vy -= GRAVITY * dt; this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0; this.onGround = true; this.landed = true;
        if (this.wantSlide && !this.dead) { this.sliding = true; this.slideTimer = SLIDE_TIME; }
        this.wantSlide = false;
      }
    }
    if (this.sliding) { this.slideTimer -= dt; if (this.slideTimer <= 0) this.sliding = false; }
    this.invuln = Math.max(0, this.invuln - dt);
    this.bumpTimer = Math.max(0, this.bumpTimer - dt);
    p.y = this.y;

    // shield & flame visuals
    if (this.shield) { this.shieldMesh.rotation.y += dt * 2; this.shieldMesh.material.opacity = 0.18 + Math.sin(this.time * 6) * 0.06; }
    if (this.jet.visible) this.flames.forEach((f) => { f.scale.y = 0.8 + Math.random() * 0.6; });
    this.model.visible = !(this.invuln > 0 && !this.jetpack) || Math.floor(this.time * 18) % 2 === 0;

    this.animate(dt, speed, dx);
  }

  animate(dt, speed, dx) {
    this.animTime += dt * (7 + speed * 0.45);
    const s = Math.sin(this.animTime);
    let leg = [0, 0], arm = [0, 0], lean = -0.12, my = 0, mz = 0, yaw = 0;

    if (this.dead) { lean = -1.35; leg = [0.4, -0.4]; arm = [2.4, 2.4]; my = 0.18; }
    else if (this.idle) { arm = [0.15 + Math.sin(this.time * 2) * 0.05, 0.15]; lean = 0; yaw = this.yaw; my = Math.sin(this.time * 2) * 0.02; }
    else if (this.jetpack) { lean = -0.4; leg = [0.35 + s * 0.1, 0.2 - s * 0.1]; arm = [0.6, 0.6]; }
    else if (this.sliding) { lean = 1.25; my = 0.38; mz = -0.25; leg = [0, 0]; arm = [2.2, 2.2]; }
    else if (!this.onGround) { leg = [0.95, -0.5]; arm = [2.3, 2.0]; lean = -0.1; }
    else { leg = [s * 1.0, -s * 1.0]; arm = [-s * 0.9, s * 0.9]; my = Math.abs(Math.sin(this.animTime)) * 0.09; }

    const k = this.dead ? 10 : 18, m = this.model;
    this.legL.rotation.x = damp(this.legL.rotation.x, leg[0], k, dt);
    this.legR.rotation.x = damp(this.legR.rotation.x, leg[1], k, dt);
    this.armL.rotation.x = damp(this.armL.rotation.x, arm[0], k, dt);
    this.armR.rotation.x = damp(this.armR.rotation.x, arm[1], k, dt);
    m.rotation.x = damp(m.rotation.x, lean, k, dt);
    m.rotation.y = damp(m.rotation.y, yaw, 6, dt);
    m.position.y = damp(m.position.y, my, k, dt);
    m.position.z = damp(m.position.z, mz, k, dt);
    this.group.rotation.z = damp(this.group.rotation.z, -dx * 0.14, 12, dt); // lean into lane change
  }
}