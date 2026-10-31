// Pooled particles (one InstancedMesh = one draw call) and speed streaks.
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

export class ParticleSystem {
  constructor(scene, max = 360) {
    this.max = max; this.cursor = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    _s.set(0, 0, 0);
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, _m.compose(_p.set(0, -100, 0), _q.identity(), _s));
      this.mesh.setColorAt(i, _c.set(0xffffff));
    }
    scene.add(this.mesh);
    this.items = Array.from({ length: max }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0.1, g: 0, world: true, dirty: false }));
  }

  emit(x, y, z, count, o = {}) {
    const { color = 0xffffff, speed = 4, life = 0.6, size = 0.15, gravity = 9, up = 1, vz = 0, world = true } = o;
    for (let n = 0; n < count; n++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
      const p = this.items[i];
      p.x = x; p.y = y; p.z = z;
      p.vx = (Math.random() - 0.5) * 2 * speed; p.vy = Math.random() * speed * up; p.vz = (Math.random() - 0.5) * 2 * speed + vz;
      p.life = p.max = life * (0.6 + Math.random() * 0.8);
      p.size = size * (0.6 + Math.random() * 0.8); p.g = gravity; p.world = world; p.dirty = true;
      this.mesh.setColorAt(i, _c.set(color));
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt, worldSpeed) {
    for (let i = 0; i < this.max; i++) {
      const p = this.items[i];
      if (p.life <= 0 && !p.dirty) continue;
      p.life -= dt;
      p.vy -= p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += (p.vz + (p.world ? worldSpeed : 0)) * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.4; }
      const k = Math.max(0, p.life / p.max) * p.size;
      _s.set(k, k, k);
      this.mesh.setMatrixAt(i, _m.compose(_p.set(p.x, p.y, p.z), _q.identity(), _s));
      if (p.life <= 0) p.dirty = false;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() { this.items.forEach((p) => { p.life = 0; p.dirty = true; }); }
}

export class SpeedLines {
  constructor(scene, count = 36) {
    const geo = new THREE.BoxGeometry(0.03, 0.03, 1);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0, depthWrite: false });
    this.lines = [];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, this.mat);
      this.place(m, true);
      scene.add(m); this.lines.push(m);
    }
  }
  place(m, anywhere) {
    const side = Math.random() < 0.5 ? -1 : 1;
    m.position.set(side * (4.5 + Math.random() * 8), 0.5 + Math.random() * 6, anywhere ? 8 - Math.random() * 80 : -85 - Math.random() * 20);
  }
  update(dt, speed) {
    const op = Math.min(1, Math.max(0, (speed - 20) / 16)) * 0.45;
    this.mat.opacity = op;
    for (const m of this.lines) {
      m.visible = op > 0.01;
      m.scale.z = 2 + speed * 0.25;
      m.position.z += speed * 1.6 * dt;
      if (m.position.z > 10) this.place(m, false);
    }
  }
}