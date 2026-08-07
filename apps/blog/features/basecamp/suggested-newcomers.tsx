'use client';

import { useMemo } from 'react';
import { Skeleton } from '@hive/ui';
import { cn } from '@ui/lib/utils';
import { useTranslation } from '@/blog/i18n/client';
import { BASECAMP_MUTED, BASECAMP_SKELETON } from './lib/theme';
import { useNewcomers } from './hooks/use-newcomers';
import { useSuggestedNewcomerMatches } from './hooks/use-suggested-newcomer-matches';
import SuggestedNewcomerItem from './suggested-newcomer-item';
import type { BasecampInterest } from './lib/protocol';

// How many already-loaded newcomers to check for an interest match, and how
// many to show once we know which (or, on the fallback path, the most recent).
const SUGGESTION_CANDIDATE_LIMIT = 20;
const SUGGESTIONS_DISPLAY_LIMIT = 5;

const SuggestedNewcomers = ({ guideInterests }: { guideInterests: BasecampInterest[] }) => {
  const { t } = useTranslation('common_blog');
  const { newcomers } = useNewcomers();
  const candidates = useMemo(() => newcomers.slice(0, SUGGESTION_CANDIDATE_LIMIT), [newcomers]);
  const { matches, isFetching } = useSuggestedNewcomerMatches(candidates, guideInterests);

  if (isFetching && candidates.length > 0) {
    return (
      <div className="my-4" data-testid="suggested-newcomers-skeleton">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className={cn(BASECAMP_SKELETON, 'my-2 h-16 w-full rounded-xl')} />
        ))}
      </div>
    );
  }

  const showFallback = matches.length === 0;
  const displayed = (showFallback ? candidates : matches).slice(0, SUGGESTIONS_DISPLAY_LIMIT);

  return (
    <div className="my-4" data-testid="suggested-newcomers">
      <span className="text-sm font-semibold">{t('basecamp.suggested_newcomers.heading')}</span>
      {showFallback ? (
        <p className={cn(BASECAMP_MUTED, 'mt-1 text-sm')} data-testid="suggested-newcomers-fallback-label">
          {t('basecamp.suggested_newcomers.no_matches_fallback')}
        </p>
      ) : null}
      <ul>
        {displayed.map(({ post, accountAgeDays }) => (
          <SuggestedNewcomerItem
            key={`${post.author}/${post.permlink}`}
            post={post}
            accountAgeDays={accountAgeDays}
          />
        ))}
      </ul>
    </div>
  );
};

export default SuggestedNewcomers;
