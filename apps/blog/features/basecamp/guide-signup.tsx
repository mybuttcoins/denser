'use client';

import { useState } from 'react';
import { Button } from '@hive/ui';
import { Input } from '@ui/components/input';
import { useTranslation } from '@/blog/i18n/client';
import { useUserClient } from '@smart-signer/lib/auth/use-user-client';
import { useBasecampState } from './hooks/use-basecamp-state';
import { useBasecampGuideOfferMutation } from './hooks/use-basecamp-mutations';

const DEFAULT_CAPACITY = 3;

const GuideSignup = () => {
  const { t } = useTranslation('common_blog');
  const { user } = useUserClient();
  const { state } = useBasecampState(user.username);
  const guideOfferMutation = useBasecampGuideOfferMutation();
  const [interestsInput, setInterestsInput] = useState('');
  const [capacity, setCapacity] = useState(DEFAULT_CAPACITY);

  if (state.isGuide) {
    return (
      <div className="my-4 rounded-lg border bg-background p-4 text-sm" data-testid="guide-signup-active">
        {t('basecamp.guide_signup.already_guide', { capacity: state.guideCapacity ?? 0 })}
      </div>
    );
  }

  const handleSubmit = () => {
    const interests = interestsInput
      .split(',')
      .map((interest) => interest.trim())
      .filter(Boolean);
    guideOfferMutation.mutate({ interests, capacity });
  };

  return (
    <div className="my-4 flex flex-col gap-3 rounded-lg border bg-background p-4" data-testid="guide-signup-form">
      <span className="text-sm font-medium">{t('basecamp.guide_signup.heading')}</span>
      <Input
        placeholder={t('basecamp.guide_signup.interests_placeholder')}
        value={interestsInput}
        onChange={(e) => setInterestsInput(e.target.value)}
        data-testid="guide-signup-interests"
      />
      <Input
        type="number"
        min={1}
        aria-label={t('basecamp.guide_signup.capacity_label')}
        value={capacity}
        onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))}
        data-testid="guide-signup-capacity"
      />
      <Button onClick={handleSubmit} disabled={guideOfferMutation.isLoading} data-testid="guide-signup-submit">
        {t('basecamp.guide_signup.submit')}
      </Button>
    </div>
  );
};

export default GuideSignup;
