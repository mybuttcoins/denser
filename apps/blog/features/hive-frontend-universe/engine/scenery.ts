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
