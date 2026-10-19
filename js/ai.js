// ============================================================
// ai.js — 单人街机 CPU 与训练假人
// ============================================================
import { AIInput } from './fighter.js';
import { RESOURCE } from './config.js';

export class AIController {
  constructor(fighter, opts = {}) {
    this.f = fighter;
    this.input = new AIInput();
    fighter.input = this.input;
    this.level = opts.level ?? 1;        // 0 训练 1 普通 2 凶猛
    this.dummy = opts.dummy || 'stand';  // stand / block / cpu（训练模式用）
    this.plan = 'idle';
    this.planT = 0;
    this.rng = Math.random;
  }

  // 每逻辑帧（在 fighter.update 前）
  update(opp, ctx) {
    const inp = this.input;
    // 重置按住类输入
    ['left', 'right', 'block'].forEach(a => inp.hold(a, false));
    const f = this.f;

    // 训练假人
    if (this.level === 0 && this.dummy !== 'cpu') {
      if (this.dummy === 'block') inp.hold('block', true);
      return;
    }

    // 挨打 / 出招中：不做决策
    if (f.state === 'ko' || f.state === 'win') return;
    if (f.isBusy() && f.state !== 'dodge') {
      // 出招中可按盾快速防御？保持简单：不操作
      return;
    }

    const dx = opp.x - f.x;
    const adx = Math.abs(dx);
    const dir = Math.sign(dx);
    const facingOpp = (f.facing === dir) || (dir === 0);

    // ---------- 防御反应（每帧） ----------
    const oppThreat = this._oppThreatLevel(opp);
    if (f.onGround && oppThreat > 0 && facingOpp) {
      if (oppThreat >= 3) {
        // 大必杀 / 摩托：必须闪避
        if (f.dodgeCd <= 0 && this.rng() < 0.75 + this.level * 0.1) {
          inp.hold(dir > 0 ? 'right' : 'left', false);
          inp.press('dodge');
          return;
        }
        // 退不开就跳开
        if (this.rng() < 0.3) inp.press('jump');
      } else if (oppThreat === 2) {
        const r = this.rng();
        if (r < 0.35 + this.level * 0.1 && f.dodgeCd <= 0) {
          inp.press('dodge');
          return;
        }
        if (r < 0.7) inp.hold('block', true);
      } else {
        if (this.rng() < 0.35 + this.level * 0.15) inp.hold('block', true);
      }
    }

    // ---------- 规划节奏 ----------
    this.planT--;
    if (this.planT <= 0) {
      this._choosePlan(adx, opp, ctx);
    }

    // 执行计划
    switch (this.plan) {
      case 'approach':
        if (dir > 0) inp.hold('right', true);
        else inp.hold('left', true);
        if (adx < 1.65) this.planT = 1;
        break;
      case 'retreat':
        if (dir > 0) inp.hold('left', true);
        else inp.hold('right', true);
        break;
      case 'light':
        if (adx < 1.75 && facingOpp) inp.press('light');
        this.plan = 'approach'; this.planT = 12;
        break;
      case 'heavy':
        if (adx < 1.9 && facingOpp) inp.press('heavy');
        this.plan = 'approach'; this.planT = 26;
        break;
      case 'special':
        if (adx < 3 && facingOpp) inp.press('special');
        this.plan = 'approach'; this.planT = 30;
        break;
      case 'overdrive':
        inp.press('ultra');
        this.plan = 'idle'; this.planT = 20;
        break;
      case 'ultra':
        if (adx < 2 && facingOpp) {
          inp.press('ultra');
          this.plan = 'idle';
        } else {
          if (dir > 0) inp.hold('right', true); else inp.hold('left', true);
        }
        this.planT = 10;
        break;
      case 'jump':
        inp.press('jump');
        if (dir > 0) inp.hold('right', true); else inp.hold('left', true);
        this.plan = 'approach'; this.planT = 20;
        break;
    }
  }

  // 威胁等级 0 无 / 1 轻拳 / 2 重击或小必杀 / 3 大必杀或冲撞
  _oppThreatLevel(opp) {
    if (opp.state === 'ultra') return 3;
    if (opp.state === 'special') {
      // 摩托已经在骑：威胁 3
      if (opp.charId === 'feidudu' && (opp.riding || opp.stateT > opp.moveData.rideStart - 4)) return 3;
      return 2;
    }
    if (opp.state === 'heavy') {
      // 起手阶段就算威胁
      const d = opp.moveData;
      if (opp.stateT > 4 + (opp.chargeT || 0) * 0.3) return 2;
    }
    if (opp.state === 'light') {
      if (opp.stateT < opp.moveData.startup + 1) return 1;
    }
    return 0;
  }

  _choosePlan(adx, opp, ctx) {
    const f = this.f;
    const r = this.rng();

    // 爆气 / 大必杀
    if (f.overdrive) {
      this.plan = 'ultra';
      this.planT = 10;
      return;
    }
    if ((f.energy >= RESOURCE.OVERDRIVE_COST || f.training) && r < 0.5 + this.level * 0.1) {
      this.plan = 'overdrive';
      this.planT = 5;
      return;
    }
    // 小必杀
    if ((f.energy >= RESOURCE.SPECIAL_COST || f.training) && adx < 2.6 && r < 0.35 + this.level * 0.1) {
      this.plan = 'special';
      this.planT = 8;
      return;
    }

    if (adx > 2.2) {
      this.plan = 'approach';
      this.planT = 14 + this.rng() * 10;
      if (r < 0.12) this.plan = 'jump';
    } else if (adx < 1.0) {
      this.plan = r < 0.55 ? 'light' : (r < 0.75 ? 'retreat' : 'heavy');
      this.planT = 16;
    } else {
      // 1.0~2.2
      if (r < 0.45) this.plan = 'light';
      else if (r < 0.62) this.plan = 'heavy';
      else if (r < 0.72) this.plan = 'jump';
      else if (r < 0.86) this.plan = 'approach';
      else this.plan = 'retreat';
      this.planT = 14 + this.rng() * 12;
    }
    if (this.plan === 'approach' || this.plan === 'retreat') this.planT = 10 + this.rng() * 8;
    if (this.plan === 'idle') this.planT = 10;
  }
}
