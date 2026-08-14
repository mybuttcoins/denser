'use client';

/**
 * Standalone entry point for Hive Frontend Universe.
 *
 * Client-only dynamic import so the heavy canvas module is code-split and never
 * loads until this page is opened. This route is purely additive — it does not
 * wire the feature into Basecamp or anything else, so it does not pre-decide
 * where (or whether) the feature ships.
 */

import dynamic from 'next/dynamic';

const HiveFrontendUniverse = dynamic(() => import('@/blog/features/hive-frontend-universe'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#04060a] text-sm text-[#8fa6b4]">
      Loading…
    </div>
  )
});

export default function HiveFrontendUniversePage() {
  return (
    <div className="fixed inset-0 h-[100dvh] w-full overflow-hidden bg-[#04060a]">
      <HiveFrontendUniverse />
    </div>
  );
}
