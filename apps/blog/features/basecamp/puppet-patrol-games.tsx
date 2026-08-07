'use client';

import { useState } from 'react';
import { Button } from '@hive/ui';
import { cn } from '@ui/lib/utils';
import { useTranslation } from '@/blog/i18n/client';
import { BASECAMP_MUTED, accentButton } from './lib/theme';
import { BASECAMP_GAMES } from './games/registry';

/**
 * The Puppet Patrol Games section: one coloured button per game, and the
 * selected game's own component rendered underneath.
 *
 * Buttons and panels both come from BASECAMP_GAMES, so adding a game to that
 * list is all it takes to add it here.
 */
const PuppetPatrolGames = () => {
  const { t } = useTranslation('common_blog');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const selectedGame = BASECAMP_GAMES.find((game) => game.id === selectedGameId) ?? null;

  return (
    <div className="my-4" data-testid="puppet-patrol-games">
      <span className="text-sm font-semibold">{t('basecamp.games.heading')}</span>
      <p className={cn(BASECAMP_MUTED, 'mt-1 text-sm')}>{t('basecamp.games.subheading')}</p>

      <div className="mt-3 flex flex-wrap gap-2" data-testid="puppet-patrol-games-list">
        {BASECAMP_GAMES.map((game) => {
          const isSelected = game.id === selectedGameId;
          return (
            <Button
              key={game.id}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              className={cn(accentButton(game.accent, isSelected))}
              onClick={() => setSelectedGameId((prev) => (prev === game.id ? null : game.id))}
              data-testid={`puppet-patrol-game-${game.id}`}
            >
              {t(`basecamp.games.titles.${game.titleKey}`)}
            </Button>
          );
        })}
      </div>

      {selectedGame ? <selectedGame.Component /> : null}
    </div>
  );
};

export default PuppetPatrolGames;
