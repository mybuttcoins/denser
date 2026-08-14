/**
 * Hive Frontend Universe — the fixed world.
 *
 * The world is a BODY WITH ARMS, not a filled circle. The woven middle is the
 * main body, where the posts live (they change each window). The permanent
 * landmarks live out on ARMS: trunk lines growing off the body, each ending
 * in a pocket that holds one landmark or a small related cluster, drawn as
 * its own little place. Governance gets the bottom arm: the DHF Fun Park and
 * Witty World share it as their own corner. The ten community bubbles keep
 * their arc on the outer edge.
 *
 * Everything here is permanent and position-fixed forever, so players learn
 * the world. The mesh in the middle is the only thing rewoven per window.
 * This file stays separate from the mesh generator and from movement so any
 * landmark can be moved by editing one line. Zero imports.
 *
 * Every destination was read from the app's real navigation, not guessed.
 */

/** World geometry constants shared by the mesh, the arms and the camera. */
export const WORLD = {
  meshRadius: 8200,
  houseRadius: 6100,
  spacing: 470,
  /** Arm pockets sit this far beyond the mesh edge. */
  armReach: 1650,
  communityRadius: 9350,
  houseSlots: 30
} as const;

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

/** An arm: a trunk growing off the body at a fixed angle, ending in a pocket. */
export interface Arm {
  id: string;
  angleDeg: number;
}

/** Eight arms, spread around the body; 190°-250° is the community arc's gap. */
export const ARMS: readonly Arm[] = [
  { id: 'governance', angleDeg: 262 },
  { id: 'launch', angleDeg: 305 },
  { id: 'tools', angleDeg: 340 },
  { id: 'arcade', angleDeg: 12 },
  { id: 'newcomers', angleDeg: 48 },
  { id: 'social', angleDeg: 90 },
  { id: 'library', angleDeg: 130 },
  { id: 'records', angleDeg: 168 }
];

export interface Landmark {
  id: string;
  kind: LandmarkKind;
  path: string;
  labelKey: string;
  category: LandmarkCategory;
  icon: IconKey;
  /** Which arm's pocket this landmark lives in. */
  arm: string;
  /** True for the big destination worlds drawn as structures. */
  world?: boolean;
}

export const LANDMARKS: readonly Landmark[] = [
  // Governance corner (bottom arm): the two destination worlds.
  { id: 'proposals', kind: 'wallet', path: '/proposals', labelKey: 'hive_frontend_universe.worlds.dhf_fun_park', category: 'governance', icon: 'ferris', arm: 'governance', world: true },
  { id: 'witnesses', kind: 'wallet', path: '/~witnesses', labelKey: 'hive_frontend_universe.worlds.witty_world', category: 'governance', icon: 'towers', arm: 'governance', world: true },
  // Launch arm: the dApps world.
  { id: 'our_dapps', kind: 'external', path: 'https://hive.io/eco/', labelKey: 'navigation.main_nav_bar.out_dapps', category: 'dapp', icon: 'launchpad', arm: 'launch', world: true },
  { id: 'hive_dapps', kind: 'external', path: 'https://hivedapps.com/', labelKey: 'navigation.explore_nav.hive_dapps', category: 'dapp', icon: 'spaceship', arm: 'launch' },
  // Tools arm.
  { id: 'write_post', kind: 'internal', path: '/submit.html', labelKey: 'hive_frontend_universe.landmarks.write_post', category: 'tool', icon: 'quill', arm: 'tools' },
  { id: 'search', kind: 'internal', path: '/search', labelKey: 'hive_frontend_universe.landmarks.search', category: 'tool', icon: 'magnifier', arm: 'tools' },
  { id: 'wallet', kind: 'wallet', path: '/', labelKey: 'hive_frontend_universe.landmarks.wallet', category: 'tool', icon: 'wallet', arm: 'tools' },
  // The Arcade.
  { id: 'arcade', kind: 'internal', path: '/basecamp', labelKey: 'hive_frontend_universe.landmarks.arcade', category: 'arcade', icon: 'arcadebldg', arm: 'arcade', world: true },
  // Newcomer country.
  { id: 'basecamp', kind: 'internal', path: '/basecamp', labelKey: 'navigation.main_nav_bar.basecamp', category: 'social', icon: 'tent', arm: 'newcomers' },
  { id: 'welcome', kind: 'internal', path: '/welcome', labelKey: 'navigation.sidebar.welcome', category: 'info', icon: 'flag', arm: 'newcomers' },
  { id: 'faq', kind: 'internal', path: '/faq.html', labelKey: 'navigation.sidebar.faq', category: 'info', icon: 'docq', arm: 'newcomers' },
  { id: 'sign_up', kind: 'external', path: 'https://signup.hive.io/', labelKey: 'navigation.main_nav_bar.sign_up', category: 'social', icon: 'door', arm: 'newcomers' },
  // Social arm.
  { id: 'posts', kind: 'internal', path: '/trending', labelKey: 'navigation.main_nav_bar.posts', category: 'social', icon: 'newspaper', arm: 'social' },
  { id: 'chat', kind: 'chat', path: '/', labelKey: 'navigation.sidebar.openhive_chat', category: 'social', icon: 'bubble', arm: 'social' },
  { id: 'communities_gate', kind: 'internal', path: '/communities', labelKey: 'hive_frontend_universe.landmarks.communities', category: 'social', icon: 'gate', arm: 'social' },
  // Library arm, with the black hole at its end.
  { id: 'developer_portal', kind: 'external', path: 'https://developers.hive.io', labelKey: 'navigation.sidebar.developer_portal', category: 'info', icon: 'blackhole', arm: 'library' },
  { id: 'what_is_hive', kind: 'external', path: 'https://hive.io', labelKey: 'navigation.explore_nav.what_is_hive', category: 'info', icon: 'hivemark', arm: 'library' },
  { id: 'whitepaper', kind: 'external', path: 'https://hive.io/whitepaper.pdf', labelKey: 'navigation.sidebar.hive_whitepaper', category: 'info', icon: 'doc', arm: 'library' },
  // Records arm: the minor paperwork, clearly minor.
  { id: 'block_explorer', kind: 'explorer', path: '/', labelKey: 'navigation.explore_nav.blockexplorer', category: 'tool', icon: 'blocks', arm: 'records' },
  { id: 'healthchecker', kind: 'internal', path: '/healthchecker', labelKey: 'hive_frontend_universe.landmarks.healthchecker', category: 'tool', icon: 'pulse', arm: 'records' },
  { id: 'privacy', kind: 'internal', path: '/privacy.html', labelKey: 'navigation.sidebar.privacy_policy', category: 'info', icon: 'doc', arm: 'records' },
  { id: 'terms', kind: 'internal', path: '/tos.html', labelKey: 'navigation.sidebar.terms_of_service', category: 'info', icon: 'doc', arm: 'records' }
];

export function armLandmarks(armId: string): Landmark[] {
  return LANDMARKS.filter((lm) => lm.arm === armId);
}

/** The community bubble arc: ten fixed slots between these angles. */
export const COMMUNITY_ARC = { startDeg: 190, endDeg: 250, slots: 10 } as const;

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
