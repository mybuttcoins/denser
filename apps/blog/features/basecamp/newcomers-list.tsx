'use client';

import { Skeleton } from '@hive/ui';
import { useTranslation } from '@/blog/i18n/client';
import { useNewcomers } from './hooks/use-newcomers';
import NewcomersListItem from './newcomers-list-item';

function NewcomerCardSkeleton() {
  return (
    <div className="my-4 flex items-center gap-3 rounded-lg border bg-background p-4">
      <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-3/4" />
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
      <div className="w-full py-4" data-testid="newcomers-list-no-results">
        {t('basecamp.newcomers_list.no_results')}
      </div>
    );
  }

  return (
    <>
      <ul data-testid="newcomers-list">
        {newcomers.map(({ post, accountAgeDays }) => (
          <NewcomersListItem key={`${post.author}/${post.permlink}`} post={post} accountAgeDays={accountAgeDays} />
        ))}
      </ul>
      <div>
        <button
          ref={loadMoreRef}
          onClick={() => fetchNextPage()}
          disabled={!hasNextPage || isFetchingNextPage}
          data-testid="newcomers-list-load-more"
        >
          {isFetchingNextPage ? (
            <div>{t('global.loading')}</div>
          ) : hasNextPage ? (
            t('user_profile.load_newer')
          ) : (
            t('user_profile.nothing_more_to_load')
          )}
        </button>
      </div>
    </>
  );
};

export default NewcomersList;
