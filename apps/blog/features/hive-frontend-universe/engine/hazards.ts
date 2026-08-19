/**
 * Hive Frontend Universe - the NUISANCE hazards.
 *
 * The neutral half of the population stopped being neutral in pass fourteen:
 * Socko traps and displaces, Blahgart slimes and slows, Copypasta wraps and
 * holds. None of them touch tokens (that is the thieves' job in coins.ts) and
 * none of them can kill; they cost TIME, which is the point. Each one is a
 * personified nuisance a real Hive user learns to route around.
 *
 * Same layering rule as everything else: nothing here touches movement.ts.
 * The caller applies the effects by scaling the dt it passes to the movement
 * integrator (goo), by not calling the integrator at all for a moment (sock,
 * wrap), and by teleporting with the ordinary placeAt (sock). A DRIFTING bug
 * is immune to all three, which keeps the existing lesson: jumping over
 * trouble is always the answer.
 */

import type { CritterState } from './critters';

/** How close Socko has to get. Generous: socks lunge. */
const SOCK_RANGE = 60;
/** Blahgart spits from further away than anything can grab. */
const GOO_RANGE = 170;
const WRAP_RANGE = 62;

/** Seconds of slow-sticky movement one goo hit costs. */
const GOO_SECONDS = 3.2;
/** Movement runs at this fraction of speed while gooed. */
export const GOO_SLOW = 0.42;
/** Jumps needed to tear out of a pasta wrap. */
const WRAP_JUMPS = 3;
/** The sock-envelop animation, seconds. Teleport fires at its midpoint. */
const SOCK_SECONDS = 1.15;
/** Per-critter re-arm times, so one nuisance cannot chain-lock the player. */
const SOCK_COOLDOWN = 6;
const GOO_COOLDOWN = 5;
const WRAP_COOLDOWN = 7;
/** Global mercy window after any hazard releases the player. */
const MERCY = 1.6;

/** A goo spit in flight, for the renderer. Purely visual; the hit is instant. */
export interface GooSplat {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  age: number;
}

export interface HazardState {
  /** Seconds of slime remaining. Movement dt is scaled by GOO_SLOW while > 0. */
  gooT: number;
  /** Jumps still needed to break the pasta wrap; 0 = free. */
  wrapJumps: number;
  /** Wiggle feedback timer, set by each escape jump. */
  wrapShake: number;
  /**
   * The sock-envelop trip: null or its phase 0..1. The caller teleports the
   * bug to Mount Socko when `tripped` flips true (exactly once, mid-envelop)
   * and suspends movement until the phase completes.
   */
  sockT: number | null;
  /** Set true at the envelop midpoint; the caller consumes it. */
  tripped: boolean;
  /** In-flight goo spits, visual only. */
  splats: GooSplat[];
  /** Per-critter cooldowns, indexed like the critters array. */
  cooldowns: number[];
  /** Global mercy timer after any release. */
  mercy: number;
}

export function createHazards(critterCount: number): HazardState {
  return {
    gooT: 0,
    wrapJumps: 0,
    wrapShake: 0,
    sockT: null,
    tripped: false,
    splats: [],
    cooldowns: new Array(critterCount).fill(0),
    mercy: 0
  };
}

/** True while a hazard has the bug and the movement integrator must not run. */
export function hazardHolds(hz: HazardState): boolean {
  return hz.sockT !== null || hz.wrapJumps > 0;
}

/**
 * One tick. The player is only ever read here; every effect is applied by
 * the caller from the state afterwards.
 */
export function updateHazards(
  hz: HazardState,
  player: { x: number; y: number; mode: string },
  critters: CritterState | null,
  dt: number
): void {
  // Timers first, so a fresh hit this tick is not immediately decayed.
  if (hz.gooT > 0) hz.gooT = Math.max(0, hz.gooT - dt);
  if (hz.wrapShake > 0) hz.wrapShake = Math.max(0, hz.wrapShake - dt);
  if (hz.mercy > 0) hz.mercy = Math.max(0, hz.mercy - dt);
  for (let i = 0; i < hz.cooldowns.length; i++) {
    if (hz.cooldowns[i] > 0) hz.cooldowns[i] -= dt;
  }
  for (let i = hz.splats.length - 1; i >= 0; i--) {
    hz.splats[i].age += dt;
    if (hz.splats[i].age > 0.5) hz.splats.splice(i, 1);
  }

  // The envelop animation runs even while everything else is on hold.
  if (hz.sockT !== null) {
    const before = hz.sockT;
    hz.sockT += dt / SOCK_SECONDS;
    // The teleport fires exactly once, at the moment the sock closes.
    if (before < 0.5 && hz.sockT >= 0.5) hz.tripped = true;
    if (hz.sockT >= 1) {
      hz.sockT = null;
      hz.mercy = MERCY;
    }
    return;
  }

  if (!critters || hz.mercy > 0) return;
  // A drifting bug sails over every nuisance. Jumping is always the answer.
  if (player.mode === 'drift') return;

  const held = hz.wrapJumps > 0;
  for (let i = 0; i < critters.critters.length; i++) {
    const c = critters.critters[i];
    if (hz.cooldowns[i] > 0) continue;
    const d = Math.hypot(c.x - player.x, c.y - player.y);

    if (c.kind === 'sock' && !held && d < SOCK_RANGE) {
      hz.sockT = 0;
      hz.cooldowns[i] = SOCK_COOLDOWN;
      return; // the sock owns this tick
    }
    if (c.kind === 'blah' && d < GOO_RANGE) {
      hz.gooT = Math.min(GOO_SECONDS, hz.gooT + GOO_SECONDS);
      hz.cooldowns[i] = GOO_COOLDOWN;
      hz.splats.push({ fromX: c.x, fromY: c.y, toX: player.x, toY: player.y, age: 0 });
      if (hz.splats.length > 4) hz.splats.shift();
    }
    if (c.kind === 'spammer' && !held && d < WRAP_RANGE) {
      hz.wrapJumps = WRAP_JUMPS;
      hz.cooldowns[i] = WRAP_COOLDOWN;
    }
  }
}

/**
 * A jump input while wrapped tears at the pasta instead of jumping. Returns
 * true when the input was consumed by the wrap (so the caller must NOT jump).
 */
export function fightWrap(hz: HazardState): boolean {
  if (hz.wrapJumps <= 0) return false;
  hz.wrapJumps--;
  hz.wrapShake = 0.3;
  if (hz.wrapJumps === 0) hz.mercy = MERCY;
  return true;
}
