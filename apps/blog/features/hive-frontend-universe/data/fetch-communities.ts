/**
 * Hive Frontend Universe — top communities for the bubble arc.
 *
 * One `bridge.list_communities` page (100 rows, ~35KB) ranked by a mix of
 * subscribers and recent activity (pending posts), cached for an hour under
 * its own key. A separate file so the existing board fetch/cache stay
 * untouched.
 */

import { configuredApiEndpoint } from '@ui/config/public-vars';
import { getStorageItem, setStorageItem, StorageTTL } from '@ui/lib/storage-with-ttl';

export interface TopCommunity {
  name: string;
  title: string;
  subscribers: number;
  pending: number;
}

const CACHE_KEY = 'hfu-communities';
const TOP_N = 10;

interface RawCommunity {
  name: string;
  title: string;
  subscribers: number;
  num_pending: number;
}

export async function fetchTopCommunities(
  endpoint: string = configuredApiEndpoint
): Promise<TopCommunity[]> {
  const cached = getStorageItem<TopCommunity[]>(CACHE_KEY);
  if (cached) return cached;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'bridge.list_communities',
      params: { last: '', limit: 100, observer: '' },
      id: 1
    })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? 'list_communities failed');
  const rows = (json.result ?? []) as RawCommunity[];

  // Mix of size and current activity, both normalised against the page max.
  const maxSubs = Math.max(1, ...rows.map((r) => r.subscribers ?? 0));
  const maxPending = Math.max(1, ...rows.map((r) => r.num_pending ?? 0));
  const top = rows
    .map((r) => ({
      name: r.name,
      title: r.title || r.name,
      subscribers: r.subscribers ?? 0,
      pending: r.num_pending ?? 0,
      score: (r.subscribers ?? 0) / maxSubs + (r.num_pending ?? 0) / maxPending
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N)
    .map(({ name, title, subscribers, pending }) => ({ name, title, subscribers, pending }));

  setStorageItem(CACHE_KEY, top, StorageTTL.CACHE);
  return top;
}
