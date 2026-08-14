/**
 * Hive Frontend Universe — force-directed layout.
 *
 * Pure, dependency-free. Ported from the mock's `buildBoard` force pass: the
 * layout is settled ONCE here (not per frame), so the render loop only ever
 * reads positions. Deterministic given `seed`, so a window always lays out the
 * same way and a returning player sees the same map.
 */

export interface LayoutEdge {
  a: number;
  b: number;
}

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutOptions {
  /** Deterministic seed — pass the window start. */
  seed: number;
  /** Iterations of the force sim. The mock uses 230. */
  iterations?: number;
  /** Final radius the graph is normalised to. */
  graphRadius?: number;
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns a settled position per node. Repulsion between all pairs, attraction
 * along edges, cooling schedule, then the whole thing is scaled so its widest
 * point sits at `graphRadius`. With ~30 nodes this is a few hundred microseconds.
 */
export function settleLayout(
  nodeCount: number,
  edges: LayoutEdge[],
  options: LayoutOptions
): LayoutPoint[] {
  const iterations = options.iterations ?? 230;
  const graphRadius = options.graphRadius ?? 1900;
  const rng = mulberry32(options.seed | 0);

  if (nodeCount === 0) return [];
  if (nodeCount === 1) return [{ x: 0, y: 0 }];

  const x = new Float64Array(nodeCount);
  const y = new Float64Array(nodeCount);
  const vx = new Float64Array(nodeCount);
  const vy = new Float64Array(nodeCount);

  for (let i = 0; i < nodeCount; i++) {
    const ang = rng() * 6.283185;
    const rad = 200 + rng() * 700;
    x[i] = Math.cos(ang) * rad;
    y[i] = Math.sin(ang) * rad;
  }

  const k = Math.sqrt((3000 * 3000) / nodeCount);

  for (let t = 0; t < iterations; t++) {
    const temp = (1 - t / iterations) * 95 + 2;
    vx.fill(0);
    vy.fill(0);

    // Repulsion, all pairs.
    for (let p = 0; p < nodeCount; p++) {
      for (let q = p + 1; q < nodeCount; q++) {
        let dx = x[p] - x[q];
        let dy = y[p] - y[q];
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          dx = rng() - 0.5;
          dy = rng() - 0.5;
          d2 = 0.01;
        }
        const d = Math.sqrt(d2);
        const f = (k * k) / d;
        vx[p] += (dx / d) * f;
        vy[p] += (dy / d) * f;
        vx[q] -= (dx / d) * f;
        vy[q] -= (dy / d) * f;
      }
    }

    // Attraction along edges.
    for (const e of edges) {
      const ex = x[e.a] - x[e.b];
      const ey = y[e.a] - y[e.b];
      const el = Math.sqrt(ex * ex + ey * ey) || 0.01;
      const af = (el * el) / k;
      vx[e.a] -= (ex / el) * af;
      vy[e.a] -= (ey / el) * af;
      vx[e.b] += (ex / el) * af;
      vy[e.b] += (ey / el) * af;
    }

    // Move, capped by the cooling temperature, with a gentle pull to centre.
    for (let m = 0; m < nodeCount; m++) {
      const sp = Math.hypot(vx[m], vy[m]) || 1;
      const st = Math.min(sp, temp);
      x[m] += (vx[m] / sp) * st;
      y[m] += (vy[m] / sp) * st;
      x[m] *= 0.9985;
      y[m] *= 0.9985;
    }
  }

  // Normalise so the widest node sits at graphRadius.
  let maxR = 1;
  for (let i = 0; i < nodeCount; i++) maxR = Math.max(maxR, Math.hypot(x[i], y[i]));
  const sc = graphRadius / maxR;

  const out: LayoutPoint[] = new Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) out[i] = { x: x[i] * sc, y: y[i] * sc };
  return out;
}
