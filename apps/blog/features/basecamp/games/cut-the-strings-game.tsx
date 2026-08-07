'use client';

import { useTranslation } from '@/blog/i18n/client';
import GameComingSoon from './game-coming-soon';

/**
 * Cut the Strings.
 *
 * Not playable yet. To ship the real game, replace the <GameComingSoon /> below
 * with the gameplay — the registry entry, the section layout and the selection
 * logic all stay exactly as they are.
 */
const CutTheStringsGame = () => {
  const { t } = useTranslation('common_blog');
  return <GameComingSoon title={t('basecamp.games.titles.cut_the_strings')} accent="rose" />;
};

export default CutTheStringsGame;
