'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ui/components/tabs';
import { cn } from '@ui/lib/utils';
import { useTranslation } from '@/blog/i18n/client';
import NewHereView from './new-here-view';
import HelpView from './help-view';
import NewcomersList from './newcomers-list';
import RingsLegend from './rings-legend';
import {
  BASECAMP_SHELL,
  BASECAMP_SHELL_STYLE,
  BASECAMP_MUTED,
  BASECAMP_TABS_LIST,
  BASECAMP_TAB_TRIGGER,
  BASECAMP_TAB_TRIGGER_ACTIVE
} from './lib/theme';

const Basecamp = () => {
  const { t } = useTranslation('common_blog');
  // No tab is active until the user explicitly picks one — the tab-specific
  // panels (checklist, interest picker, guide/browse flows) stay hidden until
  // then. The feed itself is rendered unconditionally below and always shows.
  const [activeTab, setActiveTab] = useState('');

  return (
    <div className={cn(BASECAMP_SHELL, 'my-4')} style={BASECAMP_SHELL_STYLE} data-testid="basecamp-page">
      <div className="flex flex-col gap-1" data-testid="basecamp-header">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#34D399] shadow-[0_0_12px_2px_rgba(52,211,153,0.7)]" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('basecamp.title')}</h1>
        </div>
        <p className={cn(BASECAMP_MUTED, 'text-sm')}>{t('basecamp.subtitle')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-5">
        <TabsList className={BASECAMP_TABS_LIST}>
          <TabsTrigger
            value="new"
            className={cn(BASECAMP_TAB_TRIGGER, activeTab === 'new' && BASECAMP_TAB_TRIGGER_ACTIVE)}
            data-testid="basecamp-tab-new"
          >
            {t('basecamp.im_new_here')}
          </TabsTrigger>
          <TabsTrigger
            value="helper"
            className={cn(BASECAMP_TAB_TRIGGER, activeTab === 'helper' && BASECAMP_TAB_TRIGGER_ACTIVE)}
            data-testid="basecamp-tab-helper"
          >
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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#98A6BC]">
          {t('basecamp.newcomers_list.heading')}
        </h2>
        <RingsLegend />
      </div>
      <NewcomersList />
    </div>
  );
};

export default Basecamp;
