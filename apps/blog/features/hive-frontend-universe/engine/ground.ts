'use client';

/**
 * Hive Frontend Universe - the ground.
 *
 * Everything used to float as wireframe on black. This layer puts land under
 * it. The silhouette is the three landmasses from lib/landmass.ts, whose
 * combined outline is the real Hive mark eroded into terrain.
 *
 * How it is painted, and why it is built this way:
 *
 *   - Every terrain cell is filled OPAQUE. Overlapping opaque fills union
 *     seamlessly, so the landmass reads as one continuous mass with a ragged
 *     coast rather than a heap of visible discs. This is the reason region
 *     tint is baked into each cell's own colour instead of being washed over
 *     the top as a translucent patch, which would seam badly at every overlap.
 *   - Regions are seeded groups of cells, drawn from a MUTED family: dark,
 *     ambient, low saturation, never neon. They give a landmass internal
 *     geography without competing with anything drawn on top.
 *   - The coastal radiance is one small pre-blurred texture stretched under
 *     everything. Blur is cheap at low resolution and it is a soft glow
 *     anyway, so a small texture costs nothing and looks correct.
 *
 * Built ONCE per window and cached: the cell paths and colours are computed in
 * `buildGround`, and `drawGround` only fills stored Path2D objects, culled to
 * the viewport. Nothing here recomputes geometry per frame.
 *
 * The silhouette itself never varies: the cell table is fixed forever. Only
 * the interior region weave is reseeded from the window start.
 */

import { BODY_CELLS, cellRadiusAt, LANDMASS_COUNT } from '../lib/landmass';
import { mulberry32 } from '../lib/mesh';

/** The void behind everything: near black, faintly cool. */
export const GROUND_VOID = '#04030a';

/**
 * The muted region family. All are dark and desaturated so the terrain stays
 * a backdrop; the variation is in hue, not in brightness, so no region ever
 * reads as a highlight. Warm reds dominate, as on the hive.io backdrop, with
 * a few cool territories so the world is not monotone.
 */
const WARM_TONES: readonly string[] = [
  '#2b1219',
  '#33161b',
  '#2e1c14',
  '#301a18',
  '#271620',
  '#351a1c'
];

/**
 * Cool territories, used sparingly. Picking freely from one combined list let
 * a window come out mostly slate blue, which reads nothing like the warm
 * hive.io backdrop the ground is supposed to evoke, so warmth is now
 * guaranteed: at most ONE region per landmass may be cool.
 */
const COOL_TONES: readonly string[] = ['#1b2020', '#182029', '#1c1b28'];

/** How many regions each landmass is divided into. */
const REGIONS_PER_LANDMASS = 4;
/** Chance that a landmass's single cool slot is actually spent. */
const COOL_CHANCE = 0.55;

/**
 * Below this zoom the coarse outlines are used. At 0.18 a 470px cell is about
 * 85 screen px across, where 14 samples is already smoother than the pixels.
 */
const GROUND_LOD_Z = 0.18;

export interface Ground {
  /** One closed ragged blob per terrain cell, in world coordinates. */
  cellPaths: Path2D[];
  /**
   * The same outlines at a coarse sample count, used on the pulled-out map.
   * At map zoom the whole world is a few hundred pixels wide, so the detailed
   * rims are far below a pixel, but the renderer still pays for every point:
   * filling the detailed paths measured 14.4ms per frame at map zoom against a
   * 16.7ms budget. Swapping in coarse paths there costs nothing visible.
   */
  cellPathsCoarse: Path2D[];
  /** Opaque fill colour per cell (its region's tone). */
  cellColors: string[];
  /** Bounding box per cell, for viewport culling. */
  cellBox: { x0: number; y0: number; x1: number; y1: number }[];
  /** Pre-blurred coastal radiance, stretched under the terrain. */
  glow: HTMLCanvasElement | null;
  glowBox: { x: number; y: number; w: number; h: number };
  /** Measured, for the report. */
  stats: { cells: number; regions: number; buildMs: number };
}

/**
 * Samples per cell outline, scaled by radius. A flat count left the big cells
 * visibly faceted at play zoom (a 840px cell at 40 samples has 130px straight
 * segments, which reads as a polygon, not a coast), while small cells wasted
 * points. Roughly one sample per 12 world px of radius fixes both ends.
 */
function blobSamples(r: number): number {
  return Math.max(24, Math.min(120, Math.round(r / 12)));
}

function blobPath(index: number, sampleOverride?: number): Path2D {
  const c = BODY_CELLS[index];
  const p = new Path2D();
  const samples = sampleOverride ?? blobSamples(c.r);
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const rr = cellRadiusAt(index, a);
    const x = c.x + Math.cos(a) * rr;
    const y = c.y + Math.sin(a) * rr;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

/**
 * The coastal radiance: the whole silhouette drawn small into an offscreen
 * canvas under a heavy blur, so the land glows gently against the void and
 * the coastline never sits on a hard black edge.
 */
function buildGlow(box: { x: number; y: number; w: number; h: number }): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const TEX_W = 640;
  const scale = TEX_W / box.w;
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = Math.max(1, Math.round(box.h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(scale, 0, 0, scale, -box.x * scale, -box.y * scale);
  // A blur wide enough to read as radiance rather than as an outline.
  ctx.filter = 'blur(7px)';
  ctx.fillStyle = '#8d1f2c';
  for (let i = 0; i < BODY_CELLS.length; i++) {
    const c = BODY_CELLS[i];
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r * 1.1, 0, 6.283);
    ctx.fill();
  }
  ctx.filter = 'none';
  return canvas;
}

export function buildGround(windowStart: number): Ground {
  const t0 = Date.now();
  const rng = mulberry32((windowStart ^ 0x6c0d) | 0);

  // Region seeds: a few points per landmass; every cell joins its nearest
  // seed. Reseeded per window, so the interior weave changes while the
  // coastline stays identical forever.
  const seeds: { x: number; y: number; land: number; tone: string }[] = [];
  for (let land = 0; land < LANDMASS_COUNT; land++) {
    const own = BODY_CELLS.filter((c) => c.land === land);
    if (!own.length) continue;
    // One cool slot at most, and only sometimes; every other region is warm.
    const coolSlot = rng() < COOL_CHANCE ? Math.floor(rng() * REGIONS_PER_LANDMASS) : -1;
    for (let k = 0; k < REGIONS_PER_LANDMASS; k++) {
      const pick = own[Math.floor(rng() * own.length)];
      const tone =
        k === coolSlot
          ? COOL_TONES[Math.floor(rng() * COOL_TONES.length)]
          : WARM_TONES[Math.floor(rng() * WARM_TONES.length)];
      seeds.push({ x: pick.x, y: pick.y, land, tone });
    }
  }

  const cellPaths: Path2D[] = [];
  const cellPathsCoarse: Path2D[] = [];
  const cellColors: string[] = [];
  const cellBox: Ground['cellBox'] = [];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;

  for (let i = 0; i < BODY_CELLS.length; i++) {
    const c = BODY_CELLS[i];
    cellPaths.push(blobPath(i));
    cellPathsCoarse.push(blobPath(i, 14));
    let best = WARM_TONES[0];
    let bestD = Infinity;
    for (const s of seeds) {
      if (s.land !== c.land) continue;
      const d = (s.x - c.x) * (s.x - c.x) + (s.y - c.y) * (s.y - c.y);
      if (d < bestD) {
        bestD = d;
        best = s.tone;
      }
    }
    cellColors.push(best);
    const rMax = c.r * 1.32;
    cellBox.push({ x0: c.x - rMax, y0: c.y - rMax, x1: c.x + rMax, y1: c.y + rMax });
    x0 = Math.min(x0, c.x - rMax);
    y0 = Math.min(y0, c.y - rMax);
    x1 = Math.max(x1, c.x + rMax);
    y1 = Math.max(y1, c.y + rMax);
  }

  // Pad the glow box so the blur has room to fall off outside the coast.
  const pad = 900;
  const glowBox = { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };

  return {
    cellPaths,
    cellPathsCoarse,
    cellColors,
    cellBox,
    glow: buildGlow(glowBox),
    glowBox,
    stats: { cells: BODY_CELLS.length, regions: seeds.length, buildMs: Date.now() - t0 }
  };
}

/**
 * Fills the terrain. `vx0..vy1` is the world-space viewport, so only cells
 * actually on screen are filled; at play zoom that is a handful.
 */
export function drawGround(
  ctx: CanvasRenderingContext2D,
  g: Ground,
  vx0: number,
  vy0: number,
  vx1: number,
  vy1: number,
  /** Camera zoom; below the LOD threshold the coarse outlines are used. */
  z: number
): void {
  const paths = z < GROUND_LOD_Z ? g.cellPathsCoarse : g.cellPaths;
  // The radiance first, under the land.
  if (g.glow) {
    ctx.globalAlpha = 0.32;
    ctx.drawImage(g.glow, g.glowBox.x, g.glowBox.y, g.glowBox.w, g.glowBox.h);
    ctx.globalAlpha = 1;
  }
  // Then the land itself: opaque fills, so overlaps union without seams.
  for (let i = 0; i < paths.length; i++) {
    const b = g.cellBox[i];
    if (b.x1 < vx0 || b.x0 > vx1 || b.y1 < vy0 || b.y0 > vy1) continue;
    ctx.fillStyle = g.cellColors[i];
    ctx.fill(paths[i]);
  }
}
