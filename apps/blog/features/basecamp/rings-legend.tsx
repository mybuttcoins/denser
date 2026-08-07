'use client';

import { useTranslation } from '@/blog/i18n/client';
import { RING_COLORS } from './lib/rings';

/**
 * Small colour key for the activity rings. Without it the three arcs are
 * decorative; with it they're readable at a glance.
 */
const RingsLegend = () => {
  const { t } = useTranslation('common_blog');

  const items = [
    { color: RING_COLORS.checklist, label: t('basecamp.rings.legend_checklist') },
    { color: RING_COLORS.activity, label: t('basecamp.rings.legend_activity') },
    { color: RING_COLORS.ageFresh, label: t('basecamp.rings.legend_age') }
  ];

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5" data-testid="basecamp-rings-legend">
      {items.map(({ color, label }) => (
        <li key={label} className="flex items-center gap-1.5 text-xs text-[#98A6BC]">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full border-2"
            style={{ borderColor: color }}
            aria-hidden="true"
          />
          {label}
        </li>
      ))}
    </ul>
  );
};

export default RingsLegend;
