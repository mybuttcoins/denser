/**
 * Hive Frontend Universe — observations (local judgements).
 *
 * An "observation" is the player's own opinion about another account (does this
 * profile look real, does it look like a bot). Per the design, these are
 * JUDGEMENTS and they stay OFF chain, on the player's own device only. This
 * file defines the record shape and stores it locally.
 *
 * Transport is intentionally UNBUILT in this pass — there is no broadcast, no
 * publish, no sync. Clearing the browser clears these, by design.
 *
 * The word "observation" is used deliberately: `features/basecamp/lib/signals.ts`
 * already exists and means something else, so that word is not reused here.
 */

import { getStorageItem, setStorageItem, StorageTTL } from '@ui/lib/storage-with-ttl';

/** What the player thinks of an account. Deliberately small and blunt. */
export type ObservationVerdict = 'real' | 'bot' | 'unsure';

export interface Observation {
  /** The account the observation is about (bare handle, no leading @). */
  subject: string;
  verdict: ObservationVerdict;
  /** Optional free-text note, never leaves the device. */
  note?: string;
  /** Epoch ms when recorded/updated. */
  ts: number;
}

const OBSERVATIONS_KEY = 'hfu-observations';

/** All observations, keyed by subject handle. */
export type ObservationMap = Record<string, Observation>;

export function getObservations(): ObservationMap {
  return getStorageItem<ObservationMap>(OBSERVATIONS_KEY) ?? {};
}

export function getObservation(subject: string): Observation | null {
  return getObservations()[subject] ?? null;
}

/**
 * Records or replaces an observation about `subject`. Stored PERMANENT — these
 * are user judgements, not cache, and should not silently expire.
 */
export function setObservation(subject: string, verdict: ObservationVerdict, note?: string): void {
  const all = getObservations();
  all[subject] = { subject, verdict, note, ts: Date.now() };
  setStorageItem(OBSERVATIONS_KEY, all, StorageTTL.PERMANENT);
}

export function removeObservation(subject: string): void {
  const all = getObservations();
  if (!(subject in all)) return;
  delete all[subject];
  setStorageItem(OBSERVATIONS_KEY, all, StorageTTL.PERMANENT);
}
