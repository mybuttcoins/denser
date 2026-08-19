/**
 * Hive Frontend Universe - the population. Visible but completely INERT.
 *
 * Placeholder critters scattered through the world, drifting slowly along
 * (and slightly beside) the lines. The bug passes straight through them:
 * no collision, no damage, no interaction, no names, no lore. This file is
 * THE SEAM for the population: spawning, movement and drawing all live here,
 * so behaviour can be added later without touching the world builder or the
 * renderer (which only calls the three exported functions).
 *
 * Five kinds, each a distinct chunky-sticker silhouette readable at play
 * zoom: thick dark outlines, flat bright fills.
 */

import type { GameWorld } from './world';
import { posAt, tangentAt, type Vec2 } from './movement';

export type CritterKind = 'sock' | 'blah' | 'scammer' | 'extractor' | 'spammer';

/** Modest counts: inhabited, not infested. All seeded, same for everyone. */
const KIND_COUNTS: readonly [CritterKind, number][] = [
  ['sock', 14],
  ['blah', 16],
  ['scammer', 8],
  ['extractor', 9],
  ['spammer', 11]
];

interface Paper {
  x: number;
  y: number;
  age: number;
}

export interface Critter {
  kind: CritterKind;
  edge: number;
  t: number;
  dir: 1 | -1;
  /** World px per second along the line. Slow, ambient. */
  speed: number;
  /** Perpendicular sway off the line, so they ride NEAR lines, not on rails. */
  swayAmp: number;
  swayPhase: number;
  /** Per-critter deterministic rng for junction turns. */
  rngState: number;
  /** Cached draw position and facing, updated each tick. */
  x: number;
  y: number;
  face: 1 | -1;
  /** Spammer only: the fading trail of identical little papers. */
  papers: Paper[];
  dropIn: number;
}

export interface CritterState {
  critters: Critter[];
  counts: Record<CritterKind, number>;
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One step of the same PRNG, inlined so each critter owns its stream. */
function stepRng(c: Critter): number {
  c.rngState = (c.rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(c.rngState ^ (c.rngState >>> 15), 1 | c.rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const scratch: Vec2 = { x: 0, y: 0 };
const tan: Vec2 = { x: 0, y: 0 };

/** Seeded placement over the world's lines, weighted by line length. */
export function createCritters(world: GameWorld, seed: number): CritterState {
  const rng = mulberry32((seed ^ 0xc417) | 0);
  const cum: number[] = [];
  let total = 0;
  for (const e of world.edges) {
    total += e.len;
    cum.push(total);
  }
  const pickEdge = (): number => {
    const target = rng() * total;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const critters: Critter[] = [];
  const counts = { sock: 0, blah: 0, scammer: 0, extractor: 0, spammer: 0 };
  for (const [kind, n] of KIND_COUNTS) {
    for (let i = 0; i < n; i++) {
      const edge = pickEdge();
      critters.push({
        kind,
        edge,
        t: rng(),
        dir: rng() < 0.5 ? -1 : 1,
        speed: 26 + rng() * 34,
        swayAmp: 10 + rng() * 22,
        swayPhase: rng() * 6.283,
        rngState: (seed ^ (i * 7919 + kind.length * 65537)) | 0,
        x: 0,
        y: 0,
        face: 1,
        papers: [],
        dropIn: rng()
      });
      counts[kind]++;
    }
  }
  const state: CritterState = { critters, counts };
  // Settle initial positions so the first frame is already correct.
  updateCritters(state, world, 0);
  return state;
}

/** Slow drift along the lines; turns at junctions are per-critter seeded. */
export function updateCritters(state: CritterState, world: GameWorld, dt: number): void {
  const { edges, incident } = world;
  for (const c of state.critters) {
    const e = edges[c.edge];
    if (!e) continue;
    c.t += (c.dir * c.speed * dt) / e.len;
    if (c.t >= 1 || c.t <= 0) {
      const atNode = c.t >= 1 ? e.b : e.a;
      const options = incident[atNode];
      if (options.length > 1) {
        // Never immediately double back unless it is a dead end.
        const others = options.filter((ei) => ei !== c.edge);
        c.edge = others[Math.floor(stepRng(c) * others.length)];
      }
      const ne = edges[c.edge];
      c.dir = ne.a === atNode ? 1 : -1;
      c.t = ne.a === atNode ? 0.001 : 0.999;
    }
    posAt(edges[c.edge], c.t, scratch);
    tangentAt(edges[c.edge], c.t, tan);
    // Ride beside the line, swaying, not welded to it.
    const sway = Math.sin(c.swayPhase) * c.swayAmp;
    c.swayPhase += dt * 0.7;
    c.x = scratch.x - tan.y * sway;
    c.y = scratch.y + tan.x * sway;
    if (Math.abs(tan.x * c.dir) > 0.05) c.face = tan.x * c.dir > 0 ? 1 : -1;

    if (c.kind === 'spammer') {
      c.dropIn -= dt;
      if (c.dropIn <= 0) {
        c.dropIn = 0.62;
        c.papers.push({ x: c.x - c.face * 26, y: c.y + 10, age: 0 });
        if (c.papers.length > 6) c.papers.shift();
      }
      for (const p of c.papers) p.age += dt;
      while (c.papers.length && c.papers[0].age > 2.4) c.papers.shift();
    }
  }
}

/* ------------------------------ drawing ------------------------------ */

const OUTLINE = '#141019';

function sticker(ctx: CanvasRenderingContext2D, lw: number): void {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

/**
 * Draws the whole population. Skipped by the caller at far map zoom (they
 * would be sub-pixel there); `vis` is the caller's viewport test.
 */
export function drawCritters(
  ctx: CanvasRenderingContext2D,
  state: CritterState,
  time: number,
  vis: (x: number, y: number) => boolean
): void {
  for (const c of state.critters) {
    if (c.kind === 'spammer') {
      // The paper trail fades even when its spammer is just off screen.
      for (const p of c.papers) {
        if (!vis(p.x, p.y)) continue;
        drawPaper(ctx, p.x, p.y, 1 - p.age / 2.4);
      }
    }
    if (!vis(c.x, c.y)) continue;
    const bob = Math.sin(time * 2 + c.swayPhase) * 2.5;
    switch (c.kind) {
      case 'sock':
        drawSock(ctx, c.x, c.y + bob, c.face);
        break;
      case 'blah':
        drawBlah(ctx, c.x, c.y + bob, c.face, time);
        break;
      case 'scammer':
        drawScammer(ctx, c.x, c.y + bob, c.face, time);
        break;
      case 'extractor':
        drawExtractor(ctx, c.x, c.y + bob, c.face, time);
        break;
      case 'spammer':
        drawSpammer(ctx, c.x, c.y + bob, c.face);
        break;
    }
  }
}

/** Sock puppet: an account-shaped blob, button eyes, a hand shadow inside. */
function drawSock(ctx: CanvasRenderingContext2D, x: number, y: number, face: number): void {
  ctx.save();
  ctx.translate(x, y);
  // Grown 1.35x: at the old size players could not tell what it was.
  ctx.scale(1.35, 1.35);
  sticker(ctx, 3.5);
  // Body: a sock-ish rounded blob (an avatar bubble gone wrong).
  ctx.beginPath();
  ctx.moveTo(-16, 14);
  ctx.quadraticCurveTo(-20, -2, -12, -14);
  ctx.quadraticCurveTo(0, -24, 12, -14);
  ctx.quadraticCurveTo(20, -2, 16, 10);
  ctx.quadraticCurveTo(10, 20, -2, 19);
  ctx.quadraticCurveTo(-12, 20, -16, 14);
  ctx.closePath();
  ctx.fillStyle = '#f1ead8';
  ctx.fill();
  ctx.stroke();
  // The hand inside: a dark hand-shaped shadow showing through the fabric.
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.38;
  ctx.fillStyle = '#33234d';
  ctx.beginPath();
  ctx.moveTo(-9, 20);
  ctx.lineTo(-9, 0);
  for (let f = 0; f < 4; f++) {
    const fx = -9 + f * 5.4;
    ctx.quadraticCurveTo(fx + 1, -12 - (f === 1 || f === 2 ? 4 : 0), fx + 4, 0);
  }
  ctx.lineTo(13, 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Button eyes: circles with stitch holes.
  for (const ex of [-6, 7]) {
    ctx.beginPath();
    ctx.arc(ex + face * 1.5, -6, 4.6, 0, 6.283);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(ex + face * 1.5 - 1.4, -6.9, 0.9, 0, 6.283);
    ctx.arc(ex + face * 1.5 + 1.4, -5.1, 0.9, 0, 6.283);
    ctx.fill();
  }
  // A stitched mouth seam.
  ctx.beginPath();
  ctx.moveTo(-4 + face * 2, 6);
  ctx.quadraticCurveTo(1 + face * 2, 9, 6 + face * 2, 6);
  ctx.stroke();
  ctx.restore();
}

/** Blah: small, round, angry eyebrows, mouth open, noise ripples. */
function drawBlah(ctx: CanvasRenderingContext2D, x: number, y: number, face: number, time: number): void {
  ctx.save();
  ctx.translate(x, y);
  // Grown 1.35x: at the old size players could not tell what it was.
  ctx.scale(1.35, 1.35);
  sticker(ctx, 3.2);
  // Noise ripples off the open mouth.
  const rip = (time * 1.7) % 1;
  ctx.strokeStyle = '#ff8c42';
  ctx.lineWidth = 2.6;
  for (let i = 0; i < 3; i++) {
    const rr = 14 + ((rip + i / 3) % 1) * 16;
    ctx.globalAlpha = 0.75 * (1 - ((rip + i / 3) % 1));
    ctx.beginPath();
    ctx.arc(face * 6, 3, rr, face > 0 ? -0.7 : Math.PI - 0.7, face > 0 ? 0.7 : Math.PI + 0.7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  sticker(ctx, 3.2);
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, 6.283);
  ctx.fillStyle = '#ffb020';
  ctx.fill();
  ctx.stroke();
  // Angry brows.
  ctx.beginPath();
  ctx.moveTo(face * 2 - 7, -7);
  ctx.lineTo(face * 2 - 1.5, -4);
  ctx.moveTo(face * 2 + 7, -8.5);
  ctx.lineTo(face * 2 + 1.5, -4.8);
  ctx.stroke();
  // Dot eyes under the brows.
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.arc(face * 2 - 4, -1.5, 1.7, 0, 6.283);
  ctx.arc(face * 2 + 4, -2, 1.7, 0, 6.283);
  ctx.fill();
  // Mouth: wide open, mid-blah.
  ctx.beginPath();
  ctx.ellipse(face * 4, 5, 4.6, 3.6, 0, 0, 6.283);
  ctx.fillStyle = '#5c1010';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Scammer: a bandit HEAD in a black Zorro mask under a flat gaucho hat, with
 * a golden face (still too shiny to trust) and shifty eyes in the mask slits.
 * The glint stays: it is what makes the deal look too good.
 */
function drawScammer(ctx: CanvasRenderingContext2D, x: number, y: number, face: number, time: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(face * 0.06);
  sticker(ctx, 4);
  // Golden head.
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, 6.283);
  ctx.fillStyle = '#ffd84a';
  ctx.fill();
  ctx.stroke();
  // Sly grin below the mask.
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(face * 2 - 6, 9);
  ctx.quadraticCurveTo(face * 2 + 1, 13, face * 2 + 8, 8);
  ctx.stroke();
  // The MASK: a black domino band right across the eyes, tied at the back
  // with two little tails that flick as it moves.
  ctx.fillStyle = '#17131c';
  ctx.beginPath();
  ctx.moveTo(-17, -9);
  ctx.quadraticCurveTo(0, -14, 17, -9);
  ctx.quadraticCurveTo(18, -1, 15, 1);
  ctx.quadraticCurveTo(0, -3, -15, 1);
  ctx.quadraticCurveTo(-18, -1, -17, -9);
  ctx.closePath();
  ctx.fill();
  const flick = Math.sin(time * 5) * 3;
  ctx.strokeStyle = '#17131c';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-face * 15, -5);
  ctx.quadraticCurveTo(-face * 24, -8 + flick, -face * 28, -2 + flick);
  ctx.moveTo(-face * 15, -4);
  ctx.quadraticCurveTo(-face * 23, 0 - flick, -face * 27, 6 - flick);
  ctx.stroke();
  // Shifty eyes IN the mask slits.
  const dart = Math.sin(time * 0.9) > 0 ? 1 : -1;
  for (const ex of [-7, 7]) {
    ctx.beginPath();
    ctx.ellipse(ex + face, -5.5, 3.6, 2.6, 0, 0, 6.283);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(ex + face + dart * 1.8, -5.4, 1.5, 0, 6.283);
    ctx.fill();
  }
  // The flat black gaucho hat.
  sticker(ctx, 3.4);
  ctx.fillStyle = '#17131c';
  ctx.beginPath();
  ctx.ellipse(0, -14, 21, 4.4, face * 0.06, 0, 6.283);
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(-9, -24, 18, 10);
  ctx.strokeRect(-9, -24, 18, 10);
  // Hat band, bold red.
  ctx.fillStyle = '#e3123a';
  ctx.fillRect(-9, -17.5, 18, 3.6);
  // The glint: a rotating four-point sparkle. Too shiny. Suspicious.
  const g = (time * 1.3) % 6.283;
  ctx.save();
  ctx.translate(13, -18);
  ctx.rotate(g);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(1.8, -1.8, 0, -7);
    ctx.quadraticCurveTo(-1.8, -1.8, 0, 0);
  }
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/**
 * Extractor: a BIG fat tick with FOUR sucker snouts fanned out ahead of it,
 * each ending in a sucker cup, each with a droplet travelling the wrong way.
 * Half again the size of the other critters: this is the one to watch for.
 */
function drawExtractor(ctx: CanvasRenderingContext2D, x: number, y: number, face: number, time: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.55, 1.55);
  sticker(ctx, 3.2);
  const gulp = 1 + Math.sin(time * 5) * 0.06;
  // FOUR snouts, fanned. Each is a dark tube with a bright inner line, a
  // sucker cup at the tip, and a droplet riding up it.
  const snouts = [
    { dx: 26, dy: -8 },
    { dx: 30, dy: 2 },
    { dx: 29, dy: 11 },
    { dx: 24, dy: 19 }
  ];
  for (let i = 0; i < snouts.length; i++) {
    const sn = snouts[i];
    const wig = Math.sin(time * 3.2 + i * 1.7) * 2.2;
    const tx = face * sn.dx;
    const ty = sn.dy + wig;
    ctx.lineWidth = 4.6;
    ctx.strokeStyle = OUTLINE;
    ctx.beginPath();
    ctx.moveTo(face * 8, 2 + i * 1.5);
    ctx.quadraticCurveTo(face * (8 + sn.dx) * 0.55, (2 + sn.dy) * 0.5 - 4, tx, ty);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#8de6ff';
    ctx.beginPath();
    ctx.moveTo(face * 8, 2 + i * 1.5);
    ctx.quadraticCurveTo(face * (8 + sn.dx) * 0.55, (2 + sn.dy) * 0.5 - 4, tx, ty);
    ctx.stroke();
    // Sucker cup.
    ctx.beginPath();
    ctx.arc(tx, ty, 3.4, 0, 6.283);
    ctx.fillStyle = '#ff8bd0';
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Droplet travelling UP this snout.
    const dropT = 1 - ((time * 1.4 + i * 0.25) % 1);
    ctx.fillStyle = '#8de6ff';
    ctx.beginPath();
    ctx.arc(face * 8 + (tx - face * 8) * dropT, 2 + i * 1.5 + (ty - 2 - i * 1.5) * dropT, 2.2, 0, 6.283);
    ctx.fill();
  }
  // Body: bulbous abdomen plus head, pulsing with the gulp.
  ctx.save();
  ctx.scale(1, gulp);
  sticker(ctx, 3.2);
  ctx.beginPath();
  ctx.ellipse(-face * 5, 0, 16, 12.5, 0, 0, 6.283);
  ctx.fillStyle = '#c05df0';
  ctx.fill();
  ctx.stroke();
  // Abdomen spots, because a villain this size earns detail.
  ctx.fillStyle = '#8f2fc4';
  for (const [sx2, sy2, sr] of [[-13, -3, 3.2], [-6, 5, 2.6], [-9, -6, 2.2]] as const) {
    ctx.beginPath();
    ctx.arc(-face * 5 + face * sx2 * -0.4 + sx2 * 0.6, sy2, sr, 0, 6.283);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(face * 9, 1, 7.5, 0, 6.283);
  ctx.fillStyle = '#d98cff';
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.restore();
  // Little legs, comically small for the body.
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = OUTLINE;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-face * 5 + i * 7, 11);
    ctx.lineTo(-face * 5 + i * 7 - 3, 17);
    ctx.stroke();
  }
  // Two hungry eyes: it is concentrating.
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.arc(face * 7, -2, 1.6, 0, 6.283);
  ctx.arc(face * 11.5, -2, 1.6, 0, 6.283);
  ctx.fill();
  ctx.restore();
}

/** One identical little paper of the spammer's trail. */
function drawPaper(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = Math.max(0, alpha) * 0.9;
  ctx.fillStyle = '#f5f2e8';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.fillRect(-5, -6.5, 10, 13);
  ctx.strokeRect(-5, -6.5, 10, 13);
  ctx.beginPath();
  ctx.moveTo(-3, -3);
  ctx.lineTo(3, -3);
  ctx.moveTo(-3, 0);
  ctx.lineTo(3, 0);
  ctx.moveTo(-3, 3);
  ctx.lineTo(1, 3);
  ctx.stroke();
  ctx.restore();
}

/** Spammer: a squat gremlin hugging a stack of the very same papers. */
function drawSpammer(ctx: CanvasRenderingContext2D, x: number, y: number, face: number): void {
  ctx.save();
  ctx.translate(x, y);
  // Grown 1.35x: at the old size players could not tell what it was.
  ctx.scale(1.35, 1.35);
  sticker(ctx, 3.5);
  // Body.
  ctx.beginPath();
  ctx.moveTo(-12, 14);
  ctx.quadraticCurveTo(-15, -8, -6, -13);
  ctx.quadraticCurveTo(0, -16, 6, -13);
  ctx.quadraticCurveTo(15, -8, 12, 14);
  ctx.closePath();
  ctx.fillStyle = '#5fd968';
  ctx.fill();
  ctx.stroke();
  // Ears.
  ctx.beginPath();
  ctx.moveTo(-7, -12);
  ctx.lineTo(-11, -19);
  ctx.lineTo(-3, -14.5);
  ctx.moveTo(7, -12);
  ctx.lineTo(11, -19);
  ctx.lineTo(3, -14.5);
  ctx.fillStyle = '#5fd968';
  ctx.fill();
  ctx.stroke();
  // Eyes: wide, busy.
  for (const ex of [-4.5, 4.5]) {
    ctx.beginPath();
    ctx.arc(ex + face * 1.5, -6, 3.4, 0, 6.283);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(ex + face * 2.6, -6, 1.5, 0, 6.283);
    ctx.fill();
  }
  // The stack of identical papers, hugged in front.
  ctx.save();
  ctx.translate(face * 8, 6);
  ctx.rotate(face * 0.12);
  ctx.fillStyle = '#f5f2e8';
  ctx.lineWidth = 2.4;
  ctx.fillRect(-7, -8, 14, 16);
  ctx.strokeRect(-7, -8, 14, 16);
  ctx.beginPath();
  ctx.moveTo(-7, -4.5);
  ctx.lineTo(7, -4.5);
  ctx.moveTo(-7, -1);
  ctx.lineTo(7, -1);
  ctx.stroke();
  ctx.restore();
  // Stubby arms around the stack.
  ctx.beginPath();
  ctx.moveTo(-9, 2);
  ctx.quadraticCurveTo(face * 2, 12, face * 12, 8);
  ctx.stroke();
  ctx.restore();
}
