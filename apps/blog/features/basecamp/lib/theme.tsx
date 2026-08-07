/**
 * Basecamp's local visual identity.
 *
 * NOTE ON THE FILE EXTENSION: this file is `.tsx` despite containing no JSX,
 * and must stay that way. The shared Tailwind config scans
 * `**\/*.{jsx,tsx}` only — a `.ts` file is never read by the JIT, so any class
 * name that lives solely here would silently never be generated and the styles
 * would simply not exist at runtime. Renaming this to `.ts` breaks every
 * colour below without any build error.
 *
 * Basecamp deliberately looks different from the rest of Denser: it commits to
 * one dark, high-contrast palette instead of following the site's light/dark
 * theme tokens. To keep that contained, every colour here is a literal Tailwind
 * arbitrary value rather than a theme variable (`bg-background`, `text-primary`,
 * …). Nothing in this file touches global CSS, so it cannot leak into Posts,
 * Proposals, Witnesses or anywhere else — the styling only exists on elements
 * that opt in by using these strings.
 */

import type { CSSProperties } from 'react';

/** Page shell: the dark slab the whole section sits on. */
export const BASECAMP_SHELL =
  'rounded-2xl p-4 sm:p-6 text-[#E8EDF5] ring-1 ring-inset ring-white/10 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)]';

/**
 * The shell's background lives in an inline style rather than in
 * `BASECAMP_SHELL`. A base colour plus a gradient would need two `bg-*`
 * utilities, and `cn`'s tailwind-merge treats those as conflicting and keeps
 * only the last — which silently left the section transparent over the light
 * page background. An inline style also avoids relying on the JIT to parse a
 * long arbitrary gradient value.
 */
export const BASECAMP_SHELL_STYLE: CSSProperties = {
  backgroundColor: '#0B0F17',
  backgroundImage: 'radial-gradient(120% 120% at 0% 0%, #182236 0%, #0B0F17 55%)'
};

/** Card surface used by feed rows and panels. */
export const BASECAMP_CARD =
  'rounded-xl border border-white/10 bg-white/[0.04] text-[#E8EDF5] shadow-none backdrop-blur-sm transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.07]';

/** Inset panel (checklist, join form, flows) — slightly recessed from cards. */
export const BASECAMP_PANEL = 'rounded-xl border border-white/10 bg-black/25 p-4 text-[#E8EDF5]';

/** Muted body copy on the dark shell. */
export const BASECAMP_MUTED = 'text-[#98A6BC]';

/**
 * Accent colours for buttons and toggles.
 *
 * Each accent is a bright fill paired with a near-black label rather than white
 * text on a mid-tone. That keeps contrast high on every colour in the set — the
 * palette is meant to be playful, but a button nobody can read is not a
 * trade-off worth making.
 */
export type BasecampAccent = 'violet' | 'cyan' | 'amber' | 'emerald' | 'rose';

export const BASECAMP_ACCENTS: readonly BasecampAccent[] = ['violet', 'cyan', 'amber', 'emerald', 'rose'];

/** Solid, high-contrast fill — for the primary action in a given flow. */
export const BASECAMP_ACCENT_SOLID: Record<BasecampAccent, string> = {
  violet:
    'border-0 bg-[#B79CFF] text-[#160B2E] hover:bg-[#C9B4FF] hover:shadow-[0_0_26px_-6px_rgba(183,156,255,0.9)]',
  cyan: 'border-0 bg-[#5EE9D5] text-[#04231F] hover:bg-[#7FF1E1] hover:shadow-[0_0_26px_-6px_rgba(94,233,213,0.9)]',
  amber:
    'border-0 bg-[#FFC24D] text-[#2A1A02] hover:bg-[#FFD275] hover:shadow-[0_0_26px_-6px_rgba(255,194,77,0.9)]',
  emerald:
    'border-0 bg-[#5BE39C] text-[#032315] hover:bg-[#7EEDB3] hover:shadow-[0_0_26px_-6px_rgba(91,227,156,0.9)]',
  rose: 'border-0 bg-[#FF90AE] text-[#2E0713] hover:bg-[#FFAEC3] hover:shadow-[0_0_26px_-6px_rgba(255,144,174,0.9)]'
};

/** Tinted outline — the same accent in a quieter, unselected state. */
export const BASECAMP_ACCENT_OUTLINE: Record<BasecampAccent, string> = {
  violet: 'border border-[#B79CFF]/45 bg-[#B79CFF]/10 text-[#D3C4FF] hover:border-[#B79CFF] hover:bg-[#B79CFF]/20',
  cyan: 'border border-[#5EE9D5]/45 bg-[#5EE9D5]/10 text-[#9DF3E7] hover:border-[#5EE9D5] hover:bg-[#5EE9D5]/20',
  amber: 'border border-[#FFC24D]/45 bg-[#FFC24D]/10 text-[#FFD98C] hover:border-[#FFC24D] hover:bg-[#FFC24D]/20',
  emerald:
    'border border-[#5BE39C]/45 bg-[#5BE39C]/10 text-[#9CEFC4] hover:border-[#5BE39C] hover:bg-[#5BE39C]/20',
  rose: 'border border-[#FF90AE]/45 bg-[#FF90AE]/10 text-[#FFBACC] hover:border-[#FF90AE] hover:bg-[#FF90AE]/20'
};

/** Small solid swatch of an accent — used as a bullet/marker. */
export const BASECAMP_ACCENT_DOT: Record<BasecampAccent, string> = {
  violet: 'bg-[#B79CFF]',
  cyan: 'bg-[#5EE9D5]',
  amber: 'bg-[#FFC24D]',
  emerald: 'bg-[#5BE39C]',
  rose: 'bg-[#FF90AE]'
};

/** Shared geometry for every accent button, so only colour varies between them. */
export const BASECAMP_BUTTON_SHAPE =
  'rounded-full px-4 font-medium transition-all duration-200 disabled:opacity-40 disabled:hover:shadow-none';

/** Convenience: a full solid/outline accent button class string. */
export function accentButton(accent: BasecampAccent, selected: boolean): string {
  return `${BASECAMP_BUTTON_SHAPE} ${selected ? BASECAMP_ACCENT_SOLID[accent] : BASECAMP_ACCENT_OUTLINE[accent]}`;
}

/** Interactive text link. */
export const BASECAMP_LINK = 'text-[#E8EDF5] transition-colors hover:text-[#B79CFF]';

/** Tab strip container. */
export const BASECAMP_TABS_LIST =
  'h-auto gap-1 rounded-full border border-white/10 bg-black/30 p-1 text-[#98A6BC]';

/**
 * Individual tab trigger.
 *
 * The `data-[state=active]:` entries exist to displace the shared
 * TabsTrigger's own `data-[state=active]:bg-background` /
 * `:text-foreground` through tailwind-merge — without them the light theme
 * colours would win whenever a tab is active.
 */
export const BASECAMP_TAB_TRIGGER =
  'rounded-full px-4 py-1.5 text-sm font-medium text-[#98A6BC] transition-all hover:text-[#E8EDF5] data-[state=active]:bg-[#B79CFF] data-[state=active]:text-[#0B0F17]';

/**
 * Active tab colours, applied from React state. Driving the visible styling
 * from state rather than relying solely on the data-variant keeps it working
 * regardless of how the variant utilities are ordered against the shared
 * component's own defaults.
 */
export const BASECAMP_TAB_TRIGGER_ACTIVE =
  'bg-[#B79CFF] text-[#0B0F17] shadow-[0_0_20px_-4px_rgba(183,156,255,0.7)] hover:text-[#0B0F17]';

/** Skeleton placeholder tuned for the dark shell. */
export const BASECAMP_SKELETON = 'bg-white/10';
