/**
 * Hive Frontend Universe - the fixed world.
 *
 * The ground is THREE LANDMASSES whose combined silhouette is the real Hive
 * mark eroded into terrain: the solid DIAMOND (west), and the two CHEVRON
 * BLADES (centre and east). The cell table that makes those shapes is
 * generated and lives in lib/landmass.ts; this file is the hand-tunable half:
 * where every permanent thing stands.
 *
 * The three pieces are ONE CONNECTED WORLD. Two narrow straits (lib/landmass.ts)
 * bridge the mark's negative space, so rail lines weave across them under the
 * ordinary mesh rules and a player can travel anywhere without hopping. There
 * are no uncrossable gaps left in this world. Breakout clusters hang off the
 * outer coasts as little islands offshore:
 *
 *   - 'trail' clusters connect to a landmass by a single thin rail trail;
 *   - 'hop'   clusters connect by NOTHING and are reached with a short drift
 *             hop, comfortably inside one full drift ring.
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
  /** Half-extent the full travel map must fit, world px. The witness ring is
   *  the outermost thing in the world, so the map has to clear it. */
  fitExtent: 9100,
  /** Communities float this far beyond the coastline, world px. */
  communityCoastOffset: 620,
  /** A safety bound for mask sampling; nothing meaningful beyond this. */
  bboxRadius: 8000
} as const;

/* ---------------------------- the clusters ---------------------------- */

export type ClusterLink = 'trail' | 'hop';

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
  { id: 'records', x: 4130, y: 4030, link: 'hop', satellites: [] },
  // Launch: pulled in from (7480, -1400), where the gap measured 1.85-1.99x
  // the max hop and the cluster was a wall. Pass seven removes every
  // uncrossable gap in the world, so this is now a short hop like the others.
  { id: 'launch', x: 6220, y: -1400, link: 'hop', satellites: [[300, 450]] },
  // The gateway: a DOOR should feel connected, not stranded, so it is tied on
  // by a rail trail now. It was a hop, and it read as debris.
  { id: 'gateway', x: -7130, y: -600, link: 'trail', satellites: [[60, 430], [300, 430]] },

  /* ---- THE MIGHTY J SON'S KEEP: the villain's home at the world's edge ---- */
  // Placed so its gap measures well past one bare drift ring: nobody reaches
  // it without oxygen helmets. Move it by editing this one line; the gap is
  // measured and reported by the world stats, never assumed.
  { id: 'json_keep', x: 7600, y: 5600, link: 'hop', satellites: [[150, 470]] },

  /* ---- decentralised offshoots: little stars trailing off into space ---- */
  // These hold no landmarks. They exist so the world does not simply stop at
  // the coast: rail keeps going out into the dark in the classic
  // decentralised-network shape, and every one of them is travelable.
  { id: 'driftpost', x: -4550, y: -4750, link: 'trail', satellites: [[70, 470], [140, 430], [255, 450]] },
  { id: 'farside', x: 6250, y: 2450, link: 'trail', satellites: [[20, 460], [95, 430], [300, 470]] },
  { id: 'deepfield', x: -450, y: 6250, link: 'trail', satellites: [[80, 450], [200, 470], [330, 430]] }
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
  | 'jsonboss'
  | 'sockmount'
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
  { id: 'our_dapps', kind: 'external', path: 'https://hive.io/eco/', labelKey: 'navigation.main_nav_bar.out_dapps', category: 'dapp', icon: 'launchpad', place: { in: 'cluster', cluster: 'launch', angleDeg: 60, dist: 700 }, big: true },
  { id: 'hive_dapps', kind: 'external', path: 'https://hivedapps.com/', labelKey: 'navigation.explore_nav.hive_dapps', category: 'dapp', icon: 'spaceship', place: { in: 'cluster', cluster: 'launch', angleDeg: 180, dist: 470 } },
  // The gateway (walled off): a lone door in the dark.
  { id: 'sign_up', kind: 'external', path: 'https://signup.hive.io/', labelKey: 'navigation.main_nav_bar.sign_up', category: 'social', icon: 'door', place: { in: 'cluster', cluster: 'gateway', angleDeg: 180, dist: 500 } },
  // THE MIGHTY J SON himself, crouched on his keep at the edge of the world.
  // His link leads to the block explorer: the one place you can stare at the
  // raw JSON he hoards. BIG, so the silhouette is visible from the far coast.
  { id: 'json_keep', kind: 'explorer', path: '/', labelKey: 'hive_frontend_universe.landmarks.json_keep', category: 'dapp', icon: 'jsonboss', place: { in: 'cluster', cluster: 'json_keep', angleDeg: 30, dist: 520 }, big: true },
  // Mount Socko stands on the very NORTH TIP of the logo: a sock-shaped
  // mountain, visible from the pulled-out map, where a Socko-enveloped bug is
  // flash-taken. Pure lore, no page behind it; the trip itself is the toll.
  { id: 'mount_socko', kind: 'none', path: '', labelKey: 'hive_frontend_universe.landmarks.mount_socko', category: 'info', icon: 'sockmount', place: { in: 'body', x: -1130, y: -4950 }, big: true }
];

/**
 * THE STARSHIP'S PASSENGER LIST: the dApps of the Hive universe, offered as
 * links when a player visits the launch cluster. peakd and 3speak and friends
 * answered 200 to a live audit; ecency and inleo answer 403 to curl (bot
 * guards) but are canonical live frontends. Names are proper nouns.
 */
export const DAPP_DIRECTORY: readonly { name: string; url: string; account?: string }[] = [
  { name: 'PeakD', url: 'https://peakd.com', account: 'peakd' },
  { name: 'Ecency', url: 'https://ecency.com', account: 'ecency' },
  { name: 'InLeo', url: 'https://inleo.io', account: 'leofinance' },
  { name: '3Speak', url: 'https://3speak.tv', account: 'threespeak' },
  { name: 'Actifit', url: 'https://actifit.io', account: 'actifit' },
  { name: 'TribalDex', url: 'https://tribaldex.com' },
  { name: 'Hive.io', url: 'https://hive.io' }
];

/**
 * THE ARCADE'S CABINET LIST: real games running on Hive, offered as links
 * when a player visits the Arcade. Curated by hand and each URL verified
 * alive before being added; names are proper nouns, so they are not
 * translated. Add a game by adding a line.
 */
export const ARCADE_GAMES: readonly { name: string; url: string }[] = [
  { name: 'Splinterlands', url: 'https://splinterlands.com' },
  { name: 'Rising Star', url: 'https://www.risingstargame.com' },
  { name: 'dCrops', url: 'https://www.dcrops.com' },
  { name: 'Holozing', url: 'https://holozing.com' },
  { name: 'Terracore', url: 'https://terracore.xyz' }
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

/* ----------------------- the Mighty J SON's holes ----------------------- */

/**
 * TROLL HOLES: the mouths of the Mighty J SON's network, sunk into the
 * terrain. Thieves that steal the player's tokens run for the NEAREST of
 * these; whatever goes down a hole is fed to J SON and gone. The keep at the
 * world's edge is the fifth mouth, so a thief near the east coast may flee
 * clear off the land.
 *
 * Every position is one hand-tunable line, inside a landmass on purpose.
 */
export interface TrollHole {
  id: string;
  x: number;
  y: number;
}

export const TROLL_HOLES: readonly TrollHole[] = [
  { id: 'hole_nw', x: -3000, y: -2300 },
  { id: 'hole_sw', x: -3900, y: -1800 },
  { id: 'hole_centre', x: 150, y: -3700 },
  { id: 'hole_south', x: 1040, y: 2130 },
  { id: 'hole_east', x: 4000, y: 2260 },
  // The keep itself: the final mouth, off the land entirely.
  { id: 'json_keep', x: 7600, y: 5600 }
];

/* --------------------------- the witness ring --------------------------- */

/**
 * THE CITADEL RING. The real top 21 witnesses stand in a ring OUTSIDE the
 * whole topography, in rank order, looking in over the chain they produce.
 *
 * They are scenery, not destinations: no mesh node, no spoke, nothing to
 * collide with. That keeps the mesh rules untouched and means the ring can be
 * as tall and as dramatic as it likes without eating a junction's degree
 * budget.
 *
 * Rank 1 stands due north and the rest run clockwise, so the ring reads as a
 * ranking rather than as a random scatter. The ellipse is wider than it is
 * tall because the world is.
 */
export const WITNESS_RING = {
  /** Ring radii, world px. Sized to clear the coast and the offshore clusters. */
  rx: 7900,
  ry: 7050,
  /** Where rank 1 stands, screen degrees (90 is due north). */
  startDeg: 90,
  /** Alternating in-and-out stagger so the ring has depth, world px. */
  stagger: 460
} as const;

export interface WitnessPost {
  /** 0-based index; rank is this plus one. */
  slot: number;
  x: number;
  y: number;
}

/** Where each of the 21 towers stands. Deterministic and identical for all. */
export function witnessPosts(count: number): WitnessPost[] {
  return Array.from({ length: count }, (_, i) => {
    const deg = WITNESS_RING.startDeg - (i / count) * 360;
    const rad = (deg * Math.PI) / 180;
    const push = i % 2 === 0 ? WITNESS_RING.stagger : -WITNESS_RING.stagger;
    return {
      slot: i,
      x: Math.cos(rad) * (WITNESS_RING.rx + push),
      y: -Math.sin(rad) * (WITNESS_RING.ry + push)
    };
  });
}

/* --------------------------- the communities --------------------------- */

/**
 * Ten fixed community moorings, hand-placed in the dark water AROUND all
 * three landmasses instead of stacked down one crowded arc off the west
 * coast. Each hugs a coast closely enough for the world builder to sling a
 * rail spoke to it. Move a community by editing its line.
 */
/**
 * THE STEEM RUINS: the old chain, drawn as a dead grey district out in the
 * western void, deliberately opposite Emperor J SON's keep in the south-east.
 * Environmental storytelling only: no node, no travel, nothing to collect.
 * Hover names it and the click leads to the REAL 2020 fork announcement post
 * (verified alive before this landed), so the one link out of the ruins is
 * the moment the community left them.
 */
export const STEEM_RUINS = {
  x: -6300,
  y: 1800,
  url: 'https://hive.blog/communityfork/@hiveio/announcing-the-launch-of-hive-blockchain'
} as const;

export const COMMUNITY_SPOTS: readonly { slot: number; x: number; y: number }[] = [
  { slot: 0, x: -5600, y: 300 }, // west of the diamond
  { slot: 1, x: -4400, y: -3500 }, // north-west
  { slot: 2, x: -2000, y: -4400 }, // north of the diamond
  { slot: 3, x: 1500, y: -4700 }, // north of the centre blade
  { slot: 4, x: 3900, y: -3800 }, // north-east
  { slot: 5, x: 5900, y: 500 }, // east of the east blade
  { slot: 6, x: 5200, y: 3400 }, // south-east
  { slot: 7, x: 900, y: 5200 }, // south of the centre blade
  { slot: 8, x: -1800, y: 4400 }, // south of the diamond
  { slot: 9, x: -4700, y: 3200 } // south-west
];
