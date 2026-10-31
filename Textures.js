

// Procedural canvas textures: no image files needed.
import * as THREE from 'three';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, rx = 1, ry = 1, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }
  t.anisotropy = 4;
  return t;
}

export function makeHazardTexture(a = '#ffcc00', b = '#15151c') {
  const c = canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = b; g.fillRect(0, 0, 128, 128);
  g.fillStyle = a;
  for (let i = -128; i < 128; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 144, 128); g.lineTo(i + 128, 128); g.closePath(); g.fill();
  }
  return tex(c, 1, 1, true);
}

export function makeFacadeTexture(variant = 0) {
  const c = canvas(256, 512), g = c.getContext('2d');
  const bases = ['#0e1030', '#150c2c', '#0a1a30'];
  g.fillStyle = bases[variant % 3]; g.fillRect(0, 0, 256, 512);
  const pal = ['#ffd27a', '#7af0ff', '#ff7ad9', '#ffffff', '#9aff7a'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
    if (Math.random() < 0.55) {
      g.fillStyle = pal[(Math.random() * pal.length) | 0];
      g.globalAlpha = 0.45 + Math.random() * 0.5;
      g.fillRect(x * 32 + 6, y * 32 + 6, 20, 20);
    }
  }
  g.globalAlpha = 1;
  g.fillStyle = variant % 2 ? '#00e5ff' : '#ff2bd6';
  g.fillRect(0, 0, 4, 512); g.fillRect(252, 0, 4, 512);
  return tex(c, 1, 1, true);
}

export function makeNeonTexture(text, color = '#00e5ff') {
  const c = canvas(512, 160), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 160);
  g.strokeStyle = color; g.lineWidth = 6; g.shadowColor = color; g.shadowBlur = 18;
  g.strokeRect(12, 12, 488, 136);
  g.fillStyle = color; g.font = 'bold 84px Impact, Arial Black, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 84);
  return tex(c);
}

export function makeGlowTexture() {
  const c = canvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return tex(c);
}

export function makeGravelTexture() {
  const c = canvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#2a2236'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 40 + Math.random() * 60;
    g.fillStyle = `rgb(${v},${v - 6},${v + 12})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  return tex(c, 3, 12, true);
}

export function makeBadgeTexture(text, bg = '#ffd23f', fg = '#2a1a00') {
  const c = canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
  g.fillStyle = fg; g.font = 'bold 64px Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 68);
  return tex(c);
}

export function makeSkyTexture() {
  const c = canvas(8, 512), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  [[0, '#04020c'], [0.4, '#150a3d'], [0.58, '#5b2290'], [0.66, '#ff5fa2'], [0.72, '#3a1470'], [1, '#120a2e']]
    .forEach(([p, col]) => gr.addColorStop(p, col));
  g.fillStyle = gr; g.fillRect(0, 0, 8, 512);
  return tex(c);
}

export function makeSunTexture() {
  const c = canvas(256, 256), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 30, 0, 230);
  gr.addColorStop(0, '#fff06a'); gr.addColorStop(1, '#ff2bd6');
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 100, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 6; i++) g.fillRect(0, 140 + i * 16, 256, 2 + i * 1.6);
  return tex(c);
}