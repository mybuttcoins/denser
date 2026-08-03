/**
 * Pure Basecamp custom_json protocol logic — decoding on-chain records and
 * folding them into state. Zero dependency on Denser internals (no imports),
 * so this file can be lifted into a standalone package as-is.
 */

export const BASECAMP_CUSTOM_JSON_ID = 'basecamp';
export const BASECAMP_SCHEMA_VERSION = 1;

export type BasecampTaskId =
  | 'profile_setup'
  | 'first_follow'
  | 'intro_post'
  | 'first_replies'
  | 'key_backup'
  | 'wallet_tour';

export const BASECAMP_TASK_IDS: readonly BasecampTaskId[] = [
  'profile_setup',
  'first_follow',
  'intro_post',
  'first_replies',
  'key_backup',
  'wallet_tour'
];

export function isBasecampTaskId(value: unknown): value is BasecampTaskId {
  return typeof value === 'string' && (BASECAMP_TASK_IDS as readonly string[]).includes(value);
}

export type BasecampAction = 'join' | 'leave' | 'task' | 'guide_offer' | 'guide_pair' | 'verify';

const BASECAMP_ACTIONS: readonly BasecampAction[] = [
  'join',
  'leave',
  'task',
  'guide_offer',
  'guide_pair',
  'verify'
];

function isBasecampAction(value: unknown): value is BasecampAction {
  return typeof value === 'string' && (BASECAMP_ACTIONS as readonly string[]).includes(value);
}

/**
 * Duck-typed shape of a single custom_json history entry — deliberately not
 * tied to any particular Hive SDK's operation type, so callers can adapt
 * whatever shape their API client returns.
 */
export interface RawCustomJsonRecord {
  /** ISO timestamp string of the operation, used for chronological folding. */
  timestamp: string;
  /** The custom_json operation's `id` field. */
  id: string | undefined;
  /** The custom_json operation's `json` field — a JSON-encoded [action, payload] tuple. */
  json: string | undefined;
  /** The account that signed/broadcast the operation. */
  account: string | undefined;
}

export interface BasecampRecord {
  timestamp: string;
  account: string;
  action: BasecampAction;
  payload: Record<string, unknown>;
}

/**
 * Decodes a raw custom_json history record into a BasecampRecord, or null if
 * it isn't a well-formed basecamp record (wrong id, malformed JSON, unknown
 * action, missing account, etc).
 */
export function decodeBasecampRecord(raw: RawCustomJsonRecord): BasecampRecord | null {
  if (raw.id !== BASECAMP_CUSTOM_JSON_ID || !raw.json || !raw.account) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.json);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length !== 2) return null;
  const [action, payload] = parsed;
  if (!isBasecampAction(action) || typeof payload !== 'object' || payload === null) return null;
  return { timestamp: raw.timestamp, account: raw.account, action, payload: payload as Record<string, unknown> };
}

export interface BasecampState {
  joined: boolean;
  interests: string[];
  completedTasks: BasecampTaskId[];
  isGuide: boolean;
  guideInterests: string[];
  guideCapacity: number | null;
  pairedGuide: string | null;
}

const EMPTY_STATE: BasecampState = {
  joined: false,
  interests: [],
  completedTasks: [],
  isGuide: false,
  guideInterests: [],
  guideCapacity: null,
  pairedGuide: null
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * Folds a list of basecamp records (any order) for a single account into its
 * current Basecamp state. Records are applied in chronological order; `task`
 * completions accumulate (there is no "uncomplete" action), while `join`,
 * `leave`, `guide_offer`, and `guide_pair` each overwrite prior state.
 * `verify` records are recognized but not yet interpreted into state.
 */
export function foldBasecampState(records: BasecampRecord[]): BasecampState {
  const sorted = [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return sorted.reduce<BasecampState>((state, record) => {
    switch (record.action) {
      case 'join':
        return { ...state, joined: true, interests: asStringArray(record.payload.interests) };
      case 'leave':
        return { ...state, joined: false };
      case 'task': {
        const task = record.payload.task;
        if (!isBasecampTaskId(task) || state.completedTasks.includes(task)) return state;
        return { ...state, completedTasks: [...state.completedTasks, task] };
      }
      case 'guide_offer': {
        const capacity = typeof record.payload.capacity === 'number' ? record.payload.capacity : null;
        return {
          ...state,
          isGuide: true,
          guideInterests: asStringArray(record.payload.interests),
          guideCapacity: capacity
        };
      }
      case 'guide_pair': {
        const account = typeof record.payload.account === 'string' ? record.payload.account : null;
        return { ...state, pairedGuide: account };
      }
      case 'verify':
        return state;
      default:
        return state;
    }
  }, EMPTY_STATE);
}
