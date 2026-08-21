/**
 * Hive Frontend Universe - the population.
 *
 * Critters scattered through the world, drifting slowly along (and slightly
 * beside) the lines. This file is THE SEAM for the population: spawning,
 * movement and drawing live here. Their BEHAVIOUR lives in two other seams:
 * token theft in coins.ts (Sly Grin, Drainiac) and time-wasting nuisances in
 * hazards.ts (Socko, Blahgart, Copypasta). Every kind has a name (see the
 * locales under hive_frontend_universe.critters) and a place in the lore
 * (module README).
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
        drawSpammer(ctx, c.x, c.y + bob, c.face, time);
        break;
    }
  }
}

/**
 * Socko: an actual SOCK, upright on its toe, leaning like it is up to
 * something. Slanty half-lidded eyes and a crooked smirk: this one is not
 * neutral any more. Touch it and it envelops the bug and posts it to
 * Mount Socko (hazards.ts owns that; this is just the look).
 */
function drawSock(ctx: CanvasRenderingContext2D, x: number, y: number, face: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.35 * (face >= 0 ? 1 : -1), 1.35);
  ctx.rotate(0.1);
  sticker(ctx, 3.5);
  // The sock: cuff up top, ankle, then the foot bending forward at the heel.
  ctx.beginPath();
  ctx.moveTo(-8, -22);
  ctx.lineTo(8, -22);
  ctx.lineTo(8, 2);
  ctx.quadraticCurveTo(9, 12, 20, 13);
  ctx.quadraticCurveTo(26, 13.5, 25, 19);
  ctx.quadraticCurveTo(24, 24, 16, 24);
  ctx.lineTo(-4, 24);
  ctx.quadraticCurveTo(-9, 24, -8, 14);
  ctx.closePath();
  ctx.fillStyle = '#f1ead8';
  ctx.fill();
  ctx.stroke();
  // Cuff ribbing.
  ctx.fillStyle = '#e3123a';
  ctx.fillRect(-8, -22, 16, 6);
  ctx.strokeRect(-8, -22, 16, 6);
  // Heel patch.
  ctx.fillStyle = '#d8c9a8';
  ctx.beginPath();
  ctx.arc(-2, 20, 5.5, 0, 6.283);
  ctx.fill();
  // SLANTY eyes: two lidded angles, mischief in fabric form.
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-6, -10);
  ctx.lineTo(1, -6.5);
  ctx.moveTo(8, -12);
  ctx.lineTo(1.5, -8);
  ctx.stroke();
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.arc(-2, -5.4, 1.7, 0, 6.283);
  ctx.arc(4.6, -6.8, 1.7, 0, 6.283);
  ctx.fill();
  // The crooked smirk, one corner up.
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(-4, 2);
  ctx.quadraticCurveTo(2, 5, 7, 0);
  ctx.stroke();
  ctx.restore();
}

/**
 * Blahgart: the word BLAH given legs, in loud blurt orange. The letters ARE
 * the creature (angry brows on the B, the H trailing). Get close and it
 * spits bright green slime that sticks the bug down (hazards.ts).
 */
function drawBlah(ctx: CanvasRenderingContext2D, x: number, y: number, face: number, time: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.35, 1.35);
  // Noise ripples keep radiating: it never stops talking.
  const rip = (time * 1.7) % 1;
  ctx.strokeStyle = '#ff8c42';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const rr = 18 + ((rip + i / 3) % 1) * 16;
    ctx.globalAlpha = 0.7 * (1 - ((rip + i / 3) % 1));
    ctx.beginPath();
    ctx.arc(face * 12, -2, rr, face > 0 ? -0.6 : Math.PI - 0.6, face > 0 ? 0.6 : Math.PI + 0.6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // The word itself: fat rounded letters, blurt orange, dark outline. Text
  // metrics are stable across canvases for a monospace stack, and the letters
  // bounce out of phase so the word reads as walking.
  ctx.font = '900 21px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const word = 'BLAH';
  for (let i = 0; i < word.length; i++) {
    const lx = (i - 1.5) * 13.5;
    const ly = Math.sin(time * 6 + i * 1.3) * 2.4;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.strokeText(word[i], lx, ly);
    ctx.fillStyle = '#ff7a1a';
    ctx.fillText(word[i], lx, ly);
  }
  // Angry brows over the B, so the word has a face after all.
  sticker(ctx, 2.8);
  ctx.beginPath();
  ctx.moveTo(-26, -16);
  ctx.lineTo(-19, -13);
  ctx.moveTo(-11, -16.5);
  ctx.lineTo(-17.5, -13.5);
  ctx.stroke();
  // Little legs under the letters, scurrying.
  ctx.lineWidth = 2.6;
  for (let i = 0; i < 4; i++) {
    const lx = (i - 1.5) * 13.5;
    const kick = Math.sin(time * 9 + i * 2.1) * 3;
    ctx.beginPath();
    ctx.moveTo(lx, 11);
    ctx.lineTo(lx + kick, 17);
    ctx.stroke();
  }
  // A green drip at the mouth corner: the slime it spits is already brewing.
  ctx.fillStyle = '#52f22e';
  ctx.beginPath();
  ctx.ellipse(face * 27, 6 + Math.sin(time * 3) * 1.5, 3, 4.2, 0, 0, 6.283);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
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

/**
 * Copypasta: an octopus made of pasta. A meatball-and-noodle head over eight
 * spaghetti arms that never stop waving; the same arm drawn eight times is
 * the whole joke. Brush against it and the arms wrap the bug, which then has
 * to jump repeatedly to tear free (hazards.ts).
 */
function drawSpammer(ctx: CanvasRenderingContext2D, x: number, y: number, face: number, time?: number): void {
  const tm = time ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.35, 1.35);
  sticker(ctx, 3);
  // Eight spaghetti arms, each the SAME curve pasted at a new angle. Cream
  // noodles with the dark outline underneath so they read on red ground.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 6.283 + 0.39;
    const wave = Math.sin(tm * 4 + i * 1.9) * 6;
    const ex = Math.cos(a) * 24;
    const ey = Math.abs(Math.sin(a)) * 16 + 8;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 6.4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 6, 4);
    ctx.quadraticCurveTo(ex * 0.7 + wave, ey * 0.5, ex + wave, ey);
    ctx.stroke();
    ctx.strokeStyle = '#f2dfa8';
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 6, 4);
    ctx.quadraticCurveTo(ex * 0.7 + wave, ey * 0.5, ex + wave, ey);
    ctx.stroke();
  }
  // Head: a dome of noodles over a meatball heart.
  sticker(ctx, 3);
  ctx.beginPath();
  ctx.arc(0, -5, 13.5, Math.PI, 0);
  ctx.quadraticCurveTo(14.5, 4, 10, 5.5);
  ctx.lineTo(-10, 5.5);
  ctx.quadraticCurveTo(-14.5, 4, -13.5, -5);
  ctx.closePath();
  ctx.fillStyle = '#f2dfa8';
  ctx.fill();
  ctx.stroke();
  // Noodle strands over the dome.
  ctx.lineWidth = 1.8;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 4.6, -18);
    ctx.quadraticCurveTo(i * 5.4, -8, i * 4.2, 5);
    ctx.stroke();
  }
  // The meatball, peeking out of the noodles like a bad idea.
  ctx.fillStyle = '#8a4a2c';
  ctx.beginPath();
  ctx.arc(face * 5, -14, 5.4, 0, 6.283);
  ctx.fill();
  ctx.stroke();
  // Round hungry eyes, grown BIG per the cosmic-octopus brief: the big-eyed
  // cuteness got absorbed here instead of spawning a second octopus species.
  for (const exx of [-5.5, 5.5]) {
    ctx.beginPath();
    ctx.arc(exx + face * 1.5, -3.5, 5.2, 0, 6.283);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(exx + face * 2.8, -3.2, 2.4, 0, 6.283);
    ctx.fill();
    // Catchlight: the dot that makes an eye adorable instead of hungry.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(exx + face * 2.2, -4.4, 0.9, 0, 6.283);
    ctx.fill();
  }
  ctx.restore();
}
