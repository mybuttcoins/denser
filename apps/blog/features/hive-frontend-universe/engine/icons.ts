'use client';

/**
 * Hive Frontend Universe — the icon seam.
 *
 * Every landmark type gets one simple vector shape, drawn in code in the same
 * line-art style as the bug and the wobbled lines. One function per shape,
 * dispatched by `IconKey`; upgrading to real art later means replacing the
 * body of a case here and nothing else.
 *
 * Also here: the REAL Hive mark (path data copied verbatim from the app's own
 * `Icons.hive` in packages/ui/components/icons.tsx, viewBox 220x190) and the
 * ambient tier fish for the sea-in-space theme.
 */

import type { IconKey } from '../lib/fixed-world';

/**
 * The Hive three-chevron mark, exactly as the site header renders it.
 * Source: packages/ui/components/icons.tsx (`hive:`), viewBox 0 0 220 190.
 */
const HIVE_MARK_PATHS = [
  'M157.272625,107.263942 C157.998992,107.263942 158.45262,108.051463 158.088736,108.68075 L111.33839,189.528945 C111.169808,189.820485 110.858795,190 110.522279,190 L81.9443812,190 C81.2180145,190 80.764386,189.212478 81.1282705,188.583191 L127.878616,107.734996 C128.047199,107.443456 128.358211,107.263942 128.694727,107.263942 L157.272625,107.263942 Z M129.477721,84.0901367 C129.141205,84.0901367 128.830192,83.9106218 128.66161,83.6190818 L81.1282705,1.41680884 C80.764386,0.787521511 81.2180145,0 81.9443812,0 L110.522279,0 C110.858795,0 111.169808,0.179514873 111.33839,0.471054898 L158.87173,82.6733278 C159.235614,83.3026152 158.781986,84.0901367 158.055619,84.0901367 L129.477721,84.0901367 Z',
  'M135.128406 1.41635199C134.76385.787064228 135.218932 0 135.947343 0L164.565951 0C164.903712 0 165.215845.179714185 165.384888.47151174L219.873006 94.5275799C220.042331 94.8198642 220.042331 95.1801358 219.873006 95.4724201L165.384888 189.528488C165.215845 189.820286 164.903712 190 164.565951 190L135.947343 190C135.218932 190 134.76385 189.212936 135.128406 188.583648L189.342845 95 135.128406 1.41635199zM111.870216 94.5240823C112.042446 94.816752 112.043313 95.1785591 111.872487 95.4720377L57.1252257 189.528106C56.7599958 190.155572 55.8478414 190.157723 55.4796094 189.531986L.129783614 95.4759177C-.0424457704 95.183248-.0433125021 94.8214409.127512727 94.5279623L54.8747743.471894257C55.2400042-.15557243 56.1521586-.157723129 56.5203906.468014185L111.870216 94.5240823z'
] as const;

const HIVE_VIEW = { w: 220, h: 190 };

let hiveMarkCache: Path2D[] | null = null;
function hiveMarkPaths(): Path2D[] {
  if (!hiveMarkCache && typeof Path2D !== 'undefined') {
    hiveMarkCache = HIVE_MARK_PATHS.map((d) => new Path2D(d));
  }
  return hiveMarkCache ?? [];
}

/**
 * The Hive mark, centred at (x, y), `size` px tall, in `color`.
 * NEVER mirror this: callers must not draw it under a flipped transform.
 */
export function drawHiveMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  const paths = hiveMarkPaths();
  if (!paths.length) return;
  const k = size / HIVE_VIEW.h;
  ctx.save();
  ctx.translate(x - (HIVE_VIEW.w * k) / 2, y - (HIVE_VIEW.h * k) / 2);
  ctx.scale(k, k);
  ctx.fillStyle = color;
  for (const p of paths) ctx.fill(p);
  ctx.restore();
}

/* ------------------------------------------------------------------ */

/**
 * The bug's mark, GLASSY: the same three-chevron Hive shape, but molten red
 * glass with soft gradients and an inner glow, plus a thick dark outline so
 * it reads on the red body at play zoom (the old flat white fill rendered,
 * but at ~9 screen px its chevron gaps dissolved to an illegible smudge).
 *
 * Pre-rendered ONCE to an offscreen canvas at high resolution and drawn with
 * drawImage: crisp when scaled down, and near-free per frame.
 *
 * NEVER mirror this: callers must not draw it under a flipped transform. The
 * bug itself faces left/right by coordinate offsets only, so the mark can
 * never appear backwards.
 */
const GLASS_PAD = 36;
let glassyCache: HTMLCanvasElement | null = null;

function glassyMark(): HTMLCanvasElement | null {
  if (glassyCache) return glassyCache;
  if (typeof document === 'undefined') return null;
  const paths = hiveMarkPaths();
  if (!paths.length) return null;
  const canvas = document.createElement('canvas');
  canvas.width = HIVE_VIEW.w + GLASS_PAD * 2;
  canvas.height = HIVE_VIEW.h + GLASS_PAD * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.translate(GLASS_PAD, GLASS_PAD);

  // Soft outer glow behind everything.
  ctx.save();
  ctx.shadowColor = 'rgba(255, 64, 96, 0.9)';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#e31337';
  for (const p of paths) ctx.fill(p);
  ctx.restore();

  // Thick dark outline separating the glass from the red body.
  ctx.strokeStyle = '#2b030a';
  ctx.lineWidth = 22;
  ctx.lineJoin = 'round';
  for (const p of paths) ctx.stroke(p);

  // The molten glass: deep-to-bright vertical gradient.
  const glass = ctx.createLinearGradient(0, 0, 0, HIVE_VIEW.h);
  glass.addColorStop(0, '#ff98ab');
  glass.addColorStop(0.38, '#ff2c4e');
  glass.addColorStop(0.75, '#c50d2b');
  glass.addColorStop(1, '#7c0619');
  ctx.fillStyle = glass;
  for (const p of paths) ctx.fill(p);

  // Inner glow: painted only where glass already exists (source-atop).
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const glow = ctx.createRadialGradient(HIVE_VIEW.w / 2, HIVE_VIEW.h * 0.34, 8, HIVE_VIEW.w / 2, HIVE_VIEW.h * 0.34, HIVE_VIEW.w * 0.75);
  glow.addColorStop(0, 'rgba(255, 190, 205, 0.85)');
  glow.addColorStop(0.4, 'rgba(255, 90, 120, 0.28)');
  glow.addColorStop(1, 'rgba(255, 90, 120, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-GLASS_PAD, -GLASS_PAD, canvas.width, canvas.height);
  // A specular streak across the upper third, like curved glass.
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(HIVE_VIEW.w * 0.46, HIVE_VIEW.h * 0.2, HIVE_VIEW.w * 0.5, HIVE_VIEW.h * 0.13, -0.12, 0, 6.283);
  ctx.fill();
  ctx.restore();

  glassyCache = canvas;
  return canvas;
}

/** The glassy mark, centred at (x, y), `size` px tall. Never under a flip. */
export function drawBugMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const cache = glassyMark();
  if (!cache) return;
  const k = size / HIVE_VIEW.h;
  const w = cache.width * k;
  const h = cache.height * k;
  ctx.drawImage(cache, x - w / 2, y - h / 2, w, h);
}

/* ------------------------------------------------------------------ */

/** The sticker outline colour shared by the chunky code-drawn places. */
const STICKER_OUTLINE = '#160f1d';

/**
 * Energy colours for the citadel ring, one per rank. Bright and varied on
 * purpose: at map zoom the towers were reading as a row of identical lamps.
 */
const WITNESS_ENERGY = [
  '#ffd24a', '#ff6b9d', '#5eead4', '#a78bfa', '#fb923c',
  '#38bdf8', '#f472b6', '#4ade80', '#facc15', '#c084fc',
  '#2dd4bf', '#fb7185', '#60a5fa', '#fbbf24', '#34d399',
  '#e879f9', '#22d3ee', '#f87171', '#a3e635', '#818cf8',
  '#fdba74'
];

/** Monospace stack for the few glyphs drawn inside icons. */
const ICON_MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/** Fairground colours for the DHF Fun Park gondolas. */
const GONDOLA_HEX = ['#ff4d6d', '#ffd75e', '#48d17a', '#3fb6ff', '#ff9d4d', '#c77dff'];

/**
 * Landmark icons. `s` is the icon's rough half-size in world px; `col` is the
 * category colour; `time` drives small idle animations (pulses, blinks).
 */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  key: IconKey,
  x: number,
  y: number,
  s: number,
  col: string,
  time: number,
  /** The landmark's own name, for the few icons that letter themselves. */
  label?: string
): void {
  ctx.save();
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = Math.max(2, s * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (key) {
    case 'ferris':
      drawFerris(ctx, x, y, s * 2.2, col, time);
      break;
    case 'towers':
      drawTowers(ctx, x, y, s * 2.2, col, time);
      break;
    case 'launchpad':
      drawLaunchpad(ctx, x, y, s * 2.2, col, time);
      break;
    case 'arcadebldg':
      drawArcade(ctx, x, y, s * 2.2, col, time);
      break;
    case 'blackhole':
      drawBlackHole(ctx, x, y, s * 1.5, time);
      break;
    case 'spaceship': {
      // Small rocket in flight.
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.quadraticCurveTo(x + s * 0.55, y - s * 0.2, x + s * 0.35, y + s * 0.6);
      ctx.lineTo(x - s * 0.35, y + s * 0.6);
      ctx.quadraticCurveTo(x - s * 0.55, y - s * 0.2, x, y - s);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y - s * 0.15, s * 0.18, 0, 6.283);
      ctx.stroke();
      // fins + flame
      ctx.beginPath();
      ctx.moveTo(x - s * 0.35, y + s * 0.6);
      ctx.lineTo(x - s * 0.6, y + s * 0.9);
      ctx.moveTo(x + s * 0.35, y + s * 0.6);
      ctx.lineTo(x + s * 0.6, y + s * 0.9);
      ctx.stroke();
      ctx.globalAlpha = 0.5 + Math.sin(time * 9) * 0.4;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.15, y + s * 0.62);
      ctx.lineTo(x, y + s * (0.95 + 0.1 * Math.sin(time * 11)));
      ctx.lineTo(x + s * 0.15, y + s * 0.62);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'magnifier':
      ctx.beginPath();
      ctx.arc(x - s * 0.2, y - s * 0.2, s * 0.55, 0, 6.283);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + s * 0.2, y + s * 0.2);
      ctx.lineTo(x + s * 0.75, y + s * 0.75);
      ctx.stroke();
      break;
    case 'quill':
      // A feather: curved spine with barbs, nib at the bottom.
      ctx.beginPath();
      ctx.moveTo(x - s * 0.6, y + s * 0.8);
      ctx.quadraticCurveTo(x + s * 0.1, y + s * 0.1, x + s * 0.7, y - s * 0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.1, y + s * 0.15);
      ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.1, x + s * 0.7, y - s * 0.8);
      ctx.quadraticCurveTo(x + s * 0.15, y - s * 0.55, x - s * 0.1, y + s * 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.6, y + s * 0.8);
      ctx.lineTo(x - s * 0.75, y + s * 0.95);
      ctx.stroke();
      break;
    case 'wallet': {
      // An actual wallet: a chunky billfold with a flap, a clasp, and a note
      // and a coin peeking out of the top.
      const ww = s * 0.82;
      const wh = s * 0.6;
      const lwW = Math.max(2, s * 0.09);
      // Banknote sticking out behind the body.
      ctx.fillStyle = '#8ee87f';
      ctx.strokeStyle = STICKER_OUTLINE;
      ctx.lineWidth = lwW;
      roundRect(ctx, x - ww * 0.55, y - wh - s * 0.16, ww * 1.1, s * 0.34, s * 0.05);
      ctx.fill();
      ctx.stroke();
      // Coin peeking out beside it.
      ctx.beginPath();
      ctx.arc(x + ww * 0.62, y - wh - s * 0.02, s * 0.17, 0, 6.283);
      ctx.fillStyle = '#ffd24a';
      ctx.fill();
      ctx.stroke();
      // Body.
      ctx.fillStyle = '#c4643a';
      roundRect(ctx, x - ww, y - wh, ww * 2, wh * 2, s * 0.14);
      ctx.fill();
      ctx.stroke();
      // Flap across the lower half.
      ctx.fillStyle = '#9c4a2a';
      roundRect(ctx, x - ww, y - wh * 0.05, ww * 2, wh * 1.05, s * 0.12);
      ctx.fill();
      ctx.stroke();
      // Clasp.
      ctx.fillStyle = '#ffd24a';
      roundRect(ctx, x - s * 0.14, y - wh * 0.22, s * 0.28, s * 0.24, s * 0.06);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'bubble':
      ctx.beginPath();
      ctx.moveTo(x - s * 0.7, y - s * 0.5);
      ctx.lineTo(x + s * 0.7, y - s * 0.5);
      ctx.quadraticCurveTo(x + s * 0.85, y - s * 0.5, x + s * 0.85, y - s * 0.3);
      ctx.lineTo(x + s * 0.85, y + s * 0.2);
      ctx.quadraticCurveTo(x + s * 0.85, y + s * 0.4, x + s * 0.7, y + s * 0.4);
      ctx.lineTo(x - s * 0.2, y + s * 0.4);
      ctx.lineTo(x - s * 0.5, y + s * 0.75);
      ctx.lineTo(x - s * 0.45, y + s * 0.4);
      ctx.lineTo(x - s * 0.7, y + s * 0.4);
      ctx.quadraticCurveTo(x - s * 0.85, y + s * 0.4, x - s * 0.85, y + s * 0.2);
      ctx.lineTo(x - s * 0.85, y - s * 0.3);
      ctx.quadraticCurveTo(x - s * 0.85, y - s * 0.5, x - s * 0.7, y - s * 0.5);
      ctx.stroke();
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(x + i * s * 0.3, y - s * 0.05, s * 0.06, 0, 6.283);
        ctx.fill();
      }
      break;
    case 'doc':
    case 'docq': {
      // Small paper with a folded corner; clearly minor.
      const w = s * 0.85;
      const h = s * 1.1;
      const f = s * 0.28;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y - h / 2);
      ctx.lineTo(x + w / 2 - f, y - h / 2);
      ctx.lineTo(x + w / 2, y - h / 2 + f);
      ctx.lineTo(x + w / 2, y + h / 2);
      ctx.lineTo(x - w / 2, y + h / 2);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w / 2 - f, y - h / 2);
      ctx.lineTo(x + w / 2 - f, y - h / 2 + f);
      ctx.lineTo(x + w / 2, y - h / 2 + f);
      ctx.stroke();
      if (key === 'docq') {
        ctx.font = `700 ${s * 0.8}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', x, y + s * 0.1);
      } else {
        ctx.beginPath();
        ctx.moveTo(x - w * 0.3, y - h * 0.15);
        ctx.lineTo(x + w * 0.3, y - h * 0.15);
        ctx.moveTo(x - w * 0.3, y + h * 0.1);
        ctx.lineTo(x + w * 0.3, y + h * 0.1);
        ctx.stroke();
      }
      break;
    }
    case 'newspaper': {
      const w = s * 1.5;
      const h = s * 1.05;
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      ctx.fillRect(x - w / 2 + s * 0.12, y - h / 2 + s * 0.12, w * 0.5, s * 0.22);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(x - w / 2 + s * 0.12, y - h / 2 + s * 0.5 + i * s * 0.2);
        ctx.lineTo(x + w / 2 - s * 0.12, y - h / 2 + s * 0.5 + i * s * 0.2);
      }
      ctx.stroke();
      break;
    }
    case 'tent': {
      // Basecamp: chunky sticker tent. Thick dark outline, flat bright fill,
      // dark door slit, red pennant.
      ctx.strokeStyle = STICKER_OUTLINE;
      // 0.16 was tuned for the small marker; at big-five size it produced a
      // 56px outline that swallowed the tent, so the ratio is now in line with
      // the other chunky places (about 0.075 of the half-width).
      ctx.lineWidth = Math.max(3, s * 0.075);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.95, y + s * 0.62);
      ctx.lineTo(x, y - s * 0.72);
      ctx.lineTo(x + s * 0.95, y + s * 0.62);
      ctx.closePath();
      ctx.fillStyle = '#FFC24D';
      ctx.fill();
      ctx.stroke();
      // Canvas seam and the dark door slit.
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.72);
      ctx.lineTo(x, y + s * 0.62);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.28, y + s * 0.62);
      ctx.lineTo(x, y - s * 0.08);
      ctx.lineTo(x + s * 0.28, y + s * 0.62);
      ctx.closePath();
      ctx.fillStyle = '#3b2a14';
      ctx.fill();
      // Warm lamplight spilling out of the doorway, gently breathing. This is
      // meant to be the friendliest thing on the map, so it is the only place
      // that is visibly lit from the inside.
      ctx.save();
      ctx.clip();
      const lamp = 0.72 + Math.sin(time * 1.6) * 0.28;
      const spill = ctx.createRadialGradient(x, y + s * 0.5, s * 0.02, x, y + s * 0.5, s * 0.62);
      spill.addColorStop(0, `rgba(255, 214, 130, ${0.85 * lamp})`);
      spill.addColorStop(0.55, `rgba(255, 170, 70, ${0.35 * lamp})`);
      spill.addColorStop(1, 'rgba(255, 150, 60, 0)');
      ctx.fillStyle = spill;
      ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.restore();
      // Pennant, fluttering.
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.72);
      ctx.lineTo(x, y - s * 1.12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - s * 1.12);
      ctx.lineTo(x + s * (0.42 + 0.05 * Math.sin(time * 3)), y - s * 0.99);
      ctx.lineTo(x, y - s * 0.86);
      ctx.closePath();
      ctx.fillStyle = '#E31337';
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'flag': {
      // A proper welcome banner: a striped, waving flag with the place's own
      // name across it, so you can read where you are from the flag itself.
      const poleX = x - s * 0.62;
      const lwF = Math.max(2, s * 0.1);
      const wave = Math.sin(time * 2.2) * s * 0.07;
      // Pole plus finial.
      ctx.strokeStyle = STICKER_OUTLINE;
      ctx.lineWidth = lwF * 1.2;
      ctx.beginPath();
      ctx.moveTo(poleX, y + s * 0.95);
      ctx.lineTo(poleX, y - s * 1.0);
      ctx.stroke();
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.arc(poleX, y - s * 1.05, s * 0.1, 0, 6.283);
      ctx.fill();
      ctx.stroke();

      // Banner body, four bright stripes, waving at the free edge.
      const bx = poleX;
      const by = y - s * 0.98;
      const bw = s * 1.75;
      const bh = s * 0.92;
      const STRIPES = ['#ff4d6d', '#ffa63d', '#48d17a', '#3fb6ff'];
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + bw * 0.5, by + wave, bx + bw, by - wave * 0.6);
      ctx.lineTo(bx + bw, by + bh - wave * 0.6);
      ctx.quadraticCurveTo(bx + bw * 0.5, by + bh + wave, bx, by + bh);
      ctx.closePath();
      ctx.clip();
      for (let i = 0; i < STRIPES.length; i++) {
        ctx.fillStyle = STRIPES[i];
        ctx.fillRect(bx, by + (i * bh) / STRIPES.length - s * 0.1, bw, bh / STRIPES.length + s * 0.2);
      }
      ctx.restore();
      // Outline over the stripes.
      ctx.strokeStyle = STICKER_OUTLINE;
      ctx.lineWidth = lwF;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + bw * 0.5, by + wave, bx + bw, by - wave * 0.6);
      ctx.lineTo(bx + bw, by + bh - wave * 0.6);
      ctx.quadraticCurveTo(bx + bw * 0.5, by + bh + wave, bx, by + bh);
      ctx.closePath();
      ctx.stroke();

      // The name, across the banner.
      if (label) {
        const text = label.toUpperCase();
        const fs = Math.min(bh * 0.34, (bw * 1.45) / Math.max(text.length, 1));
        ctx.font = `800 ${fs}px ${ICON_MONO}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(1.5, fs * 0.3);
        ctx.strokeStyle = STICKER_OUTLINE;
        ctx.strokeText(text, bx + bw * 0.5, by + bh * 0.5 + wave * 0.4);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, bx + bw * 0.5, by + bh * 0.5 + wave * 0.4);
      }
      break;
    }
    case 'door':
      ctx.strokeRect(x - s * 0.55, y - s * 0.85, s * 1.1, s * 1.7);
      ctx.beginPath();
      ctx.arc(x + s * 0.25, y, s * 0.08, 0, 6.283);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - s * 1.05, y);
      ctx.lineTo(x - s * 0.15, y);
      ctx.moveTo(x - s * 0.4, y - s * 0.22);
      ctx.lineTo(x - s * 0.15, y);
      ctx.lineTo(x - s * 0.4, y + s * 0.22);
      ctx.stroke();
      break;
    case 'hivemark':
      drawHiveMark(ctx, x, y, s * 1.7, col);
      break;
    case 'blocks': {
      const b = s * 0.55;
      ctx.strokeRect(x - b - 2, y, b, b);
      ctx.strokeRect(x + 2, y, b, b);
      ctx.strokeRect(x - b / 2, y - b - 2, b, b);
      break;
    }
    case 'pulse':
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.lineTo(x - s * 0.4, y);
      ctx.lineTo(x - s * 0.15, y - s * 0.7);
      ctx.lineTo(x + s * 0.15, y + s * 0.7);
      ctx.lineTo(x + s * 0.4, y);
      ctx.lineTo(x + s, y);
      ctx.stroke();
      break;
    case 'gate':
      // An arch you pass through.
      ctx.beginPath();
      ctx.moveTo(x - s * 0.7, y + s * 0.8);
      ctx.lineTo(x - s * 0.7, y - s * 0.1);
      ctx.quadraticCurveTo(x, y - s * 1.0, x + s * 0.7, y - s * 0.1);
      ctx.lineTo(x + s * 0.7, y + s * 0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.45, y + s * 0.8);
      ctx.lineTo(x - s * 0.45, y + s * 0.05);
      ctx.quadraticCurveTo(x, y - s * 0.6, x + s * 0.45, y + s * 0.05);
      ctx.lineTo(x + s * 0.45, y + s * 0.8);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/* --------------- the destination-world structures --------------- */

function drawFerris(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  R: number,
  col: string,
  time: number
): void {
  // Chunky sticker ferris wheel: fat dark outlines, flat bright fills.
  const lw = Math.max(4, R * 0.09);
  ctx.strokeStyle = STICKER_OUTLINE;
  ctx.lineWidth = lw;
  // Legs: a filled A-frame.
  ctx.beginPath();
  ctx.moveTo(x - R * 0.72, y + R * 1.18);
  ctx.lineTo(x, y + R * 0.05);
  ctx.lineTo(x + R * 0.72, y + R * 1.18);
  ctx.lineTo(x + R * 0.45, y + R * 1.18);
  ctx.lineTo(x, y + R * 0.36);
  ctx.lineTo(x - R * 0.45, y + R * 1.18);
  ctx.closePath();
  ctx.fillStyle = '#8f76d6';
  ctx.fill();
  ctx.stroke();
  // Rim: dark fat ring, then a flat violet band inside it.
  ctx.beginPath();
  ctx.arc(x, y, R, 0, 6.283);
  ctx.lineWidth = lw * 1.7;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, R, 0, 6.283);
  ctx.strokeStyle = col;
  ctx.lineWidth = lw * 0.9;
  ctx.stroke();
  // Spokes and cars.
  const rot = time * 0.22;
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * 6.283) / 8;
    const cx = x + Math.cos(a) * R;
    const cy = y + Math.sin(a) * R;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw * 0.65;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    // Gondolas: flat pods in mixed fairground colours, each with the dark
    // outline, hanging below the rim and always swinging level.
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + R * 0.09);
    ctx.strokeStyle = STICKER_OUTLINE;
    ctx.lineWidth = lw * 0.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy + R * 0.17, R * 0.13, 0, 6.283);
    ctx.fillStyle = GONDOLA_HEX[i % GONDOLA_HEX.length];
    ctx.fill();
    ctx.strokeStyle = STICKER_OUTLINE;
    ctx.lineWidth = lw * 0.7;
    ctx.stroke();
  }
  // Hub.
  ctx.beginPath();
  ctx.arc(x, y, R * 0.16, 0, 6.283);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = STICKER_OUTLINE;
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();
}

function drawTowers(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  R: number,
  col: string,
  time: number
): void {
  // Chunky sticker towers: flat bright slabs, fat outlines, lit windows.
  const lw = Math.max(4, R * 0.08);
  const towers = [
    { dx: -R * 0.62, h: R * 1.1, w: R * 0.34, fill: '#8f76d6' },
    { dx: 0, h: R * 1.65, w: R * 0.4, fill: '#B79CFF' },
    { dx: R * 0.64, h: R * 1.3, w: R * 0.34, fill: '#8f76d6' }
  ];
  for (let i = 0; i < towers.length; i++) {
    const tw = towers[i];
    ctx.strokeStyle = STICKER_OUTLINE;
    ctx.lineWidth = lw;
    ctx.fillStyle = tw.fill;
    ctx.fillRect(x + tw.dx - tw.w / 2, y - tw.h, tw.w, tw.h + R * 0.35);
    ctx.strokeRect(x + tw.dx - tw.w / 2, y - tw.h, tw.w, tw.h + R * 0.35);
    // Flat amber window squares, a couple lit per tower.
    const rows = i === 1 ? 5 : 4;
    for (let r = 0; r < rows; r++) {
      for (let cIdx = 0; cIdx < 2; cIdx++) {
        const lit = (r * 2 + cIdx + i) % 3 !== 0;
        ctx.fillStyle = lit ? '#FFC24D' : '#3a2f5e';
        const wx = x + tw.dx - tw.w * 0.31 + cIdx * tw.w * 0.36;
        const wy = y - tw.h + R * 0.14 + r * R * 0.26;
        ctx.fillRect(wx, wy, tw.w * 0.26, R * 0.14);
      }
    }
    // Antenna and its blinking beacon.
    ctx.beginPath();
    ctx.moveTo(x + tw.dx, y - tw.h);
    ctx.lineTo(x + tw.dx, y - tw.h - R * 0.3);
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
    const blink = 0.5 + Math.sin(time * 3 + i * 2.1) * 0.5;
    ctx.fillStyle = '#ff5f7a';
    ctx.globalAlpha = 0.3 + blink * 0.7;
    ctx.beginPath();
    ctx.arc(x + tw.dx, y - tw.h - R * 0.3, R * 0.07, 0, 6.283);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawLaunchpad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  R: number,
  col: string,
  time: number
): void {
  // Pad, gantry, rocket, pulsing exhaust.
  ctx.beginPath();
  ctx.moveTo(x - R, y + R * 0.75);
  ctx.lineTo(x + R, y + R * 0.75);
  ctx.stroke();
  ctx.strokeRect(x - R * 0.85, y - R * 0.9, R * 0.22, R * 1.65);
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    ctx.moveTo(x - R * 0.63, y - R * 0.6 + i * R * 0.45);
    ctx.lineTo(x - R * 0.25, y - R * 0.5 + i * R * 0.45);
  }
  ctx.stroke();
  // rocket
  ctx.beginPath();
  ctx.moveTo(x + R * 0.05, y - R * 1.05);
  ctx.quadraticCurveTo(x + R * 0.38, y - R * 0.5, x + R * 0.3, y + R * 0.5);
  ctx.lineTo(x - R * 0.2, y + R * 0.5);
  ctx.quadraticCurveTo(x - R * 0.28, y - R * 0.5, x + R * 0.05, y - R * 1.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + R * 0.05, y - R * 0.35, R * 0.11, 0, 6.283);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - R * 0.2, y + R * 0.5);
  ctx.lineTo(x - R * 0.42, y + R * 0.75);
  ctx.moveTo(x + R * 0.3, y + R * 0.5);
  ctx.lineTo(x + R * 0.5, y + R * 0.75);
  ctx.stroke();
  const f = 0.5 + Math.sin(time * 8) * 0.5;
  ctx.globalAlpha = 0.35 + f * 0.5;
  ctx.fillStyle = '#FFC24D';
  ctx.beginPath();
  ctx.moveTo(x - R * 0.08, y + R * 0.52);
  ctx.lineTo(x + R * 0.05, y + R * (0.68 + f * 0.1));
  ctx.lineTo(x + R * 0.18, y + R * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * THE DEVELOPER PORTAL: a black hole, one of the big five.
 *
 * Dark core, two COUNTER-ROTATING glowing accretion rings around it, and faint
 * particles spiralling inward. Cool colours and deliberately a little ominous:
 * this is the one place on the map that does not look friendly.
 *
 * The rings are drawn as many short arc segments of varying alpha rather than
 * one stroked circle, which is what makes them read as moving matter instead
 * of as a drawn outline.
 */
function drawBlackHole(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  R: number,
  time: number
): void {
  ctx.save();

  // Outer halo: the light being bent around it.
  const halo = ctx.createRadialGradient(x, y, R * 0.5, x, y, R * 1.9);
  halo.addColorStop(0, 'rgba(90, 170, 255, 0.30)');
  halo.addColorStop(0.5, 'rgba(70, 110, 220, 0.13)');
  halo.addColorStop(1, 'rgba(40, 60, 150, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, R * 1.9, 0, 6.283);
  ctx.fill();

  // Infalling particles: seeded specks on inward spirals, cool and faint.
  for (let i = 0; i < 26; i++) {
    const seed = i * 2.399963;
    // Each particle runs its own inward pass, wrapping when it reaches the core.
    const phase = (time * 0.16 + i / 26) % 1;
    const rad = R * (1.85 - phase * 1.25);
    const ang = seed + phase * 5.4 + time * 0.5;
    const px = x + Math.cos(ang) * rad;
    const py = y + Math.sin(ang) * rad * 0.42;
    ctx.globalAlpha = 0.15 + (1 - phase) * 0.5;
    ctx.fillStyle = i % 3 === 0 ? '#bfe4ff' : '#6fa8ff';
    ctx.beginPath();
    ctx.arc(px, py, R * 0.028, 0, 6.283);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // The two accretion rings, counter-rotating. Drawn flattened, one tilted
  // against the other, in segments so the brightness varies around each.
  const rings = [
    { r: R * 1.28, squash: 0.34, spin: time * 0.55, tilt: -0.22, col: '#7fc4ff', w: R * 0.13 },
    { r: R * 0.98, squash: 0.46, spin: -time * 0.42, tilt: 0.3, col: '#9d8bff', w: R * 0.1 }
  ];
  for (const ring of rings) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ring.tilt);
    ctx.scale(1, ring.squash);
    ctx.lineCap = 'butt';
    const SEG = 44;
    for (let i = 0; i < SEG; i++) {
      const a0 = (i / SEG) * 6.283 + ring.spin;
      const a1 = ((i + 1.05) / SEG) * 6.283 + ring.spin;
      // Brightest on one side, like matter heated as it swings around.
      const b = 0.5 + Math.sin(a0 * 1 - ring.spin * 0.5) * 0.5;
      ctx.globalAlpha = 0.22 + b * 0.72;
      ctx.strokeStyle = ring.col;
      ctx.lineWidth = ring.w * (0.6 + b * 0.7);
      ctx.beginPath();
      ctx.arc(0, 0, ring.r, a0, a1);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // The core: flat black with a hard rim, so it reads as a hole punched in
  // the world rather than as a dark ball.
  const core = ctx.createRadialGradient(x, y, R * 0.3, x, y, R * 0.78);
  core.addColorStop(0, '#000000');
  core.addColorStop(0.72, '#02030a');
  core.addColorStop(1, 'rgba(20, 30, 70, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, R * 0.78, 0, 6.283);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x, y, R * 0.52, 0, 6.283);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150, 200, 255, 0.55)';
  ctx.lineWidth = Math.max(1.5, R * 0.03);
  ctx.stroke();

  ctx.restore();
}

/** Rounded rectangle path helper for the chunky sticker places. */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/**
 * THE ARCADE: a classic arcade cabinet seen straight on, one of the big five.
 *
 * Rounded marquee header with a colour stripe on top; below it a screen
 * showing a tiny wavy landscape in bright sky blue and green; below the screen
 * a control deck with two red-ball joysticks and rows of small yellow and blue
 * buttons. Chunky black outlines, flat bright fills, sparkles floating around.
 */
function drawArcade(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  R: number,
  col: string,
  time: number
): void {
  const lw = Math.max(4, R * 0.07);
  ctx.strokeStyle = STICKER_OUTLINE;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';

  const W = R * 1.5; // cabinet width
  const left = x - W / 2;

  // Cabinet body: one tall rounded slab in flat cabinet red.
  ctx.fillStyle = '#d8365a';
  roundRect(ctx, left, y - R * 1.18, W, R * 2.32, R * 0.16);
  ctx.fill();
  ctx.stroke();

  // Side panel highlight, so the slab reads as a three dimensional cabinet
  // without resorting to gradients.
  ctx.fillStyle = '#ef5c7c';
  roundRect(ctx, left + W * 0.06, y - R * 1.1, W * 0.16, R * 2.14, R * 0.1);
  ctx.fill();

  // Marquee header: rounded, bright, with a colour stripe across it.
  const mY = y - R * 1.1;
  const mH = R * 0.44;
  ctx.fillStyle = '#ffd75e';
  roundRect(ctx, left + W * 0.04, mY, W * 0.92, mH, R * 0.13);
  ctx.fill();
  ctx.stroke();
  const stripe = ['#ff4d6d', '#ffa63d', '#48d17a', '#3fb6ff'];
  const sw = (W * 0.84) / stripe.length;
  for (let i = 0; i < stripe.length; i++) {
    ctx.fillStyle = stripe[i];
    ctx.fillRect(left + W * 0.08 + i * sw, mY + mH * 0.58, sw, mH * 0.26);
  }
  ctx.strokeRect(left + W * 0.08, mY + mH * 0.58, W * 0.84, mH * 0.26);

  // The screen: dark bezel, then a tiny wavy landscape inside it.
  const scX = left + W * 0.11;
  const scY = y - R * 0.54;
  const scW = W * 0.78;
  const scH = R * 0.78;
  ctx.fillStyle = '#140a1c';
  roundRect(ctx, scX - lw, scY - lw, scW + lw * 2, scH + lw * 2, R * 0.08);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(scX, scY, scW, scH);
  ctx.clip();
  // Sky.
  ctx.fillStyle = '#5fd0ff';
  ctx.fillRect(scX, scY, scW, scH);
  // Two green hill bands, gently waving.
  for (let band = 0; band < 2; band++) {
    ctx.fillStyle = band === 0 ? '#43c268' : '#2c9c4c';
    ctx.beginPath();
    ctx.moveTo(scX, scY + scH);
    const baseY = scY + scH * (0.52 + band * 0.22);
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const px = scX + t * scW;
      const py = baseY + Math.sin(t * 6.283 * 1.5 + time * 0.9 + band * 2) * scH * 0.09;
      if (i === 0) ctx.lineTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.lineTo(scX + scW, scY + scH);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Control deck: an angled shelf with two joysticks and rows of buttons.
  const dY = y + R * 0.42;
  ctx.fillStyle = '#2b1730';
  roundRect(ctx, left + W * 0.02, dY, W * 0.96, R * 0.42, R * 0.08);
  ctx.fill();
  ctx.stroke();
  for (const side of [-1, 1]) {
    const jx = x + side * W * 0.3;
    // Stick.
    ctx.strokeStyle = STICKER_OUTLINE;
    ctx.lineWidth = lw * 1.1;
    ctx.beginPath();
    ctx.moveTo(jx, dY + R * 0.26);
    ctx.lineTo(jx + side * R * 0.05, dY - R * 0.1);
    ctx.stroke();
    // Red ball on top.
    ctx.beginPath();
    ctx.arc(jx + side * R * 0.05, dY - R * 0.15, R * 0.11, 0, 6.283);
    ctx.fillStyle = '#ff3b57';
    ctx.fill();
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
  }
  // Button rows: small yellow and blue.
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 3; i++) {
      const bx = x - W * 0.1 + i * R * 0.15;
      const by = dY + R * 0.12 + row * R * 0.16;
      ctx.beginPath();
      ctx.arc(bx, by, R * 0.05, 0, 6.283);
      ctx.fillStyle = row === 0 ? '#ffd75e' : '#3fb6ff';
      ctx.fill();
      ctx.lineWidth = lw * 0.5;
      ctx.stroke();
    }
  }

  // Coin slot and a dark base plinth.
  ctx.fillStyle = '#140a1c';
  ctx.fillRect(x - R * 0.06, y + R * 0.95, R * 0.12, R * 0.05);
  ctx.fillStyle = '#7d1c33';
  roundRect(ctx, left + W * 0.06, y + R * 1.06, W * 0.88, R * 0.16, R * 0.05);
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.stroke();

  // Sparkles floating around the cabinet: four-point stars, gently twinkling.
  const spark = [
    [-0.72, -1.12, 0.075],
    [0.74, -0.92, 0.06],
    [-0.78, 0.3, 0.055],
    [0.8, 0.55, 0.07],
    [0.1, -1.3, 0.065]
  ];
  ctx.strokeStyle = '#fff3b0';
  for (let i = 0; i < spark.length; i++) {
    const [sxr, syr, sr] = spark[i];
    const tw = 0.45 + Math.sin(time * 2.4 + i * 1.7) * 0.55;
    const sx = x + sxr * R;
    const sy = y + syr * R;
    const rr = sr * R * (0.7 + tw * 0.5);
    ctx.globalAlpha = 0.35 + tw * 0.65;
    ctx.lineWidth = Math.max(1.5, R * 0.028);
    ctx.beginPath();
    ctx.moveTo(sx - rr, sy);
    ctx.lineTo(sx + rr, sy);
    ctx.moveTo(sx, sy - rr);
    ctx.lineTo(sx, sy + rr);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ----------------------- rock formations ----------------------- */

/**
 * Crystal palettes for the rock formations. Cool mineral bodies with hot lit
 * tips, so the terrain reads as a space base rather than a meadow.
 */
const CRYSTAL = [
  { body: '#2b3f7a', lit: '#7fb4ff', tip: '#cfe6ff' },
  { body: '#4a2a6b', lit: '#b98cff', tip: '#e8d6ff' },
  { body: '#0f4a52', lit: '#54dbd0', tip: '#c2fff7' },
  { body: '#5e2340', lit: '#ff86b0', tip: '#ffd4e4' },
  { body: '#5a3a12', lit: '#ffbf4d', tip: '#ffe9b8' }
];

/**
 * A clutch of spiky shards standing on the ground. Drawn chunky: thick dark
 * outline, flat body, one lit face, and a glowing tip that breathes.
 *
 * `h` is the tallest shard's height and `phase` fixes the clutch's shape, so a
 * formation looks identical every frame and every window.
 */
export function drawFormation(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  shards: number,
  hue: number,
  phase: number,
  lean: number,
  time: number
): void {
  const pal = CRYSTAL[hue % CRYSTAL.length];
  const lw = Math.max(1.5, h * 0.045);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.lineJoin = 'round';

  // Ground shadow pool, so the clutch sits on the terrain.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.beginPath();
  ctx.ellipse(0, 0, h * 0.5, h * 0.15, 0, 0, 6.283);
  ctx.fill();

  for (let i = 0; i < shards; i++) {
    // Fan the shards out from the centre, tallest in the middle.
    const t = shards === 1 ? 0.5 : i / (shards - 1);
    const spread = (t - 0.5) * h * 0.62;
    const tall = h * (0.45 + 0.55 * Math.sin(Math.PI * t) + 0.16 * Math.sin(phase + i * 2.1));
    const halfW = Math.max(4, tall * (0.17 + 0.06 * Math.sin(phase + i)));
    const tipX = spread + Math.sin(phase + i * 1.7) * tall * 0.12;

    // Body.
    ctx.beginPath();
    ctx.moveTo(spread - halfW, 0);
    ctx.lineTo(tipX, -tall);
    ctx.lineTo(spread + halfW, 0);
    ctx.closePath();
    ctx.fillStyle = pal.body;
    ctx.fill();
    ctx.strokeStyle = STICKER_OUTLINE;
    ctx.lineWidth = lw;
    ctx.stroke();

    // Lit face: the right half, so the whole field is lit from one side.
    ctx.beginPath();
    ctx.moveTo(tipX, -tall);
    ctx.lineTo(spread + halfW, 0);
    ctx.lineTo(spread + halfW * 0.15, 0);
    ctx.closePath();
    ctx.fillStyle = pal.lit;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Breathing tip glow. Kept small and tinted to the crystal rather than
    // white: at a wider radius and near-white it read as fog sitting over the
    // terrain instead of as a lit point.
    const beat = 0.55 + Math.sin(time * 1.4 + phase + i) * 0.45;
    const g = ctx.createRadialGradient(tipX, -tall, 0, tipX, -tall, tall * 0.2);
    g.addColorStop(0, pal.tip);
    g.addColorStop(0.45, pal.lit);
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.globalAlpha = 0.16 + beat * 0.3;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(tipX, -tall, tall * 0.3, 0, 6.283);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* ----------------------- witness citadels ----------------------- */

/**
 * Cached static tower bodies, keyed by energy colour.
 *
 * At map zoom the body never animates (the motes, beam, fins and pennant are
 * all detail-only), so redrawing fifteen paths per tower per frame was pure
 * waste: 21 towers measured 8.6ms of the frame. The body is rendered once in
 * NORMALISED units (height 1) and stretched to whatever height a rank needs,
 * which is why one canvas per colour serves all 21.
 */
const CITADEL_TEX_H = 200;
/** Normalised body box: x in [-0.45, 0.45], y in [-0.82, 0.06], height 1. */
const CITADEL_BOX = { x0: -0.45, y0: -0.82, w: 0.9, h: 0.88 };
const citadelBodyCache = new Map<string, HTMLCanvasElement>();

function citadelBody(energy: string): HTMLCanvasElement | null {
  const hit = citadelBodyCache.get(energy);
  if (hit) return hit;
  if (typeof document === 'undefined') return null;
  const texH = CITADEL_TEX_H;
  const texW = Math.round((CITADEL_BOX.w / CITADEL_BOX.h) * texH);
  const canvas = document.createElement('canvas');
  canvas.width = texW;
  canvas.height = texH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const k = texH / CITADEL_BOX.h;
  ctx.setTransform(k, 0, 0, k, -CITADEL_BOX.x0 * k, -CITADEL_BOX.y0 * k);

  const w = 0.26;
  const topW = w * 0.56;
  const shaftTop = -0.74;
  const stone = '#2a1b3d';
  const stoneLit = '#402c5c';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = STICKER_OUTLINE;
  ctx.lineWidth = 0.016;

  // Plinth.
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.moveTo(-w * 1.6, 0);
  ctx.lineTo(-w * 1.15, -0.1);
  ctx.lineTo(w * 1.15, -0.1);
  ctx.lineTo(w * 1.6, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Shaft, two-tone so it reads as lit from one side.
  for (const side of [-1, 1]) {
    ctx.fillStyle = side < 0 ? stone : stoneLit;
    ctx.beginPath();
    ctx.moveTo(0, -0.1);
    ctx.lineTo(side * w, -0.1);
    ctx.lineTo(side * topW, shaftTop);
    ctx.lineTo(0, shaftTop);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-w, -0.1);
  ctx.lineTo(-topW, shaftTop);
  ctx.lineTo(topW, shaftTop);
  ctx.lineTo(w, -0.1);
  ctx.closePath();
  ctx.stroke();

  // Lit gallery.
  ctx.fillStyle = energy;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(-topW * 1.25, shaftTop - 0.045, topW * 2.5, 0.045);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = STICKER_OUTLINE;
  ctx.strokeRect(-topW * 1.25, shaftTop - 0.045, topW * 2.5, 0.045);

  citadelBodyCache.set(energy, canvas);
  return canvas;
}

/**
 * A WITNESS CITADEL: the tower one of the top 21 witnesses keeps, standing
 * outside the world and looking in over the chain it produces.
 *
 * Built bottom up: a rock plinth, a tapering buttressed shaft, a lit gallery,
 * then a crown holding the witness's own profile photo. Energy pulses UP the
 * shaft and a beam sweeps from the crown, so the whole ring reads as alive and
 * producing rather than as statues.
 *
 * `rank` is 1 for the top-voted witness. Rank drives size and how hot the
 * energy runs, so the ring reads as a ranking at a glance. `avatar` is the
 * decoded profile image, or null while it loads (a lettered disc stands in).
 * `beat` is a per-tower phase so the ring does not pulse in lockstep.
 */
export function drawWitnessCitadel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  rank: number,
  name: string,
  avatar: HTMLImageElement | null,
  time: number,
  beat: number,
  /** False on the pulled-out map: drops the sweep beam and the climbing motes,
   *  which are sub-pixel there but cost a clip and two gradients per tower. */
  detail: boolean
): void {
  const w = h * 0.26; // shaft half-width at the base
  const lw = Math.max(2, h * 0.016);
  // A playful spectrum around the ring rather than three sober tiers: each
  // citadel burns its own colour, so the ring reads as a carnival of keepers
  // and you can tell one tower from another at a glance.
  const hot = 1 - (rank - 1) / 21;
  const energy = WITNESS_ENERGY[(rank - 1) % WITNESS_ENERGY.length];
  const stone = '#2a1b3d';
  const stoneLit = '#402c5c';

  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';

  // Ground pool, so the tower is standing on something.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 2.1, w * 0.62, 0, 0, 6.283);
  ctx.fill();

  // On the pulled-out map the body is a single cached blit; up close it is
  // drawn live so the stonework stays crisp.
  const cached = detail ? null : citadelBody(energy);
  if (cached) {
    ctx.drawImage(cached, CITADEL_BOX.x0 * h, CITADEL_BOX.y0 * h, CITADEL_BOX.w * h, CITADEL_BOX.h * h);
  }

  // Plinth.
  if (!cached) {
  ctx.fillStyle = stone;
  ctx.strokeStyle = STICKER_OUTLINE;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(-w * 1.6, 0);
  ctx.lineTo(-w * 1.15, -h * 0.1);
  ctx.lineTo(w * 1.15, -h * 0.1);
  ctx.lineTo(w * 1.6, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  }

  // Shaft: tapers as it rises, with two buttresses.
  const topW = w * 0.56;
  const shaftTop = -h * 0.74;
  if (!cached) {
  for (const side of [-1, 1]) {
    ctx.fillStyle = side < 0 ? stone : stoneLit;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.1);
    ctx.lineTo(side * w, -h * 0.1);
    ctx.lineTo(side * topW, shaftTop);
    ctx.lineTo(0, shaftTop);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-w, -h * 0.1);
  ctx.lineTo(-topW, shaftTop);
  ctx.lineTo(topW, shaftTop);
  ctx.lineTo(w, -h * 0.1);
  ctx.closePath();
  ctx.stroke();
  }

  // Buttress fins.
  if (detail) for (const side of [-1, 1]) {
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(side * w, -h * 0.1);
    ctx.lineTo(side * w * 1.5, -h * 0.16);
    ctx.lineTo(side * w * 0.92, -h * 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // ENERGY: bright motes climbing the shaft, the block production itself.
  if (detail) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-w, -h * 0.1);
  ctx.lineTo(-topW, shaftTop);
  ctx.lineTo(topW, shaftTop);
  ctx.lineTo(w, -h * 0.1);
  ctx.closePath();
  ctx.clip();
  for (let i = 0; i < 5; i++) {
    const f = ((time * (0.34 + hot * 0.3) + beat + i / 5) % 1);
    const my = -h * 0.1 - f * h * 0.64;
    const mw = topW + (w - topW) * (1 - f);
    ctx.globalAlpha = 0.22 + (1 - f) * 0.55;
    ctx.fillStyle = energy;
    ctx.beginPath();
    ctx.ellipse(0, my, mw * 0.82, h * 0.022, 0, 0, 6.283);
    ctx.fill();
  }
  ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Lit gallery under the crown.
  if (!cached) {
  ctx.fillStyle = energy;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(-topW * 1.25, shaftTop - h * 0.045, topW * 2.5, h * 0.045);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = STICKER_OUTLINE;
  ctx.strokeRect(-topW * 1.25, shaftTop - h * 0.045, topW * 2.5, h * 0.045);
  }

  // Sweeping watch beam from the crown, pointing inward over the world.
  if (detail) {
  const sweep = Math.sin(time * 0.5 + beat) * 0.5;
  const beamR = h * 0.9;
  const bg = ctx.createLinearGradient(0, shaftTop, Math.sin(sweep) * beamR, shaftTop - beamR);
  bg.addColorStop(0, energy);
  bg.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(0, shaftTop - h * 0.1);
  ctx.lineTo(Math.sin(sweep - 0.16) * beamR, shaftTop - beamR);
  ctx.lineTo(Math.sin(sweep + 0.16) * beamR, shaftTop - beamR);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  }

  // The crown: the witness's own face, ringed and lit.
  const headR = h * 0.16;
  const headY = shaftTop - h * 0.13;
  const pulse = 0.5 + Math.sin(time * 1.6 + beat) * 0.5;
  if (detail) {
    ctx.globalAlpha = 0.3 + pulse * 0.45;
    const halo = ctx.createRadialGradient(0, headY, headR * 0.6, 0, headY, headR * 2.4);
    halo.addColorStop(0, energy);
    halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, headY, headR * 2.4, 0, 6.283);
    ctx.fill();
  } else {
    // Flat disc instead of a gradient. Building a radial gradient per tower
    // per frame was most of the ring's cost at map zoom (8.6ms for 21 towers);
    // at this size the falloff is a couple of pixels and nobody can tell.
    ctx.globalAlpha = 0.18 + pulse * 0.3;
    ctx.fillStyle = energy;
    ctx.beginPath();
    ctx.arc(0, headY, headR * 1.7, 0, 6.283);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, 6.283);
    ctx.clip();
    ctx.drawImage(avatar, -headR, headY - headR, headR * 2, headR * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = stoneLit;
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = energy;
    ctx.font = `800 ${headR * 1.1}px ${ICON_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.charAt(0).toUpperCase(), 0, headY + headR * 0.06);
  }
  ctx.strokeStyle = energy;
  ctx.lineWidth = lw * 1.8;
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, 6.283);
  ctx.stroke();

  // Rank pennant, so the ring reads as an order.
  if (detail) {
  ctx.fillStyle = energy;
  ctx.strokeStyle = STICKER_OUTLINE;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(topW * 1.25, shaftTop - h * 0.022);
  ctx.lineTo(topW * 1.25 + h * 0.15, shaftTop - h * 0.055);
  ctx.lineTo(topW * 1.25, shaftTop - h * 0.088);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  }

  ctx.restore();
}

/* ----------------------- community emblems ----------------------- */

/** Stable small hash of a community name, so its emblem never changes. */
function nameHash(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const EMBLEM_HEX = ['#5EE9D5', '#FFC24D', '#B79CFF', '#5BE39C', '#FF90AE', '#7fb8ff'];

/**
 * An animated emblem for a community bubble, chosen from the community's own
 * NAME so every community reads as its own place and always the same one.
 * Six kinds: orbit, pulse, shards, bubbles, wave, constellation.
 *
 * Decoration only. No lore, no text, nothing clickable.
 */
export function drawCommunityEmblem(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  r: number,
  time: number
): void {
  const h = nameHash(name);
  const kind = Math.floor(h * 6) % 6;
  const col = EMBLEM_HEX[Math.floor(h * 977) % EMBLEM_HEX.length];
  const spin = time * (0.25 + (h % 0.4));
  ctx.save();
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = Math.max(1.5, r * 0.045);
  ctx.globalAlpha = 0.85;

  if (kind === 0) {
    // Orbit: two counter-rotating rings of beads.
    for (let ring = 0; ring < 2; ring++) {
      const rr = r * (0.66 + ring * 0.2);
      const dir = ring === 0 ? 1 : -1;
      for (let i = 0; i < 5 + ring * 2; i++) {
        const a = spin * dir + (i / (5 + ring * 2)) * 6.283;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.55, r * 0.055, 0, 6.283);
        ctx.fill();
      }
    }
  } else if (kind === 1) {
    // Pulse: expanding rings, like a beacon.
    for (let i = 0; i < 3; i++) {
      const f = ((time * 0.45 + i / 3) % 1);
      ctx.globalAlpha = 0.75 * (1 - f);
      ctx.beginPath();
      ctx.arc(x, y, r * (0.28 + f * 0.68), 0, 6.283);
      ctx.stroke();
    }
  } else if (kind === 2) {
    // Shards: a slowly turning crown of triangles.
    for (let i = 0; i < 6; i++) {
      const a = spin + (i / 6) * 6.283;
      const rr = r * 0.78;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      ctx.lineTo(x + Math.cos(a + 0.22) * r * 0.5, y + Math.sin(a + 0.22) * r * 0.5);
      ctx.lineTo(x + Math.cos(a - 0.22) * r * 0.5, y + Math.sin(a - 0.22) * r * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  } else if (kind === 3) {
    // Bubbles: rising specks, because this is still a sea.
    for (let i = 0; i < 9; i++) {
      const f = ((time * 0.3 + i / 9) % 1);
      const bx = x + Math.sin(i * 2.3 + f * 2) * r * 0.6;
      const by = y + r * 0.8 - f * r * 1.6;
      ctx.globalAlpha = 0.7 * (1 - f);
      ctx.beginPath();
      ctx.arc(bx, by, r * (0.04 + 0.05 * (i % 3)), 0, 6.283);
      ctx.stroke();
    }
  } else if (kind === 4) {
    // Wave: a travelling sine, drawn twice for depth.
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass === 0 ? 0.35 : 0.85;
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const wx = x - r * 0.85 + t * r * 1.7;
        const wy = y + Math.sin(t * 9 + time * 1.6 + pass * 0.8) * r * 0.26;
        if (i === 0) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
    }
  } else {
    // Constellation: fixed stars with a link that sweeps between them.
    const pts: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.283 + h * 6.283;
      const rr = r * (0.4 + ((h * (i + 3)) % 0.45));
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 0.95;
    const lit = Math.floor(time * 2) % pts.length;
    pts.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p[0], p[1], r * (i === lit ? 0.075 : 0.045), 0, 6.283);
      ctx.fill();
    });
  }
  ctx.restore();
}

/* ----------------------- the tier fish ----------------------- */

/**
 * A simple fish silhouette: body, tail, eye. `dir` is +1 to face right,
 * -1 to face left. These are scenery only, drawn dim in the open water.
 */
export function drawFish(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  dir: number,
  alpha: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size * 0.9, 0);
  ctx.quadraticCurveTo(-size * 0.3, -size * 0.55, size * 0.45, -size * 0.12);
  ctx.quadraticCurveTo(size * 0.7, 0, size * 0.45, size * 0.12);
  ctx.quadraticCurveTo(-size * 0.3, size * 0.55, -size * 0.9, 0);
  ctx.closePath();
  ctx.fill();
  // tail
  ctx.beginPath();
  ctx.moveTo(-size * 0.85, 0);
  ctx.lineTo(-size * 1.25, -size * 0.35);
  ctx.lineTo(-size * 1.25, size * 0.35);
  ctx.closePath();
  ctx.fill();
  // eye
  ctx.globalAlpha = Math.min(1, alpha * 2.4);
  ctx.fillStyle = '#04070f';
  ctx.beginPath();
  ctx.arc(size * 0.32, -size * 0.03, Math.max(1.4, size * 0.07), 0, 6.283);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}
