'use client';

import { Card } from '@ui/components/card';
import { Link } from '@hive/ui';
import { getUserAvatarUrl } from '@ui/lib/avatar-utils';
import TimeAgo from '@ui/components/time-ago';
import { useTranslation } from '@/blog/i18n/client';
import PostCardCommentTooltip from '@/blog/features/list-of-posts/post-card-comment-tooltip';
import type { Newcomer } from './hooks/use-newcomers';

const NewcomersListItem = ({ post, accountAgeDays }: Newcomer) => {
  const { t } = useTranslation('common_blog');
  return (
    <li>
      <Card
        className="my-4 flex items-center gap-3 bg-background p-4 text-primary"
        data-testid="newcomer-list-item"
      >
        <Link href={`/@${post.author}`} data-testid="newcomer-avatar">
          <div
            className="h-12 w-12 shrink-0 rounded-full bg-cover bg-no-repeat"
            style={{ backgroundImage: `url(${getUserAvatarUrl(post.author, 'small')})` }}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            <Link
              href={`/@${post.author}`}
              className="font-medium hover:text-destructive"
              data-testid="newcomer-username"
            >
              {post.author}
            </Link>
            <span className="text-primary/60" data-testid="newcomer-account-age">
              {t('basecamp.newcomers_list.days_old', { count: accountAgeDays })}
            </span>
            <span className="text-primary/60">
              <TimeAgo date={post.created} />
            </span>
          </div>
          <Link
            href={`/${post.category}/@${post.author}/${post.permlink}`}
            className="line-clamp-1 font-medium hover:text-destructive"
            data-testid="newcomer-post-title"
          >
            {post.title}
          </Link>
        </div>
        <PostCardCommentTooltip
          comments={post.children}
          url={`/${post.category}/@${post.author}/${post.permlink}/#comments`}
        />
      </Card>
    </li>
  );
};

export default NewcomersListItem;
