/**
 * Hive Frontend Universe - routes. The named lines of the transit map.
 *
 * A route is a NAMED LIST OF EDGE IDS: a labeled subset of the world's
 * existing mesh edges, never new geometry. Position on a route edge is still
 * edge plus fraction, exactly like everywhere else. This file is the seam:
 * more routes later means more entries in `buildRoutes`, and neither the
 * world builder nor the renderer changes.
 *
 * Two lines exist as of pass seven:
 *
 *   THE POST LINE, the flagship. Strings every live post into one continuous
 *   loop. Posts are ordered by a sweep around their centroid (forward
 *   progress, no silly backtracking) and consecutive posts are joined by
 *   shortest paths over the weave. It is a transit line, not an optimal tour,
 *   on purpose. Now that the straits are bridged it runs across the whole
 *   connected world instead of being trapped on one landmass.
 *
 *   THE DAPPS LINE, an end-to-end service rather than a loop, calling at the
 *   working destinations of the world in a west-to-east order that crosses
 *   both straits.
 */

import type { GameWorld } from '../engine/world';
import { MOVE } from '../engine/movement';
import { LANDMARKS } from './fixed-world';

export interface RouteStats {
  /** Distinct edges the line rides. */
  edgeCount: number;
  /** Full walk length in world px (shared stretches counted per pass). */
  loopLengthPx: number;
  /** Walk length in seconds of travel at rail speed. */
  travelSeconds: number;
  /** Stops actually served. */
  stopsOnLine: number;
  /** Stops the line could not reach. */
  stopsOffLine: number;
}

export interface Route {
  id: string;
  /** Distinct edge ids of the line, in first-traversal order. */
  edgeIds: number[];
  stats: RouteStats;
}

export const POST_LINE_ID = 'post-line';
export const DAPPS_LINE_ID = 'dapps-line';

/**
 * The dApps line's calling points, west to east across the connected world.
 * Landmark ids, resolved to their mesh nodes at build time; any that are not
 * body landmarks (and so have no mesh node) are skipped rather than faked.
 */
const DAPPS_LINE_STOPS = [
  'search',
  'write_post',
  'wallet',
  'communities_gate',
  'healthchecker',
  'block_explorer',
  'developer_portal'
] as const;

export function buildRoutes(world: GameWorld): Route[] {
  const ctx = routeContext(world);
  return [buildPostLine(world, ctx), buildDappsLine(world, ctx)];
}

interface RouteContext {
  incident: { edge: number; to: number; len: number }[][];
  /** Dijkstra over the body weave; null when the target is unreachable. */
  shortestPath: (src: number, dst: number) => { edges: number[]; len: number } | null;
}

/**
 * Shared machinery for every named line. Built once per `buildRoutes` call so
 * two routes do not each pay to rebuild the incidence list.
 */
function routeContext(world: GameWorld): RouteContext {
  // Lines ride the WEAVE only; they never run out a cluster spoke.
  const incident: { edge: number; to: number; len: number }[][] = world.nodes.map(() => []);
  for (const e of world.edges) {
    if (e.kind !== 'mesh') continue;
    incident[e.a].push({ edge: e.id, to: e.b, len: e.len });
    incident[e.b].push({ edge: e.id, to: e.a, len: e.len });
  }

  const shortestPath = (src: number, dst: number): { edges: number[]; len: number } | null => {
    const n = world.nodes.length;
    const dist = new Array<number>(n).fill(Infinity);
    const via = new Array<number>(n).fill(-1); // edge taken into the node
    const prev = new Array<number>(n).fill(-1);
    const done = new Array<boolean>(n).fill(false);
    dist[src] = 0;
    for (;;) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i < n; i++) {
        if (!done[i] && dist[i] < best) {
          best = dist[i];
          u = i;
        }
      }
      if (u < 0) return null;
      if (u === dst) break;
      done[u] = true;
      for (const step of incident[u]) {
        const nd = dist[u] + step.len;
        if (nd < dist[step.to]) {
          dist[step.to] = nd;
          via[step.to] = step.edge;
          prev[step.to] = u;
        }
      }
    }
    const edges: number[] = [];
    let v = dst;
    while (v !== src) {
      edges.push(via[v]);
      v = prev[v];
    }
    edges.reverse();
    return { edges, len: dist[dst] };
  };

  return { incident, shortestPath };
}

/** Walks an ordered list of stops, joining consecutive pairs by shortest path. */
function walkStops(
  ctx: RouteContext,
  ordered: number[],
  loop: boolean
): { edgeIds: number[]; lengthPx: number; on: number; off: number } {
  const walk: number[] = [];
  let lengthPx = 0;
  let on = ordered.length ? 1 : 0; // the first stop is served by definition
  let off = 0;
  let at = ordered[0];
  const legs = loop ? ordered.length : ordered.length - 1;
  for (let i = 1; i <= legs; i++) {
    const target = ordered[i % ordered.length];
    const leg = ctx.shortestPath(at, target);
    if (!leg) {
      // Unreachable stop: the line does not invent geometry to serve it.
      if (i < ordered.length) off++;
      continue;
    }
    walk.push(...leg.edges);
    lengthPx += leg.len;
    if (i < ordered.length) on++;
    at = target;
  }
  const seen = new Set<number>();
  const edgeIds: number[] = [];
  for (const id of walk) {
    if (!seen.has(id)) {
      seen.add(id);
      edgeIds.push(id);
    }
  }
  return { edgeIds, lengthPx, on, off };
}

function statsFrom(
  edgeIds: number[],
  lengthPx: number,
  on: number,
  off: number
): RouteStats {
  return {
    edgeCount: edgeIds.length,
    loopLengthPx: Math.round(lengthPx),
    travelSeconds: Math.round(lengthPx / MOVE.SPEED),
    stopsOnLine: on,
    stopsOffLine: off
  };
}

function buildPostLine(world: GameWorld, ctx: RouteContext): Route {
  const houses = world.nodes.filter((n) => n.kind === 'house');
  if (houses.length < 2) {
    return {
      id: POST_LINE_ID,
      edgeIds: [],
      stats: statsFrom([], 0, 0, houses.length)
    };
  }

  // Sweep order around the houses' centroid: forward progress by design.
  let cx = 0;
  let cy = 0;
  for (const h of houses) {
    cx += h.x;
    cy += h.y;
  }
  cx /= houses.length;
  cy /= houses.length;
  const ordered = houses
    .map((h) => ({ id: h.id, ang: Math.atan2(h.y - cy, h.x - cx) }))
    .sort((a, b) => a.ang - b.ang)
    .map((h) => h.id);

  const walked = walkStops(ctx, ordered, true);
  return {
    id: POST_LINE_ID,
    edgeIds: walked.edgeIds,
    stats: statsFrom(walked.edgeIds, walked.lengthPx, walked.on, walked.off)
  };
}

function buildDappsLine(world: GameWorld, ctx: RouteContext): Route {
  const ordered: number[] = [];
  for (const id of DAPPS_LINE_STOPS) {
    const idx = LANDMARKS.findIndex((lm) => lm.id === id);
    if (idx < 0) continue;
    const node = world.landmarkNodeByIndex[idx];
    if (node === undefined || node < 0) continue;
    ordered.push(node);
  }
  if (ordered.length < 2) {
    return { id: DAPPS_LINE_ID, edgeIds: [], stats: statsFrom([], 0, 0, ordered.length) };
  }
  const walked = walkStops(ctx, ordered, false);
  return {
    id: DAPPS_LINE_ID,
    edgeIds: walked.edgeIds,
    stats: statsFrom(walked.edgeIds, walked.lengthPx, walked.on, walked.off)
  };
}
