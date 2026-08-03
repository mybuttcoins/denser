'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ui/components/tabs';
import { useTranslation } from '@/blog/i18n/client';
import NewcomerChecklist from './newcomer-checklist';
import NewcomersList from './newcomers-list';
import GuideSignup from './guide-signup';

const Basecamp = () => {
  const { t } = useTranslation('common_blog');

  return (
    <div data-testid="basecamp-page">
      <div className="mt-4 flex items-center justify-between" data-testid="basecamp-header">
        <span className="text-sm font-medium sm:text-xl">{t('basecamp.title')}</span>
      </div>
      <Tabs defaultValue="new" className="mt-4">
        <TabsList>
          <TabsTrigger value="new" data-testid="basecamp-tab-new">
            {t('basecamp.im_new_here')}
          </TabsTrigger>
          <TabsTrigger value="helper" data-testid="basecamp-tab-helper">
            {t('basecamp.im_here_to_help')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="new">
          <NewcomerChecklist />
        </TabsContent>
        <TabsContent value="helper">
          <GuideSignup />
          <NewcomersList />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Basecamp;
