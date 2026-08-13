/**
 * Pure Basecamp "signals" logic: small, deterministic read outs derived from
 * account and post data the feed already fetches. Zero dependency on Denser
 * internals (no imports), exactly like lib/protocol.ts, so this file can be
 * lifted into a standalone package as-is.
 *
 * Design rules baked in here:
 *   - No network, no date library, no randomness, no Date.now(). Callers pass
 *     nowMs so every compute is deterministic and unit testable.
 *   - No user-facing English. Every signal carries a translation key and a
 *     unit token only; the rendering layer turns those into text.
 *   - "known: false" (we could not compute it) is kept strictly distinct from
 *     a real zero. A newcomer with zero votes is known true, value 0. A vote
 *     count that failed to load is known false, value null.
 */

export type SignalUnit = 'days' | 'per_day' | 'count' | 'percent' | 'boolean' | 'none';

export type SignalContext = 'feed' | 'profile';

export interface SignalValue {
  known: boolean;
  value: number | null;
  unit: SignalUnit;
}

/**
 * The plain account fields a caller assembles from getAccounts. Every field is
 * nullable because any of them can be missing or empty at runtime; the compute
 * functions treat missing input as known false rather than guessing.
 */
export interface SignalAccountInput {
  createdIso: string | null;
  postCount: number | null;
  postingJsonMetadata: string | null;
  /** Fallback profile source: some accounts leave posting_json_metadata empty. */
  jsonMetadata: string | null;
  lastPostIso: string | null;
  lastVoteTimeIso: string | null;
  receivedVestingAmount: string | number | null;
}

export interface SignalPostInput {
  replyCount: number | null;
  voteCount: number | null;
}

export interface SignalInput {
  account: SignalAccountInput;
  post: SignalPostInput;
  nowMs: number;
}

export interface BasecampSignal {
  id: string;
  /** Translation key, resolved under basecamp.signals.labels.<id> by callers. */
  labelKey: string;
  group: 'identity' | 'activity' | 'social' | 'wallet';
  /** Which surfaces this signal is meaningful on. See days_since_last_action. */
  contexts: SignalContext[];
  compute: (input: SignalInput) => SignalValue;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const PROFILE_FIELDS = ['profile_image', 'cover_image', 'about', 'location', 'website', 'name'] as const;

function unknown(unit: SignalUnit): SignalValue {
  return { known: false, value: null, unit };
}

function knownValue(value: number, unit: SignalUnit): SignalValue {
  return { known: true, value, unit };
}

/**
 * Parses a Hive timestamp to epoch milliseconds. Hive history timestamps are
 * UTC but arrive as strings with no timezone designator (for example
 * "2026-08-10T23:40:30"), which JavaScript would otherwise read as local time
 * and skew by the viewer's offset. A 'Z' is appended when no timezone marker
 * is present. Returns null when the input is missing or unparseable.
 */
export function parseIsoMs(iso: string | null): number | null {
  try {
    if (typeof iso !== 'string' || iso.length === 0) return null;
    const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : iso + 'Z';
    const ms = Date.parse(normalized);
    return Number.isNaN(ms) ? null : ms;
  } catch {
    return null;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Counts how many of the six PROFILE_FIELDS are non-empty strings inside a
 * metadata JSON string's `profile` object. Returns null when the string is
 * empty, unparseable, not a plain object, or has no usable profile object.
 * An array (json_metadata comes back as "[]" for some accounts) and an empty
 * object ("{}") both count as no profile, not as zero filled fields.
 */
function profileFilledCount(metadata: string | null): number | null {
  try {
    if (typeof metadata !== 'string' || metadata.length === 0) return null;
    const parsed: unknown = JSON.parse(metadata);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const profile: unknown = (parsed as Record<string, unknown>).profile;
    if (typeof profile !== 'object' || profile === null || Array.isArray(profile)) return null;
    const profileRecord = profile as Record<string, unknown>;
    let filled = 0;
    for (const field of PROFILE_FIELDS) {
      const fieldValue = profileRecord[field];
      if (typeof fieldValue === 'string' && fieldValue.trim().length > 0) filled++;
    }
    return filled;
  } catch {
    return null;
  }
}

export const BASECAMP_SIGNALS: BasecampSignal[] = [
  {
    id: 'account_age_days',
    labelKey: 'basecamp.signals.labels.account_age_days',
    group: 'identity',
    contexts: ['feed', 'profile'],
    compute: ({ account, nowMs }) => {
      try {
        const createdMs = parseIsoMs(account.createdIso);
        if (createdMs === null) return unknown('days');
        const days = Math.floor((nowMs - createdMs) / MS_PER_DAY);
        if (days < 0) return unknown('days');
        return knownValue(days, 'days');
      } catch {
        return unknown('days');
      }
    }
  },
  {
    id: 'profile_completeness',
    labelKey: 'basecamp.signals.labels.profile_completeness',
    group: 'identity',
    contexts: ['feed', 'profile'],
    compute: ({ account }) => {
      try {
        // Prefer posting_json_metadata; fall back to json_metadata when the
        // first is empty, unparseable, or carries no usable profile object.
        // Only unknown when BOTH sources fail.
        let filled = profileFilledCount(account.postingJsonMetadata);
        if (filled === null) filled = profileFilledCount(account.jsonMetadata);
        if (filled === null) return unknown('percent');
        const percent = Math.round((filled / PROFILE_FIELDS.length) * 100);
        return knownValue(percent, 'percent');
      } catch {
        return unknown('percent');
      }
    }
  },
  {
    id: 'total_actions',
    labelKey: 'basecamp.signals.labels.total_actions',
    group: 'activity',
    contexts: ['feed', 'profile'],
    compute: ({ account }) => {
      try {
        if (!isFiniteNumber(account.postCount) || account.postCount < 0) return unknown('count');
        return knownValue(account.postCount, 'count');
      } catch {
        return unknown('count');
      }
    }
  },
  {
    id: 'actions_per_day',
    labelKey: 'basecamp.signals.labels.actions_per_day',
    group: 'activity',
    contexts: ['feed', 'profile'],
    compute: ({ account, nowMs }) => {
      try {
        if (!isFiniteNumber(account.postCount) || account.postCount < 0) return unknown('per_day');
        const createdMs = parseIsoMs(account.createdIso);
        if (createdMs === null) return unknown('per_day');
        const ageDays = Math.floor((nowMs - createdMs) / MS_PER_DAY);
        if (ageDays < 0) return unknown('per_day');
        const ageFloored = Math.max(1, ageDays);
        const perDay = account.postCount / ageFloored;
        return knownValue(Math.round(perDay * 10) / 10, 'per_day');
      } catch {
        return unknown('per_day');
      }
    }
  },
  {
    id: 'days_since_last_action',
    labelKey: 'basecamp.signals.labels.days_since_last_action',
    group: 'activity',
    // Feed cards come from the newest-posts stream, so every account just
    // acted and this would read zero on every card. Only meaningful on a
    // profile surface, so it is deliberately not in the 'feed' context.
    contexts: ['profile'],
    compute: ({ account, nowMs }) => {
      try {
        const lastPostMs = parseIsoMs(account.lastPostIso);
        const lastVoteMs = parseIsoMs(account.lastVoteTimeIso);
        const candidates = [lastPostMs, lastVoteMs].filter(isFiniteNumber);
        if (candidates.length === 0) return unknown('days');
        const chosen = Math.max(...candidates);
        // "1970-01-01T00:00:00" is the chain's default for never-voted
        // accounts; it parses to 0 or below and must not read as a real span.
        if (chosen <= 0) return unknown('days');
        const createdMs = parseIsoMs(account.createdIso);
        if (createdMs !== null && chosen < createdMs) return unknown('days');
        const days = Math.floor((nowMs - chosen) / MS_PER_DAY);
        // A future timestamp (clock skew) just means "acted today", not unknown.
        return knownValue(days < 0 ? 0 : days, 'days');
      } catch {
        return unknown('days');
      }
    }
  },
  {
    id: 'replies_on_post',
    labelKey: 'basecamp.signals.labels.replies_on_post',
    group: 'social',
    contexts: ['feed', 'profile'],
    compute: ({ post }) => {
      try {
        if (!isFiniteNumber(post.replyCount) || post.replyCount < 0) return unknown('count');
        return knownValue(post.replyCount, 'count');
      } catch {
        return unknown('count');
      }
    }
  },
  {
    id: 'votes_on_post',
    labelKey: 'basecamp.signals.labels.votes_on_post',
    group: 'social',
    contexts: ['feed', 'profile'],
    compute: ({ post }) => {
      try {
        if (!isFiniteNumber(post.voteCount) || post.voteCount < 0) return unknown('count');
        return knownValue(post.voteCount, 'count');
      } catch {
        return unknown('count');
      }
    }
  },
  {
    id: 'received_delegation',
    labelKey: 'basecamp.signals.labels.received_delegation',
    group: 'wallet',
    contexts: ['feed', 'profile'],
    compute: ({ account }) => {
      try {
        if (account.receivedVestingAmount === null) return unknown('boolean');
        // amount arrives as a string like "0" or "32299925097"; "0" is truthy,
        // so it must be parsed to a number before comparing.
        const amount = Number(account.receivedVestingAmount);
        if (Number.isNaN(amount)) return unknown('boolean');
        return knownValue(amount > 0 ? 1 : 0, 'boolean');
      } catch {
        return unknown('boolean');
      }
    }
  }
];
