// Stand-in trance beat for when no MP3 is available. Same tempo as Sandstorm (136 BPM).
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const PROGRESSION = [
  [64, 67, 71, 76], // Em
  [60, 64, 67, 72], // C
  [62, 66, 69, 74], // D
  [59, 62, 66, 71], // Bm
];
const ARP = [0, 1, 2, 3, 2, 1, 0, 2, 1, 3, 2, 3, 1, 2, 0, 3];

class TranceSynth {
  constructor(ctx, bpm) {
    this.ctx = ctx;
    this.bpm = bpm;
    this.out = ctx.createGain();
    this.out.gain.value = 0.7;
    this.comp = ctx.createDynamicsCompressor();
    this.out.connect(this.comp).connect(ctx.destination);
    this.noise = this.makeNoise();
    this.timer = null;
  }

  get secondsPerBeat() { return 60 / this.bpm; }

  makeNoise() {
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    return buf;
  }

  start() {
    this.startTime = this.ctx.currentTime + 0.1;
    this.nextTime = this.startTime;
    this.step = 0;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    clearInterval(this.timer);
    const now = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(0, now, 0.05);
    setTimeout(() => this.comp.disconnect(), 400);
  }

  beatPosition() {
    const latency = this.ctx.outputLatency || this.ctx.baseLatency || 0;
    return (this.ctx.currentTime - latency - this.startTime) / this.secondsPerBeat;
  }

  schedule() {
    const sixteenth = this.secondsPerBeat / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, sixteenth);
      this.step++;
      this.nextTime += sixteenth;
    }
  }

  playStep(step, t, sixteenth) {
    const s = step % 16;
    const chord = PROGRESSION[Math.floor(step / 16) % PROGRESSION.length];
    if (s % 4 === 0) this.kick(t);
    if (s % 4 === 2) {
      this.hat(t, 0.28);
      this.bass(t, mtof(chord[0] - 24), sixteenth * 1.8);
    }
    if (s % 2 === 1) this.hat(t, 0.08);
    if (s === 4 || s === 12) this.clap(t);
    this.lead(t, mtof(chord[ARP[s]]), sixteenth * 0.8);
  }

  env(t, peak, decay) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    g.connect(this.out);
    return g;
  }

  kick(t) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    o.connect(this.env(t, 1, 0.35));
    o.start(t);
    o.stop(t + 0.4);
  }

  noiseHit(t, type, freq, q, peak, decay) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f).connect(this.env(t, peak, decay));
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.02);
  }

  hat(t, v) { this.noiseHit(t, 'highpass', 7500, 0.7, v, 0.05); }
  clap(t) { this.noiseHit(t, 'bandpass', 1500, 0.8, 0.6, 0.18); }

  bass(t, freq, dur) {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    o.connect(f).connect(this.env(t, 0.35, dur));
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  lead(t, freq, dur) {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(4200, t);
    f.frequency.exponentialRampToValueAtTime(900, t + dur);
    f.connect(this.env(t, 0.07, dur));
    for (const detune of [-14, 0, 14]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = detune;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
  }
}

let applauseNoise = null;

// A burst of synthesized hand claps over a crowd roar that swells and fades.
function cannedApplause(ctx, seconds = 2.4) {
  if (!applauseNoise) {
    applauseNoise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const ch = applauseNoise.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  const t0 = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0.6;
  out.connect(ctx.destination);

  for (let i = 0; i < 180; i++) {
    const u = Math.random();
    const t = t0 + seconds * Math.pow(u, 1.6);
    const src = ctx.createBufferSource();
    src.buffer = applauseNoise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 800 + Math.random() * 2200;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.02 + 0.12 * (1 - u), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.9, 0.06);
  }

  const roar = ctx.createBufferSource();
  roar.buffer = applauseNoise;
  roar.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  const rg = ctx.createGain();
  rg.gain.setValueAtTime(0.0001, t0);
  rg.gain.exponentialRampToValueAtTime(0.08, t0 + 0.3);
  rg.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
  roar.connect(lp).connect(rg).connect(out);
  roar.start(t0);
  roar.stop(t0 + seconds + 0.05);
}

function gameShowDing(ctx) {
  const t = ctx.currentTime;
  [[880, 0], [1318.5, 0.12], [1760, 0.24]].forEach(([freq, delay]) => {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, t + delay);
    g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start(t + delay);
    o.stop(t + delay + 0.55);
  });
}
