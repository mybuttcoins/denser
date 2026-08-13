'use client';

import { Card } from '@ui/components/card';
import { Link } from '@hive/ui';
import { getUserAvatarUrl } from '@ui/lib/avatar-utils';
import TimeAgo from '@ui/components/time-ago';
import { cn } from '@ui/lib/utils';
import { useTranslation } from '@/blog/i18n/client';
import PostCardCommentTooltip from '@/blog/features/list-of-posts/post-card-comment-tooltip';
import ActivityRings from './activity-rings';
import { BASECAMP_CARD, BASECAMP_LINK, BASECAMP_MUTED } from './lib/theme';
import { BASECAMP_SIGNALS, type SignalInput, type SignalValue } from './lib/signals';
import type { Newcomer } from './hooks/use-newcomers';

// The signals meaningful on the feed surface. Computed once at module scope so
// the card never names or filters individual signals itself.
const FEED_SIGNALS = BASECAMP_SIGNALS.filter((signal) => signal.contexts.includes('feed'));

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Turns a computed SignalValue into a display string via t(), driven only by
 * the unit token. An unknown value renders a muted placeholder, never a zero.
 */
function formatSignalValue(t: TranslateFn, signal: SignalValue): string {
  if (!signal.known || signal.value === null) return t('basecamp.signals.value_unknown');
  switch (signal.unit) {
    case 'days':
      return t('basecamp.signals.units.days', { value: signal.value });
    case 'per_day':
      return t('basecamp.signals.units.per_day', { value: signal.value });
    case 'percent':
      return t('basecamp.signals.units.percent', { value: signal.value });
    case 'boolean':
      return signal.value > 0
        ? t('basecamp.signals.units.boolean_true')
        : t('basecamp.signals.units.boolean_false');
    case 'count':
      return t('basecamp.signals.units.count', { value: signal.value });
    case 'none':
    default:
      return t('basecamp.signals.units.none', { value: signal.value });
  }
}

const NewcomersListItem = ({ post, accountAgeDays, account }: Newcomer) => {
  const { t } = useTranslation('common_blog');

  const signalInput: SignalInput = {
    account,
    post: {
      replyCount: typeof post.children === 'number' ? post.children : null,
      voteCount: typeof post.stats?.total_votes === 'number' ? post.stats.total_votes : null
    },
    nowMs: Date.now()
  };

  return (
    <li>
      <Card className={cn(BASECAMP_CARD, 'my-3 flex items-center gap-4 p-4')} data-testid="newcomer-list-item">
        <ActivityRings
          username={post.author}
          reputation={post.author_reputation}
          accountAgeDays={accountAgeDays}
        />
        <Link href={`/@${post.author}`} data-testid="newcomer-avatar" className="shrink-0">
          <div
            className="h-11 w-11 rounded-full bg-cover bg-no-repeat ring-1 ring-white/15 transition-shadow hover:ring-2 hover:ring-[#B79CFF]/60"
            style={{ backgroundImage: `url(${getUserAvatarUrl(post.author, 'small')})` }}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-xs">
            <Link
              href={`/@${post.author}`}
              className={cn(BASECAMP_LINK, 'text-sm font-semibold')}
              data-testid="newcomer-username"
            >
              {post.author}
            </Link>
            <span className={BASECAMP_MUTED}>
              <TimeAgo date={post.created} />
            </span>
          </div>
          <Link
            href={`/${post.category}/@${post.author}/${post.permlink}`}
            className={cn(BASECAMP_LINK, 'mt-1 line-clamp-2 block text-[15px] font-medium leading-snug')}
            data-testid="newcomer-post-title"
          >
            {post.title}
          </Link>
          <ul className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" data-testid="newcomer-signals">
            {FEED_SIGNALS.map((signal) => {
              const computed = signal.compute(signalInput);
              return (
                <li key={signal.id} className="flex items-center gap-1" data-testid={`signal-${signal.id}`}>
                  <span className={BASECAMP_MUTED}>{t(signal.labelKey)}</span>
                  <span
                    className={computed.known ? 'font-medium' : cn(BASECAMP_MUTED, 'opacity-70')}
                    data-testid={`signal-value-${signal.id}`}
                  >
                    {formatSignalValue(t, computed)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className={cn(BASECAMP_MUTED, 'shrink-0 text-sm')}>
          <PostCardCommentTooltip
            comments={post.children}
            url={`/${post.category}/@${post.author}/${post.permlink}/#comments`}
          />
        </div>
      </Card>
    </li>
  );
};

export default NewcomersListItem;
