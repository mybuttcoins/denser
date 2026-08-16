/**
 * Hive Frontend Universe - world assembly.
 *
 * Welds the layers into one travelable graph shaped like a ragged globular
 * BODY with BREAKOUT CLUSTERS:
 *   - the window's woven mesh fills the body mask (lib/fixed-world.ts cells),
 *     holding the posts and the in-body landmarks (as mesh anchors);
 *   - six permanent star clusters hang off the body: two tied on by a single
 *     thin rail trail, two reachable only by hopping their gap, two walled
 *     behind gaps 1.5-3x the maximum hop distance;
 *   - the community bubbles float just off the south-west coastline.
 *
 * Every added line is verified against the pass-two mesh rules: planarity
 * (numeric crossing check), max degree 4, and 35 degrees between lines
 * leaving a junction. Gap widths, reachability and the max hop distance are
 * MEASURED (the hop from the real movement constants, which this file never
 * changes) and reported in stats.
 */

import {
  generateMesh,
  sampleEdge,
  makeWobble,
  countCrossings,
  mulberry32,
  leaveAngle,
  MESH_MAX_DEGREE,
  MESH_MIN_ANGLE_DEG,
  type MeshEdge
} from '../lib/mesh';
import {
  WORLD,
  LANDMARKS,
  CLUSTERS,
  insideBody,
  landmassAt,
  sampleBodyPoint,
  coastDistanceAt,
  communitySlots,
  rimPosition,
  landmarkPosition,
  bodyLandmarkIndexes,
  clusterLandmarkIndexes,
  LANDMASS_COUNT,
  LANDMASS_KEYS
} from '../lib/fixed-world';
import { MOVE } from './movement';

export type NodeKind = 'junction' | 'house' | 'landmark' | 'community';

export interface WorldNode {
  id: number;
  x: number;
  y: number;
  kind: NodeKind;
  ref: number;
}

export interface WorldEdge extends MeshEdge {
  kind: 'mesh' | 'spoke';
}

export interface GapReport {
  cluster: string;
  link: 'hop' | 'wall';
  /** Measured narrowest gap between this cluster's lines and any other line. */
  gapPx: number;
  /** gapPx / maxHopPx. */
  ratio: number;
}

/** Rail reachability measured WITHIN one landmass, never across a channel. */
export interface LandmassReport {
  key: string;
  junctions: number;
  houses: number;
  /** Junctions reachable from the landmass's largest rail component. */
  reachableJunctions: number;
  reachableHouses: number;
  /** True when every junction on this landmass is rail-reachable inside it. */
  fullyConnected: boolean;
}

/** A measured channel between two landmasses. */
export interface ChannelReport {
  between: string;
  gapPx: number;
  /** gapPx / maxHopPx. Must sit in 1.5-3x for the channel to be a real wall. */
  ratio: number;
}

export interface WorldStats {
  junctions: number;
  edges: number;
  crossings: number;
  /** Per-landmass rail reachability. */
  landmasses: LandmassReport[];
  /** The channels between the landmasses, measured on the real rail lines. */
  channels: ChannelReport[];
  /** Narrowest angle between two lines leaving any junction, whole graph. */
  minAngleDeg: number;
  houses: number;
  reachableHouses: number;
  landmarks: number;
  clusters: number;
  trailClusters: string[];
  hopOnlyClusters: string[];
  wallClusters: string[];
  gaps: GapReport[];
  /** Longest gap the bug can cross with a full drift ring, simulated. */
  maxHopPx: number;
  droppedSpokes: number;
  genMs: number;
}

export interface GameWorld {
  nodes: WorldNode[];
  edges: WorldEdge[];
  incident: number[][];
  stats: WorldStats;
  landmarkNodeByIndex: number[];
  communityNodeBySlot: number[];
  /** Rail-reachable from the spawn (body + trail clusters + communities). */
  reachableFromSpawn: boolean[];
}

/**
 * Maximum drift distance, simulated step-by-step from the movement constants
 * (never edited here): jump speed, drift acceleration and cap, drag, fuel,
 * plus the snap radius at the far end.
 */
export function simulateMaxHop(): number {
  const dt = 1 / 120;
  let v: number = MOVE.JUMPV;
  let d = 0;
  for (let t = 0; t < MOVE.DRIFT_TIME; t += dt) {
    v += MOVE.DRIFT_ACC * dt;
    if (v > MOVE.DRIFT_MAX) v = MOVE.DRIFT_MAX;
    v -= v * MOVE.DRAG * dt;
    d += v * dt;
  }
  return d + MOVE.SNAP;
}

/** One-vs-all curve crossing test (bbox precheck, then segment pairs). */
function crossesAny(spoke: MeshEdge, edges: readonly MeshEdge[]): boolean {
  let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
  for (let i = 0; i < spoke.pts.length; i += 2) {
    sMinX = Math.min(sMinX, spoke.pts[i]);
    sMaxX = Math.max(sMaxX, spoke.pts[i]);
    sMinY = Math.min(sMinY, spoke.pts[i + 1]);
    sMaxY = Math.max(sMaxY, spoke.pts[i + 1]);
  }
  const hit = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) => {
    const d1 = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
    const d2 = (x2 - x1) * (y4 - y1) - (y2 - y1) * (x4 - x1);
    const d3 = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
    const d4 = (x4 - x3) * (y2 - y3) - (y4 - y3) * (x2 - x3);
    return d1 * d2 < 0 && d3 * d4 < 0;
  };
  for (const e of edges) {
    if (e.a === spoke.a || e.a === spoke.b || e.b === spoke.a || e.b === spoke.b) continue;
    let eMinX = Infinity, eMinY = Infinity, eMaxX = -Infinity, eMaxY = -Infinity;
    for (let i = 0; i < e.pts.length; i += 2) {
      eMinX = Math.min(eMinX, e.pts[i]);
      eMaxX = Math.max(eMaxX, e.pts[i]);
      eMinY = Math.min(eMinY, e.pts[i + 1]);
      eMaxY = Math.max(eMaxY, e.pts[i + 1]);
    }
    if (eMaxX < sMinX || sMaxX < eMinX || eMaxY < sMinY || sMaxY < eMinY) continue;
    for (let s = 0; s < spoke.pts.length - 2; s += 2) {
      for (let r = 0; r < e.pts.length - 2; r += 2) {
        if (
          hit(
            spoke.pts[s], spoke.pts[s + 1], spoke.pts[s + 2], spoke.pts[s + 3],
            e.pts[r], e.pts[r + 1], e.pts[r + 2], e.pts[r + 3]
          )
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

const TAU = Math.PI * 2;

function angDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % TAU;
  if (d > Math.PI) d = TAU - d;
  return d;
}

/**
 * Builds the whole travelable world for a window. Deterministic given
 * `windowStart` alone; the body cells, clusters and landmark positions are
 * constants, so only the body's weave is rewoven.
 */
export function buildWorld(windowStart: number, houseCount: number): GameWorld {
  const t0 = Date.now();

  // Body landmarks are anchors: seeded into the point set first, so the
  // Gabriel weave wires them into the body organically.
  const bodyLmIdx = bodyLandmarkIndexes();
  const anchors = bodyLmIdx.map((i) => landmarkPosition(LANDMARKS[i]));

  const mesh = generateMesh({
    seed: windowStart,
    worldRadius: WORLD.bboxRadius,
    houseRadius: WORLD.bboxRadius,
    spacing: WORLD.spacing,
    houseCount: WORLD.houseSlots,
    anchors,
    inside: insideBody,
    samplePoint: sampleBodyPoint
  });
  const rng = mulberry32((windowStart ^ 0xa5a5) | 0);

  const occupied = Math.min(houseCount, WORLD.houseSlots);
  const nodes: WorldNode[] = mesh.junctions.map((j) => {
    if (j.anchor >= 0) return { id: j.id, x: j.x, y: j.y, kind: 'landmark' as const, ref: bodyLmIdx[j.anchor] };
    if (j.house >= 0 && j.house < occupied) return { id: j.id, x: j.x, y: j.y, kind: 'house' as const, ref: j.house };
    return { id: j.id, x: j.x, y: j.y, kind: 'junction' as const, ref: -1 };
  });
  const edges: WorldEdge[] = mesh.edges.map((e) => ({ ...e, kind: 'mesh' }));

  const px = nodes.map((n) => n.x);
  const py = nodes.map((n) => n.y);
  const degree = new Array(nodes.length).fill(0);
  const incidentIds: number[][] = nodes.map(() => []);
  for (const e of mesh.edges) {
    degree[e.a]++;
    degree[e.b]++;
    incidentIds[e.a].push(e.id);
    incidentIds[e.b].push(e.id);
  }

  let droppedSpokes = 0;
  const minAngleRad = (MESH_MIN_ANGLE_DEG * Math.PI) / 180;

  const addNode = (x: number, y: number, kind: NodeKind, ref: number): number => {
    const id = nodes.length;
    nodes.push({ id, x, y, kind, ref });
    px.push(x);
    py.push(y);
    degree.push(0);
    incidentIds.push([]);
    return id;
  };

  /** True if `cand` leaves `v` at least 35 degrees from every existing line. */
  const angleOk = (cand: MeshEdge, v: number): boolean => {
    const na = leaveAngle(cand, v);
    for (const ei of incidentIds[v]) {
      if (angDiff(na, leaveAngle(edges[ei], v)) < minAngleRad) return false;
    }
    return true;
  };

  /**
   * Adds a curved edge a-b only if it crosses nothing, keeps both endpoint
   * degrees at 4 or less, and respects the 35-degree rule at both ends.
   */
  const addEdge = (a: number, b: number, wobbly: boolean): boolean => {
    if (degree[a] >= MESH_MAX_DEGREE || degree[b] >= MESH_MAX_DEGREE) return false;
    const len = Math.hypot(px[a] - px[b], py[a] - py[b]);
    const candidates = wobbly
      ? [
          sampleEdge(edges.length, a, b, px, py, len * 0.05, makeWobble(len, rng)),
          sampleEdge(edges.length, a, b, px, py, len * 0.04),
          sampleEdge(edges.length, a, b, px, py, 0)
        ]
      : [sampleEdge(edges.length, a, b, px, py, len * 0.04), sampleEdge(edges.length, a, b, px, py, 0)];
    for (const cand of candidates) {
      const edge: WorldEdge = { ...cand, kind: 'spoke' };
      if (!angleOk(edge, a) || !angleOk(edge, b)) continue;
      if (crossesAny(edge, edges)) continue;
      edges.push(edge);
      degree[a]++;
      degree[b]++;
      incidentIds[a].push(edge.id);
      incidentIds[b].push(edge.id);
      return true;
    }
    return false;
  };

  /** Mesh junctions nearest a point (closest first, full junctions skipped). */
  const nearJunctions = (x: number, y: number, count: number): number[] => {
    return mesh.junctions
      .map((j) => ({ id: j.id, d: Math.hypot(x - j.x, y - j.y) }))
      .filter((c) => degree[c.id] < MESH_MAX_DEGREE)
      .sort((a, b) => a.d - b.d)
      .slice(0, count)
      .map((c) => c.id);
  };

  // ---- Grow the breakout clusters: star hubs with landmark spokes. ----
  const landmarkNodeByIndex: number[] = new Array(LANDMARKS.length).fill(-1);
  for (const i of bodyLmIdx) {
    // Body landmarks already sit in the mesh as anchors (junction id equals
    // anchor order because anchors are the first seeded points).
    landmarkNodeByIndex[i] = bodyLmIdx.indexOf(i);
  }

  const edgesByCluster = new Map<string, number[]>();
  const hubByCluster = new Map<string, number>();

  for (const cluster of CLUSTERS) {
    const before = edges.length;
    const hub = addNode(cluster.x, cluster.y, 'junction', -1);
    hubByCluster.set(cluster.id, hub);

    for (const li of clusterLandmarkIndexes(cluster.id)) {
      const p = landmarkPosition(LANDMARKS[li]);
      const nodeId = addNode(p.x, p.y, 'landmark', li);
      landmarkNodeByIndex[li] = nodeId;
      if (!addEdge(hub, nodeId, false)) droppedSpokes++;
    }
    for (const [angleDeg, dist] of cluster.satellites) {
      const rad = (angleDeg * Math.PI) / 180;
      const nodeId = addNode(cluster.x + Math.cos(rad) * dist, cluster.y - Math.sin(rad) * dist, 'junction', -1);
      if (!addEdge(hub, nodeId, false)) droppedSpokes++;
    }

    // The thin trail: a chain of junctions from the nearest coast junction
    // to the hub, segment length near the body's junction spacing. A failed
    // attempt is rolled back completely so no orphan nodes float in the void.
    if (cluster.link === 'trail') {
      let trailOk = false;
      for (const entry of nearJunctions(cluster.x, cluster.y, 14)) {
        const nodeMark = nodes.length;
        const edgeMark = edges.length;
        const ex = px[entry];
        const ey = py[entry];
        const dist = Math.hypot(cluster.x - ex, cluster.y - ey);
        const segments = Math.max(2, Math.round(dist / (WORLD.spacing * 1.05)));
        let prev = entry;
        let ok = true;
        for (let s = 1; s < segments; s++) {
          const t = s / segments;
          // Small perpendicular sway so the trail reads hand-laid, not ruled.
          const sway = Math.sin(t * Math.PI) * dist * 0.07 * (rng() < 0.5 ? -1 : 1);
          const nx = -(cluster.y - ey) / dist;
          const ny = (cluster.x - ex) / dist;
          const jx = ex + (cluster.x - ex) * t + nx * sway;
          const jy = ey + (cluster.y - ey) * t + ny * sway;
          const mid = addNode(jx, jy, 'junction', -1);
          if (!addEdge(prev, mid, true)) {
            ok = false;
            break;
          }
          prev = mid;
        }
        if (ok && addEdge(prev, hub, true)) {
          trailOk = true;
          break;
        }
        // Roll the failed attempt back: drop its edges (fix degrees and
        // incidence), then its nodes. Both were appended, so popping works.
        while (edges.length > edgeMark) {
          const e = edges.pop() as WorldEdge;
          degree[e.a]--;
          degree[e.b]--;
          incidentIds[e.a].pop();
          incidentIds[e.b].pop();
        }
        while (nodes.length > nodeMark) {
          nodes.pop();
          px.pop();
          py.pop();
          degree.pop();
          incidentIds.pop();
        }
      }
      if (!trailOk) droppedSpokes++;
    }

    edgesByCluster.set(
      cluster.id,
      edges.slice(before).map((e) => e.id)
    );
  }

  // ---- Communities: bubbles floating just off the coastline, one spoke
  // each (the coast has fewer junctions than bubbles; a single spoke keeps
  // every bubble attached without exhausting a junction's degree budget).
  // Bubbles may attach to any RAIL-CONNECTED node: body mesh junctions or
  // the plain junctions of trail clusters (a village on the road), never to
  // hop or wall clusters, which would secretly bridge their gap. Spokes are
  // length-capped; a longer reach gets a mid junction so no single line
  // breaks the junction-spacing rule. Failures retry nearer, farther and
  // slightly swung; every failed attempt rolls back completely.
  const railCandidateIds: number[] = [];
  for (let i = 0; i < mesh.junctions.length; i++) railCandidateIds.push(i);
  for (const cluster of CLUSTERS) {
    if (cluster.link !== 'trail') continue;
    for (const ei of edgesByCluster.get(cluster.id) ?? []) {
      for (const v of [edges[ei].a, edges[ei].b]) {
        if (nodes[v].kind === 'junction' && !railCandidateIds.includes(v)) railCandidateIds.push(v);
      }
    }
  }
  const rollbackTo = (nodeMark: number, edgeMark: number): void => {
    while (edges.length > edgeMark) {
      const e = edges.pop() as WorldEdge;
      degree[e.a]--;
      degree[e.b]--;
      incidentIds[e.a].pop();
      incidentIds[e.b].pop();
    }
    while (nodes.length > nodeMark) {
      nodes.pop();
      px.pop();
      py.pop();
      degree.pop();
      incidentIds.pop();
    }
  };
  const placedBubbles: number[] = [];
  const communityNodeBySlot: number[] = communitySlots().map((slot) => {
    const attempts: [number, number][] = [];
    for (const nudge of [0, 3, -3]) {
      for (const m of [1, 0.62, 1.5]) attempts.push([slot.angleDeg + nudge, m]);
    }
    for (const [ang, m] of attempts) {
      const coast = coastDistanceAt(ang);
      const p = rimPosition(ang, coast + WORLD.communityCoastOffset * m);
      const cands = railCandidateIds
        .map((id) => ({ id, d: Math.hypot(p.x - px[id], p.y - py[id]) }))
        .filter((c) => degree[c.id] < MESH_MAX_DEGREE && c.d < 1250)
        .sort((a, b) => a.d - b.d)
        .slice(0, 16);
      for (const cand of cands) {
        const nodeMark = nodes.length;
        const edgeMark = edges.length;
        const id = addNode(p.x, p.y, 'community', slot.slot);
        if (cand.d <= 750) {
          if (addEdge(id, cand.id, false)) {
            placedBubbles.push(id);
            return id;
          }
        } else {
          // Two segments through a mid junction, gently swayed.
          const mx = (p.x + px[cand.id]) / 2 + (rng() - 0.5) * 90;
          const my = (p.y + py[cand.id]) / 2 + (rng() - 0.5) * 90;
          const mid = addNode(mx, my, 'junction', -1);
          if (addEdge(id, mid, false) && addEdge(mid, cand.id, false)) {
            placedBubbles.push(id);
            return id;
          }
        }
        rollbackTo(nodeMark, edgeMark);
      }
    }
    // Fallback: chain onto an already-attached neighbour bubble instead (a
    // strand of bubbles along the arc still reaches the body by rail).
    {
      const coast = coastDistanceAt(slot.angleDeg);
      const p = rimPosition(slot.angleDeg, coast + WORLD.communityCoastOffset);
      const neighbours = placedBubbles
        .map((id) => ({ id, d: Math.hypot(p.x - px[id], p.y - py[id]) }))
        .filter((c) => degree[c.id] < MESH_MAX_DEGREE && c.d < 1250)
        .sort((a, b) => a.d - b.d);
      for (const cand of neighbours) {
        const nodeMark = nodes.length;
        const edgeMark = edges.length;
        const id = addNode(p.x, p.y, 'community', slot.slot);
        if (addEdge(id, cand.id, false)) {
          placedBubbles.push(id);
          return id;
        }
        rollbackTo(nodeMark, edgeMark);
      }
      // Truly stuck: keep the bubble at its nominal spot even unattached, so
      // the slot still exists; counted honestly as a dropped spoke.
      droppedSpokes++;
      return addNode(p.x, p.y, 'community', slot.slot);
    }
  });

  const incident: number[][] = nodes.map(() => []);
  for (const e of edges) {
    incident[e.a].push(e.id);
    incident[e.b].push(e.id);
  }

  // ---- Final verification: measured, never assumed. ----
  const finalCross = countCrossings(edges, WORLD.spacing);

  let minAngleDeg = 180;
  for (let v = 0; v < nodes.length; v++) {
    const list = incident[v];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const d = angDiff(leaveAngle(edges[list[i]], v), leaveAngle(edges[list[j]], v));
        minAngleDeg = Math.min(minAngleDeg, (d * 180) / Math.PI);
      }
    }
  }

  // Reachability from the spawn (the Basecamp tent inside the body).
  const basecampIdx = LANDMARKS.findIndex((lm) => lm.id === 'basecamp');
  const spawn = landmarkNodeByIndex[basecampIdx] >= 0 ? landmarkNodeByIndex[basecampIdx] : 0;
  const reachableFromSpawn: boolean[] = new Array(nodes.length).fill(false);
  reachableFromSpawn[spawn] = true;
  const queue = [spawn];
  while (queue.length) {
    const v = queue.pop() as number;
    for (const ei of incident[v]) {
      const e = edges[ei];
      const o = e.a === v ? e.b : e.a;
      if (!reachableFromSpawn[o]) {
        reachableFromSpawn[o] = true;
        queue.push(o);
      }
    }
  }
  let reachableHouses = 0;
  for (const n of nodes) {
    if (n.kind === 'house' && reachableFromSpawn[n.id]) reachableHouses++;
  }

  // ---- Gap and channel widths, measured on the real rail lines. ----
  //
  // Every edge sample point goes into one spatial grid tagged with a group:
  // its landmass, its cluster, or "spanning" for the trails and community
  // spokes that bridge the two. Both the cluster gaps and the channels then
  // fall out of the same nearest-other-group query. A pairwise scan over the
  // point lists (what pass five did) is far too slow at this world size.
  const maxHopPx = simulateMaxHop();
  const GAP_CELL = 500;
  const SPANNING = -1;
  const clusterGroupOf = new Map<string, number>();
  CLUSTERS.forEach((c, i) => clusterGroupOf.set(c.id, LANDMASS_COUNT + i));
  const edgeGroup = new Array<number>(edges.length).fill(SPANNING);
  for (const cluster of CLUSTERS) {
    for (const ei of edgesByCluster.get(cluster.id) ?? []) {
      edgeGroup[ei] = clusterGroupOf.get(cluster.id) as number;
    }
  }
  const nodeLand = nodes.map((n) => landmassAt(n.x, n.y));
  for (const e of edges) {
    if (edgeGroup[e.id] !== SPANNING) continue;
    const la = nodeLand[e.a];
    const lb = nodeLand[e.b];
    if (la >= 0 && la === lb) edgeGroup[e.id] = la;
  }

  const gx: number[] = [];
  const gy: number[] = [];
  const gg: number[] = [];
  const gridBuckets = new Map<number, number[]>();
  const gKey = (cx: number, cy: number) => (cx + 32768) * 65536 + (cy + 32768);
  for (const e of edges) {
    const grp = edgeGroup[e.id];
    for (let s = 0; s < e.pts.length; s += 2) {
      const id = gx.length;
      gx.push(e.pts[s]);
      gy.push(e.pts[s + 1]);
      gg.push(grp);
      const k = gKey(Math.floor(e.pts[s] / GAP_CELL), Math.floor(e.pts[s + 1] / GAP_CELL));
      const arr = gridBuckets.get(k);
      if (arr) arr.push(id);
      else gridBuckets.set(k, [id]);
    }
  }

  /**
   * Narrowest distance from any point of `from` to any point accepted by
   * `accept`. Ring search outward per source point, stopping as soon as the
   * ring itself is further away than the best found.
   */
  const nearestBetween = (from: number, accept: (g: number) => boolean): number => {
    let best = Infinity;
    for (let i = 0; i < gx.length; i++) {
      if (gg[i] !== from) continue;
      const cx = Math.floor(gx[i] / GAP_CELL);
      const cy = Math.floor(gy[i] / GAP_CELL);
      for (let ring = 0; ring < 40; ring++) {
        if ((ring - 1) * GAP_CELL > best) break;
        for (let ox = -ring; ox <= ring; ox++) {
          for (let oy = -ring; oy <= ring; oy++) {
            // Only the shell of each ring; the inside was covered already.
            if (ring > 0 && Math.abs(ox) !== ring && Math.abs(oy) !== ring) continue;
            const arr = gridBuckets.get(gKey(cx + ox, cy + oy));
            if (!arr) continue;
            for (const j of arr) {
              if (!accept(gg[j])) continue;
              const d = Math.hypot(gx[i] - gx[j], gy[i] - gy[j]);
              if (d < best) best = d;
            }
          }
        }
      }
    }
    return best;
  };

  const gaps: GapReport[] = [];
  for (const cluster of CLUSTERS) {
    if (cluster.link === 'trail') continue;
    const own = clusterGroupOf.get(cluster.id) as number;
    const best = nearestBetween(own, (g) => g !== own);
    gaps.push({
      cluster: cluster.id,
      link: cluster.link,
      gapPx: Math.round(best),
      ratio: Math.round((best / maxHopPx) * 100) / 100
    });
  }

  // The channels: landmass to landmass, on rail lines only.
  const channels: ChannelReport[] = [];
  for (let a = 0; a < LANDMASS_COUNT; a++) {
    for (let b = a + 1; b < LANDMASS_COUNT; b++) {
      const best = nearestBetween(a, (g) => g === b);
      channels.push({
        between: `${LANDMASS_KEYS[a]} | ${LANDMASS_KEYS[b]}`,
        gapPx: Math.round(best),
        ratio: Math.round((best / maxHopPx) * 100) / 100
      });
    }
  }

  // ---- Per-landmass rail reachability: measured INSIDE each landmass. ----
  const landmasses: LandmassReport[] = [];
  for (let land = 0; land < LANDMASS_COUNT; land++) {
    const own = nodes.filter((n) => nodeLand[n.id] === land).map((n) => n.id);
    const ownSet = new Set(own);
    const seen = new Set<number>();
    let bestComponent: number[] = [];
    for (const start of own) {
      if (seen.has(start)) continue;
      const comp: number[] = [];
      const stack = [start];
      seen.add(start);
      while (stack.length) {
        const v = stack.pop() as number;
        comp.push(v);
        for (const ei of incident[v]) {
          const e = edges[ei];
          const o = e.a === v ? e.b : e.a;
          if (!ownSet.has(o) || seen.has(o)) continue;
          seen.add(o);
          stack.push(o);
        }
      }
      if (comp.length > bestComponent.length) bestComponent = comp;
    }
    landmasses.push({
      key: LANDMASS_KEYS[land],
      junctions: own.length,
      houses: own.filter((id) => nodes[id].kind === 'house').length,
      reachableJunctions: bestComponent.length,
      reachableHouses: bestComponent.filter((id) => nodes[id].kind === 'house').length,
      fullyConnected: bestComponent.length === own.length
    });
  }

  const railClusters = CLUSTERS.filter((c) => {
    const hub = hubByCluster.get(c.id);
    return hub !== undefined && reachableFromSpawn[hub];
  }).map((c) => c.id);

  return {
    nodes,
    edges,
    incident,
    landmarkNodeByIndex,
    communityNodeBySlot,
    reachableFromSpawn,
    stats: {
      junctions: nodes.length,
      edges: edges.length,
      crossings: finalCross.count,
      landmasses,
      channels,
      minAngleDeg: Math.round(minAngleDeg * 10) / 10,
      houses: occupied,
      reachableHouses,
      landmarks: LANDMARKS.length + communitySlots().length,
      clusters: CLUSTERS.length,
      trailClusters: railClusters,
      hopOnlyClusters: CLUSTERS.filter((c) => c.link === 'hop').map((c) => c.id),
      wallClusters: CLUSTERS.filter((c) => c.link === 'wall').map((c) => c.id),
      gaps,
      maxHopPx: Math.round(maxHopPx),
      droppedSpokes,
      genMs: Date.now() - t0
    }
  };
}
