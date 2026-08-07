'use client';

import { Checkbox } from '@ui/components/checkbox';
import { cn } from '@ui/lib/utils';
import { useTranslation } from '@/blog/i18n/client';
import { BASECAMP_PANEL, BASECAMP_MUTED } from './lib/theme';
import { useUserClient } from '@smart-signer/lib/auth/use-user-client';
import { useBasecampState } from './hooks/use-basecamp-state';
import { useBasecampTaskMutation } from './hooks/use-basecamp-mutations';
import { BASECAMP_TASK_IDS, type BasecampTaskId } from './lib/protocol';

const NewcomerChecklist = () => {
  const { t } = useTranslation('common_blog');
  const { user } = useUserClient();
  const { state } = useBasecampState(user.username);
  const taskMutation = useBasecampTaskMutation();

  const handleToggle = (task: BasecampTaskId, alreadyDone: boolean) => {
    // Tasks are one-way completions on-chain — there is no "uncomplete" action.
    if (alreadyDone) return;
    taskMutation.mutate({ task });
  };

  return (
    <div className={cn(BASECAMP_PANEL, 'my-4')} data-testid="newcomer-checklist">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{t('basecamp.newcomer_checklist.heading')}</span>
        <span className={cn(BASECAMP_MUTED, 'text-xs tabular-nums')}>
          {t('basecamp.rings.progress', {
            done: state.completedTasks.length,
            total: BASECAMP_TASK_IDS.length
          })}
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {BASECAMP_TASK_IDS.map((task) => {
          const done = state.completedTasks.includes(task);
          const pending = taskMutation.isLoading && taskMutation.variables?.task === task;
          return (
            <li key={task} className="flex items-center gap-3 text-sm">
              <Checkbox
                id={`checklist-${task}`}
                checked={done}
                disabled={done || pending}
                onCheckedChange={() => handleToggle(task, done)}
                // Driven from `done` rather than a data-[state=checked]
                // variant so the checked colours don't depend on variant
                // ordering against the shared Checkbox's own defaults.
                className={cn(
                  'border-white/30',
                  done && 'border-[#B79CFF] bg-[#B79CFF] text-[#0B0F17]'
                )}
                data-testid={`checklist-item-${task}`}
              />
              <label
                htmlFor={`checklist-${task}`}
                className={done ? cn(BASECAMP_MUTED, 'cursor-pointer line-through') : 'cursor-pointer'}
              >
                {t(`basecamp.newcomer_checklist.${task}`)}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default NewcomerChecklist;
