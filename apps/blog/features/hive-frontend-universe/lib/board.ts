/**
 * Hive Frontend Universe — the board builder.
 *
 * Pure, dependency-free logic that folds raw Hive chain responses into one
 * plain `Board` object. Same spirit as `features/basecamp/lib/protocol.ts`:
 * ZERO imports, so another frontend can lift this file out and reuse it.
 * All fetching lives outside this module (see `data/fetch-board.ts`).
 *
 * The board is a snapshot of one 30-minute window:
 *   - houses:  the ~30 root-post authors, each with real stake, age, tier,
 *              reputation, community and the post itself.
 *   - edges:   REAL lines (two houses whose posts share a voter) and FILLER
 *              lines (added only to guarantee the web is fully connected).
 *   - counts:  the window's ambient activity totals.
 *
 * Nothing here is a judgement the game invented. Every field is a public,
 * readable chain value.
 */

export const WINDOW_MS = 30 * 60 * 1000;

/** Start (epoch ms) of the fixed 30-minute window containing `nowMs`. */
export function windowStartFor(nowMs: number): number {
  return Math.floor(nowMs / WINDOW_MS) * WINDOW_MS;
}

/* ---------- raw input shapes (subsets of real chain responses) ---------- */

export interface RawActiveVote {
  voter: string;
  rshares?: number | string;
}

/** A subset of a `bridge.get_ranked_posts` entry — only the fields we read. */
export interface RawPost {
  author: string;
  permlink: string;
  title: string;
  body: string;
  created: string;
  category?: string;
  community?: string;
  community_title?: string;
  author_reputation?: number;
  children?: number;
  reblogs?: number;
  net_votes?: number;
  payout?: number;
  pending_payout_value?: string;
  stats?: { total_votes?: number; gray?: boolean; flag_weight?: number };
  active_votes?: RawActiveVote[];
  json_metadata?: unknown;
  url?: string;
}

/** A subset of a `condenser_api.get_accounts` entry. */
export interface RawAccount {
  name: string;
  created: string;
  vesting_shares?: string;
  received_vesting_shares?: string;
  delegated_vesting_shares?: string;
  reputation?: number | string;
  post_count?: number;
}

export interface AmbientCounts {
  votes: number;
  comments: number;
  customJson: number;
  transfers: number;
  /** Where the numbers came from — the cheap counter, or the block fallback. */
  source: 'hafbe' | 'blocks';
}

/* ---------- output shapes ---------- */

export interface BoardHousePost {
  author: string;
  permlink: string;
  title: string;
  body: string;
  url: string;
  community: string | null;
  communityTitle: string | null;
  tags: string[];
  createdISO: string;
  payout: number;
  votes: number;
  comments: number;
  reblogs: number;
}

export interface BoardHouse {
  id: number;
  handle: string;
  /** Effective Hive Power (own + received − delegated vests, in HP). */
  hp: number;
  rep: number;
  ageDays: number;
  tier: number;
  isNewcomer: boolean;
  community: string | null;
  communityTitle: string | null;
  /** Translucent stake-fog radius, in world px. */
  bubble: number;
  /** Reputation glow, 0..~0.16. */
  glow: number;
  /** Real voter handles on this post — the source of both edges and traffic. */
  voters: string[];
  post: BoardHousePost;
}

export type EdgeKind = 'real' | 'filler';

export interface BoardEdge {
  id: number;
  a: number;
  b: number;
  kind: EdgeKind;
  /** For real edges: how many voters the two posts share. 0 for filler. */
  shared: number;
}

export interface BoardConnectivity {
  houses: number;
  componentsFromRealEdges: number;
  realEdges: number;
  fillerEdges: number;
  /** The guarantee: largest connected component size across ALL edges. */
  largestComponent: number;
  allReachable: boolean;
}

export interface Board {
  windowStart: number;
  windowMs: number;
  houses: BoardHouse[];
  edges: BoardEdge[];
  counts: AmbientCounts;
  connectivity: BoardConnectivity;
  builtAt: number;
}

export interface BuildBoardInput {
  posts: RawPost[];
  accounts: RawAccount[];
  counts: AmbientCounts;
  windowStart: number;
  /** total_vesting_fund_hive / total_vesting_shares, from dynamic global props. */
  vestsToHive: number;
  /** Deterministic seed — pass windowStart so a window always builds the same. */
  seed?: number;
}

/* ---------- stake tiers (SWAP 3 in the mock: confirm these HP thresholds) ---------- */

export interface Tier {
  name: string;
  max: number;
  col: string;
}

export const TIERS: readonly Tier[] = [
  { name: 'plankton', max: 500, col: '#6ef0c4' },
  { name: 'redfish', max: 5000, col: '#ff7a59' },
  { name: 'dolphin', max: 50000, col: '#4fb8f0' },
  { name: 'orca', max: 500000, col: '#9b7cff' },
  { name: 'whale', max: Infinity, col: '#eceaff' }
];

export function tierOf(hp: number): number {
  for (let i = 0; i < TIERS.length; i++) {
    if (hp < TIERS[i].max) return i;
  }
  return TIERS.length - 1;
}

const YEAR_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/* ---------- tiny local helpers (kept internal so the file stays import-free) ---------- */

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

/** Hive timestamps are UTC but arrive without a zone marker; append 'Z'. */
function parseChainTime(iso: string): number {
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`;
  return new Date(normalized).getTime();
}

function parseVests(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function parsePayout(post: RawPost): number {
  if (typeof post.payout === 'number') return post.payout;
  if (post.pending_payout_value) {
    const n = parseFloat(post.pending_payout_value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function parseTags(meta: unknown): string[] {
  let obj: unknown = meta;
  if (typeof meta === 'string') {
    try {
      obj = JSON.parse(meta);
    } catch {
      return [];
    }
  }
  if (obj && typeof obj === 'object' && Array.isArray((obj as { tags?: unknown }).tags)) {
    return ((obj as { tags: unknown[] }).tags).filter((t): t is string => typeof t === 'string');
  }
  return [];
}

/* ---------- union-find, used for the reachability guarantee ---------- */

class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
  componentCount(n: number): number {
    const roots = new Set<number>();
    for (let i = 0; i < n; i++) roots.add(this.find(i));
    return roots.size;
  }
  largestComponent(n: number): number {
    const sizes = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const r = this.find(i);
      sizes.set(r, (sizes.get(r) ?? 0) + 1);
    }
    let max = 0;
    for (const s of sizes.values()) if (s > max) max = s;
    return max;
  }
}

/**
 * Builds the board from raw chain responses. Deterministic given `seed`.
 */
export function buildBoard(input: BuildBoardInput): Board {
  const { posts, accounts, counts, windowStart, vestsToHive } = input;
  const now = Date.now();

  const accountByName = new Map<string, RawAccount>();
  for (const a of accounts) accountByName.set(a.name, a);

  const houses: BoardHouse[] = posts.map((post, id) => {
    const acc = accountByName.get(post.author);
    const effVests =
      parseVests(acc?.vesting_shares) +
      parseVests(acc?.received_vesting_shares) -
      parseVests(acc?.delegated_vesting_shares);
    const hp = Math.max(0, effVests * vestsToHive);
    const ageDays = acc?.created
      ? Math.max(0, Math.floor((now - parseChainTime(acc.created)) / MS_PER_DAY))
      : YEAR_DAYS * 2; // unknown age: treat as established, never a false newcomer
    const rep = typeof post.author_reputation === 'number' ? post.author_reputation : 25;
    const voters = Array.isArray(post.active_votes)
      ? post.active_votes.map((v) => v.voter).filter((v): v is string => typeof v === 'string')
      : [];

    return {
      id,
      handle: post.author,
      hp,
      rep,
      ageDays,
      tier: tierOf(hp),
      isNewcomer: ageDays < YEAR_DAYS,
      community: post.community ?? null,
      communityTitle: post.community_title ?? null,
      bubble: clamp(22 * Math.pow(Math.max(hp, 1) / 100, 0.28), 20, 190),
      glow: 0.02 + 0.135 * clamp((rep - 25) / 55, 0, 1),
      voters,
      post: {
        author: post.author,
        permlink: post.permlink,
        title: post.title ?? '',
        body: post.body ?? '',
        url: post.url ?? `/@${post.author}/${post.permlink}`,
        community: post.community ?? null,
        communityTitle: post.community_title ?? null,
        tags: parseTags(post.json_metadata),
        createdISO: post.created,
        payout: parsePayout(post),
        votes: post.stats?.total_votes ?? post.net_votes ?? voters.length,
        comments: post.children ?? 0,
        reblogs: post.reblogs ?? 0
      }
    };
  });

  const { edges, connectivity } = buildEdges(houses, input.seed ?? windowStart);

  return {
    windowStart,
    windowMs: WINDOW_MS,
    houses,
    edges,
    counts,
    connectivity,
    builtAt: now
  };
}

/**
 * Two kinds of line.
 *
 * REAL edges join two houses whose posts share a voter — a genuine on-chain
 * connection, free from the embedded active_votes. They are the meaningful,
 * bright lines. Crucially they do NOT shape the layout (see `lib/layout.ts`),
 * so co-voting authors are not pulled together; instead the real lines weave
 * as long chords across the whole map.
 *
 * FILLER edges are the dim web the bug travels on. They are generated as a
 * Hamiltonian cycle over a seeded shuffle of all houses, plus a few chords —
 * which guarantees, by construction, that every house is reachable from every
 * other and none is stranded, and gives the force layout a web to unfold.
 */
function buildEdges(
  houses: BoardHouse[],
  seed: number
): { edges: BoardEdge[]; connectivity: BoardConnectivity } {
  const n = houses.length;
  const voterSets = houses.map((h) => new Set(h.voters));
  const edges: BoardEdge[] = [];
  const exists = new Set<string>();
  const keyOf = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;

  // REAL edges: shared voters.
  const real = new UnionFind(n);
  for (let i = 0; i < n; i++) {
    if (voterSets[i].size === 0) continue;
    for (let j = i + 1; j < n; j++) {
      if (voterSets[j].size === 0) continue;
      let shared = 0;
      const [small, big] = voterSets[i].size < voterSets[j].size ? [i, j] : [j, i];
      for (const v of voterSets[small]) if (voterSets[big].has(v)) shared++;
      if (shared > 0) {
        edges.push({ id: edges.length, a: i, b: j, kind: 'real', shared });
        exists.add(keyOf(i, j));
        real.union(i, j);
      }
    }
  }
  const realEdgeCount = edges.length;
  const componentsFromReal = real.componentCount(n);

  const rng = mulberry32(seed | 0);
  const combined = new UnionFind(n);
  for (const e of edges) combined.union(e.a, e.b);

  const addFiller = (a: number, b: number) => {
    if (a === b) return;
    const k = keyOf(a, b);
    if (exists.has(k)) return;
    exists.add(k);
    edges.push({ id: edges.length, a, b, kind: 'filler', shared: 0 });
    combined.union(a, b);
  };

  if (n > 1) {
    // Seeded shuffle (Fisher-Yates), then join consecutive houses into one cycle.
    const perm = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < n; i++) addFiller(perm[i], perm[(i + 1) % n]);

    // A few extra chords so the web has interior structure, not just a ring.
    const extra = Math.round(n * 0.35);
    let guard = 0;
    for (let added = 0; added < extra && guard < extra * 6; guard++) {
      const a = Math.floor(rng() * n);
      const b = Math.floor(rng() * n);
      if (a === b || exists.has(keyOf(a, b))) continue;
      addFiller(a, b);
      added++;
    }
  }

  const fillerEdgeCount = edges.length - realEdgeCount;
  const largest = combined.largestComponent(n);

  return {
    edges,
    connectivity: {
      houses: n,
      componentsFromRealEdges: componentsFromReal,
      realEdges: realEdgeCount,
      fillerEdges: fillerEdgeCount,
      largestComponent: largest,
      allReachable: n === 0 ? true : largest === n
    }
  };
}

/** Small deterministic PRNG (as used in the mock) — keeps layouts stable. */
export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
