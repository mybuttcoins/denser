'use client';

import { Button } from '@hive/ui';
import { useTranslation } from '@/blog/i18n/client';
import { useUserClient } from '@smart-signer/lib/auth/use-user-client';
import { useVoteMutation } from '@/blog/features/votes/hooks/use-vote-mutation';

const VoteOnPostButton = ({ author, permlink }: { author: string; permlink: string }) => {
  const { t } = useTranslation('common_blog');
  const { user } = useUserClient();
  const voteMutation = useVoteMutation();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={voteMutation.isLoading}
      onClick={() => voteMutation.mutate({ voter: user.username, author, permlink, weight: 10000 })}
      data-testid="vote-on-post-button"
    >
      {t('basecamp.support_flow.vote_on_this_post')}
    </Button>
  );
};

export default VoteOnPostButton;
