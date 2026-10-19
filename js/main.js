// ============================================================
// main.js — 入口：渲染器、屏幕切换、菜单/选角 3D 展示、对局生命周期
// ============================================================
import * as THREE from 'three';
import { CHARACTERS, STAGES } from './config.js';
import { buildCharacter } from './characters.js';
import { updateRig } from './anim.js';
import { audio } from './audio.js';
import { Battle } from './battle.js';
import { AIInput, Fighter } from './fighter.js';
import { InputManager, bindTouchControls, isTouchDevice, isPortrait } from './input.js';
import { OnlineSession } from './online.js';
import { buildLights } from './scenes.js';

// ------------------------------------------------------------
// 渲染器
// ------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('game'),
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ------------------------------------------------------------
// 通用屏幕切换
// ------------------------------------------------------------
const screens = ['menu', 'online', 'charselect', 'hud', 'pause', 'quit-confirm', 'result'];
function showScreen(id) {
  screens.forEach(s => {
    document.getElementById('screen-' + s).classList.toggle('active', s === id);
  });
  document.body.classList.toggle('battle', id === 'hud');
}

// ------------------------------------------------------------
// 菜单 / 选角 3D 展示场景
// ------------------------------------------------------------
class Showcase {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#141018', 8, 18);
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 50);
    this.scene.add(buildLights());
    // 展示台正面补光 + 聚光
    const fill = new THREE.DirectionalLight('#fff0dd', 0.9);
    fill.position.set(-2, 3, 6);
    const spot = new THREE.SpotLight('#fff3d6', 2.2, 12, Math.PI / 5, 0.45, 1.2);
    spot.position.set(0, 5.5, 3.5);
    spot.target.position.set(0, 0.8, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    this.scene.add(fill, spot, spot.target);
    // 圆台
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.35, 40),
      new THREE.MeshStandardMaterial({ color: '#241b30', roughness: 0.6, metalness: 0.3 }));
    base.position.y = -0.18;
    base.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.03, 10, 60),
      new THREE.MeshStandardMaterial({ color: '#ff9d24', emissive: '#ff7a18', emissiveIntensity: 0.8 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.0;
    // 背景环
    const backRing = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.02, 8, 80),
      new THREE.MeshBasicMaterial({ color: '#ff9d24', transparent: true, opacity: 0.25 }));
    backRing.position.set(0, 1.4, -1.6);
    this.scene.add(base, ring, backRing);
    this.backRing = backRing;
    this.char = null;
    this.mode = 'menu';
    this.running = false;
    this._t = 0;
  }
  setCharacter(id) {
    if (this.charId === id) return;
    this.charId = id;
    if (this.char) {
      this.scene.remove(this.char.group);
    }
    this.char = buildCharacter(id);
    this.char.group.position.set(0, 0, 0);
    this.scene.add(this.char.group);
    this._swap = 0;
  }
  setMode(mode) {
    this.mode = mode;
    // 选角时角色居中；菜单时偏左
    this._camTarget = mode === 'menu'
      ? new THREE.Vector3(-0.55, 1.35, 4.8)
      : new THREE.Vector3(0, 1.3, 4.6);
    this._lookTarget = mode === 'menu'
      ? new THREE.Vector3(-0.5, 1.0, 0)
      : new THREE.Vector3(0, 1.0, 0);
    this._charX = mode === 'menu' ? -0.5 : 0;
  }
  start() {
    this.running = true;
    this._last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this._last) / 1000);
      this._last = now;
      this._t++;
      if (this.char) {
        const f = {
          rig: this.char.rig, def: this.char.def,
          state: 'idle', stateT: this._t, move: null, moveData: null,
          onGround: true, vy: 0, walkPhase: 0, facing: 1, punchSide: 1,
          chargeT: 0, hurtDir: 0, koDir: 0, overdrive: false,
          group: this.char.group,
        };
        updateRig(f, this._t);
        if (this.mode === 'menu') {
          this.char.group.rotation.y = this._t * 0.012;
        } else {
          // 缓慢回到正面
          const target = 0;
          this.char.group.rotation.y += (target - this.char.group.rotation.y) * 0.15;
          this.char.group.position.x += (this._charX - this.char.group.position.x) * 0.12;
        }
        this.backRing.rotation.z += 0.002;
      }
      this.camera.position.lerp(this._camTarget, 0.06);
      this.camera.lookAt(this._lookTarget);
      this.renderer.render(this.scene, this.camera);
    };
    this._raf = requestAnimationFrame(loop);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }
}

const showcase = new Showcase(renderer);
showcase.setMode('menu');
showcase.setCharacter('feidudu');
showcase.start();

// ------------------------------------------------------------
// 全局状态
// ------------------------------------------------------------
const app = {
  mode: null,           // arcade / versus / training / online
  online: null,         // OnlineSession
  isHost: false,
  picks: { p1: null, p2: null },
  battle: null,
  battleCfg: null,
  remoteReady: false,
};
window.__app = app; // 调试入口

// 移动端标记
if (isTouchDevice()) {
  document.body.classList.add('touch');
  const orient = () => document.body.classList.toggle('portrait', isPortrait());
  orient();
  window.addEventListener('resize', orient);
  window.addEventListener('orientationchange', () => setTimeout(orient, 200));
}

// 首次手势初始化音频
function unlockAudio() {
  audio.init();
  if (!audio.muted) audio.startBgm();
}
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// ------------------------------------------------------------
// 菜单
// ------------------------------------------------------------
const modeItems = [...document.querySelectorAll('.mode-list li')];
let modeIndex = 1;
function highlightMode(i) {
  modeItems.forEach((li, k) => li.classList.toggle('selected', k === i));
  app.mode = modeItems[i].dataset.mode;
}
modeItems.forEach((li, i) => {
  li.addEventListener('click', () => {
    audio.init(); audio.ui();
    highlightMode(i);
    enterMode();
  });
});
window.addEventListener('keydown', (e) => {
  if (document.getElementById('screen-menu').classList.contains('active')) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      modeIndex = (modeIndex + modeItems.length - 1) % modeItems.length;
      highlightMode(modeIndex); audio.ui();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      modeIndex = (modeIndex + 1) % modeItems.length;
      highlightMode(modeIndex); audio.ui();
    } else if (e.code === 'Enter' || e.code === 'Space') {
      audio.select(); enterMode();
    }
  }
});
highlightMode(1);

function enterMode() {
  const mode = app.mode;
  if (mode === 'online') {
    showScreen('online');
    document.getElementById('online-status').innerHTML = '空闲';
  } else {
    app.online = null;
    openCharSelect(mode);
  }
}

// 顶部按钮
document.getElementById('btn-fullscreen').addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
});
document.getElementById('btn-sound').addEventListener('click', (e) => {
  audio.init();
  const m = audio.toggleMute();
  e.target.textContent = m ? '🔇' : '🔊';
});

// 通用返回菜单
document.querySelectorAll('[data-back-menu]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (app.online) { app.online.destroy(); app.online = null; }
    showScreen('menu');
    showcase.setMode('menu');
    showcase.setCharacter('feidudu');
  });
});

// ------------------------------------------------------------
// 在线联机
// ------------------------------------------------------------
const onlineStatus = document.getElementById('online-status');
function setOnlineStatus(html) { onlineStatus.innerHTML = html; }

document.getElementById('btn-create-room').addEventListener('click', () => {
  audio.init(); audio.ui();
  setOnlineStatus('正在创建房间…');
  const session = OnlineSession.create();
  app.online = session;
  app.isHost = true;
  session.on('ready', (code) => {
    setOnlineStatus(`房间已创建，房间号：<span class="room-code">${code}</span>把房间号发给好友，好友加入后自动进入选角。`);
    setTimeout(() => {
      app.picks = { p1: null, p2: null };
      openCharSelect('online');
    }, 1400);
  });
  session.on('guest-joined', () => {
    setOnlineStatus('好友已加入');
    app.remoteReady = true;
    updateCharSelectUI();
  });
  session.on('message', (d) => handleOnlineMessage(d));
  session.on('disconnected', () => onDisconnect());
  session.on('error', (e) => {
    setOnlineStatus(e.friendly || ('创建失败：' + (e.type || e.message)));
  });
});

document.getElementById('btn-join-room').addEventListener('click', () => {
  const code = document.getElementById('room-input').value.trim();
  if (!/^\d{6}$/.test(code)) { setOnlineStatus('请输入 6 位房间号'); return; }
  audio.init(); audio.ui();
  setOnlineStatus('正在加入房间…');
  const session = OnlineSession.join(code);
  app.online = session;
  app.isHost = false;
  session.on('connected', () => {
    setOnlineStatus('已加入，正在进入选角…');
    app.picks = { p1: null, p2: null };
    app.remoteReady = true;
    setTimeout(() => openCharSelect('online'), 700);
  });
  session.on('message', (d) => handleOnlineMessage(d));
  session.on('disconnected', () => onDisconnect());
  session.on('error', (e) => {
    setOnlineStatus(e.friendly || ('加入失败：' + (e.type || e.message)));
    app.online = null;
  });
});

function onDisconnect() {
  if (app.battle) {
    toast('对方已断开连接');
    quitToMenu();
  } else {
    setOnlineStatus('连接已断开');
    app.remoteReady = false;
  }
}

// ------------------------------------------------------------
// 选角
// ------------------------------------------------------------
const cardsEl = document.getElementById('cs-cards');
const fightBtn = document.getElementById('btn-fight');

function buildCards() {
  cardsEl.innerHTML = '';
  const all = [CHARACTERS.naiwa, CHARACTERS.feidudu, { locked: true }];
  all.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'cs-card';
    if (c.locked) {
      card.classList.add('locked');
      card.innerHTML = `
        <div class="card-art"><div class="lock-q">???</div></div>
        <div class="card-info"><div class="lock-txt">新角色正在憋大招，敬请期待</div></div>`;
      cardsEl.appendChild(card);
      return;
    }
    card.dataset.char = c.id;
    card.innerHTML = `
      <span class="card-tag">${c.no}</span>
      <span class="card-pick" data-slot></span>
      <div class="card-art">
        <div class="portrait ${c.id}">
          ${c.id === 'naiwa'
            ? `<div class="belly"></div><span class="eye l"><i></i></span><span class="eye r"><i></i></span><span class="mouth"></span>`
            : `<span class="ear l"></span><span class="ear r"></span><span class="mask"></span><span class="eye l"><i></i></span><span class="eye r"><i></i></span><span class="nose"></span><span class="mouth"></span>`}
        </div>
      </div>
      <div class="card-info">
        <div class="card-name">${c.name}</div>
        <div class="card-title">${c.title}</div>
        <div class="card-stats">
          <div class="stat">力量<b>${c.stats.power}</b></div>
          <div class="stat">速度<b>${c.stats.speed}</b></div>
          <div class="stat">脆皮<b>${c.stats.crispy}</b></div>
        </div>
      </div>`;
    card.addEventListener('click', () => pickCharacter(c.id, card));
    cardsEl.appendChild(card);
  });
}

function openCharSelect(mode) {
  app.mode = mode;
  app.picks = { p1: null, p2: null };
  buildCards();
  showcase.setMode('charselect');
  showcase.setCharacter('naiwa');
  document.getElementById('cs-title-main').textContent =
    mode === 'versus' ? '双方各选一个角色' : (mode === 'online' ? '选择你的出战角色' : '你，选一个角色');
  const subMap = {
    arcade: '单人街机 · 打不过就多打两局',
    versus: '本地双人 · 同一键盘互相伤害',
    training: '招式训练 · 无限能量练到会',
    online: '在线联机 · 好友房间实时互殴',
  };
  document.getElementById('cs-title-sub').textContent = subMap[mode];
  fightBtn.disabled = true;
  updateCharSelectUI();
  showScreen('charselect');
}

function activeSlot() {
  // 返回当前玩家应该选的槽位
  const { mode, picks, isHost } = app;
  if (mode === 'versus') return picks.p1 ? (picks.p2 ? null : 'p2') : 'p1';
  if (mode === 'online') return isHost ? 'p1' : 'p2';
  return 'p1'; // arcade / training
}

function pickCharacter(id, card) {
  audio.init(); audio.select();
  showcase.setCharacter(id);
  const mode = app.mode;
  if (mode === 'versus') {
    const slot = activeSlot();
    if (!slot) { app.picks = { p1: null, p2: null }; }
    app.picks[slot || 'p1'] = id;
    if (!slot) app.picks.p1 = id;
  } else if (mode === 'online') {
    const slot = app.isHost ? 'p1' : 'p2';
    app.picks[slot] = id;
    app.online?.send({ kind: 'pick', slot, char: id });
  } else {
    app.picks.p1 = id;
  }
  updateCharSelectUI();
}

function updateCharSelectUI() {
  const { picks, mode } = app;
  // 卡片标记
  cardsEl.querySelectorAll('.cs-card').forEach(card => {
    const id = card.dataset.char;
    card.classList.remove('picked', 'picked-p2');
    const tag = card.querySelector('[data-slot]');
    if (tag) tag.textContent = '';
    if (id === picks.p1) { card.classList.add('picked'); if (tag) tag.textContent = '1P'; }
    if (id === picks.p2) { card.classList.add('picked-p2'); if (tag) tag.textContent = '2P'; }
  });
  // 提示与开打按钮
  const turnEl = document.getElementById('cs-turn');
  let canFight = false;
  if (mode === 'arcade') {
    turnEl.textContent = picks.p1 ? '对手已随机（开打时确定）' : '请选择你的角色';
    canFight = !!picks.p1;
  } else if (mode === 'training') {
    turnEl.textContent = picks.p1 ? '选个陪练靶子吧' : '请选择你的角色';
    canFight = !!picks.p1;
  } else if (mode === 'versus') {
    const slot = activeSlot();
    turnEl.textContent = slot === 'p1' ? '1P 选择角色' : (slot === 'p2' ? '2P 选择角色' : '选择完毕，开打！');
    canFight = !!picks.p1 && !!picks.p2;
  } else if (mode === 'online') {
    if (app.isHost) {
      if (!app.remoteReady) {
        turnEl.textContent = '等待好友加入房间…';
      } else if (!picks.p2) {
        turnEl.textContent = '好友正在选角…';
      } else if (!picks.p1) {
        turnEl.textContent = '选择你的角色';
      } else {
        turnEl.textContent = '准备完毕，开打！';
        canFight = true;
      }
    } else {
      if (!picks.p2) turnEl.textContent = '你是 2P，请选择你的角色';
      else if (!picks.p1) turnEl.textContent = '等待房主选择…';
      else turnEl.textContent = '等待房主开始…';
    }
  }
  fightBtn.disabled = !canFight;
}

document.getElementById('btn-random').addEventListener('click', () => {
  const id = Math.random() < 0.5 ? 'naiwa' : 'feidudu';
  const card = [...cardsEl.querySelectorAll('.cs-card')].find(c => c.dataset.char === id);
  pickCharacter(id, card);
});
document.getElementById('btn-clear-pick').addEventListener('click', () => {
  if (app.mode === 'online') {
    app.picks[app.isHost ? 'p1' : 'p2'] = null;
  } else {
    app.picks = { p1: null, p2: null };
  }
  audio.ui();
  updateCharSelectUI();
});

fightBtn.addEventListener('click', () => {
  audio.init(); audio.select();
  const { mode, picks, isHost, online } = app;
  if (mode === 'online') {
    if (isHost) {
      // 主机确认开打
      online.send({ kind: 'start', p1: picks.p1, p2: picks.p2 });
      launchBattle({ mode, p1: picks.p1, p2: picks.p2 });
    }
  } else {
    // 本地：补齐 p2
    let p2 = picks.p2;
    if (mode === 'arcade' || mode === 'training') {
      // 三成概率镜像角色，否则用另一个
      p2 = Math.random() < 0.3 ? picks.p1 : (picks.p1 === 'naiwa' ? 'feidudu' : 'naiwa');
    }
    launchBattle({ mode, p1: picks.p1, p2 });
  }
});

// ------------------------------------------------------------
// 联机消息处理
// ------------------------------------------------------------
function handleOnlineMessage(d) {
  if (!d || !d.kind) return;
  if (d.kind === 'pick') {
    app.picks[d.slot] = d.char;
    if (d.slot === 'p1') showcase.setCharacter(d.char);
    updateCharSelectUI();
  } else if (d.kind === 'start') {
    if (!app.isHost) {
      launchBattle({ mode: 'online', p1: d.p1, p2: d.p2 });
    }
  } else if (d.kind === 'snap') {
    if (app.battle && !app.isHost) app.battle._snapBuffer = d;
  } else if (d.kind === 'input') {
    if (app.battle && app.isHost) app.battle.applyRemoteInput(d.data);
  }
}

// ------------------------------------------------------------
// 启动对局
// ------------------------------------------------------------
function launchBattle({ mode, p1, p2 }) {
  showcase.stop();
  showScreen('hud');
  document.body.classList.add('battle');
  audio.init();

  const inputs = { p1: null, p2: null };
  let aiSlots = [false, false];

  if (mode === 'versus') {
    inputs.p1 = new InputManager(1);
    inputs.p2 = new InputManager(2);
  } else if (mode === 'online') {
    if (app.isHost) {
      inputs.p1 = new InputManager(1);
      inputs.p2 = new AIInput();
    } else {
      inputs.p1 = new AIInput();
      inputs.p2 = new InputManager(2);
    }
  } else {
    inputs.p1 = new InputManager(1);
    inputs.p2 = new InputManager(2);
    if (mode === 'arcade') aiSlots = [false, true];
  }

  // 联机封装
  let online = null;
  if (mode === 'online' && app.online) {
    const session = app.online;
    if (app.isHost) {
      online = {
        isHost: true,
        send: (snap) => session.send({ kind: 'snap', ...snap }),
      };
    } else {
      online = {
        isHost: false,
        send: (data) => session.send({ kind: 'input', data }),
        consumeSnapshot: () => {
          const s = app.battle?._snapBuffer;
          if (app.battle) app.battle._snapBuffer = null;
          return s;
        },
      };
    }
  }

  app.battleCfg = {
    mode,
    charP1: p1,
    charP2: p2,
    inputs,
    aiSlots,
    online,
    stageId: localStorage.getItem('stage') || STAGES[Math.floor(Math.random() * STAGES.length)],
    onMatchEnd: (winner, wins) => showResult(winner, wins),
  };
  app.battle = new Battle(renderer, app.battleCfg);

  // 触屏绑定本地玩家
  if (isTouchDevice()) {
    const localInput = mode === 'online' && !app.isHost ? inputs.p2 : inputs.p1;
    bindTouchControls(localInput);
  }
}

// ------------------------------------------------------------
// 结算
// ------------------------------------------------------------
function showResult(winner, wins) {
  const el = document.getElementById('result-title');
  // 判定胜负文案
  const isLocal = app.mode !== 'online';
  let title = 'K.O.';
  el.textContent = title;
  // 本地玩家是否获胜
  const localPlayer = app.mode === 'online' && !app.isHost ? 2 : 1;
  const youWin = winner.player === localPlayer;
  const winnerName = `${winner.def.name}`;
  document.getElementById('result-winner').textContent =
    app.mode === 'online'
      ? (youWin ? '你赢了！' : '你输了…')
      : `胜利：${winnerName}`;
  document.getElementById('result-score').textContent = `比分 ${wins[0]} : ${wins[1]}`;
  showScreen('result');
}

document.getElementById('btn-rematch').addEventListener('click', () => {
  audio.ui();
  const cfg = app.battleCfg;
  app.battle?.exit();
  app.battle = null;
  launchBattle(cfg);
});
document.getElementById('btn-back-menu').addEventListener('click', () => {
  audio.ui();
  quitToMenu();
});

function quitToMenu() {
  app.battle?.exit();
  app.battle = null;
  app.battleCfg = null;
  if (app.online) { app.online.destroy(); app.online = null; }
  document.body.classList.remove('battle');
  showScreen('menu');
  showcase.setMode('menu');
  showcase.setCharacter('feidudu');
  showcase.start();
}

// ------------------------------------------------------------
// 暂停 / 退出
// ------------------------------------------------------------
document.getElementById('btn-pause').addEventListener('click', () => {
  app.battle?.togglePause();
});
document.getElementById('btn-resume').addEventListener('click', () => {
  audio.ui();
  app.battle?.resume();
});
document.getElementById('btn-quit').addEventListener('click', () => {
  document.getElementById('screen-pause').classList.remove('active');
  document.getElementById('screen-quit-confirm').classList.add('active');
  app.battle.paused = true;
});
document.getElementById('btn-cancel-quit').addEventListener('click', () => {
  document.getElementById('screen-quit-confirm').classList.remove('active');
  app.battle.paused = false;
});
document.getElementById('btn-confirm-quit').addEventListener('click', () => {
  document.getElementById('screen-quit-confirm').classList.remove('active');
  quitToMenu();
});

// 键盘：暂停 / 训练快捷键 转发
window.addEventListener('keydown', (e) => {
  if (app.battle && document.getElementById('screen-hud').classList.contains('active')) {
    app.battle.onKeyPressed(e.code);
  }
});

// 页面隐藏时自动暂停
document.addEventListener('visibilitychange', () => {
  if (document.hidden && app.battle && !app.battle.training && !app.battle.online) {
    app.battle.paused = true;
    document.getElementById('screen-pause').classList.add('active');
  }
});

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window._toast);
  window._toast = setTimeout(() => el.classList.remove('show'), 1800);
}
