/**
 * Hive Frontend Universe — operation flows.
 *
 * The moving life of the map, painted from the window's REAL operation
 * counts (the board's ambient numbers): votes, custom_json, comments and
 * transfers each get their own shape, colour, speed and density, with
 * density derived proportionally from the real counts — a busy window
 * visibly pulses harder than a quiet one. Individual particles are not
 * individually real; the bulk numbers they are derived from are.
 *
 * Particles spawn only on lines near the player (an optimisation, not a
 * cheat: density per unit of line is uniform), so the crowd is where the
 * camera is. Purely visual; nothing collides.
 */

import type { GameWorld } from './world';
import type { AmbientCounts } from '../lib/board';

export type FlowType = 'vote' | 'customJson' | 'comment' | 'transfer';

export interface FlowParticle {
  type: FlowType;
  edge: number;
  t: number;
  dir: 1 | -1;
  /** World px per second along the line. */
  speed: number;
}

export interface FlowConfig {
  /** Concurrent particles per 1000px of nearby line, per type. */
  density: Record<FlowType, number>;
  counts: AmbientCounts;
}

/** World px per second along the line, per type. Transfers move deliberately. */
export const FLOW_SPEED: Record<FlowType, number> = {
  vote: 260,
  customJson: 165,
  comment: 95,
  transfer: 60
};

/**
 * Converts the window's real counts into per-type line densities. The divisor
 * is the tuning knob: it maps "operations per window" to "concurrent
 * particles per 1000px of line". Chosen deliberately hot — a typical window
 * (roughly 4000 votes, 8000 json, 300 comments, 100 transfers) yields a
 * visibly busy screen, and a double-rate window doubles it.
 */
export function flowConfig(counts: AmbientCounts): FlowConfig {
  const PER = 1600;
  return {
    counts,
    density: {
      vote: counts.votes / PER,
      customJson: counts.customJson / PER,
      comment: counts.comments / PER,
      transfer: counts.transfers / PER
    }
  };
}

const RANGE = 2400; // spawn on edges whose midpoint is within this of the player
const HARD_CAP = 900;

interface EdgeMid {
  x: number;
  y: number;
}

export interface FlowState {
  particles: FlowParticle[];
  mids: EdgeMid[];
  nearEdges: number[];
  nearLen: number;
  refresh: number;
}

export function createFlows(world: GameWorld): FlowState {
  const mids: EdgeMid[] = world.edges.map((e) => {
    const m = Math.floor(e.pts.length / 4) * 2;
    return { x: e.pts[m], y: e.pts[m + 1] };
  });
  return { particles: [], mids, nearEdges: [], nearLen: 0, refresh: 0 };
}

export function updateFlows(
  state: FlowState,
  world: GameWorld,
  config: FlowConfig,
  playerX: number,
  playerY: number,
  dt: number
): void {
  // Refresh the nearby-edge set a few times a second, not every frame.
  state.refresh -= dt;
  if (state.refresh <= 0) {
    state.refresh = 0.4;
    state.nearEdges = [];
    state.nearLen = 0;
    for (let i = 0; i < world.edges.length; i++) {
      const m = state.mids[i];
      if (Math.hypot(m.x - playerX, m.y - playerY) < RANGE) {
        state.nearEdges.push(i);
        state.nearLen += world.edges[i].len;
      }
    }
  }

  // Advance, recycle when off the end or far away.
  const parts = state.particles;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    const e = world.edges[p.edge];
    p.t += (p.dir * p.speed * dt) / e.len;
    if (p.t <= 0 || p.t >= 1) {
      parts.splice(i, 1);
      continue;
    }
    const m = state.mids[p.edge];
    if (Math.hypot(m.x - playerX, m.y - playerY) > RANGE * 1.6) parts.splice(i, 1);
  }

  // Spawn to meet each type's target for the nearby line length.
  if (!state.nearEdges.length) return;
  const perThousand = state.nearLen / 1000;
  const countByType: Record<FlowType, number> = { vote: 0, customJson: 0, comment: 0, transfer: 0 };
  for (const p of parts) countByType[p.type]++;
  for (const type of ['vote', 'customJson', 'comment', 'transfer'] as FlowType[]) {
    const target = Math.min(Math.round(config.density[type] * perThousand), HARD_CAP);
    let need = target - countByType[type];
    let guard = 0;
    while (need > 0 && parts.length < HARD_CAP && guard++ < 60) {
      const edge = state.nearEdges[Math.floor(Math.random() * state.nearEdges.length)];
      parts.push({
        type,
        edge,
        t: Math.random(),
        dir: Math.random() < 0.5 ? 1 : -1,
        speed: FLOW_SPEED[type] * (0.75 + Math.random() * 0.5)
      });
      need--;
    }
  }
}
