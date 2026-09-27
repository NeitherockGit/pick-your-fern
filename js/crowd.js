// Silhouette studio audience along the bottom of the stage.
const CROWD_COLORS = ['#2a0030', '#3b0a45', '#1f0026', '#4a0f55'];

class Crowd {
  constructor(el) {
    this.el = el;
    this.people = [];
    const rows = [{ count: 22, bottom: 26, scale: 0.78 }, { count: 17, bottom: -14, scale: 1 }];
    rows.forEach((row, r) => {
      for (let i = 0; i < row.count; i++) {
        const p = document.createElement('div');
        p.className = 'person';
        p.innerHTML = '<div class="arm"><div class="lighter"></div></div><div class="head"></div><div class="body"></div>';
        const left = ((i + (r ? 0.5 : 0.25)) / row.count) * 100;
        p.style.left = `${left + (Math.random() - 0.5) * 2}%`;
        p.style.bottom = `${row.bottom}px`;
        p.style.setProperty('--c', CROWD_COLORS[(i + r) % CROWD_COLORS.length]);
        p.style.setProperty('--s', (row.scale * (0.9 + Math.random() * 0.2)).toFixed(2));
        el.appendChild(p);
        this.people.push({
          el: p,
          // One person in every crowd is always on the off-beat.
          offset: this.people.length === 29 ? 0.5 : (Math.random() - 0.5) * 0.08,
          sway: Math.random() * Math.PI * 2,
        });
      }
    });
  }

  update(b, { energy, lighters, cheer, frozen }) {
    this.el.classList.toggle('lighters', lighters > 0.5);
    this.people.forEach((person) => {
      if (frozen) return;
      const q = (((b + person.offset) % 1) + 1) % 1;
      const bob = Math.pow(1 - q, 3) * 10 * (0.3 + 0.7 * energy) * (1 - lighters);
      const jump = cheer * Math.abs(Math.sin(Math.PI * 2 * (b + person.sway))) * 26;
      const rot = lighters * Math.sin((Math.PI * b) / 4 + person.sway * 0.3) * 9;
      person.el.style.transform = `translateY(${(-bob - jump).toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(var(--s))`;
    });
  }
}
