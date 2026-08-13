'use client';

import { Skeleton } from '@hive/ui';
import { cn } from '@ui/lib/utils';
import { useTranslation } from '@/blog/i18n/client';
import { useNewcomers } from './hooks/use-newcomers';
import NewcomersListItem from './newcomers-list-item';
import { BASECAMP_CARD, BASECAMP_MUTED, BASECAMP_SKELETON, accentButton } from './lib/theme';

function NewcomerCardSkeleton() {
  return (
    <div className={cn(BASECAMP_CARD, 'my-3 flex items-center gap-4 p-4')}>
      <Skeleton className={cn(BASECAMP_SKELETON, 'h-16 w-16 shrink-0 rounded-full')} />
      <Skeleton className={cn(BASECAMP_SKELETON, 'h-11 w-11 shrink-0 rounded-full')} />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className={cn(BASECAMP_SKELETON, 'h-3 w-32')} />
        <Skeleton className={cn(BASECAMP_SKELETON, 'h-4 w-3/4')} />
      </div>
    </div>
  );
}

const NewcomersList = () => {
  const { t } = useTranslation('common_blog');
  const { newcomers, isLoading, isFetching, isFetchingNextPage, fetchNextPage, hasNextPage, loadMoreRef } =
    useNewcomers();

  if (isLoading || (isFetching && newcomers.length === 0 && !isFetchingNextPage)) {
    return (
      <div data-testid="newcomers-list-skeleton">
        {Array.from({ length: 5 }).map((_, i) => (
          <NewcomerCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (newcomers.length === 0 && !hasNextPage) {
    return (
      <div
        className={cn(BASECAMP_MUTED, 'w-full rounded-xl border border-dashed border-white/15 py-8 text-center text-sm')}
        data-testid="newcomers-list-no-results"
      >
        {t('basecamp.newcomers_list.no_results')}
      </div>
    );
  }

  return (
    <>
      <ul data-testid="newcomers-list">
        {newcomers.map(({ post, accountAgeDays, account }) => (
          <NewcomersListItem
            key={`${post.author}/${post.permlink}`}
            post={post}
            accountAgeDays={accountAgeDays}
            account={account}
          />
        ))}
      </ul>
      <div className="mt-4 flex justify-center">
        <button
          ref={loadMoreRef}
          onClick={() => fetchNextPage()}
          disabled={!hasNextPage || isFetchingNextPage}
          className={cn(accentButton('violet', false), 'h-9 text-sm')}
          data-testid="newcomers-list-load-more"
        >
          {isFetchingNextPage
            ? t('global.loading')
            : hasNextPage
              ? t('user_profile.load_newer')
              : t('user_profile.nothing_more_to_load')}
        </button>
      </div>
    </>
  );
};

export default NewcomersList;
