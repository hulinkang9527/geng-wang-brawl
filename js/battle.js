// ============================================================
// battle.js — 对局编排：场景、回合、HUD、相机、暂停、结算
// ============================================================
import * as THREE from 'three';
import { GAME, GAME as G, RESOURCE, STAGES } from './config.js';
import { Fighter } from './fighter.js';
import { AIController } from './ai.js';
import { buildLights, buildStageScene, updateScene } from './scenes.js';
import { EffectManager } from './effects.js';
import { updateRig } from './anim.js';
import { audio } from './audio.js';
import { clearFrameInput } from './input.js';

// 头像 DOM
export function fillPortrait(el, charId) {
  el.className = 'hud-portrait portrait ' + charId;
  el.innerHTML = '';
  if (charId === 'naiwa') {
    el.innerHTML = `<div class="belly"></div>
      <span class="eye l"><i></i></span><span class="eye r"><i></i></span>
      <span class="mouth"></span>`;
  } else {
    el.innerHTML = `<span class="ear l"></span><span class="ear r"></span>
      <span class="mask"></span>
      <span class="eye l"><i></i></span><span class="eye r"><i></i></span>
      <span class="nose"></span><span class="mouth"></span>`;
  }
}

export class Battle {
  constructor(renderer, opts) {
    this.renderer = renderer;
    this.opts = opts;
    this.mode = opts.mode;
    this.training = opts.mode === 'training';
    this.online = opts.online || null;
    this.isHost = this.online ? this.online.isHost : true;
    this.destroyed = false;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#141018', 15, 32);
    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 2.6, 7.8);

    // 灯光与场景
    this.scene.add(buildLights());
    const stageId = opts.stageId || STAGES[Math.floor(Math.random() * STAGES.length)];
    this.stage = buildStageScene(stageId);
    this.scene.add(this.stage);

    // 角色
    this.p1 = new Fighter(opts.charP1, 1, opts.inputs.p1);
    this.p2 = new Fighter(opts.charP2, 2, opts.inputs.p2);
    this.scene.add(this.p1.group, this.p2.group);
    this.fighters = [this.p1, this.p2];

    // AI
    this.ais = [null, null];
    if (opts.aiSlots?.[1]) {
      this.ais[1] = new AIController(this.p2, { level: 1, dummy: 'cpu' });
    }
    if (opts.aiSlots?.[0]) {
      this.ais[0] = new AIController(this.p1, { level: 1, dummy: 'cpu' });
    }
    if (this.training) {
      // 训练模式：P2 假人
      this.ais[1] = new AIController(this.p2, { level: 0, dummy: 'stand' });
      this.dummyMode = 'stand';
    }

    // 特效
    this.efx = new EffectManager(this.scene, this.camera);
    this.p1.attachEffects(this.efx);
    this.p2.attachEffects(this.efx);

    // 状态
    this.gt = 0;
    this.phase = 'intro';
    this.phaseT = 0;
    this.round = 1;
    this.wins = [0, 0];
    this.timer = GAME.ROUND_TIME;
    this.freeze = 0;
    this.paused = false;
    this.ended = false;
    this.netEvents = [];
    this._lastCombo = [0, 0];

    // 上下文
    this.ctx = {
      effects: this.efx,
      audio,
      training: this.training,
      gt: 0,
      freeze: 0,
      toast: (m) => this.toast(m),
      comboEvent: (atk) => this._onCombo(atk),
      onUltra: (f) => this._onUltra(f),
    };

    this._buildHUD();
    this._startRound(true);

    // 循环
    this._acc = 0;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._loop);
    this._onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this._onResize);
    this._onResize();
  }

  // ----------------------------------------------------------
  _buildHUD() {
    const hud = document.getElementById('screen-hud');
    hud.classList.add('active');
    document.body.classList.toggle('versus', this.mode === 'versus');
    document.body.classList.toggle('training', this.training);

    const names = { p1: ['hud-p1-name', 'hud-p1-tag'], p2: ['hud-p2-name', 'hud-p2-tag'] };
    document.getElementById('hud-p1-name').textContent = this.p1.def.name;
    document.getElementById('hud-p2-name').textContent = this.p2.def.name;
    fillPortrait(document.getElementById('hud-p1-portrait'), this.p1.charId);
    fillPortrait(document.getElementById('hud-p2-portrait'), this.p2.charId);
    const p1tag = document.getElementById('hud-p1-tag');
    const p2tag = document.getElementById('hud-p2-tag');
    if (this.mode === 'arcade') { p1tag.textContent = 'P1'; p2tag.textContent = 'CPU'; }
    else if (this.mode === 'versus') { p1tag.textContent = 'P1'; p2tag.textContent = 'P2'; }
    else if (this.training) { p1tag.textContent = 'P1'; p2tag.textContent = '假人'; }
    else if (this.online) {
      // 房主用 p1，客机用 p2；世界视角固定，不左右交换
      p1tag.textContent = this.isHost ? '你' : '好友';
      p2tag.textContent = this.isHost ? '好友' : '你';
    }

    // 联机时把本地玩家放到视野偏好（名字标签简化）
  }

  _startRound(first) {
    this.phase = 'intro';
    this.phaseT = 0;
    this.timer = this.training ? 999 : GAME.ROUND_TIME;
    this.p1.reset(-GAME.START_X, 1, this.round);
    this.p2.reset(GAME.START_X, -1, this.round);
    const isGuest = this.online && !this.isHost;
    if (!isGuest) {
      this.efx.banner(`ROUND ${this.round}`, '准备好咯', 1200);
      setTimeout(() => {
        if (!this.destroyed && this.phase === 'intro') {
          audio.fight();
          this.efx.banner('FIGHT!', '后退键协防 · 打中人才涨能量', 1100);
          this._netEvent({ t: 'banner', a: 'FIGHT!' });
        }
      }, 800);
    }
    this._netEvent({ t: 'round', round: this.round, wins: this.wins });
  }

  // ----------------------------------------------------------
  _onCombo(atk) {
    const side = atk.player === 1 ? 0 : 1;
    const el = document.getElementById(side === 0 ? 'combo-p1' : 'combo-p2');
    const other = document.getElementById(side === 0 ? 'combo-p2' : 'combo-p1');
    if (atk.combo >= 2) {
      el.innerHTML = `<div class="n">${atk.combo}</div><div class="t">连击</div>`;
      el.classList.add('show');
    }
    other.classList.remove('show');
    this._lastCombo[side] = atk.combo;
  }

  _onUltra(f) {
    this.efx.ultraBanner(f.def.ultraCn, f.def.ultraEn);
    audio.ultra();
    this.efx.shake(0.3);
    this._netEvent({ t: 'ultra', cn: f.def.ultraCn, en: f.def.ultraEn, p: f.player });
  }

  _netEvent(e) {
    if (this.isHost && this.online) this.netEvents.push(e);
  }

  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
  }

  // ----------------------------------------------------------
  // 逻辑帧
  _logicStep() {
    this.gt++;
    this.ctx.gt = this.gt;
    this.ctx.freeze = this.freeze;

    // 暂停 / 训练快捷键（本地）
    if (this._pressedPause) {
      this._pressedPause = false;
      if (!this.training) this.togglePause();
    }
    if (this.training) {
      if (this._keyR) { this._keyR = false; this._trainingReset(); }
      if (this._keyH) { this._keyH = false; this._cycleDummy(); }
    }

    if (this.paused) { clearFrameInput(); return; }

    // 命中停顿：仅推进特效
    if (this.freeze > 0) {
      this.freeze--;
      this.efx.update(1 / GAME.FPS);
      this.fighters.forEach(f => f.input.postFrame?.());
      clearFrameInput();
      return;
    }

    // 客机：只收发网络 + 播动画 + 特效，不跑本地模拟
    if (this.online && !this.isHost) {
      this._guestNet();
      updateRig(this.p1, this.gt);
      updateRig(this.p2, this.gt);
      this.efx.update(1 / GAME.FPS);
      this.fighters.forEach(f => f.input.postFrame?.());
      clearFrameInput();
      return;
    }

    // 回合阶段
    if (this.phase === 'intro') {
      this.phaseT++;
      this.fighters.forEach(f => updateRig(f, this.gt));
      if (this.phaseT >= 110) { this.phase = 'fight'; this.phaseT = 0; }
    } else if (this.phase === 'fight') {
      if (!this.training) {
        this.timer -= 1 / GAME.FPS;
        if (this.timer <= 0) { this.timer = 0; this._endRoundByTime(); }
      }
      this._stepFighters();
      this._checkKO();
    } else if (this.phase === 'roundEnd') {
      this.phaseT++;
      // 慢动作期也继续物理（ko 倒地）
      this.p1.update(this.p2, this.ctx);
      this.p2.update(this.p1, this.ctx);
      this.p1.separate(this.p2);
      updateRig(this.p1, this.gt);
      updateRig(this.p2, this.gt);
      if (this.phaseT > 130) this._nextRoundOrEnd();
    } else if (this.phase === 'matchEnd') {
      this.phaseT++;
      this.p1.update(this.p2, this.ctx);
      this.p2.update(this.p1, this.ctx);
      updateRig(this.p1, this.gt);
      updateRig(this.p2, this.gt);
    }

    // 特效
    this.efx.update(1 / GAME.FPS);
    updateScene(this.stage, this.gt);

    // 主机网络同步
    if (this.online && this.isHost) this._hostNet();

    // 输入帧清理
    this.fighters.forEach(f => f.input.postFrame?.());
    this.ais.forEach(a => a && a.input.postFrame());
    clearFrameInput();
  }

  _stepFighters() {
    // AI 在 fighter 更新前决策
    for (let i = 0; i < 2; i++) {
      if (this.ais[i]) {
        const me = this.fighters[i];
        const opp = this.fighters[1 - i];
        this.ais[i].update(opp, this.ctx);
      }
    }
    // 客机（guest）不跑战斗模拟，由快照驱动
    if (this.online && !this.isHost) {
      // 本地玩家（p2）仅发送输入，不模拟
    } else {
      this.p1.update(this.p2, this.ctx);
      this.p2.update(this.p1, this.ctx);
      this.p1.separate(this.p2);
    }
    // 动画
    updateRig(this.p1, this.gt);
    updateRig(this.p2, this.gt);
  }

  _checkKO() {
    if (this.p1.hp <= 0 || this.p2.hp <= 0) {
      this._endRoundByKO();
    }
  }

  _endRoundByKO() {
    this.phase = 'roundEnd';
    this.phaseT = 0;
    this.freeze = 14;
    const winner = this.p1.hp <= 0 ? this.p2 : this.p1;
    const loser = winner === this.p1 ? this.p2 : this.p1;
    winner.state = 'win';
    winner.stateT = 0;
    // loser 已在 _postDamage 中进入 ko
    audio.ko();
    this.efx.shake(0.4);
    this.efx.banner('K.O.', '', 1400);
    this._netEvent({ t: 'ko' });
    if (winner === this.p1) this.wins[0]++; else this.wins[1]++;
  }

  _endRoundByTime() {
    this.phase = 'roundEnd';
    this.phaseT = 0;
    if (this.p1.hp === this.p2.hp) {
      this.efx.banner('DRAW', '本局平局', 1400);
      return;
    }
    const winner = this.p1.hp > this.p2.hp ? this.p1 : this.p2;
    winner.state = 'win';
    winner.stateT = 0;
    const loser = winner === this.p1 ? this.p2 : this.p1;
    loser.state = 'ko';
    loser.koDir = -loser.facing;
    loser.stateT = 0;
    if (winner === this.p1) this.wins[0]++; else this.wins[1]++;
    this.efx.banner('TIME UP', '', 1400);
  }

  _nextRoundOrEnd() {
    if (this.wins[0] >= GAME.WINS_NEEDED || this.wins[1] >= GAME.WINS_NEEDED) {
      this.phase = 'matchEnd';
      this.phaseT = 0;
      const winner = this.wins[0] >= GAME.WINS_NEEDED ? this.p1 : this.p2;
      setTimeout(() => {
        if (!this.destroyed) this.opts.onMatchEnd?.(winner, this.wins);
      }, 900);
    } else {
      this.round++;
      this._startRound();
    }
  }

  _trainingReset() {
    this.p1.reset(-GAME.START_X, 1, this.round);
    this.p2.reset(GAME.START_X, -1, this.round);
    this.toast('已重置站位');
  }
  _cycleDummy() {
    const order = ['stand', 'block', 'cpu'];
    const idx = order.indexOf(this.dummyMode);
    this.dummyMode = order[(idx + 1) % order.length];
    this.ais[1].dummy = this.dummyMode;
    this.ais[1].level = this.dummyMode === 'cpu' ? 1 : 0;
    const label = { stand: '站立', block: '防御', cpu: '反击' }[this.dummyMode];
    document.getElementById('train-dummy-mode').textContent = label;
    this.toast('假人：' + label);
  }

  // ----------------------------------------------------------
  // 暂停
  togglePause() {
    if (this.phase === 'matchEnd' || this.ended) return;
    if (this.online) return; // 在线对战不暂停
    this.paused = !this.paused;
    document.getElementById('screen-pause').classList.toggle('active', this.paused);
    audio.ui();
  }
  resume() {
    this.paused = false;
    document.getElementById('screen-pause').classList.remove('active');
  }

  // ----------------------------------------------------------
  // 网络
  _hostNet() {
    // 每 3 帧发一次快照
    if (this.gt % 3 === 0) {
      const snap = this._snapshot();
      snap.events = this.netEvents;
      this.netEvents = [];
      this.online.send(snap);
    }
  }
  _guestNet() {
    // 每 3 帧发送 p2 输入
    if (this.gt % 3 === 0) {
      this.online.send(this._sampleInput(this.opts.inputs.p2));
    }
    // 应用快照
    const snap = this.online.consumeSnapshot?.();
    if (snap) this._applySnapshot(snap);
  }

  _sampleInput(inp) {
    return {
      ax: inp.axisX(),
      down: {
        block: inp.isDown('block'),
        heavy: inp.isDown('heavy'),
      },
      press: {
        light: inp.justPressed('light'),
        jump: inp.justPressed('jump'),
        heavy: inp.justPressed('heavy'),
        dodge: inp.justPressed('dodge'),
        special: inp.justPressed('special'),
        ultra: inp.justPressed('ultra'),
      },
    };
  }

  _snapshot() {
    const pick = (f) => ({
      x: f.x, y: f.y, vx: f.vx, vy: f.vy, facing: f.facing,
      state: f.state, stateT: f.stateT, move: f.move, chargeT: f.chargeT,
      hp: f.hp, energy: f.energy, shield: f.shield,
      overdrive: f.overdrive, combo: f.combo,
      onGround: f.onGround, riding: f.riding,
      punchSide: f.punchSide, hurtDir: f.hurtDir, koDir: f.koDir,
      walkPhase: f.walkPhase,
    });
    return {
      phase: this.phase, phaseT: this.phaseT, timer: this.timer,
      round: this.round, wins: this.wins,
      p1: pick(this.p1), p2: pick(this.p2),
    };
  }

  _applySnapshot(s) {
    const apply = (f, d) => {
      if (!d) return;
      f.x = d.x; f.y = d.y; f.vx = d.vx; f.vy = d.vy; f.facing = d.facing;
      f.state = d.state; f.stateT = d.stateT; f.move = d.move;
      f.chargeT = d.chargeT; f.hp = d.hp; f.energy = d.energy;
      f.shield = d.shield; f.overdrive = d.overdrive; f.combo = d.combo;
      f.onGround = d.onGround; f.punchSide = d.punchSide;
      f.hurtDir = d.hurtDir; f.koDir = d.koDir; f.walkPhase = d.walkPhase;
      // 摩托可见性
      if (f.moto) f.moto.visible = !!d.riding;
      f.riding = !!d.riding;
      // 资源视觉
      f.overdriveRing && (f.overdriveRing.visible = d.overdrive);
    };
    apply(this.p1, s.p1);
    apply(this.p2, s.p2);
    this.phase = s.phase;
    this.phaseT = s.phaseT;
    this.timer = s.timer;
    this.round = s.round;
    const prevWins = this.wins;
    this.wins = s.wins;
    // 事件
    (s.events || []).forEach(e => this._playRemoteEvent(e));
    // 客机检测比赛结束
    if (!this._guestEnded &&
        (this.wins[0] >= GAME.WINS_NEEDED || this.wins[1] >= GAME.WINS_NEEDED) &&
        this.phase === 'matchEnd') {
      this._guestEnded = true;
      const winner = this.wins[0] >= GAME.WINS_NEEDED ? this.p1 : this.p2;
      setTimeout(() => {
        if (!this.destroyed) this.opts.onMatchEnd?.(winner, this.wins);
      }, 900);
    }
  }

  _playRemoteEvent(e) {
    if (e.t === 'ultra') {
      const f = e.p === 1 ? this.p1 : this.p2;
      this.efx.ultraBanner(f.def.ultraCn, f.def.ultraEn);
      audio.ultra();
      this.efx.shake(0.3);
    } else if (e.t === 'ko') {
      audio.ko();
      this.efx.banner('K.O.', '', 1400);
    } else if (e.t === 'banner') {
      this.efx.banner(e.a, '');
      audio.fight();
    } else if (e.t === 'round') {
      this.efx.banner(`ROUND ${e.round}`, '');
    }
  }

  // ----------------------------------------------------------
  // HUD 刷新
  _updateHUD() {
    const setBar = (id, v, max) => {
      document.getElementById(id).style.width = `${Math.max(0, v / max * 100)}%`;
    };
    // HP ghost（延迟白条：掉血时缓慢追上）
    if (!this._ghostPct) this._ghostPct = [100, 100];
    const hp = (f, i, hpId, ghostId) => {
      const pct = Math.max(0, f.hp / f.def.hp * 100);
      if (this._ghostPct[i] < pct) this._ghostPct[i] = pct;
      else if (this._ghostPct[i] > pct) this._ghostPct[i] = Math.max(pct, this._ghostPct[i] - 0.7);
      document.getElementById(hpId).style.width = pct + '%';
      document.getElementById(ghostId).style.width = this._ghostPct[i] + '%';
    };
    hp(this.p1, 0, 'hud-p1-hp', 'hud-p1-hp-ghost');
    hp(this.p2, 1, 'hud-p2-hp', 'hud-p2-hp-ghost');
    setBar('hud-p1-shield', this.p1.shield, RESOURCE.SHIELD_MAX);
    setBar('hud-p2-shield', this.p2.shield, RESOURCE.SHIELD_MAX);
    [this.p1, this.p2].forEach((f, i) => {
      const eId = i === 0 ? 'hud-p1-energy' : 'hud-p2-energy';
      const lId = i === 0 ? 'hud-p1-energy-label' : 'hud-p2-energy-label';
      const el = document.getElementById(eId);
      el.style.width = Math.min(100, f.energy) + '%';
      el.classList.toggle('ready', f.energy >= 50 && !f.overdrive);
      el.classList.toggle('overdrive', f.overdrive);
      document.getElementById(lId).textContent =
        f.overdrive ? '爆气' : (f.energy >= 100 ? 'READY' : '');
    });
    const t = Math.max(0, Math.ceil(this.timer));
    const timerEl = document.getElementById('hud-timer');
    timerEl.textContent = this.training ? '∞' : t;
    timerEl.classList.toggle('urgent', !this.training && t <= 10);
    document.getElementById('hud-round').textContent = 'ROUND ' + this.round;
    // 胜局点
    const mkDots = (id, wins) => {
      const el = document.getElementById(id);
      el.innerHTML = [0, 1].map(i => `<i class="${i < wins ? 'won' : ''}"></i>`).join('');
    };
    mkDots('hud-p1-wins', this.wins[0]);
    mkDots('hud-p2-wins', this.wins[1]);
    // 连击消失
    [0, 1].forEach(i => {
      const f = this.fighters[i];
      const el = document.getElementById(i === 0 ? 'combo-p1' : 'combo-p2');
      if (f.comboTimer === 0) el.classList.remove('show');
    });
  }

  // ----------------------------------------------------------
  // 相机
  _updateCamera() {
    const mid = (this.p1.x + this.p2.x) / 2;
    const dist = Math.abs(this.p1.x - this.p2.x);
    const z = 7.6 + Math.max(0, dist - 4) * 0.3;
    const y = 2.6 + Math.max(0, dist - 5) * 0.12;
    this.camera.position.x += (mid * 0.35 - this.camera.position.x) * 0.08;
    this.camera.position.y += (y - this.camera.position.y) * 0.08;
    this.camera.position.z += (z - this.camera.position.z) * 0.08;
    const shake = this.efx.shakeOffset();
    this.camera.position.add(shake);
    this.camera.lookAt(mid * 0.35, 1.15, 0);
  }

  // ----------------------------------------------------------
  _loop = (now) => {
    if (this.destroyed) return;
    this._raf = requestAnimationFrame(this._loop);
    let dt = now - this._last;
    this._last = now;
    if (dt > 120) dt = 120;
    this._acc += dt;
    const STEP = 1000 / GAME.FPS;
    let steps = 0;
    while (this._acc >= STEP && steps < 5) {
      this._logicStep();
      this._acc -= STEP;
      steps++;
    }
    this._updateHUD();
    this._updateCamera();
    this.renderer.render(this.scene, this.camera);
  }

  // 按键事件（main 转发）
  onKeyPressed(code) {
    if (code === 'Escape' || code === 'KeyP') this._pressedPause = true;
    if (this.training) {
      if (code === 'KeyR') this._keyR = true;
      if (code === 'KeyH') this._keyH = true;
    }
  }

  // 远端输入（host 收到客机消息）
  applyRemoteInput(data) {
    const inp = this.p2.input;
    if (typeof inp.setAxis === 'function') {
      inp.setAxis(data.ax || 0);
      Object.entries(data.down || {}).forEach(([a, v]) => inp.hold?.(a, v));
      Object.entries(data.press || {}).forEach(([a, v]) => { if (v) inp.press?.(a); });
    }
  }

  exit() {
    this.destroyed = true;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    document.getElementById('screen-hud').classList.remove('active');
    document.body.classList.remove('versus', 'training');
    document.getElementById('screen-pause').classList.remove('active');
    document.querySelectorAll('.combo').forEach(el => el.classList.remove('show'));
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => { m.map?.dispose?.(); m.dispose?.(); });
      }
    });
    // BGM 保持播放（菜单与战斗共用，仅静音时停）
  }
}
