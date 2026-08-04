'use client';

import { useState } from 'react';
import { Button } from '@hive/ui';
import { useTranslation } from '@/blog/i18n/client';
import NewcomerChecklist from './newcomer-checklist';
import JoinInterests from './join-interests';

const NewHereView = () => {
  const { t } = useTranslation('common_blog');
  const [showChecklist, setShowChecklist] = useState(false);

  return (
    <div data-testid="new-here-view">
      <div className="mt-4 flex items-center justify-start">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowChecklist((prev) => !prev)}
          data-testid="my-checklist-button"
        >
          {t('basecamp.new_here.my_checklist_button')}
        </Button>
      </div>
      {showChecklist ? <NewcomerChecklist /> : null}
      <JoinInterests />
    </div>
  );
};

export default NewHereView;
