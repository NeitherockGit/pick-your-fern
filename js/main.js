(() => {
  const STAR_INNER = 0.42;
  const JOIN_AFTER_SECONDS = 10;
  const PALETTE = ['#ffd23f', '#3ff5ff', '#ff2e97', '#ffffff', '#b46bff'];
  const HYPE_WORDS = ['FERNTASTIC!', 'SPORE-TACULAR!', 'UNBE-LEAF-ABLE!', 'FROND-ERFUL!', 'TOTALLY TUBULAR!', 'RADICAL!', 'FIDDLE-DEE-DEE!', 'PHOTOSYNTHESIZE!'];
  const SYNTH_MAP = { bpm: 136, firstBeat: 0, phraseOffset: 0, hits: [], drops: [40], freeze: null, breakdown: null, buildups: [[32, 40]], energy: null };
  // Backup dancer home spots, clockwise from top-left, as fractions of the screen.
  const SPOTS = [[0.13, 0.4], [0.87, 0.4], [0.78, 0.74], [0.22, 0.74]];
  // Where the backups huddle for the breakdown slow dance.
  const SLOW_SPOTS = [[0.2, 0.56], [0.8, 0.56], [0.66, 0.7], [0.34, 0.7]];

  const $ = (s) => document.querySelector(s);
  const row = $('#fern-row');
  const danceScreen = $('#dance-screen');
  const dancer = $('#dancer');
  const leadPhoto = dancer.querySelector('.photo');
  const echoes = [...document.querySelectorAll('.echo')];
  const strobe = $('#strobe');
  const sparkles = $('#sparkles');
  const banner = $('#banner');
  const winnerName = $('#winner-name');
  const audioNote = $('#audio-note');
  const photoCredit = $('#photo-credit');
  const stage = $('#stage');
  const floor = $('.floor');
  const darkness = $('#darkness');
  const discoBall = $('#disco');
  const hypeLayer = $('#hype');
  const pops = $('#pops');
  const applauseSign = $('#applause');
  const scoreEl = $('#score');
  const comboEl = $('#combo');
  const hintEl = $('#hud-hint');
  const stormWarning = $('#storm-warning');
  const track = $('#track');
  const starSvg = $('#star-wipe');
  const starOutline = $('#star-outline');
  const toastEl = $('#toast');
  const fx = new StageFX($('#fx-back'), $('#fx-front'));
  const crowd = new Crowd($('#crowd'));

  let ctx = null;
  let synth = null;
  let musicMode = null; // 'track' | 'synth'
  let trackState = 'loading'; // 'loading' | 'ok' | 'missing'
  let beatOffset = 0; // seconds; set by T-key tap sync or the arrow keys
  let busy = false;
  let rafId = 0;
  let backups = [];
  let map = SONG_MAP;
  let joinBeat = 0;
  let taps = [];
  const clock = { media: 0, perf: 0, lastRaw: -1 };
  const show = { lastBeat: null, lastFrame: 0, shake: 0, flash: 0, applauseUntil: -Infinity, history: [], leadPos: { x: 0, y: 0 } };
  const game = { score: 0, combo: 0, judged: new Set() };

  // ---------- Helpers ----------

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  const mod = (n, m) => ((n % m) + m) % m;
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutBack = (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (k, salt) => {
    const x = Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const inRange = (b, range) => !!range && b >= range[0] && b < range[1];

  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1400);
  }

  function audioCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // ---------- Marquee bulbs ----------

  function layoutBulbs() {
    const el = $('#bulbs');
    el.innerHTML = '';
    const inset = 14;
    const w = innerWidth - inset * 2;
    const h = innerHeight - inset * 2;
    const perimeter = 2 * (w + h);
    const count = Math.floor(perimeter / 34);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      let d = (i / count) * perimeter;
      let x, y;
      if (d < w) { x = d; y = 0; }
      else if ((d -= w) < h) { x = w; y = d; }
      else if ((d -= h) < w) { x = w - d; y = h; }
      else { d -= w; x = 0; y = h - d; }
      const b = document.createElement('span');
      b.className = `bulb b${i % 3}`;
      b.style.left = `${inset + x}px`;
      b.style.top = `${inset + y}px`;
      frag.appendChild(b);
    }
    el.appendChild(frag);
  }

  // ---------- Pick screen ----------

  function buildPodiums() {
    FERNS.forEach((fern, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'podium';
      btn.type = 'button';
      btn.setAttribute('aria-label', `Fern number ${i + 1}: ${fern.name}, ${fern.blurb}`);
      btn.title = `Photo: ${fern.credit}`;
      btn.innerHTML = `
        <span class="num">${i + 1}</span>
        <span class="window"><img src="${fern.src}" alt="" style="object-position: ${fern.focus}"></span>
        <span class="plate">${fern.name}<small>${fern.blurb}</small></span>`;
      btn.addEventListener('click', () => pickFern(fern, btn));
      li.appendChild(btn);
      row.appendChild(li);
    });
  }

  // ---------- Music & beat clock ----------

  track.addEventListener('canplay', () => { trackState = 'ok'; });
  track.addEventListener('error', () => { trackState = 'missing'; });

  async function startMusic() {
    audioCtx();
    if (trackState !== 'missing') {
      try {
        track.currentTime = 0;
        await track.play();
        musicMode = 'track';
        audioNote.hidden = true;
        useMap(SONG_MAP);
        return;
      } catch (_) {
        trackState = 'missing';
      }
    }
    synth = new TranceSynth(ctx, SYNTH_MAP.bpm);
    synth.start();
    musicMode = 'synth';
    useMap(SYNTH_MAP);
    audioNote.textContent = 'Sandstorm.mp3 could not be played, so this is a stand-in beat.';
    audioNote.hidden = false;
  }

  function stopMusic() {
    track.pause();
    if (synth) synth.stop();
    synth = null;
    musicMode = null;
  }

  function useMap(m) {
    map = m;
    const minBeat = Math.ceil(((JOIN_AFTER_SECONDS - m.firstBeat) * m.bpm) / 60);
    const hit = m.hits.find((k) => k >= minBeat && isPhraseStart(k, 8));
    if (hit !== undefined) {
      joinBeat = hit;
    } else {
      joinBeat = minBeat;
      while (!isPhraseStart(joinBeat, 8)) joinBeat++;
    }
  }

  const phraseBeat = (k) => k - map.phraseOffset;
  const isPhraseStart = (k, len) => mod(phraseBeat(k), len) === 0;
  const firstDrop = () => (map.drops.length ? map.drops[0] : joinBeat);

  function energyAt(k) {
    if (!map.energy) return 1;
    const i = Math.max(0, Math.min(map.energy.length - 1, k));
    return (map.energy.charCodeAt(i) - 48) / 9;
  }

  // audio.currentTime only updates every few milliseconds, so extrapolate it with the frame clock.
  function trackTime() {
    const raw = track.currentTime;
    const now = performance.now() / 1000;
    if (track.paused) {
      Object.assign(clock, { media: raw, perf: now, lastRaw: raw });
      return raw;
    }
    if (raw !== clock.lastRaw) {
      clock.lastRaw = raw;
      const err = raw - (clock.media + (now - clock.perf) * track.playbackRate);
      if (Math.abs(err) > 0.1) {
        clock.media = raw;
        clock.perf = now;
      } else {
        clock.media += err * 0.15;
      }
    }
    return clock.media + (now - clock.perf) * track.playbackRate;
  }

  function beatPosition() {
    if (musicMode === 'track') return ((trackTime() + beatOffset - map.firstBeat) * map.bpm) / 60;
    if (musicMode === 'synth') return synth.beatPosition();
    return -1;
  }

  function tapSync() {
    if (musicMode !== 'track') return;
    const now = performance.now();
    taps = taps.filter((t) => now - t.at < 4000);
    taps.push({ at: now, time: trackTime() });
    if (taps.length < 3) return toast(`Tap T on the beat: ${3 - taps.length} more`);
    const perSec = map.bpm / 60;
    const errs = taps.map((t) => {
      const beat = (t.time + beatOffset - map.firstBeat) * perSec;
      return beat - Math.round(beat);
    });
    beatOffset -= errs.reduce((a, c) => a + c, 0) / errs.length / perSec;
    toast(`Synced! Offset ${Math.round(beatOffset * 1000)} ms`);
  }

  // ---------- Star wipe ----------

  function starPoints(cx, cy, r, rot) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 ? r * STAR_INNER : r;
      const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
      pts.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
    }
    return pts;
  }

  function starWipe(el, direction, duration) {
    return new Promise((resolve) => {
      const w = innerWidth, h = innerHeight;
      const maxR = (Math.hypot(w, h) / 2 / STAR_INNER) * 1.05;
      const t0 = performance.now();
      starSvg.style.display = 'block';

      const frame = (now) => {
        const t = clamp01((now - t0) / duration);
        const k = direction === 'in' ? easeInOutCubic(t) : 1 - easeInOutCubic(t);
        const pts = starPoints(w / 2, h / 2, maxR * k, k * Math.PI);
        el.style.clipPath = `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`;
        starOutline.setAttribute('points', pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' '));
        if (t < 1) return requestAnimationFrame(frame);
        starSvg.style.display = 'none';
        if (direction === 'in') el.style.clipPath = '';
        resolve();
      };
      frame(t0);
    });
  }

  // ---------- Song sections ----------

  function sceneAt(b) {
    const frozen = inRange(b, map.freeze);
    let slow = 0;
    if (map.breakdown) {
      const [s, e] = map.breakdown;
      slow = clamp01((b - s) / 2) * (1 - clamp01((b - e) / 4));
    }
    let build = 0;
    for (const [s, e] of map.buildups) if (b >= s && b < e) build = (b - s) / (e - s);
    let storm = 0;
    for (const d of map.drops) {
      if (b >= d - 1 && b < d) storm = Math.max(storm, 0.3 * (b - d + 1));
      else if (b >= d && b < d + 16) storm = Math.max(storm, clamp01((b - d) / 0.5) * (1 - clamp01((b - d - 12) / 4)));
    }
    return { frozen, slow, build, storm };
  }

  // ---------- The show ----------

  function sparkle(count) {
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.className = 'spark';
      s.style.left = `${Math.random() * 100}%`;
      s.style.top = `${Math.random() * 100}%`;
      s.style.setProperty('--c', PALETTE[(Math.random() * PALETTE.length) | 0]);
      s.addEventListener('animationend', () => s.remove());
      sparkles.appendChild(s);
    }
  }

  function hype(text) {
    const el = document.createElement('div');
    el.className = 'hype';
    el.textContent = text;
    el.style.animationDuration = `${(2 * 60) / map.bpm}s`;
    el.style.setProperty('--tilt', `${(Math.random() * 14 - 7).toFixed(1)}deg`);
    el.addEventListener('animationend', () => el.remove());
    hypeLayer.appendChild(el);
  }

  function applause(k, beats) {
    show.applauseUntil = Math.max(show.applauseUntil, k + beats);
    if (ctx) cannedApplause(ctx);
  }

  function onBeat(k) {
    if (inRange(k, map.freeze)) {
      if (k === map.freeze[0]) hype('FREEZE!');
      return;
    }
    const e = energyAt(k);
    const scene = sceneAt(k);
    leadPhoto.style.borderColor = PALETTE[mod(k, PALETTE.length)];
    document.body.dataset.chase = mod(k, 3);
    if (scene.slow < 0.5) sparkle(Math.round(1 + 4 * e));
    if (isPhraseStart(k, 4)) show.shake = Math.max(show.shake, 0.2 * e);

    const w = innerWidth, h = innerHeight;
    const countdown = map.drops.find((d) => k >= d - 3 && k < d);
    if (k === joinBeat) {
      show.shake = 1;
      show.flash = 0.9;
      fx.rain(220);
      backups.forEach((_, i) => fx.burst(SPOTS[i][0] * w, SPOTS[i][1] * h, 40, 500));
      hype('EVERYBODY ON STAGE!');
      applause(k, 6);
    } else if (k === joinBeat - 4) {
      hype('HERE THEY COME!');
    } else if (countdown !== undefined) {
      hype(String(countdown - k));
    } else if (map.drops.includes(k)) {
      show.shake = 1;
      show.flash = 1;
      fx.cannons(90);
      fx.rain(120);
      hype('SANDSTORM!');
      applause(k, 8);
    } else if (map.hits.includes(k)) {
      show.shake = Math.max(show.shake, 0.7);
      show.flash = 0.7;
      fx.burst(w / 2, h * 0.5, 70, 700);
      if (map.freeze && k === map.freeze[1]) applause(k, 4);
    } else if (map.breakdown && k === map.breakdown[0] + 4) {
      hype('SLOW JAM...');
    } else if (k > joinBeat && e > 0.5 && isPhraseStart(k, 16)) {
      fx.cannons(Math.round(40 * e));
      hype(HYPE_WORDS[mod(phraseBeat(k) / 16, HYPE_WORDS.length)]);
    } else if (k > joinBeat && e > 0.5 && isPhraseStart(k, 8)) {
      fx.cannons(Math.round(25 * e));
    }
  }

  const mixPose = (a, c, t) => ({
    x: lerp(a.x, c.x, t), y: lerp(a.y, c.y, t), rot: lerp(a.rot, c.rot, t), sx: lerp(a.sx, c.sx, t), sy: lerp(a.sy, c.sy, t),
  });

  const poseTransform = (p, width, height) =>
    `translate(${(p.x - width / 2).toFixed(1)}px, ${(p.y - height / 2).toFixed(1)}px) rotate(${p.rot.toFixed(1)}deg) scale(${p.sx.toFixed(3)}, ${p.sy.toFixed(3)})`;

  // Build-ups shake harder and harder; the sandstorm leans everyone into the wind.
  function addWobble(p, scene, w, now) {
    const shake = scene.build * scene.build;
    p.x += (Math.random() - 0.5) * w * 0.02 * shake + scene.storm * Math.sin(now / 70) * w * 0.01;
    p.y += (Math.random() - 0.5) * w * 0.012 * shake;
    p.rot += (Math.random() - 0.5) * 18 * shake + scene.storm * (20 + Math.sin(now / 40) * 5);
  }

  // Where the lead fern stands on beat k. Quieter parts of the song pull it toward center stage.
  function leadSpot(k, w, h) {
    const reach = 0.35 + 0.65 * energyAt(k);
    const section = mod(Math.floor(phraseBeat(k) / 16), 3);
    let x, y;
    if (section === 0) {
      x = 0.22 + 0.56 * rand(k, 1);
      y = 0.42 + 0.22 * rand(k, 2);
    } else if (section === 1) {
      x = mod(k, 2) ? 0.32 : 0.68;
      y = 0.56;
    } else {
      const a = (mod(k, 4) * Math.PI) / 2;
      x = 0.5 + Math.cos(a) * 0.26;
      y = 0.52 + Math.sin(a) * 0.13;
    }
    return { x: w * lerp(0.5, x, reach), y: h * lerp(0.54, y, reach), hop: (section === 1 ? 0.03 : 0.1) * reach, section };
  }

  // The lead travels in the second half of each beat and lands exactly on the next one.
  function leadPose(b, w, h) {
    const k = Math.floor(b), p = b - k;
    const from = leadSpot(k, w, h), to = leadSpot(k + 1, w, h);
    const t = clamp01((p - 0.45) / 0.55);
    const m = easeInOutCubic(t);
    const air = Math.sin(Math.PI * t);
    const land = Math.exp(-p * 8);
    let rot = ((to.x - from.x) / w) * 60 * air + (mod(k, 2) ? 7 : -7) * land;
    if (isPhraseStart(k + 1, 8)) rot += 360 * m;
    let flip = 1;
    if (from.section === 1) flip = (mod(phraseBeat(k), 2) ? -1 : 1) * Math.cos(Math.PI * m);
    return {
      x: lerp(from.x, to.x, m),
      y: lerp(from.y, to.y, m) - air * h * to.hop,
      rot,
      sx: flip * (1 + 0.16 * land - 0.06 * air),
      sy: 1 - 0.16 * land + 0.12 * air,
    };
  }

  const slowLeadPose = (b, w, h) => ({
    x: w * 0.5 + Math.sin((Math.PI * b) / 4) * w * 0.05,
    y: h * 0.5,
    rot: Math.sin((Math.PI * b) / 2) * 9,
    sx: 1,
    sy: 1 + 0.03 * Math.sin(Math.PI * b),
  });

  function poseLead(b, w, h, scene, now) {
    let pose = leadPose(b, w, h);
    if (scene.slow > 0) pose = mixPose(pose, slowLeadPose(b, w, h), scene.slow);
    if (!scene.frozen) addWobble(pose, scene, w, now);
    show.leadPos = { x: pose.x, y: pose.y };

    const transform = poseTransform(pose, dancer.offsetWidth, dancer.offsetHeight);
    dancer.style.transform = transform;
    show.history.push(transform);
    if (show.history.length > 16) show.history.shift();
    echoes.forEach((el, i) => {
      el.style.transform = show.history[Math.max(0, show.history.length - 1 - (i + 1) * 5)];
    });
  }

  // Backups fly in over the two beats before joinBeat and land on it, then run 8-beat routines.
  function backupPose(b, i, w, h, size) {
    const [hx, hy] = SPOTS[i];
    const enterStart = joinBeat - 2;
    if (b < joinBeat) {
      const t = (b - enterStart) / 2;
      const e = t * t;
      const fromLeft = hx < 0.5;
      return {
        x: lerp(fromLeft ? -size : w + size, hx * w, e),
        y: hy * h - Math.sin(Math.PI * t) * h * 0.22,
        rot: (fromLeft ? 1 : -1) * 720 * (e - 1),
        sx: 1,
        sy: 1,
      };
    }

    const since = b - joinBeat;
    const k = Math.floor(since), p = since - k;
    const section = Math.floor(since / 8) % 4;
    const step = k % 8;
    const land = Math.exp(-p * 8);
    const t = clamp01((p - 0.4) / 0.6);
    const m = easeInOutCubic(t);
    let px = hx, py = hy, hop = 0, rot = 0;

    if (section === 0) {
      // Wave: each dancer lands a sixteenth note after the one before it.
      const fade = step === 7 ? 1 - p : 1;
      hop = Math.sin(Math.PI * mod(since - i * 0.25, 1)) * 0.06 * fade;
      rot = Math.sin(Math.PI * (since - i * 0.25)) * 12 * fade;
    } else if (section === 1) {
      hop = Math.sin(Math.PI * p) * 0.07;
      rot = (k % 2 ? 1 : -1) * 14 * Math.sin(Math.PI * p);
    } else if (section === 2) {
      // Carousel: everyone steps to the next spot, back home after 8 beats.
      const a = SPOTS[(i + k) % 4], c = SPOTS[(i + k + 1) % 4];
      px = lerp(a[0], c[0], m);
      py = lerp(a[1], c[1], m);
      hop = Math.sin(Math.PI * t) * 0.05;
    } else {
      rot = 90 * (step + m) * (i % 2 ? 1 : -1);
      hop = Math.sin(Math.PI * t) * 0.04;
    }
    if (step === 7) rot += 360 * m * (i % 2 ? -1 : 1);
    return { x: px * w, y: (py - hop) * h, rot, sx: 1 + 0.14 * land, sy: 1 - 0.1 * land };
  }

  function slowBackupPose(b, i, w, h) {
    const phase = b - i * 0.5;
    return {
      x: w * SLOW_SPOTS[i][0] + Math.sin((Math.PI * phase) / 4) * w * 0.02,
      y: h * SLOW_SPOTS[i][1],
      rot: Math.sin((Math.PI * phase) / 2) * 9,
      sx: 1,
      sy: 1,
    };
  }

  function poseBackups(b, w, h, scene, now) {
    backups.forEach((bk, i) => {
      if (b < joinBeat - 2) {
        bk.el.style.opacity = '0';
        return;
      }
      bk.el.style.opacity = '1';
      const size = bk.el.offsetWidth;
      let pose = backupPose(b, i, w, h, size);
      if (scene.slow > 0) pose = mixPose(pose, slowBackupPose(b, i, w, h), scene.slow);
      if (!scene.frozen) addWobble(pose, scene, w, now);
      bk.el.style.transform = poseTransform(pose, size, size);
    });
  }

  // Accessories fall from the sky over the two beats before their drop and land on it.
  function poseGear(b) {
    const all = [...leadGear, ...backups.flatMap((bk) => bk.gear)];
    all.forEach(({ el, item }) => {
      const drop = map.drops[item.drop];
      if (drop === undefined || b < drop - 2) {
        el.style.opacity = '0';
        return;
      }
      const t = clamp01((b - (drop - 2)) / 2);
      const e = t * t;
      const bounce = t >= 1 ? Math.exp(-mod(b, 1) * 7) * 4 : 0;
      const y = lerp(-innerHeight * 0.9, 0, e) - bounce;
      const rot = item.spin * (1 - e) + (item.name === 'hat' ? 18 : 0);
      el.style.opacity = '1';
      el.style.transform = `translateY(${y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`;
    });
  }

  function addGear(actor) {
    return GEAR.map((item) => {
      const el = document.createElement('div');
      el.className = `gear ${item.name}`;
      el.innerHTML = item.svg;
      actor.appendChild(el);
      return { el, item };
    });
  }

  const leadGear = addGear(dancer);

  function poseDisco(b, kick) {
    const d = clamp01((b - (joinBeat - 4)) / 3.5);
    discoBall.style.transform = `translateY(${lerp(-320, 0, easeOutBack(d)).toFixed(1)}px)`;
    discoBall.style.filter = `brightness(${(1 + 0.6 * kick * d).toFixed(2)})`;
    discoBall.classList.toggle('fast', b >= firstDrop());
  }

  function resetShow() {
    show.lastBeat = null;
    show.history = [];
    show.shake = 0;
    show.flash = 0;
    show.applauseUntil = -Infinity;
    fx.reset();
    hypeLayer.innerHTML = '';
    sparkles.innerHTML = '';
    pops.innerHTML = '';
    stage.style.translate = '';
    stage.style.scale = '';
    danceScreen.classList.remove('frozen');
    stormWarning.classList.remove('on');
  }

  function animate(now) {
    rafId = requestAnimationFrame(animate);
    const dt = show.lastFrame ? Math.min(0.05, (now - show.lastFrame) / 1000) : 0;
    show.lastFrame = now;
    const w = innerWidth, h = innerHeight;
    const b = beatPosition();
    const k = Math.floor(b);

    if (show.lastBeat === null || k < show.lastBeat - 1) {
      // First frame, or the song looped back to the start.
      resetShow();
      show.lastBeat = k;
    }
    if (k - show.lastBeat > 2) show.lastBeat = k - 1;
    while (show.lastBeat < k) onBeat(++show.lastBeat);

    const scene = sceneAt(b);
    // During the freeze, every pose stays locked to the moment the music stopped.
    const pb = scene.frozen ? map.freeze[0] : b;
    const pk = Math.floor(pb), pp = pb - pk;
    const energy = lerp(energyAt(pk), energyAt(pk + 1), pp);
    const kick = b >= 0 && !scene.frozen ? Math.exp(-pp * 7) : 0;
    show.shake *= Math.exp(-dt * 8);
    show.flash *= Math.exp(-dt * 6);

    poseLead(pb, w, h, scene, now);
    poseBackups(pb, w, h, scene, now);
    poseGear(pb);
    poseDisco(pb, kick);

    const cheer = clamp01(show.applauseUntil - b);
    crowd.update(pb, { energy, lighters: scene.slow, cheer, frozen: scene.frozen });
    applauseSign.classList.toggle('on', b < show.applauseUntil && mod(b * 2, 1) < 0.65);
    danceScreen.classList.toggle('frozen', scene.frozen);
    darkness.style.opacity = (scene.slow * 0.85).toFixed(3);
    stormWarning.classList.toggle('on', scene.storm > 0.3);
    stage.style.scale = (1 + 0.12 * scene.build * scene.build).toFixed(3);

    const roll = b >= joinBeat - 4 && b < joinBeat ? (b - (joinBeat - 4)) / 4 : 0;
    const strobeLevel = scene.frozen ? 0 : roll ? 0.35 * roll * Math.exp(-mod(b * 4, 1) * 6) : show.flash + 0.3 * kick * energy;
    strobe.style.opacity = Math.min(1, strobeLevel).toFixed(3);
    banner.style.scale = (1 + 0.07 * kick * (0.4 + 0.6 * energy)).toFixed(3);
    floor.style.backgroundPosition = `0 ${(mod(pb, 1) * 70).toFixed(1)}px`;
    const s = scene.frozen ? 0 : show.shake * 26;
    stage.style.translate = `${((Math.random() - 0.5) * s).toFixed(1)}px ${((Math.random() - 0.5) * s).toFixed(1)}px`;

    fx.draw(scene.frozen ? 0 : dt, Math.max(0, pb), energy, {
      lasers: !scene.frozen && k >= firstDrop() && energy > 0.6 && scene.slow < 0.5,
      converge: roll,
      storm: scene.storm,
      dim: scene.slow,
    });
  }

  function addBackups(chosen) {
    backups = FERNS.filter((f) => f !== chosen).map((fern) => {
      const el = document.createElement('div');
      el.className = 'actor backup';
      const img = document.createElement('img');
      img.className = 'photo';
      img.src = fern.src;
      img.alt = '';
      img.style.objectPosition = fern.focus;
      el.appendChild(img);
      const gear = addGear(el);
      stage.prepend(el);
      return { el, gear };
    });
  }

  function removeBackups() {
    backups.forEach((bk) => bk.el.remove());
    backups = [];
  }

  // ---------- The (pointless) rhythm game ----------

  function resetGame() {
    game.score = 0;
    game.combo = 0;
    game.judged.clear();
    scoreEl.textContent = '0';
    comboEl.textContent = '';
    hintEl.style.opacity = '';
  }

  function popAt(x, y, label, grade, note) {
    const el = document.createElement('div');
    el.className = `pop ${grade}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.innerHTML = note ? `${label}<small>${note}</small>` : label;
    el.addEventListener('animationend', () => el.remove());
    pops.appendChild(el);
  }

  function judgeTap() {
    if (!musicMode) return;
    const b = beatPosition();
    const nearest = Math.round(b);
    const errMs = ((b - nearest) * 60000) / map.bpm;
    const off = Math.abs(errMs);
    let grade = off <= 45 ? 'perfect' : off <= 90 ? 'great' : 'fern';
    let note = grade === 'perfect' ? '' : errMs < 0 ? 'early' : 'late';
    if (game.judged.has(nearest)) {
      grade = 'fern';
      note = 'one per beat';
    }
    game.judged.add(nearest);
    hintEl.style.opacity = '0';

    game.combo = grade === 'fern' ? 0 : game.combo + 1;
    const multiplier = 1 + Math.floor(game.combo / 8);
    game.score += (grade === 'perfect' ? 1000 : grade === 'great' ? 500 : 0) * multiplier;
    scoreEl.textContent = game.score.toLocaleString();
    comboEl.textContent = game.combo >= 2 ? `x${game.combo} FROND COMBO` : '';

    const label = { perfect: 'PERFECT!', great: 'GREAT', fern: 'FERN.' }[grade];
    popAt(show.leadPos.x, show.leadPos.y - dancer.offsetHeight * 0.62, label, grade, note);
    if (game.combo > 0 && game.combo % 16 === 0) {
      hype(`${game.combo} FROND COMBO!`);
      applause(nearest, 4);
    }
  }

  // ---------- Flow ----------

  async function pickFern(fern, btn) {
    if (busy) return;
    busy = true;
    btn.classList.add('chosen');
    gameShowDing(audioCtx());

    [leadPhoto, ...echoes].forEach((el) => {
      el.src = fern.src;
      el.style.objectPosition = fern.focus;
    });
    leadPhoto.alt = `${fern.name}, ${fern.blurb}`;
    winnerName.textContent = fern.name;
    photoCredit.textContent = `Photo: ${fern.credit}, via Wikimedia Commons`;
    await wait(420);

    resetShow();
    resetGame();
    show.lastFrame = 0;
    removeBackups();
    addBackups(fern);
    danceScreen.style.clipPath = 'polygon(50% 50%, 50% 50%, 50% 50%)';
    danceScreen.hidden = false;
    document.body.classList.add('dancing');
    await startMusic();
    rafId = requestAnimationFrame(animate);
    await starWipe(danceScreen, 'in', 1100);
    busy = false;
  }

  async function pickAgain() {
    if (busy) return;
    busy = true;
    await starWipe(danceScreen, 'out', 800);
    stopMusic();
    cancelAnimationFrame(rafId);
    danceScreen.hidden = true;
    resetShow();
    removeBackups();
    document.body.classList.remove('dancing');
    delete document.body.dataset.chase;
    document.querySelectorAll('.podium.chosen').forEach((el) => el.classList.remove('chosen'));
    busy = false;
  }

  $('#again').addEventListener('click', pickAgain);

  danceScreen.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('button')) judgeTap();
  });

  addEventListener('keydown', (e) => {
    const dancing = !danceScreen.hidden;
    if (!dancing && /^[1-5]$/.test(e.key)) {
      row.querySelectorAll('.podium')[Number(e.key) - 1].click();
    } else if (dancing && e.key === 'Escape') {
      pickAgain();
    } else if (dancing && e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) judgeTap();
    } else if (dancing && e.code === 'KeyT') {
      tapSync();
    } else if (dancing && musicMode === 'track' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      beatOffset += e.key === 'ArrowRight' ? 0.02 : -0.02;
      toast(`Beat offset: ${Math.round(beatOffset * 1000)} ms`);
    }
  });

  addEventListener('resize', layoutBulbs);

  layoutBulbs();
  buildPodiums();
})();
