'use client';

import dynamic from 'next/dynamic';
import { cn } from '@ui/lib/utils';
import { useTranslation } from '@/blog/i18n/client';
import { BASECAMP_PANEL, BASECAMP_ACCENT_DOT } from '../lib/theme';

/**
 * Hive Frontend Universe — Puppet Patrol launcher.
 *
 * The game itself is a large, self-contained module under
 * `features/hive-frontend-universe`. It is dynamically imported (client-only)
 * so its canvas/data code is code-split and only loads when this panel opens —
 * the same off-by-default behaviour as the other games. Rendered in a bounded
 * panel so it sits inside the Basecamp section like the rest.
 */
const HiveFrontendUniverse = dynamic(() => import('@/blog/features/hive-frontend-universe'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-[#8fa6b4]">…</div>
  )
});

const HiveFrontendUniverseGame = () => {
  const { t } = useTranslation('common_blog');
  const title = t('basecamp.games.titles.hive_frontend_universe');

  return (
    <div className={cn(BASECAMP_PANEL, 'mt-3')} data-testid="game-hive-frontend-universe">
      <div className="mb-3 flex items-center gap-2">
        <span className={cn('h-2.5 w-2.5 rounded-full', BASECAMP_ACCENT_DOT.emerald)} aria-hidden="true" />
        <span className="text-base font-semibold">{title}</span>
      </div>
      <div className="mx-auto h-[min(720px,85vh)] w-full max-w-[560px] overflow-hidden rounded-lg border border-white/10 bg-[#010204]">
        <HiveFrontendUniverse />
      </div>
    </div>
  );
};

export default HiveFrontendUniverseGame;
