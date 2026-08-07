'use client';

import { Badge } from '@ui/components/badge';
import { cn } from '@ui/lib/utils';
import { useTranslation } from '@/blog/i18n/client';
import { BASECAMP_INTERESTS, type BasecampInterest } from './lib/protocol';
import { BASECAMP_ACCENTS, BASECAMP_ACCENT_SOLID, BASECAMP_ACCENT_OUTLINE } from './lib/theme';

const InterestPicker = ({
  selected,
  onToggle,
  maxSelected
}: {
  selected: BasecampInterest[];
  onToggle: (interest: BasecampInterest) => void;
  maxSelected: number;
}) => {
  const { t } = useTranslation('common_blog');

  return (
    <div className="flex flex-wrap gap-1.5" data-testid="interest-chips">
      {BASECAMP_INTERESTS.map((interest, index) => {
        const isSelected = selected.includes(interest);
        const disabled = !isSelected && selected.length >= maxSelected;
        // Cycle the accents so the chip row reads as a varied set rather than
        // a block of one colour. Index-based, so a given interest keeps its
        // colour between renders.
        const accent = BASECAMP_ACCENTS[index % BASECAMP_ACCENTS.length];
        return (
          <Badge
            key={interest}
            variant={isSelected ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all',
              isSelected ? BASECAMP_ACCENT_SOLID[accent] : BASECAMP_ACCENT_OUTLINE[accent],
              { 'cursor-not-allowed opacity-40': disabled }
            )}
            onClick={() => {
              if (disabled) return;
              onToggle(interest);
            }}
            data-testid={`interest-chip-${interest}`}
          >
            {t(`basecamp.interest_picker.interests.${interest}`)}
          </Badge>
        );
      })}
    </div>
  );
};

export default InterestPicker;
