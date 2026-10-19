// ============================================================
// characters.js — 奶蛙 & 肥嘟嘟 程序化 3D 建模
// 返回 { group, rig }，模型默认面朝 +Z，正面朝 +Z
// ============================================================
import * as THREE from 'three';
import { CHARACTERS } from './config.js';

function mat(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color: new THREE.Color(color), ...extra });
}
function sphere(r, color, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), typeof color === 'string' ? mat(color) : color);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}
function capsule(r, len, color) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 16), mat(color));
  m.castShadow = true;
  return m;
}
function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}
function cyl(r1, r2, h, color, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat(color));
  m.castShadow = true;
  return m;
}

// ---------- 奶蛙 ----------
function buildNaiwa(c) {
  const C = CHARACTERS.naiwa.colors;
  const rig = {};
  const root = new THREE.Group();

  // 身体（圆胖大球）
  const body = sphere(0.62, C.body, 1.08, 0.98, 0.92);
  body.position.y = 0.95;
  root.add(body);

  // 肚皮
  const belly = sphere(0.42, C.belly, 0.92, 0.9, 0.34);
  belly.position.set(0, 0.82, 0.42);
  root.add(belly);

  // 头（与身体融合）
  const head = new THREE.Group();
  head.position.y = 1.42;
  const skull = sphere(0.5, C.body, 1.02, 0.95, 0.95);
  head.add(skull);

  // 两只大眼睛（在头顶，奶蛙标志）
  const mkEye = (x) => {
    const eye = new THREE.Group();
    eye.position.set(x, 0.34, 0.12);
    const white = sphere(0.17, '#fff', 1, 1.12, 0.9);
    const iris = sphere(0.085, C.eye);
    iris.position.set(0, -0.02, 0.11);
    const pupil = sphere(0.04, '#111');
    pupil.position.set(0, -0.02, 0.175);
    eye.add(white, iris, pupil);
    // 眼眶（黄色环）
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 10, 24), mat(C.bodyDark));
    ring.position.set(0, 0, 0.02);
    eye.add(ring);
    return eye;
  };
  const eyeL = mkEye(-0.22), eyeR = mkEye(0.22);
  head.add(eyeL, eyeR);
  rig.eyeL = eyeL; rig.eyeR = eyeR;

  // 大笑嘴（黑色压扁球）
  const mouth = sphere(0.26, '#5a2400', 1.15, 0.72, 0.3);
  mouth.position.set(0, -0.18, 0.38);
  head.add(mouth);
  // 舌尖
  const tongue = sphere(0.1, '#e85a6a', 1.2, 0.5, 0.3);
  tongue.position.set(0, -0.28, 0.43);
  head.add(tongue);
  // 腮红
  const cheekL = sphere(0.08, '#ff8f5e', 1, 0.6, 0.3);
  cheekL.position.set(-0.34, -0.1, 0.28);
  const cheekR = cheekL.clone();
  cheekR.position.x = 0.34;
  head.add(cheekL, cheekR);
  root.add(head);
  rig.head = head;

  // 手臂（绿色袖+绿手套）
  const mkArm = (x) => {
    const arm = new THREE.Group();
    arm.position.set(x, 1.32, 0.05);
    const sleeve = capsule(0.13, 0.18, C.body);
    sleeve.position.y = -0.14;
    const glove = sphere(0.17, C.glove, 1.1, 1, 1);
    glove.position.y = -0.36;
    glove.scale.set(1.15, 1, 1.1);
    arm.add(sleeve, glove);
    root.add(arm);
    return arm;
  };
  rig.armL = mkArm(-0.58);
  rig.armR = mkArm(0.58);

  // 短粗腿 + 大脚
  const mkLeg = (x) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.55, 0);
    const t = capsule(0.16, 0.18, C.body);
    t.position.y = -0.14;
    const foot = sphere(0.2, C.body, 1.5, 0.6, 1.35);
    foot.position.set(0, -0.38, 0.12);
    leg.add(t, foot);
    root.add(leg);
    return leg;
  };
  rig.legL = mkLeg(-0.28);
  rig.legR = mkLeg(0.28);

  rig.root = root;
  rig.body = body;
  rig.mouth = mouth;
  return { root, rig };
}

// ---------- 肥嘟嘟（袋鼠） ----------
function buildFeidudu() {
  const C = CHARACTERS.feidudu.colors;
  const rig = {};
  const root = new THREE.Group();

  // 身体（椭圆）
  const body = sphere(0.6, C.body, 0.85, 1.15, 0.72);
  body.position.y = 0.95;
  root.add(body);

  // 育儿袋
  const pouch = sphere(0.34, C.belly, 0.95, 0.9, 0.3);
  pouch.position.set(0, 0.78, 0.34);
  root.add(pouch);
  const pouchTop = sphere(0.2, C.belly, 1, 0.5, 0.25);
  pouchTop.position.set(0, 1.05, 0.4);
  root.add(pouchTop);

  // 头
  const head = new THREE.Group();
  head.position.y = 1.78;
  const skull = sphere(0.36, C.body, 0.95, 1, 0.95);
  head.add(skull);
  // 吻部（前突）
  const muzzle = sphere(0.22, '#d9a86a', 0.9, 0.8, 1.15);
  muzzle.position.set(0, -0.1, 0.26);
  head.add(muzzle);
  // 黑鼻子
  const nose = sphere(0.08, '#1b1410');
  nose.position.set(0, 0.0, 0.47);
  head.add(nose);
  // 耳朵（长）
  const mkEar = (x, rot) => {
    const ear = new THREE.Group();
    ear.position.set(x, 0.32, 0);
    const e = sphere(0.1, C.body, 0.55, 2.2, 0.35);
    ear.add(e);
    ear.rotation.z = rot;
    return ear;
  };
  const earL = mkEar(-0.18, 0.25), earR = mkEar(0.18, -0.25);
  head.add(earL, earR);
  // 眼睛（豆豆眼）
  const mkEye = (x) => {
    const eye = sphere(0.07, '#fff', 1, 1.15, 0.8);
    eye.position.set(x, 0.06, 0.28);
    const p = sphere(0.035, '#111');
    p.position.set(x, 0.05, 0.33);
    head.add(eye, p);
    return { eye, p };
  };
  const e1 = mkEye(-0.13), e2 = mkEye(0.13);
  rig.eyeL = e1.eye; rig.eyeR = e2.eye;
  // 黑色眼罩（佐罗式）
  const mask = box(0.62, 0.13, 0.08, '#1b1410');
  mask.position.set(0, 0.07, 0.33);
  mask.rotation.x = 0.06;
  head.add(mask);
  // 眼罩绑带（绕头）
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 28), mat('#1b1410'));
  band.scale.set(1, 1.05, 0.95);
  band.position.y = 0.08;
  head.add(band);
  // 嘴（小坏笑）
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 16, Math.PI), mat('#4a2a10'));
  mouth.position.set(0, -0.22, 0.42);
  mouth.rotation.x = 0.2;
  head.add(mouth);
  root.add(head);
  rig.head = head;

  // 胸牌（红色圆牌+绳）
  const cord = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.012, 6, 24, Math.PI), mat('#e8d9b0'));
  cord.position.set(0, 1.32, 0.3);
  cord.rotation.x = 0.35;
  root.add(cord);
  const tag = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 20), mat('#e23b30'));
  tag.rotation.x = Math.PI / 2;
  tag.position.set(0, 1.08, 0.46);
  root.add(tag);

  // 手臂（棕色+黑手套）
  const mkArm = (x) => {
    const arm = new THREE.Group();
    arm.position.set(x, 1.32, 0.05);
    const sleeve = capsule(0.12, 0.22, C.body);
    sleeve.position.y = -0.16;
    const glove = sphere(0.15, C.glove, 1.1, 1, 1);
    glove.position.y = -0.4;
    arm.add(sleeve, glove);
    root.add(arm);
    return arm;
  };
  rig.armL = mkArm(-0.46);
  rig.armR = mkArm(0.46);

  // 腿 + 长脚
  const mkLeg = (x) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.6, 0);
    const t = capsule(0.17, 0.3, C.body);
    t.position.y = -0.25;
    const foot = sphere(0.17, C.body, 1.9, 0.55, 1.1);
    foot.position.set(0, -0.52, 0.18);
    leg.add(t, foot);
    root.add(leg);
    return leg;
  };
  rig.legL = mkLeg(-0.24);
  rig.legR = mkLeg(0.24);

  // 大尾巴（锥形）
  const tail = new THREE.Group();
  tail.position.set(0, 0.55, -0.35);
  const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 16), mat(C.body));
  tailMesh.rotation.x = -1.9; // 向后下方伸出
  tailMesh.position.z = -0.3;
  tail.add(tailMesh);
  root.add(tail);
  rig.tail = tail;

  rig.root = root;
  rig.body = body;
  rig.mouth = mouth;
  return { root, rig };
}

// ---------- 摩托车（肥嘟嘟小必杀用） ----------
export function buildMotorcycle() {
  const g = new THREE.Group();
  const red = '#e23b30', dark = '#221c28', chrome = '#cfd6e0';
  const mkWheel = (x) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 20), mat(dark));
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.26, 0);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 16), mat(chrome));
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x, 0.26, 0);
    g.add(w, hub);
    return w;
  };
  const wl = mkWheel(-0.55), wr = mkWheel(0.55);
  // 车身
  const frame = box(0.9, 0.18, 0.3, red);
  frame.position.set(0, 0.55, 0);
  g.add(frame);
  const tank = box(0.4, 0.22, 0.28, red);
  tank.position.set(0.15, 0.68, 0);
  g.add(tank);
  const seat = box(0.4, 0.1, 0.26, dark);
  seat.position.set(-0.25, 0.72, 0);
  g.add(seat);
  // 车把
  const bar = cyl(0.025, 0.025, 0.5, chrome);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(0.5, 0.92, 0);
  const fork = cyl(0.03, 0.03, 0.45, chrome);
  fork.position.set(0.5, 0.7, 0);
  g.add(bar, fork);
  // 大灯
  const lamp = sphere(0.08, '#ffe88a', 1, 1, 0.7);
  lamp.position.set(0.6, 0.72, 0.12);
  g.add(lamp);
  g.visible = false;
  g.userData.wheels = [wl, wr];
  return g;
}

// ---------- 工厂 ----------
export function buildCharacter(id) {
  const def = CHARACTERS[id];
  const built = id === 'naiwa' ? buildNaiwa() : buildFeidudu();
  const group = new THREE.Group();
  built.root.scale.setScalar(def.scale);
  group.add(built.root);
  return { group, rig: built.rig, def };
}
