'use client';

import { Card } from '@ui/components/card';
import { Link, accountReputation } from '@hive/ui';
import { getUserAvatarUrl } from '@ui/lib/avatar-utils';
import TimeAgo from '@ui/components/time-ago';
import { useTranslation } from '@/blog/i18n/client';
import type { Newcomer } from './hooks/use-newcomers';
import FollowNewcomerButton from './follow-newcomer-button';

const SuggestedNewcomerItem = ({ post, accountAgeDays }: Newcomer) => {
  const { t } = useTranslation('common_blog');
  return (
    <li>
      <Card
        className="my-2 flex items-center gap-3 bg-background p-3"
        data-testid="suggested-newcomer-item"
      >
        <Link href={`/@${post.author}`} data-testid="suggested-newcomer-avatar">
          <div
            className="h-10 w-10 shrink-0 rounded-full bg-cover bg-no-repeat"
            style={{ backgroundImage: `url(${getUserAvatarUrl(post.author, 'small')})` }}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            <Link href={`/@${post.author}`} className="font-medium hover:text-destructive">
              {post.author}
            </Link>
            <span className="text-primary/60" data-testid="suggested-newcomer-reputation">
              ({accountReputation(post.author_reputation)})
            </span>
            <span className="text-primary/60">
              {t('basecamp.newcomers_list.days_old', { count: accountAgeDays })}
            </span>
            <span className="text-primary/60">
              <TimeAgo date={post.created} />
            </span>
          </div>
          <Link
            href={`/${post.category}/@${post.author}/${post.permlink}`}
            className="line-clamp-1 block text-sm text-primary/70 hover:text-destructive"
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
