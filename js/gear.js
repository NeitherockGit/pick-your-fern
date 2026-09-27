// Accessories that drop onto every fern. `drop` is which song drop (0 = first) delivers them.
const GEAR = [
  {
    name: 'shades',
    drop: 0,
    spin: 0,
    svg: `<svg viewBox="0 0 32 8" shape-rendering="crispEdges">
      <g fill="#000">
        <rect x="0" y="0" width="32" height="2"/>
        <rect x="2" y="2" width="12" height="3"/><rect x="3" y="5" width="10" height="1"/><rect x="5" y="6" width="6" height="1"/>
        <rect x="18" y="2" width="12" height="3"/><rect x="19" y="5" width="10" height="1"/><rect x="21" y="6" width="6" height="1"/>
      </g>
      <g fill="#fff">
        <rect x="4" y="2" width="2" height="1"/><rect x="6" y="3" width="1" height="1"/>
        <rect x="20" y="2" width="2" height="1"/><rect x="22" y="3" width="1" height="1"/>
      </g>
    </svg>`,
  },
  {
    name: 'chain',
    drop: 1,
    spin: 0,
    svg: `<svg viewBox="0 0 100 60">
      <path d="M4 4 Q50 62 96 4" fill="none" stroke="#b8860b" stroke-width="7" stroke-linecap="round"/>
      <path d="M4 4 Q50 62 96 4" fill="none" stroke="#ffd23f" stroke-width="5" stroke-dasharray="7 3" stroke-linecap="round"/>
      <circle cx="50" cy="40" r="13" fill="#ffd23f" stroke="#b8860b" stroke-width="3"/>
      <text x="50" y="47" text-anchor="middle" font-family="Bungee, Impact, sans-serif" font-size="19" fill="#7a4b00">$</text>
    </svg>`,
  },
  {
    name: 'hat',
    drop: 1,
    spin: 540,
    svg: `<svg viewBox="0 0 60 80">
      <defs>
        <pattern id="hat-stripes" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="14" height="14" fill="#ff2e97"/><rect width="7" height="14" fill="#3ff5ff"/>
        </pattern>
      </defs>
      <polygon points="30,8 56,76 4,76" fill="url(#hat-stripes)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="30" cy="8" r="8" fill="#ffd23f" stroke="#fff" stroke-width="2"/>
    </svg>`,
  },
];
