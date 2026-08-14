/**
 * Hive Frontend Universe — world assembly.
 *
 * Welds the layers into one travelable graph shaped like a body with limbs:
 *   - the window's woven mesh (deterministic per window) — the main body,
 *     holding the posts;
 *   - eight permanent ARMS growing off the body, each a trunk (entry → elbow
 *     → pocket hub) ending in a pocket of landmarks (lib/fixed-world.ts);
 *   - the community bubble arc on the outer edge.
 *
 * Every added line is crossing-checked against everything already placed;
 * an edge that crosses is straightened, and if it still crosses its target
 * is swapped, so planarity survives by verification rather than hope. The
 * combined graph's numbers (crossings, reachability) are measured and kept.
 */

import {
  generateMesh,
  sampleEdge,
  makeWobble,
  countCrossings,
  mulberry32,
  type MeshEdge
} from '../lib/mesh';
import {
  WORLD,
  LANDMARKS,
  ARMS,
  armLandmarks,
  communitySlots,
  rimPosition
} from '../lib/fixed-world';

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

export interface WorldStats {
  junctions: number;
  edges: number;
  crossings: number;
  minAngleDeg: number;
  houses: number;
  reachableHouses: number;
  reachableLandmarks: number;
  landmarks: number;
  arms: number;
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

/**
 * Builds the whole travelable world for a window. Deterministic given
 * `windowStart` alone; the arms and pockets are constants, so only the body
 * is rewoven. `houseCount` only says how many house slots are occupied.
 */
export function buildWorld(windowStart: number, houseCount: number): GameWorld {
  const t0 = Date.now();
  const mesh = generateMesh({
    seed: windowStart,
    worldRadius: WORLD.meshRadius,
    houseRadius: WORLD.houseRadius,
    spacing: WORLD.spacing,
    houseCount: WORLD.houseSlots
  });
  const rng = mulberry32((windowStart ^ 0xa5a5) | 0);

  const occupied = Math.min(houseCount, WORLD.houseSlots);
  const nodes: WorldNode[] = mesh.junctions.map((j) => ({
    id: j.id,
    x: j.x,
    y: j.y,
    kind: j.house >= 0 && j.house < occupied ? 'house' : 'junction',
    ref: j.house >= 0 && j.house < occupied ? j.house : -1
  }));
  const edges: WorldEdge[] = mesh.edges.map((e) => ({ ...e, kind: 'mesh' }));

  const px = nodes.map((n) => n.x);
  const py = nodes.map((n) => n.y);
  const meshDegree = new Array(nodes.length).fill(0);
  for (const e of mesh.edges) {
    meshDegree[e.a]++;
    meshDegree[e.b]++;
  }

  let droppedSpokes = 0;

  const addNode = (x: number, y: number, kind: NodeKind, ref: number): number => {
    const id = nodes.length;
    nodes.push({ id, x, y, kind, ref });
    px.push(x);
    py.push(y);
    meshDegree.push(0);
    return id;
  };

  /** Adds a curved edge a→b if it crosses nothing; falls back to straight. */
  const addEdge = (a: number, b: number, wobbly: boolean): boolean => {
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
      if (!crossesAny(edge, edges)) {
        edges.push(edge);
        meshDegree[a]++;
        meshDegree[b]++;
        return true;
      }
    }
    return false;
  };

  /** Nearest mesh junction to a rim point, preferring uncrowded ones. */
  const entryJunction = (x: number, y: number): number => {
    const order = mesh.junctions
      .map((j) => ({ id: j.id, d: Math.hypot(x - j.x, y - j.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 16);
    for (const cand of order) if (meshDegree[cand.id] <= 3) return cand.id;
    return order[0].id;
  };

  // ---- Grow the arms: entry → elbow → pocket hub → landmark nodes. ----
  const landmarkNodeByIndex: number[] = new Array(LANDMARKS.length).fill(-1);
  for (const arm of ARMS) {
    const pocket = armLandmarks(arm.id);
    if (!pocket.length) continue;
    const entryPt = rimPosition(arm.angleDeg, WORLD.meshRadius * 0.97);
    const entry = entryJunction(entryPt.x, entryPt.y);

    const elbowJitter = (rng() - 0.5) * 9;
    const elbowPt = rimPosition(arm.angleDeg + elbowJitter, WORLD.meshRadius + WORLD.armReach * 0.45);
    const hubPt = rimPosition(arm.angleDeg, WORLD.meshRadius + WORLD.armReach);
    const elbow = addNode(elbowPt.x, elbowPt.y, 'junction', -1);
    const hub = addNode(hubPt.x, hubPt.y, 'junction', -1);

    let trunkOk = addEdge(entry, elbow, true);
    if (!trunkOk) {
      // Try a different entry before giving up; never strand an arm silently.
      const alt = entryJunction(elbowPt.x, elbowPt.y);
      trunkOk = alt !== entry && addEdge(alt, elbow, true);
    }
    if (!trunkOk) droppedSpokes++;
    if (!addEdge(elbow, hub, true)) droppedSpokes++;

    // Pocket: fan the landmarks out LOCALLY around the hub (offsets are
    // relative to the hub, not polar rotations of the whole world), worlds
    // get more room so their structures read as places.
    const n = pocket.length;
    pocket.forEach((lm, k) => {
      const spreadDeg = n === 1 ? 0 : (k - (n - 1) / 2) * 46;
      const outDir = ((arm.angleDeg + spreadDeg) * Math.PI) / 180;
      const dist = lm.world ? 820 : 560 + (k % 2) * 150;
      const x = hubPt.x + Math.cos(outDir) * dist;
      const y = hubPt.y - Math.sin(outDir) * dist;
      const nodeId = addNode(x, y, 'landmark', LANDMARKS.indexOf(lm));
      landmarkNodeByIndex[LANDMARKS.indexOf(lm)] = nodeId;
      if (!addEdge(hub, nodeId, false)) droppedSpokes++;
    });
  }

  // ---- Communities: bubbles on their arc, two spokes each into the mesh. ----
  const communityNodeBySlot: number[] = communitySlots().map((slot) => {
    const p = rimPosition(slot.angleDeg, WORLD.communityRadius);
    const id = addNode(p.x, p.y, 'community', slot.slot);
    let connected = 0;
    const order = mesh.junctions
      .map((j) => ({ id: j.id, d: Math.hypot(p.x - j.x, p.y - j.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 16);
    for (const cand of order) {
      if (connected >= 2) break;
      if (connected === 0 || meshDegree[cand.id] <= 3) {
        if (addEdge(id, cand.id, false)) connected++;
      }
    }
    if (connected === 0) droppedSpokes++;
    return id;
  });

  const incident: number[][] = nodes.map(() => []);
  for (const e of edges) {
    incident[e.a].push(e.id);
    incident[e.b].push(e.id);
  }

  // Final combined verification, measured not assumed.
  const finalCross = countCrossings(edges, WORLD.spacing);
  const seen = new Set<number>([0]);
  const queue = [0];
  while (queue.length) {
    const v = queue.pop() as number;
    for (const ei of incident[v]) {
      const e = edges[ei];
      const o = e.a === v ? e.b : e.a;
      if (!seen.has(o)) {
        seen.add(o);
        queue.push(o);
      }
    }
  }
  let reachableHouses = 0;
  let reachableLandmarks = 0;
  for (const n of nodes) {
    if (n.kind === 'house' && seen.has(n.id)) reachableHouses++;
    if ((n.kind === 'landmark' || n.kind === 'community') && seen.has(n.id)) reachableLandmarks++;
  }

  return {
    nodes,
    edges,
    incident,
    landmarkNodeByIndex,
    communityNodeBySlot,
    stats: {
      junctions: nodes.length,
      edges: edges.length,
      crossings: finalCross.count,
      minAngleDeg: mesh.stats.minAngleDeg,
      houses: occupied,
      reachableHouses,
      reachableLandmarks,
      landmarks: LANDMARKS.length + communitySlots().length,
      arms: ARMS.length,
      droppedSpokes,
      genMs: Date.now() - t0
    }
  };
}
