'use client';

import { useState } from 'react';
import FollowButton from '@/blog/features/mute-follow/follow-button';
import { useFollowMutation } from '@/blog/features/mute-follow/hooks/use-follow-mutations';

const FollowNewcomerButton = ({ username }: { username: string }) => {
  const followMutation = useFollowMutation();
  const [followed, setFollowed] = useState(false);

  return (
    <FollowButton
      variant="outline"
      loading={followMutation.isLoading}
      isFollow={followed}
      onClick={() => {
        followMutation.mutate(
          { username },
          {
            onSuccess: () => setFollowed(true)
          }
        );
      }}
    />
  );
};

export default FollowNewcomerButton;
