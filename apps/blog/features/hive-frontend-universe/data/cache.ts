/**
 * Hive Frontend Universe — local board cache.
 *
 * A built board is ~0.5MB, so we keep only the two newest windows. Cached under
 * `StorageTTL.CACHE` (1 hour), keyed by window start: the window itself is 30
 * minutes, and an hour comfortably covers a player leaving and re-entering the
 * SAME window with zero network calls, while stale windows self-expire rather
 * than piling up. A small index list drives eviction so we never scan
 * localStorage directly.
 */

import { getStorageItem, setStorageItem, removeStorageItem, StorageTTL } from '@ui/lib/storage-with-ttl';
import type { Board } from '../lib/board';

const KEY_PREFIX = 'hfu-board-';
const INDEX_KEY = 'hfu-board-index';
const KEEP = 2;

function boardKey(windowStart: number): string {
  return `${KEY_PREFIX}${windowStart}`;
}

function readIndex(): number[] {
  return getStorageItem<number[]>(INDEX_KEY) ?? [];
}

function writeIndex(index: number[]): void {
  setStorageItem(INDEX_KEY, index, StorageTTL.CACHE);
}

export function getCachedBoard(windowStart: number): Board | null {
  return getStorageItem<Board>(boardKey(windowStart));
}

export function setCachedBoard(board: Board): void {
  setStorageItem(boardKey(board.windowStart), board, StorageTTL.CACHE);

  // Newest first, deduped, capped to KEEP; evict anything that falls off.
  const next = [board.windowStart, ...readIndex().filter((w) => w !== board.windowStart)];
  const kept = next.slice(0, KEEP);
  for (const evicted of next.slice(KEEP)) removeStorageItem(boardKey(evicted));
  writeIndex(kept);
}
