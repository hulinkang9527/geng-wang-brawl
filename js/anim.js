// ============================================================
// anim.js — 程序化关节动画（每逻辑帧调用）
// 根据 fighter 状态驱动 rig 关节
// ============================================================
import * as THREE from 'three';

const DEG = Math.PI / 180;

export function resetRig(f) {
  const { rig, def } = f;
  rig.root.position.set(0, 0, 0);
  rig.root.rotation.set(0, 0, 0);
  rig.root.scale.setScalar(def.scale);
  if (rig.head) rig.head.rotation.set(0, 0, 0);
  if (rig.body) rig.body.rotation.set(0, 0, 0);
  rig.armL.rotation.set(0, 0, 0.12);
  rig.armR.rotation.set(0, 0, -0.12);
  rig.legL.rotation.set(0, 0, 0);
  rig.legR.rotation.set(0, 0, 0);
  if (rig.tail) rig.tail.rotation.set(0, 0, 0);
  // 眼睛恢复
  [rig.eyeL, rig.eyeR].forEach(e => {
    if (e) { e.scale.set(1, 1, 1); e.rotation.z = 0; }
  });
}

// 出拳姿势（手臂前伸 = rotation.x = -1.5）
function punchPose(f, arm, extend, other = 0.25) {
  const { rig } = f;
  const a = arm === 'R' ? rig.armR : rig.armL;
  const b = arm === 'R' ? rig.armL : rig.armR;
  a.rotation.x = -extend * 1.55;
  a.rotation.z = 0;
  b.rotation.x = other * 0.6;
  b.rotation.z = arm === 'R' ? 0.12 : -0.12;
}

// 连拳段（奶蛙）：根据 rush 索引交替
function rushPunch(f, index, extend) {
  const arm = index % 2 === 0 ? 'R' : 'L';
  punchPose(f, arm, extend, 0.15);
  if (index % 2 === 0) {
    f.rig.head.rotation.y = -0.12;
  } else {
    f.rig.head.rotation.y = 0.12;
  }
}

// 骑乘姿势（肥嘟嘟摩托）
function ridingPose(f) {
  const { rig } = f;
  rig.root.position.y = -0.25;
  rig.root.rotation.x = 0.28;
  rig.armL.rotation.set(-1.45, 0, 0.12);
  rig.armR.rotation.set(-1.45, 0, -0.12);
  rig.legL.rotation.set(1.0, 0, 0.05);
  rig.legR.rotation.set(0.9, 0, -0.05);
}

export function updateRig(f, gt) {
  resetRig(f);
  const { rig, state } = f;
  const t = f.stateT;
  const id = f.def.id;

  // 击倒：直接躺
  if (state === 'ko') {
    const dir = f.koDir || -1;
    rig.root.rotation.z = dir * Math.PI / 2;
    rig.root.position.y = 0.15;
    [rig.eyeL, rig.eyeR].forEach(e => {
      if (e) e.scale.set(1, 0.12, 1);
    });
    rig.armL.rotation.x = 0.8;
    rig.armR.rotation.x = 0.6;
    return;
  }

  // 胜利
  if (state === 'win') {
    const b = Math.sin(gt * 0.35) * 0.12;
    rig.root.position.y = Math.abs(Math.sin(gt * 0.35)) * 0.15;
    rig.armL.rotation.x = -2.7;
    rig.armR.rotation.x = -2.7;
    rig.armL.rotation.z = 0.15 + b;
    rig.armR.rotation.z = -0.15 - b;
    if (rig.head) rig.head.rotation.x = -0.2;
    return;
  }

  // 爆气蓄力 / 大必杀开场仰头
  if (state === 'ultra') {
    const d = f.moveData;
    if (t < d.banner) {
      // 横幅期间：仰头，能量翻涌
      const k = t / d.banner;
      rig.head && (rig.head.rotation.x = -0.5 * k);
      rig.armL.rotation.x = -2.4 * k;
      rig.armR.rotation.x = -2.4 * k;
      rig.armL.rotation.z = 0.5 * k;
      rig.armR.rotation.z = -0.5 * k;
      rig.root.position.y = Math.sin(gt * 0.5) * 0.03;
      if (id === 'feidudu') {
        // 肥嘟嘟指向前方
        rig.armR.rotation.x = -1.5;
        rig.armL.rotation.x = -0.6;
        rig.head.rotation.x = 0;
      }
    } else {
      const rt = t - d.banner;
      if (id === 'naiwa') {
        // 连拳：找到当前段
        let idx = 0;
        for (let i = 0; i < d.rushes.length; i++) {
          if (rt >= d.rushes[i].at - 6) idx = i;
        }
        const last = idx === d.rushes.length - 1;
        if (last) {
          // 上勾终结：身体下蹲后上勾
          const k = Math.min(1, (rt - d.rushes[idx].at + 8) / 12);
          punchPose(f, 'R', Math.min(1, k), 0.3);
          rig.root.position.y = -0.2 * (1 - k);
          rig.legL.rotation.x = 0.35;
          rig.legR.rotation.x = -0.2;
        } else {
          const phase = (rt - d.rushes[idx].at) / 12;
          const ext = Math.sin(Math.min(1, Math.max(0, phase)) * Math.PI);
          rushPunch(f, idx, ext * 0.95);
          rig.root.position.y = Math.sin(gt * 0.8) * 0.03;
        }
      } else {
        // 肥嘟嘟三次冲撞 + 尾拳
        const ride = d.rushes.find((r, i) => r.type === 'ride' &&
          rt >= r.at - 8 && rt < r.at + 30);
        if (ride) {
          ridingPose(f);
        } else if (d.rushes[d.rushes.length - 1].type === 'punch') {
          const last = d.rushes[d.rushes.length - 1];
          if (rt >= last.at - 8) {
            const k = Math.min(1, (rt - last.at + 8) / 12);
            punchPose(f, 'R', k, 0.2);
          }
        }
      }
    }
    return;
  }

  // 小必杀
  if (state === 'special') {
    const d = f.moveData;
    if (id === 'naiwa') {
      if (t < d.startup) {
        // 抱头蓄力
        const k = t / d.startup;
        rig.armL.rotation.x = -2.6;
        rig.armR.rotation.x = -2.6;
        rig.armL.rotation.z = 0.6;
        rig.armR.rotation.z = -0.6;
        rig.root.position.y = -0.15 * k;
        rig.root.rotation.x = 0.1 * k;
      } else {
        let idx = 0;
        for (let i = 0; i < d.rushes.length; i++) {
          if (t >= d.rushes[i].at - 6) idx = i;
        }
        const last = idx === d.rushes.length - 1;
        if (last) {
          const k = Math.min(1, (t - d.rushes[idx].at + 8) / 12);
          punchPose(f, 'R', k, 0.2);
          rig.root.rotation.x = 0.15 * k;
        } else {
          const phase = (t - d.rushes[idx].at) / 10;
          const ext = Math.sin(Math.min(1, Math.max(0, phase)) * Math.PI);
          rushPunch(f, idx, ext);
        }
      }
    } else {
      // 肥嘟嘟摩托：startup 上车，之后骑乘
      if (t < d.rideStart) {
        const k = t / d.rideStart;
        rig.root.position.y = -0.25 * k;
        rig.root.rotation.x = 0.28 * k;
        rig.armR.rotation.x = -1.45 * k;
        rig.armL.rotation.x = -1.45 * k;
        rig.legL.rotation.x = 1.0 * k;
        rig.legR.rotation.x = 0.9 * k;
      } else {
        ridingPose(f);
      }
    }
    return;
  }

  // 重击（含蓄力）
  if (state === 'heavy') {
    const d = f.moveData;
    const charge = f.chargeT || 0;
    if (t < d.startup + charge) {
      // 蓄力：拉拳后仰
      const k = Math.min(1, t / (d.startup + charge));
      rig.armR.rotation.x = 0.9;
      rig.armL.rotation.x = 0.3;
      rig.root.rotation.x = -0.12 * k;
      rig.root.position.y = Math.sin(gt * 0.9) * 0.015 * (1 + charge * 0.04);
      if (rig.head) rig.head.rotation.x = -0.1 * k;
    } else if (t < d.startup + charge + d.active) {
      punchPose(f, 'R', 1, 0.2);
      rig.root.rotation.x = 0.18;
      rig.root.position.y = -0.05;
    } else {
      const k = (t - d.startup - charge - d.active) / d.recovery;
      punchPose(f, 'R', 1 - k, 0.2 + 0.1 * k);
      rig.root.rotation.x = 0.18 * (1 - k);
    }
    return;
  }

  // 轻拳 / 空中轻拳
  if (state === 'light' || state === 'airLight') {
    const d = f.moveData;
    const arm = f.punchSide === 1 ? 'R' : 'L';
    if (t < d.startup) {
      punchPose(f, arm, 0.15, 0.2);
      rig.armR.rotation.x = arm === 'R' ? 0.35 : 0.2;
      rig.armL.rotation.x = arm === 'L' ? 0.35 : 0.2;
    } else if (t < d.startup + d.active) {
      punchPose(f, arm, 1, 0.2);
    } else {
      const k = (t - d.startup - d.active) / d.recovery;
      punchPose(f, arm, 1 - k, 0.2);
    }
    if (state === 'airLight') {
      rig.legL.rotation.x = -0.5;
      rig.legR.rotation.x = 0.4;
    }
    return;
  }

  // 护盾
  if (state === 'block') {
    rig.armL.rotation.x = -1.25;
    rig.armR.rotation.x = -1.25;
    rig.armL.rotation.z = 0.5;
    rig.armR.rotation.z = -0.5;
    rig.root.position.y = Math.sin(gt * 0.25) * 0.015;
    return;
  }

  // 闪避
  if (state === 'dodge') {
    const d = f.moveData;
    const k = t / d.frames;
    const lean = Math.sin(k * Math.PI);
    rig.root.rotation.y = 0.5 * lean;
    rig.root.position.y = -0.25 * lean;
    rig.armL.rotation.x = -0.5;
    rig.armR.rotation.x = -0.3;
    return;
  }

  // 破防
  if (state === 'guardBreak') {
    rig.root.rotation.z = Math.sin(t * 0.3) * 0.12;
    rig.armL.rotation.x = 0.5;
    rig.armR.rotation.x = 0.5;
    if (rig.head) rig.head.rotation.x = -0.25;
    [rig.eyeL, rig.eyeR].forEach(e => { if (e) e.rotation.z = 0.3; });
    return;
  }

  // 受击
  if (state === 'hurt') {
    const k = Math.min(1, t / 12);
    rig.root.rotation.z = (f.hurtDir || 0) * 0.14 * (1 - k * 0.5);
    if (rig.head) rig.head.rotation.x = -0.18 * (1 - k * 0.5);
    rig.armL.rotation.x = 0.45;
    rig.armR.rotation.x = 0.7;
    if (!f.onGround) {
      // 被击飞
      rig.legL.rotation.x = -0.4;
      rig.legR.rotation.x = 0.5;
    }
    return;
  }

  // 空中（跳跃）
  if (!f.onGround) {
    rig.legL.rotation.x = -0.55;
    rig.legR.rotation.x = 0.35;
    rig.armL.rotation.x = -0.6;
    rig.armR.rotation.x = -0.5;
    if (rig.head) rig.head.rotation.x = f.vy < 0 ? 0.15 : 0;
    return;
  }

  // 行走
  if (state === 'walk') {
    const p = f.walkPhase;
    const s = Math.sin(p);
    rig.legL.rotation.x = s * 0.75;
    rig.legR.rotation.x = -s * 0.75;
    rig.armL.rotation.x = -s * 0.55;
    rig.armR.rotation.x = s * 0.55;
    rig.root.rotation.x = 0.1;
    rig.root.position.y = Math.abs(Math.cos(p)) * -0.045;
    if (rig.tail) rig.tail.rotation.y = -s * 0.3;
    return;
  }

  // idle 呼吸
  const b = Math.sin(gt * 0.18);
  rig.root.position.y = b * 0.025;
  rig.armL.rotation.z = 0.12 + b * 0.02;
  rig.armR.rotation.z = -0.12 - b * 0.02;
  if (rig.head) rig.head.rotation.y = Math.sin(gt * 0.12) * 0.08;
  if (rig.tail) rig.tail.rotation.y = Math.sin(gt * 0.15) * 0.15;
}
