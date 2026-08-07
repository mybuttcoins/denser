'use client';

import { useInView } from 'react-intersection-observer';
import { accountReputation } from '@hive/ui';
import { useTranslation } from '@/blog/i18n/client';
import { useAccountActivity } from './hooks/use-account-activity';
import { useBasecampState } from './hooks/use-basecamp-state';
import {
  ageRingColor,
  activityRingFraction,
  checklistRingFraction,
  BASECAMP_TASK_COUNT,
  RING_COLORS,
  RING_TRACK_COLOR
} from './lib/rings';

// Geometry is authored against a fixed 64px viewBox; the `size` prop only
// changes the rendered width/height, so the SVG scales without recomputing radii.
const SIZE = 64;
const CENTER = SIZE / 2;
const STROKE = 5.5;
// Outermost first. Radii are spaced by stroke + a 1.5px gutter so the arcs read
// as three distinct rings rather than one thick band.
const RADIUS_CHECKLIST = 26;
const RADIUS_ACTIVITY = 19;
const RADIUS_AGE = 12;

interface RingProps {
  radius: number;
  color: string;
  /** 0–1. Rendered as a track-only ring at 0 so an empty ring is still visible. */
  fraction: number;
}

const Ring = ({ radius, color, fraction }: RingProps) => {
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * Math.min(Math.max(fraction, 0), 1);

  return (
    <>
      <circle cx={CENTER} cy={CENTER} r={radius} fill="none" stroke={RING_TRACK_COLOR} strokeWidth={STROKE} />
      {filled > 0 ? (
        <circle
          cx={CENTER}
          cy={CENTER}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          // Start each arc at 12 o'clock instead of 3 o'clock.
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      ) : null}
    </>
  );
};

interface ActivityRingsProps {
  username: string;
  reputation: number;
  accountAgeDays: number;
  /** Rendered diameter in px. Defaults to the feed's full-size rings. */
  size?: number;
  /**
   * Test id for the centred reputation score. Each card kept the id it used
   * before the number moved inside the rings.
   */
  reputationTestId?: string;
}

/**
 * The three concentric rings drawn around a newcomer's reputation score:
 * checklist progress (outer), chain activity (middle), account age (inner).
 *
 * Chain data is only requested once the rings scroll into view, so a long feed
 * doesn't fire a lookup per card up front.
 */
const ActivityRings = ({
  username,
  reputation,
  accountAgeDays,
  size = SIZE,
  reputationTestId = 'newcomer-reputation'
}: ActivityRingsProps) => {
  const { t } = useTranslation('common_blog');
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: '200px' });

  const { activity, status } = useAccountActivity(username, inView);
  const { state: basecampState } = useBasecampState(inView ? username : '');

  const completedTaskCount = basecampState.completedTasks.length;
  const activityFraction =
    status === 'ready' ? activityRingFraction(activity.votesPerDay, activity.commentsPerDay) : 0;
  const checklistFraction = checklistRingFraction(completedTaskCount);

  // Only claim rates once they've actually been measured. Before that the ring
  // shows its empty track, and the label says so rather than reporting 0/day.
  const label =
    status === 'ready'
      ? t('basecamp.rings.summary', {
          days: accountAgeDays,
          votes: activity.votesPerDay.toFixed(1),
          comments: activity.commentsPerDay.toFixed(1),
          done: completedTaskCount,
          total: BASECAMP_TASK_COUNT
        })
      : t('basecamp.rings.summary_activity_unknown', {
          days: accountAgeDays,
          done: completedTaskCount,
          total: BASECAMP_TASK_COUNT
        });

  return (
    <div
      ref={ref}
      className="relative shrink-0"
      style={{ width: size, height: size }}
      title={label}
      data-testid="newcomer-activity-rings"
      data-checklist-fraction={checklistFraction.toFixed(3)}
      data-activity-fraction={activityFraction.toFixed(3)}
      data-activity-status={status}
    >
      <svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label}>
        <Ring radius={RADIUS_CHECKLIST} color={RING_COLORS.checklist} fraction={checklistFraction} />
        <Ring radius={RADIUS_ACTIVITY} color={RING_COLORS.activity} fraction={activityFraction} />
        {/* Account age is a state, not progress — the inner ring is always full
            and encodes the age band through its colour. */}
        <Ring radius={RADIUS_AGE} color={ageRingColor(accountAgeDays)} fraction={1} />
      </svg>
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center font-semibold tabular-nums text-[#E8EDF5]"
        style={{ fontSize: Math.round(size * 0.172) }}
        data-testid={reputationTestId}
      >
        {accountReputation(reputation)}
      </span>
    </div>
  );
};

export default ActivityRings;
