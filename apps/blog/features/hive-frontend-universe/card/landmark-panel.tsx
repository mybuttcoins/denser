'use client';

/**
 * Hive Frontend Universe — landmark arrival panel.
 *
 * Shown when the bug parks on a rim landmark or a community bubble. The Open
 * button launches the landmark's REAL page in a new browser tab so the game
 * keeps running behind it; closing the tab puts the player straight back.
 *
 * Link handling mirrors the app's own navigation: these are the same curated
 * destinations the site header and sidebar link to, opened with the same
 * `noopener noreferrer` guard the nav uses (the LeavePageDialog interstitial
 * is reserved for untrusted links found inside post bodies — these are not
 * that). A landmark with no page yet says so plainly instead of an Open button.
 */

import env from '@beam-australia/react-env';
import { siteConfig } from '@ui/config/site';
import { useTranslation } from '@/blog/i18n/client';
import { ACCENT_HEX } from '../engine/render';
import type { LandmarkKind } from '../lib/fixed-world';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export interface LandmarkPanelProps {
  title: string;
  kind: LandmarkKind;
  path: string;
  accent: string;
  onSkip: () => void;
}

function resolveHref(kind: LandmarkKind, path: string): string | null {
  switch (kind) {
    case 'internal':
      return `${BASE_PATH}${path}`;
    case 'wallet': {
      const wallet = env('WALLET_ENDPOINT');
      return wallet ? `${wallet}${path === '/' ? '' : path}` : null;
    }
    case 'explorer': {
      const explorer = env('EXPLORER_DOMAIN');
      return explorer ? `${explorer}${path === '/' ? '' : path}` : null;
    }
    case 'chat':
      return siteConfig.openhiveChatUri;
    case 'external':
      return path;
    case 'none':
      return null;
  }
}

export const LandmarkPanel = ({ title, kind, path, accent, onSkip }: LandmarkPanelProps) => {
  const { t } = useTranslation('common_blog');
  const href = resolveHref(kind, path);
  const color = ACCENT_HEX[accent] ?? '#5EE9D5';

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 mx-auto max-w-[380px] p-3 sm:bottom-4">
      <div
        className="rounded-xl border bg-[#080d13]/95 p-4 backdrop-blur-sm"
        style={{ borderColor: color }}
        data-testid="hfu-landmark-panel"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
          <span className="font-mono text-sm font-bold text-[#e9f4f8]">{title}</span>
        </div>
        {href === null ? (
          <p className="mb-3 text-sm text-[#8fa6b4]">{t('hive_frontend_universe.panel.nothing_here')}</p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {href !== null ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border px-2 py-2 text-center font-mono text-xs font-semibold transition-colors hover:bg-white/10"
              style={{ borderColor: color, color }}
              data-testid="hfu-landmark-open"
            >
              {t('hive_frontend_universe.panel.open')}
            </a>
          ) : null}
          <button
            type="button"
            onClick={onSkip}
            className="rounded-lg border border-white/10 px-2 py-2 font-mono text-xs font-semibold text-[#8fa6b4] transition-colors hover:bg-white/5"
            data-testid="hfu-landmark-skip"
          >
            {t('hive_frontend_universe.panel.skip')}
          </button>
        </div>
      </div>
    </div>
  );
};
