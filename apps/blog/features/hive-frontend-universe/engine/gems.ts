'use client';

/**
 * Hive Frontend Universe - GEMS.
 *
 * Colorful faceted eye candy, straight from Bryan's board-game-store brief:
 * "could be just spread through game play to collect... maybe we find a
 * reason for these emeralds and things later." So: they sparkle, they are a
 * joy to grab, they count in the HUD, and they deliberately do NOTHING else
 * yet. No economy, no persistence; a fresh scatter every 30-minute board.
 *
 * Placement is seeded from the window like the tokens: most gems sit along
 * the rails where riding finds them, and a bright minority floats out in
 * the void pockets so the unused spaces glitter with something worth a
 * detour (the "use all our real estate" directive).
 */

import type { GameWorld } from './world';
import { posAt } from './movement';
import { mulberry32 } from '../lib/mesh';
import { ISLAND_CHIPS } from '../lib/fixed-world';

export interface Gem {
  x: number;
  y: number;
  /** Index into GEM_COLORS; fixed per gem. */
  color: number;
  taken: boolean;
}

export interface GemState {
  gems: Gem[];
  collected: number;
}

/** Bold sticker cuts: emerald, ruby-pink, amber, sapphire, amethyst, pink. */
export const GEM_COLORS: readonly { fill: string; lite: string }[] = [
  { fill: '#4CE0A0', lite: '#b8ffe0' },
  { fill: '#FF5C8A', lite: '#ffc2d4' },
  { fill: '#FFC14D', lite: '#ffe8b8' },
  { fill: '#5CA8FF', lite: '#c2ddff' },
  { fill: '#B98AFF', lite: '#e4d2ff' },
  { fill: '#FF9EDA', lite: '#ffd6f0' }
];

/** How close the bug must pass to collect, world px. */
const COLLECT_RANGE = 80;
const ON_RAILS = 22;
const IN_VOID = 12;

const scratch = { x: 0, y: 0 };

export function createGems(world: GameWorld, seed: number): GemState {
  const rng = mulberry32((seed ^ 0x9e35) | 0);
  const gems: Gem[] = [];
  // Along the rails, weighted by edge length so busy stretches get more.
  for (let k = 0; k < ON_RAILS; k++) {
    const e = world.edges[Math.floor(rng() * world.edges.length)];
    if (!e) continue;
    posAt(e, 0.15 + rng() * 0.7, scratch);
    gems.push({
      x: scratch.x + (rng() - 0.5) * 60,
      y: scratch.y + (rng() - 0.5) * 60,
      color: Math.floor(rng() * GEM_COLORS.length),
      taken: false
    });
  }
  // Out in the void, clustered near the floating island chips so the
  // pockets glitter and a detour has a destination.
  for (let k = 0; k < IN_VOID; k++) {
    const chip = ISLAND_CHIPS[Math.floor(rng() * ISLAND_CHIPS.length)];
    const a = rng() * 6.283;
    const d = 120 + rng() * 260;
    gems.push({
      x: chip.x + Math.cos(a) * d,
      y: chip.y + Math.sin(a) * d,
      color: Math.floor(rng() * GEM_COLORS.length),
      taken: false
    });
  }
  return { gems, collected: 0 };
}

/** Collect by proximity, any mode. Session-only on purpose. */
export function updateGems(state: GemState, px: number, py: number): void {
  const r2 = COLLECT_RANGE * COLLECT_RANGE;
  for (const g of state.gems) {
    if (g.taken) continue;
    const dx = g.x - px;
    const dy = g.y - py;
    if (dx * dx + dy * dy <= r2) {
      g.taken = true;
      state.collected++;
    }
  }
}

/**
 * A chunky faceted sticker gem: dark outline, bold fill, one light facet,
 * and a single white facet-flash every few seconds (the sparkle rule: one
 * wink, never a strobe).
 */
export function drawGems(
  ctx: CanvasRenderingContext2D,
  state: GemState,
  time: number,
  vis: (x: number, y: number) => boolean
): void {
  for (let i = 0; i < state.gems.length; i++) {
    const g = state.gems[i];
    if (g.taken || !vis(g.x, g.y)) continue;
    const c = GEM_COLORS[g.color];
    const bob = Math.sin(time * 1.4 + i * 1.7) * 3;
    const x = g.x;
    const y = g.y + bob;
    const s = 11;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((i * 37) % 12) * 0.06 - 0.35);
    // The cut: a hexagonal brilliant with a flat table.
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.35);
    ctx.lineTo(s * 0.55, -s * 0.35);
    ctx.lineTo(s * 0.95, s * 0.05);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.95, s * 0.05);
    ctx.closePath();
    ctx.fillStyle = c.fill;
    ctx.fill();
    ctx.strokeStyle = '#141019';
    ctx.lineWidth = 2.6;
    ctx.lineJoin = 'round';
    ctx.stroke();
    // Table facet, lighter.
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.35);
    ctx.lineTo(s * 0.55, -s * 0.35);
    ctx.lineTo(s * 0.2, s * 0.1);
    ctx.lineTo(-s * 0.2, s * 0.1);
    ctx.closePath();
    ctx.fillStyle = c.lite;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    // Facet lines.
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, s * 0.1);
    ctx.lineTo(0, s);
    ctx.moveTo(s * 0.2, s * 0.1);
    ctx.lineTo(0, s);
    ctx.stroke();
    // The wink: one white facet flash every 4-8 seconds, offset per gem.
    const cycle = (time / (4 + (i % 5))) % 1;
    if (cycle > 0.94) {
      ctx.globalAlpha = 0.9 * (1 - (cycle - 0.94) / 0.06);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, -s * 0.35);
      ctx.lineTo(0, -s * 0.35);
      ctx.lineTo(-s * 0.2, s * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}
