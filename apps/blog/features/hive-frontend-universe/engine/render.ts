'use client';

/**
 * Hive Frontend Universe — canvas rendering.
 *
 * Space and ocean mixed, since the stake tiers run plankton through whale.
 * Draws: a still starfield, transparent cubes at junctions (texture, obstacle
 * placeholders), wobbled curved lines, the operation flows painted from the
 * window's real counts, json factories, houses as bright blobs, field
 * landmarks in a per-category colour-and-shape language, the rim worlds (DHF
 * Fun Park, the witness towers) and community bubbles, the bug (kept exactly
 * as it was), a map marker so the player can always find themselves, and the
 * warp effect.
 *
 * Stake fog scales with `mapness`: weak up close so it never obscures the
 * lines, full on the pulled-out map where it reads as size.
 */

import type { WorldEdge, WorldNode } from './world';
import type { PlayerState, Vec2 } from './movement';
import { posAt } from './movement';
import type { Factory, Cube } from './scenery';
import type { FlowParticle } from './particles';
import type { LandmarkCategory, IconKey } from '../lib/fixed-world';
import { drawIcon, drawHiveMark, drawFish } from './icons';

export const PALETTE = {
  bg: '#04070f',
  star: '#9fb6d8',
  mesh: '#3f7396',
  spoke: '#8a76c9',
  junction: '#5b7c92',
  newRing: '#5df0ff',
  traffic: '#9fd6e4',
  factory: '#31435a',
  factoryGlow: '#ffb84d',
  text: '#a7c2d4',
  textDim: '#5a7387',
  hive: '#E31337',
  hiveLit: '#ff7288',
  hiveBlack: '#212529',
  board: '#123',
  boardLit: '#5df0ff'
} as const;

export const ACCENT_HEX: Record<string, string> = {
  violet: '#B79CFF',
  cyan: '#5EE9D5',
  amber: '#FFC24D',
  emerald: '#5BE39C',
  rose: '#FF90AE'
};

/** The colour half of the category language. */
export const CATEGORY_HEX: Record<LandmarkCategory, string> = {
  tool: '#5EE9D5',
  dapp: '#FFC24D',
  governance: '#B79CFF',
  info: '#5BE39C',
  arcade: '#FF90AE',
  social: '#7fb8ff'
};

const CUBE_HEX = ['#5EE9D5', '#B79CFF', '#FFC24D', '#FF90AE', '#7fb8ff'];

const FLOW_STYLE: Record<FlowParticle['type'], { col: string; size: number }> = {
  vote: { col: '#cdf6ff', size: 3 },
  customJson: { col: '#ffd75e', size: 5.5 },
  comment: { col: '#8ee87f', size: 6 },
  transfer: { col: '#ffe08a', size: 8 }
};

export interface HouseVisual {
  tier: number;
  isNewcomer: boolean;
  bubble: number;
  glow: number;
  handle: string;
}

export interface LandmarkVisual {
  label: string;
  category: LandmarkCategory;
  /** Which vector icon to draw (the icon seam lives in engine/icons.ts). */
  icon: IconKey;
  /** True for the big destination worlds, drawn as structures. */
  world?: boolean;
}

/** A label waiting for the de-collision pass (screen-space, map zoom only). */
interface LabelRequest {
  x: number;
  y: number;
  /** Clearance below the anchor before the label can sit under it. */
  under: number;
  text: string;
  color: string;
  /** Higher wins a spot when labels fight. */
  priority: number;
}

/** Measured results of the last label de-collision pass, for verification. */
export const lastLabelStats = { placed: 0, shifted: 0, dropped: 0 };

export interface CommunityVisual {
  label: string;
  radius: number;
}

export interface TrafficMarker {
  edge: number;
  from: number;
  to: number;
  t: number;
  life: number;
  max: number;
  handle: string;
}

export interface Camera {
  x: number;
  y: number;
  z: number;
}

export interface RenderScene {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  DPR: number;
  cam: Camera;
  mapness: number;
  nodes: WorldNode[];
  edges: WorldEdge[];
  houses: (HouseVisual | undefined)[];
  landmarks: LandmarkVisual[];
  communities: (CommunityVisual | undefined)[];
  factories: Factory[];
  cubes: Cube[];
  flows: FlowParticle[];
  traffic: TrafficMarker[];
  player: PlayerState;
  time: number;
  tierColors: string[];
  shake?: number;
  /** Warp effect countdown, 1 → 0. */
  warpFx?: number;
  hud: { housesLabel: string; windowLabel: string; housesCount: number; windowTime: string };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
/** Small deterministic hash → [0,1), for star specks and blob shapes. */
function hash2(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const scratch: Vec2 = { x: 0, y: 0 };

/** An irregular blob instead of a perfect circle; shape fixed per id. */
function blobPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, id: number): void {
  const p1 = hash2(id, 1) * 6.283;
  const p2 = hash2(id, 2) * 6.283;
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * 6.283;
    const rr = r * (1 + 0.14 * Math.sin(3 * a + p1) + 0.09 * Math.sin(5 * a + p2));
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawScene(scene: RenderScene): void {
  const { ctx, W, H, DPR, cam, nodes, edges, player, time, mapness } = scene;

  // Labels go through a de-collision pass at map zoom instead of being drawn
  // in place, so no two labels overlap on the pulled-out map.
  const mapLabels = mapness > 0.55;
  const labelQueue: LabelRequest[] = [];

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, W, H);

  const sx = scene.shake ? (Math.random() - 0.5) * scene.shake : 0;
  const sy = scene.shake ? (Math.random() - 0.5) * scene.shake : 0;
  const z = cam.z;

  ctx.save();
  ctx.translate(W / 2 + sx, H / 2 + sy);
  ctx.scale(z, z);
  ctx.translate(-cam.x, -cam.y);

  const pad = 320 / z;
  const vx0 = cam.x - W / 2 / z - pad;
  const vx1 = cam.x + W / 2 / z + pad;
  const vy0 = cam.y - H / 2 / z - pad;
  const vy1 = cam.y + H / 2 / z + pad;
  const vis = (x: number, y: number) => x > vx0 && x < vx1 && y > vy0 && y < vy1;
  const edgeVis = (e: WorldEdge) => {
    const m = e.pts.length;
    const minX = Math.min(e.pts[0], e.pts[m - 2]) - e.len * 0.3;
    const maxX = Math.max(e.pts[0], e.pts[m - 2]) + e.len * 0.3;
    const minY = Math.min(e.pts[1], e.pts[m - 1]) - e.len * 0.3;
    const maxY = Math.max(e.pts[1], e.pts[m - 1]) + e.len * 0.3;
    return maxX > vx0 && minX < vx1 && maxY > vy0 && minY < vy1;
  };

  // Stars: still, deterministic specks. Skipped at map zoom (too dense).
  if (mapness < 0.6) {
    const CELL = 640;
    ctx.fillStyle = PALETTE.star;
    for (let cx = Math.floor(vx0 / CELL); cx <= Math.floor(vx1 / CELL); cx++) {
      for (let cy = Math.floor(vy0 / CELL); cy <= Math.floor(vy1 / CELL); cy++) {
        for (let s = 0; s < 2; s++) {
          const hx = hash2(cx * 3 + s, cy * 7 + s);
          const hy = hash2(cx * 5 + s, cy * 11 + s);
          const hs = hash2(cx * 13 + s, cy * 17 + s);
          ctx.globalAlpha = 0.08 + hs * 0.2;
          const r = 1.2 + hs * 2.4;
          ctx.fillRect(cx * CELL + hx * CELL, cy * CELL + hy * CELL, r, r);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // The tier fish, out in the open water: plankton through whale, dim
  // silhouettes so the sea-in-space theme reads while playing.
  if (mapness < 0.5) {
    const FCELL = 1400;
    const FISH_SIZE = [14, 26, 48, 105, 240];
    for (let cx = Math.floor(vx0 / FCELL); cx <= Math.floor(vx1 / FCELL); cx++) {
      for (let cy = Math.floor(vy0 / FCELL); cy <= Math.floor(vy1 / FCELL); cy++) {
        const h = hash2(cx * 19, cy * 23);
        if (h > 0.72) continue;
        const tier = h < 0.28 ? 0 : h < 0.42 ? 1 : h < 0.5 ? 2 : h < 0.535 ? 3 : 4;
        const fx = cx * FCELL + hash2(cx * 29, cy * 31) * FCELL;
        const fy =
          cy * FCELL +
          hash2(cx * 37, cy * 41) * FCELL +
          Math.sin(time * 0.5 + hash2(cx, cy) * 6.28) * FISH_SIZE[tier] * 0.15;
        const dir = hash2(cx * 43, cy * 47) < 0.5 ? -1 : 1;
        drawFish(ctx, fx, fy, FISH_SIZE[tier], scene.tierColors[tier], dir, 0.17 + tier * 0.04);
      }
    }
  }

  // Cubes: transparent, colourful, under the lines for depth.
  for (const c of scene.cubes) {
    if (!vis(c.x, c.y)) continue;
    drawCube(ctx, c);
  }

  // The lines: wobbled curves. Mesh in teal, spokes in violet.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const kind of ['mesh', 'spoke'] as const) {
    ctx.strokeStyle = kind === 'mesh' ? PALETTE.mesh : PALETTE.spoke;
    ctx.lineWidth = (kind === 'mesh' ? 2.6 : 2.2) / Math.max(z, 0.05);
    ctx.globalAlpha = kind === 'mesh' ? 0.85 : 0.8;
    for (const e of edges) {
      if (e.kind !== kind || !edgeVis(e)) continue;
      ctx.beginPath();
      ctx.moveTo(e.pts[0], e.pts[1]);
      for (let i = 2; i < e.pts.length; i += 2) ctx.lineTo(e.pts[i], e.pts[i + 1]);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // Operation flows: the real counts, moving. Each type its own shape.
  for (const p of scene.flows) {
    const e = edges[p.edge];
    if (!e) continue;
    posAt(e, p.t, scratch);
    if (!vis(scratch.x, scratch.y)) continue;
    const style = FLOW_STYLE[p.type];
    if (p.type === 'vote') {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = style.col;
      ctx.beginPath();
      ctx.arc(scratch.x, scratch.y, style.size, 0, 6.283);
      ctx.fill();
    } else if (p.type === 'customJson') {
      ctx.save();
      ctx.translate(scratch.x, scratch.y);
      ctx.rotate(time * 3 + p.edge);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = style.col;
      ctx.fillRect(-style.size, -style.size, style.size * 2, style.size * 2);
      ctx.restore();
    } else if (p.type === 'comment') {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = style.col;
      ctx.beginPath();
      ctx.arc(scratch.x, scratch.y, style.size, 0, 6.283);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(scratch.x - 2, scratch.y + style.size - 1);
      ctx.lineTo(scratch.x - style.size, scratch.y + style.size + 5);
      ctx.lineTo(scratch.x + 2, scratch.y + style.size);
      ctx.closePath();
      ctx.fill();
    } else {
      // transfer: a coin with a soft glow. Rare, valuable, deliberate.
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = style.col;
      ctx.beginPath();
      ctx.arc(scratch.x, scratch.y, style.size * 2.4, 0, 6.283);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(scratch.x, scratch.y, style.size, 0, 6.283);
      ctx.fill();
      ctx.strokeStyle = '#8a6d1f';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.strokeStyle = '#fff3c9';
      ctx.beginPath();
      ctx.arc(scratch.x, scratch.y, style.size * 0.55, 0, 6.283);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // Json factories: pulsing, spitting into the flows.
  for (const f of scene.factories) {
    if (!vis(f.x, f.y)) continue;
    const pulse = 0.5 + Math.sin(time * 2.1 + f.phase) * 0.5;
    ctx.fillStyle = PALETTE.factory;
    ctx.fillRect(f.x - 26, f.y - 18, 52, 36);
    ctx.fillStyle = PALETTE.factoryGlow;
    ctx.globalAlpha = 0.25 + pulse * 0.55;
    ctx.fillRect(f.x - 8, f.y - 30, 16, 12);
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.font = `600 ${13 / Math.max(z, 0.3)}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('{ }', f.x, f.y + 5);
    ctx.globalAlpha = 1;
  }

  // Voter traffic: real handles passing along the lines. Decoration only.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const m of scene.traffic) {
    const e = edges[m.edge];
    if (!e) continue;
    posAt(e, m.t, scratch);
    if (!vis(scratch.x, scratch.y)) continue;
    const a = clamp(m.life / m.max, 0, 1);
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = PALETTE.traffic;
    ctx.beginPath();
    ctx.arc(scratch.x, scratch.y, 3, 0, 6.283);
    ctx.fill();
    if (z > 0.4) {
      ctx.globalAlpha = a * 0.55;
      ctx.font = `500 10px ${MONO}`;
      ctx.fillText(m.handle, scratch.x, scratch.y - 10);
    }
  }
  ctx.globalAlpha = 1;

  // Stake fog.
  const fogAlpha = lerp(0.3, 1, mapness);
  const fogRadius = lerp(0.42, 1, mapness);
  for (const n of nodes) {
    if (n.kind !== 'house') continue;
    const h = scene.houses[n.ref];
    if (!h) continue;
    const r = h.bubble * fogRadius;
    if (n.x + r < vx0 || n.x - r > vx1 || n.y + r < vy0 || n.y - r > vy1) continue;
    ctx.globalAlpha = h.glow * fogAlpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, 6.283);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Junctions and houses, as irregular blobs.
  for (const n of nodes) {
    if (!vis(n.x, n.y)) continue;
    if (n.kind === 'junction') {
      ctx.fillStyle = PALETTE.junction;
      ctx.globalAlpha = 0.85;
      blobPath(ctx, n.x, n.y, 6, n.id);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (n.kind === 'house') {
      const h = scene.houses[n.ref];
      if (!h) {
        ctx.fillStyle = PALETTE.junction;
        ctx.globalAlpha = 0.85;
        blobPath(ctx, n.x, n.y, 6, n.id);
        ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }
      const col = scene.tierColors[h.tier];
      const rNode = Math.min(12 / Math.max(z, 0.35), 130);
      const rHalo = rNode * (2.1 + mapness * 1.6);
      if (h.isNewcomer) {
        const beat = 0.5 + Math.sin(time * 1.9 + n.id) * 0.5;
        ctx.strokeStyle = PALETTE.newRing;
        ctx.globalAlpha = 0.2 + beat * 0.7;
        ctx.lineWidth = 2.6 / Math.max(z, 0.1);
        ctx.beginPath();
        ctx.arc(n.x, n.y, rNode * 2 + beat * 6, 0, 6.283);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = 0.22 + mapness * 0.3;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(n.x, n.y, rHalo, 0, 6.283);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      blobPath(ctx, n.x, n.y, rNode, n.id);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6 / Math.max(z, 0.2);
      ctx.stroke();

      const near = Math.hypot(n.x - player.x, n.y - player.y) < 560;
      const col2 = h.isNewcomer ? PALETTE.newRing : PALETTE.text;
      if (mapLabels) {
        labelQueue.push({ x: n.x, y: n.y, under: rHalo, text: `@${h.handle}`, color: col2, priority: 1 });
      } else if (z > 0.3 && near) {
        const fs = Math.min(12 / z, 360);
        ctx.font = `600 ${fs}px ${MONO}`;
        ctx.fillStyle = col2;
        ctx.globalAlpha = 0.9;
        ctx.fillText(`@${h.handle}`, n.x, n.y - rNode - fs * 0.75);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Landmarks: every type its own vector icon; the destination worlds are
  // drawn as structures so arriving feels like arriving somewhere.
  for (const n of nodes) {
    if (n.kind !== 'landmark' || !vis(n.x, n.y)) continue;
    const lm = scene.landmarks[n.ref];
    if (!lm) continue;
    const col = CATEGORY_HEX[lm.category];
    const minor = lm.icon === 'doc' || lm.icon === 'docq';
    const s = lm.world ? 95 : (minor ? 24 : 36) / Math.max(z, 0.45);
    drawIcon(ctx, lm.icon, n.x, n.y, s, col, time);
    const clearance = lm.world ? 230 : s * 1.6;
    if (mapLabels) {
      labelQueue.push({
        x: n.x,
        y: n.y,
        under: clearance,
        text: lm.label,
        color: col,
        priority: lm.world ? 5 : minor ? 2 : 3
      });
    } else {
      const fs = Math.min(13 / z, 400);
      ctx.font = `700 ${fs}px ${MONO}`;
      ctx.fillStyle = col;
      ctx.fillText(lm.label, n.x, n.y - clearance - fs * 0.6);
    }
  }

  // Communities: glowing translucent bubbles of varying size.
  for (const n of nodes) {
    if (n.kind !== 'community' || !vis(n.x, n.y)) continue;
    const c = scene.communities[n.ref];
    if (!c) continue;
    const beat = 0.5 + Math.sin(time * 1.3 + n.ref) * 0.5;
    ctx.fillStyle = '#7fd8ff';
    ctx.globalAlpha = 0.1 + beat * 0.05;
    ctx.beginPath();
    ctx.arc(n.x, n.y, c.radius, 0, 6.283);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#7fd8ff';
    ctx.lineWidth = 2.4 / Math.max(z, 0.08);
    ctx.beginPath();
    ctx.arc(n.x, n.y, c.radius, 0, 6.283);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#bfe9ff';
    ctx.beginPath();
    ctx.arc(n.x, n.y, 8 / Math.max(z, 0.3), 0, 6.283);
    ctx.fill();
    if (mapLabels) {
      labelQueue.push({ x: n.x, y: n.y, under: c.radius, text: c.label, color: '#bfe9ff', priority: 4 });
    } else {
      const fs = Math.min(13 / z, 400);
      ctx.font = `700 ${fs}px ${MONO}`;
      ctx.fillText(c.label, n.x, n.y - c.radius - fs * 0.7);
    }
  }

  drawBug(ctx, player, time);

  // Warp effect: expanding rings at the bug.
  if (scene.warpFx && scene.warpFx > 0) {
    const f = 1 - scene.warpFx;
    ctx.strokeStyle = PALETTE.newRing;
    for (const mul of [1, 1.6]) {
      ctx.globalAlpha = scene.warpFx * 0.8;
      ctx.lineWidth = 3 / Math.max(z, 0.1);
      ctx.beginPath();
      ctx.arc(player.x, player.y, (30 + f * 320 * mul) / Math.max(z, 0.2), 0, 6.283);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // The player marker on the map: always findable.
  if (mapness > 0.3) {
    const beat = 0.5 + Math.sin(time * 5) * 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.5 + beat * 0.5;
    ctx.lineWidth = 2.5 / z;
    ctx.beginPath();
    ctx.arc(player.x, player.y, (16 + beat * 6) / z, 0, 6.283);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.hive;
    ctx.save();
    ctx.translate(player.x, player.y);
    const s = 9 / z;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 / z;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();

  // The map-zoom label pass: place every queued label in screen space,
  // nudging or dropping so that no two labels ever overlap.
  if (labelQueue.length) {
    lastLabelStats.placed = 0;
    lastLabelStats.shifted = 0;
    lastLabelStats.dropped = 0;
    const placedRects: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const fs = 12;
    ctx.font = `700 ${fs}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    labelQueue.sort((a, b) => b.priority - a.priority);
    for (const req of labelQueue) {
      const sxp = (req.x - cam.x) * z + W / 2 + sx;
      const syp = (req.y - cam.y) * z + H / 2 + sy;
      if (sxp < -60 || sxp > W + 60 || syp < -60 || syp > H + 60) continue;
      const w = req.text.length * fs * 0.62 + 8;
      const h = fs * 1.35;
      const off = req.under * z + 9;
      const spots = [syp - off, syp + off + 4, syp - off - h - 2, syp + off + h + 6];
      let chosen = -1;
      for (let i = 0; i < spots.length; i++) {
        const y0 = spots[i] - h / 2;
        const y1 = spots[i] + h / 2;
        const x0 = sxp - w / 2;
        const x1 = sxp + w / 2;
        let clash = false;
        for (const r of placedRects) {
          if (x0 < r.x1 && x1 > r.x0 && y0 < r.y1 && y1 > r.y0) {
            clash = true;
            break;
          }
        }
        if (!clash) {
          chosen = i;
          placedRects.push({ x0, y0, x1, y1 });
          break;
        }
      }
      if (chosen < 0) {
        lastLabelStats.dropped++;
        continue;
      }
      if (chosen > 0) lastLabelStats.shifted++;
      lastLabelStats.placed++;
      ctx.fillStyle = req.color;
      ctx.globalAlpha = 0.95;
      ctx.fillText(req.text, sxp, spots[chosen]);
      ctx.globalAlpha = 1;
    }
  }

  drawHud(scene);
}

/** Transparent isometric-ish cube. */
function drawCube(ctx: CanvasRenderingContext2D, c: Cube): void {
  const s = c.size;
  const col = CUBE_HEX[c.hue];
  ctx.globalAlpha = c.alpha;
  ctx.fillStyle = col;
  // top face
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - s);
  ctx.lineTo(c.x + s * 0.87, c.y - s * 0.5);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(c.x - s * 0.87, c.y - s * 0.5);
  ctx.closePath();
  ctx.fill();
  // left face, darker
  ctx.globalAlpha = c.alpha * 0.6;
  ctx.beginPath();
  ctx.moveTo(c.x - s * 0.87, c.y - s * 0.5);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(c.x, c.y + s * 0.9);
  ctx.lineTo(c.x - s * 0.87, c.y + s * 0.4);
  ctx.closePath();
  ctx.fill();
  // right face, darkest
  ctx.globalAlpha = c.alpha * 0.4;
  ctx.beginPath();
  ctx.moveTo(c.x + s * 0.87, c.y - s * 0.5);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(c.x, c.y + s * 0.9);
  ctx.lineTo(c.x + s * 0.87, c.y + s * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawHud(scene: RenderScene): void {
  const { ctx, hud } = scene;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `600 13px ${MONO}`;
  ctx.fillStyle = PALETTE.newRing;
  ctx.fillText(`${hud.housesLabel} ${hud.housesCount}`, 16, 14);
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(`${hud.windowLabel} ${hud.windowTime}`, 16, 33);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
}

/**
 * The bug, kept exactly as before: red diamond body, antennae with googly
 * eyes, the cyan surfboard, and the drift countdown ring.
 */
function drawBug(ctx: CanvasRenderingContext2D, p: PlayerState, time: number): void {
  const BW = 15;
  const BH = 17;
  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.save();
  ctx.rotate(p.face >= 0 ? 0.18 : -0.18);
  ctx.fillStyle = PALETTE.board;
  ctx.strokeStyle = PALETTE.boardLit;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, BH + 4, 22, 6.5, 0, 0, 6.283);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-20, BH + 4);
  ctx.lineTo(20, BH + 4);
  ctx.globalAlpha = 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();

  for (let e = -1; e <= 1; e += 2) {
    const tx = e * 10 + p.face * 2.4;
    const ty = -29 + Math.sin(time * 4 + e) * 1.6;
    ctx.strokeStyle = PALETTE.hiveLit;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(e * 5, -10);
    ctx.quadraticCurveTo(e * 12, -22, tx, ty);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tx, ty, 4.6, 0, 6.283);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#5c0a16';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = PALETTE.hiveBlack;
    ctx.beginPath();
    ctx.arc(tx + p.face * 1.7, ty + 0.5, 2, 0, 6.283);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.moveTo(0, -BH);
  ctx.lineTo(BW, 0);
  ctx.lineTo(0, BH);
  ctx.lineTo(-BW, 0);
  ctx.closePath();
  ctx.fillStyle = PALETTE.hive;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // The real Hive mark on the body. Drawn OUTSIDE any facing flip: the body
  // flips left/right via `face` offsets only, so the mark never mirrors.
  drawHiveMark(ctx, 0, 0, 15, '#ffffff');

  if (p.mode === 'drift') {
    const f = clamp(p.fuel / 2.4, 0, 1);
    ctx.strokeStyle = f > 0.4 ? '#ffffff' : '#ff5f7a';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.5 + Math.sin(time * 18) * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, 31, -1.57, -1.57 + 6.283 * f);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
