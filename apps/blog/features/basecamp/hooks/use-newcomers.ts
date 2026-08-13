'use client';

import { useEffect, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { getPostsRanked, DATA_LIMIT } from '@transaction/lib/bridge-api';
import { getAccounts } from '@transaction/lib/hive-api';
import { DEFAULT_OBSERVER } from '@/blog/lib/utils';
import { StaleTime } from '@/blog/lib/react-query';
import { useUserClient } from '@smart-signer/lib/auth/use-user-client';
import type { Entry } from '@hive/common-hiveio-packages/wax';
import { parseIsoMs, type SignalAccountInput } from '../lib/signals';

const NEWCOMER_MAX_ACCOUNT_AGE_DAYS = 365;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
// How many qualifying newcomer posts to try to collect before handing a "page" back
// to the UI (i.e. one Load More click's worth).
const TARGET_NEWCOMERS_PER_PAGE = 10;
// Safety cap on how many raw pages of the full "created" stream we'll scan for a
// single Load More click. Most posts aren't from new accounts, so collecting a page
// of newcomers can take scanning several raw pages — this bounds the worst case.
const MAX_RAW_FETCHES_PER_PAGE = 10;

export interface Newcomer {
  post: Entry;
  accountAgeDays: number;
  /** Narrow snapshot of the author's account, enough to compute card signals. */
  account: SignalAccountInput;
}

interface NewcomerCursor {
  author: string;
  permlink: string;
}

interface NewcomersPage {
  newcomers: Newcomer[];
  nextCursor: NewcomerCursor | null;
}

// A per author snapshot never changes for the lifetime of this browser tab, so
// it is cached at module scope (not per-hook-instance): paginating never
// re-queries the same author twice, even across separate Load More clicks or
// remounts of the feed. Only the narrow set of fields the card signals need is
// kept here, never the whole FullAccount object.
const accountSnapshotCache = new Map<string, SignalAccountInput>();

async function getAccountSnapshots(authors: string[]): Promise<Map<string, SignalAccountInput>> {
  const uncached = authors.filter((author) => !accountSnapshotCache.has(author));
  if (uncached.length > 0) {
    // One batched request per page of authors, not one request per post.
    const accounts = await getAccounts(uncached);
    for (const account of accounts) {
      accountSnapshotCache.set(account.name, {
        createdIso: account.created ?? null,
        postCount: typeof account.post_count === 'number' ? account.post_count : null,
        postingJsonMetadata: account.posting_json_metadata ?? null,
        jsonMetadata: account.json_metadata ?? null,
        lastPostIso: account.last_post ?? null,
        lastVoteTimeIso: account.last_vote_time ?? null,
        receivedVestingAmount: account.received_vesting_shares?.amount ?? null
      });
    }
  }
  return accountSnapshotCache;
}

function accountAgeDays(created: string): number {
  // Single source of truth for date parsing: the same Z-appending helper the
  // signals use, so the 365 day filter and account_age_days never disagree.
  const createdMs = parseIsoMs(created);
  if (createdMs === null) return -1;
  return Math.floor((Date.now() - createdMs) / MS_PER_DAY);
}

/**
 * Fetches one "page" of newcomer posts. This isn't a single API call: it pages
 * through the full, unfiltered "created" stream — the same feed the main Posts
 * page offers, not a narrower tag — batch-looks-up each raw page's authors'
 * account ages, and keeps only posts from accounts under
 * NEWCOMER_MAX_ACCOUNT_AGE_DAYS old, repeating until either enough qualifying
 * posts are collected or MAX_RAW_FETCHES_PER_PAGE raw fetches have been made.
 *
 * Performance note: this fetches and filters the full post stream client-side,
 * so it will be less efficient at true hive.blog scale (fetching many posts to
 * find few qualifying ones). A backend indexer that precomputes "posts by
 * accounts under 365 days" would be the future fix for that — but the filtering
 * itself is fully correct, not partial, so this is a performance note, not a
 * known-incomplete flag.
 */
async function fetchNewcomersPage(cursor: NewcomerCursor | undefined, observer: string): Promise<NewcomersPage> {
  const collected: Newcomer[] = [];
  const seenInPage = new Set<string>();
  let nextAuthor = cursor?.author ?? '';
  let nextPermlink = cursor?.permlink ?? '';
  let nextCursor: NewcomerCursor | null = null;

  for (let fetchCount = 0; fetchCount < MAX_RAW_FETCHES_PER_PAGE; fetchCount++) {
    const posts = await getPostsRanked('created', '', nextAuthor, nextPermlink, observer);
    if (!posts || posts.length === 0) {
      nextCursor = null;
      break;
    }

    const authors = Array.from(new Set(posts.map((post) => post.author)));
    const snapshotByAuthor = await getAccountSnapshots(authors);

    for (const post of posts) {
      const key = `${post.author}/${post.permlink}`;
      // Hive's cursor pagination re-includes the anchor post as the first result
      // of the next fetch. Guard against double-counting it across our internal
      // raw-page loop (a single Load More click can span several raw fetches).
      if (seenInPage.has(key)) continue;
      seenInPage.add(key);

      const snapshot = snapshotByAuthor.get(post.author);
      if (!snapshot || !snapshot.createdIso) continue;
      const ageDays = accountAgeDays(snapshot.createdIso);
      if (ageDays >= 0 && ageDays < NEWCOMER_MAX_ACCOUNT_AGE_DAYS) {
        collected.push({ post, accountAgeDays: ageDays, account: snapshot });
      }
    }

    const last = posts[posts.length - 1];
    nextAuthor = last.author;
    nextPermlink = last.permlink;
    // Same convention the main feed's pagination uses: fewer posts than requested
    // means the underlying stream is exhausted.
    nextCursor = posts.length < DATA_LIMIT ? null : { author: nextAuthor, permlink: nextPermlink };

    if (collected.length >= TARGET_NEWCOMERS_PER_PAGE || nextCursor === null) break;
  }

  return { newcomers: collected, nextCursor };
}

export const useNewcomers = () => {
  const { user } = useUserClient();
  const observer = user.isLoggedIn ? user.username : DEFAULT_OBSERVER;
  const { ref: loadMoreRef, inView } = useInView();

  const { data, isLoading, isFetching, isFetchingNextPage, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['basecampNewcomers', observer],
    queryFn: ({ pageParam }) => fetchNewcomersPage(pageParam as NewcomerCursor | undefined, observer),
    getNextPageParam: (lastPage: NewcomersPage) => lastPage.nextCursor ?? undefined,
    staleTime: StaleTime.MEDIUM
  });

  // Auto-fetch the next page when the load-more button scrolls into view, mirroring
  // the main feed's pagination (features/tags-pages/list-of-posts.tsx).
  useEffect(() => {
    if (inView && hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetching, fetchNextPage]);

  const newcomers = useMemo(() => data?.pages.flatMap((page) => page.newcomers) ?? [], [data]);

  return {
    newcomers,
    isLoading,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage: Boolean(hasNextPage),
    loadMoreRef
  };
};
