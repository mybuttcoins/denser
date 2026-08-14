'use client';

/**
 * Hive Frontend Universe — on-screen controls.
 *
 * Joystick ring bottom left, HOP button bottom right, MAP button above HOP.
 * MAP is press-and-hold: hold to pull out to the whole world, release to snap
 * back. All three mirror the keyboard (arrows/WASD, space, held M).
 */

import { useRef, useState } from 'react';

export interface ControlsLabels {
  hop: string;
  map: string;
}

export interface ControlsProps {
  labels: ControlsLabels;
  /** Steering vector, each axis -1..1. Called with (0,0) on release. */
  onVector: (x: number, y: number) => void;
  onHop: () => void;
  /** Held MAP: peek at the world while pressed. */
  onMapHold: (held: boolean) => void;
  /** Tapped MAP (a quick press): toggle the full travel map. */
  onMapTap: () => void;
}

const RING = 116;
const KNOB = 46;
/** Presses shorter than this are taps; longer are holds. */
const TAP_MS = 250;

export const Controls = ({ labels, onVector, onHop, onMapHold, onMapTap }: ControlsProps) => {
  const ringRef = useRef<HTMLDivElement>(null);
  const mapDownAt = useRef(0);
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });

  const steer = (clientX: number, clientY: number) => {
    const el = ringRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const d = Math.hypot(dx, dy);
    const max = RING / 2 - KNOB / 3;
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    setKnob({ x: dx, y: dy, active: true });
    onVector(dx / max, dy / max);
  };
  const release = () => {
    setKnob({ x: 0, y: 0, active: false });
    onVector(0, 0);
  };

  return (
    <>
      {/* Joystick, bottom left */}
      <div
        ref={ringRef}
        data-testid="hfu-joystick"
        className="pointer-events-auto absolute bottom-5 left-5 select-none rounded-full border-2 border-[#5df0ff]/40 bg-white/[0.03] touch-none"
        style={{ width: RING, height: RING }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          steer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) steer(e.clientX, e.clientY);
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <div
          className="absolute rounded-full bg-[#5df0ff]/70"
          style={{
            width: KNOB,
            height: KNOB,
            left: RING / 2 - KNOB / 2 + knob.x,
            top: RING / 2 - KNOB / 2 + knob.y,
            opacity: knob.active ? 0.9 : 0.45,
            transition: knob.active ? 'none' : 'left 120ms, top 120ms'
          }}
        />
      </div>

      {/* MAP (hold), above HOP, bottom right */}
      <button
        type="button"
        data-testid="hfu-map-button"
        className="pointer-events-auto absolute bottom-[132px] right-6 h-14 w-14 select-none rounded-full border-2 border-[#8fd8e4]/50 bg-white/[0.03] font-mono text-xs font-bold text-[#8fd8e4] active:bg-[#8fd8e4]/20 touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          mapDownAt.current = Date.now();
          onMapHold(true);
        }}
        onPointerUp={() => {
          onMapHold(false);
          if (Date.now() - mapDownAt.current < TAP_MS) onMapTap();
        }}
        onPointerCancel={() => onMapHold(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {labels.map}
      </button>

      {/* HOP, bottom right */}
      <button
        type="button"
        data-testid="hfu-hop-button"
        className="pointer-events-auto absolute bottom-5 right-5 h-[92px] w-[92px] select-none rounded-full border-2 border-[#5df0ff]/50 bg-white/[0.03] font-mono text-sm font-bold text-[#5df0ff] active:bg-[#5df0ff]/20 touch-none"
        onPointerDown={onHop}
        onContextMenu={(e) => e.preventDefault()}
      >
        {labels.hop}
      </button>
    </>
  );
};
