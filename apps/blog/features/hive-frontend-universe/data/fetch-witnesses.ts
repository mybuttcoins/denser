/**
 * Hive Frontend Universe - the top 21 witnesses, for the citadel ring.
 *
 * These are the accounts actually producing blocks, so the towers standing
 * around the outside of the world are the real consensus set, in rank order,
 * not decoration invented for the game. One `condenser_api.get_witnesses_by_vote`
 * call returns exactly the 21 in vote order.
 *
 * READ ONLY. Nothing here signs or broadcasts anything.
 *
 * Cached for an hour under its own key, in its own file, so the board and
 * community fetches stay untouched.
 */

import { configuredApiEndpoint } from '@ui/config/public-vars';
import { getStorageItem, setStorageItem, StorageTTL } from '@ui/lib/storage-with-ttl';

export interface TopWitness {
  /** Account name; also the handle its avatar is fetched with. */
  name: string;
  /** 1 for the top-voted witness, through 21. */
  rank: number;
  /** Blocks this witness has missed, all time. Used only to tint the tower. */
  missed: number;
  /** Reported node version, for the tower's little version tag. */
  version: string;
  /** Last block this witness confirmed, for the visit card. */
  lastBlock: number;
  /** The witness's own declared page, when they declared one. */
  url: string;
}

/** v2: the beam-visit card added lastBlock and url to the cached shape. */
const CACHE_KEY = 'hfu-witnesses-v2';
/** The consensus set is exactly 21 accounts. */
export const WITNESS_COUNT = 21;

interface RawWitness {
  owner: string;
  total_missed: number;
  running_version: string;
  last_confirmed_block_num: number;
  url: string;
}

export async function fetchTopWitnesses(
  endpoint: string = configuredApiEndpoint
): Promise<TopWitness[]> {
  const cached = getStorageItem<TopWitness[]>(CACHE_KEY);
  if (cached) return cached;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'condenser_api.get_witnesses_by_vote',
      params: ['', WITNESS_COUNT],
      id: 1
    })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? 'get_witnesses_by_vote failed');
  const rows = (json.result ?? []) as RawWitness[];

  const top = rows.slice(0, WITNESS_COUNT).map((r, i) => ({
    name: r.owner,
    rank: i + 1,
    missed: r.total_missed ?? 0,
    version: r.running_version ?? '',
    lastBlock: r.last_confirmed_block_num ?? 0,
    url: r.url ?? ''
  }));

  setStorageItem(CACHE_KEY, top, StorageTTL.CACHE);
  return top;
}
