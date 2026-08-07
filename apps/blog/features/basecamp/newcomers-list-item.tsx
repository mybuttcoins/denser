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
import type { Newcomer } from './hooks/use-newcomers';

const NewcomersListItem = ({ post, accountAgeDays }: Newcomer) => {
  const { t } = useTranslation('common_blog');
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
            <span className={BASECAMP_MUTED} data-testid="newcomer-account-age">
              {t('basecamp.newcomers_list.days_old', { count: accountAgeDays })}
            </span>
            <span className={cn(BASECAMP_MUTED, 'opacity-60')}>·</span>
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
