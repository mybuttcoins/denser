'use client';

/**
 * Hive Frontend Universe — the house card.
 *
 * Read-only this pass. Shown over the map when the bug parks on a house. The
 * post body goes through the site's own `RendererContainer`, so it is
 * sanitised exactly like every other post on the site (phishing checks, image
 * proxying, safe external links). Three buttons: open the post, open the
 * author's profile (both in a new tab so the game keeps running), and skip.
 *
 * All the data shown here is already in the board — no extra fetch.
 */

import RendererContainer from '@/blog/features/post-rendering/rendererContainer';
import { getUserAvatarUrl } from '@ui/lib/avatar-utils';
import { TIERS, type BoardHouse } from '../lib/board';
import { HFU_COPY } from '../lib/strings';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

function openInNewTab(path: string): void {
  const url = `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function formatAge(days: number): string {
  if (days < 60) return `${days}d old`;
  if (days < 365) return `${Math.round(days / 30)}mo old`;
  return `${(days / 365).toFixed(1)}y old`;
}

function formatHp(hp: number): string {
  if (hp >= 1_000_000) return `${(hp / 1_000_000).toFixed(1)}M`;
  if (hp >= 1000) return `${(hp / 1000).toFixed(1)}k`;
  return `${Math.round(hp)}`;
}

export const HouseCard = ({ house, onSkip }: { house: BoardHouse; onSkip: () => void }) => {
  const tier = TIERS[house.tier];
  const { post } = house;

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 mx-auto max-w-[470px] p-3 sm:bottom-3">
      <div
        className="flex max-h-[70vh] flex-col overflow-hidden rounded-xl border bg-[#080d13]/95 backdrop-blur-sm"
        style={{ borderColor: house.isNewcomer ? '#5df0ff' : '#1d2a34' }}
        data-testid="hfu-house-card"
      >
        {/* Header: identity, stake, age, community. */}
        <div className="flex items-start gap-3 border-b border-white/10 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- avatar via the app's own proxied avatar route */}
          <img
            src={getUserAvatarUrl(house.handle, 'small')}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-full bg-white/10 object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-sm font-semibold text-[#e9f4f8]">@{house.handle}</span>
              {house.isNewcomer ? (
                <span className="shrink-0 font-mono text-[10px] font-bold text-[#5df0ff]">
                  {HFU_COPY.card.newcomer}
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[11px]" style={{ color: '#465866' }}>
              <span style={{ color: tier.col }}>{tier.name.toUpperCase()}</span>
              <span>
                {formatHp(house.hp)} {HFU_COPY.card.hp}
              </span>
              <span>
                {HFU_COPY.card.rep} {Math.round(house.rep)}
              </span>
              <span>{formatAge(house.ageDays)}</span>
              {house.communityTitle ? <span className="truncate">{house.communityTitle}</span> : null}
            </div>
          </div>
        </div>

        {/* Post. */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <h3 className="mb-2 text-sm font-semibold text-[#cfe2ea]">{post.title}</h3>
          <div className="hfu-post-body text-[13px] leading-relaxed text-[#aab8c4]">
            <RendererContainer body={post.body} author={post.author} permlink={post.permlink} />
          </div>
        </div>

        {/* Footer: stats + actions. */}
        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex gap-4 font-mono text-[11px] text-[#465866]">
            <span>{post.payout.toFixed(2)} HBD</span>
            <span>
              {post.votes} {HFU_COPY.card.votes}
            </span>
            <span>
              {post.comments} {HFU_COPY.card.comments}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => openInNewTab(post.url)}
              className="rounded-lg border border-[#5df0ff]/40 bg-[#5df0ff]/10 px-2 py-2 font-mono text-[11px] font-semibold text-[#9df3e7] transition-colors hover:bg-[#5df0ff]/20"
            >
              {HFU_COPY.card.openPost}
            </button>
            <button
              type="button"
              onClick={() => openInNewTab(`/@${house.handle}`)}
              className="rounded-lg border border-white/15 bg-white/5 px-2 py-2 font-mono text-[11px] font-semibold text-[#aab8c4] transition-colors hover:bg-white/10"
            >
              {HFU_COPY.card.openProfile}
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="rounded-lg border border-white/10 bg-transparent px-2 py-2 font-mono text-[11px] font-semibold text-[#8fa6b4] transition-colors hover:bg-white/5"
            >
              {HFU_COPY.card.skip}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
