// target practice: the paper, the concrete, and the cracks that never stop.
//
// The cracks are simulated as growing tips that are drawn once onto canvas
// tiles inside the slab, so they scroll natively with the wall. Every tip
// reads a mask of the story's text lines and routes around it, which is what
// guarantees a crack can never touch a letter. Nothing but lines is drawn:
// the slab itself never moves apart.

(function () {
  'use strict';

  const paper = document.querySelector('.paper');
  const slab = document.querySelector('.slab');
  const layer = slab.querySelector('.cracks');
  const wall = slab.querySelector('.wall');
  const stage = document.querySelector('.stage');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Always arrive at the paper with the wall down and whole.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  slab.classList.add('closed');

  const rand = (a, b) => a + Math.random() * (b - a);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  /* ---------- typed abstract: uneven ink, one letter at a time ---------- */

  function typeset(el) {
    const text = el.textContent;
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    text.split(' ').forEach((word, i) => {
      if (i) visual.append(' ');
      const w = document.createElement('span');
      w.className = 'w';
      for (const ch of word) {
        const c = document.createElement('span');
        c.className = 'c';
        c.textContent = ch;
        c.style.transform = `translateY(${(gauss() * 0.22).toFixed(2)}px)`;
        c.style.opacity = (Math.random() < 0.05 ? rand(0.62, 0.74) : rand(0.84, 1)).toFixed(2);
        w.append(c);
      }
      visual.append(w);
    });
    const plain = document.createElement('span');
    plain.className = 'sr-only';
    plain.textContent = text;
    el.replaceChildren(plain, visual);
  }

  document.querySelectorAll('[data-typed]').forEach(typeset);

  /* ---------- concrete texture (procedural, seamless) ---------- */

  function periodicNoise(size, cell) {
    const n = Math.round(size / cell);
    const lattice = new Float32Array(n * n).map(() => Math.random());
    const smooth = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
      const fx = (x / size) * n, fy = (y / size) * n;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = smooth(fx - x0), ty = smooth(fy - y0);
      const at = (i, j) => lattice[((j + n) % n) * n + ((i + n) % n)];
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
      const bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      return top + (bot - top) * ty - 0.5;
    };
  }

  function grainTile() {
    const size = 768;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const octaves = [[96, 5], [48, 4.5], [24, 4.5], [12, 5], [6, 6], [3, 6]]
      .map(([cell, amp]) => [periodicNoise(size, cell), amp]);
    const img = ctx.createImageData(size, size);
    for (let y = 0, i = 0; y < size; y++) {
      for (let x = 0; x < size; x++, i += 4) {
        let v = 0;
        for (const [noise, amp] of octaves) v += noise(x, y) * amp * 2;
        v += (Math.random() - 0.5) * 15;
        if (Math.random() < 0.012) v += rand(-24, 16);   // sand and aggregate
        img.data[i] = 167 + v;
        img.data[i + 1] = 164 + v;
        img.data[i + 2] = 157 + v;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // Bug holes: air pits left in the pour, kept too faint to read as punctuation.
    for (let k = 0; k < 120; k++) {
      const x = rand(5, size - 5), y = rand(5, size - 5), r = rand(0.5, 1.6);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.ellipse(x + 0.5, y + 0.7, r, r * 0.8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(70,66,60,0.26)';
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.8, 0, 0, 7); ctx.fill();
    }
    return canvas;
  }

  function stainTile() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const a = periodicNoise(size, 64), b = periodicNoise(size, 32);
    const img = ctx.createImageData(size, size);
    for (let y = 0, i = 0; y < size; y++) {
      for (let x = 0; x < size; x++, i += 4) {
        const v = a(x, y) * 1.3 + b(x, y) * 0.5;
        const shade = v < 0 ? 42 : 240;
        img.data[i] = shade;
        img.data[i + 1] = shade - 2;
        img.data[i + 2] = shade - 7;
        img.data[i + 3] = Math.min(24, Math.abs(v) * 60);
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  function paintConcrete() {
    // Unequal periods, so the eye never catches the tiling.
    const grain = grainTile().toDataURL('image/jpeg', 0.82);
    const stain = stainTile().toDataURL('image/png');
    // A little occlusion along the top edge, where the slab meets the window.
    const occlusion = 'linear-gradient(rgba(20,18,15,0.2), rgba(20,18,15,0))';
    slab.style.backgroundImage = `${occlusion}, url(${stain}), url(${grain})`;
    slab.style.backgroundSize = '100% 70px, 1730px 1490px, 768px 768px';
    slab.style.backgroundRepeat = 'no-repeat, repeat, repeat';
    slab.style.setProperty('--grain', `url(${grain})`);
  }

  /* ---------- crack simulation ---------- */

  const TILE_H = 512;      // css px per canvas tile
  const MASK_CELL = 4;     // text mask resolution
  const OCC_CELL = 6;      // where cracks already run
  const STEP = 3;          // crack advance per simulation step, px
  const BAND = 200;        // spatial bucket for crack points
  const VISIBLE_TIPS = 5;  // cracks kept actively growing on screen
  const TOTAL_TIPS = 20;   // ...and across the whole slab

  let W, H, dpr, tiles;
  let mask, maskW, maskH, occ, occW, occH;
  let tips, bands, gapSeeds, nextId, nextSpawn, clearance, spawnFails;
  let ignited = false, age = 0;

  function measure() {
    W = slab.clientWidth;
    H = slab.clientHeight;
    const budget = 30e6; // canvas pixels across the slab, to protect phones
    dpr = Math.min(devicePixelRatio || 1, 2);
    dpr = Math.min(dpr, Math.sqrt(budget / (W * H)));

    maskW = Math.ceil(W / MASK_CELL) + 1;
    maskH = Math.ceil(H / MASK_CELL) + 1;
    mask = new Uint8Array(maskW * maskH);
    occW = Math.ceil(W / OCC_CELL) + 1;
    occH = Math.ceil(H / OCC_CELL) + 1;
    occ = new Int32Array(occW * occH);

    // Every rendered line of text becomes a keep-out zone, generous enough
    // that the blocks close up across line spacing.
    const origin = slab.getBoundingClientRect();
    const range = document.createRange();
    const walker = document.createTreeWalker(wall, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!walker.currentNode.nodeValue.trim()) continue;
      range.selectNodeContents(walker.currentNode);
      for (const r of range.getClientRects()) {
        blockRect(r.left - origin.left - 9, r.top - origin.top - 7,
                  r.right - origin.left + 9, r.bottom - origin.top + 7);
      }
    }

    // The blank spaces in the story are open ground for hairlines.
    gapSeeds = [...wall.querySelectorAll('.gap')].map((g) => {
      const r = g.getBoundingClientRect();
      return {
        x: r.left - origin.left + r.width * 0.25,
        y: r.top - origin.top - 7,
        at: rand(12, 70),
      };
    });
  }

  function blockRect(x0, y0, x1, y1) {
    const cx0 = Math.max(0, Math.floor(x0 / MASK_CELL));
    const cx1 = Math.min(maskW - 1, Math.ceil(x1 / MASK_CELL));
    const cy0 = Math.max(0, Math.floor(y0 / MASK_CELL));
    const cy1 = Math.min(maskH - 1, Math.ceil(y1 / MASK_CELL));
    for (let y = cy0; y <= cy1; y++) mask.fill(1, y * maskW + cx0, y * maskW + cx1 + 1);
  }

  const onText = (x, y) => mask[(y / MASK_CELL | 0) * maskW + (x / MASK_CELL | 0)] === 1;
  const inSlab = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const occIndex = (x, y) => (y / OCC_CELL | 0) * occW + (x / OCC_CELL | 0);

  function pathClear(x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2);
    for (let i = 1; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      if (inSlab(x, y) && onText(x, y)) return false;
    }
    return true;
  }

  function roomAt(x, y) {
    if (!inSlab(x, y) || onText(x, y)) return false;
    const cx = x / OCC_CELL | 0, cy = y / OCC_CELL | 0;
    for (let j = -clearance; j <= clearance; j++) {
      for (let i = -clearance; i <= clearance; i++) {
        const xx = cx + i, yy = cy + j;
        if (xx < 0 || yy < 0 || xx >= occW || yy >= occH) continue;
        if (occ[yy * occW + xx]) return false;
      }
    }
    return true;
  }

  function tileContext(i) {
    if (tiles[i]) return tiles[i];
    const canvas = document.createElement('canvas');
    const h = Math.min(TILE_H, H - i * TILE_H);
    canvas.width = Math.ceil(W * dpr);
    canvas.height = Math.ceil(h * dpr);
    canvas.style.top = i * TILE_H + 'px';
    canvas.style.height = h + 'px';
    layer.append(canvas);
    // CPU-backed: these canvases live for the whole visit and are only ever added to,
    // and a GPU-backed tile was seen coming back solid black from a hidden window.
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(dpr, 0, 0, dpr, 0, -i * TILE_H * dpr);
    ctx.lineJoin = 'round';
    tiles[i] = ctx;
    return ctx;
  }

  function drawSegment(x0, y0, x1, y1, w) {
    const first = Math.max(0, Math.floor((Math.min(y0, y1) - 4) / TILE_H));
    const last = Math.floor((Math.max(y0, y1) + 4) / TILE_H);
    for (let i = first; i <= last && i * TILE_H < H; i++) {
      const ctx = tileContext(i);
      // A catch of light on the lower lip gives each crack its depth.
      ctx.lineCap = 'butt';
      ctx.strokeStyle = 'rgba(240,238,232,0.13)';
      ctx.lineWidth = w * 0.75;
      ctx.beginPath();
      ctx.moveTo(x0 + 0.8, y0 + 0.9);
      ctx.lineTo(x1 + 0.8, y1 + 0.9);
      ctx.stroke();
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#5b5852';
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }

  function addTip(x, y, dir, w, life, parent, pace) {
    const tip = {
      x, y, dir, a: dir, w, life, life0: life,
      id: nextId++, parent: parent || 0,
      pace: pace || rand(0.75, 1.25),
      carry: 0, kink: 0, grace: 5, points: 0, alive: true,
    };
    tips.push(tip);
    return tip;
  }

  const DETOURS = [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.1, -2.1];

  function stepTip(t) {
    if (--t.kink <= 0) {
      // Straight runs broken by sharp little kinks around a wandering heading.
      t.kink = 2 + (Math.random() * 7 | 0);
      t.dir += gauss() * 0.14;
      t.a = t.dir + gauss() * 0.75;
    }
    let nx, ny, found = false;
    const flip = Math.random() < 0.5 ? 1 : -1;
    for (let k = 0; k < DETOURS.length; k++) {
      const a = t.a + DETOURS[k] * flip;
      nx = t.x + Math.cos(a) * STEP;
      ny = t.y + Math.sin(a) * STEP;
      if (!pathClear(t.x, t.y, nx, ny)) continue;
      if (k > 0) {
        // Text ahead: most cracks turn along it, some simply stop short.
        if (Math.random() < (W < 700 ? 0.2 : 0.05)) { t.alive = false; return; }
        t.dir = t.a = a;
        t.kink = 4;
      }
      found = true;
      break;
    }
    if (!found) { t.alive = false; return; }

    const width = Math.max(0.4, t.w * (0.38 + 0.62 * (t.life / t.life0)));
    if (!inSlab(nx, ny)) {
      drawSegment(t.x, t.y, nx, ny, width);
      t.alive = false;
      return;
    }

    const idx = occIndex(nx, ny);
    const other = occ[idx];
    if (t.grace > 0) t.grace--;
    const met = other && other !== t.id && other !== t.parent && t.grace === 0;
    drawSegment(t.x, t.y, nx, ny, width);
    t.x = nx;
    t.y = ny;
    if (met) { t.alive = false; return; }   // meets another crack: a T-junction
    occ[idx] = t.id;

    if (!t.hair && ++t.points % 5 === 0) {
      const band = t.y / BAND | 0;
      (bands[band] || (bands[band] = [])).push({ x: t.x, y: t.y, a: t.dir, id: t.id });
    }

    t.life -= STEP;
    if (t.life <= 0) { t.alive = false; return; }

    if (!t.hair && Math.random() < 0.016) {
      addTip(t.x, t.y, t.dir + (Math.random() < 0.5 ? 1 : -1) * rand(0.45, 1.15),
        Math.max(0.4, width * 0.66), rand(40, 320), t.id);
    }
  }

  function spawn(y0, y1) {
    y0 = Math.max(0, y0);
    y1 = Math.min(H - 1, y1);
    for (let attempt = 0; attempt < 6; attempt++) {
      const y = rand(y0, y1);
      const band = bands[y / BAND | 0];
      if (band && band.length && Math.random() < 0.72) {
        const p = band[Math.random() * band.length | 0];
        if (p.y < y0 || p.y > y1) continue;
        const a = p.a + (Math.random() < 0.5 ? 1 : -1) * rand(0.55, 1.25);
        const reach = OCC_CELL * (clearance + 1);
        if (roomAt(p.x + Math.cos(a) * reach, p.y + Math.sin(a) * reach)) {
          addTip(p.x, p.y, a, rand(0.45, 0.85), rand(80, 500), p.id);
          spawnFails = 0;
          return true;
        }
      } else {
        // Failure opening up from the slab's edge.
        const left = Math.random() < 0.5;
        const x = left ? 0.5 : W - 0.5;
        // On a phone the margin is a narrow strip, so cracks mostly run down it.
        const a = W < 700
          ? (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2 + gauss() * 0.3
          : (left ? 0 : Math.PI) + (left ? 1 : -1) * gauss() * 1.3;
        const reach = OCC_CELL * (clearance + 1);
        if (roomAt(x + Math.cos(a) * reach, y + Math.sin(a) * reach)) {
          addTip(x, y, a, rand(0.7, 1.15), rand(200, 900));
          spawnFails = 0;
          return true;
        }
      }
    }
    // Nowhere left at this density: let later cracks run closer together.
    if (++spawnFails > 200 && clearance > 1) { clearance--; spawnFails = 0; }
    return false;
  }

  function tick(dt, viewTop, viewBottom) {
    age += dt;
    // Fast at the moment of impact, then a creep that slows but never stops.
    const creep = Math.max(3, 15 / (1 + age / 300));
    const shock = reduceMotion ? 1 : 1 + 62 * Math.exp(-age / 0.34);
    const stop = tips.length;
    for (let i = 0; i < stop; i++) {
      const t = tips[i];
      t.carry += creep * shock * t.pace * dt;
      while (t.carry >= STEP && t.alive) {
        t.carry -= STEP;
        stepTip(t);
      }
    }
    tips = tips.filter((t) => t.alive);

    for (const g of gapSeeds) {
      if (!g.done && age >= g.at) {
        g.done = true;
        // One lone hairline: nothing grows from it, so the gap stays a gap.
        if (inSlab(g.x, g.y) && !onText(g.x, g.y)) addTip(g.x, g.y, rand(-0.2, 0.2), 0.45, rand(25, 70)).hair = true;
      }
    }

    if (age >= nextSpawn) {
      nextSpawn = age + rand(0.5, 1.6);
      let visible = 0;
      for (const t of tips) if (t.y >= viewTop && t.y <= viewBottom) visible++;
      if (visible < VISIBLE_TIPS) spawn(viewTop, viewBottom);
      if (tips.length < TOTAL_TIPS) spawn(0, H);
    }
  }

  function resetSimulation() {
    layer.replaceChildren();
    tiles = [];
    tips = [];
    bands = [];
    nextId = 1;
    nextSpawn = 0;
    clearance = 4;
    spawnFails = 0;
    age = 0;
  }

  function impact() {
    // The first fractures run down from the edge that struck the top of the window.
    const count = W < 700 ? 4 : 7;
    for (let i = 0; i < count; i++) {
      const x = W * ((i + rand(0.15, 0.85)) / count);
      addTip(x, 0.5, Math.PI / 2 + gauss() * 0.7, rand(1.1, 1.6), rand(350, 1100), 0, rand(0.9, 1.5));
    }
    // A reader who scrolled hard may already be past that edge.
    const top = Math.max(0, -naturalTop());
    if (top > 0) {
      for (let i = 0; i < 3; i++) {
        const left = i % 2 === 0;
        addTip(left ? 0.5 : W - 0.5, top + rand(0, innerHeight), (left ? 0 : Math.PI) + gauss(),
          rand(1.05, 1.4), rand(300, 800), 0, rand(0.9, 1.5));
      }
    }
  }

  let last = 0, pending = 0;
  function frame(now) {
    pending += Math.min(0.1, (now - last) / 1000);
    last = now;
    // Every frame during the impact; after that a dozen updates a second is plenty.
    if (age < 2 || pending >= 0.08) {
      const top = -naturalTop();
      tick(pending, top, top + innerHeight);
      pending = 0;
    }
    requestAnimationFrame(frame);
  }

  function ignite() {
    if (ignited) return;
    ignited = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  /* ---------- the slab's weight: dragged up by hand ---------- */

  // Where the slab sits once the wall is up; the story then scrolls normally.
  const naturalTop = () => slab.offsetTop - scrollY;

  const HEAVINESS = 1.4;    // the higher, the more it resists early in the pull
  const LAG = 0.1;          // seconds of inertia behind the hand
  const BREAK_AWAY = 0.86;  // share of the pull after which it slams on its own
  const SLAM_MS = 150;
  const GRAVITY = 2300;     // px/s^2 when let go early
  const MAX_PITCH = 7;      // degrees of lean on the way up
  const FACE = 0.04;        // top face depth, as a share of its distance from the top
  const HOVER_RISE = 5;     // it shifts slightly under a hovering hand

  let phase = 'closed', shown = 0, span = 1, moving = false, lastMove = 0;
  let pull = 0, held = false, hovering = false, fall = 0, touched = false;
  let grabY = 0, grabPull = 0, slamFrom = 0, slamStart = 0, hitAt = -1e9;

  function measureSpan() {
    const lip = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lip')) || 40;
    span = Math.max(1, innerHeight - lip);
  }

  const topForPull = (p) => span * (1 - Math.pow(Math.min(1, Math.max(0, p)), HEAVINESS));
  const pullForTop = (y) => Math.pow(Math.max(0, 1 - y / span), 1 / HEAVINESS);

  function openWall(now) {
    // The wall is up for good: paper goes behind it, and the page becomes the slab.
    phase = 'open';
    slab.classList.remove('closed');
    stage.classList.add('open');
    scrollTo(0, 0);
    slab.style.transform = 'none';
    if (slab.clientWidth !== W) {
      resetSimulation();
      measure();
    }
    impact();
    ignite();
    if (!reduceMotion) {
      hitAt = now;
      raiseDust();
    }
  }

  function moveSlab(now) {
    moving = false;
    const dt = Math.min(0.05, (now - lastMove) / 1000);
    lastMove = now;
    let offset = 0, pitch = 0, active = false;

    if (phase === 'closed') {
      const rest = span - (hovering ? HOVER_RISE : 0);
      if (held) {
        const target = Math.min(rest, topForPull(pull));
        shown = reduceMotion ? target : shown + (target - shown) * (1 - Math.exp(-dt / LAG));
        fall = 0;
        active = Math.abs(target - shown) > 0.15;
        if (pull >= BREAK_AWAY) {
          if (reduceMotion) {
            shown = 0;
            openWall(now);
          } else {
            phase = 'slam';
            slamFrom = shown;
            slamStart = now;
          }
        }
      } else if (reduceMotion) {
        shown = rest;
      } else {
        // Let go: it drops under its own weight, and lands with a short, dull bounce.
        fall += GRAVITY * dt;
        shown += fall * dt;
        active = true;
        if (shown >= rest) {
          shown = rest;
          fall = fall > 170 ? -fall * 0.2 : 0;
          active = fall !== 0;
        }
      }
    }
    if (phase === 'slam') {
      const t = Math.min(1, (now - slamStart) / SLAM_MS);
      shown = slamFrom * (1 - t * t);   // accelerating into the top
      active = true;
      if (t >= 1) openWall(now);
    }

    if (phase === 'open') {
      shown = 0;
      // The thud: a short, stiff rebound off the top, and a shudder through the mass.
      const since = (now - hitAt) / 1000;
      if (since < 1) {
        offset = 15 * Math.exp(-since / 0.13) * Math.abs(Math.sin(since * Math.PI / 0.19));
        pitch = 1.5 * Math.exp(-since / 0.18) * Math.sin(since * 2 * Math.PI / 0.23);
        active = true;
      }
    } else {
      offset = shown;
      if (!reduceMotion) pitch = MAX_PITCH * Math.max(0, Math.min(1, shown / span));
    }

    slab.classList.toggle('lifted', held || phase !== 'closed' || shown < span - 24);

    const face = phase === 'open' || reduceMotion ? 0 : Math.max(0, shown) * FACE;
    slab.style.setProperty('--face', face.toFixed(1) + 'px');
    const flat = Math.abs(offset) < 0.05 && Math.abs(pitch) < 0.005;
    slab.style.transform = flat
      ? 'none'
      : `translateY(${offset.toFixed(2)}px) perspective(1500px) rotateX(${pitch.toFixed(3)}deg)`;
    slab.style.willChange = active ? 'transform' : 'auto';

    if (active) wakeSlab();
  }

  function wakeSlab() {
    if (moving) return;
    moving = true;
    lastMove = lastMove || performance.now();
    requestAnimationFrame(moveSlab);
  }

  /* ---------- grabbing it ---------- */

  slab.addEventListener('pointerdown', (e) => {
    if (phase !== 'closed' || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    touched = true;
    held = true;
    grabY = e.clientY;
    grabPull = pullForTop(shown);
    pull = grabPull;
    try { slab.setPointerCapture(e.pointerId); } catch (err) { /* already released */ }
    slab.classList.add('grabbed');
    lastMove = performance.now();
    wakeSlab();
  });

  slab.addEventListener('pointermove', (e) => {
    if (!held || phase !== 'closed') return;
    pull = Math.max(0, grabPull + (grabY - e.clientY) / span);
    wakeSlab();
  });

  function letGo() {
    if (!held) return;
    held = false;
    slab.classList.remove('grabbed');
    wakeSlab();
  }
  slab.addEventListener('pointerup', letGo);
  slab.addEventListener('pointercancel', letGo);

  slab.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') { hovering = true; wakeSlab(); }
  });
  slab.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') { hovering = false; wakeSlab(); }
  });

  // Dragging is the way up. Keys remain so that keyboard-only readers can reach the story;
  // they scroll the paper first if it has anywhere to go, and the slab stays where they put it.
  function raiseBy(delta) {
    touched = true;
    if (!held) pull = pullForTop(shown);
    held = true;
    pull += delta;
    lastMove = performance.now();
    wakeSlab();
  }

  const canScrollPaper = () => document.documentElement.scrollHeight > innerHeight + 1;
  const atPaperEnd = () => innerHeight + scrollY >= document.documentElement.scrollHeight - 1;

  // Where the paper runs on below the window, the prompt waits until it has been read,
  // rather than sitting on top of the text.
  function showPromptAtPaperEnd() {
    slab.classList.toggle('reading', canScrollPaper() && !atPaperEnd());
  }
  addEventListener('scroll', showPromptAtPaperEnd, { passive: true });

  addEventListener('keydown', (e) => {
    if (phase !== 'closed') return;
    const down = ['ArrowDown', 'PageDown', ' ', 'End'].includes(e.key);
    const up = ['ArrowUp', 'PageUp', 'Home'].includes(e.key);
    if (!canScrollPaper() ? down || up : down && atPaperEnd()) {
      e.preventDefault();
      raiseBy(0.17);
    }
  });

  function raiseDust() {
    const canvas = document.createElement('canvas');
    canvas.className = 'dust';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    document.body.append(canvas);
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const grains = Array.from({ length: Math.round(w / 6) }, () => ({
      x: rand(0, w), y: rand(-4, 5), vx: gauss() * 26, vy: rand(10, 90),
      r: rand(0.7, 2.5), life: rand(0.8, 2), shade: rand(70, 135) | 0,
    }));
    const puffs = Array.from({ length: Math.round(w / 90) }, () => ({
      x: rand(0, w), r: rand(26, 80), vy: rand(10, 34), life: rand(0.8, 1.5),
    }));
    const begun = performance.now();
    let prev = begun;
    (function draw(now) {
      const t = (now - begun) / 1000, dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      ctx.clearRect(0, 0, w, h);
      // The moment of contact darkens the top of the window.
      const contact = 0.34 * Math.exp(-t / 0.2);
      const shade = ctx.createLinearGradient(0, 0, 0, 170);
      shade.addColorStop(0, `rgba(16,15,13,${contact})`);
      shade.addColorStop(1, 'rgba(16,15,13,0)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, w, 170);
      for (const p of puffs) {
        const a = Math.max(0, 1 - t / p.life);
        if (!a) continue;
        const y = p.vy * t + 4, r = p.r * (1 + t * 1.2);
        const g = ctx.createRadialGradient(p.x, y, 0, p.x, y, r);
        g.addColorStop(0, `rgba(205,201,193,${0.24 * a})`);
        g.addColorStop(1, 'rgba(205,201,193,0)');
        ctx.fillStyle = g;
        ctx.fillRect(p.x - r, y - r, r * 2, r * 2);
      }
      for (const p of grains) {
        const a = Math.max(0, 1 - t / p.life);
        if (!a) continue;
        p.vy += 420 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.fillStyle = `rgba(${p.shade},${p.shade - 3},${p.shade - 8},${a * 0.85})`;
        ctx.fillRect(p.x, p.y, p.r, p.r);
      }
      if (t < 2) requestAnimationFrame(draw);
      else canvas.remove();
    })(begun);
  }

  /* ---------- text reflows when the width changes: regrow around it ---------- */

  let resizeTimer, lastWidth = innerWidth;
  addEventListener('resize', () => {
    measureSpan();
    showPromptAtPaperEnd();
    wakeSlab();
    if (innerWidth === lastWidth) return;   // a phone's address bar, not a reflow
    lastWidth = innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const elapsed = age;
      slab.style.transform = 'none';
      resetSimulation();
      measure();
      wakeSlab();
      if (!ignited) return;
      impact();
      const top = -naturalTop();
      for (let t = 0, end = Math.min(elapsed, 240); t < end; t += 0.1) tick(0.1, top, top + innerHeight);
    }, 180);
  });

  /* ---------- start ---------- */

  function start() {
    resetSimulation();
    measureSpan();
    shown = span;
    scrollTo(0, 0);
    measure();   // while the slab is still flat, so the text is measured true
    slab.style.transform = `translateY(${shown}px) perspective(1500px) rotateX(${reduceMotion ? 0 : MAX_PITCH}deg)`;
    slab.style.setProperty('--face', (reduceMotion ? 0 : span * FACE).toFixed(1) + 'px');
    // Ready in advance, so nothing stalls at the moment of the thud.
    for (let i = 0; i * TILE_H < innerHeight * 1.5; i++) tileContext(i);
    showPromptAtPaperEnd();
    // Once, unprompted, the slab shifts a little: enough to show it can be moved.
    if (!reduceMotion) {
      setTimeout(() => {
        if (touched || phase !== 'closed') return;
        fall = -210;
        lastMove = performance.now();
        wakeSlab();
      }, 1500);
    }
  }

  paintConcrete();
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(start);
})();
