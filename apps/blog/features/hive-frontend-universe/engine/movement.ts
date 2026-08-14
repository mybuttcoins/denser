/**
 * Hive Frontend Universe — movement on curved lines.
 *
 * Pure, DOM-free. The bug rides the world's curved edges (rail mode) and can
 * leap into open space (drift mode) with a countdown before the signal is
 * lost, snapping onto any line it passes near.
 *
 * A player's position is always two numbers — which edge, and how far along
 * it (t, a fraction of arc length). That rule is load-bearing: it is what will
 * let other players' positions be shared cheaply later. Do not add position
 * state outside `edge` + `t`.
 */

import type { WorldEdge } from './world';

export interface Vec2 {
  x: number;
  y: number;
}

export interface PlayerState {
  mode: 'rail' | 'drift';
  /** Which edge the bug is on. One of the two position numbers. */
  edge: number;
  /** How far along it, 0..1 of arc length. The other position number. */
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuel: number;
  air: number;
  face: number;
  still: number;
  walk: number;
  lastNode: number;
  /** Node the bug is parked on (opens its house/landmark), or -1. */
  atNode: number;
  /** A node the player chose to skip, so it does not instantly re-open. */
  skipped: number;
  /** Stun timer after a lost signal. */
  stuck: number;
}

export const MOVE = {
  // 330 keeps junction-to-junction travel at ~1.8s (in the 1.5-2s spec) while
  // trimming the world-crossing time; measured effective speed on winding
  // rails is ~72% of nominal.
  SPEED: 330,
  DRIFT_ACC: 360,
  DRIFT_MAX: 360,
  JUMPV: 400,
  DRAG: 0.55,
  DRIFT_TIME: 2.4,
  SNAP: 22,
  /** How long you must rest at a junction before its place opens. */
  DWELL: 0.32
} as const;

export type Incident = number[][];

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

/** Point on an edge at arc-length fraction t. */
export function posAt(e: WorldEdge, t: number, out: Vec2): void {
  const s = clamp(t, 0, 1) * e.len;
  const cum = e.cum;
  let lo = 0;
  let hi = cum.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1;
  const f = (s - cum[lo]) / seg;
  out.x = e.pts[lo * 2] + (e.pts[hi * 2] - e.pts[lo * 2]) * f;
  out.y = e.pts[lo * 2 + 1] + (e.pts[hi * 2 + 1] - e.pts[lo * 2 + 1]) * f;
}

/** Unit tangent (in the a→b direction) at arc-length fraction t. */
export function tangentAt(e: WorldEdge, t: number, out: Vec2): void {
  const s = clamp(t, 0, 1) * e.len;
  const cum = e.cum;
  let lo = 0;
  let hi = cum.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid;
  }
  const dx = e.pts[hi * 2] - e.pts[lo * 2];
  const dy = e.pts[hi * 2 + 1] - e.pts[lo * 2 + 1];
  const d = Math.hypot(dx, dy) || 1;
  out.x = dx / d;
  out.y = dy / d;
}

/** Unit direction an edge leaves node `v` in. */
function leaveDir(e: WorldEdge, v: number, out: Vec2): void {
  const p = e.pts;
  if (e.a === v) {
    const d = Math.hypot(p[2] - p[0], p[3] - p[1]) || 1;
    out.x = (p[2] - p[0]) / d;
    out.y = (p[3] - p[1]) / d;
  } else {
    const m = p.length;
    const d = Math.hypot(p[m - 4] - p[m - 2], p[m - 3] - p[m - 1]) || 1;
    out.x = (p[m - 4] - p[m - 2]) / d;
    out.y = (p[m - 3] - p[m - 1]) / d;
  }
}

export function createPlayer(): PlayerState {
  return {
    mode: 'rail',
    edge: 0,
    t: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    fuel: 0,
    air: 0,
    face: 1,
    still: 0,
    walk: 0,
    lastNode: 0,
    atNode: -1,
    skipped: -1,
    stuck: 0
  };
}

const scratch: Vec2 = { x: 0, y: 0 };

function syncRailPos(p: PlayerState, edges: WorldEdge[]): void {
  posAt(edges[p.edge], p.t, scratch);
  p.x = scratch.x;
  p.y = scratch.y;
}

/** Parks the bug on a node (spawn, and after a lost signal). */
export function placeAt(p: PlayerState, edges: WorldEdge[], incident: Incident, nodeId: number): void {
  p.mode = 'rail';
  p.edge = incident[nodeId].length ? incident[nodeId][0] : 0;
  p.t = edges[p.edge].a === nodeId ? 0 : 1;
  p.vx = 0;
  p.vy = 0;
  p.stuck = 0;
  p.lastNode = nodeId;
  p.atNode = nodeId;
  p.still = 0;
  syncRailPos(p, edges);
}

/** Leap off the current line in the input direction (or straight ahead). */
export function jump(p: PlayerState, edges: WorldEdge[], input: Vec2): void {
  if (p.mode !== 'rail' || p.stuck > 0) return;
  syncRailPos(p, edges);
  tangentAt(edges[p.edge], p.t, scratch);
  const im = Math.hypot(input.x, input.y);
  p.mode = 'drift';
  p.air = 0;
  p.fuel = MOVE.DRIFT_TIME;
  p.atNode = -1;
  if (im > 0.25) {
    p.vx = (input.x / im) * MOVE.JUMPV;
    p.vy = (input.y / im) * MOVE.JUMPV;
  } else {
    const s = p.t > 0.5 ? 1 : -1;
    p.vx = scratch.x * MOVE.JUMPV * s;
    p.vy = scratch.y * MOVE.JUMPV * s;
  }
}

export interface RailResult {
  /** A node newly arrived at this step, or -1. */
  visited: number;
}

const dir: Vec2 = { x: 0, y: 0 };

/** Advance along the current curve; at junctions, follow the pushed direction. */
export function railUpdate(
  p: PlayerState,
  edges: WorldEdge[],
  incident: Incident,
  input: Vec2,
  dt: number
): RailResult {
  let e = edges[p.edge];
  tangentAt(e, p.t, dir);
  const slow = p.stuck > 0 ? 0.24 : 1;
  const proj = (input.x * dir.x + input.y * dir.y) * slow;

  if (Math.abs(proj) > 0.02) {
    p.walk += dt * Math.abs(proj);
    p.face = proj * dir.x >= 0 ? 1 : -1;
    p.still = 0;
  } else {
    p.still += dt;
  }
  p.vx = dir.x * proj * MOVE.SPEED;
  p.vy = dir.y * proj * MOVE.SPEED;
  p.t += (proj * MOVE.SPEED * dt) / e.len;

  let visited = -1;
  let guard = 0;
  while ((p.t >= 1 || p.t <= 0) && guard++ < 6) {
    const atId = p.t >= 1 ? edges[p.edge].b : edges[p.edge].a;
    visited = atId;
    p.lastNode = atId;

    let pick = -1;
    let bestDot = 0.2;
    const im = Math.hypot(input.x, input.y);
    if (im > 0.15) {
      for (const ei of incident[atId]) {
        leaveDir(edges[ei], atId, dir);
        const dot = (input.x / im) * dir.x + (input.y / im) * dir.y;
        if (dot > bestDot) {
          bestDot = dot;
          pick = ei;
        }
      }
    }
    if (pick < 0) {
      p.t = clamp(p.t, 0, 1);
      break;
    }
    p.edge = pick;
    e = edges[p.edge];
    p.t = e.a === atId ? 0.001 : 0.999;
  }

  p.t = clamp(p.t, 0, 1);
  syncRailPos(p, edges);

  // Resting at a junction opens the place, unless it was skipped.
  const ne = edges[p.edge];
  const endId = p.t > 0.985 ? ne.b : p.t < 0.015 ? ne.a : -1;
  if (endId >= 0 && p.still > MOVE.DWELL && endId !== p.skipped) {
    p.atNode = endId;
  } else if (endId < 0) {
    p.atNode = -1;
    p.skipped = -1;
  }

  return { visited };
}

export interface DriftResult {
  landed: boolean;
  signalLost: boolean;
}

/** Free flight with a fuel countdown; snaps to any curve passed near. */
export function driftUpdate(
  p: PlayerState,
  edges: WorldEdge[],
  input: Vec2,
  dt: number
): DriftResult {
  p.air += dt;
  p.fuel -= dt;
  p.vx += input.x * MOVE.DRIFT_ACC * dt;
  p.vy += input.y * MOVE.DRIFT_ACC * dt;
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > MOVE.DRIFT_MAX) {
    p.vx = (p.vx / sp) * MOVE.DRIFT_MAX;
    p.vy = (p.vy / sp) * MOVE.DRIFT_MAX;
  }
  p.vx -= p.vx * MOVE.DRAG * dt;
  p.vy -= p.vy * MOVE.DRAG * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (Math.abs(p.vx) > 6) p.face = p.vx > 0 ? 1 : -1;

  if (p.air > 0.13) {
    let bestE = -1;
    let bestT = 0;
    let bestD: number = MOVE.SNAP;
    for (const e of edges) {
      // Cheap bbox precheck against the sampled curve.
      if (
        p.x < Math.min(e.pts[0], e.pts[e.pts.length - 2]) - e.len * 0.3 - MOVE.SNAP ||
        p.x > Math.max(e.pts[0], e.pts[e.pts.length - 2]) + e.len * 0.3 + MOVE.SNAP ||
        p.y < Math.min(e.pts[1], e.pts[e.pts.length - 1]) - e.len * 0.3 - MOVE.SNAP ||
        p.y > Math.max(e.pts[1], e.pts[e.pts.length - 1]) + e.len * 0.3 + MOVE.SNAP
      ) {
        continue;
      }
      for (let s = 0; s < e.pts.length - 2; s += 2) {
        const ax = e.pts[s];
        const ay = e.pts[s + 1];
        const bx = e.pts[s + 2];
        const by = e.pts[s + 3];
        const dx = bx - ax;
        const dy = by - ay;
        const L = dx * dx + dy * dy || 1;
        const f = clamp(((p.x - ax) * dx + (p.y - ay) * dy) / L, 0, 1);
        const qx = ax + dx * f;
        const qy = ay + dy * f;
        const d = Math.hypot(p.x - qx, p.y - qy);
        if (d < bestD) {
          bestD = d;
          bestE = e.id;
          bestT = (e.cum[s / 2] + Math.hypot(qx - ax, qy - ay)) / e.len;
        }
      }
    }
    if (bestE >= 0) {
      p.mode = 'rail';
      p.edge = bestE;
      p.t = clamp(bestT, 0, 1);
      p.still = 0;
      syncRailPos(p, edges);
      return { landed: true, signalLost: false };
    }
  }

  if (p.fuel <= 0) return { landed: false, signalLost: true };
  return { landed: false, signalLost: false };
}
