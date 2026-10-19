// ============================================================
// scenes.js — 两个战斗场景（室内舞台 / 梗王大排档）
// ============================================================
import * as THREE from 'three';

function stdMat(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.85, ...o });
}

// 生成文字牌纹理
function signTexture(text, opts = {}) {
  const { w = 512, h = 256, bg = '#3a1d10', fg = '#ffd35e', font = 'bold 140px serif',
    border = '#7a4a18', neon = false } = opts;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  if (neon) {
    ctx.shadowColor = fg; ctx.shadowBlur = 30;
  }
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((ln, i) => {
    ctx.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (h / (lines.length + 1)));
  });
  ctx.shadowBlur = 0;
  if (border) {
    ctx.strokeStyle = border; ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  }
  return new THREE.CanvasTexture(cv);
}

// 红灯笼
function lantern(x, y, z, s = 1) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 16, 12),
    stdMat('#e23b30', { emissive: new THREE.Color('#a01010'), emissiveIntensity: 0.9 }));
  body.scale.y = 1.25;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 0.05 * s, 12), stdMat('#f0c040'));
  top.position.y = 0.28 * s;
  const bot = top.clone(); bot.position.y = -0.28 * s;
  const light = new THREE.PointLight('#ff7a30', 0.9, 4 * s, 2);
  light.position.y = 0;
  g.add(body, top, bot, light);
  g.position.set(x, y, z);
  g.userData.light = light;
  return g;
}

// 地面
function ground(color, rough = 0.9) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 5),
    stdMat(color, { roughness: rough }));
  m.position.y = -0.2;
  m.receiveShadow = true;
  return m;
}

// ---------- 场景 1：室内舞台 ----------
function buildStageRoom() {
  const g = new THREE.Group();
  g.add(ground('#2a1f24'));

  // 背景墙
  const wall = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 0.4), stdMat('#221825'));
  wall.position.set(0, 3.2, -3.2);
  wall.receiveShadow = true;
  g.add(wall);

  // 中央圆形光圈装饰
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4 + i * 0.55, 0.025, 8, 60),
      stdMat('#6a4520', { emissive: new THREE.Color('#ff9d24'), emissiveIntensity: 0.35 }));
    ring.position.set(0, 2.2, -2.95);
    g.add(ring);
  }

  // 红色幕布（两侧）
  const curtainMat = stdMat('#5a1518', { roughness: 1 });
  [-1, 1].forEach(s => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(2.2, 7, 0.2), curtainMat);
    c.position.set(s * 6.4, 3.2, -2.9);
    g.add(c);
    // 褶皱
    for (let i = -2; i <= 2; i++) {
      const fold = new THREE.Mesh(new THREE.BoxGeometry(0.12, 7, 0.12),
        stdMat('#3d0d10', { roughness: 1 }));
      fold.position.set(s * 6.4 + i * 0.35, 3.2, -2.78);
      g.add(fold);
    }
  });

  // 顶部横杆
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 14, 12), stdMat('#151018'));
  pole.rotation.z = Math.PI / 2;
  pole.position.set(0, 5.6, -2.2);
  g.add(pole);

  // 灯笼
  const l1 = lantern(-3.4, 4.6, -2.2, 1.1);
  const l2 = lantern(3.4, 4.6, -2.2, 1.1);
  g.add(l1, l2);

  // 中央"笑"字牌（压在圆环中心）
  const tex = signTexture('笑', { w: 300, h: 380, bg: '#e8dcb8', fg: '#5a2400', border: '#b09860', font: 'bold 240px serif' });
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.35, 0.1),
    stdMat('#e8dcb8', { map: tex }));
  board.position.set(0, 2.1, -2.82);
  g.add(board);

  // 顶部两盏聚光灯效果（发光圈）
  const spotTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');
    const grd = ctx.createRadialGradient(128, 128, 20, 128, 128, 120);
    grd.addColorStop(0, 'rgba(255,210,120,.55)');
    grd.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(cv);
  })();
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(5, 5),
    new THREE.MeshBasicMaterial({ map: spotTex, transparent: true, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.03;
  g.add(glow);

  g.userData.flicker = [l1, l2];
  return g;
}

// ---------- 场景 2：梗王大排档 ----------
function buildFoodStall() {
  const g = new THREE.Group();
  g.add(ground('#3a3540'));

  // 夜市背景：紫黑色大墙
  const sky = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 0.4),
    stdMat('#1b1430'));
  sky.position.set(0, 4, -5.5);
  g.add(sky);

  // 月亮
  const moon = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32),
    stdMat('#ffe8b0', { emissive: new THREE.Color('#ffd070'), emissiveIntensity: 0.8 }));
  moon.position.set(4.6, 5.6, -5.2);
  g.add(moon);

  // 楼房剪影 + 窗户
  const winMat = stdMat('#ffca6a', { emissive: new THREE.Color('#ff9d24'), emissiveIntensity: 0.8 });
  const winOff = stdMat('#2a2440');
  const buildings = [
    [-6, 3.4, 2.2], [-3.6, 4.6, 2.6], [-0.9, 2.8, 2.0], [1.8, 4.0, 2.4], [4.4, 3.2, 2.1], [6.6, 5.0, 2.8],
  ];
  buildings.forEach(([x, h, w], idx) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), stdMat('#100c20'));
    b.position.set(x, h / 2 - 0.2, -5.0);
    g.add(b);
    // 窗户
    for (let r = 0; r < Math.floor(h / 0.7); r++) {
      for (let c = 0; c < Math.floor(w / 0.7); c++) {
        if ((r * 7 + c * 3 + idx) % 4 === 0) continue;
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.04),
          (r + c + idx) % 3 === 0 ? winOff : winMat);
        win.position.set(x - w / 2 + 0.3 + c * 0.6, 0.3 + r * 0.6, -4.72);
        g.add(win);
      }
    }
  });

  // 大排档招牌（左后方）
  const signTex = signTexture('梗王大排档', { w: 1024, h: 280, bg: '#1a0a0a', fg: '#ff5a2e', border: '#ff5a2e', neon: true, font: 'bold 150px serif' });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.15, 0.12),
    stdMat('#1a0a0a', { map: signTex, emissive: new THREE.Color('#ff5a2e'), emissiveIntensity: 0.25, emissiveMap: signTex }));
  sign.position.set(-4.2, 3.1, -3.6);
  g.add(sign);

  // 右侧霓虹竖牌
  const neTex = signTexture('限时爆改', { w: 240, h: 640, bg: '#101220', fg: '#49d6ff', border: '#49d6ff', neon: true, font: 'bold 100px serif' });
  const ne = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.0, 0.1),
    stdMat('#101220', { map: neTex, emissive: new THREE.Color('#49d6ff'), emissiveIntensity: 0.3, emissiveMap: neTex }));
  ne.position.set(4.9, 2.4, -3.8);
  g.add(ne);

  // 黄黑斜纹路障
  const stripeTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffcf2e'; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#1a1a1a';
    for (let i = -128; i < 256; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 128); ctx.lineTo(i + 20, 128); ctx.lineTo(i + 148, 0); ctx.lineTo(i + 128, 0);
      ctx.fill();
    }
    return new THREE.CanvasTexture(cv);
  })();
  stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping;
  stripeTex.repeat.set(2, 1);
  [-5.6, 5.6].forEach(x => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.2),
      stdMat('#fff', { map: stripeTex }));
    bar.position.set(x, 0.55, -1.9);
    g.add(bar);
    // 支架
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), stdMat('#333'));
    leg1.position.set(x - 0.7, 0.25, -1.9);
    const leg2 = leg1.clone(); leg2.position.x = x + 0.7;
    g.add(bar, leg1, leg2);
  });

  // 灯笼串（头顶一排）
  const lanterns = [];
  for (let i = -3; i <= 3; i++) {
    const l = lantern(i * 1.6, 4.8 - Math.abs(i) * 0.18, -2.6, 0.8);
    lanterns.push(l);
    g.add(l);
    // 线
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 6), stdMat('#222'));
    wire.position.set(i * 1.6, 5.2 - Math.abs(i) * 0.18, -2.6);
    g.add(wire);
  }

  // 灯泡串（青蓝小圆）
  for (let i = -4; i <= 4; i++) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8),
      stdMat('#9feaff', { emissive: new THREE.Color('#49d6ff'), emissiveIntensity: 1.2 }));
    bulb.position.set(i * 0.9, 4.2, -2.4);
    g.add(bulb);
  }

  g.userData.flicker = lanterns;
  return g;
}

// ---------- 灯光（两场景共用） ----------
export function buildLights() {
  const g = new THREE.Group();
  const hemi = new THREE.HemisphereLight('#ffe9c0', '#201428', 0.85);
  const key = new THREE.DirectionalLight('#fff2d8', 1.25);
  key.position.set(3, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -9; key.shadow.camera.right = 9;
  key.shadow.camera.top = 9; key.shadow.camera.bottom = -3;
  key.shadow.camera.far = 30;
  const rim = new THREE.DirectionalLight('#ff7a30', 0.5);
  rim.position.set(-5, 4, -4);
  g.add(hemi, key, rim);
  return g;
}

// ---------- 工厂 ----------
export function buildStageScene(id) {
  const g = id === 'foodstall' ? buildFoodStall() : buildStageRoom();
  return g;
}

// 场景灯光闪烁
export function updateScene(group, t) {
  const list = group.userData.flicker;
  if (list) {
    list.forEach((l, i) => {
      const light = l.userData.light;
      if (light) light.intensity = 0.85 + Math.sin(t * 0.15 + i * 2) * 0.12;
    });
  }
}
