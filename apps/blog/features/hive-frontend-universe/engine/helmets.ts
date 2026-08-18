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
  return { helmets, count };
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
 * The suit on the bug: a glass bubble that grows a little with every helmet
 * compiled. Drawn by the renderer right after the bug itself.
 */
export function drawSuitBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
  time: number
): void {
  if (count <= 0) return;
  const r = 40 + count * 1.6;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#9be8ff';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, 6.283);
  ctx.fill();
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = '#bdeeff';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, 6.283);
  ctx.stroke();
  // A drifting highlight, so the glass reads as glass.
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  const a0 = -1.2 + Math.sin(time * 0.8) * 0.2;
  ctx.arc(0, 0, r - 5, a0, a0 + 0.7);
  ctx.stroke();
  ctx.restore();
}
