'use client';

import { useMemo, useState } from 'react';
import { Button } from '@hive/ui';
import { useTranslation } from '@/blog/i18n/client';
import { useNewcomers, type Newcomer } from './hooks/use-newcomers';
import SupportListItem from './support-list-item';

type SupportFilter = 'low_support' | 'low_interaction';

const SUPPORT_DISPLAY_LIMIT = 10;

function getVoteCount(newcomer: Newcomer): number {
  return newcomer.post.stats?.total_votes ?? 0;
}

function getCommentCount(newcomer: Newcomer): number {
  return newcomer.post.children;
}

const SupportFlow = () => {
  const { t } = useTranslation('common_blog');
  const { newcomers } = useNewcomers();
  const [filter, setFilter] = useState<SupportFilter | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'low_support') {
      return [...newcomers].sort((a, b) => getVoteCount(a) - getVoteCount(b)).slice(0, SUPPORT_DISPLAY_LIMIT);
    }
    if (filter === 'low_interaction') {
      return [...newcomers]
        .sort((a, b) => getCommentCount(a) - getCommentCount(b))
        .slice(0, SUPPORT_DISPLAY_LIMIT);
    }
    return [];
  }, [filter, newcomers]);

  return (
    <div className="my-4" data-testid="support-flow">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === 'low_support' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter((prev) => (prev === 'low_support' ? null : 'low_support'))}
          data-testid="support-filter-low-support"
        >
          {t('basecamp.support_flow.low_support')}
        </Button>
        <Button
          variant={filter === 'low_interaction' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter((prev) => (prev === 'low_interaction' ? null : 'low_interaction'))}
          data-testid="support-filter-low-interaction"
        >
          {t('basecamp.support_flow.low_interaction')}
        </Button>
      </div>
      {filter ? (
        <ul className="mt-3" data-testid="support-filtered-list">
          {filtered.map((newcomer) => (
            <SupportListItem
              key={`${newcomer.post.author}/${newcomer.post.permlink}`}
              newcomer={newcomer}
              filter={filter}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default SupportFlow;
