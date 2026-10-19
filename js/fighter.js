// ============================================================
// fighter.js — 战斗实体：状态机、物理、招式帧判定、受击/护盾/能量
// ============================================================
import * as THREE from 'three';
import { CHARACTERS, MOVES, GAME, RESOURCE, HURT_BOX } from './config.js';
import { buildCharacter, buildMotorcycle } from './characters.js';
import { updateRig } from './anim.js';

// AI 虚拟输入（与 InputManager 同接口）
export class AIInput {
  constructor() { this.down = {}; this.pressed = {}; this.ax = 0; }
  isDown(a) { return !!this.down[a]; }
  justPressed(a) { return !!this.pressed[a]; }
  axisX() {
    // 远端快照用 setAxis；本地 AI 用 hold('left'/'right')
    if (this.ax !== 0) return this.ax;
    return (this.down.right ? 1 : 0) - (this.down.left ? 1 : 0);
  }
  setAxis(x) { this.ax = x; }
  hold(a, v) { this.down[a] = v; }
  press(a) { this.pressed[a] = true; this.down[a] = true; }
  release(a) { this.down[a] = false; }
  postFrame() { this.pressed = {}; this.down = {}; }
}

export class Fighter {
  constructor(charId, player, input) {
    const built = buildCharacter(charId);
    this.group = built.group;
    this.rig = built.rig;
    this.def = CHARACTERS[charId];
    this.moves = MOVES[charId];
    this.charId = charId;
    this.player = player;
    this.input = input;

    // 护盾泡 / 爆气光环
    this.shieldBubble = null;
    this.overdriveRing = null;

    // 摩托（肥嘟嘟）
    if (charId === 'feidudu') {
      this.moto = buildMotorcycle();
      this.moto.rotation.y = -Math.PI / 2;
      this.group.add(this.moto);
      this._engineStop = null;
    }

    // 收集材质（受击闪白用）
    this.materials = [];
    this.group.traverse(o => {
      if (o.isMesh && o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => {
          if (m.emissive && !this.materials.includes(m)) this.materials.push(m);
        });
      }
    });

    this.reset(player === 1 ? -GAME.START_X : GAME.START_X, player === 1 ? 1 : -1, 1);
  }

  reset(x, facing, round) {
    this.x = x;
    this.y = 0;
    this.vx = 0; this.vy = 0;
    this.facing = facing;
    this.hp = this.def.hp;
    this.energy = 0;
    this.shield = RESOURCE.SHIELD_MAX;
    this.state = 'idle';
    this.stateT = 0;
    this.move = null;
    this.moveData = null;
    this.moveT = 0;
    this.chargeT = 0;
    this.onGround = true;
    this.walkPhase = 0;
    this.invinc = 0;
    this.dodgeCd = 0;
    this.blockT = 0;
    this.shieldDelay = 0;
    this.overdrive = false;
    this.overdriveT = 0;
    this.hitSet = new Set();
    this.landedHit = false;
    this.punchSide = 1;
    this.hurtDir = 0;
    this.koDir = 0;
    this.hitFlash = 0;
    this.riding = false;
    this.rideHit = false;
    this.rideSeg = -1;
    this.rideDir = 0;
    this.lastRushIdx = -1;
    this.combo = 0;
    this.comboTimer = 0;
    this.freezeT = 0;
    this.ultraDone = false;
    this.round = round;
    if (this.moto) { this.moto.visible = false; }
    this._applyTransform();
  }

  attachEffects(efx) {
    this.shieldBubble = efx.createShield();
    this.overdriveRing = efx.createOverdrive();
    this.group.add(this.shieldBubble);
    this.group.add(this.overdriveRing);
  }

  isBusy() {
    return ['light','airLight','heavy','special','ultra','hurt','recoil',
      'guardBreak','dodge','ko','win'].includes(this.state);
  }
  canAct() {
    return ['idle','walk','jump'].includes(this.state) && this.state !== 'ko';
  }

  // ----------------------------------------------------------
  // 启动招式
  startMove(name, data, opts = {}) {
    this.state = name;
    this.move = name;
    this.moveData = data;
    this.moveT = 0;
    this.stateT = 0;
    this.hitSet.clear();
    this.landedHit = false;
    this.chargeT = 0;
    this.lastRushIdx = -1;
    this.rideSeg = -1;
    this.riding = false;
    this.rideHit = false;
    if (name === 'light' || name === 'airLight') this.punchSide = opts.side || (this.punchSide === 1 ? -1 : 1);
    if (name === 'special') {
      if (this.charId === 'feidudu') this._startMoto();
      this.energy = Math.max(0, this.energy - RESOURCE.SPECIAL_COST);
    }
    if (name === 'ultra') {
      this.energy = 0;
      this.overdrive = false;
      this.overdriveT = 0;
      if (this.overdriveRing) this.overdriveRing.visible = false;
    }
  }

  _startMoto() {
    this.moto.visible = true;
    this.riding = false;
    if (this._engineStop) { try { this._engineStop(); } catch (e) {} }
  }
  _stopMoto() {
    if (this.moto) this.moto.visible = false;
    this.riding = false;
    if (this._engineStop) { try { this._engineStop(); } catch (e) {} this._engineStop = null; }
  }

  // ----------------------------------------------------------
  // 受击入口。返回结果：invincible / perfect / block / hit / armored
  tryHit(attacker, info, segId, ctx) {
    if (this.state === 'ko') return 'miss';
    if (this.invinc > 0) { ctx.effects.ring(this._chestPos(attacker.facing)); return 'invincible'; }
    const isUltra = info.ultra;
    const inUltra = this.state === 'ultra';

    // 完美格挡（刚按盾 6 帧内，面向攻击者，大必杀不可挡）
    const facingBlock = this.state === 'block' && this.facing === -attacker.facing;
    if (facingBlock && !isUltra && this.blockT <= RESOURCE.PERFECT_WINDOW) {
      this.blockT = 99; // 防止单攻击多次判定完美
      ctx.effects.ring(this._chestPos(attacker.facing), '#9ff7c6');
      ctx.effects.hitBurst(this._chestPos(attacker.facing), '#9ff7c6', 8, 0.8);
      ctx.audio.perfect();
      // 攻击者大硬直
      attacker._enterRecoil(30);
      return 'perfect';
    }
    // 普通格挡
    if (facingBlock && !isUltra) {
      const hpDmg = info.damage * RESOURCE.SHIELD_REDUCE;
      const shieldDmg = info.damage * RESOURCE.SHIELD_COST_MUL;
      this.hp -= hpDmg;
      this.shield -= shieldDmg;
      this.shieldDelay = RESOURCE.SHIELD_REGEN_DELAY;
      this._addEnergy(info.damage * 0.25, true);
      ctx.effects.hitBurst(this._chestPos(attacker.facing), '#3ee08a', 6, 0.5);
      ctx.effects.pop(this._chestPos(attacker.facing), '格挡', 'block');
      ctx.audio.block();
      if (this.shield <= 0) {
        this.shield = 0;
        this.state = 'guardBreak';
        this.stateT = 0;
        ctx.audio.heavyHit();
        ctx.effects.shake(0.12);
      }
      this._postDamage();
      return 'block';
    }

    // 命中
    let dmg = info.damage;
    if (attacker.overdrive) dmg *= RESOURCE.OVERDRIVE_DMG_MUL;
    if (inUltra) dmg *= 0.5;           // 大必杀霸体减伤
    dmg = Math.round(dmg);

    this.hp -= dmg;
    attacker._addEnergy(dmg * RESOURCE.ENERGY_BY_DEAL, false);
    this._addEnergy(dmg * RESOURCE.ENERGY_BY_TAKE, true);
    this.shieldDelay = RESOURCE.SHIELD_REGEN_DELAY;
    this.hitFlash = 6;

    // 连击归属
    if (attacker.lastAttacker === attacker) {
      // 保留
    }
    attacker.combo++;
    attacker.comboTimer = RESOURCE.COMBO_DROP_FRAMES;
    ctx.comboEvent(attacker);

    // 飘字 / 特效 / 音效
    const pos = this._chestPos(attacker.facing);
    const cls = info.crit ? 'crit' : '';
    ctx.effects.pop(pos, dmg, cls);
    ctx.effects.hitBurst(pos, info.crit ? '#ff5a2e' : '#ffd35e', info.crit ? 16 : 10, info.crit ? 1.4 : 1);
    ctx.effects.ring(pos);
    ctx.effects.shake(info.crit ? 0.22 : 0.1);
    if (info.heavy) ctx.audio.heavyHit(); else ctx.audio.hit();
    ctx.freeze = Math.max(ctx.freeze, info.crit ? GAME.HIT_FREEZE + 3 : GAME.HIT_FREEZE);

    // 霸体（ultra）不打断
    if (!inUltra) {
      this.vx = -attacker.facing * info.kb;
      if (info.vy) {
        this.vy = info.vy;
        this.onGround = false;
      }
      this.hurtDir = -attacker.facing;
      this.state = 'hurt';
      this.stateT = 0;
      this.hurtStun = info.hitstun || 14;
      this.move = null;
      this._stopMoto();
      // 打断招式：冲拳/特殊中断
    }
    this._postDamage();
    return 'hit';
  }

  _enterRecoil(frames) {
    if (this.state === 'ultra' || this.state === 'ko') return;
    this.state = 'recoil';
    this.stateT = 0;
    this.recoilStun = frames;
    this.vx = -this.facing * 1.5;
    this._stopMoto();
  }

  _chestPos(fromFacing) {
    return new THREE.Vector3(this.x + fromFacing * 0.5, this.y + 1.3, 0);
  }

  _addEnergy(v) {
    if (this.training) return;
    this.energy = Math.min(RESOURCE.ENERGY_MAX, this.energy + v);
  }

  _postDamage() {
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'ko';
      this.stateT = 0;
      this.koDir = -this.facing;
      this.vx = -this.facing * 1.2;
      this._stopMoto();
    }
  }

  // ----------------------------------------------------------
  // 每逻辑帧
  update(opp, ctx) {
    this.training = ctx.training;
    if (this.state === 'ko') {
      this.stateT++;
      this._physics(false, opp);
      this._applyTransform();
      this._visuals(ctx);
      return;
    }
    if (this.state === 'win') {
      this.stateT++;
      this.vx *= 0.8;
      this.x += this.vx / 60;
      this._applyTransform();
      this._visuals(ctx);
      return;
    }

    // 计时器
    if (this.invinc > 0) this.invinc--;
    if (this.dodgeCd > 0) this.dodgeCd--;
    if (this.comboTimer > 0) { this.comboTimer--; if (this.comboTimer === 0) this.combo = 0; }
    if (this.shieldDelay > 0) this.shieldDelay--;
    else if (this.shield < RESOURCE.SHIELD_MAX) this.shield = Math.min(RESOURCE.SHIELD_MAX, this.shield + RESOURCE.SHIELD_REGEN_RATE);
    if (this.overdrive) {
      this.overdriveT--;
      if (this.overdriveT <= 0) { this.overdrive = false; this.energy = 0; }
    }
    if (this.training) this.energy = RESOURCE.ENERGY_MAX;

    // 状态机
    const can = this.canAct();
    if (this.state === 'idle' || this.state === 'walk' || this.state === 'jump') {
      this._freeState(opp, ctx, can);
    } else if (this.state === 'block') {
      this._blockState(opp, ctx);
    } else if (this.state === 'dodge') {
      this._dodgeState(opp, ctx);
    } else if (this.state === 'light' || this.state === 'airLight') {
      this._lightState(opp, ctx);
    } else if (this.state === 'heavy') {
      this._heavyState(opp, ctx);
    } else if (this.state === 'special') {
      this._specialState(opp, ctx);
    } else if (this.state === 'ultra') {
      this._ultraState(opp, ctx);
    } else if (this.state === 'hurt' || this.state === 'recoil') {
      this._hurtState(opp, ctx);
    } else if (this.state === 'guardBreak') {
      this.stateT++;
      this.vx *= 0.9;
      if (this.stateT >= RESOURCE.GUARD_BREAK_STUN) this.setState('idle');
    }

    this._physics(true, opp);
    this._combat(opp, ctx);
    this._applyTransform();
    this._visuals(ctx);
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
    if (s !== 'walk' && s !== 'idle') this.walkPhase = 0;
  }

  // ---------- 自由状态（移动/出招输入） ----------
  _freeState(opp, ctx) {
    const inp = this.input;
    const ax = inp.axisX();

    // 跳跃
    if (this.onGround && inp.justPressed('jump')) {
      this.vy = GAME.JUMP_V;
      this.onGround = false;
      this.setState('jump');
      ctx.audio.jump();
    }
    // 爆气 / 大必杀
    if (this.onGround && inp.justPressed('ultra')) {
      if (this.overdrive) {
        this.startMove('ultra', this.moves.ultra);
        ctx.onUltra(this);
      } else if (this.energy >= RESOURCE.OVERDRIVE_COST || this.training) {
        this.overdrive = true;
        this.overdriveT = RESOURCE.OVERDRIVE_FRAMES;
        this.energy = RESOURCE.ENERGY_MAX;
        ctx.effects.ring(this._chestPos(this.facing), '#ffd35e');
        ctx.effects.hitBurst(this._chestPos(this.facing), '#ffd35e', 14, 1);
        ctx.audio.special();
        ctx.toast(`爆气！再按 爆气键 开大`);
      }
      return;
    }
    // 小必杀
    if (this.onGround && inp.justPressed('special') &&
        (this.energy >= RESOURCE.SPECIAL_COST || this.training)) {
      this.startMove('special', this.moves.special);
      ctx.audio.special();
      return;
    }
    // 重击（按住蓄力）
    if (this.onGround && inp.justPressed('heavy')) {
      this.startMove('heavy', this.moves.heavy);
      return;
    }
    // 轻拳
    if (inp.justPressed('light')) {
      if (this.onGround) {
        this.startMove('light', this.moves.light, { side: this.punchSide === 1 ? -1 : 1 });
        ctx.audio.swing();
      } else {
        this.startMove('airLight', this.moves.airLight);
        ctx.audio.swing();
      }
      return;
    }
    // 护盾（按住）
    if (this.onGround && inp.isDown('block')) {
      this.setState('block');
      this.blockT = 0;
      this.vx = 0;
      return;
    }
    // 闪避
    if (this.onGround && inp.justPressed('dodge') && this.dodgeCd <= 0) {
      this.setState('dodge');
      this.dodgeDir = ax !== 0 ? ax : -this.facing;
      this.invinc = RESOURCE.DODGE_INVINC_END;
      this.dodgeCd = RESOURCE.DODGE_CD;
      ctx.audio.dodge();
      return;
    }

    // 移动
    if (this.onGround) {
      if (ax !== 0) {
        if (this.state !== 'walk') this.setState('walk');
        this.vx = ax * this.def.walkSpeed * (this.overdrive ? 1.08 : 1);
        this.walkPhase += 0.32;
      } else {
        if (this.state !== 'jump') this.setState('idle');
        this.vx = 0;
      }
    }
  }

  // ---------- 防御 ----------
  _blockState(opp, ctx) {
    this.blockT++;
    this.vx = 0;
    if (!this.input.isDown('block')) this.setState('idle');
  }

  // ---------- 闪避 ----------
  _dodgeState(opp, ctx) {
    const d = RESOURCE;
    const k = this.stateT / d.DODGE_FRAMES;
    const arc = Math.sin(k * Math.PI);
    this.vx = this.dodgeDir * d.DODGE_DIST * arc * 3.5;
    if (this.stateT >= d.DODGE_FRAMES) this.setState('idle');
    this.stateT++;
  }

  // ---------- 轻拳 ----------
  _lightState(opp, ctx) {
    const d = this.moveData;
    const total = d.startup + d.active + d.recovery;
    // 命中后允许在 recovery 中段取消轻拳（连段）
    const cancelAt = d.startup + d.active + Math.floor(d.recovery * 0.35);
    if (this.stateT > cancelAt && this.landedHit && this.input.justPressed('light')) {
      this.startMove('light', this.moves.light, { side: this.punchSide === 1 ? -1 : 1 });
      ctx.audio.swing();
      return;
    }
    if (this.stateT > cancelAt && this.landedHit && this.input.justPressed('special') &&
        (this.energy >= RESOURCE.SPECIAL_COST || this.training)) {
      this.startMove('special', this.moves.special);
      ctx.audio.special();
      return;
    }
    if (this.stateT >= total) {
      if (this.state === 'airLight' && !this.onGround) { this.setState('jump'); }
      else this.setState('idle');
      return;
    }
    this.stateT++;
    // 轻微前冲
    if (this.stateT >= d.startup && this.stateT < d.startup + d.active) {
      this.vx = this.facing * 0.9;
    } else {
      this.vx *= 0.6;
    }
    // 空中轻拳落地
    if (this.state === 'airLight' && this.onGround) {
      this.setState('idle');
    }
  }

  // ---------- 重击（蓄力） ----------
  _heavyState(opp, ctx) {
    const d = this.moveData;
    const maxCharge = 45;
    const holding = this.input.isDown('heavy');
    if (this.stateT < d.startup + maxCharge && holding) {
      this.chargeT = Math.max(0, Math.min(maxCharge, this.stateT - d.startup + 1));
      if (this.chargeT === 1) ctx.audio.charge();
      this.stateT++;
      this.vx = 0;
      return;
    }
    const startup = d.startup + this.chargeT;
    if (this.stateT >= startup + d.active + d.recovery) {
      this.setState('idle');
      this.chargeT = 0;
      return;
    }
    this.stateT++;
    if (this.stateT === startup + 1) {
      this.vx = this.facing * 2.4;
      ctx.audio.heavySwing();
    }
    this.vx *= 0.85;
  }

  // ---------- 小必杀 ----------
  _specialState(opp, ctx) {
    const d = this.moveData;
    this.stateT++;

    if (this.charId === 'naiwa') {
      // 逐段小幅前冲（rushes.at 为绝对 stateT）
      d.rushes.forEach(r => {
        if (this.stateT === r.at) this.vx = this.facing * 1.6;
      });
      this.vx *= 0.85;
      if (this.stateT >= d.total) { this.setState('idle'); this.faceTo(opp); }
    } else {
      // 肥嘟嘟骑摩托
      if (this.stateT < d.rideStart) {
        this.vx *= 0.6;
      } else if (this.stateT < d.rideEnd) {
        if (!this.riding) {
          this.riding = true;
          this._engineStop = ctx.audio.engine();
        }
        this.vx = this.facing * d.rideSpeed * 60;
        // 轮子转动
        if (this.moto) {
          this.moto.userData.wheels.forEach(w => { w.rotation.x += 0.6; });
          const tail = new THREE.Vector3(-0.6, 0.35, 0);
          this.moto.localToWorld(tail);
          if (this.stateT % 2 === 0) ctx.effects.smoke(tail);
        }
      } else {
        if (this.riding) { this._stopMoto(); }
        this.vx *= 0.8;
        if (this.stateT >= d.total) { this.setState('idle'); this.faceTo(opp); }
      }
    }
  }

  // ---------- 大必杀 ----------
  _ultraState(opp, ctx) {
    const d = this.moveData;
    this.stateT++;

    if (this.charId === 'naiwa') {
      // banner 期间自动贴近
      if (this.stateT < d.banner) {
        const dx = opp.x - this.x;
        if (Math.abs(dx) > 1.4) this.x += Math.sign(dx) * 0.06;
        this.faceTo(opp);
        this.vx = 0;
      } else {
        const rt = this.stateT - d.banner;
        d.rushes.forEach((r, i) => {
          if (rt === r.at) {
            this.vx = this.facing * (i === d.rushes.length - 1 ? 2.6 : 1.6);
          }
        });
        this.vx *= 0.86;
      }
      if (this.stateT >= d.total) { this.setState('idle'); this.faceTo(opp); }
    } else {
      // 肥嘟嘟：每段冲撞前定位到目标身后 8 米
      d.rushes.forEach((r, i) => {
        if (r.type === 'ride' && this.stateT === d.banner + r.at - 8) {
          this.faceTo(opp);
          const dist = 8.2;
          this.x = opp.x - this.facing * dist;
          this.moto.visible = true;
          this.riding = true;
          this.rideSeg = i;
          this.rideHit = false;
          if (!this._engineStop) this._engineStop = ctx.audio.engine();
        }
        if (r.type === 'ride' && this.stateT === d.banner + r.at + 24) {
          this.riding = false;
        }
        if (r.type === 'punch' && this.stateT === d.banner + r.at) {
          this._stopMoto();
          this.faceTo(opp);
          const dx = opp.x - this.x;
          this.x = opp.x - this.facing * 1.4;
          this.vx = this.facing * 2.6;
        }
      });
      // 小票雨（横幅期间）
      if (this.stateT === d.banner) ctx.effects.receiptsRain();
      if (this.riding) {
        this.vx = this.facing * 26;
        if (this.moto) {
          this.moto.userData.wheels.forEach(w => { w.rotation.x += 0.7; });
          if (this.stateT % 2 === 0) {
            const tail = new THREE.Vector3(-0.6, 0.35, 0);
            this.moto.localToWorld(tail);
            ctx.effects.smoke(tail);
          }
        }
      } else {
        this.vx *= 0.9;
      }
      if (this.stateT >= d.total) { this.setState('idle'); this._stopMoto(); this.faceTo(opp); }
    }
  }

  // ---------- 受击/弹反硬直 ----------
  _hurtState(opp, ctx) {
    const stun = this.state === 'recoil' ? this.recoilStun : this.hurtStun;
    this.stateT++;
    this.vx *= 0.88;
    if (this.stateT >= stun && this.onGround) {
      this.setState('idle');
    }
    if (this.stateT >= stun && !this.onGround) {
      // 空中继续等待落地
    }
  }

  faceTo(opp) {
    this.facing = opp.x >= this.x ? 1 : -1;
  }

  // ---------- 物理 ----------
  _physics(active, opp) {
    const dt = 1 / GAME.FPS;
    // 重力
    if (!this.onGround) {
      this.vy -= GAME.GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        if (this.vy < -6) { /* 落地声由 battle 处理 */ }
        this.y = 0; this.vy = 0;
        this.onGround = true;
        if (this.state === 'jump' || this.state === 'airLight') this.setState('idle');
      }
    }
    this.x += this.vx * dt;
    // 边界
    this.x = Math.max(-GAME.STAGE_HALF, Math.min(GAME.STAGE_HALF, this.x));
    // 自由状态下持续面向对手
    if (['idle','walk','jump','block'].includes(this.state)) {
      this.facing = opp.x >= this.x ? 1 : -1;
    }
  }

  // 互推（battle 每帧调用）
  separate(opp) {
    const dx = this.x - opp.x;
    const adx = Math.abs(dx);
    const minGap = GAME.MIN_GAP;
    if (adx < minGap && adx > 0.0001) {
      const push = (minGap - adx) / 2;
      const dir = Math.sign(dx);
      // 招式状态者不被推开
      const meLocked = this.state === 'special' || this.state === 'ultra' || this.riding;
      const oppLocked = opp.state === 'special' || opp.state === 'ultra' || opp.riding;
      if (!meLocked && !oppLocked) {
        this.x += dir * push; opp.x -= dir * push;
      } else if (!oppLocked) {
        opp.x -= dir * (minGap - adx);
      } else if (!meLocked) {
        this.x += dir * (minGap - adx);
      }
      this.x = Math.max(-GAME.STAGE_HALF, Math.min(GAME.STAGE_HALF, this.x));
      opp.x = Math.max(-GAME.STAGE_HALF, Math.min(GAME.STAGE_HALF, opp.x));
    }
  }

  // ---------- 攻击判定（本帧攻击盒） ----------
  _combat(opp, ctx) {
    const boxes = this._activeBoxes();
    boxes.forEach(b => {
      if (this.hitSet.has(b.seg)) return;
      // 水平距离
      const dx = (opp.x - this.x) * this.facing;
      const vert = this.y;
      const vertOpp = opp.y;
      // 高度重叠
      const aMin = vert + b.yMin, aMax = vert + b.yMax;
      const oMin = vertOpp + HURT_BOX.yMin, oMax = vertOpp + HURT_BOX.yMax;
      const overlapY = aMax > oMin && aMin < oMax;
      const inRange = dx > 0.15 && dx < b.range + HURT_BOX.halfW;
      if (overlapY && inRange) {
        const info = {
          damage: b.damage, kb: b.kb, vy: b.vy, hitstun: b.hitstun,
          heavy: b.heavy, crit: b.crit, ultra: b.ultra,
        };
        const res = opp.tryHit(this, info, b.seg, ctx);
        if (res !== 'miss' && res !== 'invincible') {
          this.hitSet.add(b.seg);
          this.landedHit = true;
        }
      }
    });
  }

  _activeBoxes() {
    const out = [];
    const t = this.stateT;
    const isUltra = this.state === 'ultra';

    if (this.state === 'light' || this.state === 'airLight') {
      const d = this.moveData;
      if (t >= d.startup && t < d.startup + d.active) {
        out.push({ seg: 'p', range: d.range, yMin: d.yMin, yMax: d.yMax,
          damage: d.damage, kb: d.kb, vy: d.vy, hitstun: d.hitstun, heavy: false, crit: false });
      }
    }
    if (this.state === 'heavy') {
      const d = this.moveData;
      const startup = d.startup + this.chargeT;
      if (t >= startup && t < startup + d.active) {
        const chargeMul = 1 + (this.chargeT / 45) * (d.chargeMul - 1);
        out.push({ seg: 'h', range: d.range, yMin: d.yMin, yMax: d.yMax,
          damage: d.damage * chargeMul, kb: d.kb * chargeMul, vy: null,
          hitstun: d.hitstun, heavy: true, crit: this.chargeT >= 40 });
      }
    }
    if (this.state === 'special') {
      const d = this.moveData;
      if (this.charId === 'naiwa') {
        // rushes.at 为 stateT 绝对帧
        d.rushes.forEach((r, i) => {
          if (t >= r.at - 3 && t < r.at + 6 && !this.hitSet.has(i)) {
            out.push({ seg: i, range: r.range, yMin: 0.8, yMax: 1.9,
              damage: r.damage, kb: r.kb, vy: null, hitstun: r.hitstun,
              heavy: i === d.rushes.length - 1, crit: i === d.rushes.length - 1 });
          }
        });
      } else {
        // 摩托持续判定（一次命中）
        if (this.riding && !this.rideHit) {
          out.push({ seg: 'ride', range: 2.0, yMin: 0.1, yMax: 1.9,
            damage: d.damage, kb: d.kb, vy: null, hitstun: d.hitstun, heavy: true, crit: true });
        }
      }
    }
    if (isUltra) {
      const d = this.moveData;
      const rt = t - d.banner; // rushes.at 相对横幅
      d.rushes.forEach((r, i) => {
        if (this.hitSet.has(i)) return;
        if (r.type === 'ride') {
          if (rt >= r.at - 8 && rt < r.at + 26) {
            out.push({ seg: i, range: r.range, yMin: 0.1, yMax: 2.0,
              damage: r.damage, kb: r.kb, vy: null, hitstun: r.hitstun,
              heavy: true, crit: true, ultra: true });
          }
        } else {
          if (rt >= r.at - 3 && rt < r.at + 7) {
            out.push({ seg: i, range: r.range, yMin: 0.6, yMax: 2.2,
              damage: r.damage, kb: r.kb, vy: r.vy || null, hitstun: r.hitstun,
              heavy: i === d.rushes.length - 1, crit: i === d.rushes.length - 1, ultra: true });
          }
        }
      });
    }
    return out;
  }

  // 视觉每帧
  _applyTransform() {
    this.group.position.set(this.x, this.y, 0);
    this.group.rotation.y = this.facing === 1 ? Math.PI / 2 : -Math.PI / 2;
  }

  _visuals(ctx) {
    // 受击闪白
    const flash = this.hitFlash > 0 ? this.hitFlash / 6 : 0;
    this.hitFlash = Math.max(0, this.hitFlash - 1);
    this.materials.forEach(m => {
      if (m.emissive) m.emissive.setRGB(flash * 0.9, flash * 0.7, flash * 0.5);
    });
    // 护盾泡
    if (this.shieldBubble) {
      const show = this.state === 'block' || this.state === 'guardBreak';
      this.shieldBubble.visible = show;
      if (show) {
        const k = this.shield / RESOURCE.SHIELD_MAX;
        this.shieldBubble.userData.bubble.material.opacity = 0.1 + k * 0.15;
        this.shieldBubble.userData.wire.rotation.z += 0.04;
      }
    }
    // 爆气光环
    if (this.overdriveRing) {
      this.overdriveRing.visible = this.overdrive;
      if (this.overdrive) {
        this.overdriveRing.userData.ring.rotation.z += 0.12;
        this.overdriveRing.userData.ring.scale.setScalar(1 + Math.sin(ctx.gt * 0.4) * 0.08);
      }
    }
  }
}
