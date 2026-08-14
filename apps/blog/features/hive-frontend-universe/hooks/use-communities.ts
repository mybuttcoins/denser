'use client';

/**
 * Hive Frontend Universe — top-communities query for the bubble arc.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchTopCommunities, type TopCommunity } from '../data/fetch-communities';

const ONE_HOUR = 60 * 60 * 1000;

export function useCommunities() {
  return useQuery<TopCommunity[]>({
    queryKey: ['hfu-communities'],
    queryFn: () => fetchTopCommunities(),
    staleTime: ONE_HOUR,
    refetchOnWindowFocus: false,
    retry: 1
  });
}
