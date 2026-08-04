'use client';

import { useState } from 'react';
import { Button } from '@hive/ui';
import { useTranslation } from '@/blog/i18n/client';
import GuideOfferFlow from './guide-offer-flow';
import SupportFlow from './support-flow';

type HelpMode = 'guide' | 'support' | null;

const HelpView = () => {
  const { t } = useTranslation('common_blog');
  const [mode, setMode] = useState<HelpMode>(null);

  return (
    <div data-testid="help-view">
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant={mode === 'guide' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode((prev) => (prev === 'guide' ? null : 'guide'))}
          data-testid="help-mode-guide-button"
        >
          {t('basecamp.help_view.offer_to_guide')}
        </Button>
        <Button
          variant={mode === 'support' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode((prev) => (prev === 'support' ? null : 'support'))}
          data-testid="help-mode-support-button"
        >
          {t('basecamp.help_view.im_here_to_browse')}
        </Button>
      </div>
      {mode === 'guide' ? <GuideOfferFlow /> : null}
      {mode === 'support' ? <SupportFlow /> : null}
    </div>
  );
};

export default HelpView;
