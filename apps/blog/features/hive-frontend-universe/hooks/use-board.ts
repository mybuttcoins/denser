'use client';

/**
 * Hive Frontend Universe — board query.
 *
 * Ties the three layers together: cache first (zero calls inside the same
 * window), else fetch the raw window and fold it into a Board, then cache it.
 * The query key includes the window start, so when the 30-minute window rolls
 * over the key changes and a fresh board is built.
 */

import { useQuery } from '@tanstack/react-query';
import { buildBoard, windowStartFor, type Board } from '../lib/board';
import { fetchBoardData } from '../data/fetch-board';
import { getCachedBoard, setCachedBoard } from '../data/cache';

const ONE_HOUR = 60 * 60 * 1000;

async function loadBoard(windowStart: number): Promise<Board> {
  const cached = getCachedBoard(windowStart);
  if (cached) return cached;

  const data = await fetchBoardData();
  const board = buildBoard({ ...data, seed: data.windowStart });
  setCachedBoard(board);
  return board;
}

export function useBoard() {
  const windowStart = windowStartFor(Date.now());
  return useQuery<Board>({
    queryKey: ['hfu-board', windowStart],
    queryFn: () => loadBoard(windowStart),
    staleTime: ONE_HOUR,
    refetchOnWindowFocus: false,
    retry: 1
  });
}
