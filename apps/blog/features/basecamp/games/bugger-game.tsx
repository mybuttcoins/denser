'use client';

import { cn } from '@ui/lib/utils';
import { useTranslation } from '@/blog/i18n/client';
import { BASECAMP_PANEL, BASECAMP_ACCENT_DOT } from '../lib/theme';

/**
 * Bugger — the Matrix-crossing game.
 *
 * The game is a self-contained, dependency-free single-file build
 * (`public/bugger.html`) framed here rather than ported to React. Keeping it as
 * one HTML file preserves its "no build step" nature and, more importantly,
 * leaves the canvas rendering and the safety/appearance independence it relies
 * on exactly as authored. It renders beneath the Bugger button in the section.
 *
 * `NEXT_PUBLIC_BASE_PATH` is prepended because public assets are served under
 * the app's basePath when Denser runs from a subdirectory (e.g. `/blog`).
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

const BuggerGame = () => {
  const { t } = useTranslation('common_blog');
  const title = t('basecamp.games.titles.bugger');

  return (
    <div className={cn(BASECAMP_PANEL, 'mt-3')} data-testid="game-bugger">
      <div className="mb-3 flex items-center gap-2">
        <span className={cn('h-2.5 w-2.5 rounded-full', BASECAMP_ACCENT_DOT.amber)} aria-hidden="true" />
        <span className="text-base font-semibold">{title}</span>
      </div>
      <iframe
        src={`${BASE_PATH}/bugger.html`}
        title={title}
        loading="lazy"
        className="mx-auto block h-[min(720px,85vh)] w-full max-w-[470px] rounded-lg border border-white/10 bg-[#010204]"
      />
    </div>
  );
};

export default BuggerGame;
