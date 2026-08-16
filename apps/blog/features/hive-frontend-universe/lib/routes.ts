/**
 * Hive Frontend Universe - routes. The first subway route: THE POST LINE.
 *
 * A route is a NAMED LIST OF EDGE IDS: a labeled subset of the world's
 * existing mesh edges, never new geometry. Position on a route edge is still
 * edge plus fraction, exactly like everywhere else. This file is the seam:
 * more routes later means more entries in `buildRoutes`, and neither the
 * world builder nor the renderer changes.
 *
 * The post line strings every live post into one continuous loop through the
 * body: posts are ordered by a sweep around their centroid (forward progress,
 * no silly backtracking), consecutive posts joined by shortest paths over the
 * body weave. It is a transit line, not an optimal tour, on purpose.
 */

import type { GameWorld } from '../engine/world';
import { MOVE } from '../engine/movement';

export interface RouteStats {
  /** Distinct edges the line rides. */
  edgeCount: number;
  /** Full loop walk length in world px (shared stretches counted per pass). */
  loopLengthPx: number;
  /** Loop walk length in seconds at rail speed. */
  travelSeconds: number;
  postsOnLine: number;
  /** Posts the line could not reach (wilderness posts). */
  postsOffLine: number;
}

export interface Route {
  id: string;
  /** Distinct edge ids of the line, in first-traversal order. */
  edgeIds: number[];
  stats: RouteStats;
}

export const POST_LINE_ID = 'post-line';

export function buildRoutes(world: GameWorld): Route[] {
  return [buildPostLine(world)];
}

function buildPostLine(world: GameWorld): Route {
  const houses = world.nodes.filter((n) => n.kind === 'house');
  const empty: Route = {
    id: POST_LINE_ID,
    edgeIds: [],
    stats: { edgeCount: 0, loopLengthPx: 0, travelSeconds: 0, postsOnLine: 0, postsOffLine: houses.length }
  };
  if (houses.length < 2) return empty;

  // The line rides the BODY WEAVE only; it never runs out a spoke or trail.
  const incident: { edge: number; to: number; len: number }[][] = world.nodes.map(() => []);
  for (const e of world.edges) {
    if (e.kind !== 'mesh') continue;
    incident[e.a].push({ edge: e.id, to: e.b, len: e.len });
    incident[e.b].push({ edge: e.id, to: e.a, len: e.len });
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

  /** Dijkstra from `src` until `dst`, over the body weave. O(V^2), V ~200. */
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

  const walk: number[] = [];
  let loopLengthPx = 0;
  let postsOnLine = 1; // the starting post is on the line by definition
  let postsOffLine = 0;
  let at = ordered[0];
  for (let i = 1; i <= ordered.length; i++) {
    const target = ordered[i % ordered.length];
    const leg = shortestPath(at, target);
    if (!leg) {
      // A wilderness post: the line does not jump gaps to reach it.
      if (i < ordered.length) postsOffLine++;
      continue;
    }
    walk.push(...leg.edges);
    loopLengthPx += leg.len;
    if (i < ordered.length) postsOnLine++;
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

  return {
    id: POST_LINE_ID,
    edgeIds,
    stats: {
      edgeCount: edgeIds.length,
      loopLengthPx: Math.round(loopLengthPx),
      travelSeconds: Math.round(loopLengthPx / MOVE.SPEED),
      postsOnLine,
      postsOffLine
    }
  };
}
