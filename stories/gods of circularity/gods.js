/* And So The Gods of Circularity Smiled Down Upon The Earth
 * Scroll-driven backgrounds:
 *   soil  (2D)    prelude: worm circles, accelerating
 *                 part1:   worm crawls at an even pace, eating the ground to reveal the void
 *                 postlude: fresh ground, worm circles fast then slows
 *   sky   (WebGL) part2:   void | night sky, the cursor grips and drags the sky's edge
 *   storm (WebGL) part3:   faint pulsing fire behind churning overcast
 *                 part4:   the fire spreads behind the clouds as a burning neural net
 */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = innerWidth, H = innerHeight;

  const pointer = { x: W / 2, y: H / 2 };
  addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
  addEventListener('touchmove', e => {
    const t = e.touches[0];
    if (t) { pointer.x = t.clientX; pointer.y = t.clientY; }
  }, { passive: true });

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  /* ------------------------------------------------------------------ worm */

  class Worm {
    constructor(n = 44) {
      this.n = n;
      this.pts = Array.from({ length: n }, () => ({ x: 0, y: 0 }));
      this.phase = 0;
      this.setSize(11);
    }
    setSize(r) {
      this.r = r;
      this.sp = r * 0.62;
    }
    place(x, y, angle) {
      for (let i = 0; i < this.n; i++) {
        this.pts[i].x = x - Math.cos(angle) * i * this.sp;
        this.pts[i].y = y - Math.sin(angle) * i * this.sp;
      }
    }
    moveHead(x, y) {
      const P = this.pts;
      P[0].x = x; P[0].y = y;
      for (let i = 1; i < this.n; i++) {
        const dx = P[i].x - P[i - 1].x, dy = P[i].y - P[i - 1].y;
        const d = Math.hypot(dx, dy);
        if (d > this.sp) {
          P[i].x = P[i - 1].x + dx / d * this.sp;
          P[i].y = P[i - 1].y + dy / d * this.sp;
        }
      }
    }
    radius(i) {
      const t = i / (this.n - 1);
      let p = t < 0.08 ? 0.55 + 0.45 * (t / 0.08)
            : t > 0.55 ? 1 - 0.5 * Math.pow((t - 0.55) / 0.45, 1.5)
            : 1;
      if (t > 0.2 && t < 0.32) p *= 1.12;                 // clitellum
      p *= 1 + 0.07 * Math.sin(this.phase - t * 14);      // peristaltic wave
      return this.r * p;
    }
    draw(ctx) {
      const P = this.pts, n = this.n, R = this.r;
      const rad = new Array(n);
      for (let i = 0; i < n; i++) rad[i] = this.radius(i);

      const blob = (color, scale, ox, oy, from = 0, to = n) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = from; i < to; i++) {
          const r = rad[i] * scale;
          ctx.moveTo(P[i].x + ox + r, P[i].y + oy);
          ctx.arc(P[i].x + ox, P[i].y + oy, r, 0, TAU);
        }
        ctx.fill();
      };
      const c0 = Math.round(n * 0.2), c1 = Math.round(n * 0.32);

      blob('rgba(0,0,0,0.3)', 1, R * 0.25, R * 0.4);
      blob('#6a332d', 1, 0, 0);
      blob('#b46a5d', 0.84, 0, 0);
      blob('#c98071', 0.84, 0, 0, c0, c1);
      blob('rgba(255,214,200,0.26)', 0.32, -R * 0.22, -R * 0.3);

      // annulation rings
      ctx.strokeStyle = 'rgba(72,26,22,0.38)';
      ctx.lineWidth = Math.max(0.7, R * 0.08);
      ctx.beginPath();
      for (let i = 2; i < n - 1; i += 2) {
        if (i >= c0 && i < c1) continue;
        let dx = P[i - 1].x - P[i + 1].x, dy = P[i - 1].y - P[i + 1].y;
        const d = Math.hypot(dx, dy) || 1;
        dx /= d; dy /= d;
        const r = rad[i] * 0.86;
        ctx.moveTo(P[i].x - dy * r, P[i].y + dx * r);
        ctx.quadraticCurveTo(P[i].x + dx * r * 0.4, P[i].y + dy * r * 0.4, P[i].x + dy * r, P[i].y - dx * r);
      }
      ctx.stroke();
    }
  }

  /* ------------------------------------------------------------------ soil */

  function buildSoil(w, h, scale) {
    const c = makeCanvas(w * scale, h * scale);
    const g = c.getContext('2d');
    g.fillStyle = '#2b1b11';
    g.fillRect(0, 0, c.width, c.height);
    g.scale(scale, scale);

    const blotches = (w * h) / 7000;
    for (let i = 0; i < blotches; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 90;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, Math.random() < 0.55 ? 'rgba(16,9,4,0.32)' : 'rgba(78,49,28,0.26)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // per-pixel grit
    const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      let v = (Math.random() - 0.5) * 26;
      const roll = Math.random();
      if (roll < 0.004) v += 55;
      else if (roll < 0.009) v -= 30;
      d[i] = clamp(d[i] + v, 0, 255);
      d[i + 1] = clamp(d[i + 1] + v * 0.8, 0, 255);
      d[i + 2] = clamp(d[i + 2] + v * 0.6, 0, 255);
    }
    g.putImageData(img, 0, 0);

    // pebbles
    const pebbles = (w * h) / 26000;
    for (let i = 0; i < pebbles; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const rx = 1.5 + Math.random() * 4, ry = rx * (0.6 + Math.random() * 0.4);
      const rot = Math.random() * Math.PI;
      g.fillStyle = 'rgba(14,8,4,0.45)';
      g.beginPath(); g.ellipse(x + 1, y + 1.2, rx, ry, rot, 0, TAU); g.fill();
      g.fillStyle = `rgba(${110 + Math.random() * 40 | 0},${78 + Math.random() * 30 | 0},${52 + Math.random() * 20 | 0},0.55)`;
      g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill();
    }
    return c;
  }

  function buildGrain() {
    const tiles = [];
    for (let k = 0; k < 4; k++) {
      const c = makeCanvas(192, 192), g = c.getContext('2d');
      const img = g.createImageData(192, 192), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 255;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      tiles.push(c);
    }
    return tiles;
  }

  const soil = (() => {
    const canvas = document.getElementById('soil');
    const ctx = canvas.getContext('2d');
    const TS = Math.min(DPR, 1.5);
    const worm = new Worm();
    const grainTiles = buildGrain();
    let patterns = [];

    const O0 = TAU / 16;                          // one lap per 16 s
    const OMAX = reduceMotion ? TAU / 3 : TAU / 0.32;
    const OMIN = TAU / 140;
    const PACE = 95;                              // px/s in part 1

    let texture, surface, sctx;
    let section = 'prelude', progress = 0;
    let mode = 'circle', modeTime = 0, circleTime = 0;
    let omega = O0, phi = -Math.PI / 2, blend = 1;
    let hx = 0, hy = 0, vx = 0, vy = 0;
    let heading = 0, speed = PACE, turn = 0, startSpeed = PACE;
    let prefAngle = null, prefTimer = 0, wiggle = 0, frameNo = 0;
    let cells = null, cellSize = 48, cols = 0, rows = 0;

    const ellipse = () => {
      const m = Math.max(36, Math.min(W, H) * 0.07);
      return { cx: W / 2, cy: H / 2, rx: W / 2 - m, ry: H / 2 - m };
    };

    function freshSurface() {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.globalCompositeOperation = 'copy';
      sctx.drawImage(texture, 0, 0);
      sctx.globalCompositeOperation = 'source-over';
      sctx.setTransform(TS, 0, 0, TS, 0, 0);
      cells.fill(0);
    }

    function resize() {
      canvas.width = Math.ceil(W * DPR);
      canvas.height = Math.ceil(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      worm.setSize(clamp(Math.min(W, H) * 0.0085, 4.5, 8));

      texture = buildSoil(W, H, TS);
      const old = surface;
      surface = makeCanvas(texture.width, texture.height);
      sctx = surface.getContext('2d');
      cols = Math.ceil(W / cellSize); rows = Math.ceil(H / cellSize);
      cells = new Uint8Array(cols * rows);
      if (old) {
        sctx.drawImage(texture, 0, 0);
        sctx.globalCompositeOperation = 'destination-in';
        sctx.drawImage(old, 0, 0, surface.width, surface.height);
        sctx.globalCompositeOperation = 'source-over';
        sctx.setTransform(TS, 0, 0, TS, 0, 0);
      } else {
        freshSurface();
        const e = ellipse();
        hx = e.cx + e.rx * Math.cos(phi); hy = e.cy + e.ry * Math.sin(phi);
        worm.place(hx, hy, phi - Math.PI / 2);
      }
      patterns = grainTiles.map(t => ctx.createPattern(t, 'repeat'));
    }

    function enterCircle(fresh) {
      const e = ellipse();
      mode = 'circle'; modeTime = 0;
      if (fresh) {
        blend = 1;
        hx = e.cx + e.rx * Math.cos(phi); hy = e.cy + e.ry * Math.sin(phi);
        worm.place(hx, hy, phi + Math.PI / 2);
      } else {
        blend = 0;
        phi = Math.atan2((hy - e.cy) / e.ry, (hx - e.cx) / e.rx);
      }
    }

    function enterCrawl() {
      mode = 'crawl'; modeTime = 0;
      heading = Math.atan2(vy, vx);
      startSpeed = Math.hypot(vx, vy) || PACE;
      turn = 0; prefTimer = 0;
    }

    function setSection(name, wasHidden) {
      if (name === 'postlude' && section !== 'postlude') {
        freshSurface();
        circleTime = 0;
        enterCircle(wasHidden);
      } else if (name === 'part1' && mode !== 'crawl') {
        enterCrawl();
      } else if (name === 'prelude' && mode !== 'circle') {
        enterCircle(false);
      }
      section = name;
    }

    function cellAt(x, y) {
      const cx = Math.floor(x / cellSize), cy = Math.floor(y / cellSize);
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return -1;
      return cy * cols + cx;
    }

    function pickPreferred() {
      let best = null, bestScore = -1;
      for (let k = 0; k < 10; k++) {
        const a = heading + (k - 4.5) * 0.45;
        let score = Math.random() * 0.6;
        for (const dist of [70, 140, 210]) {
          const idx = cellAt(hx + Math.cos(a) * dist, hy + Math.sin(a) * dist);
          if (idx >= 0 && !cells[idx]) score += 1;
        }
        if (score > bestScore) { bestScore = score; best = a; }
      }
      return bestScore > 1 ? best : null;
    }

    function eat(x0, y0, x1, y1) {
      const R = worm.r * 1.7;
      sctx.save();
      sctx.lineCap = 'round';
      sctx.beginPath(); sctx.moveTo(x0, y0); sctx.lineTo(x1, y1);
      sctx.globalCompositeOperation = 'source-atop';
      sctx.strokeStyle = 'rgba(10,5,2,0.16)';
      sctx.lineWidth = R * 2 + 8;
      sctx.stroke();
      sctx.globalCompositeOperation = 'destination-out';
      sctx.strokeStyle = '#000';
      sctx.lineWidth = R * 2;
      sctx.stroke();
      sctx.restore();
      const idx = cellAt(x1, y1);
      if (idx >= 0) cells[idx] = 1;
    }

    function update(dt) {
      modeTime += dt;
      const px = hx, py = hy;

      if (mode === 'circle') {
        circleTime += dt;
        const e = 0.07 * circleTime + 3 * progress;
        omega = section === 'postlude'
          ? Math.max(OMIN, OMAX * Math.exp(-e))
          : Math.min(OMAX, O0 * Math.exp(e));
        phi += omega * dt;
        const el = ellipse();
        const tx = el.cx + el.rx * Math.cos(phi), ty = el.cy + el.ry * Math.sin(phi);
        blend = Math.min(1, blend + dt / 1.5);
        if (blend >= 1) { hx = tx; hy = ty; }
        else {
          const k = 1 - Math.exp(-dt * (1.5 + 40 * blend * blend));
          hx += (tx - hx) * k; hy += (ty - hy) * k;
        }
      } else {
        speed = PACE + (startSpeed - PACE) * Math.exp(-modeTime * 2.2);
        turn += (Math.random() - 0.5) * 7 * dt;
        turn *= Math.exp(-dt * 0.9);
        turn = clamp(turn, -1.5, 1.5);

        prefTimer -= dt;
        if (prefTimer <= 0) { prefAngle = pickPreferred(); prefTimer = 0.9; }

        const margin = 60;
        if (hx < margin || hx > W - margin || hy < margin || hy > H - margin) {
          const toCenter = Math.atan2(H / 2 - hy, W / 2 - hx);
          heading += angleDiff(toCenter, heading) * Math.min(1, dt * 3);
        } else if (prefAngle !== null) {
          heading += angleDiff(prefAngle, heading) * Math.min(1, dt * 0.9);
        }
        heading += turn * dt;
        hx = clamp(hx + Math.cos(heading) * speed * dt, 6, W - 6);
        hy = clamp(hy + Math.sin(heading) * speed * dt, 6, H - 6);
        eat(px, py, hx, hy);
      }

      if (dt > 0) { vx = (hx - px) / dt; vy = (hy - py) / dt; }
      const v = Math.hypot(vx, vy) || 1;
      wiggle += dt * (mode === 'crawl' ? 6 : 4);
      worm.phase += dt * clamp(v / 12, 3, 30);
      const amp = (mode === 'crawl' ? 0.45 : 0.15) * worm.r * (reduceMotion ? 0.3 : 1);
      const off = Math.sin(wiggle) * amp;
      worm.moveHead(hx - vy / v * off, hy + vx / v * off);
    }

    function frame(dt) {
      update(dt);
      frameNo++;
      let alpha = 1;
      if (mode === 'circle' && !reduceMotion) {
        alpha = 1 - 0.78 * clamp((omega - TAU / 2) / (OMAX - TAU / 2), 0, 1);
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#050404';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = alpha * 0.07;
      ctx.fillStyle = patterns[frameNo % 4];
      const ox = Math.random() * 192, oy = Math.random() * 192;
      ctx.save(); ctx.translate(-ox, -oy); ctx.fillRect(ox, oy, W, H); ctx.restore();
      ctx.globalAlpha = alpha;
      ctx.drawImage(surface, 0, 0, W, H);
      ctx.globalAlpha = 1;
      worm.draw(ctx);
    }

    return {
      canvas, resize, frame, setSection, ok: true,
      set progress(p) { progress = p; },
    };
  })();

  /* ---------------------------------------------------------------- webgl */

  const GLSL_NOISE = `
    float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vnoise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1,0)), u.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), u.x), u.y);
    }
    float fbm(vec2 p){
      float s = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
      return s;
    }
  `;

  function makeGL(canvas, fragSrc) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) return null;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, `#version 300 es
      in vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const cache = {};
    const u = name => (name in cache ? cache[name] : (cache[name] = gl.getUniformLocation(prog, name)));
    return { gl, u };
  }

  /* ------------------------------------------------------------------ sky */

  const SKY_FRAG = `#version 300 es
    precision highp float;
    uniform vec2 uRes;
    uniform float uScale;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform vec2 uPull;
    uniform float uEdge[64];
    out vec4 o;
    ${GLSL_NOISE}

    float edgeAt(float y){
      float t = clamp(y / uRes.y, 0.0, 1.0) * 63.0;
      int i = int(floor(t));
      int j = min(i + 1, 63);
      return mix(uEdge[i], uEdge[j], fract(t));
    }

    float starLayer(vec2 p, float cell, float density, float seed){
      vec2 c = floor(p / cell);
      vec2 f = p - c * cell;
      float h = h21(c + seed);
      if (h > density) return 0.0;
      vec2 pos = (vec2(h21(c + seed + 3.1), h21(c + seed + 7.7)) * 0.8 + 0.1) * cell;
      float d = length(f - pos);
      float s = mix(0.5, 1.7, pow(h21(c + seed + 1.9), 3.0));
      float tw = 0.65 + 0.35 * sin(uTime * (0.8 + 2.5 * h21(c + seed + 5.3)) + h * 40.0);
      return (smoothstep(s + 0.9, s * 0.3, d) + 0.25 * exp(-d / (s * 2.2))) * tw;
    }

    void main(){
      vec2 p = gl_FragCoord.xy / uScale;
      vec2 dm = p - uMouse;
      float R = min(uRes.x, uRes.y) * 0.3;
      float g = exp(-dot(dm, dm) / (R * R));
      float pl = length(uPull);
      float grip = clamp(pl / 120.0, 0.0, 1.0);
      vec2 q = p - uPull * g + dm * g * 0.22 * grip;

      float side = q.x - edgeAt(q.y);

      float grain = h21(floor(gl_FragCoord.xy / (1.5 * uScale)) + floor(uTime * 20.0) * vec2(7.0, 3.0));
      vec3 voidc = vec3(0.016, 0.014, 0.016) + (grain - 0.5) * 0.05;
      voidc *= 1.0 - 0.6 * exp(min(side, 0.0) / 30.0);

      vec2 s = vec2(side, q.y);
      float gy = q.y / uRes.y;
      vec3 sky = mix(vec3(0.07, 0.13, 0.32), vec3(0.012, 0.025, 0.09), gy);
      float neb = fbm(s * 0.0025 + vec2(0.0, uTime * 0.003));
      float neb2 = fbm(s * 0.006 + vec2(3.0, 1.0));
      sky += vec3(0.10, 0.12, 0.30) * pow(neb, 3.0) * 1.6 + vec3(0.15, 0.08, 0.25) * pow(neb2, 4.0) * 0.8;
      float band = exp(-pow((s.y - s.x * 0.35 - uRes.y * 0.25) / (uRes.y * 0.18), 2.0));
      sky += vec3(0.12, 0.14, 0.25) * band * fbm(s * 0.01) * 0.9;
      float st = starLayer(s, 13.0, 0.10, 1.0) * 0.55
               + starLayer(s, 29.0, 0.22, 11.0) * 0.85
               + starLayer(s, 71.0, 0.35, 23.0) * 1.2;
      sky += vec3(0.92, 0.95, 1.0) * st;

      // gathered-fabric folds radiating from the grip
      float folds = sin(atan(dm.y, dm.x) * 11.0 + length(dm) * 0.02) * g * clamp(pl / 140.0, 0.0, 1.0);
      sky *= 1.0 + folds * 0.35;
      sky += vec3(0.25, 0.35, 0.7) * exp(-max(side, 0.0) / 5.0) * 0.35;

      vec3 col = mix(voidc, sky, smoothstep(-0.8, 0.8, side));
      o = vec4(col, 1.0);
    }
  `;

  const sky = (() => {
    const canvas = document.getElementById('sky');
    const ctx = makeGL(canvas, SKY_FRAG);
    const N = 64;
    const edge = new Float32Array(N), vel = new Float32Array(N);
    let base = 0, started = false, time = 0;
    const lag = { x: 0, y: 0 };
    let scale = 1;

    function resize() {
      if (!ctx) return;
      scale = Math.min(DPR, 1.5);
      canvas.width = Math.ceil(W * scale);
      canvas.height = Math.ceil(H * scale);
      ctx.gl.viewport(0, 0, canvas.width, canvas.height);
      if (started) edge.fill(base);
    }

    function setSection() {
      if (!started) {
        started = true;
        base = W / 2;
        edge.fill(base);
        lag.x = pointer.x; lag.y = pointer.y;
      }
    }

    function step(dt) {
      const mx = pointer.x, myGL = H - pointer.y;
      base += (mx - base) * (1 - Math.exp(-dt * 0.8));
      const spread = H * 0.25;
      for (let i = 0; i < N; i++) {
        const y = i / (N - 1) * H;
        const gr = Math.exp(-(((y - myGL) / spread) ** 2));
        const idle = Math.sin(time * 0.7 + y * 0.012) * 6;
        const target = base + (mx - base) * gr + idle;
        const left = edge[Math.max(0, i - 1)], right = edge[Math.min(N - 1, i + 1)];
        const a = 38 * (target - edge[i]) - 8 * vel[i] + 110 * (left + right - 2 * edge[i]);
        vel[i] += a * dt;
      }
      for (let i = 0; i < N; i++) edge[i] += vel[i] * dt;
    }

    function frame(dt) {
      if (!ctx) return;
      time += dt;
      const h = Math.min(dt, 1 / 30) / 2;
      step(h); step(h);
      const k = 1 - Math.exp(-dt * 4);
      lag.x += (pointer.x - lag.x) * k;
      lag.y += (pointer.y - lag.y) * k;
      let pxl = pointer.x - lag.x, pyl = -(pointer.y - lag.y);
      const pl = Math.hypot(pxl, pyl);
      if (pl > 180) { pxl *= 180 / pl; pyl *= 180 / pl; }

      const { gl, u } = ctx;
      gl.uniform2f(u('uRes'), W, H);
      gl.uniform1f(u('uScale'), scale);
      gl.uniform1f(u('uTime'), time);
      gl.uniform2f(u('uMouse'), pointer.x, H - pointer.y);
      gl.uniform2f(u('uPull'), pxl, pyl);
      gl.uniform1fv(u('uEdge[0]'), edge);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    return { canvas, resize, frame, setSection, ok: !!ctx, set progress(p) {} };
  })();

  /* ---------------------------------------------------------------- storm */

  const STORM_FRAG = `#version 300 es
    precision highp float;
    uniform vec2 uRes;
    uniform float uScale;
    uniform float uTime;
    uniform float uConsume;
    uniform vec2 uFire;
    out vec4 o;
    ${GLSL_NOISE}

    vec2 h22(vec2 p){
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return fract(sin(p) * 43758.5453);
    }

    // x: distance to nearest point, y: distance to cell border, z: cell id
    vec3 voro(vec2 x){
      vec2 n = floor(x), f = fract(x);
      vec2 mg = vec2(0.0), mr = vec2(0.0);
      float md = 8.0;
      for (int j = -1; j <= 1; j++)
      for (int i = -1; i <= 1; i++){
        vec2 g = vec2(float(i), float(j));
        vec2 off = 0.5 + 0.45 * sin(uTime * 0.35 + 6.2831 * h22(n + g));
        vec2 r = g + off - f;
        float d = dot(r, r);
        if (d < md){ md = d; mr = r; mg = g; }
      }
      float ed = 8.0;
      for (int j = -2; j <= 2; j++)
      for (int i = -2; i <= 2; i++){
        vec2 g = mg + vec2(float(i), float(j));
        vec2 off = 0.5 + 0.45 * sin(uTime * 0.35 + 6.2831 * h22(n + g));
        vec2 r = g + off - f;
        if (dot(mr - r, mr - r) > 1e-5) ed = min(ed, dot(0.5 * (mr + r), normalize(r - mr)));
      }
      return vec3(sqrt(md), ed, h21(n + mg));
    }

    void main(){
      vec2 p = gl_FragCoord.xy / uScale;
      float t = uTime;
      float c = uConsume;
      vec2 uv = p / uRes.y;
      vec2 fp = uFire / uRes.y;
      vec2 dv = uv - fp;
      float d = length(dv);
      float pulse = 0.5 + 0.35 * sin(t * 1.7) + 0.15 * sin(t * 3.1 + 1.0);

      vec3 col = vec3(0.44, 0.44, 0.455);
      vec3 fireC = vec3(1.0, 0.42, 0.1);
      float rad = 0.07 + 0.014 * pulse;
      float core = smoothstep(rad, rad * 0.3, d + (fbm(dv * 14.0 + t * 1.5) - 0.5) * 0.03);
      float halo = exp(-d / (0.22 + 0.06 * pulse + c * 1.1));
      float strength = 0.5 + 0.3 * pulse;
      col += fireC * halo * strength + vec3(1.0, 0.85, 0.55) * core * (0.7 + 0.4 * pulse);

      if (c > 0.001){
        float ns = fbm(uv * 2.5 + t * 0.05);
        float front = c * 2.6;
        float mask = smoothstep(front, front - 0.35, d + (ns - 0.5) * 0.5);
        vec2 w = uv * 4.0 + vec2(fbm(uv * 1.7 + t * 0.04), fbm(uv * 1.7 + 4.3 - t * 0.05)) * 1.6;
        vec3 v1 = voro(w);
        vec3 v2 = voro(w * 2.3 + 7.0);
        float fil = exp(-v1.y * v1.y * 500.0);
        float fil2 = exp(-v2.y * v2.y * 900.0) * 0.6;
        float travel = 0.5 + 0.5 * sin(v1.x * 18.0 - t * 5.0 + v1.z * 30.0);
        float firing = pow(0.5 + 0.5 * sin(t * (1.5 + v1.z * 2.0) + v1.z * 50.0), 10.0);
        float node = exp(-v1.x * v1.x * 90.0) * (0.35 + 1.6 * firing);
        float net = fil * (0.35 + 0.9 * travel) + fil2 * (0.4 + 0.6 * travel) + node;
        vec3 ember = vec3(0.32, 0.05, 0.01) + vec3(0.25, 0.07, 0.0) * fbm(uv * 6.0 - t * 0.2);
        vec3 netC = mix(vec3(0.95, 0.25, 0.03), vec3(1.0, 0.9, 0.55), clamp(net - 0.6, 0.0, 1.0)) * net;
        col = mix(col, ember + netC + fireC * halo * 0.4, mask);
      }

      for (int k = 0; k < 3; k++){
        float fk = float(k);
        float sc = 1.6 + fk * 1.1;
        vec2 drift = vec2(t * (0.012 + 0.01 * fk), t * 0.004 * (fk + 1.0));
        vec2 q = vec2(fbm(uv * sc * 0.7 + drift + fk * 3.1), fbm(uv * sc * 0.7 - drift + fk * 7.3 + 1.7));
        float den = fbm(uv * sc + q * 1.4 + drift * 1.5 + t * 0.01);
        den = smoothstep(0.3 - 0.05 * fk, 0.72, den);
        float op = (0.86 - 0.1 * fk) * (1.0 - 0.18 * c);
        vec3 base = mix(vec3(0.62, 0.63, 0.65), vec3(0.80, 0.81, 0.83), fk / 2.0) * mix(0.92, 1.05, den);
        vec3 lit = fireC * halo * (0.25 + 0.7 * (1.0 - den)) * (0.55 + 0.6 * c);
        vec3 cloud = base * (1.0 - 0.3 * c) + lit + col * (1.0 - den) * 0.35 * c;
        col = mix(col, cloud, den * op);
      }
      o = vec4(col, 1.0);
    }
  `;

  const storm = (() => {
    const canvas = document.getElementById('storm');
    const ctx = makeGL(canvas, STORM_FRAG);
    let scale = 1, time = 0, section = 'part3', progress = 0, sectionTime = 0, consume = 0;

    function resize() {
      if (!ctx) return;
      scale = Math.min(DPR, 2) * 0.55;
      canvas.width = Math.ceil(W * scale);
      canvas.height = Math.ceil(H * scale);
      ctx.gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function setSection(name) {
      if (name !== section) sectionTime = 0;
      section = name;
    }

    function frame(dt) {
      if (!ctx) return;
      time += dt;
      sectionTime += dt;
      let target = consume;
      if (section === 'part3') target = 0;
      if (section === 'part4') target = Math.max(progress, Math.min(1, sectionTime / 80));
      consume += (target - consume) * (1 - Math.exp(-dt * 0.6));

      const { gl, u } = ctx;
      gl.uniform2f(u('uRes'), W, H);
      gl.uniform1f(u('uScale'), scale);
      gl.uniform1f(u('uTime'), time);
      gl.uniform1f(u('uConsume'), consume);
      gl.uniform2f(u('uFire'), W * 0.86, H * 0.13);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    return { canvas, resize, frame, setSection, ok: !!ctx, set progress(p) { progress = p; } };
  })();

  /* --------------------------------------------------------------- director */

  const SCENE_OF = { prelude: soil, part1: soil, part2: sky, part3: storm, part4: storm, postlude: soil };
  const FALLBACK_BG = { part2: '#0b1430', part3: '#8a8b8e', part4: '#7a2a0a' };
  const scenes = [soil, sky, storm];
  const fadeUntil = new Map();
  const sections = [...document.querySelectorAll('[data-section]')];
  let activeSection = null, activeScene = null;

  function currentSection() {
    const mid = H * 0.5;
    let found = sections[0];
    for (const el of sections) if (el.getBoundingClientRect().top <= mid) found = el;
    return found;
  }

  function sectionProgress(name) {
    const els = sections.filter(el => el.dataset.section === name);
    const top = els[0].getBoundingClientRect().top;
    const bottom = els[els.length - 1].getBoundingClientRect().bottom;
    return clamp((H * 0.5 - top) / Math.max(1, bottom - top), 0, 1);
  }

  function updateSection(now) {
    const name = currentSection().dataset.section;
    const scene = SCENE_OF[name];
    if (name !== activeSection) {
      const wasHidden = scene !== activeScene;
      scene.setSection(name, wasHidden);
      if (wasHidden) {
        if (activeScene) {
          activeScene.canvas.classList.remove('on');
          fadeUntil.set(activeScene, now + 1700);
        }
        scene.canvas.classList.add('on');
        activeScene = scene;
      }
      activeSection = name;
      document.body.dataset.theme = name;
      document.body.style.background = scene.ok ? '' : FALLBACK_BG[name] || '';
    }
    scene.progress = sectionProgress(name);
  }

  function resize() {
    W = innerWidth; H = innerHeight;
    scenes.forEach(s => s.resize());
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    updateSection(now);
    for (const s of scenes) {
      if (s === activeScene || (fadeUntil.get(s) || 0) > now) s.frame(dt);
    }
    requestAnimationFrame(loop);
  }

  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  resize();
  requestAnimationFrame(loop);
})();
