'use client';

/**
 * Hive Frontend Universe - the top-21 witness query for the citadel ring.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchTopWitnesses, type TopWitness } from '../data/fetch-witnesses';

const ONE_HOUR = 60 * 60 * 1000;

export function useWitnesses() {
  return useQuery<TopWitness[]>({
    queryKey: ['hfu-witnesses'],
    queryFn: () => fetchTopWitnesses(),
    staleTime: ONE_HOUR,
    refetchOnWindowFocus: false,
    retry: 1
  });
}
