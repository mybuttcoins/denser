'use client';

/**
 * Hive Frontend Universe - JSON TOKENS, and the extractors that want them.
 *
 * The first real game loop in this world, and it is made of real chain data:
 * the window's custom_json operations are minted as collectable tokens, one
 * token per thousand operations actually broadcast in that half hour. A busy
 * half hour on Hive literally litters the map with more to collect.
 *
 * The loop:
 *   COLLECT  ride over a token to pick it up. Tokens sit ON edges (edge plus
 *            fraction, like everything else), so collecting happens while you
 *            travel rather than as a detour.
 *   BANK     carry them to a json factory and they are counted in. Carried
 *            tokens are at risk; banked tokens are safe forever.
 *   AVOID    two thieves work for the Mighty J SON. EXTRACTORS latch on with
 *            sucker snouts and drain carried tokens off you; SCAMMERS sidle
 *            close and snatch a fistful at once. Being airborne saves you
 *            from both: nothing catches a bug mid drift, so JUMP OVER a
 *            thief rather than riding past it.
 *   CHASE    a thief with loot stops wandering and RUNS for the nearest of
 *            the Mighty J SON's troll holes. Catch it before it gets there
 *            and every stolen token comes back to you; let it reach the hole
 *            and they are fed to J SON, gone for good.
 *
 * Nothing here touches movement.ts. The player's state is read, never written:
 * the drift check is simply `mode === 'drift'`, which the existing jump already
 * produces.
 *
 * Deterministic from the window seed, so every player in the same half hour
 * gets the same tokens in the same places.
 */

import type { GameWorld } from './world';
import type { PlayerState } from './movement';
import type { CritterState } from './critters';
import type { Factory } from './scenery';
import { posAt } from './movement';
import { mulberry32 } from '../lib/mesh';

export interface Coin {
  /** Which edge it sits on. Position stays edge plus fraction. */
  edge: number;
  t: number;
  x: number;
  y: number;
  taken: boolean;
  /** Spin phase, so a field of tokens does not flash in lockstep. */
  phase: number;
}

export interface CoinState {
  coins: Coin[];
  /** Tokens on the bug right now. These can be taken from you. */
  carried: number;
  /** Tokens delivered to a factory. Safe. */
  banked: number;
  /** Seconds of drain flash remaining, for the renderer. */
  drained: number;
  /** Index of the extractor currently draining, or -1. */
  drainingBy: number;
  /** Fractional drain carry, so a slow drain does not round away to nothing. */
  drainDebt: number;
  /** Seconds of bank flash remaining. */
  bankFlash: number;
  /** How many tokens this window minted, and the real number behind it. */
  minted: number;
  sourceOps: number;
  /* ---- the heist ledger ---- */
  /** Tokens in thieves' hands right now, per critter index. */
  lootByCritter: number[];
  /** Per-critter cooldown: seconds before this thief can steal again. */
  thiefCooldown: number[];
  /**
   * Per-critter pounce grace: for a beat after a snatch the thief cannot be
   * pounced. Without it the recapture landed in the very same frame as the
   * snatch, because the thief had not moved yet, and stealing never worked.
   */
  graceByCritter: number[];
  /** Tokens delivered down a troll hole. Fed to J SON, gone. */
  fed: number;
  /** Tokens taken BACK from thieves by catching them mid-run. */
  recovered: number;
  /** Seconds of recapture flash remaining, for the renderer. */
  recaptureFlash: number;
}

/** One token per this many custom_json ops in the window. */
const OPS_PER_TOKEN = 1000;
/**
 * Never fewer than this or more than that. The floor is not decoration: at 14
 * tokens spread over a world this size, 900 frames of wandering met exactly
 * none of them, which is not a game. The ceiling keeps a very busy half hour
 * from carpeting the map.
 */
const MIN_TOKENS = 55;
const MAX_TOKENS = 220;

/** How close the bug must pass to sweep a token up, world px. */
const PICKUP = 52;
/** How close a factory has to be to bank what you are carrying, world px. */
const BANK_RANGE = 190;
/** How far an extractor's trunk can reach, world px. */
const TRUNK_REACH = 360;
/** Tokens sucked away per second while a trunk has hold of you. */
const DRAIN_PER_SEC = 2.4;
/** How close a scammer must sidle to snatch, world px. */
const SNATCH_RANGE = 150;
/** Tokens a scammer grabs in one snatch. */
const SNATCH_GRAB = 3;
/** Seconds a thief sulks after snatching, being caught, or delivering. */
const THIEF_COOLDOWN = 7;
/** World px per second a loaded thief runs at. Slower than the bug, so a
 *  determined chase wins; faster than idling, so ignoring one loses tokens. */
const HAUL_SPEED = 190;
/** How close to a troll hole counts as delivered. */
const DELIVER_RANGE = 150;
/** How close the bug must get to a running thief to take everything back. */
const POUNCE_RANGE = 85;

export function createCoins(world: GameWorld, customJsonOps: number, seed: number): CoinState {
  const rng = mulberry32((seed ^ 0x7c01) | 0);
  const wanted = Math.max(MIN_TOKENS, Math.min(MAX_TOKENS, Math.floor(customJsonOps / OPS_PER_TOKEN)));

  // Tokens ride the weave, not the cluster spokes, so they always sit
  // somewhere a player can actually travel through.
  const rideable = world.edges.filter((e) => e.kind === 'mesh');
  const coins: Coin[] = [];
  if (rideable.length) {
    for (let i = 0; i < wanted; i++) {
      const e = rideable[Math.floor(rng() * rideable.length)];
      // Keep clear of the very ends so tokens do not pile up on junctions.
      const t = 0.15 + rng() * 0.7;
      const at = { x: 0, y: 0 };
      posAt(e, t, at);
      coins.push({ edge: e.id, t, x: at.x, y: at.y, taken: false, phase: rng() * Math.PI * 2 });
    }
  }

  return {
    coins,
    carried: 0,
    banked: 0,
    drained: 0,
    drainingBy: -1,
    drainDebt: 0,
    bankFlash: 0,
    minted: coins.length,
    sourceOps: customJsonOps,
    lootByCritter: [],
    thiefCooldown: [],
    graceByCritter: [],
    fed: 0,
    recovered: 0,
    recaptureFlash: 0
  };
}

/** Somewhere a thief can dump its loot: Emperor J SON's troll holes. */
export interface Lair {
  x: number;
  y: number;
}

/**
 * The day's BUZZING STATION: tokens picked up inside its radius count double.
 * Chosen by the caller (deterministically from the date), null when none.
 */
export interface BuzzZone {
  x: number;
  y: number;
  r: number;
}

export function updateCoins(
  state: CoinState,
  player: PlayerState,
  critters: CritterState | null,
  factories: Factory[],
  lairs: readonly Lair[],
  dt: number,
  buzz: BuzzZone | null = null
): void {
  if (state.drained > 0) state.drained = Math.max(0, state.drained - dt);
  if (state.bankFlash > 0) state.bankFlash = Math.max(0, state.bankFlash - dt);
  if (state.recaptureFlash > 0) state.recaptureFlash = Math.max(0, state.recaptureFlash - dt);

  // Size the heist ledger to the population on first sight of it.
  if (critters && state.lootByCritter.length !== critters.critters.length) {
    state.lootByCritter = new Array(critters.critters.length).fill(0);
    state.thiefCooldown = new Array(critters.critters.length).fill(0);
    state.graceByCritter = new Array(critters.critters.length).fill(0);
  }

  // COLLECT. Inside the day's buzzing station a token counts double: the
  // token itself plus the station's bonus, which is the whole daily draw.
  const pickup2 = PICKUP * PICKUP;
  for (const c of state.coins) {
    if (c.taken) continue;
    const dx = c.x - player.x;
    const dy = c.y - player.y;
    if (dx * dx + dy * dy <= pickup2) {
      c.taken = true;
      const buzzed = buzz && Math.hypot(c.x - buzz.x, c.y - buzz.y) <= buzz.r;
      state.carried += buzzed ? 2 : 1;
    }
  }

  // BANK: reaching a json factory counts in everything you are carrying.
  if (state.carried > 0) {
    const bank2 = BANK_RANGE * BANK_RANGE;
    for (const f of factories) {
      const dx = f.x - player.x;
      const dy = f.y - player.y;
      if (dx * dx + dy * dy <= bank2) {
        state.banked += state.carried;
        state.carried = 0;
        state.drainDebt = 0;
        state.bankFlash = 1.1;
        break;
      }
    }
  }

  // THE THIEVES. Nothing catches a bug in the air, so drifting is the
  // counterplay for both kinds: jump over them rather than riding past.
  // Who was latched on LAST frame, captured before the reset: the sticky
  // drainer rule needs it, and reading it after the reset made it always -1.
  const prevDrainer = state.drainingBy;
  state.drainingBy = -1;
  if (critters) {
    for (let i = 0; i < critters.critters.length; i++) {
      if (state.thiefCooldown[i] > 0) state.thiefCooldown[i] -= dt;
      if (state.graceByCritter[i] > 0) state.graceByCritter[i] -= dt;
    }

    const airborne = player.mode === 'drift';

    // EXTRACTOR: latches on and drains, token by token, into its own pouch.
    if (state.carried > 0 && !airborne) {
      const reach2 = TRUNK_REACH * TRUNK_REACH;
      let nearest = -1;
      let nearestD2 = reach2;
      for (let i = 0; i < critters.critters.length; i++) {
        const cr = critters.critters[i];
        if (cr.kind !== 'extractor') continue;
        if (state.thiefCooldown[i] > 0) continue;
        if (state.lootByCritter[i] > 0 && prevDrainer !== i) continue;
        const dx = cr.x - player.x;
        const dy = cr.y - player.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < nearestD2) {
          nearestD2 = d2;
          nearest = i;
        }
      }
      if (nearest >= 0) {
        state.drainingBy = nearest;
        state.drainDebt += DRAIN_PER_SEC * dt;
        while (state.drainDebt >= 1 && state.carried > 0) {
          state.drainDebt -= 1;
          state.carried--;
          state.lootByCritter[nearest]++;
          state.drained = 0.55;
        }
        state.graceByCritter[nearest] = 0.4;
        // A full pouch, or an emptied bug, sends it running for a hole.
        if (state.lootByCritter[nearest] >= 4 || state.carried === 0) {
          state.thiefCooldown[nearest] = THIEF_COOLDOWN;
          state.graceByCritter[nearest] = 0;
        }
      } else {
        state.drainDebt = 0;
      }
    } else {
      state.drainDebt = 0;
    }

    // SCAMMER: one quick sidle-and-snatch, then it bolts.
    if (state.carried > 0 && !airborne) {
      const snatch2 = SNATCH_RANGE * SNATCH_RANGE;
      for (let i = 0; i < critters.critters.length; i++) {
        const cr = critters.critters[i];
        if (cr.kind !== 'scammer') continue;
        if (state.lootByCritter[i] > 0 || state.thiefCooldown[i] > 0) continue;
        const dx = cr.x - player.x;
        const dy = cr.y - player.y;
        if (dx * dx + dy * dy > snatch2) continue;
        const grab = Math.min(SNATCH_GRAB, state.carried);
        state.carried -= grab;
        state.lootByCritter[i] += grab;
        state.drained = 0.55;
        state.thiefCooldown[i] = THIEF_COOLDOWN;
        state.graceByCritter[i] = 0.7;
        // The getaway dash: it bolts a body length away in the same beat,
        // cackling, before the run to the hole begins.
        const d = Math.hypot(dx, dy) || 1;
        cr.x += (dx / d) * 260;
        cr.y += (dy / d) * 260;
        break; // one snatch per frame is plenty of cruelty
      }
    }

    // LOADED THIEVES RUN. A thief with loot abandons its wander and beelines
    // for the nearest troll hole, overriding the ambient drift position the
    // population update gave it this frame. Catch it to take everything back.
    const pounce2 = POUNCE_RANGE * POUNCE_RANGE;
    for (let i = 0; i < critters.critters.length; i++) {
      const loot = state.lootByCritter[i];
      if (loot <= 0) continue;
      if (i === state.drainingBy) continue; // still latched on, not running yet
      const cr = critters.critters[i];

      // The pounce: any contact takes the whole pouch back, once the getaway
      // beat has passed.
      if (state.graceByCritter[i] <= 0) {
        const dx = cr.x - player.x;
        const dy = cr.y - player.y;
        if (dx * dx + dy * dy <= pounce2) {
          state.carried += loot;
          state.recovered += loot;
          state.lootByCritter[i] = 0;
          state.recaptureFlash = 1.0;
          state.thiefCooldown[i] = THIEF_COOLDOWN;
          continue;
        }
      }

      // The run.
      let lair = null;
      let bestD = Infinity;
      for (const l of lairs) {
        const d = Math.hypot(l.x - cr.x, l.y - cr.y);
        if (d < bestD) {
          bestD = d;
          lair = l;
        }
      }
      if (!lair) continue;
      if (bestD <= DELIVER_RANGE) {
        // Down the hole: fed to the Mighty J SON.
        state.fed += loot;
        state.lootByCritter[i] = 0;
        state.thiefCooldown[i] = THIEF_COOLDOWN;
        continue;
      }
      const step = Math.min(HAUL_SPEED * dt, bestD);
      cr.x += ((lair.x - cr.x) / bestD) * step;
      cr.y += ((lair.y - cr.y) / bestD) * step;
      cr.face = lair.x > cr.x ? 1 : -1;
    }
  } else {
    state.drainDebt = 0;
  }
}

/** Gold token, drawn as a spinning disc so a still field still reads as alive. */
function drawToken(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number): void {
  // Squash horizontally to fake the spin.
  const squash = Math.abs(Math.cos(spin));
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.max(r * 0.16, r * squash), r, 0, 0, 6.283);
  ctx.fillStyle = '#ffd24a';
  ctx.fill();
  ctx.strokeStyle = '#8a5a10';
  ctx.lineWidth = Math.max(1.2, r * 0.16);
  ctx.stroke();
  // Face mark, only when the disc is wide enough to show one.
  if (squash > 0.55) {
    ctx.fillStyle = '#8a5a10';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.3 * squash, r * 0.34, 0, 0, 6.283);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function drawCoins(
  ctx: CanvasRenderingContext2D,
  state: CoinState,
  critters: CritterState | null,
  player: PlayerState,
  time: number,
  z: number,
  vis: (x: number, y: number) => boolean
): void {
  const r = Math.min(15 / Math.max(z, 0.3), 90);

  // Loose tokens, with a soft glow so they read against the red ground.
  for (const c of state.coins) {
    if (c.taken || !vis(c.x, c.y)) continue;
    const bob = Math.sin(time * 2.2 + c.phase) * r * 0.22;
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#ffdf7a';
    ctx.beginPath();
    ctx.arc(c.x, c.y + bob, r * 1.7, 0, 6.283);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawToken(ctx, c.x, c.y + bob, r, time * 2.6 + c.phase);
  }

  // THE TRUNK: a long tapering siphon reaching from the extractor that has
  // hold of you, with tokens visibly travelling the wrong way along it.
  if (state.drainingBy >= 0 && critters) {
    const cr = critters.critters[state.drainingBy];
    if (cr) {
      const dx = player.x - cr.x;
      const dy = player.y - cr.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const wobble = Math.sin(time * 7) * 14;
      ctx.strokeStyle = '#7d3ba8';
      ctx.lineWidth = Math.max(6, 16 / Math.max(z, 0.3));
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cr.x, cr.y);
      ctx.quadraticCurveTo(
        cr.x + dx * 0.5 + nx * wobble,
        cr.y + dy * 0.5 + ny * wobble,
        player.x,
        player.y
      );
      ctx.stroke();
      ctx.strokeStyle = '#c98bff';
      ctx.lineWidth = Math.max(2, 6 / Math.max(z, 0.3));
      ctx.stroke();
      // Stolen tokens sliding back down the trunk.
      for (let i = 0; i < 3; i++) {
        const f = 1 - ((time * 1.5 + i / 3) % 1);
        const mx = cr.x + dx * f + nx * wobble * Math.sin(f * Math.PI);
        const my = cr.y + dy * f + ny * wobble * Math.sin(f * Math.PI);
        drawToken(ctx, mx, my, r * 0.7, time * 5 + i);
      }
    }
  }

  // What the bug is carrying, orbiting it, so the stake is visible in play.
  if (state.carried > 0) {
    const show = Math.min(state.carried, 6);
    for (let i = 0; i < show; i++) {
      const a = time * 1.6 + (i / show) * 6.283;
      const orbit = 44 + (state.drained > 0 ? Math.sin(time * 30) * 6 : 0);
      drawToken(
        ctx,
        player.x + Math.cos(a) * orbit,
        player.y + Math.sin(a) * orbit * 0.45 - 30,
        r * 0.55,
        time * 3 + i
      );
    }
    // Flash red the instant a token is pulled off you.
    if (state.drained > 0) {
      ctx.globalAlpha = state.drained * 0.7;
      ctx.strokeStyle = '#ff4d6d';
      ctx.lineWidth = 4 / Math.max(z, 0.3);
      ctx.beginPath();
      ctx.arc(player.x, player.y, 60, 0, 6.283);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // Loot riding on the thieves: stolen tokens bob above whoever holds them,
  // so a loaded thief is readable at a glance and worth chasing.
  if (critters) {
    for (let i = 0; i < state.lootByCritter.length; i++) {
      const loot = state.lootByCritter[i];
      if (loot <= 0) continue;
      const cr = critters.critters[i];
      if (!cr || !vis(cr.x, cr.y)) continue;
      const show = Math.min(loot, 4);
      for (let k = 0; k < show; k++) {
        const a = time * 2.2 + (k / show) * 6.283;
        drawToken(ctx, cr.x + Math.cos(a) * 30, cr.y - 44 + Math.sin(a) * 10, r * 0.5, time * 4 + k);
      }
      // A dust trail behind the runner, so the flight reads as flight.
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#e8d9ff';
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath();
        ctx.arc(cr.x - cr.face * k * 16, cr.y + 12, 4.5 - k, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // Recapture: a burst of gold when the pounce lands.
  if (state.recaptureFlash > 0) {
    ctx.globalAlpha = state.recaptureFlash;
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 6 / Math.max(z, 0.3);
    for (const mul of [1, 1.7]) {
      ctx.beginPath();
      ctx.arc(player.x, player.y, (30 + (1 - state.recaptureFlash) * 160) * mul, 0, 6.283);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Banking confirmation ring.
  if (state.bankFlash > 0) {
    ctx.globalAlpha = state.bankFlash * 0.8;
    ctx.strokeStyle = '#8ee87f';
    ctx.lineWidth = 5 / Math.max(z, 0.3);
    ctx.beginPath();
    ctx.arc(player.x, player.y, 40 + (1.1 - state.bankFlash) * 180, 0, 6.283);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
