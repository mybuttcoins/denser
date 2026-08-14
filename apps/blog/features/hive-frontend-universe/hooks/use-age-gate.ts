'use client';

/**
 * Hive Frontend Universe — the age gate.
 *
 * Reads the logged-in user's `created` date from what `LoggedUserProvider`
 * already fetches at login (no extra call). The gate runs BEFORE anything else
 * mounts: when the player is under a year old (or logged out) the map is never
 * built and no chain call is made.
 *
 * A client-side gate is UX only and trivially bypassed; the real gate is that
 * every on-chain action a veteran takes is signed by their account, whose age
 * is a public fact any reader can verify. This just keeps newcomers out of a
 * mode built for veterans.
 */

import { useUserClient } from '@smart-signer/lib/auth/use-user-client';
import { useLoggedUserContext } from '@/blog/features/votes/hooks/use-logged-user';

const YEAR_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type AgeGateStatus = 'loading' | 'blocked-newcomer' | 'blocked-logged-out' | 'allowed';

export interface AgeGateResult {
  status: AgeGateStatus;
  /** Whole days old, or null while unknown. */
  ageDays: number | null;
}

function ageDaysFrom(createdIso: string): number {
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(createdIso) ? createdIso : `${createdIso}Z`;
  return Math.max(0, Math.floor((Date.now() - new Date(normalized).getTime()) / MS_PER_DAY));
}

export function useAgeGate(): AgeGateResult {
  const { user, isHydrated } = useUserClient();
  const { loggedUser } = useLoggedUserContext();

  if (!isHydrated) return { status: 'loading', ageDays: null };
  if (!user.isLoggedIn) return { status: 'blocked-logged-out', ageDays: null };
  if (!loggedUser?.created) return { status: 'loading', ageDays: null };

  const ageDays = ageDaysFrom(loggedUser.created);
  return {
    status: ageDays >= YEAR_DAYS ? 'allowed' : 'blocked-newcomer',
    ageDays
  };
}
