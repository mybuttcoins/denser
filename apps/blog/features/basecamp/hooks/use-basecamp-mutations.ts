'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserClient } from '@smart-signer/lib/auth/use-user-client';
import { transactionService } from '@transaction/index';
import { toast } from '@ui/components/hooks/use-toast';
import { handleError } from '@ui/lib/handle-error';
import { useTranslation } from '@/blog/i18n/client';
import { basecampRecordsQueryKey } from './use-basecamp-state';
import { BASECAMP_SCHEMA_VERSION, type BasecampRecord, type BasecampTaskId } from '../lib/protocol';

/**
 * Marks a Basecamp task as complete. Optimistically appends the record to
 * the cached history so the checklist updates immediately, then invalidates
 * to pick up the real on-chain record once it's indexed.
 */
export function useBasecampTaskMutation() {
  const { user } = useUserClient();
  const { t } = useTranslation('common_blog');
  const queryClient = useQueryClient();
  const queryKey = basecampRecordsQueryKey(user.username);

  return useMutation({
    mutationFn: async (params: { task: BasecampTaskId }) => {
      const broadcastResult = await transactionService.basecampTaskComplete(params.task, { observe: true });
      return { ...params, broadcastResult };
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey });
      const prevRecords: BasecampRecord[] | undefined = queryClient.getQueryData(queryKey);
      const optimisticRecord: BasecampRecord = {
        timestamp: new Date().toISOString(),
        account: user.username,
        action: 'task',
        payload: { v: BASECAMP_SCHEMA_VERSION, task: params.task }
      };
      queryClient.setQueryData<BasecampRecord[]>(queryKey, [...(prevRecords ?? []), optimisticRecord]);
      return { prevRecords };
    },
    onError: (error, variables, context) => {
      // Roll back unconditionally — context is always returned by onMutate, and
      // prevRecords being undefined (no prior cache entry) is itself the correct
      // state to restore, not a reason to skip the rollback. Default to [] rather
      // than passing `undefined` directly, since setQueryData treats that as a no-op.
      queryClient.setQueryData(queryKey, context?.prevRecords ?? []);
      handleError(error, { method: 'useBasecampTaskMutation', params: variables });
    },
    onSuccess: () => {
      toast({
        title: t('basecamp.toast.task_complete_title'),
        description: t('basecamp.toast.task_complete_description'),
        variant: 'success'
      });
    },
    onSettled: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey });
      }, 4000);
    }
  });
}

/**
 * Offers to be a Basecamp guide. Optimistically marks the current user as a
 * guide with the given interests/capacity, then invalidates to reconcile
 * with the real on-chain record.
 */
export function useBasecampGuideOfferMutation() {
  const { user } = useUserClient();
  const { t } = useTranslation('common_blog');
  const queryClient = useQueryClient();
  const queryKey = basecampRecordsQueryKey(user.username);

  return useMutation({
    mutationFn: async (params: { interests: string[]; capacity: number }) => {
      const broadcastResult = await transactionService.basecampGuideOffer(params.interests, params.capacity, {
        observe: true
      });
      return { ...params, broadcastResult };
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey });
      const prevRecords: BasecampRecord[] | undefined = queryClient.getQueryData(queryKey);
      const optimisticRecord: BasecampRecord = {
        timestamp: new Date().toISOString(),
        account: user.username,
        action: 'guide_offer',
        payload: { v: BASECAMP_SCHEMA_VERSION, interests: params.interests, capacity: params.capacity }
      };
      queryClient.setQueryData<BasecampRecord[]>(queryKey, [...(prevRecords ?? []), optimisticRecord]);
      return { prevRecords };
    },
    onError: (error, variables, context) => {
      // Roll back unconditionally — see useBasecampTaskMutation for why prevRecords
      // being undefined must still restore (clear) the optimistic write.
      queryClient.setQueryData(queryKey, context?.prevRecords ?? []);
      handleError(error, { method: 'useBasecampGuideOfferMutation', params: variables });
    },
    onSuccess: () => {
      toast({
        title: t('basecamp.toast.guide_offer_title'),
        description: t('basecamp.toast.guide_offer_description'),
        variant: 'success'
      });
    },
    onSettled: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey });
      }, 4000);
    }
  });
}
