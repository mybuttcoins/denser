'use client';

import { Checkbox } from '@ui/components/checkbox';
import { useTranslation } from '@/blog/i18n/client';
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
    <ul className="my-4 flex flex-col gap-3" data-testid="newcomer-checklist">
      {BASECAMP_TASK_IDS.map((task) => {
        const done = state.completedTasks.includes(task);
        const pending = taskMutation.isLoading && taskMutation.variables?.task === task;
        return (
          <li key={task} className="flex items-center gap-3">
            <Checkbox
              id={`checklist-${task}`}
              checked={done}
              disabled={done || pending}
              onCheckedChange={() => handleToggle(task, done)}
              data-testid={`checklist-item-${task}`}
            />
            <label
              htmlFor={`checklist-${task}`}
              className={done ? 'cursor-pointer text-primary/50 line-through' : 'cursor-pointer'}
            >
              {t(`basecamp.newcomer_checklist.${task}`)}
            </label>
          </li>
        );
      })}
    </ul>
  );
};

export default NewcomerChecklist;
