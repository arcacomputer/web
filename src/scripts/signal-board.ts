/**
 * Signal board — the hero centerpiece.
 *
 * A procedurally routed board of PCB-like traces with teal pulses travelling
 * along them, junction pads that flash as pulses pass, and a pointer spotlight
 * that tints nearby traces. Purely decorative: the host is aria-hidden, the
 * loop pauses off-screen and when the tab is hidden, and reduced-motion users
 * get a single static frame.
 */

type Point = { x: number; y: number };

type Trace = {
  points: Point[];
  cumulative: number[];
  total: number;
  nodes: number[];
};

type BoardNode = { x: number; y: number; at: number; pad: boolean };

type Pulse = { trace: number; head: number; speed: number; length: number; bronze: boolean };

const TEAL = '104, 219, 195';
const PAPER = '226, 229, 218';
const BRONZE = '192, 139, 84';
const TAU = Math.PI * 2;

const DIRECTIONS: Point[] = [
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildBoard(
  width: number,
  height: number,
  cell: number,
  traceCount: number,
  random: () => number,
): { traces: Trace[]; nodes: BoardNode[] } {
  const cols = Math.ceil(width / cell) + 2;
  const rows = Math.ceil(height / cell) + 2;
  const occupied = new Set<number>();
  const key = (gx: number, gy: number) => (gy + 2) * 8192 + (gx + 2);
  const traces: Trace[] = [];
  const nodes: BoardNode[] = [];

  let attempts = 0;
  while (traces.length < traceCount && attempts < traceCount * 8) {
    attempts += 1;
    let gx = Math.floor(random() * cols) - 1;
    let gy = Math.floor(random() * rows) - 1;
    if (occupied.has(key(gx, gy))) continue;

    let direction = [0, 2, 4, 6][Math.floor(random() * 4)];
    const gridPoints: Point[] = [{ x: gx, y: gy }];
    const cells = [key(gx, gy)];
    const steps = 8 + Math.floor(random() * 20);
    let run = 0;
    let runTarget = 2 + Math.floor(random() * 6);

    for (let step = 0; step < steps; step += 1) {
      if (run >= runTarget) {
        const turn = random() < 0.5 ? 1 : -1;
        direction = (direction + turn + 8) % 8;
        run = 0;
        runTarget = direction % 2 === 1 ? 1 + Math.floor(random() * 3) : 2 + Math.floor(random() * 6);
        gridPoints.push({ x: gx, y: gy });
      }
      const d = DIRECTIONS[direction];
      const nx = gx + d.x;
      const ny = gy + d.y;
      if (nx < -1 || ny < -1 || nx > cols || ny > rows || occupied.has(key(nx, ny))) break;
      gx = nx;
      gy = ny;
      run += 1;
      cells.push(key(gx, gy));
    }

    if (cells.length < 5) continue;
    const last = gridPoints[gridPoints.length - 1];
    if (last.x !== gx || last.y !== gy) gridPoints.push({ x: gx, y: gy });
    if (gridPoints.length < 2) continue;
    for (const c of cells) occupied.add(c);

    const points = gridPoints.map((p) => ({ x: p.x * cell + cell / 2, y: p.y * cell + cell / 2 }));
    const cumulative = [0];
    for (let i = 1; i < points.length; i += 1) {
      cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    }
    const total = cumulative[cumulative.length - 1];
    const traceNodes: number[] = [];
    points.forEach((p, i) => {
      const pad = i === 0 || i === points.length - 1;
      if (!pad && random() > 0.55) return;
      traceNodes.push(nodes.length);
      nodes.push({ x: p.x, y: p.y, at: cumulative[i], pad });
    });
    traces.push({ points, cumulative, total, nodes: traceNodes });
  }

  return { traces, nodes };
}

function pointAt(trace: Trace, distance: number): Point {
  const { points, cumulative } = trace;
  if (distance <= 0) return points[0];
  if (distance >= trace.total) return points[points.length - 1];
  let i = 1;
  while (cumulative[i] < distance) i += 1;
  const segment = cumulative[i] - cumulative[i - 1];
  const t = segment > 0 ? (distance - cumulative[i - 1]) / segment : 0;
  return {
    x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
    y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
  };
}

function tracePath(ctx: CanvasRenderingContext2D, trace: Trace, from: number, to: number): void {
  const start = pointAt(trace, from);
  const end = pointAt(trace, to);
  ctx.moveTo(start.x, start.y);
  for (let i = 1; i < trace.points.length - 1; i += 1) {
    const at = trace.cumulative[i];
    if (at > from && at < to) ctx.lineTo(trace.points[i].x, trace.points[i].y);
  }
  ctx.lineTo(end.x, end.y);
}

function makeLayer(width: number, height: number, dpr: number): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function paintTraces(
  ctx: CanvasRenderingContext2D,
  traces: Trace[],
  nodes: BoardNode[],
  color: string,
  lineAlpha: number,
  padAlpha: number,
): void {
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(${color}, ${lineAlpha})`;
  ctx.beginPath();
  for (const trace of traces) {
    ctx.moveTo(trace.points[0].x, trace.points[0].y);
    for (let i = 1; i < trace.points.length; i += 1) ctx.lineTo(trace.points[i].x, trace.points[i].y);
  }
  ctx.stroke();

  for (const node of nodes) {
    if (node.pad) {
      ctx.fillStyle = `rgba(${color}, ${padAlpha})`;
      ctx.fillRect(node.x - 2.5, node.y - 2.5, 5, 5);
      ctx.fillStyle = 'rgb(13, 20, 18)';
      ctx.fillRect(node.x - 1, node.y - 1, 2, 2);
    } else {
      ctx.fillStyle = `rgba(${color}, ${padAlpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 1.5, 0, TAU);
      ctx.fill();
    }
  }
}

export function mountSignalBoard(host: HTMLElement): void {
  try {
    boot(host);
  } catch {
    // Decorative only — never let the board break the page.
  }
}

function boot(host: HTMLElement): void {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  host.appendChild(canvas);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const compact = window.matchMedia('(max-width: 760px)').matches;
  const random = mulberry32(20260901);

  let width = 0;
  let height = 0;
  let dpr = 1;
  let traces: Trace[] = [];
  let nodes: BoardNode[] = [];
  let pulses: Pulse[] = [];
  let lit = new Float32Array(0);
  let spark = new Float32Array(0);
  let staticLayer: CanvasRenderingContext2D | null = null;
  let brightLayer: CanvasRenderingContext2D | null = null;
  let litLayer: CanvasRenderingContext2D | null = null;
  let sparkTimer = 1.5;

  const pointer = { x: 0, y: 0, strength: 0, target: 0 };
  let frameId = 0;
  let running = false;
  let inView = true;
  let lastTime = 0;

  const spawn = (pulse: Pulse, fresh: boolean) => {
    pulse.trace = Math.floor(random() * traces.length);
    const trace = traces[pulse.trace];
    pulse.length = 36 + random() * 70;
    pulse.speed = 55 + random() * 95;
    pulse.bronze = random() < 0.08;
    pulse.head = fresh ? random() * (trace.total + pulse.length) : -random() * 240;
  };

  const build = () => {
    width = host.clientWidth;
    height = host.clientHeight;
    if (width < 10 || height < 10) return false;
    dpr = Math.min(window.devicePixelRatio || 1, compact ? 1 : 1.5, 2600 / width);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cell = compact ? 22 : 26;
    const traceCount = Math.max(18, Math.min(64, Math.round((width * height) / 24000)));
    const board = buildBoard(width, height, cell, traceCount, random);
    traces = board.traces;
    nodes = board.nodes;
    if (traces.length === 0) return false;
    lit = new Float32Array(nodes.length);
    spark = new Float32Array(nodes.length);

    staticLayer = makeLayer(width, height, dpr);
    if (staticLayer) paintTraces(staticLayer, traces, nodes, PAPER, 0.13, 0.3);
    if (finePointer && !reduceMotion) {
      brightLayer = makeLayer(width, height, dpr);
      if (brightLayer) paintTraces(brightLayer, traces, nodes, TEAL, 0.5, 0.85);
      litLayer = makeLayer(width, height, dpr);
    }

    const pulseCount = Math.round(traces.length * (compact ? 0.75 : 1.15));
    pulses = Array.from({ length: pulseCount }, () => {
      const pulse: Pulse = { trace: 0, head: 0, speed: 0, length: 0, bronze: false };
      spawn(pulse, true);
      return pulse;
    });
    return true;
  };

  const drawPulse = (pulse: Pulse, trace: Trace) => {
    const color = pulse.bronze ? BRONZE : TEAL;
    const chunks = 4;
    const tail = pulse.head - pulse.length;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let k = 0; k < chunks; k += 1) {
      const a = Math.max(0, tail + (pulse.length * k) / chunks);
      const b = Math.min(trace.total, tail + (pulse.length * (k + 1)) / chunks);
      if (b <= a) continue;
      const alpha = 0.1 + 0.9 * ((k + 1) / chunks);
      ctx.beginPath();
      tracePath(ctx, trace, a, b);
      ctx.strokeStyle = `rgba(${color}, ${(alpha * 0.16).toFixed(3)})`;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = `rgba(${color}, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    if (pulse.head >= 0 && pulse.head <= trace.total) {
      const head = pointAt(trace, pulse.head);
      ctx.fillStyle = pulse.bronze ? '#f2cf9f' : '#dffff6';
      ctx.fillRect(head.x - 1.5, head.y - 1.5, 3, 3);
    }
  };

  const drawNodes = (dt: number) => {
    const decay = Math.pow(0.1, dt);
    const sparkDecay = Math.pow(0.03, dt);
    for (let n = 0; n < nodes.length; n += 1) {
      const node = nodes[n];
      if (lit[n] > 0.02) {
        const a = lit[n];
        ctx.fillStyle = `rgba(${TEAL}, ${(a * 0.22).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 7, 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(${TEAL}, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2.2, 0, TAU);
        ctx.fill();
        lit[n] = a * decay;
      }
      if (spark[n] > 0.02) {
        const a = spark[n];
        ctx.fillStyle = `rgba(${BRONZE}, ${(a * 0.3).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 9, 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(${BRONZE}, ${a.toFixed(3)})`;
        ctx.fillRect(node.x - 2, node.y - 2, 4, 4);
        spark[n] = a * sparkDecay;
      }
    }
  };

  const drawSpotlight = () => {
    if (!brightLayer || !litLayer || pointer.strength < 0.01) return;
    const layer = litLayer;
    layer.globalCompositeOperation = 'source-over';
    layer.clearRect(0, 0, width, height);
    layer.drawImage(brightLayer.canvas, 0, 0, width, height);
    layer.globalCompositeOperation = 'destination-in';
    const gradient = layer.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 300);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(0.45, 'rgba(0, 0, 0, 0.55)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    layer.fillStyle = gradient;
    layer.fillRect(0, 0, width, height);
    ctx.globalAlpha = pointer.strength * 0.9;
    ctx.drawImage(layer.canvas, 0, 0, width, height);
    ctx.globalAlpha = 1;
  };

  const renderFrame = (dt: number) => {
    ctx.clearRect(0, 0, width, height);
    if (staticLayer) ctx.drawImage(staticLayer.canvas, 0, 0, width, height);
    drawSpotlight();

    for (const pulse of pulses) {
      pulse.head += pulse.speed * dt;
      const trace = traces[pulse.trace];
      if (pulse.head - pulse.length > trace.total) {
        spawn(pulse, false);
        continue;
      }
      drawPulse(pulse, trace);
      const reach = pulse.speed * dt + 3;
      for (const n of trace.nodes) {
        if (Math.abs(nodes[n].at - pulse.head) < reach) lit[n] = 1;
      }
    }

    sparkTimer -= dt;
    if (sparkTimer <= 0 && nodes.length > 0) {
      sparkTimer = 1.2 + random() * 2.2;
      spark[Math.floor(random() * nodes.length)] = 1;
    }
    drawNodes(dt);
  };

  const frame = (now: number) => {
    if (!running) return;
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0.016;
    lastTime = now;
    pointer.strength += (pointer.target - pointer.strength) * Math.min(1, dt * 5);
    renderFrame(dt);
    frameId = window.requestAnimationFrame(frame);
  };

  const start = () => {
    if (running || reduceMotion) return;
    running = true;
    lastTime = 0;
    frameId = window.requestAnimationFrame(frame);
  };

  const stop = () => {
    running = false;
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
  };

  const sync = () => {
    if (inView && !document.hidden) start();
    else stop();
  };

  const renderStatic = () => {
    // One considered frame: traces, a handful of frozen pulses, a few lit pads.
    for (let i = 0; i < 6; i += 1) renderFrame(0.016);
    for (let i = 0; i < Math.min(8, nodes.length); i += 1) lit[Math.floor(random() * nodes.length)] = 0.8;
    renderFrame(0.016);
  };

  if (!build()) return;

  if (reduceMotion) {
    renderStatic();
  } else {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          inView = entries.some((entry) => entry.isIntersecting);
          sync();
        },
        { threshold: 0 },
      );
      observer.observe(host);
    }
    document.addEventListener('visibilitychange', sync);
    sync();

    if (finePointer) {
      window.addEventListener(
        'pointermove',
        (event) => {
          const rect = host.getBoundingClientRect();
          pointer.x = event.clientX - rect.left;
          pointer.y = event.clientY - rect.top;
          pointer.target = pointer.y >= 0 && pointer.y <= rect.height ? 1 : 0;
        },
        { passive: true },
      );
      document.documentElement.addEventListener('pointerleave', () => {
        pointer.target = 0;
      });
    }
  }

  if ('ResizeObserver' in window) {
    let resizeTimer = 0;
    const observer = new ResizeObserver(() => {
      if (host.clientWidth === width && host.clientHeight === height) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (build()) {
          if (reduceMotion) renderStatic();
          else renderFrame(0);
        }
      }, 150);
    });
    observer.observe(host);
  }
}
