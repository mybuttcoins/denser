/**
 * Pure presentation logic for the Basecamp activity rings — the three
 * concentric arcs drawn around each newcomer's reputation score.
 *
 * Ring order, outermost first:
 *   1. Checklist  — Basecamp newcomer tasks completed (1/6 per task).
 *   2. Activity   — how much the account votes and comments, vs. daily targets.
 *   3. Age        — account age; always full, colour encodes the age band.
 *
 * No React and no network here, so the fill/colour rules stay unit-testable
 * and shared by every surface that draws rings.
 */

import { BASECAMP_TASK_IDS } from './protocol';

/** Age bands (in days) that decide the innermost ring's colour. */
export const AGE_BAND_FRESH_MAX_DAYS = 90;
export const AGE_BAND_SETTLING_MAX_DAYS = 180;

/**
 * Daily targets the activity ring fills toward. An account hitting both is at
 * 100%. These are deliberate product targets, not values read from the chain.
 */
export const DAILY_VOTES_TARGET = 10;
export const DAILY_COMMENTS_TARGET = 5;

export const BASECAMP_TASK_COUNT = BASECAMP_TASK_IDS.length;

/**
 * Ring colours. Kept as literal hex rather than Tailwind theme tokens on
 * purpose: Basecamp commits to its own dark palette regardless of the site
 * light/dark theme, so these must not follow the global theme variables.
 */
export const RING_COLORS = {
  ageFresh: '#34D399',
  ageSettling: '#22D3EE',
  ageEstablished: '#D8E2F0',
  activity: '#FB923C',
  checklist: '#B79CFF'
} as const;

/** Empty-track colour, so a 0% ring is still visibly a ring. */
export const RING_TRACK_COLOR = 'rgba(255, 255, 255, 0.10)';

/**
 * Colour for the account-age ring. Newer accounts read as bright green,
 * mid-life accounts aqua, and the oldest band a bright, light grey.
 */
export function ageRingColor(accountAgeDays: number): string {
  if (accountAgeDays <= AGE_BAND_FRESH_MAX_DAYS) return RING_COLORS.ageFresh;
  if (accountAgeDays <= AGE_BAND_SETTLING_MAX_DAYS) return RING_COLORS.ageSettling;
  return RING_COLORS.ageEstablished;
}

function clampFraction(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value > 1 ? 1 : value;
}

/**
 * Activity ring fill: the average of progress toward the vote target and
 * progress toward the comment target, each capped at 100% first so a very
 * heavy voter can't mask the fact that they never comment.
 */
export function activityRingFraction(votesPerDay: number, commentsPerDay: number): number {
  const voteProgress = clampFraction(votesPerDay / DAILY_VOTES_TARGET);
  const commentProgress = clampFraction(commentsPerDay / DAILY_COMMENTS_TARGET);
  return clampFraction((voteProgress + commentProgress) / 2);
}

/** Checklist ring fill: one sixth per completed Basecamp task. */
export function checklistRingFraction(completedTaskCount: number): number {
  return clampFraction(completedTaskCount / BASECAMP_TASK_COUNT);
}
