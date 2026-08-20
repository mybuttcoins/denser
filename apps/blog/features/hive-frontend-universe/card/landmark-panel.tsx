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
 *
 * WHERE a landmark leads is not decided here: `lib/targets.ts` owns that
 * mapping, shared with the hover chip and the click handler, so the three can
 * never disagree. This panel used to carry its own copy, which is exactly how
 * the wallet ended up saying "nothing here" in one place while hovering said
 * otherwise.
 */

import { useTranslation } from '@/blog/i18n/client';
import { ACCENT_HEX } from '../engine/render';
import { landmarkHref } from '../lib/targets';
import type { LandmarkKind } from '../lib/fixed-world';

export interface LandmarkPanelProps {
  title: string;
  kind: LandmarkKind;
  path: string;
  accent: string;
  /** Extra curated destinations this place offers (the Arcade's real games). */
  links?: { label: string; href: string }[];
  /** Heading over the links list; the caller localises it. */
  linksLabel?: string;
  /** Small labelled rows of real numbers (a witness visit's chain stats). */
  stats?: { label: string; value: string }[];
  /** One highlighted line of news (today's buzzing station says so here). */
  note?: string;
  onSkip: () => void;
}

export const LandmarkPanel = ({
  title,
  kind,
  path,
  accent,
  links,
  linksLabel,
  stats,
  note,
  onSkip
}: LandmarkPanelProps) => {
  const { t } = useTranslation('common_blog');
  const href = landmarkHref(kind, path);
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
        {href === null && !stats?.length ? (
          <p className="mb-3 text-sm text-[#8fa6b4]">{t('hive_frontend_universe.panel.nothing_here')}</p>
        ) : null}
        {note ? (
          <p className="mb-3 font-mono text-xs font-semibold text-[#ffd24a]" data-testid="hfu-panel-note">
            {note}
          </p>
        ) : null}
        {stats?.length ? (
          <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1" data-testid="hfu-witness-stats">
            {stats.map((s) => (
              <div key={s.label} className="contents">
                <dt className="font-mono text-[11px] uppercase tracking-wide text-[#8fa6b4]">{s.label}</dt>
                <dd className="text-right font-mono text-xs text-[#e9f4f8]">{s.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {links?.length ? (
          <div className="mb-3">
            <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-[#8fa6b4]">
              {linksLabel ?? t('hive_frontend_universe.panel.real_games')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-white/15 px-2 py-1 font-mono text-xs text-[#e9f4f8] transition-colors hover:bg-white/10"
                  data-testid="hfu-arcade-game-link"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
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
