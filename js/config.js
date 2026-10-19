// ============================================================
// config.js — 全局常量、角色属性、招式帧数据、键位
// 战斗逻辑以 60 步/秒固定步长运行，所有帧数以 60fps 计
// ============================================================

export const GAME = {
  FPS: 60,
  GROUND_Y: 0,
  GRAVITY: 32,
  JUMP_V: 10.6,
  STAGE_HALF: 6.2,          // 场地横向半宽
  MIN_GAP: 0.55,            // 两角色最小间距
  ROUND_TIME: 75,           // 每局秒数
  WINS_NEEDED: 2,           // 三局两胜
  START_X: 2.6,             // 开局双方间距
  WALK_DAMP: 0.82,          // 击退摩擦
  HIT_FREEZE: 5,            // 命中停顿（卡帧）帧数
};

// 能量 / 护盾
export const RESOURCE = {
  ENERGY_MAX: 100,
  SPECIAL_COST: 50,
  OVERDRIVE_COST: 100,
  OVERDRIVE_FRAMES: 480,    // 爆气持续 8 秒
  OVERDRIVE_DMG_MUL: 1.3,
  ENERGY_BY_DEAL: 1.2,      // 造成伤害转能量
  ENERGY_BY_TAKE: 0.4,      // 受击转能量
  SHIELD_MAX: 40,
  SHIELD_REDUCE: 0.15,      // 格挡时 HP 承受伤害比例
  SHIELD_COST_MUL: 0.8,     // 格挡时护盾消耗比例
  SHIELD_REGEN_DELAY: 120,  // 脱战 2 秒后回盾
  SHIELD_REGEN_RATE: 10 / 60,
  PERFECT_WINDOW: 6,        // 完美格挡：受击前 6 帧内进入防御
  GUARD_BREAK_STUN: 50,
  DODGE_FRAMES: 27,
  DODGE_INVINC_START: 3,
  DODGE_INVINC_END: 18,
  DODGE_DIST: 2.4,
  DODGE_CD: 48,
  COMBO_DROP_FRAMES: 50,    // 连击中断间隔
};

// 角色静态属性
export const CHARACTERS = {
  naiwa: {
    id: 'naiwa',
    no: '01',
    name: '奶蛙',
    en: 'NAIWA',
    title: '笑不活了',
    ultraCn: '笑不活了',
    ultraEn: 'LAUGH RIOT',
    stats: { power: 3, speed: 3, crispy: 5 },
    hp: 100,
    walkSpeed: 5.4,
    scale: 1.0,
    colors: { body: '#f7b300', bodyDark: '#d99400', belly: '#ffe9b0', glove: '#3aa856', eye: '#10a04a' },
    intro: '灵活脆皮，连段最快，笑到你停不下来。',
  },
  feidudu: {
    id: 'feidudu',
    no: '02',
    name: '肥嘟嘟',
    en: 'FEIDUDU',
    title: '准时达真骑士',
    ultraCn: '胆量超载',
    ultraEn: 'GUTS OVERLOAD',
    stats: { power: 5, speed: 5, crispy: 4 },
    hp: 120,
    walkSpeed: 4.5,
    scale: 1.04,
    colors: { body: '#c07a33', bodyDark: '#93531f', belly: '#f0e4d0', glove: '#2b2118', eye: '#111' },
    intro: '血厚拳重，摩托在手，准时送达，概不退换。',
  },
};

// 受击盒（相对角色中心）
export const HURT_BOX = { halfW: 0.42, yMin: 0.15, yMax: 2.05 };

// 招式帧数据
// startup 起手 / active 判定 / recovery 收招 / damage 伤害 / range 攻击距离
// hitstun 命中对手硬直 / kb 水平击退 / vy 垂直击飞
export const MOVES = {
  naiwa: {
    light:  { startup: 5, active: 4, recovery: 10, damage: 6,  range: 1.6, hitstun: 13, blockstun: 8,  kb: 1.4, yMin: 0.85, yMax: 1.8 },
    airLight:{ startup: 5, active: 5, recovery: 10, damage: 5, range: 1.55, hitstun: 13, blockstun: 8,  kb: 1.2, vy: -2, yMin: 0.7, yMax: 1.9 },
    heavy:  { startup: 11, active: 5, recovery: 18, damage: 14, range: 1.78, hitstun: 22, blockstun: 14, kb: 4.4, yMin: 0.8, yMax: 1.9, chargeMul: 1.8 },
    // 小必杀：连环笑拳（5 段，最后一段重终结）
    special: {
      startup: 12,
      rushes: [
        { at: 14, damage: 5, hitstun: 8,  kb: 0.6, range: 1.65 },
        { at: 24, damage: 5, hitstun: 8,  kb: 0.6, range: 1.65 },
        { at: 34, damage: 5, hitstun: 8,  kb: 0.6, range: 1.65 },
        { at: 44, damage: 5, hitstun: 8,  kb: 0.6, range: 1.65 },
        { at: 56, damage: 9, hitstun: 26, kb: 4.5, range: 1.8 },
      ],
      total: 72,
    },
    // 大必杀：横幅后 6 段连击（5 轻拳 + 上勾终结）；rushes.at 为相对横幅结束的帧数
    ultra: {
      banner: 55,
      rushes: [
        { at: 9,  damage: 4, hitstun: 10, kb: 0.4, range: 1.7 },
        { at: 21, damage: 4, hitstun: 10, kb: 0.4, range: 1.7 },
        { at: 33, damage: 4, hitstun: 10, kb: 0.4, range: 1.7 },
        { at: 45, damage: 4, hitstun: 10, kb: 0.4, range: 1.7 },
        { at: 57, damage: 4, hitstun: 10, kb: 0.4, range: 1.7 },
        { at: 75, damage: 22, hitstun: 40, kb: 4.5, vy: 8.5, range: 1.9 },
      ],
      total: 158,
    },
  },

  feidudu: {
    light:  { startup: 6, active: 5, recovery: 13, damage: 8,  range: 1.7, hitstun: 16, blockstun: 9,  kb: 2.0, yMin: 0.85, yMax: 1.85 },
    airLight:{ startup: 6, active: 5, recovery: 12, damage: 7, range: 1.65, hitstun: 15, blockstun: 9,  kb: 1.6, vy: -2, yMin: 0.7, yMax: 1.9 },
    heavy:  { startup: 14, active: 6, recovery: 22, damage: 18, range: 1.92, hitstun: 26, blockstun: 16, kb: 5.8, yMin: 0.75, yMax: 1.95, chargeMul: 1.8 },
    // 小必杀：骑摩托冲撞
    special: {
      startup: 18,          // 骑上摩托
      rideStart: 18,
      rideEnd: 52,          // 冲撞持续
      rideSpeed: 0.42,      // 每帧位移（约 25m/s）
      damage: 26, hitstun: 32, kb: 9,
      total: 66,
    },
    // 大必杀：横幅后 3 次摩托冲撞 + 尾拳；rushes.at 为相对横幅结束的帧数
    ultra: {
      banner: 55,
      rushes: [
        { at: 7,  type: 'ride', damage: 15, hitstun: 24, kb: 7, range: 2.2 },
        { at: 51, type: 'ride', damage: 15, hitstun: 24, kb: 7, range: 2.2 },
        { at: 95, type: 'ride', damage: 16, hitstun: 42, kb: 10, range: 2.3 },
        { at: 137, type: 'punch', damage: 6, hitstun: 30, kb: 5, range: 1.9 },
      ],
      total: 214,
    },
  },
};

// 键位
export const KEYS = {
  p1: { left: 'KeyA', right: 'KeyD', jump: 'KeyW',
        light: 'KeyJ', heavy: 'KeyK', block: 'KeyL',
        dodge: 'ShiftLeft', special: 'KeyU', ultra: 'KeyI' },
  p2: { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp',
        light: 'Digit1', heavy: 'Digit2', block: 'Digit3',
        dodge: 'ShiftRight', special: 'Digit4', ultra: 'Digit5' },
  pause: ['Escape', 'KeyP'],
};

// 场景
export const STAGES = ['stage', 'foodstall'];
