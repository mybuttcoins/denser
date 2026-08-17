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
import type { Factory, Cube, Formation } from './scenery';
import type { FlowParticle } from './particles';
import type { CritterState } from './critters';
import type { LandmarkCategory, IconKey } from '../lib/fixed-world';
import {
  drawIcon,
  drawFish,
  drawBugMark,
  drawFormation,
  drawCommunityEmblem,
  drawWitnessCitadel
} from './icons';
import { drawCritters } from './critters';
import { drawCoins, type CoinState } from './coins';
import { avatarImage } from './avatars';
import { drawGround, GROUND_VOID, type Ground } from './ground';

export const PALETTE = {
  bg: GROUND_VOID,
  star: '#bcd2f0',
  /**
   * Ordinary lines are STREETS, NOT STARS: dim and desaturated so they sit on
   * the terrain instead of floating over it. The post line and the landmarks
   * are what the eye should catch.
   */
  mesh: '#6fbcd8',
  spoke: '#ac92f0',
  junction: '#7fd0e8',
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
  boardLit: '#5df0ff',
  /**
   * THE POST LINE. Pass five drew this in warm orange, which worked on black
   * but dies on the pass-six ground: the terrain is now deep warm red, so an
   * orange line sits in the same hue family as the land it crosses and stops
   * reading as a separate thing.
   *
   * Re-picked as GOLD. Every region tone is dark and desaturated, so luminance
   * is what separates the line from the ground, and gold is the brightest of
   * the warm options by a distance. Gold also leaves the cool end of the
   * palette alone, which matters: the newcomer rings, the community bubbles
   * and the bug's surfboard are all cyan already, and a cyan post line would
   * have collided with the very markers that sit on it like stations.
   */
  route: '#ffc83a',
  routeGlow: '#ffe9a8',
  /**
   * THE DAPPS LINE: cyan. The ground is now molten crimson, so cyan is its
   * direct complement and separates from the terrain harder than anything
   * else available. It also cannot be confused with the gold post line, which
   * violet (the other candidate) would have struggled with: violet sits close
   * to the crimson ground AND close to the dim slate streets, so it would have
   * read as a slightly odd street rather than as a route.
   */
  dapps: '#35e0ff',
  dappsGlow: '#a6f0ff'
} as const;

/** One named line of the transit map, drawn casing then glow then core. */
export interface RouteLayer {
  edges: Set<number>;
  casing: string;
  glow: string;
  core: string;
  /** Core stroke width in screen px at zoom 1. */
  width: number;
  /**
   * Dash pattern for a line drawn ON TOP of another. The two named lines share
   * a lot of track, and a solid line drawn second simply hides the first; a
   * dashed one lets the line underneath show through the gaps, which is how
   * transit maps have always drawn shared track.
   */
  dash?: number[];
}

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

/**
 * The big five: shared half-footprint on the map, world px. Everything about
 * their presence (light pool, label clearance) keys off this one number.
 */
const BIG_SPAN = 330;

/**
 * Per-icon half-size for the big five. Each icon function applies its own
 * internal scale factor, so a single shared number would render them at wildly
 * different sizes; these are tuned so all five land at roughly the same
 * footprint, about 650-670 world px across.
 *
 * That footprint is a compromise measured in the browser rather than guessed.
 * At the first try (about 950 px) they read well on the pulled-out map but
 * filled half the screen at play zoom, which was overwhelming. At this size
 * they still tower over an ordinary marker, which is roughly 160 world px
 * across at map zoom, by about four times.
 */
const BIG_SIZE: Partial<Record<IconKey, number>> = {
  ferris: 150,
  towers: 168,
  arcadebldg: 133,
  blackhole: 119,
  tent: 350
};

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
  /**
   * The BIG FIVE: drawn as oversized illustrations, several times larger than
   * any other marker, so they are visible instantly at map zoom.
   */
  big?: boolean;
  /** Real Hive account whose avatar this landmark wears, if it has one. */
  handle?: string;
}

export interface CommunityVisual {
  label: string;
  radius: number;
  /** The community's own account name (its avatar is fetched with it). */
  handle: string;
}

/** One citadel on the witness ring. */
export interface WitnessVisual {
  name: string;
  /** 1 for the top-voted witness, through 21. */
  rank: number;
  x: number;
  y: number;
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
  /** Spiky rock formations standing on the terrain. Inert scenery. */
  formations: Formation[];
  /**
   * The top 21 witnesses, ringing the world in rank order. Scenery: no mesh
   * node, nothing to collide with, nothing to travel to.
   */
  witnesses: WitnessVisual[];
  flows: FlowParticle[];
  traffic: TrafficMarker[];
  /**
   * The named lines, drawn in order so the flagship lands on top. Ordinary
   * mesh edges are the dim streets underneath.
   */
  routeLayers: RouteLayer[];
  /** The inert population; its whole seam lives in engine/critters.ts. */
  critters: CritterState | null;
  /** JSON tokens, what carries them and what steals them. */
  coins: CoinState | null;
  /** The filled landmasses under everything; built once per window. */
  ground: Ground | null;
  /** Slot of the community bubble the bug is standing in, or -1. Display only. */
  activeCommunity: number;
  player: PlayerState;
  time: number;
  tierColors: string[];
  shake?: number;
  /** Warp effect countdown, 1 → 0. */
  warpFx?: number;
  hud: {
    housesLabel: string;
    windowLabel: string;
    housesCount: number;
    windowTime: string;
    tokensLabel: string;
    carried: number;
    banked: number;
  };
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

  // NOTHING ON THIS MAP IS LETTERED. Names used to be painted beside every
  // post, place, community and tower, and at map zoom that was most of the
  // pixels: the map read as a list rather than as a world. Identity is now
  // carried by the art (profile photos, emblems, illustrated places) and the
  // NAME APPEARS ON HOVER, in the DOM layer above the canvas.

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

  // THE GROUND. Filled landmasses, drawn over the void (and over the stars and
  // fish, which belong to the open water) and under everything else. The
  // geometry was built once per window; this only fills stored paths, culled
  // to the viewport.
  if (scene.ground) {
    drawGround(ctx, scene.ground, vx0, vy0, vx1, vy1, z);
  }

  // Rock formations: spiky crystal clutches standing on the terrain, under
  // everything travelable. Skipped on the pulled-out map, where 190 clutches
  // of shards would be sub-pixel noise and pure cost.
  if (mapness < 0.72) {
    for (const f of scene.formations) {
      if (!vis(f.x, f.y)) continue;
      drawFormation(ctx, f.x, f.y, f.h, f.shards, f.hue, f.phase, f.lean, time);
    }
  }

  // THE WITNESS RING: the real top 21, standing outside the world in rank
  // order and looking in. Drawn at a fixed world size so they stay legible on
  // the pulled-out map, which is where the ring reads as a ring.
  for (const wt of scene.witnesses) {
    // Bigger than pass nine: the citadels were getting lost against the map.
    const towerH = 1680 - (wt.rank - 1) * 22;
    if (wt.x + towerH < vx0 || wt.x - towerH > vx1 || wt.y + towerH < vy0 || wt.y - towerH > vy1) {
      continue;
    }
    drawWitnessCitadel(
      ctx,
      wt.x,
      wt.y,
      towerH,
      wt.rank,
      wt.name,
      avatarImage(wt.name),
      time,
      wt.rank * 0.7,
      z >= 0.12
    );
  }

  // Cubes: transparent, colourful, under the lines for depth.
  for (const c of scene.cubes) {
    if (!vis(c.x, c.y)) continue;
    drawCube(ctx, c);
  }

  // The lines: wobbled curves. Mesh in teal, spokes in violet. At far zoom
  // the wobble detail is sub-pixel, so the polylines are decimated (and the
  // joins simplified), which keeps the pulled-out map fast on weak hardware.
  const stride = z < 0.1 ? 8 : z < 0.3 ? 4 : 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = stride > 2 ? 'bevel' : 'round';
  const strokeEdge = (e: WorldEdge) => {
    ctx.beginPath();
    ctx.moveTo(e.pts[0], e.pts[1]);
    for (let i = stride; i < e.pts.length - 2; i += stride) ctx.lineTo(e.pts[i], e.pts[i + 1]);
    ctx.lineTo(e.pts[e.pts.length - 2], e.pts[e.pts.length - 1]);
    ctx.stroke();
  };
  for (const kind of ['mesh', 'spoke'] as const) {
    ctx.strokeStyle = kind === 'mesh' ? PALETTE.mesh : PALETTE.spoke;
    // ANY line you are meant to travel along has to look travelable. Pass
    // seven thinned these to 1.8px to push the named routes forward, which
    // went too far: the streets read as hairlines you would not think to ride.
    // Streets are fat where you ride them and slimmer on the pulled-out map,
    // where nobody is travelling and the extra fill was costing real frame time.
    const streetW = (kind === 'mesh' ? 3.4 : 3.1) * (z < 0.12 ? 0.5 : 1);
    ctx.lineWidth = streetW / Math.max(z, 0.05);
    ctx.globalAlpha = kind === 'mesh' ? 0.62 : 0.58;
    for (const e of edges) {
      if (e.kind !== kind || !edgeVis(e)) continue;
      strokeEdge(e);
    }
  }
  ctx.globalAlpha = 1;

  // THE POST LINE: the first subway route. A labeled subset of the mesh
  // edges drawn noticeably thicker in one warm saturated colour, with a soft
  // under-glow, clearly distinct from ordinary lines at both zooms.
  //
  // Three passes, which is what guarantees the line reads against EVERY region
  // it crosses rather than just against the average one: a dark casing that
  // separates it from whatever tone is underneath, a soft glow, then the gold
  // core on top.
  // On the pulled-out map the casing and glow passes are sub-pixel decoration
  // but cost a full stroke of every route edge each. Since pass seven the post
  // line spans the whole world (roughly 110 edges rather than 45) and there are
  // two lines, so the three-pass treatment measured about 6ms of the frame at
  // map zoom. Collapsing to a single fatter core pass there is invisible and
  // pays for itself.
  const routeLod = z < 0.12;
  for (const layer of scene.routeLayers) {
    if (!layer.edges.size) continue;
    const passes = routeLod
      ? [{ col: layer.core, w: layer.width * 1.5, a: 1 }]
      : [
          { col: layer.casing, w: layer.width * 1.98, a: 0.85 },
          { col: layer.glow, w: layer.width * 1.47, a: 0.3 },
          { col: layer.core, w: layer.width, a: 1 }
        ];
    if (layer.dash) ctx.setLineDash(layer.dash.map((d) => d / Math.max(z, 0.05)));
    for (const p of passes) {
      ctx.strokeStyle = p.col;
      ctx.lineWidth = p.w / Math.max(z, 0.05);
      ctx.globalAlpha = p.a;
      for (const e of edges) {
        if (!layer.edges.has(e.id) || !edgeVis(e)) continue;
        strokeEdge(e);
      }
    }
    if (layer.dash) ctx.setLineDash([]);
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
  }
  ctx.globalAlpha = 1;

  // The population: inert critters drifting along the lines. Skipped on the
  // pulled-out map, where they would be sub-pixel noise.
  if (scene.critters && mapness < 0.6) {
    drawCritters(ctx, scene.critters, time, vis);
  }

  // JSON tokens, the trunk of whatever is stealing them, and what the bug is
  // carrying. Skipped on the pulled-out map, where a token is sub-pixel.
  if (scene.coins && mapness < 0.6) {
    drawCoins(ctx, scene.coins, scene.critters, player, time, z, vis);
  }

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
      const rNode = Math.min(17 / Math.max(z, 0.35), 180);
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
      // The face: the author's real profile photo once it has lazily loaded,
      // framed by the same rings; until then (or if the load failed) a flat
      // tier-coloured disc with the account's first letter.
      const rFace = rNode * 1.18;
      const img = avatarImage(h.handle);
      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(n.x, n.y, rFace, 0, 6.283);
        ctx.clip();
        ctx.drawImage(img, n.x - rFace, n.y - rFace, rFace * 2, rFace * 2);
        ctx.restore();
      } else {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(n.x, n.y, rFace, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = '#0b1016';
        ctx.font = `800 ${rFace * 1.15}px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(h.handle.charAt(0).toUpperCase(), n.x, n.y + rFace * 0.06);
      }
      ctx.strokeStyle = h.isNewcomer ? PALETTE.newRing : '#ffffff';
      ctx.lineWidth = 1.8 / Math.max(z, 0.2);
      ctx.beginPath();
      ctx.arc(n.x, n.y, rFace, 0, 6.283);
      ctx.stroke();

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
    // The big five are drawn at a fixed WORLD size, several times any other
    // marker, so they stay huge on the pulled-out map. Everything else is
    // sized in screen space and stays modest, which is what makes the five
    // stand out instead of competing.
    // Bigger than before: with the names gone the art has to carry identity
    // on its own, so an ordinary marker grew from 36 to 52 and the minor
    // paperwork from 24 to 34.
    const s = lm.big ? (BIG_SIZE[lm.icon] ?? 300) : (minor ? 34 : 52) / Math.max(z, 0.45);
    // The black hole is the one big place that must NOT look welcoming, so it
    // is the one that does not get the warm pool.
    if (lm.big && lm.icon !== 'blackhole') {
      // A soft warm pool of light under each big place, so it sits ON the
      // terrain rather than floating above it. The pool uses the shared
      // footprint, not `s`, so all five are lit alike.
      const py = n.y + BIG_SPAN * 0.45;
      const pool = ctx.createRadialGradient(n.x, py, BIG_SPAN * 0.1, n.x, py, BIG_SPAN * 1.5);
      pool.addColorStop(0, 'rgba(255, 196, 120, 0.16)');
      pool.addColorStop(1, 'rgba(255, 170, 90, 0)');
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.arc(n.x, py, BIG_SPAN * 1.5, 0, 6.283);
      ctx.fill();
    }
    // A landmark with a real Hive account wears that account's avatar once
    // it has loaded; otherwise (and meanwhile) its code-drawn icon.
    const lmImg = lm.handle ? avatarImage(lm.handle) : null;
    if (lmImg) {
      const rA = Math.max(s * 0.95, 30);
      ctx.save();
      ctx.beginPath();
      ctx.arc(n.x, n.y, rA, 0, 6.283);
      ctx.clip();
      ctx.drawImage(lmImg, n.x - rA, n.y - rA, rA * 2, rA * 2);
      ctx.restore();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.4 / Math.max(z, 0.2);
      ctx.beginPath();
      ctx.arc(n.x, n.y, rA, 0, 6.283);
      ctx.stroke();
    } else {
      drawIcon(ctx, lm.icon, n.x, n.y, s, col, time, lm.label);
    }
  }

  // Communities: glowing translucent bubbles of varying size.
  for (const n of nodes) {
    if (n.kind !== 'community' || !vis(n.x, n.y)) continue;
    const c = scene.communities[n.ref];
    if (!c) continue;
    const beat = 0.5 + Math.sin(time * 1.3 + n.ref) * 0.5;
    // The bubble the bug is standing in brightens, so "you are here" is
    // visible on the map itself and not only in the banner.
    const here = n.ref === scene.activeCommunity;
    ctx.fillStyle = here ? '#a8e8ff' : '#7fd8ff';
    ctx.globalAlpha = here ? 0.3 + beat * 0.12 : 0.1 + beat * 0.05;
    ctx.beginPath();
    ctx.arc(n.x, n.y, c.radius, 0, 6.283);
    ctx.fill();
    ctx.globalAlpha = here ? 1 : 0.5;
    ctx.strokeStyle = here ? '#d8f4ff' : '#7fd8ff';
    ctx.lineWidth = (here ? 4.4 : 2.4) / Math.max(z, 0.08);
    ctx.beginPath();
    ctx.arc(n.x, n.y, c.radius, 0, 6.283);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // An animated emblem chosen from the community's own NAME, so each bubble
    // reads as its own place rather than as one of ten identical circles.
    drawCommunityEmblem(ctx, c.handle, n.x, n.y, c.radius * 0.82, time);

    // The community's real avatar floats at the bubble's heart once loaded;
    // a small bright dot till then. Noticeably bigger than pass seven drew it,
    // since the logo is the thing that identifies the place.
    const cImg = avatarImage(c.handle);
    if (cImg) {
      const rC = Math.min(c.radius * 0.62, 190);
      ctx.save();
      ctx.beginPath();
      ctx.arc(n.x, n.y, rC, 0, 6.283);
      ctx.clip();
      ctx.drawImage(cImg, n.x - rC, n.y - rC, rC * 2, rC * 2);
      ctx.restore();
      ctx.strokeStyle = here ? '#d8f4ff' : '#7fd8ff';
      ctx.lineWidth = (here ? 5 : 3.4) / Math.max(z, 0.2);
      ctx.beginPath();
      ctx.arc(n.x, n.y, rC, 0, 6.283);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#bfe9ff';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 12 / Math.max(z, 0.3), 0, 6.283);
      ctx.fill();
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
  ctx.fillStyle = '#ffd24a';
  ctx.fillText(`${hud.tokensLabel} ${hud.carried} / ${hud.banked}`, 16, 52);
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

  // The glassy Hive mark on the body: molten red glass, dark-outlined so it
  // reads at play zoom. Drawn OUTSIDE any facing flip: the body faces
  // left/right via `face` coordinate offsets only, never a flip transform,
  // so the mark can never appear backwards.
  drawBugMark(ctx, 0, 0.5, 24);

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
