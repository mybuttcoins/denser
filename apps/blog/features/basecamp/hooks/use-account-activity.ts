'use client';

import { useQuery } from '@tanstack/react-query';
import { getChain } from '@transaction/lib/chain';
import { StaleTime } from '@/blog/lib/react-query';

const VOTE_OPERATION_NAME = 'vote_operation';
const COMMENT_OPERATION_NAME = 'comment_operation';

/** How far back we ask the chain to look when sampling an account's activity. */
const ACTIVITY_WINDOW_DAYS = 30;
/**
 * Records pulled per account. The endpoint returns newest-first and, when an
 * account has more operations in the window than fit one page, hands back the
 * most recent partial page — so this bounds both payload and latency while
 * still leaving a recent, contiguous sample to measure. See `observedDays`.
 */
const ACTIVITY_PAGE_SIZE = 1000;
/**
 * Floor on the measured span. A very busy account's sample can cover only a few
 * hours; dividing by that raw span would turn normal bursts into wild rates.
 */
const MIN_OBSERVED_DAYS = 1;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface AccountActivity {
  votesPerDay: number;
  commentsPerDay: number;
  /** Days of history the rates were actually measured over. */
  observedDays: number;
  /**
   * False when the chain lookup failed. Callers must render an empty ring
   * rather than a zero-valued one, so "we don't know" never reads as "inactive".
   */
  available: boolean;
}

const UNAVAILABLE_ACTIVITY: AccountActivity = {
  votesPerDay: 0,
  commentsPerDay: 0,
  observedDays: 0,
  available: false
};

/**
 * Hive history timestamps are UTC but arrive over JSON as strings with no
 * timezone designator, even though the response type declares `Date`.
 * `new Date('2026-08-06T14:53:36')` would be parsed as *local* time, skewing
 * every span by the viewer's offset, so the 'Z' is appended explicitly.
 */
function parseHiveTimestamp(timestamp: Date | string): number {
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp !== 'string') return Number.NaN;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(timestamp) ? timestamp : `${timestamp}Z`;
  return new Date(normalized).getTime();
}

export function accountActivityQueryKey(username: string) {
  return ['basecampAccountActivity', username] as const;
}

/**
 * Measures how much an account votes and comments per day.
 *
 * Two things about the account-operations endpoint drive this implementation:
 *
 * 1. It returns every operation the account is *involved in*, not the ones it
 *    *performed* — an author's own post attracts vote and comment operations
 *    from other people. Counting the response (or its `total_operations`)
 *    directly would measure popularity, not activity, and is wrong by more than
 *    an order of magnitude for accounts that get any traction. There is no
 *    server-side "acting account" filter, so each record is matched against the
 *    account by `voter` / `author` here.
 *
 * 2. Rates are computed over the span the returned sample actually covers, not
 *    over the requested window. When an account is busy enough that the window
 *    doesn't fit in one page, the sample is the most recent slice of it, and
 *    dividing by the full window would understate the account.
 */
export async function fetchAccountActivity(username: string): Promise<AccountActivity> {
  const chain = await getChain();
  const opTypes = await chain.restApi['hafah-api']['operation-types']();
  const voteOpId = opTypes.find((opType) => opType.operation_name === VOTE_OPERATION_NAME)?.op_type_id;
  const commentOpId = opTypes.find((opType) => opType.operation_name === COMMENT_OPERATION_NAME)?.op_type_id;
  if (voteOpId === undefined || commentOpId === undefined) return UNAVAILABLE_ACTIVITY;

  const fromBlock = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * MS_PER_DAY).toISOString().slice(0, 19);
  const response = await chain.restApi['hivemind-api'].accountsOperations({
    'account-name': username,
    'operation-types': `${voteOpId},${commentOpId}`,
    'page-size': ACTIVITY_PAGE_SIZE,
    'from-block': fromBlock
  });

  const operations = response.operations_result ?? [];
  let votesCast = 0;
  let commentsWritten = 0;
  let oldestTimestamp = Number.POSITIVE_INFINITY;

  for (const operation of operations) {
    const value = operation.op?.value;
    if (!value) continue;
    if (operation.op.type === VOTE_OPERATION_NAME && value.voter === username) votesCast++;
    else if (operation.op.type === COMMENT_OPERATION_NAME && value.author === username) commentsWritten++;
    else continue;

    const time = parseHiveTimestamp(operation.timestamp);
    if (Number.isFinite(time) && time < oldestTimestamp) oldestTimestamp = time;
  }

  // No qualifying records: the account genuinely did nothing in the window.
  // That's a real zero, not a failure — the ring shows an empty track either
  // way, but `available` stays true so callers can tell the two apart.
  if (!Number.isFinite(oldestTimestamp)) {
    return { votesPerDay: 0, commentsPerDay: 0, observedDays: ACTIVITY_WINDOW_DAYS, available: true };
  }

  const spanDays = (Date.now() - oldestTimestamp) / MS_PER_DAY;
  const observedDays = Math.min(Math.max(spanDays, MIN_OBSERVED_DAYS), ACTIVITY_WINDOW_DAYS);

  return {
    votesPerDay: votesCast / observedDays,
    commentsPerDay: commentsWritten / observedDays,
    observedDays,
    available: true
  };
}

/**
 * Where a card's activity lookup currently stands. Kept distinct from the
 * measured numbers so "not asked yet" is never presented as "did nothing" —
 * an unmeasured account and a genuinely idle one both draw an empty ring, but
 * only the second one may be described as having zero activity.
 */
export type ActivityStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

/**
 * Reads an account's vote/comment rates. `enabled` lets callers defer the
 * request until the row is actually on screen, so a long feed doesn't fire one
 * lookup per card up front.
 */
export const useAccountActivity = (username: string, enabled: boolean) => {
  const isEnabled = enabled && Boolean(username);
  const { data, isFetching, isError } = useQuery({
    queryKey: accountActivityQueryKey(username),
    queryFn: () => fetchAccountActivity(username),
    enabled: isEnabled,
    staleTime: StaleTime.MEDIUM,
    retry: false
  });

  let status: ActivityStatus;
  if (isError) status = 'unavailable';
  else if (data) status = 'ready';
  else if (isEnabled) status = 'loading';
  else status = 'idle';

  return {
    activity: status === 'ready' && data ? data : UNAVAILABLE_ACTIVITY,
    status,
    isFetching
  };
};
