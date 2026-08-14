'use client';

/**
 * Hive Frontend Universe — module root.
 *
 * The age gate runs FIRST. When the player is under a year old (or logged out)
 * the map is never mounted: no canvas, no fetch, no board build, nothing loads
 * behind the message. Only the `allowed` branch renders <CanvasMap/>, which is
 * the only place `useBoard` is called.
 */

import CanvasMap from './engine/canvas-map';
import { useAgeGate } from './hooks/use-age-gate';
import { HFU_COPY } from './lib/strings';

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="relative h-full min-h-[520px] w-full overflow-hidden bg-[#04060a]">{children}</div>
);

const GateMessage = ({ title, lines }: { title: string; lines: string[] }) => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center">
    <span className="font-mono text-lg font-bold text-[#e9f4f8]">{title}</span>
    {lines.map((line, i) => (
      <span key={i} className="max-w-sm text-sm text-[#8fa6b4]">
        {line}
      </span>
    ))}
  </div>
);

const HiveFrontendUniverse = () => {
  const gate = useAgeGate();

  if (gate.status === 'loading') {
    return (
      <Shell>
        <div className="flex h-full w-full items-center justify-center p-6 text-sm text-[#8fa6b4]">
          {HFU_COPY.checkingAccount}
        </div>
      </Shell>
    );
  }

  if (gate.status === 'blocked-logged-out') {
    return (
      <Shell>
        <GateMessage title={HFU_COPY.gate.title} lines={[HFU_COPY.gate.loggedOut]} />
      </Shell>
    );
  }

  if (gate.status === 'blocked-newcomer') {
    return (
      <Shell>
        <GateMessage
          title={HFU_COPY.gate.title}
          lines={[HFU_COPY.gate.tooNew, gate.ageDays !== null ? HFU_COPY.gate.tooNewDetail(gate.ageDays) : '']}
        />
      </Shell>
    );
  }

  // Allowed: only now is the map (and its fetch) mounted.
  return (
    <Shell>
      <CanvasMap />
    </Shell>
  );
};

export default HiveFrontendUniverse;
