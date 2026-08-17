'use client';

/**
 * Hive Frontend Universe - the ground.
 *
 * The silhouette is the three pieces of the real Hive mark from
 * lib/landmass.ts, eroded into terrain and, since pass seven, stitched into
 * one connected world by two narrow straits.
 *
 * THE LOOK: molten translucent red, lit from inside, like backlit red glass
 * over a black void. Pass six painted this as flat dark tints and it came out
 * as a brown smear, so the paint is now built in three layers:
 *
 *   1. BASE, opaque. Deep crimson, one flat tone per region. Opaque matters:
 *      overlapping opaque fills union seamlessly, so the landmass reads as one
 *      mass with a ragged coast rather than a heap of visible discs. This is
 *      why region tint is baked into each cell's own colour rather than washed
 *      over the top, which would seam at every overlap.
 *   2. GLASS, additive. One pre-rendered texture holding a soft radial bloom
 *      per cell plus a luminous coastal rim. Because the blooms are ADDED
 *      where cells overlap, the deep interior (many overlapping neighbours)
 *      comes out bright and the coast (few neighbours) stays deep, with no
 *      distance field needed anywhere. That is the whole trick.
 *   3. HALO, under everything. A heavily blurred red silhouette so the coast
 *      never sits on a hard black edge.
 *
 * The straits are painted darker so the glow visibly dips at the seams and the
 * three-piece mark still reads, even though rail lines cross them freely.
 *
 * All three layers are built ONCE per window. `drawGround` fills stored Path2D
 * objects (culled to the viewport) and blits two textures. Nothing here
 * recomputes geometry per frame.
 */

import { BODY_CELLS, cellRadiusAt, LANDMASS_COUNT } from '../lib/landmass';
import { mulberry32 } from '../lib/mesh';

/** The void behind everything: near black, faintly cool. */
export const GROUND_VOID = '#04030a';

/**
 * Region base tones: one warm glowing family, all deep crimson. Every entry
 * sits in the red hue band on purpose. Pass six mixed in slate greys and
 * desaturated ochres, which is exactly what read as mud; if a tone here ever
 * drifts toward brown or grey it is wrong.
 */
const REGION_TONES: readonly string[] = [
  '#a81a1e',
  '#5c0a11',
  '#8c1319',
  '#43060d',
  '#96161c',
  '#6d0e14'
];

/**
 * Straits are painted this much darker, so the glow dips at the seams and the
 * three-piece mark still reads. Not darker than this: at 0.42 the isthmus went
 * so close to the void that the rail lines looked like they were crossing open
 * water rather than a bridge.
 */
const STRAIT_DIM = 0.5;

/** How many regions each landmass is divided into. */
const REGIONS_PER_LANDMASS = 4;

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
   * At map zoom the detailed rims are far below a pixel but the renderer still
   * pays for every point: the detailed paths measured 14.4ms per frame at map
   * zoom against a 16.7ms budget. Swapping these in costs nothing visible.
   */
  cellPathsCoarse: Path2D[];
  /** Opaque base fill colour per cell (its region's tone). */
  cellColors: string[];
  /**
   * The whole base layer flattened into one texture, used at map zoom.
   *
   * The cells overlap three or four deep, so filling all 468 of them covers
   * the screen several times over. That overdraw measured 8.4ms of a 17.5ms
   * frame at map zoom, and it is pure waste there because the result is a
   * still image. Baked once, it becomes a single blit. Play zoom still uses
   * the real paths, where only a handful are on screen and the coast has to
   * be crisp.
   */
  baseTex: HTMLCanvasElement | null;
  /** Bounding box per cell, for viewport culling. */
  cellBox: { x0: number; y0: number; x1: number; y1: number }[];
  /** Additive interior bloom plus coastal rim. */
  glass: HTMLCanvasElement | null;
  /** Blurred outer radiance, drawn under the land. */
  halo: HTMLCanvasElement | null;
  /** World-space box both textures are stretched across. */
  texBox: { x: number; y: number; w: number; h: number };
  stats: { cells: number; regions: number; buildMs: number };
}

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

/** Scales a #rrggbb toward black. Used to sink the straits. */
function dim(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r}, ${g}, ${b})`;
}

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

/**
 * The glass layer: an additive bloom per cell, then a luminous coastal rim.
 *
 * The rim is carved rather than stroked. Stroking every cell would draw the
 * internal boundaries too, which would expose the discs the terrain is made
 * of. Instead the union is filled solid and then the union at 88% radius is
 * punched out of it: interior rims are covered by their neighbours' punches,
 * so only the true outer coast survives as a band.
 */
function buildGlass(
  box: { x: number; y: number; w: number; h: number },
  texW: number
): HTMLCanvasElement | null {
  const scale = texW / box.w;
  const made = makeCanvas(texW, Math.max(1, Math.round(box.h * scale)));
  if (!made) return null;
  const { canvas, ctx } = made;
  ctx.setTransform(scale, 0, 0, scale, -box.x * scale, -box.y * scale);

  // 1) Interior bloom, accumulating where cells overlap.
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < BODY_CELLS.length; i++) {
    const c = BODY_CELLS[i];
    const strength = c.strait ? 0.11 : 0.22;
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * 1.05);
    g.addColorStop(0, `rgba(255, 46, 52, ${strength})`);
    g.addColorStop(0.55, `rgba(226, 26, 34, ${strength * 0.5})`);
    g.addColorStop(1, 'rgba(170, 10, 20, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r * 1.05, 0, 6.283);
    ctx.fill();
  }

  // 2) Coastal rim, carved on a scratch layer then added on top.
  const rimMade = makeCanvas(canvas.width, canvas.height);
  if (rimMade) {
    const rctx = rimMade.ctx;
    rctx.setTransform(scale, 0, 0, scale, -box.x * scale, -box.y * scale);
    rctx.fillStyle = '#ff4d4d';
    for (let i = 0; i < BODY_CELLS.length; i++) rctx.fill(blobPath(i));
    rctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < BODY_CELLS.length; i++) {
      const c = BODY_CELLS[i];
      rctx.save();
      rctx.translate(c.x, c.y);
      rctx.scale(0.88, 0.88);
      rctx.translate(-c.x, -c.y);
      rctx.fill(blobPath(i));
      rctx.restore();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.62;
    ctx.filter = 'blur(1.5px)';
    ctx.drawImage(rimMade.canvas, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  }

  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

/** Flattens the opaque base fills into one texture for the pulled-out map. */
function buildBaseTex(
  box: { x: number; y: number; w: number; h: number },
  texW: number,
  colors: string[]
): HTMLCanvasElement | null {
  const scale = texW / box.w;
  const made = makeCanvas(texW, Math.max(1, Math.round(box.h * scale)));
  if (!made) return null;
  const { canvas, ctx } = made;
  ctx.setTransform(scale, 0, 0, scale, -box.x * scale, -box.y * scale);
  for (let i = 0; i < BODY_CELLS.length; i++) {
    ctx.fillStyle = colors[i];
    ctx.fill(blobPath(i));
  }
  return canvas;
}

/** The outer radiance: the silhouette, heavily blurred, under the land. */
function buildHalo(box: { x: number; y: number; w: number; h: number }): HTMLCanvasElement | null {
  const TEX_W = 640;
  const scale = TEX_W / box.w;
  const made = makeCanvas(TEX_W, Math.max(1, Math.round(box.h * scale)));
  if (!made) return null;
  const { canvas, ctx } = made;
  ctx.setTransform(scale, 0, 0, scale, -box.x * scale, -box.y * scale);
  ctx.filter = 'blur(7px)';
  ctx.fillStyle = '#d81624';
  for (const c of BODY_CELLS) {
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
    for (let k = 0; k < REGIONS_PER_LANDMASS; k++) {
      const pick = own[Math.floor(rng() * own.length)];
      seeds.push({
        x: pick.x,
        y: pick.y,
        land,
        tone: REGION_TONES[Math.floor(rng() * REGION_TONES.length)]
      });
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
    let best = REGION_TONES[0];
    let bestD = Infinity;
    for (const s of seeds) {
      if (s.land !== c.land) continue;
      const d = (s.x - c.x) * (s.x - c.x) + (s.y - c.y) * (s.y - c.y);
      if (d < bestD) {
        bestD = d;
        best = s.tone;
      }
    }
    cellColors.push(c.strait ? dim(best, STRAIT_DIM) : best);
    const rMax = c.r * 1.32;
    cellBox.push({ x0: c.x - rMax, y0: c.y - rMax, x1: c.x + rMax, y1: c.y + rMax });
    x0 = Math.min(x0, c.x - rMax);
    y0 = Math.min(y0, c.y - rMax);
    x1 = Math.max(x1, c.x + rMax);
    y1 = Math.max(y1, c.y + rMax);
  }

  const pad = 900;
  const texBox = { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };

  return {
    cellPaths,
    cellPathsCoarse,
    cellColors,
    cellBox,
    baseTex: buildBaseTex(texBox, 1536, cellColors),
    glass: buildGlass(texBox, 1536),
    halo: buildHalo(texBox),
    texBox,
    stats: { cells: BODY_CELLS.length, regions: seeds.length, buildMs: Date.now() - t0 }
  };
}

/**
 * Paints the terrain. `vx0..vy1` is the world-space viewport, so only cells
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
  const far = z < GROUND_LOD_Z;

  // Halo first, under the land.
  if (g.halo) {
    ctx.globalAlpha = 0.5;
    ctx.drawImage(g.halo, g.texBox.x, g.texBox.y, g.texBox.w, g.texBox.h);
    ctx.globalAlpha = 1;
  }

  // Opaque base, so overlaps union without seams. One blit on the pulled-out
  // map, real paths up close.
  if (far && g.baseTex) {
    ctx.drawImage(g.baseTex, g.texBox.x, g.texBox.y, g.texBox.w, g.texBox.h);
  } else {
    const paths = far ? g.cellPathsCoarse : g.cellPaths;
    for (let i = 0; i < paths.length; i++) {
      const b = g.cellBox[i];
      if (b.x1 < vx0 || b.x0 > vx1 || b.y1 < vy0 || b.y0 > vy1) continue;
      ctx.fillStyle = g.cellColors[i];
      ctx.fill(paths[i]);
    }
  }

  // The glass on top: interior bloom and coastal rim, added.
  if (g.glass) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(g.glass, g.texBox.x, g.texBox.y, g.texBox.w, g.texBox.h);
    ctx.globalCompositeOperation = 'source-over';
  }
}
