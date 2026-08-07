'use client';

import { useState } from 'react';
import { Button } from '@hive/ui';
import { cn } from '@ui/lib/utils';
import { useTranslation } from '@/blog/i18n/client';
import { BASECAMP_PANEL, accentButton } from './lib/theme';
import { useUserClient } from '@smart-signer/lib/auth/use-user-client';
import { useBasecampState } from './hooks/use-basecamp-state';
import { useBasecampJoinMutation } from './hooks/use-basecamp-mutations';
import InterestPicker from './interest-picker';
import { MAX_BASECAMP_INTERESTS, type BasecampInterest } from './lib/protocol';

const JoinInterests = () => {
  const { t } = useTranslation('common_blog');
  const { user } = useUserClient();
  const { state } = useBasecampState(user.username);
  const joinMutation = useBasecampJoinMutation();
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

  if (state.joined) {
    return (
      <div className={cn(BASECAMP_PANEL, 'my-4 text-sm')} data-testid="join-interests-joined">
        {t('basecamp.interest_picker.already_joined', { interests: state.interests.join(', ') })}
      </div>
    );
  }

  return (
    <div className={cn(BASECAMP_PANEL, 'my-4 flex flex-col gap-3')} data-testid="join-interests-form">
      <span className="text-sm font-semibold">{t('basecamp.interest_picker.heading')}</span>
      <InterestPicker selected={selected} onToggle={toggleInterest} maxSelected={MAX_BASECAMP_INTERESTS} />
      <Button
        className={cn(accentButton('emerald', true), 'w-fit')}
        onClick={() => joinMutation.mutate({ interests: selected })}
        disabled={selected.length === 0 || joinMutation.isLoading}
        data-testid="join-interests-confirm"
      >
        {t('basecamp.interest_picker.confirm')}
      </Button>
    </div>
  );
};

export default JoinInterests;
