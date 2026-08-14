/**
 * Hive Frontend Universe — user-facing copy, in one place.
 *
 * NOTE: this feature is not yet wired into the locale files (that edit is
 * deliberately deferred until the ship-location decision is made). To keep all
 * user-visible text in ONE spot so it moves cleanly to `t('…')` keys later,
 * every string lives here rather than being inlined across components. This is
 * a temporary shape, not a replacement for i18n.
 */

export const HFU_DISPLAY_NAME = 'Hive Frontend Universe';

export const HFU_COPY = {
  checkingAccount: 'Checking your account…',
  loadingBoard: 'Reading the last thirty minutes of the chain…',
  loadError: 'Could not read the chain right now. Try again shortly.',

  gate: {
    title: HFU_DISPLAY_NAME,
    tooNew: 'This area is for accounts more than a year old.',
    tooNewDetail: (days: number) =>
      `Your account is about ${days} ${days === 1 ? 'day' : 'days'} old. Come back once it passes a year.`,
    loggedOut: 'Log in with an account more than a year old to enter.'
  },

  hud: {
    houses: 'HOUSES',
    window: 'WINDOW'
  },

  card: {
    newcomer: 'NEWCOMER',
    hp: 'HP',
    rep: 'rep',
    votes: 'votes',
    comments: 'comments',
    openPost: 'Open post',
    openProfile: 'Open profile',
    skip: 'Skip'
  }
} as const;
