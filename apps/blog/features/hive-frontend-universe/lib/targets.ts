'use client';

/**
 * Hive Frontend Universe - what every thing on the map POINTS AT.
 *
 * The map is a game map and a way to navigate hive.blog at the same time, so
 * every visible thing has to resolve to a real page: a post, a profile, a
 * community feed, a tool. This is the one place that mapping lives, shared by
 * the hover chip, the click handler and the arrival panel, so those three can
 * never disagree about where a thing goes.
 *
 * Nothing here navigates by itself; it only answers "what is this and where
 * does it lead".
 */

import env from '@beam-australia/react-env';
import { siteConfig } from '@ui/config/site';
import type { LandmarkKind } from './fixed-world';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

/**
 * Where the wallet lives when the deployment has not configured its own.
 * Without this the wallet landmark resolved to null and said "nothing here",
 * which is a dead end on the one place every player looks for first.
 */
const WALLET_FALLBACK = 'https://wallet.hive.blog';
/**
 * hivehub.dev, not hiveblocks.com: the latter answered 502 when every link in
 * this module was audited, and a dead explorer would be the villain's own
 * link failing.
 */
const EXPLORER_FALLBACK = 'https://hivehub.dev';

export type TargetKind = 'post' | 'landmark' | 'community' | 'witness' | 'critter';

export interface MapTarget {
  kind: TargetKind;
  /** World node id, or -1 for witnesses, which are scenery. */
  node: number;
  /** Shown in the hover chip and the arrival panel. */
  title: string;
  /** Real page this leads to, or null when there genuinely is none. */
  href: string | null;
  /** Whether the bug can be sent here from the travel map. */
  travelable: boolean;
  x: number;
  y: number;
}

/** Resolves a landmark's configured kind and path to a real URL. */
export function landmarkHref(kind: LandmarkKind, path: string): string | null {
  switch (kind) {
    case 'internal':
      return `${BASE_PATH}${path}`;
    case 'wallet': {
      const wallet = env('WALLET_ENDPOINT') || WALLET_FALLBACK;
      return `${wallet}${path === '/' ? '' : path}`;
    }
    case 'explorer': {
      const explorer = env('EXPLORER_DOMAIN') || EXPLORER_FALLBACK;
      return `${explorer}${path === '/' ? '' : path}`;
    }
    case 'chat':
      return siteConfig.openhiveChatUri;
    case 'external':
      return path;
    case 'none':
      return null;
  }
}

/** A Hive account's profile page. */
export function profileHref(account: string): string {
  return `${BASE_PATH}/@${account}`;
}

/** A community's feed. */
export function communityHref(name: string): string {
  return `${BASE_PATH}/trending/${name}`;
}

/**
 * A post's page. Hive hands back a site-relative url like
 * `/hive-123/@alice/slug`; fall back to building one when it is missing.
 */
export function postHref(url: string | undefined, author: string, permlink: string): string {
  if (url && url.startsWith('/')) return `${BASE_PATH}${url}`;
  return `${BASE_PATH}/@${author}/${permlink}`;
}
