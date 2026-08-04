'use client';

import { Card } from '@ui/components/card';
import { Link, accountReputation } from '@hive/ui';
import { getUserAvatarUrl } from '@ui/lib/avatar-utils';
import TimeAgo from '@ui/components/time-ago';
import { useTranslation } from '@/blog/i18n/client';
import VoteOnPostButton from './vote-on-post-button';
import type { Newcomer } from './hooks/use-newcomers';

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
      <Card className="my-2 flex items-center gap-3 bg-background p-3" data-testid="support-list-item">
        <Link href={`/@${post.author}`}>
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
            <span className="text-primary/60" data-testid="support-item-reputation">
              ({accountReputation(post.author_reputation)})
            </span>
            <span className="text-primary/60" data-testid="support-item-account-age">
              {t('basecamp.newcomers_list.days_old', { count: accountAgeDays })}
            </span>
            <span className="text-primary/60">
              <TimeAgo date={post.created} />
            </span>
          </div>
          <Link href={postUrl} className="line-clamp-1 block text-sm text-primary/70 hover:text-destructive">
            {post.title}
          </Link>
        </div>
        {filter === 'low_support' ? (
          <VoteOnPostButton author={post.author} permlink={post.permlink} />
        ) : (
          <Link
            href={`${postUrl}/#comments`}
            className="whitespace-nowrap text-sm text-destructive hover:underline"
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
