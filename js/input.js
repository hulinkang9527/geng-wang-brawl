// ============================================================
// input.js — 键盘 + 触屏统一输入
// 每个玩家一个 InputManager：isDown(动作) / justPressed(动作)
// ============================================================
import { KEYS } from './config.js';

const keyDown = new Set();   // 当前按住
const keyPressed = new Set(); // 本帧刚按下
let initialized = false;

const PREVENT = new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space',
  'ShiftLeft','ShiftRight','Digit1','Digit2','Digit3','Digit4','Digit5']);

function initKeyboard() {
  if (initialized) return;
  initialized = true;
  window.addEventListener('keydown', (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!e.repeat) keyPressed.add(e.code);
    keyDown.add(e.code);
  }, { passive: false });
  window.addEventListener('keyup', (e) => { keyDown.delete(e.code); });
  window.addEventListener('blur', () => { keyDown.clear(); });
}

export class InputManager {
  constructor(player) {
    initKeyboard();
    this.player = player; // 1 或 2
    this.map = player === 1 ? KEYS.p1 : KEYS.p2;
    // 触屏状态
    this.tDown = {};
    this.tPressed = {};
    this.tAxis = 0;
  }

  isDown(act) {
    const code = this.map[act];
    return keyDown.has(code) || !!this.tDown[act];
  }
  justPressed(act) {
    const code = this.map[act];
    return keyPressed.has(code) || !!this.tPressed[act];
  }
  axisX() {
    let x = 0;
    if (keyDown.has(this.map.left)) x -= 1;
    if (keyDown.has(this.map.right)) x += 1;
    x += this.tAxis;
    return Math.max(-1, Math.min(1, x));
  }
  // 触屏摇杆
  setTouchAxis(x) { this.tAxis = Math.max(-1, Math.min(1, x)); }
  setTouch(act, pressed) {
    if (pressed) {
      this.tDown[act] = true;
      this.tPressed[act] = true;
    } else {
      this.tDown[act] = false;
    }
  }
  // 逻辑帧结束后清理
  postFrame() {
    this.tPressed = {};
  }
}

export function consumeGlobalKeyPressed() {
  // 供主循环判断暂停键
  const pause = KEYS.pause.some(c => keyPressed.has(c));
  return { pause };
}

export function clearFrameInput() {
  keyPressed.clear();
}

// ------------------------------------------------------------
// 触屏控件绑定（仅 P1 / 单人 & 联机客机用）
// ------------------------------------------------------------
export function bindTouchControls(input) {
  const layer = document.getElementById('touch-layer');
  if (!layer) return;

  // 摇杆
  const pad = document.getElementById('touch-pad');
  const stick = document.getElementById('touch-stick');
  let padId = null;
  const R = 46;
  const padMove = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== padId) continue;
      const r = pad.getBoundingClientRect();
      let dx = t.clientX - (r.left + r.width / 2);
      dx = Math.max(-R, Math.min(R, dx));
      stick.style.transform = `translate(${dx}px,0)`;
      input.setTouchAxis(dx / R);
    }
  };
  const padEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== padId) continue;
      padId = null;
      stick.style.transform = 'translate(0,0)';
      input.setTouchAxis(0);
    }
  };
  pad.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (padId === null) padId = e.changedTouches[0].identifier;
    padMove(e);
  }, { passive: false });
  pad.addEventListener('touchmove', (e) => { e.preventDefault(); padMove(e); }, { passive: false });
  pad.addEventListener('touchend', padEnd);
  pad.addEventListener('touchcancel', padEnd);

  // 动作按钮
  const bind = (el, act) => {
    const down = (e) => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); input.setTouch(act, true); };
    const up = (e) => { e.preventDefault(); input.setTouch(act, false); };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('touchcancel', up, { passive: false });
  };
  layer.querySelectorAll('.tbtn').forEach(b => bind(b, b.dataset.act));
  bind(document.getElementById('btn-touch-jump'), 'jump');
}

// 检测是否触屏设备
export function isTouchDevice() {
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

// 横竖屏方向
export function isPortrait() {
  return window.innerHeight > window.innerWidth;
}
