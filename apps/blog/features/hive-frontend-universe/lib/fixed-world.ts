/**
 * Hive Frontend Universe - the fixed world.
 *
 * The world is no longer a disk with arms. It is a BODY of uneven globular
 * cells (territories of very different sizes, ragged coastline) with BREAKOUT
 * CLUSTERS hanging off it at varying distances, like the classic
 * decentralized-network diagram:
 *
 *   - 'trail' clusters connect to the body by a single thin rail trail;
 *   - 'hop'   clusters connect by NOTHING and are reached only by hopping
 *             the gap with a full drift ring;
 *   - 'wall'  clusters sit behind gaps 1.5-3x the maximum hop distance and
 *             are deliberately unreachable for now.
 *
 * Permanent landmarks are re-placed: some sit INSIDE the body woven among
 * the posts (they are mesh anchors), the rest anchor the breakout clusters.
 * The governance pair (Proposals, Witnesses) gets its own cluster.
 *
 * Everything here is permanent and position-fixed forever, so players learn
 * the world. Only the body's weave is rewoven per 30-minute window. Every
 * number in this file is hand-tunable; zero imports.
 */

/** World geometry constants shared by the mesh, the clusters and the camera. */
export const WORLD = {
  /** Target junction spacing (Poisson-disk radius), world px. */
  spacing: 470,
  /** How many house slots (live posts) the body holds. */
  houseSlots: 30,
  /** Half-extent the full travel map must fit, world px. */
  fitExtent: 8500,
  /** Communities float this far beyond the coastline, world px. */
  communityCoastOffset: 620,
  /** A safety bound for mask sampling; nothing meaningful beyond this. */
  bboxRadius: 5200
} as const;

/* ------------------------------ the body ------------------------------ */

/** One globular cell of the body. Sizes are mixed HARD on purpose. */
export interface BodyCell {
  x: number;
  y: number;
  r: number;
}

/**
 * The body: overlapping globs, largest ~4x the smallest, so the union reads
 * as territories rather than fabric. Move or resize a lobe by editing a line.
 */
export const BODY_CELLS: readonly BodyCell[] = [
  { x: 0, y: 0, r: 2700 }, // heartland (biggest)
  { x: -3100, y: -700, r: 1900 }, // west lobe
  { x: 2600, y: -1800, r: 1500 }, // northeast lobe
  { x: 2900, y: 1500, r: 1100 }, // southeast lobe
  { x: -1500, y: 2500, r: 1300 }, // south lobe
  { x: 900, y: -3100, r: 950 }, // north spur
  { x: -3900, y: 1400, r: 850 }, // southwest spur
  { x: 3900, y: 200, r: 700 } // east cape (smallest)
];

/**
 * Coastline noise: each cell's radius is modulated around its rim so the
 * outer edge is ragged like a coastline, never a smooth circle. Fixed phases
 * per cell (index-hashed), so the coast is identical for everyone forever.
 */
export function cellRadiusAt(cellIndex: number, angleRad: number): number {
  const cell = BODY_CELLS[cellIndex];
  const p1 = ((cellIndex * 2654435761) % 628) / 100;
  const p2 = ((cellIndex * 40503 + 977) % 628) / 100;
  return cell.r * (1 + 0.1 * Math.sin(5 * angleRad + p1) + 0.06 * Math.sin(9 * angleRad + p2));
}

/** Region test: inside the ragged union of cells. */
export function insideBody(x: number, y: number): boolean {
  for (let i = 0; i < BODY_CELLS.length; i++) {
    const c = BODY_CELLS[i];
    const dx = x - c.x;
    const dy = y - c.y;
    const d2 = dx * dx + dy * dy;
    // Cheap reject before the trig of the ragged radius.
    const rMax = c.r * 1.16;
    if (d2 > rMax * rMax) continue;
    const rr = cellRadiusAt(i, Math.atan2(dy, dx));
    if (d2 <= rr * rr) return true;
  }
  return false;
}

/**
 * Seeded point sampler, uniform-ish over the body (cells weighted by area).
 * Used for house placement; always returns a point inside the mask.
 */
export function sampleBodyPoint(rng: () => number): { x: number; y: number } {
  const weights = BODY_CELLS.map((c) => c.r * c.r);
  const total = weights.reduce((a, b) => a + b, 0);
  for (let attempt = 0; attempt < 24; attempt++) {
    let pick = rng() * total;
    let idx = 0;
    while (idx < BODY_CELLS.length - 1 && pick >= weights[idx]) {
      pick -= weights[idx];
      idx++;
    }
    const c = BODY_CELLS[idx];
    const ang = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * c.r * 0.92;
    const x = c.x + Math.cos(ang) * rad;
    const y = c.y + Math.sin(ang) * rad;
    if (insideBody(x, y)) return { x, y };
  }
  // The centre of the biggest cell is always inside.
  return { x: BODY_CELLS[0].x, y: BODY_CELLS[0].y };
}

/**
 * Distance from the origin to the coast along a ray (screen angle degrees,
 * y grows downward). Marched, so it respects the ragged noise. Used to float
 * the community bubbles just off the coastline.
 */
export function coastDistanceAt(angleDeg: number): number {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = -Math.sin(rad);
  let last = 0;
  for (let r = 200; r <= 9000; r += 40) {
    if (insideBody(dx * r, dy * r)) last = r;
  }
  return last;
}

/* ---------------------------- the clusters ---------------------------- */

export type ClusterLink = 'trail' | 'hop' | 'wall';

export interface Cluster {
  id: string;
  /** Hub position, world px. Hand-tunable. */
  x: number;
  y: number;
  link: ClusterLink;
  /**
   * Extra plain satellites (beyond the landmark spokes), as polar offsets
   * from the hub: [angleDeg, dist]. Angles are chosen by hand to keep every
   * pair of spokes at least 35 degrees apart, hub degree at most 4.
   */
  satellites: readonly (readonly [number, number])[];
}

/**
 * Six breakout star clusters. Spoke angle budgets (including the trail entry
 * for 'trail' clusters and the landmark spokes below) are hand-checked to
 * respect the 35-degree and max-degree-4 junction rules.
 */
export const CLUSTERS: readonly Cluster[] = [
  // Governance corner: the pair's own breakout cluster, rail trail from the
  // south lobe. Trail arrives from the north (~90deg).
  { id: 'governance', x: -1500, y: 5400, link: 'trail', satellites: [] },
  // The Arcade: rail trail from the east cape. Trail arrives from the west.
  { id: 'arcade', x: 6100, y: -400, link: 'trail', satellites: [[250, 470]] },
  // The library: hop-only, floats north of the north spur.
  { id: 'library', x: 700, y: -4880, link: 'hop', satellites: [[210, 440]] },
  // Records: hop-only, floats south-east of the southeast lobe.
  { id: 'records', x: 3400, y: 3330, link: 'hop', satellites: [] },
  // Launch: WALL. ~2x the max hop. Rockets across an uncrossable void.
  { id: 'launch', x: 5420, y: -3910, link: 'wall', satellites: [[300, 450]] },
  // The gateway: WALL. ~2.7x the max hop. A lone door far out in the dark.
  { id: 'gateway', x: -7560, y: -700, link: 'wall', satellites: [[60, 430], [300, 430]] }
];

/* ---------------------------- the landmarks ---------------------------- */

export type LandmarkKind = 'internal' | 'wallet' | 'explorer' | 'chat' | 'external' | 'none';
export type LandmarkCategory = 'tool' | 'dapp' | 'governance' | 'info' | 'arcade' | 'social';

/**
 * The icon seam: one key per landmark type, drawn as a code vector shape in
 * `engine/icons.ts`. Swapping the art later means touching that file only.
 */
export type IconKey =
  | 'ferris'
  | 'towers'
  | 'launchpad'
  | 'arcadebldg'
  | 'blackhole'
  | 'spaceship'
  | 'magnifier'
  | 'quill'
  | 'wallet'
  | 'bubble'
  | 'doc'
  | 'docq'
  | 'newspaper'
  | 'tent'
  | 'flag'
  | 'door'
  | 'hivemark'
  | 'blocks'
  | 'pulse'
  | 'gate';

/** Where a landmark sits: woven into the body, or on a cluster spoke. */
export type LandmarkPlace =
  | { in: 'body'; x: number; y: number }
  | { in: 'cluster'; cluster: string; angleDeg: number; dist: number };

export interface Landmark {
  id: string;
  kind: LandmarkKind;
  path: string;
  labelKey: string;
  category: LandmarkCategory;
  icon: IconKey;
  place: LandmarkPlace;
  /** True for the big destination worlds drawn as structures. */
  world?: boolean;
}

/**
 * Every landmark position is hand-tunable here. Body landmarks become mesh
 * anchors (the weave grows around them); cluster landmarks are the spokes of
 * their star. Cluster spoke angles are hand-spaced at 35+ degrees.
 */
export const LANDMARKS: readonly Landmark[] = [
  // Governance cluster: the two destination worlds, side by side.
  { id: 'proposals', kind: 'wallet', path: '/proposals', labelKey: 'hive_frontend_universe.worlds.dhf_fun_park', category: 'governance', icon: 'ferris', place: { in: 'cluster', cluster: 'governance', angleDeg: 205, dist: 760 }, world: true },
  { id: 'witnesses', kind: 'wallet', path: '/~witnesses', labelKey: 'hive_frontend_universe.worlds.witty_world', category: 'governance', icon: 'towers', place: { in: 'cluster', cluster: 'governance', angleDeg: 335, dist: 760 }, world: true },
  // Launch cluster (walled off for now).
  { id: 'our_dapps', kind: 'external', path: 'https://hive.io/eco/', labelKey: 'navigation.main_nav_bar.out_dapps', category: 'dapp', icon: 'launchpad', place: { in: 'cluster', cluster: 'launch', angleDeg: 60, dist: 700 }, world: true },
  { id: 'hive_dapps', kind: 'external', path: 'https://hivedapps.com/', labelKey: 'navigation.explore_nav.hive_dapps', category: 'dapp', icon: 'spaceship', place: { in: 'cluster', cluster: 'launch', angleDeg: 180, dist: 470 } },
  // Inside the body, woven among the posts.
  { id: 'write_post', kind: 'internal', path: '/submit.html', labelKey: 'hive_frontend_universe.landmarks.write_post', category: 'tool', icon: 'quill', place: { in: 'body', x: 1200, y: 300 } },
  { id: 'search', kind: 'internal', path: '/search', labelKey: 'hive_frontend_universe.landmarks.search', category: 'tool', icon: 'magnifier', place: { in: 'body', x: -1400, y: -600 } },
  { id: 'wallet', kind: 'wallet', path: '/', labelKey: 'hive_frontend_universe.landmarks.wallet', category: 'tool', icon: 'wallet', place: { in: 'body', x: 300, y: -1500 } },
  // The Arcade cluster.
  { id: 'arcade', kind: 'internal', path: '/basecamp', labelKey: 'hive_frontend_universe.landmarks.arcade', category: 'arcade', icon: 'arcadebldg', place: { in: 'cluster', cluster: 'arcade', angleDeg: 20, dist: 700 }, world: true },
  // Newcomer country, now inside the body (the tent is the spawn).
  { id: 'basecamp', kind: 'internal', path: '/basecamp', labelKey: 'navigation.main_nav_bar.basecamp', category: 'social', icon: 'tent', place: { in: 'body', x: -600, y: 800 } },
  { id: 'welcome', kind: 'internal', path: '/welcome', labelKey: 'navigation.sidebar.welcome', category: 'info', icon: 'flag', place: { in: 'body', x: -1000, y: 2300 } },
  { id: 'faq', kind: 'internal', path: '/faq.html', labelKey: 'navigation.sidebar.faq', category: 'info', icon: 'docq', place: { in: 'body', x: -1600, y: 2900 } },
  // The gateway (walled off): a lone door in the dark.
  { id: 'sign_up', kind: 'external', path: 'https://signup.hive.io/', labelKey: 'navigation.main_nav_bar.sign_up', category: 'social', icon: 'door', place: { in: 'cluster', cluster: 'gateway', angleDeg: 180, dist: 500 } },
  // Social spots, inside the body.
  { id: 'posts', kind: 'internal', path: '/trending', labelKey: 'navigation.main_nav_bar.posts', category: 'social', icon: 'newspaper', place: { in: 'body', x: -2900, y: -1200 } },
  { id: 'chat', kind: 'chat', path: '/', labelKey: 'navigation.sidebar.openhive_chat', category: 'social', icon: 'bubble', place: { in: 'body', x: 2400, y: -1500 } },
  { id: 'communities_gate', kind: 'internal', path: '/communities', labelKey: 'hive_frontend_universe.landmarks.communities', category: 'social', icon: 'gate', place: { in: 'body', x: -2600, y: 900 } },
  // The library cluster (hop-only), with the black hole at its edge.
  { id: 'developer_portal', kind: 'external', path: 'https://developers.hive.io', labelKey: 'navigation.sidebar.developer_portal', category: 'info', icon: 'blackhole', place: { in: 'cluster', cluster: 'library', angleDeg: 145, dist: 520 } },
  { id: 'what_is_hive', kind: 'external', path: 'https://hive.io', labelKey: 'navigation.explore_nav.what_is_hive', category: 'info', icon: 'hivemark', place: { in: 'cluster', cluster: 'library', angleDeg: 27, dist: 500 } },
  { id: 'whitepaper', kind: 'external', path: 'https://hive.io/whitepaper.pdf', labelKey: 'navigation.sidebar.hive_whitepaper', category: 'info', icon: 'doc', place: { in: 'cluster', cluster: 'library', angleDeg: 284, dist: 470 } },
  // Records cluster (hop-only): the minor paperwork, clearly minor.
  { id: 'block_explorer', kind: 'explorer', path: '/', labelKey: 'navigation.explore_nav.blockexplorer', category: 'tool', icon: 'blocks', place: { in: 'cluster', cluster: 'records', angleDeg: 45, dist: 470 } },
  { id: 'healthchecker', kind: 'internal', path: '/healthchecker', labelKey: 'hive_frontend_universe.landmarks.healthchecker', category: 'tool', icon: 'pulse', place: { in: 'cluster', cluster: 'records', angleDeg: 135, dist: 470 } },
  { id: 'privacy', kind: 'internal', path: '/privacy.html', labelKey: 'navigation.sidebar.privacy_policy', category: 'info', icon: 'doc', place: { in: 'cluster', cluster: 'records', angleDeg: 225, dist: 470 } },
  { id: 'terms', kind: 'internal', path: '/tos.html', labelKey: 'navigation.sidebar.terms_of_service', category: 'info', icon: 'doc', place: { in: 'cluster', cluster: 'records', angleDeg: 315, dist: 470 } }
];

/**
 * Curated map: landmark id to the REAL Hive account whose avatar it wears
 * (fetched through the app's own avatar proxy). Landmarks not listed here
 * keep their code-drawn icon. The fictional places (Arcade, Fun Park, Witty
 * World, the Basecamp tent) are deliberately NOT listed.
 */
export const LANDMARK_ACCOUNTS: Readonly<Record<string, string>> = {
  what_is_hive: 'hiveio'
};

/** World-space position of a landmark (cluster spokes resolved). */
export function landmarkPosition(lm: Landmark): { x: number; y: number } {
  const place = lm.place;
  if (place.in === 'body') return { x: place.x, y: place.y };
  const cluster = CLUSTERS.find((c) => c.id === place.cluster);
  if (!cluster) return { x: 0, y: 0 };
  const rad = (place.angleDeg * Math.PI) / 180;
  return { x: cluster.x + Math.cos(rad) * place.dist, y: cluster.y - Math.sin(rad) * place.dist };
}

export function bodyLandmarkIndexes(): number[] {
  return LANDMARKS.map((lm, i) => (lm.place.in === 'body' ? i : -1)).filter((i) => i >= 0);
}

export function clusterLandmarkIndexes(clusterId: string): number[] {
  return LANDMARKS.map((lm, i) =>
    lm.place.in === 'cluster' && lm.place.cluster === clusterId ? i : -1
  ).filter((i) => i >= 0);
}

/* --------------------------- the communities --------------------------- */

/**
 * The community bubble arc: ten fixed slots floating off the SW coastline.
 * Kept clear of the governance trail corridor (~254 degrees).
 */
export const COMMUNITY_ARC = { startDeg: 186, endDeg: 238, slots: 10 } as const;

export interface CommunitySlot {
  slot: number;
  angleDeg: number;
}

export function communitySlots(): CommunitySlot[] {
  const { startDeg, endDeg, slots } = COMMUNITY_ARC;
  const step = (endDeg - startDeg) / (slots - 1);
  return Array.from({ length: slots }, (_, i) => ({ slot: i, angleDeg: startDeg + i * step }));
}

/** Position of an angle at a radius, world px (y grows downward on canvas). */
export function rimPosition(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: -Math.sin(rad) * radius };
}
