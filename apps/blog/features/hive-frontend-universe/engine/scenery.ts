/**
 * Hive Frontend Universe — scenery. Visible but inert.
 *
 * Transparent cubes at junctions (texture now, obstacle placeholders later)
 * and json factories that pulse and spit diamonds down the lines. Nothing
 * collides, nothing opens, nothing can be entered.
 *
 * THE SEAM: cubes become obstacles and factories become real custom_json
 * activity later. Placement is deterministic from the window seed so every
 * player sees the same scenery; keep the Cube/Factory shapes and replace the
 * place* functions with data-fed versions when the time comes — the renderer
 * will not change. Particle FLOWS live in `particles.ts`, not here.
 */

import type { GameWorld } from './world';
import { insideBody, sampleBodyPoint } from '../lib/fixed-world';

/**
 * A spiky rock formation standing on the landmass: a clutch of crystalline
 * shards with lit tips, the terrain of a space base rather than a park. Inert
 * scenery, exactly like the cubes; nothing collides with these.
 */
export interface Formation {
  x: number;
  y: number;
  /** Height of the tallest shard, world px. */
  h: number;
  /** How many shards in the clutch. */
  shards: number;
  /** Index into the formation palette. */
  hue: number;
  /** Seeded shape phase, so no two clutches are identical. */
  phase: number;
  /** Lean of the whole clutch, radians. */
  lean: number;
}

export interface Factory {
  junction: number;
  x: number;
  y: number;
  /** Pulse phase offset, cosmetic. */
  phase: number;
}

export interface Cube {
  x: number;
  y: number;
  size: number;
  /** Index into the cube palette. */
  hue: number;
  alpha: number;
}

const FACTORY_EVERY = 20; // roughly one factory per this many plain junctions
const FACTORY_OFFSET = 120;
const CUBE_CHANCE = 0.32; // fraction of plain junctions that get a cube

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic factory placement beside plain junctions, spread throughout. */
export function placeFactories(world: GameWorld, seed: number): Factory[] {
  const rng = mulberry32(seed ^ 0x5eed);
  const factories: Factory[] = [];
  let countdown = Math.floor(rng() * FACTORY_EVERY);
  for (const node of world.nodes) {
    if (node.kind !== 'junction') continue;
    if (countdown-- > 0) continue;
    countdown = FACTORY_EVERY - 5 + Math.floor(rng() * 10);
    const ang = rng() * Math.PI * 2;
    factories.push({
      junction: node.id,
      x: node.x + Math.cos(ang) * FACTORY_OFFSET,
      y: node.y + Math.sin(ang) * FACTORY_OFFSET,
      phase: rng() * Math.PI * 2
    });
  }
  return factories;
}

/** How many rock formations to scatter over the whole landmass. */
const FORMATION_COUNT = 190;
/** Formations keep this clear of any junction so they never sit on a line. */
const FORMATION_CLEARANCE = 260;

/**
 * Spiky rock formations scattered across the terrain, well spread and well
 * clear of the rails. Placement is rejection-sampled inside the landmass mask,
 * so formations never appear in the void or on a strait bridge, and never
 * crowd a junction the player has to read.
 */
export function placeFormations(world: GameWorld, seed: number): Formation[] {
  const rng = mulberry32(seed ^ 0x5caff0);
  const out: Formation[] = [];
  // A coarse bucket grid over the nodes, so the clearance test stays cheap.
  const CELL = FORMATION_CLEARANCE;
  const buckets = new Map<number, { x: number; y: number }[]>();
  const key = (cx: number, cy: number) => (cx + 4096) * 8192 + (cy + 4096);
  for (const n of world.nodes) {
    const k = key(Math.floor(n.x / CELL), Math.floor(n.y / CELL));
    const arr = buckets.get(k);
    if (arr) arr.push(n);
    else buckets.set(k, [n]);
  }
  const tooCloseToRail = (x: number, y: number): boolean => {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (const n of buckets.get(key(cx + ox, cy + oy)) ?? []) {
          if (Math.hypot(n.x - x, n.y - y) < FORMATION_CLEARANCE) return true;
        }
      }
    }
    return false;
  };

  for (let attempt = 0; attempt < FORMATION_COUNT * 14 && out.length < FORMATION_COUNT; attempt++) {
    const p = sampleBodyPoint(rng);
    if (!insideBody(p.x, p.y) || tooCloseToRail(p.x, p.y)) continue;
    const big = rng() < 0.16;
    out.push({
      x: p.x,
      y: p.y,
      h: big ? 210 + rng() * 190 : 70 + rng() * 110,
      shards: 2 + Math.floor(rng() * 4),
      hue: Math.floor(rng() * 5),
      phase: rng() * Math.PI * 2,
      lean: (rng() - 0.5) * 0.34
    });
  }
  return out;
}

/**
 * Transparent cubes in many colours and sizes, sitting at junctions, mixed
 * through the whole map. Size skews small with a few big ones, for depth.
 */
export function placeCubes(world: GameWorld, seed: number): Cube[] {
  const rng = mulberry32(seed ^ 0xc0be);
  const cubes: Cube[] = [];
  for (const node of world.nodes) {
    if (node.kind !== 'junction') continue;
    if (rng() > CUBE_CHANCE) continue;
    const big = rng() < 0.18;
    cubes.push({
      x: node.x,
      y: node.y,
      size: big ? 55 + rng() * 45 : 16 + rng() * 26,
      hue: Math.floor(rng() * 5),
      alpha: 0.16 + rng() * 0.2
    });
  }
  return cubes;
}
