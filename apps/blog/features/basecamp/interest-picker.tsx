'use client';

import { Badge } from '@ui/components/badge';
import { cn } from '@ui/lib/utils';
import { useTranslation } from '@/blog/i18n/client';
import { BASECAMP_INTERESTS, type BasecampInterest } from './lib/protocol';

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
      {BASECAMP_INTERESTS.map((interest) => {
        const isSelected = selected.includes(interest);
        const disabled = !isSelected && selected.length >= maxSelected;
        return (
          <Badge
            key={interest}
            variant={isSelected ? 'default' : 'outline'}
            className={cn('cursor-pointer text-xs font-normal transition-colors', {
              'cursor-not-allowed opacity-50': disabled
            })}
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
