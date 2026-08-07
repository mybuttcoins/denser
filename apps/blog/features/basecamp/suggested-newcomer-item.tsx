'use client';

import { Card } from '@ui/components/card';
import { Link } from '@hive/ui';
import { getUserAvatarUrl } from '@ui/lib/avatar-utils';
import TimeAgo from '@ui/components/time-ago';
import { cn } from '@ui/lib/utils';
import { useTranslation } from '@/blog/i18n/client';
import type { Newcomer } from './hooks/use-newcomers';
import FollowNewcomerButton from './follow-newcomer-button';
import ActivityRings from './activity-rings';
import { BASECAMP_CARD, BASECAMP_LINK, BASECAMP_MUTED } from './lib/theme';

const COMPACT_RING_SIZE = 46;

const SuggestedNewcomerItem = ({ post, accountAgeDays }: Newcomer) => {
  const { t } = useTranslation('common_blog');
  return (
    <li>
      <Card
        className={cn(BASECAMP_CARD, 'my-2 flex items-center gap-3 p-3')}
        data-testid="suggested-newcomer-item"
      >
        <ActivityRings
          username={post.author}
          reputation={post.author_reputation}
          accountAgeDays={accountAgeDays}
          size={COMPACT_RING_SIZE}
          reputationTestId="suggested-newcomer-reputation"
        />
        <Link href={`/@${post.author}`} data-testid="suggested-newcomer-avatar" className="shrink-0">
          <div
            className="h-10 w-10 rounded-full bg-cover bg-no-repeat ring-1 ring-white/15"
            style={{ backgroundImage: `url(${getUserAvatarUrl(post.author, 'small')})` }}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-xs">
            <Link href={`/@${post.author}`} className={cn(BASECAMP_LINK, 'text-sm font-semibold')}>
              {post.author}
            </Link>
            <span className={BASECAMP_MUTED}>
              {t('basecamp.newcomers_list.days_old', { count: accountAgeDays })}
            </span>
            <span className={BASECAMP_MUTED}>
              <TimeAgo date={post.created} />
            </span>
          </div>
          <Link
            href={`/${post.category}/@${post.author}/${post.permlink}`}
            className={cn(BASECAMP_LINK, 'line-clamp-1 block text-sm')}
          >
            {post.title}
          </Link>
        </div>
        <FollowNewcomerButton username={post.author} />
      </Card>
    </li>
  );
};

export default SuggestedNewcomerItem;
