'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getChain } from '@transaction/lib/chain';
import { StaleTime } from '@/blog/lib/react-query';
import { BASECAMP_CUSTOM_JSON_ID, decodeBasecampRecord, foldBasecampState, type BasecampRecord } from '../lib/protocol';

const CUSTOM_JSON_OPERATION_NAME = 'custom_json_operation';
const HISTORY_PAGE_SIZE = 1000;

export function basecampRecordsQueryKey(username: string) {
  return ['basecampRecords', username] as const;
}

/**
 * Looks up the operation-type id for custom_json_operation at runtime via
 * hafah-api, then reads that account's custom_json history via hivemind-api,
 * matching the pattern apps/wallet/lib/hive.ts uses for other operation types.
 */
async function fetchBasecampRecords(username: string): Promise<BasecampRecord[]> {
  const chain = await getChain();
  const opTypes = await chain.restApi['hafah-api']['operation-types']();
  const opTypeId = opTypes.find((opType) => opType.operation_name === CUSTOM_JSON_OPERATION_NAME)?.op_type_id;
  if (opTypeId === undefined) return [];

  const response = await chain.restApi['hivemind-api'].accountsOperations({
    'account-name': username,
    'operation-types': opTypeId.toString(),
    'page-size': HISTORY_PAGE_SIZE
  });

  return response.operations_result
    .filter((operation) => operation.op.value.id === BASECAMP_CUSTOM_JSON_ID)
    .map((operation) =>
      decodeBasecampRecord({
        timestamp: new Date(operation.timestamp).toISOString(),
        id: operation.op.value.id,
        json: operation.op.value.json,
        account: operation.op.value.required_posting_auths?.[0]
      })
    )
    .filter((record): record is BasecampRecord => record !== null);
}

export const useBasecampState = (username: string) => {
  const { data, isFetching } = useQuery({
    queryKey: basecampRecordsQueryKey(username),
    queryFn: () => fetchBasecampRecords(username),
    enabled: Boolean(username),
    staleTime: StaleTime.MEDIUM
  });

  const state = useMemo(() => foldBasecampState(data ?? []), [data]);

  return { state, isFetching };
};
