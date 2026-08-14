/**
 * Hive Frontend Universe — the fetch layer.
 *
 * Turns one 30-minute window into the raw inputs the board builder needs, using
 * the calls measured during scoping:
 *   - dynamic global props    (head block + vests→HP factor; the counts step
 *                              needs the head block anyway)
 *   - get_ranked_posts × 2    newest root posts, trimmed to the window
 *   - get_accounts (bulk)     stake, age and reputation for the authors
 *   - ambient counts          hafbe, or the block fallback
 *
 * Talks to the configured node over plain JSON-RPC / REST, so it honours the
 * user's node choice and stays inside the CSP allowlist. Returns raw responses;
 * folding into a Board happens in `lib/board.ts`.
 */

import { configuredApiEndpoint } from '@ui/config/public-vars';
import { getAmbientCounts } from './ambient-counts';
import { windowStartFor, type RawPost, type RawAccount, type AmbientCounts } from '../lib/board';

const RANKED_PAGE_LIMIT = 20; // bridge caps get_ranked_posts at 20
const MAX_PAGES = 2;

export interface FetchedBoardData {
  posts: RawPost[];
  accounts: RawAccount[];
  counts: AmbientCounts;
  vestsToHive: number;
  windowStart: number;
  headBlock: number;
}

async function rpc<T>(endpoint: string, method: string, params: unknown): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? `${method} failed`);
  return json.result as T;
}

interface DynamicGlobalProps {
  head_block_number: number;
  total_vesting_fund_hive: string;
  total_vesting_shares: string;
}

function vestsToHiveFactor(dgp: DynamicGlobalProps): number {
  const fund = parseFloat(dgp.total_vesting_fund_hive);
  const shares = parseFloat(dgp.total_vesting_shares);
  return shares > 0 ? fund / shares : 0;
}

/** Two pages of newest root posts, trimmed to the last 30 minutes, deduped. */
async function fetchWindowPosts(endpoint: string, cutoffMs: number): Promise<RawPost[]> {
  const seen = new Set<string>();
  const posts: RawPost[] = [];
  let startAuthor = '';
  let startPermlink = '';

  for (let page = 0; page < MAX_PAGES; page++) {
    const params: Record<string, unknown> = {
      sort: 'created',
      tag: '',
      observer: '',
      limit: RANKED_PAGE_LIMIT
    };
    if (startAuthor) {
      params.start_author = startAuthor;
      params.start_permlink = startPermlink;
    }
    const page$ = await rpc<RawPost[]>(endpoint, 'bridge.get_ranked_posts', params);
    if (!page$.length) break;

    let reachedCutoff = false;
    for (const post of page$) {
      const created = new Date(`${post.created}Z`).getTime();
      if (created < cutoffMs) {
        reachedCutoff = true;
        break;
      }
      const key = `${post.author}/${post.permlink}`;
      if (seen.has(key)) continue;
      seen.add(key);
      posts.push(post);
    }
    if (reachedCutoff) break;

    const last = page$[page$.length - 1];
    if (last.author === startAuthor && last.permlink === startPermlink) break;
    startAuthor = last.author;
    startPermlink = last.permlink;
  }
  return posts;
}

/** Fetches everything one board needs from the configured node. */
export async function fetchBoardData(endpoint: string = configuredApiEndpoint): Promise<FetchedBoardData> {
  const windowStart = windowStartFor(Date.now());
  const cutoffMs = Date.now() - 30 * 60 * 1000;

  const dgp = await rpc<DynamicGlobalProps>(endpoint, 'condenser_api.get_dynamic_global_properties', []);
  const headBlock = dgp.head_block_number;
  const vestsToHive = vestsToHiveFactor(dgp);

  const posts = await fetchWindowPosts(endpoint, cutoffMs);
  const authors = [...new Set(posts.map((p) => p.author))];

  const [accounts, counts] = await Promise.all([
    authors.length
      ? rpc<RawAccount[]>(endpoint, 'condenser_api.get_accounts', [authors])
      : Promise.resolve<RawAccount[]>([]),
    getAmbientCounts(endpoint, headBlock)
  ]);

  return { posts, accounts, counts, vestsToHive, windowStart, headBlock };
}
