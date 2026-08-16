'use client';

/**
 * Hive Frontend Universe — the stage.
 *
 * Loads the board (cache-first, untouched), builds the world (mesh woven
 * around the permanent field landmarks, rim worlds on the edge), then runs
 * the frame loop: input, movement along the wobbled lines, operation flows
 * painted from the window's real counts, scenery, camera, draw.
 *
 * MAP is one button, two gestures: HOLD to peek at the whole world and snap
 * back on release; TAP to open the full travel map, which stays open — pick
 * a fixed landmark and the bug warps there (position stays edge + t, so the
 * map and the world can never disagree about where the bug is). Posts cannot
 * be travelled to this way, only fixed places.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/blog/i18n/client';
import { useBoard } from '../hooks/use-board';
import { useCommunities } from '../hooks/use-communities';
import { HFU_COPY } from '../lib/strings';
import { TIERS, type Board } from '../lib/board';
import { WORLD, LANDMARKS, LANDMARK_ACCOUNTS } from '../lib/fixed-world';
import { buildRoutes, POST_LINE_ID, DAPPS_LINE_ID } from '../lib/routes';
import { buildWorld, type GameWorld } from './world';
import { createCritters, updateCritters, type CritterState } from './critters';
import { buildGround } from './ground';
import { requestAvatar, avatarStats } from './avatars';
import { getUserAvatarUrl } from '@ui/lib/avatar-utils';
import {
  createPlayer,
  driftUpdate,
  jump,
  placeAt,
  railUpdate,
  type PlayerState,
  type Vec2
} from './movement';
import {
  drawScene,
  PALETTE,
  type Camera,
  type CommunityVisual,
  type HouseVisual,
  type LandmarkVisual,
  type RouteLayer,
  type TrafficMarker
} from './render';
import { placeFactories, placeCubes } from './scenery';
import { createFlows, updateFlows, flowConfig, type FlowState } from './particles';
import { Controls } from './controls';
import { HouseCard } from '../card/house-card';
import { LandmarkPanel } from '../card/landmark-panel';
import type { TopCommunity } from '../data/fetch-communities';

const MAX_TRAFFIC = 30;
/** Presses shorter than this are taps (keyboard M mirror of the button). */
const TAP_MS = 250;

/** Panel accent per landmark category, matching the map's colour language. */
const CATEGORY_ACCENT: Record<string, string> = {
  tool: 'cyan',
  dapp: 'amber',
  governance: 'violet',
  info: 'emerald',
  arcade: 'rose',
  social: 'cyan'
};

const CanvasMap = () => {
  const { data: board, isLoading, isError } = useBoard();

  if (isLoading) return <Centered>{HFU_COPY.loadingBoard}</Centered>;
  if (isError || !board) return <Centered>{HFU_COPY.loadError}</Centered>;
  return <Stage board={board} />;
};

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-full w-full items-center justify-center bg-[#04030a] p-6 text-center text-sm text-[#8fa6b4]">
    {children}
  </div>
);

const Stage = ({ board }: { board: Board }) => {
  const { t } = useTranslation('common_blog');
  const { data: communities } = useCommunities();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [atNode, setAtNode] = useState(-1);
  /** A house opened by clicking/tapping its marker (bigger than the marker). */
  const [clickedNode, setClickedNode] = useState(-1);
  const [fullMap, setFullMap] = useState(false);
  /** Slot of the community bubble the bug is standing in, or -1 for none. */
  const [inCommunity, setInCommunity] = useState(-1);

  const world: GameWorld = useMemo(
    () => buildWorld(board.windowStart, board.houses.length),
    [board]
  );
  // The routes seam: named edge-id lists riding ON the mesh, no new geometry.
  const routes = useMemo(() => buildRoutes(world), [world]);
  // The transit map: the flagship post line laid first and solid, then the
  // dApps line dashed on top so shared track reads as two services rather
  // than as one line hiding the other.
  const routeLayers: RouteLayer[] = useMemo(() => {
    const byId = (id: string) => new Set(routes.find((r) => r.id === id)?.edgeIds ?? []);
    return [
      {
        edges: byId(POST_LINE_ID),
        casing: '#1a0d05',
        glow: PALETTE.routeGlow,
        core: PALETTE.route,
        width: 6.8
      },
      {
        edges: byId(DAPPS_LINE_ID),
        casing: '#04141c',
        glow: PALETTE.dappsGlow,
        core: PALETTE.dapps,
        width: 4.2,
        dash: [30, 22]
      }
    ];
  }, [routes]);
  // The ground: filled landmasses, built ONCE per window and then only filled.
  const ground = useMemo(() => buildGround(board.windowStart), [board.windowStart]);

  const houseVisuals: (HouseVisual | undefined)[] = useMemo(
    () =>
      board.houses.map((h) => ({
        tier: h.tier,
        isNewcomer: h.isNewcomer,
        bubble: h.bubble,
        glow: h.glow,
        handle: h.handle
      })),
    [board]
  );
  const landmarkVisuals: LandmarkVisual[] = useMemo(
    () =>
      LANDMARKS.map((lm) => ({
        label: t(lm.labelKey),
        category: lm.category,
        icon: lm.icon,
        big: lm.big,
        handle: LANDMARK_ACCOUNTS[lm.id]
      })),
    [t]
  );
  const communityVisuals: (CommunityVisual | undefined)[] = useMemo(() => {
    const list: (CommunityVisual | undefined)[] = Array.from({ length: 10 }, () => undefined);
    if (!communities) return list;
    const maxSubs = Math.max(1, ...communities.map((c) => c.subscribers));
    communities.forEach((c, i) => {
      if (i < 10) {
        list[i] = { label: c.title, radius: 170 + Math.sqrt(c.subscribers / maxSubs) * 260, handle: c.name };
      }
    });
    return list;
  }, [communities]);
  // The frame loop lives in an effect keyed on the world; the communities
  // query can resolve later, so the loop reads them through a ref.
  const communityVisualsRef = useRef(communityVisuals);
  communityVisualsRef.current = communityVisuals;

  // Engine state in refs so the loop never re-creates it.
  const playerRef = useRef<PlayerState>(createPlayer());
  const camRef = useRef<Camera>({ x: 0, y: 0, z: 0.6 });
  const inputRef = useRef<Vec2>({ x: 0, y: 0 });
  const stickRef = useRef<Vec2>({ x: 0, y: 0 });
  const keysRef = useRef<Record<string, boolean>>({});
  const mapHeldRef = useRef(false);
  const fullMapRef = useRef(false);
  const warpFxRef = useRef(0);
  const trafficRef = useRef<TrafficMarker[]>([]);
  const flowsRef = useRef<FlowState | null>(null);
  const crittersRef = useRef<CritterState | null>(null);
  const atNodeTick = useRef(-1);
  const inCommunityTick = useRef(-1);
  const mKeyDownAt = useRef(0);

  const factories = useMemo(() => placeFactories(world, board.windowStart), [world, board.windowStart]);
  const cubes = useMemo(() => placeCubes(world, board.windowStart), [world, board.windowStart]);
  const flowCfg = useMemo(() => flowConfig(board.counts), [board.counts]);

  const toggleFullMap = () => {
    fullMapRef.current = !fullMapRef.current;
    setFullMap(fullMapRef.current);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const p = playerRef.current;
    const { edges, incident, nodes } = world;
    flowsRef.current = createFlows(world);
    crittersRef.current = createCritters(world, board.windowStart);

    // Spawn just inside the mesh beside the Basecamp landmark.
    const basecampIdx = LANDMARKS.findIndex((lm) => lm.id === 'basecamp');
    const basecampNode = world.landmarkNodeByIndex[basecampIdx] ?? 0;
    const firstEdge = incident[basecampNode][0];
    const startNode =
      firstEdge !== undefined
        ? edges[firstEdge].a === basecampNode
          ? edges[firstEdge].b
          : edges[firstEdge].a
        : basecampNode;
    placeAt(p, edges, incident, startNode);
    p.skipped = startNode;
    camRef.current.x = p.x;
    camRef.current.y = p.y;

    let W = 0;
    let H = 0;
    let DPR = 1;
    const resize = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (k === 'm' && !keysRef.current[k]) {
        mKeyDownAt.current = Date.now();
        mapHeldRef.current = true; // hold to peek…
      }
      keysRef.current[k] = true;
      if ((k === ' ' || k === 'z') && !fullMapRef.current) jump(p, edges, inputRef.current);
      if (k === 'escape' && fullMapRef.current) {
        fullMapRef.current = false;
        setFullMap(false);
        return;
      }
      if ((k === 'x' || k === 'escape') && p.atNode >= 0) {
        p.skipped = p.atNode;
        p.atNode = -1;
        p.still = 0;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current[k] = false;
      if (k === 'm') {
        mapHeldRef.current = false;
        // …release quickly and it was a tap: toggle the full travel map.
        if (Date.now() - mKeyDownAt.current < TAP_MS) {
          fullMapRef.current = !fullMapRef.current;
          setFullMap(fullMapRef.current);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    /** World radius of a house marker's HIT TARGET: at least half again the
     * visual marker radius, because the visual alone was too hard to hit. */
    const houseHitRadius = (): number => {
      const rNode = Math.min(12 / Math.max(camRef.current.z, 0.35), 130);
      return rNode * 1.18 * 1.6;
    };
    const houseAt = (clientX: number, clientY: number): number => {
      const rect = canvas.getBoundingClientRect();
      const cam = camRef.current;
      const wx = (clientX - rect.left - W / 2) / cam.z + cam.x;
      const wy = (clientY - rect.top - H / 2) / cam.z + cam.y;
      let best = -1;
      let bestD = houseHitRadius();
      for (const n of nodes) {
        if (n.kind !== 'house' || !houseVisuals[n.ref]) continue;
        const d = Math.hypot(n.x - wx, n.y - wy);
        if (d < bestD) {
          bestD = d;
          best = n.id;
        }
      }
      return best;
    };

    // Full-map travel: click a fixed landmark to warp the bug there. Targets
    // are the places the bug could reach under its own power, which is what
    // `travelReachable` measures: rail-reachable from the spawn, plus the
    // offshore clusters whose gap fits inside one drift ring. The map never
    // offers a jump the bug itself could not make.
    const onCanvasClick = (e: MouseEvent) => {
      if (!fullMapRef.current) {
        // Play zoom: tapping a post marker (generous target) opens its card.
        const hit = houseAt(e.clientX, e.clientY);
        setClickedNode(hit);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const cam = camRef.current;
      const wx = (e.clientX - rect.left - W / 2) / cam.z + cam.x;
      const wy = (e.clientY - rect.top - H / 2) / cam.z + cam.y;
      const threshold = 44 / cam.z;
      let best = -1;
      let bestD = threshold;
      for (const n of nodes) {
        if (n.kind !== 'landmark' && n.kind !== 'community') continue;
        if (!world.travelReachable[n.id]) continue;
        const d = Math.hypot(n.x - wx, n.y - wy);
        if (d < bestD) {
          bestD = d;
          best = n.id;
        }
      }
      if (best >= 0) {
        placeAt(p, edges, incident, best);
        p.skipped = best; // arrive without instantly opening the panel
        warpFxRef.current = 1;
        fullMapRef.current = false;
        setFullMap(false);
      }
    };
    canvas.addEventListener('click', onCanvasClick);
    const onCanvasMove = (e: MouseEvent) => {
      if (fullMapRef.current) {
        canvas.style.cursor = 'pointer';
        return;
      }
      canvas.style.cursor = houseAt(e.clientX, e.clientY) >= 0 ? 'pointer' : 'default';
    };
    canvas.addEventListener('mousemove', onCanvasMove);

    const readInput = () => {
      const keys = keysRef.current;
      let x = 0;
      let y = 0;
      if (keys['arrowleft'] || keys['a']) x -= 1;
      if (keys['arrowright'] || keys['d']) x += 1;
      if (keys['arrowup'] || keys['w']) y -= 1;
      if (keys['arrowdown'] || keys['s']) y += 1;
      const m = Math.hypot(x, y);
      if (m > 1) {
        x /= m;
        y /= m;
      }
      const stick = stickRef.current;
      if (Math.hypot(stick.x, stick.y) > 0.05) {
        x = stick.x;
        y = stick.y;
      }
      inputRef.current.x = x;
      inputRef.current.y = y;
    };

    const spawnTraffic = () => {
      const traffic = trafficRef.current;
      if (traffic.length >= MAX_TRAFFIC) return;
      const houseNodes = nodes.filter((n) => n.kind === 'house' && houseVisuals[n.ref]);
      if (!houseNodes.length) return;
      const hn = houseNodes[Math.floor(Math.random() * houseNodes.length)];
      const voters = board.houses[hn.ref]?.voters ?? [];
      if (!voters.length || !incident[hn.id].length) return;
      const edgeId = incident[hn.id][Math.floor(Math.random() * incident[hn.id].length)];
      const to = edges[edgeId].a === hn.id ? 0 : 1;
      traffic.push({
        edge: edgeId,
        from: 1 - to,
        to,
        t: 1 - to,
        life: 1.4 + Math.random() * 0.8,
        max: 2.2,
        handle: voters[Math.floor(Math.random() * voters.length)]
      });
    };
    const updateTraffic = (dt: number) => {
      const traffic = trafficRef.current;
      for (let i = traffic.length - 1; i >= 0; i--) {
        const m = traffic[i];
        m.life -= dt;
        m.t += (m.to - m.from) * dt * 0.45;
        const done = m.to > m.from ? m.t >= m.to : m.t <= m.to;
        if (m.life <= 0 || done) traffic.splice(i, 1);
      }
      if (Math.random() < dt * 14) spawnTraffic();
    };

    const playZ = () => (W >= 900 ? 0.6 : Math.max(0.42, W / 2100));
    // The fit must include the farthest breakout clusters (the walled ones),
    // or the frontier gets clipped off the travel map.
    const fitZ = () => Math.min(W, H) / (2 * WORLD.fitExtent);

    // Lazy avatar loading: request faces as the player approaches, never all
    // at once, never blocking anything. Throttled well below frame rate.
    let avatarTick = 0;
    const requestNearbyAvatars = (dt: number) => {
      avatarTick -= dt;
      if (avatarTick > 0) return;
      avatarTick = 0.35;
      for (const n of nodes) {
        if (n.kind === 'house') {
          const h = houseVisuals[n.ref];
          if (h && Math.hypot(n.x - p.x, n.y - p.y) < 2000) requestAvatar(h.handle);
        } else if (n.kind === 'landmark') {
          const handle = LANDMARK_ACCOUNTS[LANDMARKS[n.ref]?.id];
          if (handle && Math.hypot(n.x - p.x, n.y - p.y) < 2400) requestAvatar(handle);
        } else if (n.kind === 'community') {
          const c = communityVisualsRef.current[n.ref];
          if (c && Math.hypot(n.x - p.x, n.y - p.y) < 2800) requestAvatar(c.handle);
        }
      }
    };

    const camUpdate = (dt: number) => {
      const cam = camRef.current;
      const out = mapHeldRef.current || fullMapRef.current;
      const targetZ = out ? fitZ() : playZ();
      const tx = out ? 0 : p.x;
      const ty = out ? 0 : p.y;
      const k = Math.min(1, dt * 10); // ~90% in a quarter second, both ways
      cam.z += (targetZ - cam.z) * k;
      cam.x += (tx - cam.x) * k;
      cam.y += (ty - cam.y) * k;
    };

    let raf = 0;
    let last = 0;
    let shake = 0;
    const frame = (ts: number) => {
      const dt = last ? Math.min(0.033, (ts - last) / 1000) : 0;
      last = ts;

      readInput();
      if (p.stuck > 0) p.stuck = Math.max(0, p.stuck - dt);
      // The bug parks while the full travel map is open.
      if (!fullMapRef.current) {
        if (p.mode === 'rail') {
          railUpdate(p, edges, incident, inputRef.current, dt);
        } else {
          const res = driftUpdate(p, edges, inputRef.current, dt);
          if (res.signalLost) {
            placeAt(p, edges, incident, p.lastNode);
            p.stuck = 1.4;
            shake = 12;
          }
        }
      }
      if (shake > 0) shake = Math.max(0, shake - dt * 40);
      if (warpFxRef.current > 0) warpFxRef.current = Math.max(0, warpFxRef.current - dt * 1.6);

      updateTraffic(dt);
      if (flowsRef.current) updateFlows(flowsRef.current, world, flowCfg, p.x, p.y, dt);
      if (crittersRef.current) updateCritters(crittersRef.current, world, dt);
      requestNearbyAvatars(dt);
      camUpdate(dt);

      if (p.atNode !== atNodeTick.current) {
        atNodeTick.current = p.atNode;
        setAtNode(p.atNode);
      }

      // YOU ARE HERE: which community bubble the bug is standing in. Bubbles
      // overlap, so the SMALLEST containing one wins, which is the innermost.
      // Display only; it drives the banner and brightens that one bubble.
      let inside = -1;
      let innermost = Infinity;
      for (const n of nodes) {
        if (n.kind !== 'community') continue;
        const c = communityVisualsRef.current[n.ref];
        if (!c) continue;
        if (Math.hypot(n.x - p.x, n.y - p.y) > c.radius) continue;
        if (c.radius < innermost) {
          innermost = c.radius;
          inside = n.ref;
        }
      }
      if (inside !== inCommunityTick.current) {
        inCommunityTick.current = inside;
        setInCommunity(inside);
      }

      const zPlay = playZ();
      const zFit = fitZ();
      const mapness = Math.max(0, Math.min(1, (zPlay - camRef.current.z) / Math.max(zPlay - zFit, 0.001)));

      const d = new Date(board.windowStart);
      const drawT0 = performance.now();
      drawScene({
        ctx,
        W,
        H,
        DPR,
        cam: camRef.current,
        mapness,
        nodes,
        edges,
        houses: houseVisuals,
        landmarks: landmarkVisuals,
        communities: communityVisualsRef.current,
        factories,
        cubes,
        flows: flowsRef.current?.particles ?? [],
        traffic: trafficRef.current,
        routeLayers,
        critters: crittersRef.current,
        ground,
        activeCommunity: inCommunityTick.current,
        player: p,
        time: ts / 1000,
        tierColors: TIERS.map((tier) => tier.col),
        shake,
        warpFx: warpFxRef.current,
        hud: {
          housesLabel: t('hive_frontend_universe.hud.houses'),
          windowLabel: t('hive_frontend_universe.hud.window'),
          housesCount: board.houses.length,
          windowTime: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        }
      });
      // Rolling frame-time meter, exposed on the debug handle (measured).
      frameAcc += performance.now() - drawT0;
      frameN++;
      if (frameN >= 60) {
        const dbg = (window as unknown as Record<string, unknown>).__hfuWorldStats as Record<string, unknown>;
        if (dbg) {
          dbg.frameAvgMs = Math.round((frameAcc / frameN) * 100) / 100;
          dbg.mapness = Math.round(mapness * 100) / 100;
          dbg.avatars = avatarStats();
        }
        frameAcc = 0;
        frameN = 0;
      }
      raf = requestAnimationFrame(frame);
    };
    let frameAcc = 0;
    let frameN = 0;
    raf = requestAnimationFrame(frame);

    // Debug/verification handle: real, measured numbers.
    (window as unknown as Record<string, unknown>).__hfuWorldStats = {
      ...world.stats,
      cubes: cubes.length,
      factories: factories.length,
      counts: board.counts,
      routes: routes.map((r) => ({ id: r.id, ...r.stats })),
      critters: crittersRef.current?.counts
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('click', onCanvasClick);
      canvas.removeEventListener('mousemove', onCanvasMove);
    };
    // Visual arrays are read via closure each frame; the world identity is
    // what must rebuild the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, board, factories, cubes, flowCfg, ground]);

  const skip = () => {
    const p = playerRef.current;
    if (p.atNode >= 0) {
      p.skipped = p.atNode;
      p.atNode = -1;
      p.still = 0;
    }
    setAtNode(-1);
    setClickedNode(-1);
  };

  // A clicked post marker wins over the parked-at node for the card.
  const shownNode = clickedNode >= 0 ? clickedNode : atNode;
  const node = shownNode >= 0 ? world.nodes[shownNode] : undefined;
  const atHouse = node?.kind === 'house' && board.houses[node.ref] ? board.houses[node.ref] : null;
  const atLandmark = node?.kind === 'landmark' && clickedNode < 0 ? LANDMARKS[node.ref] : null;
  const atCommunity: TopCommunity | null =
    node?.kind === 'community' && clickedNode < 0 && communities ? communities[node.ref] ?? null : null;
  /** The community the bug is standing in, for the "You are here" banner. */
  const insideCommunity: TopCommunity | null =
    inCommunity >= 0 && communities ? communities[inCommunity] ?? null : null;

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full select-none overflow-hidden bg-[#04030a] touch-none"
      data-testid="hfu-map"
    >
      <canvas ref={canvasRef} className="absolute inset-0 block" />

      {fullMap ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-black/50 px-4 py-1.5 font-mono text-xs text-[#8fd8e4]">
          {t('hive_frontend_universe.map.hint')}
        </div>
      ) : null}

      {/*
        YOU ARE HERE. When the bug is standing inside a community bubble, that
        community is named here with its real avatar. Innermost bubble wins;
        nothing shows when the bug is in none. Display only, no buttons.
      */}
      {!fullMap && insideCommunity ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 mx-auto flex w-fit items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 font-mono text-xs text-[#bfe9ff]">
          {/* eslint-disable-next-line @next/next/no-img-element -- avatar via the app's own proxied avatar route */}
          <img
            src={getUserAvatarUrl(insideCommunity.name, 'small')}
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 shrink-0 rounded-full bg-white/10 object-cover"
          />
          <span>{t('hive_frontend_universe.map.in_community', { name: insideCommunity.title })}</span>
        </div>
      ) : null}

      {!fullMap && atHouse ? <HouseCard house={atHouse} onSkip={skip} /> : null}
      {!fullMap && atLandmark ? (
        <LandmarkPanel
          title={t(atLandmark.labelKey)}
          kind={atLandmark.kind}
          path={atLandmark.path}
          accent={CATEGORY_ACCENT[atLandmark.category]}
          onSkip={skip}
        />
      ) : null}
      {!fullMap && atCommunity ? (
        <LandmarkPanel
          title={atCommunity.title}
          kind="internal"
          path={`/trending/${atCommunity.name}`}
          accent="cyan"
          onSkip={skip}
        />
      ) : null}

      <Controls
        labels={{ hop: t('hive_frontend_universe.controls.hop'), map: t('hive_frontend_universe.controls.map') }}
        onVector={(x, y) => {
          stickRef.current.x = x;
          stickRef.current.y = y;
        }}
        onHop={() => {
          if (!fullMapRef.current) jump(playerRef.current, world.edges, inputRef.current);
        }}
        onMapHold={(held) => {
          mapHeldRef.current = held;
        }}
        onMapTap={toggleFullMap}
      />
    </div>
  );
};

export default CanvasMap;
