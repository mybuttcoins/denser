'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPostsRanked } from '@transaction/lib/bridge-api';
import { getAccounts } from '@transaction/lib/hive-api';
import { DEFAULT_OBSERVER } from '@/blog/lib/utils';
import { StaleTime } from '@/blog/lib/react-query';
import { useUserClient } from '@smart-signer/lib/auth/use-user-client';
import type { Entry } from '@hive/common-hiveio-packages/wax';

const INTRODUCEYOURSELF_TAG = 'introduceyourself';
const NEWCOMER_MAX_ACCOUNT_AGE_DAYS = 120;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface Newcomer {
  post: Entry;
  accountAgeDays: number;
}

export const useNewcomers = () => {
  const { user } = useUserClient();
  const observer = user.isLoggedIn ? user.username : DEFAULT_OBSERVER;

  const { data: posts, isFetching: isFetchingPosts } = useQuery({
    queryKey: ['basecampIntroPosts', observer],
    queryFn: () => getPostsRanked('created', INTRODUCEYOURSELF_TAG, '', '', observer),
    staleTime: StaleTime.MEDIUM
  });

  const authors = useMemo(() => Array.from(new Set(posts?.map((post) => post.author) ?? [])), [posts]);

  const { data: accounts, isFetching: isFetchingAccounts } = useQuery({
    queryKey: ['basecampNewcomerAccounts', authors],
    queryFn: () => getAccounts(authors),
    enabled: authors.length > 0,
    staleTime: StaleTime.LONG
  });

  const newcomers = useMemo<Newcomer[]>(() => {
    if (!posts || !accounts) return [];
    const createdByAuthor = new Map(accounts.map((account) => [account.name, account.created]));
    const now = Date.now();
    return posts
      .map((post): Newcomer | null => {
        const created = createdByAuthor.get(post.author);
        if (!created) return null;
        const accountAgeDays = Math.floor((now - new Date(created).getTime()) / MS_PER_DAY);
        return accountAgeDays >= 0 && accountAgeDays < NEWCOMER_MAX_ACCOUNT_AGE_DAYS
          ? { post, accountAgeDays }
          : null;
      })
      .filter((newcomer): newcomer is Newcomer => newcomer !== null);
  }, [posts, accounts]);

  return {
    newcomers,
    isFetching: isFetchingPosts || (authors.length > 0 && isFetchingAccounts)
  };
};
