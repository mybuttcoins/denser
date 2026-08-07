'use client';

import { Card } from '@ui/components/card';
import { Link } from '@hive/ui';
import { getUserAvatarUrl } from '@ui/lib/avatar-utils';
import TimeAgo from '@ui/components/time-ago';
import { cn } from '@ui/lib/utils';
import { useTranslation } from '@/blog/i18n/client';
import VoteOnPostButton from './vote-on-post-button';
import ActivityRings from './activity-rings';
import { BASECAMP_CARD, BASECAMP_LINK, BASECAMP_MUTED } from './lib/theme';
import type { Newcomer } from './hooks/use-newcomers';

const COMPACT_RING_SIZE = 46;

const SupportListItem = ({
  newcomer,
  filter
}: {
  newcomer: Newcomer;
  filter: 'low_support' | 'low_interaction';
}) => {
  const { t } = useTranslation('common_blog');
  const { post, accountAgeDays } = newcomer;
  const postUrl = `/${post.category}/@${post.author}/${post.permlink}`;

  return (
    <li>
      <Card className={cn(BASECAMP_CARD, 'my-2 flex items-center gap-3 p-3')} data-testid="support-list-item">
        <ActivityRings
          username={post.author}
          reputation={post.author_reputation}
          accountAgeDays={accountAgeDays}
          size={COMPACT_RING_SIZE}
          reputationTestId="support-item-reputation"
        />
        <Link href={`/@${post.author}`} className="shrink-0">
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
            <span className={BASECAMP_MUTED} data-testid="support-item-account-age">
              {t('basecamp.newcomers_list.days_old', { count: accountAgeDays })}
            </span>
            <span className={BASECAMP_MUTED}>
              <TimeAgo date={post.created} />
            </span>
          </div>
          <Link href={postUrl} className={cn(BASECAMP_LINK, 'line-clamp-1 block text-sm')}>
            {post.title}
          </Link>
        </div>
        {filter === 'low_support' ? (
          <VoteOnPostButton author={post.author} permlink={post.permlink} />
        ) : (
          <Link
            href={`${postUrl}/#comments`}
            className="whitespace-nowrap text-sm text-[#B79CFF] hover:underline"
            data-testid="comment-on-post-link"
          >
            {t('basecamp.support_flow.comment_on_this_post')}
          </Link>
        )}
      </Card>
    </li>
  );
};

export default SupportListItem;
