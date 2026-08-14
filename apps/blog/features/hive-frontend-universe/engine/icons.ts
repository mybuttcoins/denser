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
  time: number
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
    case 'blackhole': {
      // A black hole: dark core, bright accretion ring, infalling wisps.
      ctx.fillStyle = '#05070d';
      ctx.beginPath();
      ctx.arc(x, y, s * 0.55, 0, 6.283);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.75, time * 0.4, time * 0.4 + 4.6);
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x, y, s * 1.05, -time * 0.25, -time * 0.25 + 3.6);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
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
    case 'wallet':
      // Present but closed and grey: not enterable, not inviting.
      ctx.strokeStyle = '#5a7387';
      ctx.strokeRect(x - s * 0.7, y - s * 0.45, s * 1.4, s * 0.95);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.7, y - s * 0.15);
      ctx.lineTo(x + s * 0.7, y - s * 0.15);
      ctx.stroke();
      ctx.fillStyle = '#5a7387';
      ctx.fillRect(x + s * 0.3, y + 0, s * 0.25, s * 0.2);
      break;
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
    case 'tent':
      // Basecamp: a tent with a door slit and a little pennant.
      ctx.beginPath();
      ctx.moveTo(x - s * 0.9, y + s * 0.6);
      ctx.lineTo(x, y - s * 0.7);
      ctx.lineTo(x + s * 0.9, y + s * 0.6);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.7);
      ctx.lineTo(x, y + s * 0.6);
      ctx.moveTo(x, y + s * 0.6);
      ctx.lineTo(x - s * 0.25, y + s * 0.6);
      ctx.lineTo(x, y - s * 0.05);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.7);
      ctx.lineTo(x, y - s * 1.05);
      ctx.lineTo(x + s * 0.35, y - s * 0.92);
      ctx.lineTo(x, y - s * 0.8);
      ctx.stroke();
      break;
    case 'flag':
      ctx.beginPath();
      ctx.moveTo(x - s * 0.4, y + s * 0.9);
      ctx.lineTo(x - s * 0.4, y - s * 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.4, y - s * 0.9);
      ctx.quadraticCurveTo(x + s * 0.2, y - s * (1.05 + 0.06 * Math.sin(time * 3)), x + s * 0.7, y - s * 0.85);
      ctx.lineTo(x + s * 0.7, y - s * 0.35);
      ctx.quadraticCurveTo(x + s * 0.2, y - s * 0.55, x - s * 0.4, y - s * 0.4);
      ctx.closePath();
      ctx.stroke();
      break;
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
  ctx.beginPath();
  ctx.moveTo(x - R * 0.7, y + R * 1.15);
  ctx.lineTo(x, y);
  ctx.lineTo(x + R * 0.7, y + R * 1.15);
  ctx.stroke();
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, 6.283);
  ctx.stroke();
  const rot = time * 0.22;
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * 6.283) / 8;
    const cx = x + Math.cos(a) * R;
    const cy = y + Math.sin(a) * R;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.fillStyle = '#FFC24D';
    ctx.beginPath();
    ctx.arc(cx, cy + R * 0.08, R * 0.09, 0, 6.283);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTowers(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  R: number,
  col: string,
  time: number
): void {
  const towers = [
    { dx: -R * 0.62, h: R * 1.1, w: R * 0.3 },
    { dx: 0, h: R * 1.65, w: R * 0.34 },
    { dx: R * 0.64, h: R * 1.3, w: R * 0.3 }
  ];
  for (let i = 0; i < towers.length; i++) {
    const tw = towers[i];
    ctx.fillStyle = '#241d3f';
    ctx.fillRect(x + tw.dx - tw.w / 2, y - tw.h, tw.w, tw.h + R * 0.35);
    ctx.strokeRect(x + tw.dx - tw.w / 2, y - tw.h, tw.w, tw.h + R * 0.35);
    ctx.beginPath();
    ctx.moveTo(x + tw.dx, y - tw.h);
    ctx.lineTo(x + tw.dx, y - tw.h - R * 0.3);
    ctx.stroke();
    const blink = 0.5 + Math.sin(time * 3 + i * 2.1) * 0.5;
    ctx.fillStyle = '#ff7288';
    ctx.globalAlpha = 0.3 + blink * 0.7;
    ctx.beginPath();
    ctx.arc(x + tw.dx, y - tw.h - R * 0.3, R * 0.05, 0, 6.283);
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

function drawArcade(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  R: number,
  col: string,
  time: number
): void {
  // A little building with an awning and a glowing marquee sign.
  ctx.strokeRect(x - R * 0.9, y - R * 0.5, R * 1.8, R * 1.2);
  // awning
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const ax = x - R * 0.9 + (i * R * 1.8) / 4;
    ctx.moveTo(ax, y - R * 0.5);
    ctx.quadraticCurveTo(ax + R * 0.225, y - R * 0.32, ax + R * 0.45, y - R * 0.5);
  }
  ctx.stroke();
  // door + screen
  ctx.strokeRect(x - R * 0.25, y + R * 0.1, R * 0.5, R * 0.6);
  ctx.strokeRect(x - R * 0.7, y - R * 0.25, R * 0.35, R * 0.28);
  ctx.strokeRect(x + R * 0.35, y - R * 0.25, R * 0.35, R * 0.28);
  // marquee, glowing
  const glow = 0.55 + Math.sin(time * 2.6) * 0.45;
  ctx.globalAlpha = 0.35 + glow * 0.55;
  ctx.fillStyle = col;
  ctx.fillRect(x - R * 0.95, y - R * 0.95, R * 1.9, R * 0.38);
  ctx.globalAlpha = 1;
  ctx.strokeRect(x - R * 0.95, y - R * 0.95, R * 1.9, R * 0.38);
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
