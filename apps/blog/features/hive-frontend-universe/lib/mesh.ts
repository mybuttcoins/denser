/**
 * Hive Frontend Universe — the mesh generator.
 *
 * Pure, dependency-free. Builds the middle of the world: an open, even, PLANAR
 * mesh rewoven each 30-minute window, generated purely from the window start
 * time so every player in the same window gets an identical world.
 *
 * The mesh rules (the difference between fun and a diagram):
 *   - Planar: no two lines cross except at a junction.
 *   - No junction has more than MAX_DEGREE (4) lines.
 *   - No two lines leave a junction less than MIN_ANGLE (35°) apart.
 *   - Junction spacing tuned for ~1.5-2s of open travel at normal speed.
 *   - Lines are gentle curves (sampled polylines), not straight chords.
 *   - The ~30 real posts are placed first, well spaced; the mesh grows around
 *     them. Every post must be reachable from every other (verified, reported).
 *
 * How planarity is achieved rather than hoped for: junctions come from
 * seeded Poisson-disk sampling, edges from the Gabriel graph of those points
 * (a planar-by-construction subgraph of the Delaunay triangulation that always
 * contains the minimum spanning tree, so it starts connected). Pruning for
 * degree/angle only removes edges, which cannot create crossings; connectivity
 * is repaired by re-adding pruned Gabriel edges (still planar). Curves bow the
 * lines afterwards, then a numeric crossing check straightens any pair the
 * bows brought into contact. The final stats are measured, not assumed.
 */

export interface MeshOptions {
  /** Seed — pass the window start so the same half hour weaves the same mesh. */
  seed: number;
  /** Radius of the mesh disk, world px. */
  worldRadius: number;
  /** Houses are placed inside this radius, world px. */
  houseRadius: number;
  /** Target junction spacing (Poisson-disk radius), world px. */
  spacing: number;
  /** How many houses (real posts) to place first. */
  houseCount: number;
  /**
   * Fixed points the mesh must weave around: permanent field landmarks whose
   * positions never change between windows. They are seeded into the point
   * set first, so the Gabriel graph wires them into the web organically.
   */
  anchors?: { x: number; y: number }[];
}

export interface MeshJunction {
  id: number;
  x: number;
  y: number;
  /** Index into the houses array, or -1 for a plain junction. */
  house: number;
  /** Index into the anchors array (field landmarks), or -1. */
  anchor: number;
}

export interface MeshEdge {
  id: number;
  a: number;
  b: number;
  /** Sampled curve, flat [x0,y0,x1,y1,...]. First point is `a`, last is `b`. */
  pts: number[];
  /** Cumulative arc length per sample point; last entry is the full length. */
  cum: number[];
  len: number;
}

export interface MeshStats {
  junctions: number;
  edges: number;
  crossings: number;
  minAngleDeg: number;
  maxDegree: number;
  houses: number;
  reachableHouses: number;
  allHousesReachable: boolean;
  components: number;
  genMs: number;
}

export interface Mesh {
  junctions: MeshJunction[];
  edges: MeshEdge[];
  stats: MeshStats;
}

export const MESH_MAX_DEGREE = 4;
export const MESH_MIN_ANGLE_DEG = 35;

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = 2.399963229728653;
const CURVE_SAMPLES = 24;

/**
 * Per-edge organic wobble. Two low-amplitude sine components under an
 * envelope of (4t(1-t))², which is zero WITH zero derivative at both ends —
 * so the wobble vanishes at the junctions and cannot change the direction a
 * line leaves in, which is what protects the 35° rule.
 */
export interface Wobble {
  a1: number;
  f1: number;
  p1: number;
  a2: number;
  f2: number;
  p2: number;
}

export function makeWobble(len: number, rng: () => number): Wobble {
  return {
    a1: Math.min(len * 0.032, 17) * (0.6 + rng() * 0.4),
    f1: 3 + Math.floor(rng() * 3),
    p1: rng() * TAU,
    a2: Math.min(len * 0.017, 9) * (0.5 + rng() * 0.5),
    f2: 6 + Math.floor(rng() * 4),
    p2: rng() * TAU
  };
}

export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- spatial grid over points ---------------- */

class PointGrid {
  cell: number;
  map = new Map<number, number[]>();
  constructor(cell: number) {
    this.cell = cell;
  }
  key(cx: number, cy: number): number {
    return (cx + 32768) * 65536 + (cy + 32768);
  }
  insert(i: number, x: number, y: number): void {
    const k = this.key(Math.floor(x / this.cell), Math.floor(y / this.cell));
    const arr = this.map.get(k);
    if (arr) arr.push(i);
    else this.map.set(k, [i]);
  }
  /** Indices of points in cells overlapping the circle (x,y,r). */
  near(x: number, y: number, r: number): number[] {
    const out: number[] = [];
    const c0x = Math.floor((x - r) / this.cell);
    const c1x = Math.floor((x + r) / this.cell);
    const c0y = Math.floor((y - r) / this.cell);
    const c1y = Math.floor((y + r) / this.cell);
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cy = c0y; cy <= c1y; cy++) {
        const arr = this.map.get(this.key(cx, cy));
        if (arr) out.push(...arr);
      }
    }
    return out;
  }
}

class UnionFind {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    this.parent[ra] = rb;
    return true;
  }
}

/* ---------------- generation ---------------- */

export function generateMesh(options: MeshOptions): Mesh {
  const t0 = Date.now();
  const { worldRadius, houseRadius, spacing, houseCount } = options;
  const rng = mulberry32(options.seed | 0);

  // 0) Anchors (permanent field landmarks) go in first, at their fixed spots,
  //    so everything else is placed and woven around them.
  const px: number[] = [];
  const py: number[] = [];
  const anchors = options.anchors ?? [];
  for (const a of anchors) {
    px.push(a.x);
    py.push(a.y);
  }
  const anchorCount = anchors.length;

  // 1) Houses next, well spaced: golden-angle spiral with jitter, then a
  //    minimum-separation pass so no two posts crowd each other (or an anchor).
  const minHouseSep = spacing * 2.1;
  for (let i = 0; i < houseCount; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 24 && !placed; attempt++) {
      const f = (i + 0.5) / Math.max(houseCount, 1);
      const baseR = houseRadius * Math.sqrt(f);
      const ang = i * GOLDEN_ANGLE + (rng() - 0.5) * 0.9 + attempt * 0.37;
      const rad = Math.min(houseRadius, baseR * (0.85 + rng() * 0.3) + attempt * spacing * 0.15);
      const x = Math.cos(ang) * rad;
      const y = Math.sin(ang) * rad;
      let ok = true;
      for (let j = 0; j < px.length; j++) {
        if ((px[j] - x) * (px[j] - x) + (py[j] - y) * (py[j] - y) < minHouseSep * minHouseSep) {
          ok = false;
          break;
        }
      }
      if (ok) {
        px.push(x);
        py.push(y);
        placed = true;
      }
    }
    if (!placed) {
      // Desperate fallback: park it on an outward spiral arm; overlap is
      // preferable to silently dropping a real post.
      const ang = i * GOLDEN_ANGLE;
      px.push(Math.cos(ang) * houseRadius);
      py.push(Math.sin(ang) * houseRadius);
    }
  }
  const houses = px.length - anchorCount;

  // 2) Bridson Poisson-disk fill around the anchors and houses.
  const grid = new PointGrid(spacing / Math.SQRT2);
  for (let i = 0; i < px.length; i++) grid.insert(i, px[i], py[i]);
  const active: number[] = [];
  for (let i = 0; i < px.length; i++) active.push(i);
  const fits = (x: number, y: number): boolean => {
    if (x * x + y * y > worldRadius * worldRadius) return false;
    for (const j of grid.near(x, y, spacing)) {
      if ((px[j] - x) * (px[j] - x) + (py[j] - y) * (py[j] - y) < spacing * spacing) return false;
    }
    return true;
  };
  while (active.length) {
    const pick = Math.floor(rng() * active.length);
    const i = active[pick];
    let spawned = false;
    for (let k = 0; k < 24; k++) {
      const ang = rng() * TAU;
      const rad = spacing * (1 + rng());
      const x = px[i] + Math.cos(ang) * rad;
      const y = py[i] + Math.sin(ang) * rad;
      if (!fits(x, y)) continue;
      const id = px.length;
      px.push(x);
      py.push(y);
      grid.insert(id, x, y);
      active.push(id);
      spawned = true;
      break;
    }
    if (!spawned) {
      active[pick] = active[active.length - 1];
      active.pop();
    }
  }
  const n = px.length;

  // 3) Gabriel graph: keep (a,b) iff no third point sits strictly inside the
  //    circle whose diameter is ab. Planar and connected by construction.
  interface ProtoEdge {
    a: number;
    b: number;
    len: number;
    alive: boolean;
  }
  const proto: ProtoEdge[] = [];
  const candidateR = spacing * 2.6;
  for (let a = 0; a < n; a++) {
    for (const b of grid.near(px[a], py[a], candidateR)) {
      if (b <= a) continue;
      const dx = px[b] - px[a];
      const dy = py[b] - py[a];
      const d2 = dx * dx + dy * dy;
      if (d2 > candidateR * candidateR) continue;
      const mx = (px[a] + px[b]) / 2;
      const my = (py[a] + py[b]) / 2;
      const r2 = d2 / 4;
      let gabriel = true;
      for (const c of grid.near(mx, my, Math.sqrt(r2))) {
        if (c === a || c === b) continue;
        const cx = px[c] - mx;
        const cy = py[c] - my;
        if (cx * cx + cy * cy < r2 - 1e-6) {
          gabriel = false;
          break;
        }
      }
      if (gabriel) proto.push({ a, b, len: Math.sqrt(d2), alive: true });
    }
  }

  // 4) Prune for degree ≤ 4 and pairwise angle ≥ 35°. Removal cannot break
  //    planarity. Prefer removing the longer edge of an offending pair.
  const incident: number[][] = Array.from({ length: n }, () => []);
  proto.forEach((e, idx) => {
    incident[e.a].push(idx);
    incident[e.b].push(idx);
  });
  const deg = (v: number) => incident[v].reduce((acc, ei) => acc + (proto[ei].alive ? 1 : 0), 0);
  const angleOf = (v: number, ei: number): number => {
    const e = proto[ei];
    const o = e.a === v ? e.b : e.a;
    return Math.atan2(py[o] - py[v], px[o] - px[v]);
  };
  // Prune against a slightly stricter chord angle than the spec so the curve
  // bows added later have headroom; the spec angle is then enforced on the
  // actual curve tangents in the bow-reduction pass below.
  const minAngleRad = ((MESH_MIN_ANGLE_DEG + 4) * Math.PI) / 180;
  const angDiff = (a: number, b: number): number => {
    let d = Math.abs(a - b) % TAU;
    if (d > Math.PI) d = TAU - d;
    return d;
  };

  let changed = true;
  let guard = 0;
  while (changed && guard++ < 12) {
    changed = false;
    for (let v = 0; v < n; v++) {
      // Angle rule: kill the longer of any pair leaving < 35° apart.
      let live = incident[v].filter((ei) => proto[ei].alive);
      for (let i = 0; i < live.length; i++) {
        for (let j = i + 1; j < live.length; j++) {
          const e1 = proto[live[i]];
          const e2 = proto[live[j]];
          if (!e1.alive || !e2.alive) continue;
          if (angDiff(angleOf(v, live[i]), angleOf(v, live[j])) < minAngleRad) {
            (e1.len >= e2.len ? e1 : e2).alive = false;
            changed = true;
          }
        }
      }
      // Degree rule: shed the longest until at most 4 remain.
      live = incident[v].filter((ei) => proto[ei].alive);
      while (live.length > MESH_MAX_DEGREE) {
        let worst = live[0];
        for (const ei of live) if (proto[ei].len > proto[worst].len) worst = ei;
        proto[worst].alive = false;
        live = live.filter((ei) => ei !== worst);
        changed = true;
      }
    }
  }

  // 5) Connectivity repair: re-add pruned Gabriel edges (shortest first —
  //    they are still planar), skipping any that would break the degree or
  //    angle rules unless nothing else can reconnect the component.
  const uf = new UnionFind(n);
  for (const e of proto) if (e.alive) uf.union(e.a, e.b);
  const dead = proto
    .map((e, idx) => ({ e, idx }))
    .filter(({ e }) => !e.alive)
    .sort((p, q) => p.e.len - q.e.len);
  const violates = (v: number, ei: number): boolean => {
    if (deg(v) >= MESH_MAX_DEGREE) return true;
    const na = angleOf(v, ei);
    for (const other of incident[v]) {
      if (other === ei || !proto[other].alive) continue;
      if (angDiff(na, angleOf(v, other)) < minAngleRad) return true;
    }
    return false;
  };
  for (let pass = 0; pass < 2; pass++) {
    // pass 0: respect the rules. pass 1: connectivity beats the rules.
    for (const { e, idx } of dead) {
      if (e.alive) continue;
      if (uf.find(e.a) === uf.find(e.b)) continue;
      if (pass === 0 && (violates(e.a, idx) || violates(e.b, idx))) continue;
      e.alive = true;
      uf.union(e.a, e.b);
    }
  }

  // 6) Curves: gentle seeded bows plus organic wobble, sampled to polylines.
  const finalEdges = proto.filter((e) => e.alive);
  const wobbles: Wobble[] = [];
  const edges: MeshEdge[] = finalEdges.map((e, id) => {
    const bowMag = e.len * (0.05 + rng() * 0.05) * (rng() < 0.5 ? -1 : 1);
    const wob = makeWobble(e.len, rng);
    wobbles.push(wob);
    return sampleEdge(id, e.a, e.b, px, py, bowMag, wob);
  });

  // 6.5) Enforce the spec angle on the ACTUAL curve tangents: where two curves
  //      leave a junction under 35° apart, shrink their bows and resample;
  //      final attempt straightens them (chord angles already clear 35°+).
  const bows = edges.map((e) => {
    // recover the bow magnitude from the sampled midpoint
    const mi = Math.floor(e.pts.length / 4) * 2;
    const mx = (px[e.a] + px[e.b]) / 2;
    const my = (py[e.a] + py[e.b]) / 2;
    return Math.hypot(e.pts[mi] - mx, e.pts[mi + 1] - my) * 2 * (crossZ(e, px, py) < 0 ? -1 : 1);
  });
  const incidentByNode: number[][] = Array.from({ length: n }, () => []);
  for (const e of edges) {
    incidentByNode[e.a].push(e.id);
    incidentByNode[e.b].push(e.id);
  }
  const specRad = (MESH_MIN_ANGLE_DEG * Math.PI) / 180;
  for (let attempt = 0; attempt < 4; attempt++) {
    let fixed = 0;
    for (let v = 0; v < n; v++) {
      const list = incidentByNode[v];
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const d = angDiff(leaveAngle(edges[list[i]], v), leaveAngle(edges[list[j]], v));
          if (d < specRad) {
            for (const ei of [list[i], list[j]]) {
              bows[ei] = attempt >= 2 ? 0 : bows[ei] * 0.4;
              const e = edges[ei];
              edges[ei] = sampleEdge(e.id, e.a, e.b, px, py, bows[ei], wobbles[ei]);
            }
            fixed++;
          }
        }
      }
    }
    if (fixed === 0) break;
  }

  // 7) Numeric crossing check on the sampled curves; offenders lose both
  //    their bow AND their wobble (fully straight is always planar here).
  let crossings = countCrossings(edges, spacing);
  if (crossings.count > 0) {
    for (const id of crossings.offenders) {
      const e = edges[id];
      edges[id] = sampleEdge(e.id, e.a, e.b, px, py, 0);
    }
    crossings = countCrossings(edges, spacing);
  }

  // 8) Measured stats: curve-tangent angles, degrees, reachability.
  const incidentFinal: number[][] = Array.from({ length: n }, () => []);
  for (const e of edges) {
    incidentFinal[e.a].push(e.id);
    incidentFinal[e.b].push(e.id);
  }
  let minAngleDeg = 180;
  let maxDegree = 0;
  for (let v = 0; v < n; v++) {
    const list = incidentFinal[v];
    maxDegree = Math.max(maxDegree, list.length);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const d = angDiff(leaveAngle(edges[list[i]], v), leaveAngle(edges[list[j]], v));
        minAngleDeg = Math.min(minAngleDeg, (d * 180) / Math.PI);
      }
    }
  }

  const seen = new Set<number>([0]);
  const queue = [0];
  while (queue.length) {
    const v = queue.pop() as number;
    for (const ei of incidentFinal[v]) {
      const e = edges[ei];
      const o = e.a === v ? e.b : e.a;
      if (!seen.has(o)) {
        seen.add(o);
        queue.push(o);
      }
    }
  }
  const roots = new Set<number>();
  for (let v = 0; v < n; v++) roots.add(uf.find(v));
  let reachableHouses = 0;
  for (let h = anchorCount; h < anchorCount + houses; h++) if (seen.has(h)) reachableHouses++;

  const junctions: MeshJunction[] = [];
  for (let i = 0; i < n; i++) {
    junctions.push({
      id: i,
      x: px[i],
      y: py[i],
      house: i >= anchorCount && i < anchorCount + houses ? i - anchorCount : -1,
      anchor: i < anchorCount ? i : -1
    });
  }

  return {
    junctions,
    edges,
    stats: {
      junctions: n,
      edges: edges.length,
      crossings: crossings.count,
      minAngleDeg,
      maxDegree,
      houses,
      reachableHouses,
      allHousesReachable: reachableHouses === houses,
      components: roots.size,
      genMs: Date.now() - t0
    }
  };
}

/** Sign of the curve's bow side relative to its chord (which way it bulges). */
function crossZ(e: MeshEdge, px: number[], py: number[]): number {
  const mi = Math.floor(e.pts.length / 4) * 2;
  const ax = px[e.a];
  const ay = py[e.a];
  return (px[e.b] - ax) * (e.pts[mi + 1] - ay) - (py[e.b] - ay) * (e.pts[mi] - ax);
}

/** Direction (radians) an edge leaves junction `v` in, from its first curve segment. */
export function leaveAngle(e: MeshEdge, v: number): number {
  const p = e.pts;
  if (e.a === v) return Math.atan2(p[3] - p[1], p[2] - p[0]);
  const m = p.length;
  return Math.atan2(p[m - 3] - p[m - 1], p[m - 4] - p[m - 2]);
}

/**
 * Sample of an edge: a quadratic-Bezier bow plus optional organic wobble,
 * both applied perpendicular to the chord.
 */
export function sampleEdge(
  id: number,
  a: number,
  b: number,
  px: number[],
  py: number[],
  bowMag: number,
  wobble?: Wobble
): MeshEdge {
  const ax = px[a];
  const ay = py[a];
  const bx = px[b];
  const by = py[b];
  const dx = bx - ax;
  const dy = by - ay;
  const chord = Math.hypot(dx, dy) || 1;
  const nx = -dy / chord;
  const ny = dx / chord;
  const cx = (ax + bx) / 2 + nx * bowMag;
  const cy = (ay + by) / 2 + ny * bowMag;
  const pts: number[] = [];
  const cum: number[] = [];
  let len = 0;
  for (let s = 0; s <= CURVE_SAMPLES; s++) {
    const t = s / CURVE_SAMPLES;
    const u = 1 - t;
    let x = u * u * ax + 2 * u * t * cx + t * t * bx;
    let y = u * u * ay + 2 * u * t * cy + t * t * by;
    if (wobble) {
      const env = Math.pow(4 * t * u, 2);
      const off =
        env *
        (wobble.a1 * Math.sin(wobble.f1 * Math.PI * t + wobble.p1) +
          wobble.a2 * Math.sin(wobble.f2 * Math.PI * t + wobble.p2));
      x += nx * off;
      y += ny * off;
    }
    if (s > 0) len += Math.hypot(x - pts[(s - 1) * 2], y - pts[(s - 1) * 2 + 1]);
    pts.push(x, y);
    cum.push(len);
  }
  return { id, a, b, pts, cum, len };
}

/* ---------------- planarity verification ---------------- */

function segsIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): boolean {
  const d1 = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
  const d2 = (x2 - x1) * (y4 - y1) - (y2 - y1) * (x4 - x1);
  const d3 = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
  const d4 = (x4 - x3) * (y2 - y3) - (y4 - y3) * (x2 - x3);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * Counts curve-curve crossings between NON-adjacent edges (edges sharing a
 * junction meet there legitimately). Grid-bucketed so it stays fast.
 */
export function countCrossings(
  edges: MeshEdge[],
  cellSize: number
): { count: number; offenders: number[] } {
  const grid = new Map<number, number[]>();
  const key = (cx: number, cy: number) => (cx + 32768) * 65536 + (cy + 32768);
  const boxes = edges.map((e) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < e.pts.length; i += 2) {
      minX = Math.min(minX, e.pts[i]);
      maxX = Math.max(maxX, e.pts[i]);
      minY = Math.min(minY, e.pts[i + 1]);
      maxY = Math.max(maxY, e.pts[i + 1]);
    }
    return { minX, minY, maxX, maxY };
  });
  boxes.forEach((b, i) => {
    for (let cx = Math.floor(b.minX / cellSize); cx <= Math.floor(b.maxX / cellSize); cx++) {
      for (let cy = Math.floor(b.minY / cellSize); cy <= Math.floor(b.maxY / cellSize); cy++) {
        const k = key(cx, cy);
        const arr = grid.get(k);
        if (arr) arr.push(i);
        else grid.set(k, [i]);
      }
    }
  });
  const tested = new Set<number>();
  const offenders = new Set<number>();
  let count = 0;
  for (const bucket of grid.values()) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const eI = edges[bucket[i]];
        const eJ = edges[bucket[j]];
        if (eI.id === eJ.id) continue;
        if (eI.a === eJ.a || eI.a === eJ.b || eI.b === eJ.a || eI.b === eJ.b) continue;
        const pairKey = Math.min(eI.id, eJ.id) * 65536 + Math.max(eI.id, eJ.id);
        if (tested.has(pairKey)) continue;
        tested.add(pairKey);
        const bI = boxes[bucket[i]];
        const bJ = boxes[bucket[j]];
        if (bI.maxX < bJ.minX || bJ.maxX < bI.minX || bI.maxY < bJ.minY || bJ.maxY < bI.minY) continue;
        let hit = false;
        for (let s = 0; s < eI.pts.length - 2 && !hit; s += 2) {
          for (let r = 0; r < eJ.pts.length - 2 && !hit; r += 2) {
            if (
              segsIntersect(
                eI.pts[s], eI.pts[s + 1], eI.pts[s + 2], eI.pts[s + 3],
                eJ.pts[r], eJ.pts[r + 1], eJ.pts[r + 2], eJ.pts[r + 3]
              )
            ) {
              hit = true;
            }
          }
        }
        if (hit) {
          count++;
          offenders.add(eI.id);
          offenders.add(eJ.id);
        }
      }
    }
  }
  return { count, offenders: [...offenders] };
}
