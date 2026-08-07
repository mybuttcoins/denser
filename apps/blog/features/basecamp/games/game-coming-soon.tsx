'use client';

import { cn } from '@ui/lib/utils';
import { useTranslation } from '@/blog/i18n/client';
import { BASECAMP_PANEL, BASECAMP_MUTED, BASECAMP_ACCENT_DOT, type BasecampAccent } from '../lib/theme';

/**
 * Placeholder shown inside a game until the real thing is built.
 *
 * Each game has its own component file that renders this. When a game becomes
 * playable, that file swaps this out for the actual gameplay — nothing about
 * the registry, the selection logic, or the section layout has to change.
 */
const GameComingSoon = ({ title, accent }: { title: string; accent: BasecampAccent }) => {
  const { t } = useTranslation('common_blog');

  return (
    <div
      className={cn(BASECAMP_PANEL, 'mt-3 flex flex-col items-center gap-2 py-10 text-center')}
      data-testid="game-coming-soon"
    >
      <span className={cn('h-2.5 w-2.5 rounded-full', BASECAMP_ACCENT_DOT[accent])} aria-hidden="true" />
      <span className="text-base font-semibold">{title}</span>
      <span className={cn(BASECAMP_MUTED, 'text-sm')}>{t('basecamp.games.coming_soon')}</span>
    </div>
  );
};

export default GameComingSoon;
