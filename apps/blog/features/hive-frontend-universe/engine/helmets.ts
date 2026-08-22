'use client';

/**
 * Hive Frontend Universe - the 21 OXYGEN HELMETS.
 *
 * The upgrade ladder of this world, and the key to its endgame. Out past the
 * coasts the void has no air, which is why one drift ring is all a bare bug
 * gets. Twenty-one helmets are hidden around the world; every one collected
 * compiles into the same suit, the bubble around the bug grows a little, and
 * every jump gets more oxygen: fuel is multiplied by `o2Multiplier(count)`.
 * With all 21 the bug breathes three and a half rings' worth, which is what
 * it takes to reach the Mighty J SON's keep at the edge of the world.
 *
 * Why 21: one helmet for each consensus witness. The keepers of the chain
 * left their spare air out there for whoever bothers to explore.
 *
 * PLACEMENT IS FIXED FOREVER, not per window: hidden things are only worth
 * hiding if players can learn the spots, tell each other, and go back. Land
 * helmets are seeded from a constant; void helmets are hand-placed, several
 * of them forming a breadcrumb line toward the keep.
 *
 * PROGRESS PERSISTS in localStorage (permanent, it is an achievement).
 * Nothing here touches movement.ts: the multiplier is applied by the caller
 * AFTER the existing jump() runs, by topping up the fuel the jump granted.
 */

import { sampleBodyPoint } from '../lib/fixed-world';
import { mulberry32 } from '../lib/mesh';
import { getStorageItem, setStorageItem, StorageTTL } from '@ui/lib/storage-with-ttl';

export interface HelmetPickup {
  id: number;
  x: number;
  y: number;
  taken: boolean;
}

export interface HelmetState {
  helmets: HelmetPickup[];
  /** How many the player has compiled into the suit. */
  count: number;
  /**
   * Breaths of SPARE AIR earned from rides (one full ferris rotation grants
   * one). Each adds a whole extra ring of fuel to one jump, then is spent.
   * Session-only on purpose: ride again, breathe again.
   */
  spareAir: number;
  /** Seconds of grant flash remaining, for the renderer. */
  spareFlash: number;
}

export const HELMET_TOTAL = 21;
/** Extra oxygen per helmet: 21 of them take one ring to 3.52 rings. */
const O2_PER_HELMET = 0.12;
/** How close the bug must pass to collect, world px. */
const COLLECT_RANGE = 90;
/** Progress key. Permanent: finding all 21 is an achievement, not a session. */
const STORE_KEY = 'hfu-helmets';
/** Constant seed: the hiding spots never move, so players can learn them. */
const PLACEMENT_SEED = 0x0e11a;

/** How much longer a jump's air lasts with this many helmets compiled. */
export function o2Multiplier(count: number): number {
  return 1 + count * O2_PER_HELMET;
}

/**
 * The 8 void helmets, hand-placed. The last few are a deliberate breadcrumb
 * line toward the keep: each one is a stepping stone you can only reach with
 * the air the previous ones gave you.
 */
const VOID_HELMETS: readonly (readonly [number, number])[] = [
  [620, -4600], // the library gap
  [2600, -4600], // far north water
  [-6400, -600], // out by the gateway
  [-4700, 3500], // south-west sea
  [5600, -1400], // the launch gap
  [4200, 3300], // off the records shelf
  [6500, 5000], // breadcrumb one, toward the keep
  [7400, 5650] // breadcrumb two, nearly there
];

export function createHelmets(): HelmetState {
  const rng = mulberry32(PLACEMENT_SEED);
  const helmets: HelmetPickup[] = [];
  // 13 on land, seeded from the constant: same spots forever.
  for (let i = 0; i < HELMET_TOTAL - VOID_HELMETS.length; i++) {
    const p = sampleBodyPoint(rng);
    helmets.push({ id: i, x: p.x, y: p.y, taken: false });
  }
  // 8 out in the void.
  VOID_HELMETS.forEach(([x, y], k) => {
    helmets.push({ id: HELMET_TOTAL - VOID_HELMETS.length + k, x, y, taken: false });
  });

  // Restore found ones.
  const found = getStorageItem<number[]>(STORE_KEY) ?? [];
  let count = 0;
  for (const h of helmets) {
    if (found.includes(h.id)) {
      h.taken = true;
      count++;
    }
  }
  return { helmets, count, spareAir: 0, spareFlash: 0 };
}

/** Collect by proximity, any mode. Persists immediately. */
export function updateHelmets(state: HelmetState, px: number, py: number): void {
  const r2 = COLLECT_RANGE * COLLECT_RANGE;
  for (const h of state.helmets) {
    if (h.taken) continue;
    const dx = h.x - px;
    const dy = h.y - py;
    if (dx * dx + dy * dy <= r2) {
      h.taken = true;
      state.count++;
      setStorageItem(
        STORE_KEY,
        state.helmets.filter((k) => k.taken).map((k) => k.id),
        StorageTTL.PERMANENT
      );
    }
  }
}

/** A loose helmet waiting to be found: glass dome, neck ring, soft shine. */
export function drawHelmets(
  ctx: CanvasRenderingContext2D,
  state: HelmetState,
  time: number,
  vis: (x: number, y: number) => boolean
): void {
  for (const h of state.helmets) {
    if (h.taken || !vis(h.x, h.y)) continue;
    const bob = Math.sin(time * 1.6 + h.id) * 5;
    const y = h.y + bob;
    ctx.save();
    ctx.translate(h.x, y);
    // Soft halo so it reads against both red land and black void.
    const pulse = 0.4 + Math.sin(time * 2 + h.id * 2) * 0.25;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#9be8ff';
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, 6.283);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Dome.
    ctx.beginPath();
    ctx.arc(0, -3, 20, Math.PI, 0);
    ctx.lineTo(20, 8);
    ctx.lineTo(-20, 8);
    ctx.closePath();
    ctx.fillStyle = 'rgba(155, 232, 255, 0.45)';
    ctx.fill();
    ctx.strokeStyle = '#0e2a36';
    ctx.lineWidth = 3.4;
    ctx.lineJoin = 'round';
    ctx.stroke();
    // Neck ring.
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(-23, 8, 46, 8);
    ctx.strokeRect(-23, 8, 46, 8);
    // The shine.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-4, -6, 12, Math.PI * 1.15, Math.PI * 1.6);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * The suit on the bug: a little glass dome WORN ON THE HEAD, like the
 * bee-astronaut cover Bryan brought back from the board game store (pass
 * seventeen; it replaced a whole-body bubble that read as a force field,
 * not a helmet). At small sizes the upper-left highlight arc IS the
 * helmet; everything else is garnish. Antennae are drawn by drawBug before
 * this runs, so they show through the low-alpha glass.
 */
export function drawSuitBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: HelmetState,
  time: number
): void {
  // A fresh breath of spare air flashes a ring even on a bare bug.
  if (state.spareFlash > 0) {
    ctx.globalAlpha = state.spareFlash * 0.8;
    ctx.strokeStyle = '#9be8ff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, 40 + (1.2 - state.spareFlash) * 150, 0, 6.283);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const count = state.count;
  if (count <= 0 && state.spareAir <= 0) return;
  // The dome sits over the bug's head (top of the diamond body). It grows a
  // whisper with the compiled count and bulges when spare air is aboard.
  // Bryan's first playtest could not SEE it, so it grew from 11 to 15 and
  // the glass and rim both came up in presence.
  const r = 15 + Math.min(count, 21) * 0.14 + (state.spareAir > 0 ? 2.5 : 0);
  const cy = y - 18;
  ctx.save();
  // Glass: visibly there now.
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#CFEAFF';
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, 6.283);
  ctx.fill();
  // Rim.
  ctx.globalAlpha = state.spareAir > 0 ? 0.95 : 0.85;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, 6.283);
  ctx.stroke();
  // Seat shadow, so the dome sits ON the head rather than behind it.
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#5c0a16';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, cy, r - 0.8, 0.5, 2.64);
  ctx.stroke();
  // The highlight arc that sells the glass, drifting a little.
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  const a0 = -2.3 + Math.sin(time * 0.8) * 0.15;
  ctx.arc(x, cy, r - 3.5, a0, a0 + 0.8);
  ctx.stroke();
  // One specular dot.
  ctx.beginPath();
  ctx.arc(x + r * 0.35, cy - r * 0.55, 1.5, 0, 6.283);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}
