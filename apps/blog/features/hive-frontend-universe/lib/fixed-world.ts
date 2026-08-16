/**
 * Hive Frontend Universe - the fixed world.
 *
 * The ground is THREE LANDMASSES whose combined silhouette is the real Hive
 * mark eroded into terrain: the solid DIAMOND (west), and the two CHEVRON
 * BLADES (centre and east). The cell table that makes those shapes is
 * generated and lives in lib/landmass.ts; this file is the hand-tunable half:
 * where every permanent thing stands.
 *
 * Between the landmasses run the two CHANNELS, sized at 1.5-3x the maximum
 * drift hop, so the three are separate worlds until a future upgrade. Breakout
 * clusters hang off the outer coasts as little islands offshore:
 *
 *   - 'trail' clusters connect to a landmass by a single thin rail trail;
 *   - 'hop'   clusters connect by NOTHING and are reached only by hopping
 *             the gap with a full drift ring;
 *   - 'wall'  clusters sit behind gaps 1.5-3x the maximum hop distance and
 *             are deliberately unreachable for now.
 *
 * Landmarks are spread across all three landmasses so each has a reason to be
 * visited, and the BIG FIVE (Arcade, DHF Fun Park, Witty World, Developer
 * Portal, Basecamp tent) are drawn several times larger than anything else so
 * they read instantly at map zoom.
 *
 * Every position here is one line and hand-tunable. Only the mesh woven
 * between them is rewoven per 30-minute window.
 */

import {
  BODY_CELLS,
  cellRadiusAt,
  cellsOfLandmass,
  coastDistanceFrom,
  insideBody,
  landmassAt,
  sampleBodyPoint,
  LANDMASS_COUNT,
  LANDMASS_KEYS,
  type BodyCell,
  type LandmassKey
} from './landmass';

export {
  BODY_CELLS,
  cellRadiusAt,
  cellsOfLandmass,
  insideBody,
  landmassAt,
  sampleBodyPoint,
  LANDMASS_COUNT,
  LANDMASS_KEYS
};
export type { BodyCell, LandmassKey };

/** World geometry constants shared by the mesh, the clusters and the camera. */
export const WORLD = {
  /** Target junction spacing (Poisson-disk radius), world px. */
  spacing: 470,
  /** How many house slots (live posts) the world holds. */
  houseSlots: 30,
  /** Half-extent the full travel map must fit, world px. */
  fitExtent: 9200,
  /** Communities float this far beyond the coastline, world px. */
  communityCoastOffset: 620,
  /** A safety bound for mask sampling; nothing meaningful beyond this. */
  bboxRadius: 8000
} as const;

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
 * Five breakout star clusters, offshore of the three landmasses. Spoke angle
 * budgets (including the trail entry for 'trail' clusters and the landmark
 * spokes below) are hand-checked against the 35-degree and degree-4 rules.
 */
export const CLUSTERS: readonly Cluster[] = [
  // A village on the road: rail trail out from the diamond's south-west coast.
  { id: 'anchorage', x: -6900, y: 2400, link: 'trail', satellites: [[35, 470], [300, 450]] },
  // The library: hop-only, floats north of the centre blade's tip. Gap
  // measured at 0.5-0.8x the max hop, so a full drift ring clears it.
  { id: 'library', x: 600, y: -5500, link: 'hop', satellites: [[270, 440]] },
  // Records: hop-only, off the east blade's southern arm. Pulled in from
  // (4620, 4520), where the measured gap was 1.2-1.36x the max hop and the
  // cluster was therefore stranded despite being labelled hoppable.
  { id: 'records', x: 4300, y: 4200, link: 'hop', satellites: [] },
  // Launch: WALL. Rockets across an uncrossable void, far east.
  { id: 'launch', x: 7480, y: -1400, link: 'wall', satellites: [[300, 450]] },
  // The gateway: WALL. A lone door far out in the western dark. Pushed out
  // from (-7580, -600): the nearest lines here are the community bubbles off
  // the diamond's west coast, not the coast itself, and against those the gap
  // measured only 0.96-1.29x, which is a hoppable gap wearing a wall's label.
  { id: 'gateway', x: -8250, y: -600, link: 'wall', satellites: [[60, 430], [300, 430]] }
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

/** Where a landmark sits: woven into a landmass, or on a cluster spoke. */
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
  /**
   * The BIG FIVE: drawn as oversized illustrations several times larger than
   * any other marker, so they are visible instantly at map zoom. Exactly five
   * landmarks carry this flag; everything else stays a modest marker so these
   * stand out.
   */
  big?: boolean;
}

/**
 * Every landmark position is hand-tunable here, one line each. Body landmarks
 * become mesh anchors (the weave grows around them); cluster landmarks are the
 * spokes of their star, hand-spaced at 35+ degrees.
 *
 * Placement was verified against the landmass mask: every body landmark below
 * sits inside its intended landmass with at least 400px of coast clearance.
 */
export const LANDMARKS: readonly Landmark[] = [
  /* ---- THE DIAMOND (west landmass): newcomer country and the daily tools ---- */
  // BIG FIVE. Move the Basecamp tent by editing this one pair of coordinates.
  { id: 'basecamp', kind: 'internal', path: '/basecamp', labelKey: 'navigation.main_nav_bar.basecamp', category: 'social', icon: 'tent', place: { in: 'body', x: -1700, y: 0 }, big: true },
  // BIG FIVE. The Arcade now stands inland among the posts, on the way to
  // things, instead of hanging off the far eastern rim. Move it by editing
  // this one pair of coordinates.
  { id: 'arcade', kind: 'internal', path: '/basecamp', labelKey: 'hive_frontend_universe.landmarks.arcade', category: 'arcade', icon: 'arcadebldg', place: { in: 'body', x: -2650, y: 1150 }, big: true },
  { id: 'write_post', kind: 'internal', path: '/submit.html', labelKey: 'hive_frontend_universe.landmarks.write_post', category: 'tool', icon: 'quill', place: { in: 'body', x: -1150, y: -900 } },
  { id: 'search', kind: 'internal', path: '/search', labelKey: 'hive_frontend_universe.landmarks.search', category: 'tool', icon: 'magnifier', place: { in: 'body', x: -2900, y: -1300 } },
  { id: 'wallet', kind: 'wallet', path: '/', labelKey: 'hive_frontend_universe.landmarks.wallet', category: 'tool', icon: 'wallet', place: { in: 'body', x: -1500, y: 1500 } },
  { id: 'posts', kind: 'internal', path: '/trending', labelKey: 'navigation.main_nav_bar.posts', category: 'social', icon: 'newspaper', place: { in: 'body', x: -3600, y: 400 } },
  { id: 'chat', kind: 'chat', path: '/', labelKey: 'navigation.sidebar.openhive_chat', category: 'social', icon: 'bubble', place: { in: 'body', x: -2600, y: 2200 } },
  { id: 'communities_gate', kind: 'internal', path: '/communities', labelKey: 'hive_frontend_universe.landmarks.communities', category: 'social', icon: 'gate', place: { in: 'body', x: -4200, y: 950 } },
  { id: 'welcome', kind: 'internal', path: '/welcome', labelKey: 'navigation.sidebar.welcome', category: 'info', icon: 'flag', place: { in: 'body', x: -3000, y: -2300 } },

  /* ---- THE CENTRE BLADE: governance country ---- */
  // BIG FIVE. Move the ferris wheel by editing this one pair of coordinates.
  { id: 'proposals', kind: 'wallet', path: '/proposals', labelKey: 'hive_frontend_universe.worlds.dhf_fun_park', category: 'governance', icon: 'ferris', place: { in: 'body', x: 700, y: -2600 }, big: true },
  // BIG FIVE. Move the witness towers by editing this one pair of coordinates.
  { id: 'witnesses', kind: 'wallet', path: '/~witnesses', labelKey: 'hive_frontend_universe.worlds.witty_world', category: 'governance', icon: 'towers', place: { in: 'body', x: 650, y: 2750 }, big: true },
  { id: 'healthchecker', kind: 'internal', path: '/healthchecker', labelKey: 'hive_frontend_universe.landmarks.healthchecker', category: 'tool', icon: 'pulse', place: { in: 'body', x: 1600, y: 1350 } },

  /* ---- THE EAST BLADE: the deep end ---- */
  // BIG FIVE. Move the black hole by editing this one pair of coordinates.
  { id: 'developer_portal', kind: 'external', path: 'https://developers.hive.io', labelKey: 'navigation.sidebar.developer_portal', category: 'info', icon: 'blackhole', place: { in: 'body', x: 4500, y: -1300 }, big: true },
  { id: 'block_explorer', kind: 'explorer', path: '/', labelKey: 'navigation.explore_nav.blockexplorer', category: 'tool', icon: 'blocks', place: { in: 'body', x: 4820, y: 830 } },
  { id: 'faq', kind: 'internal', path: '/faq.html', labelKey: 'navigation.sidebar.faq', category: 'info', icon: 'docq', place: { in: 'body', x: 3100, y: 3800 } },

  /* ---- offshore clusters ---- */
  // The library (hop-only): what Hive is, in its own words.
  { id: 'what_is_hive', kind: 'external', path: 'https://hive.io', labelKey: 'navigation.explore_nav.what_is_hive', category: 'info', icon: 'hivemark', place: { in: 'cluster', cluster: 'library', angleDeg: 27, dist: 500 } },
  { id: 'whitepaper', kind: 'external', path: 'https://hive.io/whitepaper.pdf', labelKey: 'navigation.sidebar.hive_whitepaper', category: 'info', icon: 'doc', place: { in: 'cluster', cluster: 'library', angleDeg: 145, dist: 470 } },
  // Records (hop-only): the minor paperwork, clearly minor.
  { id: 'privacy', kind: 'internal', path: '/privacy.html', labelKey: 'navigation.sidebar.privacy_policy', category: 'info', icon: 'doc', place: { in: 'cluster', cluster: 'records', angleDeg: 55, dist: 470 } },
  { id: 'terms', kind: 'internal', path: '/tos.html', labelKey: 'navigation.sidebar.terms_of_service', category: 'info', icon: 'doc', place: { in: 'cluster', cluster: 'records', angleDeg: 235, dist: 470 } },
  // Launch (walled off for now).
  { id: 'our_dapps', kind: 'external', path: 'https://hive.io/eco/', labelKey: 'navigation.main_nav_bar.out_dapps', category: 'dapp', icon: 'launchpad', place: { in: 'cluster', cluster: 'launch', angleDeg: 60, dist: 700 } },
  { id: 'hive_dapps', kind: 'external', path: 'https://hivedapps.com/', labelKey: 'navigation.explore_nav.hive_dapps', category: 'dapp', icon: 'spaceship', place: { in: 'cluster', cluster: 'launch', angleDeg: 180, dist: 470 } },
  // The gateway (walled off): a lone door in the dark.
  { id: 'sign_up', kind: 'external', path: 'https://signup.hive.io/', labelKey: 'navigation.main_nav_bar.sign_up', category: 'social', icon: 'door', place: { in: 'cluster', cluster: 'gateway', angleDeg: 180, dist: 500 } }
];

/**
 * Curated map: landmark id to the REAL Hive account whose avatar it wears
 * (fetched through the app's own avatar proxy). Landmarks not listed here keep
 * their code-drawn icon.
 *
 * Deliberately NOT listed: the big five, which are code-drawn illustrations,
 * and the fictional places generally. Only accounts that genuinely exist are
 * listed; the list is short on purpose rather than padded with guesses.
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
 * Community bubbles float off the DIAMOND's western coast, the busiest and
 * roomiest shore. Rays are cast from this interior origin rather than the
 * world origin, which now sits out in the channel between landmasses.
 */
export const COMMUNITY_ORIGIN = { x: -3000, y: 100, land: 0 } as const;

/** Ten fixed slots along the diamond's west and south-west coast. */
export const COMMUNITY_ARC = { startDeg: 128, endDeg: 244, slots: 10 } as const;

export interface CommunitySlot {
  slot: number;
  angleDeg: number;
}

export function communitySlots(): CommunitySlot[] {
  const { startDeg, endDeg, slots } = COMMUNITY_ARC;
  const step = (endDeg - startDeg) / (slots - 1);
  return Array.from({ length: slots }, (_, i) => ({ slot: i, angleDeg: startDeg + i * step }));
}

/**
 * Distance from the community origin to the diamond's coast along a ray
 * (screen angle degrees, y grows downward). Marched, so it respects the
 * ragged noise.
 */
export function coastDistanceAt(angleDeg: number): number {
  return coastDistanceFrom(COMMUNITY_ORIGIN.x, COMMUNITY_ORIGIN.y, angleDeg, COMMUNITY_ORIGIN.land);
}

/** Position of an angle at a radius from the community origin, world px. */
export function rimPosition(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: COMMUNITY_ORIGIN.x + Math.cos(rad) * radius,
    y: COMMUNITY_ORIGIN.y - Math.sin(rad) * radius
  };
}
