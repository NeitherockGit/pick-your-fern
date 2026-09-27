// Canvas effects for the dance stage: spotlights and lasers behind the ferns, confetti in front.
const BEAM_COLORS = ['255,46,151', '63,245,255', '255,210,63', '180,107,255'];
const CONFETTI_COLORS = ['#ffd23f', '#3ff5ff', '#ff2e97', '#ffffff', '#b46bff', '#ff9ad8'];
const SAND_COLORS = ['222,184,120', '240,208,150', '196,150,90', '255,230,180'];

class StageFX {
  constructor(back, front) {
    this.back = back;
    this.front = front;
    this.bg = back.getContext('2d');
    this.fg = front.getContext('2d');
    this.parts = [];
    this.sand = [];
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = innerWidth;
    this.h = innerHeight;
    for (const [c, g] of [[this.back, this.bg], [this.front, this.fg]]) {
      c.width = this.w * dpr;
      c.height = this.h * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  reset() {
    this.parts.length = 0;
    this.sand.length = 0;
    this.bg.clearRect(0, 0, this.w, this.h);
    this.fg.clearRect(0, 0, this.w, this.h);
  }

  burst(x, y, count, speed, angle = -Math.PI / 2, spread = Math.PI * 2) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.45 + Math.random() * 0.75);
      this.parts.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 14,
        w: 6 + Math.random() * 7,
        h: 9 + Math.random() * 9,
        color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
        seed: Math.random() * 10,
        life: 0,
      });
    }
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
  }

  cannons(count) {
    const speed = this.h * 1.5;
    this.burst(0, this.h, count, speed, -Math.PI / 2 + 0.5, 0.5);
    this.burst(this.w, this.h, count, speed, -Math.PI / 2 - 0.5, 0.5);
  }

  rain(count) {
    for (let i = 0; i < count; i++) this.burst(Math.random() * this.w, -20 - Math.random() * 200, 1, 150, Math.PI / 2, 0.6);
  }

  blowSand(dt, storm) {
    const count = Math.round(storm * 1600 * dt);
    for (let i = 0; i < count; i++) {
      this.sand.push({
        x: -20 - Math.random() * 120,
        y: Math.random() * this.h,
        vx: 900 + Math.random() * 1000,
        vy: (Math.random() - 0.5) * 140,
        size: 1 + Math.random() * 2.5,
        color: SAND_COLORS[(Math.random() * SAND_COLORS.length) | 0],
        seed: Math.random() * 10,
      });
    }
    if (this.sand.length > 2500) this.sand.splice(0, this.sand.length - 2500);
  }

  draw(dt, b, energy, { lasers, converge, storm = 0, dim = 0 }) {
    const { w, h, bg, fg } = this;
    const kick = Math.exp(-(b - Math.floor(b)) * 7);
    const bar = Math.floor(b / 4);
    if (storm > 0) this.blowSand(dt, storm);

    bg.clearRect(0, 0, w, h);
    bg.globalCompositeOperation = 'lighter';

    [0.08, 0.32, 0.68, 0.92].forEach((fx, i) => {
      const ox = fx * w, oy = -30;
      let ang = Math.PI / 2 + Math.sin((b * Math.PI) / 2 + i * 1.3) * 0.55;
      if (converge) ang += (Math.atan2(h * 0.6 - oy, w / 2 - ox) - ang) * converge;
      const len = h * 1.5, half = 0.1;
      const col = BEAM_COLORS[(bar + i) % BEAM_COLORS.length];
      const alpha = (0.12 + 0.25 * energy) * (0.6 + 0.4 * kick) * (1 - 0.75 * dim);
      const grad = bg.createLinearGradient(ox, oy, ox + Math.cos(ang) * len, oy + Math.sin(ang) * len);
      grad.addColorStop(0, `rgba(${col},${alpha})`);
      grad.addColorStop(1, `rgba(${col},0)`);
      bg.fillStyle = grad;
      bg.beginPath();
      bg.moveTo(ox, oy);
      bg.lineTo(ox + Math.cos(ang - half) * len, oy + Math.sin(ang - half) * len);
      bg.lineTo(ox + Math.cos(ang + half) * len, oy + Math.sin(ang + half) * len);
      bg.closePath();
      bg.fill();
    });

    if (lasers) {
      const ox = w / 2, oy = h + 10;
      const flash = Math.exp(-((b * 2) % 1) * 5);
      const sweep = Math.sin((b * Math.PI) / 4) * 0.35;
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + sweep + (i - 4) * 0.16;
        const x2 = ox + Math.cos(a) * h * 2, y2 = oy + Math.sin(a) * h * 2;
        const col = i % 2 ? '63,245,255' : '255,46,151';
        bg.beginPath();
        bg.moveTo(ox, oy);
        bg.lineTo(x2, y2);
        bg.strokeStyle = `rgba(${col},${0.05 + 0.15 * flash})`;
        bg.lineWidth = 10;
        bg.stroke();
        bg.strokeStyle = `rgba(255,255,255,${0.15 + 0.6 * flash})`;
        bg.lineWidth = 2;
        bg.stroke();
      }
    }
    bg.globalCompositeOperation = 'source-over';

    fg.clearRect(0, 0, w, h);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.life += dt;
      q.vy = Math.min(q.vy + 900 * dt, 260);
      q.vx = q.vx * (1 - 1.5 * dt) + storm * 1800 * dt;
      q.x += q.vx * dt + Math.sin(q.life * 6 + q.seed) * 40 * dt;
      q.y += q.vy * dt;
      q.rot += q.vr * dt;
      if (q.y > h + 30 || q.life > 8) {
        this.parts.splice(i, 1);
        continue;
      }
      fg.save();
      fg.translate(q.x, q.y);
      fg.rotate(q.rot);
      fg.scale(1, Math.cos(q.life * 9 + q.seed));
      fg.fillStyle = q.color;
      fg.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
      fg.restore();
    }

    if (storm > 0.01) {
      fg.fillStyle = `rgba(222,184,120,${(0.25 * storm).toFixed(3)})`;
      fg.fillRect(0, 0, w, h);
    }
    for (let i = this.sand.length - 1; i >= 0; i--) {
      const s = this.sand[i];
      s.x += s.vx * dt;
      s.y += (s.vy + Math.sin(s.x * 0.01 + s.seed) * 90) * dt;
      if (s.x > w + 40) {
        this.sand.splice(i, 1);
        continue;
      }
      fg.fillStyle = `rgba(${s.color},0.85)`;
      fg.fillRect(s.x, s.y, s.size + s.vx * 0.012, s.size * 0.7);
    }
  }
}
