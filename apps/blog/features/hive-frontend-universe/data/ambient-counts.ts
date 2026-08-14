/**
 * Hive Frontend Universe — ambient activity counts for one window.
 *
 * Two paths, tried in order:
 *   1. hafbe `operation-type-counts` — one cheap call (~142KB) that returns
 *      exact per-type counts for 600 blocks. Only some nodes run hafbe.
 *   2. FALLBACK: `block_api.get_block_range` over the same 600 blocks (6 calls,
 *      ~9MB) tallied client-side. Works on any node.
 *
 * The fallback is wired from the start so the feature works on a frontend
 * pointed at a node without hafbe.
 */

import type { AmbientCounts } from '../lib/board';

/** op_type_ids are stable chain constants; used only to tally, never to filter history. */
const OP = { vote: 0, comment: 1, transfer: 2, customJson: 18 } as const;

const WINDOW_BLOCKS = 600; // 30 minutes at 3s/block
const BLOCK_CHUNK = 100;

async function rpc<T>(endpoint: string, method: string, params: unknown): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? 'rpc error');
  return json.result as T;
}

interface HafbeBlockCounts {
  operations: { op_type_id: number; op_count: number }[];
}

/** Cheap path: one hafbe call for the whole window. Throws if hafbe is absent. */
async function fromHafbe(endpoint: string, headBlock: number): Promise<AmbientCounts> {
  const url = `${endpoint}/hafbe-api/operation-type-counts?block-num=${headBlock}&result-limit=${WINDOW_BLOCKS}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`hafbe ${res.status}`);
  const blocks = (await res.json()) as HafbeBlockCounts[];
  if (!Array.isArray(blocks)) throw new Error('hafbe unexpected shape');

  const sum = { [OP.vote]: 0, [OP.comment]: 0, [OP.transfer]: 0, [OP.customJson]: 0 } as Record<number, number>;
  for (const b of blocks) {
    for (const o of b.operations ?? []) {
      if (o.op_type_id in sum) sum[o.op_type_id] += o.op_count;
    }
  }
  return {
    votes: sum[OP.vote],
    comments: sum[OP.comment],
    transfers: sum[OP.transfer],
    customJson: sum[OP.customJson],
    source: 'hafbe'
  };
}

interface RawBlock {
  transactions?: { operations?: { type?: string }[] }[];
}

/** Fallback path: read the raw blocks and tally op types by name. */
async function fromBlocks(endpoint: string, headBlock: number): Promise<AmbientCounts> {
  const start = headBlock - WINDOW_BLOCKS + 1;
  const counts = { votes: 0, comments: 0, transfers: 0, customJson: 0 };
  const nameToBucket: Record<string, keyof typeof counts> = {
    vote_operation: 'votes',
    comment_operation: 'comments',
    transfer_operation: 'transfers',
    custom_json_operation: 'customJson'
  };

  for (let from = start; from <= headBlock; from += BLOCK_CHUNK) {
    const count = Math.min(BLOCK_CHUNK, headBlock - from + 1);
    const result = await rpc<{ blocks: RawBlock[] }>(endpoint, 'block_api.get_block_range', {
      starting_block_num: from,
      count
    });
    for (const block of result.blocks ?? []) {
      for (const tx of block.transactions ?? []) {
        for (const op of tx.operations ?? []) {
          const bucket = op.type ? nameToBucket[op.type] : undefined;
          if (bucket) counts[bucket]++;
        }
      }
    }
  }
  return { ...counts, source: 'blocks' };
}

/**
 * Ambient counts for the window ending at `headBlock`. Tries hafbe, falls back
 * to reading blocks. Never throws for missing hafbe — only a total failure of
 * both paths propagates.
 */
export async function getAmbientCounts(endpoint: string, headBlock: number): Promise<AmbientCounts> {
  try {
    return await fromHafbe(endpoint, headBlock);
  } catch {
    return await fromBlocks(endpoint, headBlock);
  }
}
