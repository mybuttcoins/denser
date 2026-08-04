'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ui/components/tabs';
import { useTranslation } from '@/blog/i18n/client';
import NewHereView from './new-here-view';
import HelpView from './help-view';
import NewcomersList from './newcomers-list';

const Basecamp = () => {
  const { t } = useTranslation('common_blog');
  // No tab is active until the user explicitly picks one — the tab-specific
  // panels (checklist, interest picker, guide/browse flows) stay hidden until
  // then. The feed itself is rendered unconditionally below and always shows.
  const [activeTab, setActiveTab] = useState('');

  return (
    <div data-testid="basecamp-page">
      <div className="mt-4 flex items-center justify-between" data-testid="basecamp-header">
        <span className="text-sm font-medium sm:text-xl">{t('basecamp.title')}</span>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
        <TabsList>
          <TabsTrigger value="new" data-testid="basecamp-tab-new">
            {t('basecamp.im_new_here')}
          </TabsTrigger>
          <TabsTrigger value="helper" data-testid="basecamp-tab-helper">
            {t('basecamp.im_here_to_help')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="new">
          <NewHereView />
        </TabsContent>
        <TabsContent value="helper">
          <HelpView />
        </TabsContent>
      </Tabs>
      <NewcomersList />
    </div>
  );
};

export default Basecamp;
