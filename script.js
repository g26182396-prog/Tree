const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const labelEl = document.getElementById('label');
const labelWrapEl = document.querySelector('.label-wrap');
const replayBtn = document.getElementById('replayBtn');

let W, H, cx, groundY, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx = W / 2;
  groundY = H * 0.78;
}
resize();
window.addEventListener('resize', () => { resize(); init(); });

const HEART_COLORS = [
  '#FF4081', '#FF6B9D', '#FF1744', '#E91E63',
  '#FF80AB', '#F50057', '#FF5C8A', '#FF8DC7'
];
const LEAF_COLORS = [
  '#FF4081', '#FF6B9D', '#FF80AB', '#FFB3C6',
  '#FF1744', '#E91E63', '#FF5C8A', '#FF8DC7'
];
const TRUNK_TOP = '#A1887F';
const TRUNK_BOT = '#4E342E';
const BRANCH_LIGHT = '#9C7B6B';
const BRANCH_DARK = '#5D4037';
const ROOT_COLOR = 'rgba(78,52,46,0.45)';
const GROUND_COLOR = '#81C784';
const GRASS_COLOR = '#A5D6A7';
const SKY_TOP = '#fff9f0';
const SKY_MID = '#ffe0ee';
const SKY_BOT = '#c8f5c8';
const SPARKLE_COLOR = '#FFF3CD';

let phase = 0;
let frameCount = 0;
let fallingHearts = [];
let pileHearts = [];
let branchSegs = [];
let leaves = [];
let leafTargets = [];
let leafSpawnIdx = 0;
let leafSpawnTimer = 0;
let trunkProgress = 0;
let holdTimer = 0;
let glowPulse = 0;
let phaseTimer = 0;
let sparkles = [];
let sparkleTimer = 0;
let canopyRadius = 0;
let firstLoopDone = false;

const ENDING_LINES = [
  'Every heart found its way home...',
  '...and grew into us.',
  'I love you ♡'
];
let endingStage = 0;
let endingCharIdx = 0;
let endingTimer = 0;
let endingState = 'typing';

let bigHeartScale = 0;
let bigHeartSize = 0;
let bigHeartX = 0;
let bigHeartY = 0;


function heartPath(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.3);
  ctx.bezierCurveTo(x, y, x - size * 0.5, y, x - size * 0.5, y + size * 0.3);
  ctx.bezierCurveTo(x - size * 0.5, y + size * 0.65, x, y + size * 0.9, x, y + size * 1.1);
  ctx.bezierCurveTo(x, y + size * 0.9, x + size * 0.5, y + size * 0.65, x + size * 0.5, y + size * 0.3);
  ctx.bezierCurveTo(x + size * 0.5, y, x, y, x, y + size * 0.3);
  ctx.closePath();
}

function leafShapePath(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x + size * 0.62, y - size * 0.25, x, y + size * 0.55);
  ctx.quadraticCurveTo(x - size * 0.62, y - size * 0.25, x, y - size);
  ctx.closePath();
}

function shapePath(shape, ctx, x, y, size) {
  if (shape === 'leaf') leafShapePath(ctx, x, y, size);
  else heartPath(ctx, x, y - size * 0.5, size);
}

function drawBigHeart(extraMul) {
  if (bigHeartScale <= 0.001) return;
  const size = bigHeartSize * bigHeartScale;
  const topY = bigHeartY - size * 0.55;
  const pulse = 0.5 + Math.sin(glowPulse) * 0.5;
  const alpha = bigHeartScale * (0.10 + pulse * 0.06) * (extraMul == null ? 1 : extraMul);
  if (alpha <= 0.001) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  const grad = ctx.createRadialGradient(
    bigHeartX, bigHeartY - size * 0.15, size * 0.05,
    bigHeartX, bigHeartY, size * 0.78
  );
  grad.addColorStop(0, '#FFE3EF');
  grad.addColorStop(0.5, '#FF8DC7');
  grad.addColorStop(1, '#FF4081');
  ctx.fillStyle = grad;
  heartPath(ctx, bigHeartX, topY, size);
  ctx.fill();
  ctx.restore();
}

function setLabel(text, show) {
  labelEl.textContent = text;
  labelEl.classList.toggle('visible', show);
}

function jitter(v, amt) { return v + (Math.random() - 0.5) * amt; }

function updateEndingText() {
  const line = ENDING_LINES[endingStage];
  const isLastLine = endingStage === ENDING_LINES.length - 1;

  if (endingState === 'typing') {
    endingTimer++;
    if (endingTimer % 3 === 0 && endingCharIdx < line.length) endingCharIdx++;
    labelEl.textContent = line.slice(0, endingCharIdx);
    labelEl.classList.add('visible');
    labelEl.style.textShadow = '';
    if (endingCharIdx >= line.length) { endingState = 'hold'; endingTimer = 0; }
  } else if (endingState === 'hold') {
    endingTimer++;
    if (isLastLine) {
      const glowAmt = 0.5 + Math.sin(glowPulse) * 0.25;
      const blurAmt = 18 + Math.sin(glowPulse) * 6;
      labelEl.style.textShadow =
        `0 0 ${blurAmt}px rgba(255,100,150,${glowAmt}), 0 2px 8px rgba(255,255,255,0.8)`;
    } else if (endingTimer > 55) {
      endingState = 'fadeout';
      endingTimer = 0;
      labelEl.classList.remove('visible');
    }
  } else if (endingState === 'fadeout') {
    endingTimer++;
    if (endingTimer > 50) {
      endingStage++;
      endingCharIdx = 0;
      endingState = 'typing';
      endingTimer = 0;
      labelEl.textContent = '';
    }
  }
}

function withSway(fn) {
  const sway = Math.sin(glowPulse * 0.4) * 0.012;
  ctx.save();
  ctx.translate(cx, groundY);
  ctx.rotate(sway);
  ctx.translate(-cx, -groundY);
  fn();
  ctx.restore();
}

function getTrunkH() {
  const base = Math.min(H * 0.40, W * 0.55, 360);
  return Math.max(base, 120);
}
function getTrunkW() {
  return Math.max(9, Math.min(W, H) * 0.026);
}

function getBranchDefs() {
  const th = getTrunkH();
  return [
    {
      frac: 1.0, angle: jitter(-Math.PI / 2, 0.06), len: th * (0.55 + Math.random() * 0.06), children: [
        {
          frac: 0.55, angle: jitter(-Math.PI / 2 - 0.55, 0.12), len: th * (0.28 + Math.random() * 0.05), children: [
            { frac: 1.0, angle: jitter(-Math.PI / 2 - 0.9, 0.12), len: th * 0.16 }
          ]
        },
        {
          frac: 0.55, angle: jitter(-Math.PI / 2 + 0.55, 0.12), len: th * (0.28 + Math.random() * 0.05), children: [
            { frac: 1.0, angle: jitter(-Math.PI / 2 + 0.9, 0.12), len: th * 0.16 }
          ]
        },
        { frac: 1.0, angle: jitter(-Math.PI / 2 - 0.22, 0.1), len: th * 0.22 },
        { frac: 1.0, angle: jitter(-Math.PI / 2 + 0.22, 0.1), len: th * 0.22 },
      ]
    },
    {
      frac: 0.72, angle: jitter(-Math.PI / 2 - 0.75, 0.1), len: th * (0.40 + Math.random() * 0.05), children: [
        { frac: 0.6, angle: jitter(-Math.PI / 2 - 1.05, 0.12), len: th * 0.22 },
        { frac: 1.0, angle: jitter(-Math.PI / 2 - 0.5, 0.1), len: th * 0.20 },
      ]
    },
    {
      frac: 0.72, angle: jitter(-Math.PI / 2 + 0.75, 0.1), len: th * (0.40 + Math.random() * 0.05), children: [
        { frac: 0.6, angle: jitter(-Math.PI / 2 + 1.05, 0.12), len: th * 0.22 },
        { frac: 1.0, angle: jitter(-Math.PI / 2 + 0.5, 0.1), len: th * 0.20 },
      ]
    },
    {
      frac: 0.48, angle: jitter(-Math.PI / 2 - 1.05, 0.08), len: th * 0.32, children: [
        { frac: 1.0, angle: jitter(-Math.PI / 2 - 0.85, 0.1), len: th * 0.18 },
      ]
    },
    {
      frac: 0.48, angle: jitter(-Math.PI / 2 + 1.05, 0.08), len: th * 0.32, children: [
        { frac: 1.0, angle: jitter(-Math.PI / 2 + 0.85, 0.1), len: th * 0.18 },
      ]
    },
  ];
}

function flattenBranches() {
  const th = getTrunkH();
  const segs = [];

  function add(bx, by, angle, len, depth, def) {
    const ex = bx + Math.cos(angle) * len;
    const ey = by + Math.sin(angle) * len;
    segs.push({
      x1: bx, y1: by, x2: ex, y2: ey, depth, progress: 0,
      bend: (Math.random() - 0.5) * len * 0.22
    });
    if (def && def.children) {
      def.children.forEach(ch => {
        const chx = bx + Math.cos(angle) * len * ch.frac;
        const chy = by + Math.sin(angle) * len * ch.frac;
        add(chx, chy, ch.angle, ch.len, depth + 1, ch);
      });
    }
  }

  getBranchDefs().forEach(b => {
    const startY = groundY - th * b.frac;
    add(cx, startY, b.angle, b.len, 1, b);
  });

  let minX = Infinity, maxX = -Infinity, minY = Infinity;
  segs.forEach(s => {
    minX = Math.min(minX, s.x1, s.x2);
    maxX = Math.max(maxX, s.x1, s.x2);
    minY = Math.min(minY, s.y1, s.y2);
  });
  const spread = maxX - minX;
  const maxAllowed = W * 0.9;
  if (spread > maxAllowed) {
    const scale = maxAllowed / spread;
    segs.forEach(s => {
      s.x1 = cx + (s.x1 - cx) * scale;
      s.x2 = cx + (s.x2 - cx) * scale;
    });
  }
  canopyRadius = Math.max(60, (groundY - minY) * 0.55);
  return segs;
}

function buildLeafTargets(segs) {
  const targets = [];
  segs.forEach(seg => {
    const clustered = seg.depth >= 2;
    const count = clustered ? 9 : 5;
    for (let i = 0; i < count; i++) {
      const t = clustered ? (0.5 + Math.random() * 0.55) : (0.4 + Math.random() * 0.6);
      const spread = clustered ? 32 : 22;
      targets.push({
        x: seg.x1 + (seg.x2 - seg.x1) * t + (Math.random() - 0.5) * spread,
        y: seg.y1 + (seg.y2 - seg.y1) * t + (Math.random() - 0.5) * spread,
        color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
        shape: Math.random() < 0.28 ? 'leaf' : 'heart',
        depthLayer: Math.random()
      });
    }
  });
  targets.sort((a, b) => a.depthLayer - b.depthLayer);
  return targets;
}

class FallingHeart {
  constructor() { this.reset(true); }

  reset(fromTop) {
    this.x = cx + (Math.random() - 0.5) * W * 0.8;
    this.y = fromTop ? -30 - Math.random() * H * 0.5 : -30;
    this.size = 12 + Math.random() * 24;
    this.vy = 1.8 + Math.random() * 2.2;
    this.vx = (Math.random() - 0.5) * 1.0;
    this.rot = (Math.random() - 0.5) * 0.6;
    this.rotV = (Math.random() - 0.5) * 0.04;
    this.alpha = 0.75 + Math.random() * 0.25;
    this.color = HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)];
    this.landed = false;
    this.landY = groundY - 8 - Math.random() * 20;
    this.wobble = Math.random() * Math.PI * 2;
  }

  update() {
    if (this.landed) return;
    this.wobble += 0.05;
    this.x += this.vx + Math.sin(this.wobble) * 0.4;
    this.y += this.vy;
    this.vy += 0.09;
    this.rot += this.rotV;
    if (this.y >= this.landY) {
      this.y = this.landY;
      this.landed = true;
      pileHearts.push({
        x: this.x, y: this.y,
        size: this.size * 0.82,
        rot: this.rot,
        color: this.color,
        alpha: 0.9
      });
    }
  }

  draw() {
    if (this.landed) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    heartPath(ctx, 0, -this.size * 0.5, this.size);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.globalAlpha = 0.25;
    heartPath(ctx, -this.size * 0.08, -this.size * 0.55, this.size * 0.5);
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    ctx.fill();
    ctx.restore();
  }
}

class Leaf {
  constructor(sx, sy, tx, ty, color, shape) {
    this.x = sx; this.y = sy;
    this.tx = tx; this.ty = ty;
    this.size = 8 + Math.random() * 13;
    this.color = color;
    this.shape = shape || 'heart';
    this.rot = Math.random() * Math.PI * 2;
    this.rotV = (Math.random() - 0.5) * 0.025;
    this.alpha = 0;
    this.arrived = false;
    this.sway = Math.random() * Math.PI * 2;
    this.swayAmp = 1.5 + Math.random() * 2.5;
    this.detaching = false;
    this.vx = 0; this.vy = 0;
  }

  update() {
    if (this.detaching) {
      this.vx += (Math.random() - 0.5) * 0.5;
      this.vy -= 0.5 + Math.random() * 0.5;
      this.x += this.vx;
      this.y += this.vy;
      this.rot += this.rotV * 4;
      this.alpha -= 0.014;
      return;
    }
    if (!this.arrived) {
      this.x += (this.tx - this.x) * 0.045;
      this.y += (this.ty - this.y) * 0.045;
      this.alpha = Math.min(1, this.alpha + 0.035);
      if (Math.abs(this.x - this.tx) < 1.5 && Math.abs(this.y - this.ty) < 1.5) {
        this.x = this.tx; this.y = this.ty; this.arrived = true;
      }
    } else {
      this.sway += 0.022;
      this.x = this.tx + Math.sin(this.sway) * this.swayAmp;
      this.rot += this.rotV;
    }
  }

  draw(glowAmt) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    shapePath(this.shape, ctx, 0, 0, this.size);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = glowAmt || 6;
    ctx.fill();
    ctx.globalAlpha = this.alpha * 0.3;
    shapePath(this.shape, ctx, -this.size * 0.1, -this.size * 0.18, this.size * 0.45);
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    ctx.fill();
    ctx.restore();
  }
}

class Sparkle {
  constructor() { this.reset(); }
  reset() {
    const ang = Math.random() * Math.PI * 2;
    const r = Math.random() * canopyRadius;
    this.x = cx + Math.cos(ang) * r;
    this.y = (groundY - getTrunkH()) + Math.sin(ang) * r * 0.6;
    this.size = 1.2 + Math.random() * 2;
    this.life = 0;
    this.maxLife = 60 + Math.random() * 60;
  }
  update() { this.life++; }
  get alpha() {
    const p = this.life / this.maxLife;
    return p < 1 ? Math.sin(p * Math.PI) : 0;
  }
  draw() {
    const a = this.alpha;
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = SPARKLE_COLOR;
    ctx.shadowColor = SPARKLE_COLOR;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}


function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(0.45, SKY_MID);
  grad.addColorStop(0.75, '#d4f5d4');
  grad.addColorStop(1, SKY_BOT);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawGrass() {
  const grd = ctx.createLinearGradient(0, groundY - 10, 0, H);
  grd.addColorStop(0, '#81C784');
  grd.addColorStop(0.3, '#66BB6A');
  grd.addColorStop(1, '#43A047');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(W, groundY);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < W; i += 14) {
    const h2 = 6 + Math.sin(i * 0.3) * 3;
    const gx = i, gy = groundY + 4;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.quadraticCurveTo(gx + 4, gy - h2 * 0.5, gx + (Math.sin(i) * 5), gy - h2);
    ctx.stroke();
  }
}

function drawFlowers() {
  const positions = [cx - W * 0.28, cx - W * 0.14, cx + W * 0.14, cx + W * 0.28];
  const fColors = ['#FF80AB', '#FFD54F', '#80DEEA', '#CF94DA'];
  positions.forEach((fx, i) => {
    const fy = groundY - 2;
    const r = 5 + Math.sin(glowPulse + i) * 1;
    for (let p = 0; p < 5; p++) {
      const angle = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(angle) * r, fy - 15 + Math.sin(angle) * r, 4, 0, Math.PI * 2);
      ctx.fillStyle = fColors[i % fColors.length];
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(fx, fy - 15, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF9C4';
    ctx.fill();
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx, fy - 12);
    ctx.stroke();
  });
}

function drawClouds() {
  const clouds = [
    { x: W * 0.15, y: H * 0.08, s: 1.0 },
    { x: W * 0.75, y: H * 0.06, s: 0.8 },
    { x: W * 0.45, y: H * 0.12, s: 0.65 },
  ];
  clouds.forEach(cl => {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#fff';
    const ox = Math.sin(glowPulse * 0.15 + cl.y) * 8;
    const x = cl.x + ox, y = cl.y, s = cl.s;
    ctx.beginPath();
    ctx.arc(x, y, 28 * s, 0, Math.PI * 2);
    ctx.arc(x + 32 * s, y - 8 * s, 22 * s, 0, Math.PI * 2);
    ctx.arc(x + 58 * s, y, 26 * s, 0, Math.PI * 2);
    ctx.arc(x + 20 * s, y + 12 * s, 20 * s, 0, Math.PI * 2);
    ctx.arc(x + 44 * s, y + 12 * s, 18 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawPile() {
  pileHearts.forEach(h => {
    if (h.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = h.alpha;
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rot);
    heartPath(ctx, 0, -h.size * 0.5, h.size);
    ctx.fillStyle = h.color;
    ctx.shadowColor = h.color;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();
  });
}

function drawTreeShadow() {
  if (canopyRadius <= 0) return;
  ctx.save();
  const grad = ctx.createRadialGradient(cx, groundY + 6, 2, cx, groundY + 6, canopyRadius);
  grad.addColorStop(0, 'rgba(0,0,0,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 6, canopyRadius, canopyRadius * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRootFlare() {
  const tw = getTrunkW();
  ctx.save();
  ctx.strokeStyle = ROOT_COLOR;
  ctx.lineWidth = Math.max(2, tw * 0.2);
  ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    const spread = tw * 1.4 * Math.abs(i);
    ctx.beginPath();
    ctx.moveTo(cx, groundY - 2);
    ctx.quadraticCurveTo(cx + i * spread * 0.5, groundY + 4, cx + i * spread, groundY + 9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTrunk(prog) {
  const th = getTrunkH();
  const tw = getTrunkW();
  const drawH = th * Math.min(1, prog);
  drawRootFlare();
  const grad = ctx.createLinearGradient(cx - tw, groundY, cx + tw, groundY - drawH);
  grad.addColorStop(0, TRUNK_BOT);
  grad.addColorStop(1, TRUNK_TOP);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(cx - tw / 2, groundY - drawH, tw, drawH, [tw * 0.4, tw * 0.4, 0, 0]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const ly = groundY - drawH * (i / 5);
    if (ly > groundY - drawH) continue;
    ctx.beginPath();
    ctx.moveTo(cx - tw / 2 + 2, ly);
    ctx.bezierCurveTo(cx, ly + 4, cx, ly - 4, cx + tw / 2 - 2, ly);
    ctx.stroke();
  }
}

function drawBranches(segs) {
  segs.forEach(seg => {
    if (seg.progress <= 0) return;
    const t = Math.min(1, seg.progress);
    const ex = seg.x1 + (seg.x2 - seg.x1) * t;
    const ey = seg.y1 + (seg.y2 - seg.y1) * t;
    const baseW = Math.max(1.6, getTrunkW() * 0.55 / seg.depth);
    const tipW = baseW * 0.5;
    const bend = (seg.bend || 0) * t;

    const dx0 = ex - seg.x1, dy0 = ey - seg.y1;
    const len0 = Math.hypot(dx0, dy0) || 1;
    const nx0 = -dy0 / len0, ny0 = dx0 / len0;
    const cxp = (seg.x1 + ex) / 2 + nx0 * bend;
    const cyp = (seg.y1 + ey) / 2 + ny0 * bend;

    const STEPS = 7;
    const left = [], right = [];
    for (let i = 0; i <= STEPS; i++) {
      const u = i / STEPS;
      const qx = (1 - u) * (1 - u) * seg.x1 + 2 * (1 - u) * u * cxp + u * u * ex;
      const qy = (1 - u) * (1 - u) * seg.y1 + 2 * (1 - u) * u * cyp + u * u * ey;
      const w = (baseW + (tipW - baseW) * u) / 2;
      const dxu = 2 * (1 - u) * (cxp - seg.x1) + 2 * u * (ex - cxp);
      const dyu = 2 * (1 - u) * (cyp - seg.y1) + 2 * u * (ey - cyp);
      const dl = Math.hypot(dxu, dyu) || 1;
      const lnx = -dyu / dl, lny = dxu / dl;
      left.push([qx + lnx * w, qy + lny * w]);
      right.push([qx - lnx * w, qy - lny * w]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    left.forEach(p => ctx.lineTo(p[0], p[1]));
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    const grad = ctx.createLinearGradient(seg.x1, seg.y1, ex, ey);
    grad.addColorStop(0, BRANCH_DARK);
    grad.addColorStop(1, BRANCH_LIGHT);
    ctx.fillStyle = grad;
    ctx.fill();
  });
}

function drawCanopyGlow(segs) {
  const tips = segs.filter(s => s.depth >= 2 && s.progress >= 1);
  if (!tips.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  tips.forEach(s => {
    const r = 38;
    const grad = ctx.createRadialGradient(s.x2, s.y2, 0, s.x2, s.y2, r);
    grad.addColorStop(0, 'rgba(255,150,180,0.16)');
    grad.addColorStop(1, 'rgba(255,150,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x2, s.y2, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawSunrays() {
  const sx = W * 0.88, sy = H * 0.08;
  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + glowPulse * 0.3;
    const len = 60 + Math.sin(glowPulse + i) * 15;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
    ctx.strokeStyle = '#FFD54F';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(sx, sy, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#FFD54F';
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.restore();
}

function init() {
  phase = 0; phaseTimer = 0; frameCount = 0;
  endingStage = 0; endingCharIdx = 0; endingTimer = 0; endingState = 'typing';
  labelEl.style.textShadow = '';
  labelEl.classList.remove('big');
  labelWrapEl.classList.remove('centered');
  bigHeartScale = 0; bigHeartSize = 0;
  fallingHearts = Array.from({ length: 16 }, () => {
    const h = new FallingHeart();
    h.y = -30 - Math.random() * H * 0.7;
    return h;
  });
  pileHearts = [];
  branchSegs = [];
  leaves = [];
  leafTargets = [];
  leafSpawnIdx = 0;
  leafSpawnTimer = 0;
  trunkProgress = 0;
  holdTimer = 0;
  glowPulse = 0;
  sparkles = [];
  sparkleTimer = 0;
  canopyRadius = 0;
  setLabel('', false);
  replayBtn.classList.remove('visible');
}

replayBtn.addEventListener('click', () => {
  replayBtn.classList.remove('visible');
  init();
});

function loop() {
  requestAnimationFrame(loop);
  ctx.clearRect(0, 0, W, H);
  glowPulse += 0.028;
  frameCount++;

  drawBackground();
  drawSunrays();
  drawClouds();
  drawGrass();
  drawFlowers();

  if (phase === 0) {
    phaseTimer++;
    if (frameCount % 16 === 0 && fallingHearts.filter(h => !h.landed).length < 20) {
      fallingHearts.push(new FallingHeart());
    }
    fallingHearts.forEach(h => h.update());
    drawPile();
    fallingHearts.forEach(h => h.draw());
    if (pileHearts.length >= 30 || phaseTimer > 300) {
      phase = 1; phaseTimer = 0;
      setLabel('', false);
      branchSegs = flattenBranches();
    }
  }


  else if (phase === 1) {
    phaseTimer++;
    trunkProgress += 0.014;
    drawPile();
    withSway(() => drawTrunk(trunkProgress));
    if (trunkProgress >= 1) {
      phase = 2; phaseTimer = 0;
      branchSegs.forEach(s => s.progress = 0);
      leafTargets = buildLeafTargets(branchSegs);
      setLabel('', false);
    }
  }

  else if (phase === 2) {
    phaseTimer++;
    let allBranchesDone = true;
    branchSegs.forEach((seg, i) => {
      if (phaseTimer > i * 10) seg.progress = Math.min(1, seg.progress + 0.03);
      if (seg.progress < 1) allBranchesDone = false;
    });

    withSway(() => {
      drawTreeShadow();
      drawTrunk(1);
      drawBranches(branchSegs);
      drawCanopyGlow(branchSegs);
    });

    pileHearts.forEach(h => { h.alpha = Math.max(0, h.alpha - 0.011); });
    drawPile();

    leafSpawnTimer++;
    if (leafSpawnTimer % 3 === 0 && leafSpawnIdx < leafTargets.length) {
      const tgt = leafTargets[leafSpawnIdx];
      const src = pileHearts[Math.floor(Math.random() * Math.max(1, pileHearts.length))] || { x: cx, y: groundY };
      leaves.push(new Leaf(src.x, src.y, tgt.x, tgt.y, tgt.color, tgt.shape));
      leafSpawnIdx++;
    }

    withSway(() => {
      leaves.forEach(l => l.update());
      leaves.forEach(l => l.draw(8));
    });

    if (allBranchesDone && leafSpawnIdx >= leafTargets.length && leaves.every(l => l.arrived)) {
      phase = 3; phaseTimer = 0; holdTimer = 0;

      bigHeartScale = 0;
      bigHeartX = cx;
      bigHeartY = groundY - getTrunkH() - canopyRadius * 0.4;
      const minSide = Math.min(W, H);
      bigHeartSize = Math.max(minSide * 0.45, Math.min(canopyRadius * 2.3, minSide * 0.95));

      labelWrapEl.classList.add('centered');
      labelEl.classList.add('big');
    }
  }

  else if (phase === 3) {
    holdTimer++;
    sparkleTimer++;
    if (sparkleTimer % 14 === 0 && sparkles.length < 18) sparkles.push(new Sparkle());
    sparkles.forEach(s => s.update());
    sparkles = sparkles.filter(s => s.life < s.maxLife);

    withSway(() => {
      drawTreeShadow();
      drawTrunk(1);
      drawBranches(branchSegs);
      drawCanopyGlow(branchSegs);
      const glow = 10 + Math.sin(glowPulse) * 7;
      leaves.forEach(l => {
        l.sway += 0.02;
        l.x = l.tx + Math.sin(l.sway) * l.swayAmp;
        l.rot += l.rotV;
        l.draw(glow);
      });
      sparkles.forEach(s => s.draw());
    });

    bigHeartScale += (1 - bigHeartScale) * 0.07;
    drawBigHeart();

    updateEndingText();
    const endingFinished = endingStage === ENDING_LINES.length - 1 && endingState === 'hold';

    if (!firstLoopDone) {
      if (endingFinished && endingTimer > 90) {
        firstLoopDone = true;
        phase = 4; phaseTimer = 0;
        leaves.forEach((l, i) => {
          setTimeout(() => {
            l.detaching = true;
            l.vx = (Math.random() - 0.5) * 2.5;
            l.vy = -0.8 - Math.random() * 0.8;
          }, i * 14);
        });
      }
    } else {
      if (endingFinished && !replayBtn.classList.contains('visible')) {
        replayBtn.classList.add('visible');
      }
    }
  }

  else if (phase === 4) {
    phaseTimer++;
    const fadeA = Math.max(0, 1 - phaseTimer / 70);
    drawBigHeart(fadeA);
    withSway(() => {
      ctx.save(); ctx.globalAlpha = fadeA;
      drawTrunk(1);
      drawBranches(branchSegs);
      ctx.restore();
      leaves.forEach(l => l.update());
      leaves.forEach(l => l.draw(6));
    });
    labelEl.classList.toggle('visible', fadeA > 0.3);
    if (leaves.every(l => l.alpha <= 0) || phaseTimer > 180) {
      phase = 99;
      setTimeout(init, 500);
    }
  }
}

init();
loop();