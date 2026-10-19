// ============================================================
// effects.js — 粒子火花、伤害飘字、屏幕震动、护盾/光环、横幅
// ============================================================
import * as THREE from 'three';

const sharedBox = new THREE.BoxGeometry(0.09, 0.09, 0.09);

class EffectManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.particles = [];
    this.rings = [];
    this.pops = [];
    this.lights = [];
    this.shakeAmt = 0;
    this.shakeT = 0;
    this.tmp = new THREE.Vector3();
  }

  // 命中火花
  hitBurst(pos, color = '#ffd35e', count = 10, power = 1) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(sharedBox, new THREE.MeshBasicMaterial({
        color: new THREE.Color(i % 3 === 0 ? '#ffffff' : color), transparent: true }));
      m.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 2.4 + 0.4;
      const sp = (2.5 + Math.random() * 3.5) * power;
      m.userData = {
        vx: Math.cos(a) * sp, vy: up * sp, vz: Math.sin(a) * sp * 0.4,
        life: 22 + Math.random() * 10, age: 0, rot: Math.random() * 0.4,
        material: m.material,
      };
      this.scene.add(m);
      this.particles.push(m);
    }
    // 命中闪光
    const l = new THREE.PointLight(color, 3 * power, 3.2 * power, 2);
    l.position.copy(pos);
    l.userData = { age: 0, life: 7, material: null };
    this.scene.add(l);
    this.lights.push(l);
  }

  // 冲击气浪环
  ring(pos, color = '#ffcf6a') {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 8, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide }));
    r.position.copy(pos);
    r.userData = { age: 0, life: 18 };
    this.scene.add(r);
    this.rings.push(r);
  }

  // 摩托尾烟
  smoke(pos) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#cfc8c0', transparent: true, opacity: 0.5 }));
    m.position.copy(pos);
    m.userData = { vx: -1 - Math.random(), vy: 0.6 + Math.random() * 0.6, vz: 0,
      life: 26, age: 0, grow: 0.04, material: m.material };
    this.scene.add(m);
    this.particles.push(m);
  }

  // 外卖小票雨（肥嘟嘟大必杀）
  receiptsRain() {
    const colors = ['#ffd35e', '#ffb020', '#f5e6c8'];
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.22),
        new THREE.MeshBasicMaterial({ color: colors[i % 3], side: THREE.DoubleSide, transparent: true }));
      m.position.set((Math.random() - 0.5) * 12, 3 + Math.random() * 4, (Math.random() - 0.5) * 3);
      m.userData = {
        vx: (Math.random() - 0.5) * 1.5, vy: -1.5 - Math.random(), vz: 0,
        life: 110, age: 0, rot: Math.random() * 0.15, material: m.material,
        rx: Math.random() * 0.15, rz: Math.random() * 0.15,
      };
      this.scene.add(m);
      this.particles.push(m);
    }
  }

  shake(amount) {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
    this.shakeT = 12;
  }

  // 世界坐标 → 屏幕坐标
  project(pos) {
    this.tmp.copy(pos).project(this.camera);
    return {
      x: (this.tmp.x * 0.5 + 0.5) * window.innerWidth,
      y: (-this.tmp.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  // 伤害飘字（DOM）
  pop(pos, text, cls = '', life = 48) {
    const el = document.createElement('div');
    el.className = 'dmg-pop ' + cls;
    el.textContent = text;
    document.getElementById('ui').appendChild(el);
    this.pops.push({ el, pos: pos.clone(), age: 0, life });
  }

  // 大字横幅（DOM）
  banner(text, sub = '', dur = 1400) {
    const el = document.getElementById('big-banner');
    el.innerHTML = `<div class="bb-txt">${text}</div>${sub ? `<div class="bb-sub">${sub}</div>` : ''}`;
    el.classList.remove('show');
    void el.offsetWidth; // 重置动画
    el.classList.add('show');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => el.classList.remove('show'), dur);
  }

  ultraBanner(cn, en) {
    const ov = document.getElementById('ultra-overlay');
    document.getElementById('ultra-cn').textContent = cn;
    document.getElementById('ultra-en').textContent = en;
    ov.classList.remove('show');
    void ov.offsetWidth;
    ov.classList.add('show');
    clearTimeout(this._ultraTimer);
    this._ultraTimer = setTimeout(() => ov.classList.remove('show'), 1500);
  }

  // 护盾泡
  createShield() {
    const g = new THREE.Group();
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 14),
      new THREE.MeshBasicMaterial({ color: '#3ee08a', transparent: true, opacity: 0.18, depthWrite: false }));
    bubble.scale.set(0.7, 1.05, 0.7);
    bubble.position.y = 1.0;
    const wire = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.03, 8, 32),
      new THREE.MeshBasicMaterial({ color: '#9ff7c6', transparent: true, opacity: 0.7 }));
    wire.rotation.x = Math.PI / 2;
    wire.position.y = 1.0;
    g.add(bubble, wire);
    g.visible = false;
    g.userData = { bubble, wire };
    return g;
  }

  // 爆气光环
  createOverdrive() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.08, 12, 40),
      new THREE.MeshBasicMaterial({ color: '#ffd35e', transparent: true, opacity: 0.9 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#ff9d24', transparent: true, opacity: 0.18, depthWrite: false }));
    glow.position.y = 1.0;
    const light = new THREE.PointLight('#ffb020', 1.2, 4);
    light.position.y = 1.2;
    g.add(ring, glow, light);
    g.visible = false;
    g.userData = { ring, glow, light };
    return g;
  }

  update(dt) {
    // 粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const u = p.userData;
      u.age++;
      u.vy -= 0.28;
      p.position.x += u.vx * dt;
      p.position.y += u.vy * dt;
      p.position.z += u.vz * dt;
      p.rotation.x += u.rot || 0.2;
      p.rotation.z += (u.rz || 0.2);
      if (u.grow) p.scale.setScalar(1 + u.age * u.grow);
      if (u.material) {
        const k = 1 - u.age / u.life;
        u.material.opacity = Math.max(0, k) * 0.9;
      }
      if (p.position.y < 0.02 && u.vy < 0) { u.vy = 0; u.vx *= 0.7; }
      if (u.age >= u.life) {
        this.scene.remove(p);
        u.material?.dispose();
        this.particles.splice(i, 1);
      }
    }
    // 气浪环
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.userData.age++;
      const k = r.userData.age / r.userData.life;
      const s = 1 + k * 3.2;
      r.scale.set(s, s, s);
      r.material.opacity = 1 - k;
      r.rotation.x += 0.05;
      if (k >= 1) {
        this.scene.remove(r);
        r.material.dispose();
        this.rings.splice(i, 1);
      }
    }
    // 闪光
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i];
      l.userData.age++;
      l.intensity = 3 * (1 - l.userData.age / l.userData.life);
      if (l.userData.age >= l.userData.life) {
        this.scene.remove(l);
        this.lights.splice(i, 1);
      }
    }
    // 飘字
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.age++;
      const sp = this.project(p.pos);
      p.el.style.left = sp.x + 'px';
      p.el.style.top = sp.y + 'px';
      if (p.age >= p.life) {
        p.el.remove();
        this.pops.splice(i, 1);
      }
    }
    // 震动衰减
    if (this.shakeT > 0) {
      this.shakeT--;
      this.shakeAmt *= 0.86;
    } else {
      this.shakeAmt = 0;
    }
  }

  shakeOffset() {
    if (this.shakeAmt <= 0) return new THREE.Vector3();
    return new THREE.Vector3(
      (Math.random() - 0.5) * this.shakeAmt,
      (Math.random() - 0.5) * this.shakeAmt * 0.6, 0);
  }
}

export { EffectManager };
