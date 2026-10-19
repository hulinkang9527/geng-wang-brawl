// ============================================================
// audio.js — Web Audio 程序化音效（无音频素材）
// ============================================================
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.noiseBuf = null;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.bgmNext = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    // 预生成 1s 白噪声
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.7;
    if (m) this.stopBgm();
  }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  // 基础：噪声
  noise(t0, dur, { type = 'bandpass', freq = 1200, q = 1, gain = 0.3, sweep = 0, exp = true } = {}) {
    if (!this.ctx || this.muted) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    if (exp) g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    else g.gain.linearRampToValueAtTime(0.001, t0 + dur);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }
  // 基础：音调
  tone(t0, dur, { type = 'sine', f0 = 440, f1 = null, gain = 0.3, attack = 0.005 } = {}) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  // ---------- 具体音效 ----------
  swing()     { const t = this.now(); this.noise(t, .12, { freq: 900, sweep: 1800, gain: .18, q: .8 }); }
  heavySwing(){ const t = this.now(); this.noise(t, .26, { freq: 300, sweep: 900, gain: .28, q: .7 }); }
  hit()       { const t = this.now();
                this.tone(t, .12, { type: 'sine', f0: 220, f1: 60, gain: .5 });
                this.noise(t, .08, { freq: 1800, gain: .35 }); }
  heavyHit()  { const t = this.now();
                this.tone(t, .28, { type: 'sine', f0: 150, f1: 38, gain: .65 });
                this.noise(t, .16, { freq: 900, sweep: 200, gain: .45 }); }
  block()     { const t = this.now();
                this.tone(t, .12, { type: 'square', f0: 2600, f1: 1800, gain: .18 });
                this.tone(t, .18, { type: 'triangle', f0: 5200, f1: 3000, gain: .1 }); }
  perfect()   { const t = this.now();
                this.tone(t, .1, { type: 'triangle', f0: 1400, gain: .25 });
                this.tone(t + .08, .18, { type: 'triangle', f0: 2100, gain: .25 });
                this.noise(t, .1, { freq: 4000, gain: .2 }); }
  dodge()     { const t = this.now(); this.noise(t, .2, { freq: 500, sweep: 2400, gain: .22, q: 1.5 }); }
  jump()      { const t = this.now(); this.noise(t, .16, { freq: 400, sweep: 1600, gain: .16, q: 1.2 }); }
  land()      { const t = this.now(); this.noise(t, .08, { freq: 220, gain: .18 }); }
  charge()    { const t = this.now(); this.tone(t, .25, { type: 'sawtooth', f0: 180, f1: 700, gain: .12 }); }
  ui()        { const t = this.now(); this.tone(t, .07, { type: 'triangle', f0: 660, gain: .18 }); }
  select()    { const t = this.now();
                this.tone(t, .08, { type: 'triangle', f0: 520, gain: .2 });
                this.tone(t + .07, .12, { type: 'triangle', f0: 780, gain: .2 }); }
  special()   { const t = this.now();
                this.tone(t, .35, { type: 'sawtooth', f0: 160, f1: 900, gain: .2 });
                this.noise(t, .35, { freq: 600, sweep: 2400, gain: .25 }); }
  ultra()     { const t = this.now();
                this.tone(t, .7, { type: 'sawtooth', f0: 90, f1: 500, gain: .3 });
                this.noise(t, .7, { freq: 300, sweep: 3000, gain: .4 });
                this.tone(t + .25, .8, { type: 'sine', f0: 60, f1: 40, gain: .55 }); }
  ko()        { const t = this.now();
                this.tone(t, 1.0, { type: 'sine', f0: 220, f1: 55, gain: .6 });
                this.tone(t, 1.0, { type: 'triangle', f0: 330, f1: 80, gain: .25 });
                this.noise(t, .5, { freq: 500, sweep: 100, gain: .3 }); }
  fight()     { const t = this.now();
                [392, 523, 659].forEach((f, i) => this.tone(t + i * .09, .22, { type: 'square', f0: f, gain: .16 }));
                this.noise(t, .5, { freq: 700, gain: .25 }); }
  // 摩托车引擎（持续，返回停止函数）
  engine() {
    if (!this.ctx || this.muted) return () => {};
    const t = this.now();
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 70;
    const o2 = this.ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 105;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = this.ctx.createGain(); g.gain.value = 0.0;
    g.gain.setTargetAtTime(0.16, t, 0.05);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
    o.start(); o2.start();
    return () => {
      const t2 = this.now();
      g.gain.setTargetAtTime(0, t2, 0.05);
      o.stop(t2 + 0.3); o2.stop(t2 + 0.3);
    };
  }

  // ---------- 简易 BGM：循环鼓点 + 贝斯 ----------
  startBgm() {
    if (!this.ctx || this.muted || this.bgmTimer) return;
    this.bgmStep = 0;
    this.bgmNext = this.ctx.currentTime + 0.05;
    const stepDur = 0.16; // 约 150bpm 16 分音符
    const bass = [55, 0, 55, 65, 55, 0, 73, 65];
    const tick = () => {
      if (!this.ctx || this.muted) return;
      while (this.bgmNext < this.ctx.currentTime + 0.3) {
        const s = this.bgmStep % 16;
        if (s % 4 === 0) this.tone(this.bgmNext, .12, { type: 'sine', f0: 130, gain: .35 });          // kick
        if (s % 8 === 4) this.noise(this.bgmNext, .08, { freq: 1800, gain: .12 });                       // snare
        this.noise(this.bgmNext, .03, { freq: 6000, gain: .05 });                                         // hat
        if (s % 2 === 0) {
          const b = bass[(this.bgmStep / 2) % 8 | 0];
          if (b) this.tone(this.bgmNext, .15, { type: 'sawtooth', f0: b, gain: .08 });
        }
        this.bgmNext += stepDur;
        this.bgmStep++;
      }
    };
    tick();
    this.bgmTimer = setInterval(tick, 100);
  }
  stopBgm() {
    if (this.bgmTimer) { clearInterval(this.bgmTimer); this.bgmTimer = null; }
  }
}

export const audio = new AudioEngine();
