'use client';

import { useState } from 'react';
import { Button } from '@hive/ui';
import { cn } from '@ui/lib/utils';
import { useTranslation } from '@/blog/i18n/client';
import { BASECAMP_PANEL, accentButton } from './lib/theme';
import { useUserClient } from '@smart-signer/lib/auth/use-user-client';
import { useBasecampState } from './hooks/use-basecamp-state';
import { useBasecampGuideOfferMutation } from './hooks/use-basecamp-mutations';
import InterestPicker from './interest-picker';
import SuggestedNewcomers from './suggested-newcomers';
import { MAX_BASECAMP_INTERESTS, type BasecampInterest } from './lib/protocol';

// Not shown to the user — guides don't set a capacity number, we just need
// something sane under the hood for the guide_offer record.
const DEFAULT_GUIDE_CAPACITY = 3;

const GuideOfferFlow = () => {
  const { t } = useTranslation('common_blog');
  const { user } = useUserClient();
  const { state } = useBasecampState(user.username);
  const guideOfferMutation = useBasecampGuideOfferMutation();
  const [selected, setSelected] = useState<BasecampInterest[]>([]);

  const toggleInterest = (interest: BasecampInterest) => {
    setSelected((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : prev.length < MAX_BASECAMP_INTERESTS
          ? [...prev, interest]
          : prev
    );
  };

  if (state.isGuide) {
    return <SuggestedNewcomers guideInterests={state.guideInterests as BasecampInterest[]} />;
  }

  return (
    <div className={cn(BASECAMP_PANEL, 'my-4 flex flex-col gap-3')} data-testid="guide-offer-form">
      <span className="text-sm font-semibold">{t('basecamp.guide_offer_flow.heading')}</span>
      <InterestPicker selected={selected} onToggle={toggleInterest} maxSelected={MAX_BASECAMP_INTERESTS} />
      <Button
        className={cn(accentButton('violet', true), 'w-fit')}
        onClick={() => guideOfferMutation.mutate({ interests: selected, capacity: DEFAULT_GUIDE_CAPACITY })}
        disabled={selected.length === 0 || guideOfferMutation.isLoading}
        data-testid="guide-offer-confirm"
      >
        {t('basecamp.guide_offer_flow.confirm')}
      </Button>
    </div>
  );
};

export default GuideOfferFlow;
