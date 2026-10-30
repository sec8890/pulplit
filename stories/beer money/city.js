/* Beer Money
 * Fixed background: a run-down Glasgow/Dublin-ish city at night in the rain,
 * seen from high up in a tower block through sodium-lit murk: tenement
 * terraces, slate roofs and chimney pots, a river, steeples, hills beyond. Translucent white/blue will-o'-the-wisps
 * materialise down in the streets between the buildings, drift along them,
 * then fade away. They never rise above the roofs either side of them.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const canvas = document.getElementById('city');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Seeded, so every visit gets the same city (and the same framing).
let seed = 0x5eed1e;
function random() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rand = (a, b) => a + random() * (b - a);
const pick = arr => arr[(random() * arr.length) | 0];

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  // No WebGL: the page's dark background stays and the story still reads.
  console.warn('Beer Money: WebGL unavailable', err);
}

if (renderer) init();

function init() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x07070a);

  const scene = new THREE.Scene();
  // Brown-grey smog, thick enough that the far end of the city goes murky.
  scene.fog = new THREE.FogExp2(0x0d0b0a, 0.0033);

  const camera = new THREE.PerspectiveCamera(50, 1, 1, 2000);
  const CAM_BASE = new THREE.Vector3(29, 30, 40);   // a high flat in a tower block, over a street
  const LOOK = new THREE.Vector3(29, 4, -400);
  camera.position.copy(CAM_BASE);
  camera.lookAt(LOOK);
  camera.updateMatrixWorld();

  // ---------- Sky: low overcast, stained orange by sodium streetlight ----------
  const skyMat = new THREE.ShaderMaterial({
    depthWrite: false,
    fog: false,
    side: THREE.BackSide,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 glow = vec3(0.3, 0.2, 0.12);
        vec3 high = vec3(0.025, 0.022, 0.024);
        vec3 col = mix(glow, high, pow(h, 0.28));
        // Lumpy cloud base catching the light.
        vec2 p = vDir.xz / max(vDir.y, 0.05) * 1.4;
        float n = noise(p) * 0.6 + noise(p * 2.7) * 0.4;
        col *= 0.8 + 0.4 * n * smoothstep(0.02, 0.3, h);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 16), skyMat);
  sky.renderOrder = -2;
  scene.add(sky);

  // ---------- Facade textures: wet sandstone, soot, shutters and tired windows ----------
  const TILE_W = 20, TILE_H = 56;      // world units one tile covers: 16 storeys of 3.5
  const WALL_UV = 0.004;               // a patch of bare wall in the tile's corner, used for flat roofs
  function windowTexture(opts) {
    const { cols, rows, lit, wall, shops } = opts;
    const c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = wall;
    g.fillRect(0, 0, c.width, c.height);

    // Blotchy soot and damp patches.
    for (let i = 0; i < 260; i++) {
      const r = rand(4, 40);
      g.fillStyle = random() < 0.75 ? `rgba(0,0,0,${rand(0.05, 0.25)})` : `rgba(80,70,50,${rand(0.03, 0.1)})`;
      g.beginPath();
      g.ellipse(rand(0, 256), rand(0, 512), r, r * rand(0.5, 1.6), 0, 0, Math.PI * 2);
      g.fill();
    }

    const cw = c.width / cols, ch = c.height / rows;
    for (let r = 0; r < rows; r++) {
      const shopRow = shops && r === rows - 1;   // the bottom row of the canvas is street level
      for (let k = 0; k < cols; k++) {
        if (shopRow) {
          // Shopfronts: mostly shuttered, a few still open, a sign above each.
          const x = k * cw + 2, y = r * ch + ch * 0.3, w = cw - 4, h = ch * 0.7;
          const open = random() < 0.3;
          g.fillStyle = open ? `rgba(255, ${(190 + rand(0, 50)) | 0}, 140, ${rand(0.5, 0.85)})` : `rgba(${(48 + rand(0, 20)) | 0}, ${(48 + rand(0, 20)) | 0}, 52, 0.95)`;
          g.fillRect(x, y, w, h);
          if (!open) {
            g.fillStyle = 'rgba(0,0,0,0.35)';
            for (let s = y; s < y + h; s += 3) g.fillRect(x, s, w, 1);
            // Graffiti on the shutter.
            if (random() < 0.6) {
              g.strokeStyle = pick(['rgba(190,60,70,0.5)', 'rgba(70,150,190,0.45)', 'rgba(220,220,220,0.35)', 'rgba(120,190,90,0.4)']);
              g.lineWidth = rand(1, 3);
              g.beginPath();
              g.moveTo(x + rand(0, w * 0.3), y + rand(h * 0.3, h * 0.8));
              for (let p = 0; p < 4; p++) g.lineTo(x + rand(0, w), y + rand(h * 0.2, h * 0.9));
              g.stroke();
            }
          }
          const sign = pick(['#c8463c', '#2f6a9a', '#d8b040', '#3c8a54', '#20201f', '#20201f']);
          g.fillStyle = sign;
          g.globalAlpha = random() < 0.3 ? 0.9 : 0.45;
          g.fillRect(x, r * ch + ch * 0.08, w, ch * 0.16);
          g.globalAlpha = 1;
          continue;
        }
        // Tall sash windows.
        const x = k * cw + cw * 0.26 + rand(-0.8, 0.8), y = r * ch + ch * 0.16;
        const w = cw * 0.48, h = ch * 0.62;
        const roll = random();
        if (roll < lit) {
          // Sodium orange, a fluorescent kitchen, or a bare bulb.
          const kind = random();
          const lum = rand(0.4, 0.9);
          g.fillStyle = kind < 0.55 ? `rgba(255, ${(150 + 50 * lum) | 0}, 70, ${lum})`
            : kind < 0.75 ? `rgba(${(180 + 40 * lum) | 0}, 230, ${(170 + 30 * lum) | 0}, ${lum * 0.75})`
            : `rgba(255, 235, 190, ${lum * 0.9})`;
          g.fillRect(x, y, w, h);
          if (random() < 0.55) {
            g.fillStyle = 'rgba(40, 24, 14, 0.6)';      // net curtains, half drawn
            g.fillRect(x, y, w * rand(0.25, 0.6), h);
          }
          g.fillStyle = 'rgba(0,0,0,0.5)';            // the sash bar
          g.fillRect(x, y + h * 0.48, w, 1.5);
        } else if (roll < lit + 0.05) {
          g.fillStyle = 'rgba(70, 90, 130, 0.25)';    // a telly
          g.fillRect(x, y, w, h);
        } else if (roll < lit + 0.11) {
          g.fillStyle = 'rgba(46, 36, 26, 0.95)';     // boarded up
          g.fillRect(x, y, w, h);
        } else {
          g.fillStyle = `rgba(${(8 + rand(0, 6)) | 0}, ${(9 + rand(0, 6)) | 0}, ${(12 + rand(0, 6)) | 0}, 0.92)`;
          g.fillRect(x, y, w, h);
        }
        // Rain streaks running down from the sill.
        if (random() < 0.4) {
          const grad = g.createLinearGradient(0, y + h, 0, y + h + ch * rand(0.5, 2));
          grad.addColorStop(0, 'rgba(0,0,0,0.45)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grad;
          g.fillRect(x + w * rand(0, 0.6), y + h, w * rand(0.15, 0.4), ch * 2);
        }
      }
    }
    // Soot thickening towards street level.
    const soot = g.createLinearGradient(0, 0, 0, 512);
    soot.addColorStop(0, 'rgba(0,0,0,0)');
    soot.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = soot;
    g.fillRect(0, 0, 256, 512);
    g.fillStyle = wall;
    g.fillRect(0, 0, 3, 3);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }
  // Tenement stone, then the concrete of the council towers.
  const FACADES = [
    { cols: 6, rows: 16, lit: 0.12, wall: '#3a231d', shops: true },   // red sandstone
    { cols: 6, rows: 16, lit: 0.1, wall: '#312b22', shops: true },   // blond sandstone
    { cols: 5, rows: 16, lit: 0.13, wall: '#2c1c16', shops: true },    // brick
    { cols: 6, rows: 16, lit: 0.06, wall: '#26262a', shops: false },  // grey harling
    { cols: 10, rows: 20, lit: 0.08, wall: '#232428', shops: false }, // tower block concrete
  ];
  const TERRACE = [0, 1, 2, 3], TOWER = 4;

  // Buildings that share a facade are merged into one mesh, so the whole
  // city is a handful of draw calls. UVs are scaled per building, so window
  // size stays the same on every face.
  const batches = FACADES.map(() => []);
  const solids = [];                   // wall and roof boxes, minX minY minZ maxX maxY maxZ, for sightlines
  const roofs = [];                     // slate roofs: part of the city's silhouette and occlusion
  const clutter = [];                   // chimney stacks, aerials, cranes
  const tops = [];                      // high points for the red warning lights

  function box(x, y0, z, w, h, d, facade, alignGround) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const cols = FACADES[facade].cols, rows = FACADES[facade].rows;
    const ou = Math.floor(random() * cols) / cols;
    // Terraces keep the shopfront row on the ground; towers can start anywhere.
    const ov = alignGround ? 0 : Math.floor(random() * rows) / rows;
    // BoxGeometry has 4 verts per face, in order +x, -x, +y, -y, +z, -z.
    for (let f = 0; f < 6; f++) {
      const span = f < 2 ? d : w;
      for (let i = f * 4; i < f * 4 + 4; i++) {
        if (f === 2 || f === 3) uv.setXY(i, WALL_UV, WALL_UV);
        else uv.setXY(i, ou + uv.getX(i) * span / TILE_W, ov + uv.getY(i) * h / TILE_H);
      }
    }
    g.translate(x, y0 + h / 2, z);
    batches[facade].push(g);
    solids.push(x - w / 2, y0, z - d / 2, x + w / 2, y0 + h, z + d / 2);
  }

  // A pitched slate roof along a terrace, ridge running the long way, with
  // chimney stacks on the ridge.
  function pitchedRoof(x, top, z, w, d, alongX) {
    const len = alongX ? w : d, span = alongX ? d : w;
    const rise = span * 0.26;
    const s = span / Math.SQRT2;
    const g = new THREE.BoxGeometry(len, s, s);
    g.rotateX(Math.PI / 4);
    g.scale(1, (rise * 2) / span, 1);
    if (!alongX) g.rotateY(Math.PI / 2);
    g.translate(x, top, z);
    roofs.push(g);
    solids.push(x - w / 2, top, z - d / 2, x + w / 2, top + rise, z + d / 2);
    for (let a = -len / 2 + rand(1, 3); a < len / 2 - 1; a += rand(5, 9)) {
      const cx = alongX ? x + a : x, cz = alongX ? z : z + a;
      const stack = new THREE.BoxGeometry(alongX ? 0.8 : 1.8, 1.6, alongX ? 1.8 : 0.8);
      stack.translate(cx, top + rise + 0.5, cz);
      clutter.push(stack);
      for (let p = 0; p < 3; p++) {
        const pot = new THREE.BoxGeometry(0.25, 0.5, 0.25);
        const off = (p - 1) * 0.5;
        pot.translate(cx + (alongX ? 0 : off), top + rise + 1.5, cz + (alongX ? off : 0));
        clutter.push(pot);
      }
    }
  }

  // A run of tenements along one side of a block, each close a slightly
  // different height and stone, like a street built up over decades.
  // Closes: the narrow passages between tenements in a row facing the view.
  // From low down these are the gaps between buildings you can see into.
  const closes = [];
  function terraceRow(x0, z0, length, depth, alongX, minH, maxH) {
    let a = 0, lowest = Infinity, highest = 0, prevH = 0, pending = null;
    while (a < length - 2) {
      if (alongX && prevH && random() < 0.55) {
        const cw = rand(4, 7.5);
        if (a + cw < length - 6) { pending = { x: x0 + a + cw / 2, z: z0, w: cw, prevH }; a += cw; }
      }
      const seg = Math.min(rand(8, 16), length - a);
      const storeys = Math.round(rand(minH, maxH));
      const h = storeys * 3.5 + 1;
      const cx = alongX ? x0 + a + seg / 2 : x0, cz = alongX ? z0 : z0 + a + seg / 2;
      const w = alongX ? seg : depth, d = alongX ? depth : seg;
      if (random() < 0.06) { a += seg; prevH = 0; pending = null; continue; }   // a gap site
      box(cx, 0, cz, w, h, d, pick(TERRACE), true);
      if (pending) {
        closes.push({ x: pending.x, z: pending.z, w: pending.w, axis: 'close', ceiling: Math.min(pending.prevH, h) * 0.95 });
        pending = null;
      }
      prevH = h;
      pitchedRoof(cx, h, cz, w, d, alongX);
      lowest = Math.min(lowest, h);
      highest = Math.max(highest, h + depth * 0.26 + 2);   // ridge plus chimneys
      a += seg;
    }
    return [lowest === Infinity ? 0 : lowest, highest];
  }

  function towerBlock(x, z) {
    const w = rand(16, 22), d = rand(12, 18), h = Math.round(rand(14, 22)) * 3 + 2;
    box(x, 0, z, w, h, d, TOWER, false);
    const plant = new THREE.BoxGeometry(w * 0.4, 3, d * 0.4);
    plant.translate(x, h + 1.5, z);
    clutter.push(plant);
    tops.push(new THREE.Vector3(x, h + 3.5, z));
    return h + 3;
  }

  function church(x, z) {
    const w = 12, d = 26, h = 16;
    box(x, 0, z, w, h, d, 1, false);
    pitchedRoof(x, h, z, w, d, false);
    const tw = 6, th = rand(30, 40);
    box(x, 0, z + d / 2 + tw / 2 - 1, tw, th, tw, 1, false);
    const spire = new THREE.ConeGeometry(tw * 0.62, rand(18, 28), 4);
    spire.rotateY(Math.PI / 4);
    spire.translate(x, th + 11, z + d / 2 + tw / 2 - 1);
    roofs.push(spire.toNonIndexed());
    return th;
  }

  function crane(x, z) {
    const h = rand(55, 75), jib = rand(35, 50), ang = rand(0, Math.PI * 2);
    const mast = new THREE.BoxGeometry(1.6, h, 1.6);
    mast.translate(x, h / 2, z);
    const arm = new THREE.BoxGeometry(jib, 1.2, 1.2);
    arm.translate(jib * 0.3, 0, 0);
    arm.rotateY(ang);
    arm.translate(x, h, z);
    clutter.push(mast, arm);
    tops.push(new THREE.Vector3(x, h + 2, z));
  }

  // ---------- The city: tenement blocks round back courts, out to the hills ----------
  // Wide-ish streets, so from up high you can see down into more of them.
  const BLOCK = 40, ROAD = 18, PITCH = BLOCK + ROAD, DEPTH = 11;
  const NX = 10, NZ = 16;
  // The river runs right in front of the view, so the far bank's terraces
  // face us across the water, every close and street mouth in sight.
  const RIVER_ROW = 0;
  const blockMin = new Map();           // lowest roofline on each block, keyed "bx,bz"
  const key = (bx, bz) => bx + ',' + bz;
  for (let bz = 0; bz < NZ; bz++) {
    for (let bx = -NX; bx <= NX; bx++) {
      const cx = bx * PITCH, cz = -30 - bz * PITCH;
      if (bz === RIVER_ROW) { blockMin.set(key(bx, bz), 0); continue; }
      // Keep the big stuff away from the camera's own street and the near rows.
      const clear = bz < 3 || (bx >= -1 && bx <= 2 && bz < 6);
      const roll = clear ? 1 : random();
      // Tower blocks, churches and gap sites stand in open ground, so the
      // streets beside them have no wall to keep a wisp in: their lowest is 0.
      let lowest = 0, highest = 0;
      if (roll < 0.07) {
        highest = towerBlock(cx + rand(-6, 6), cz + rand(-6, 6));
      } else if (roll < 0.1) {
        highest = church(cx, cz);
      } else if (roll < 0.14) {
        // A gap site: rubble, a hoarding and maybe a crane.
        if (random() < 0.5) crane(cx + rand(-10, 10), cz + rand(-10, 10));
      } else {
        // Four terraced sides round an open back court.
        const minH = 3, maxH = random() < 0.3 ? 4 : 5;
        const half = BLOCK / 2;
        const rows = [
          terraceRow(cx - half, cz + half - DEPTH / 2, BLOCK, DEPTH, true, minH, maxH),
          terraceRow(cx - half, cz - half + DEPTH / 2, BLOCK, DEPTH, true, minH, maxH),
          terraceRow(cx - half + DEPTH / 2, cz - half + DEPTH, BLOCK - DEPTH * 2, DEPTH, false, minH, maxH),
          terraceRow(cx + half - DEPTH / 2, cz - half + DEPTH, BLOCK - DEPTH * 2, DEPTH, false, minH, maxH),
        ];
        lowest = Math.min(...rows.map(r => r[0]));
        highest = Math.max(...rows.map(r => r[1]));
      }
      blockMin.set(key(bx, bz), lowest);
    }
  }
  // Further out: more towers and steeples poking above the murk.
  for (let i = 0; i < 26; i++) towerBlock(rand(-600, 600), rand(-860, -1050));
  for (let i = 0; i < 6; i++) church(rand(-500, 500), rand(-850, -1000));

  // Wisps live in the streets. Each street segment runs between two blocks,
  // and its ceiling sits below the lower of the two rooflines.
  const streets = [];
  for (let bz = 0; bz < NZ; bz++) {
    for (let bx = -NX; bx < NX; bx++) {
      const cx = bx * PITCH, cz = -30 - bz * PITCH;
      const ns = Math.min(blockMin.get(key(bx, bz)), blockMin.get(key(bx + 1, bz)));
      if (ns > 10) streets.push({ x: cx + PITCH / 2, z: cz, axis: 'z', ceiling: ns * 0.92 });
      if (bz > 0) {
        const ew = Math.min(blockMin.get(key(bx, bz)), blockMin.get(key(bx, bz - 1)));
        if (ew > 10) streets.push({ x: cx, z: cz + PITCH / 2, axis: 'x', ceiling: ew * 0.92 });
      }
    }
  }

  // The river runs between buildings too: wisps can drift over the water,
  // kept below the rooflines on either bank.
  for (let bx = -NX; bx <= NX; bx++) {
    const banks = Math.min(blockMin.get(key(bx, RIVER_ROW - 1)), blockMin.get(key(bx, RIVER_ROW + 1)));
    if (banks > 10) streets.push({ x: bx * PITCH, z: -30 - RIVER_ROW * PITCH + rand(-12, 12), axis: 'x', ceiling: banks * 0.92 });
  }

  streets.push(...closes);
  const SOLIDS = new Float32Array(solids);

  const city = new THREE.Group();
  FACADES.forEach((f, i) => {
    if (!batches[i].length) return;
    const geo = mergeGeometries(batches[i]);
    batches[i].forEach(g => g.dispose());
    city.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: windowTexture(f) })));
  });
  {
    const geo = mergeGeometries(roofs.map(g => {
      const n = g.index ? g.toNonIndexed() : g;
      n.deleteAttribute('uv');
      return n;
    }));
    // Lit, so the two slopes of each roof read differently.
    city.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x2c2f37 })));   // wet slate
  }
  scene.add(city);
  // Chimneys and cranes stay out of the city group: too thin to hide a wisp,
  // and leaving them out keeps the visibility raycasts cheap.
  scene.add(new THREE.Mesh(mergeGeometries(clutter), new THREE.MeshBasicMaterial({ color: 0x110d0b })));
  clutter.forEach(g => g.dispose());

  // Sodium glow from the streets below and a faint wash from the clouds.
  // The key light comes from behind, off the glow on the clouds, so the
  // gable ends facing us stay dark and the ridges catch a rim.
  scene.add(new THREE.HemisphereLight(0x5a5c66, 0x1a1410, 0.9));
  const sun = new THREE.DirectionalLight(0xffa868, 0.7);
  sun.position.set(-150, 140, -300);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshBasicMaterial({ color: 0x080706 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // ---------- The river: black water with the lights smeared across it ----------
  const riverZ = -30 - RIVER_ROW * PITCH;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, BLOCK + 6),
    new THREE.MeshBasicMaterial({ color: 0x0b0c10 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.2, riverZ);
  scene.add(water);
  {
    // Streaks of reflected light running across the water from the far bank,
    // where the lit shopfronts and windows are.
    const c = document.createElement('canvas');
    c.width = 16; c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(5, 0, 6, 128);
    const streakTex = new THREE.CanvasTexture(c);
    const streaks = [];
    for (let i = 0; i < 220; i++) {
      const len = rand(10, 32);
      const q = new THREE.PlaneGeometry(rand(0.4, 1.1), len);
      // Lying flat with its bright end on the far bank, and pointing at the
      // viewer, the way reflections on water always do.
      q.rotateX(-Math.PI / 2);
      q.translate(0, 0, len / 2);
      const x = rand(-300, 300), z = riverZ - (BLOCK / 2 + 2);
      q.rotateY(Math.atan2(CAM_BASE.x - x, CAM_BASE.z - z));
      q.translate(x, 0.3, z);
      streaks.push(q);
    }
    const mat = new THREE.MeshBasicMaterial({
      map: streakTex, color: 0xffa860, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    scene.add(new THREE.Mesh(mergeGeometries(streaks), mat));
  }
  // A couple of bridges across it.
  for (const bx of [-4, 3]) {
    const b = new THREE.BoxGeometry(ROAD + 4, 2.5, BLOCK + 8);
    b.translate(bx * PITCH + PITCH / 2, 3, riverZ);
    scene.add(new THREE.Mesh(b, new THREE.MeshBasicMaterial({ color: 0x14120f })));
  }

  // ---------- Hills beyond the city ----------
  {
    const g = new THREE.PlaneGeometry(3000, 200, 120, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0) {
        const x = pos.getX(i);
        pos.setY(i, 20 + 40 * Math.sin(x * 0.004 + 1.3) + 22 * Math.sin(x * 0.011 + 0.4) + 8 * Math.sin(x * 0.031));
      } else {
        pos.setY(i, -20);
      }
    }
    const hills = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x0a0908 }));
    hills.position.set(0, 0, -1150);
    scene.add(hills);
  }

  // ---------- Red warning lights on the tower blocks and cranes ----------
  function glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  const beaconMat = new THREE.PointsMaterial({
    map: glowTexture(), color: 0xff3a2a, size: 6, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(tops), beaconMat));

  // ---------- Rain, falling between the rooftop and the view ----------
  const RAIN = 2600;
  const RAIN_H = 50;
  const rainPos = new Float32Array(RAIN * 2 * 3);
  const rainSeed = new Float32Array(RAIN * 2);
  for (let i = 0; i < RAIN; i++) {
    const x = rand(-45, 45), y = rand(0, RAIN_H), z = rand(-30, 55), s = random();
    rainPos.set([x, y, z, x - 0.06, y + 1.1, z], i * 6);
    rainSeed[i * 2] = rainSeed[i * 2 + 1] = s;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rainGeo.setAttribute('seed', new THREE.BufferAttribute(rainSeed, 1));
  const rainMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uBase: { value: CAM_BASE.y - RAIN_H / 2 } },
    vertexShader: /* glsl */`
      attribute float seed;
      uniform float uTime;
      uniform float uBase;
      varying float vA;
      void main() {
        vec3 p = position;
        p.y = uBase + mod(p.y - uTime * (26.0 + seed * 10.0), ${RAIN_H.toFixed(1)});
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = (0.06 + 0.08 * seed) * smoothstep(85.0, 10.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() { gl_FragColor = vec4(0.7, 0.66, 0.6, vA); }`,
  });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  if (!reduceMotion) scene.add(rain);

  // ---------- Wisps ----------
  const wispVert = /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  const wispFrag = /* glsl */`
    uniform float uTime;
    uniform float uSeed;
    uniform float uFade;
    uniform float uDim;
    uniform vec3 uTint;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
                 mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
      return v;
    }

    void main() {
      float t = uTime * 0.55 + uSeed * 17.0;
      // Square local space; the head sits high on the 1x2 quad, the tail trails below.
      vec2 q = vec2(vUv.x - 0.5, (vUv.y - 0.7) * 2.0);
      float tailT = smoothstep(0.05, -1.25, q.y);
      q.x += (fbm(vec2(q.y * 2.2 - t, uSeed)) - 0.5) * 0.5 * tailT;
      q.x += sin(q.y * 5.0 + t * 1.7) * 0.05 * tailT;

      float r2 = dot(q, q);
      float inner = exp(-r2 * 38.0);
      float head = exp(-r2 * 11.0);
      float halo = exp(-r2 * 3.0) * 0.16;

      // A soft veil hanging from the head, streaked like smoke and pulled into a tail.
      float w = mix(0.24, 0.04, tailT);
      float body = exp(-(q.x * q.x) / (w * w))
                 * smoothstep(-1.35, -0.85, q.y) * smoothstep(0.3, -0.05, q.y);
      float streak = fbm(vec2(q.x * 7.0 + uSeed, q.y * 1.6 + t * 1.2));
      body *= 0.25 + 1.3 * streak * streak;

      float n = fbm(q * 3.0 + vec2(uSeed, -t * 0.8));
      float a = (head * 0.55 + halo + body * 0.8) * (0.45 + 0.8 * n) + inner * 0.3;
      // Materialise: the noise fills in as the wisp fades up, and breaks apart as it goes.
      a *= uFade * smoothstep(0.0, 0.35, n + uFade - 0.65);

      vec3 col = mix(uTint, vec3(1.0), clamp(inner * 1.2 + head * 0.3, 0.0, 1.0));
      vec2 e = smoothstep(0.0, 0.12, vUv) * smoothstep(1.0, 0.88, vUv);
      a *= e.x * e.y * uDim;
      gl_FragColor = vec4(col, a);
    }`;

  const wispGeo = new THREE.PlaneGeometry(1, 2);
  const TINTS = [new THREE.Color(0.55, 0.75, 1.0), new THREE.Color(0.7, 0.85, 1.0), new THREE.Color(0.45, 0.65, 1.0)];
  const wisps = [];
  const MAX_WISPS = innerWidth < 700 ? 26 : 44;
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();

  function makeWisp() {
    const mat = new THREE.ShaderMaterial({
      vertexShader: wispVert,
      fragmentShader: wispFrag,
      uniforms: {
        uTime: { value: 0 }, uSeed: { value: random() * 10 },
        uFade: { value: 0 }, uDim: { value: 1 }, uTint: { value: pick(TINTS).clone() },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(wispGeo, mat);
    mesh.visible = false;
    scene.add(mesh);
    const w = { mesh, mat, state: 'wait', t: 0, wait: rand(0, 4), pos: new THREE.Vector3(), vel: new THREE.Vector3() };
    wisps.push(w);
    return w;
  }

  // Is the line from the camera to p clear of every building? A slab test
  // against each wall and roof box: exact enough, and only run at spawn time.
  function canSee(p) {
    tmpA.copy(p).project(camera);
    if (Math.abs(tmpA.x) > 0.92 || Math.abs(tmpA.y) > 0.88 || tmpA.z > 1) return false;
    const o = camera.position;
    const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z;
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    for (let i = 0; i < SOLIDS.length; i += 6) {
      let t0 = 0, t1 = 0.999, a, b;
      a = (SOLIDS[i] - o.x) * ix; b = (SOLIDS[i + 3] - o.x) * ix;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) continue;
      a = (SOLIDS[i + 1] - o.y) * iy; b = (SOLIDS[i + 4] - o.y) * iy;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) continue;
      a = (SOLIDS[i + 2] - o.z) * iz; b = (SOLIDS[i + 5] - o.z) * iz;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 <= t1) return false;
    }
    return true;
  }

  function spawn(w) {
    let s, found = false;
    for (let tries = 0; tries < 150 && !found; tries++) {
      s = pick(streets);
      // The street the view looks down is the easiest to see into; cap it,
      // so the wisps spread out across the city.
      const onMain = o => o.street && o.street.axis === 'z' && Math.abs(o.street.x - CAM_BASE.x) < 1;
      if (onMain({ street: s }) && wisps.filter(o => o.state === 'live' && onMain(o)).length >= 6) continue;
      const along = rand(-0.4, 0.4) * BLOCK;
      // Sit towards the far side of the street and the upper part of the gap:
      // from a low viewpoint that's the bit you can see past the near roofs.
      const farSide = s.axis === 'x' ? -1 : Math.sign(s.x - CAM_BASE.x) || (random() < 0.5 ? -1 : 1);
      w.offset = farSide * rand(0.2, 1) * (ROAD / 2 - 3);
      // Bigger further off, so a wisp down the far end of a street still reads.
      const far = Math.hypot(s.x - CAM_BASE.x, s.z - CAM_BASE.z);
      w.size = THREE.MathUtils.clamp(far / 28, 6, 11) * rand(0.85, 1.1);
      if (s.axis === 'close') {
        // Fit the close: narrow, and standing at its mouth.
        w.offset = rand(-0.2, 0.2) * s.w;
        w.size = THREE.MathUtils.clamp(s.w * 1.5, 4.5, 9);
      }
      // Keep the whole wisp, head and halo, below the street's ceiling.
      w.ceiling = s.ceiling - w.size * 0.75;
      if (w.ceiling < 4) continue;
      if (s.axis === 'close') {
        w.pos.set(s.x + w.offset, rand(Math.max(3, w.ceiling * 0.4), w.ceiling), s.z + rand(0, DEPTH / 2 - 1.5));
      } else {
        w.pos.set(
          s.axis === 'z' ? s.x + w.offset : s.x + along,
          rand(Math.max(3, w.ceiling * 0.6), w.ceiling),
          s.axis === 'z' ? s.z + along : s.z + w.offset
        );
      }
      // Check the head, the brightest part, rather than the trailing tail.
      tmpB.copy(w.pos);
      tmpB.y += w.size * 0.4;
      // Not on top of another wisp.
      found = canSee(tmpB) && !wisps.some(o => o !== w && o.state === 'live' && o.pos.distanceTo(w.pos) < 12);
    }
    if (!found) { w.state = 'wait'; w.wait = rand(0.2, 0.6); return; }
    w.street = s;
    // Drift along the street, never across it into the buildings; in a
    // close there's nowhere to go but a slow rise and fall.
    const drift = s.axis === 'close' ? 0 : (reduceMotion ? 0.3 : rand(1.2, 3)) * (random() < 0.5 ? -1 : 1);
    w.vel.set(s.axis === 'x' ? drift : 0, rand(-0.3, 0.6) * (reduceMotion ? 0.2 : 1), s.axis === 'z' ? drift : 0);
    w.life = rand(6, 13);
    w.fadeIn = rand(1.8, 3.2);
    w.fadeOut = rand(2.2, 3.8);
    w.flicker = rand(0.6, 1.6);
    w.t = 0;
    w.state = 'live';
    w.mat.uniforms.uSeed.value = random() * 10;
    w.mat.uniforms.uTint.value.copy(pick(TINTS));
  }

  for (let i = 0; i < MAX_WISPS; i++) makeWisp();

  // ---------- Frame loop ----------
  const clock = new THREE.Clock();

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Tall screens get a wider vertical view so the skyline still spans the width.
    camera.fov = w / h < 0.8 ? 72 : 50;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  function updateWisp(w, dt, time) {
    if (w.state === 'wait') {
      w.wait -= dt;
      // A couple of spawns a frame at most: each one tests a lot of sightlines.
      if (w.wait <= 0 && spawnBudget > 0) { spawnBudget--; spawn(w); }
      w.mesh.visible = false;
      return;
    }
    w.t += dt;
    if (w.t >= w.life) {
      w.state = 'wait';
      w.wait = rand(0.3, 2.5);
      return;
    }
    w.mesh.visible = true;

    // Drift with a slow, sinuous wander, held inside the street.
    const k = w.mat.uniforms.uSeed.value;
    const s = w.street;
    const sway = Math.sin(time * 0.8 + k) * 0.6 * (reduceMotion ? 0.1 : 1);
    w.pos.addScaledVector(w.vel, dt);
    w.pos.y += Math.sin(time * 0.9 + k * 2.0) * 0.8 * dt;
    if (s.axis === 'close') w.pos.x = s.x + w.offset + sway * 0.25;
    else if (s.axis === 'z') w.pos.x = s.x + w.offset + sway;
    else w.pos.z = s.z + w.offset + sway;
    if (w.pos.y > w.ceiling) { w.pos.y = w.ceiling; w.vel.y = -Math.abs(w.vel.y); }
    if (w.pos.y < 3) { w.pos.y = 3; w.vel.y = Math.abs(w.vel.y); }

    let fade = Math.min(1, w.t / w.fadeIn, (w.life - w.t) / w.fadeOut);
    fade = fade * fade * (3 - 2 * fade);
    const breath = 0.82 + 0.18 * Math.sin(time * w.flicker * 2.0 + k * 3.0);
    const dist = camera.position.distanceTo(w.pos);
    const dim = THREE.MathUtils.clamp(1.3 - dist / 650, 0.3, 1);
    const grow = 0.75 + 0.25 * fade;

    const u = w.mat.uniforms;
    u.uTime.value = time;
    u.uFade.value = fade * breath;
    u.uDim.value = dim;

    // Pull the quad towards the camera along its line of sight, so the walls
    // either side of the street don't slice through it; shrink it to match,
    // so it looks the same size in the same place.
    const pull = Math.min(w.size * 1.5, dist * 0.15);
    const shrink = (dist - pull) / dist;
    tmpB.copy(camera.position).sub(w.pos).normalize();
    w.mesh.position.copy(w.pos).addScaledVector(tmpB, pull);
    w.mesh.scale.set(w.size * grow * shrink, w.size * grow * shrink, 1);
    // Face the camera, then roll so the tail trails behind the direction of travel.
    tmpA.copy(w.pos).project(camera);
    tmpB.copy(w.pos).add(w.vel).project(camera);
    const roll = Math.atan2(tmpB.y - tmpA.y, (tmpB.x - tmpA.x) * camera.aspect) - Math.PI / 2;
    w.mesh.quaternion.copy(camera.quaternion);
    w.mesh.rotateZ(THREE.MathUtils.clamp(roll, -0.9, 0.9));
  }

  let spawnBudget = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    spawnBudget = 2;
    const time = clock.elapsedTime;

    if (!reduceMotion) {
      camera.position.set(
        CAM_BASE.x + Math.sin(time * 0.08) * 1.5,
        CAM_BASE.y + Math.sin(time * 0.13) * 0.4,
        CAM_BASE.z
      );
      camera.lookAt(LOOK);
      rainMat.uniforms.uTime.value = time;
    }

    // Warning lights pulse together, slowly.
    beaconMat.opacity = 0.15 + 0.75 * Math.max(0, Math.sin(time * 1.6)) ** 3;

    for (const w of wisps) updateWisp(w, dt, time);
    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(frame);
  requestAnimationFrame(() => canvas.classList.add('on'));
}
