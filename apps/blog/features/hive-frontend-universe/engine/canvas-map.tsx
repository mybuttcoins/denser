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
import { useWitnesses } from '../hooks/use-witnesses';
import { HFU_COPY } from '../lib/strings';
import { TIERS, type Board } from '../lib/board';
import { WORLD, LANDMARKS, LANDMARK_ACCOUNTS, TROLL_HOLES, witnessPosts } from '../lib/fixed-world';
import { buildRoutes, POST_LINE_ID, DAPPS_LINE_ID } from '../lib/routes';
import {
  landmarkHref,
  profileHref,
  communityHref,
  postHref,
  type MapTarget,
  type TargetKind
} from '../lib/targets';
import { buildWorld, type GameWorld } from './world';
import { createCritters, updateCritters, type CritterState } from './critters';
import { createCoins, updateCoins, type CoinState } from './coins';
import { createHelmets, updateHelmets, o2Multiplier, HELMET_TOTAL, type HelmetState } from './helmets';
import { buildGround } from './ground';
import { requestAvatar, avatarStats } from './avatars';
import { getUserAvatarUrl } from '@ui/lib/avatar-utils';
import {
  createPlayer,
  driftUpdate,
  jump,
  placeAt,
  railUpdate,
  MOVE,
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
  type TrafficMarker,
  type WitnessVisual
} from './render';
import { placeFactories, placeCubes, placeFormations } from './scenery';
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
  const { data: witnesses } = useWitnesses();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [atNode, setAtNode] = useState(-1);
  /** A house opened by clicking/tapping its marker (bigger than the marker). */
  const [clickedNode, setClickedNode] = useState(-1);
  const [fullMap, setFullMap] = useState(false);
  /** Slot of the community bubble the bug is standing in, or -1 for none. */
  const [inCommunity, setInCommunity] = useState(-1);
  /** The thing under the cursor, named in a chip since nothing is lettered. */
  const [hover, setHover] = useState<{ title: string; kind: TargetKind; sx: number; sy: number } | null>(null);
  /** A clicked witness citadel, which has no world node of its own. */
  const [clickedWitness, setClickedWitness] = useState<{ title: string; href: string | null } | null>(null);

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
        width: 9.2
      },
      {
        edges: byId(DAPPS_LINE_ID),
        casing: '#04141c',
        glow: PALETTE.dappsGlow,
        core: PALETTE.dapps,
        width: 6.2,
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
  // The citadel ring: the real top 21, placed on their fixed posts in rank
  // order. Their avatars are requested eagerly rather than by proximity,
  // because the ring is meant to read from the pulled-out map and the player
  // may never walk out to it.
  const witnessVisuals: WitnessVisual[] = useMemo(() => {
    if (!witnesses?.length) return [];
    const posts = witnessPosts(witnesses.length);
    return witnesses.map((w, i) => ({ name: w.name, rank: w.rank, x: posts[i].x, y: posts[i].y }));
  }, [witnesses]);
  useEffect(() => {
    for (const w of witnessVisuals) requestAvatar(w.name);
  }, [witnessVisuals]);

  // The frame loop lives in an effect keyed on the world; the communities and
  // witnesses queries can resolve later, so the loop reads them through refs.
  const communityVisualsRef = useRef(communityVisuals);
  communityVisualsRef.current = communityVisuals;
  const witnessVisualsRef = useRef(witnessVisuals);
  witnessVisualsRef.current = witnessVisuals;

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
  const coinsRef = useRef<CoinState | null>(null);
  const helmetsRef = useRef<HelmetState | null>(null);
  const atNodeTick = useRef(-1);
  const inCommunityTick = useRef(-1);
  const mKeyDownAt = useRef(0);

  const factories = useMemo(() => placeFactories(world, board.windowStart), [world, board.windowStart]);
  const cubes = useMemo(() => placeCubes(world, board.windowStart), [world, board.windowStart]);
  const formations = useMemo(() => placeFormations(world, board.windowStart), [world, board.windowStart]);
  const flowCfg = useMemo(() => flowConfig(board.counts), [board.counts]);

  /**
   * The oxygen suit. Applied AFTER the ordinary jump so movement.ts stays
   * untouched: the jump grants its usual one ring of fuel and the suit tops
   * it up to o2Multiplier() rings' worth.
   */
  const hopWithO2 = () => {
    const p = playerRef.current;
    jump(p, world.edges, inputRef.current);
    if (p.mode === 'drift') {
      p.fuel = MOVE.DRIFT_TIME * o2Multiplier(helmetsRef.current?.count ?? 0);
    }
  };

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
    // Tokens minted from the window's REAL custom_json count.
    coinsRef.current = createCoins(world, board.counts.customJson, board.windowStart);
    helmetsRef.current = createHelmets();

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
      if ((k === ' ' || k === 'z') && !fullMapRef.current) hopWithO2();
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

    /**
     * What is under the cursor. Nothing on the map is lettered any more, so
     * this one hit test feeds BOTH the hover chip that names things and the
     * click that jumps to them. Radii are generous on purpose: these are the
     * only way to read the map now.
     */
    const targetAt = (clientX: number, clientY: number): MapTarget | null => {
      const rect = canvas.getBoundingClientRect();
      const cam = camRef.current;
      const wx = (clientX - rect.left - W / 2) / cam.z + cam.x;
      const wy = (clientY - rect.top - H / 2) / cam.z + cam.y;
      const z = cam.z;
      let best: MapTarget | null = null;
      let bestD = Infinity;
      const consider = (target: MapTarget, radius: number) => {
        const d = Math.hypot(target.x - wx, target.y - wy);
        if (d < radius && d < bestD) {
          bestD = d;
          best = target;
        }
      };

      // Posts: the marker radius grew this pass, and the hit target stays half
      // again bigger than the art.
      const rNode = Math.min(17 / Math.max(z, 0.35), 180);
      for (const n of nodes) {
        if (n.kind !== 'house') continue;
        const h = houseVisuals[n.ref];
        const post = board.houses[n.ref];
        if (!h || !post) continue;
        consider(
          {
            kind: 'post',
            node: n.id,
            title: `@${h.handle}`,
            href: postHref(post.post?.url, post.post?.author ?? h.handle, post.post?.permlink ?? ''),
            travelable: false,
            x: n.x,
            y: n.y
          },
          rNode * 1.18 * 1.6
        );
      }

      // Places.
      for (const n of nodes) {
        if (n.kind !== 'landmark') continue;
        const lm = LANDMARKS[n.ref];
        const vis = landmarkVisuals[n.ref];
        if (!lm || !vis) continue;
        const minor = lm.icon === 'doc' || lm.icon === 'docq';
        const reach = lm.big ? 420 : ((minor ? 34 : 52) / Math.max(z, 0.45)) * 1.5;
        consider(
          {
            kind: 'landmark',
            node: n.id,
            title: vis.label,
            href: landmarkHref(lm.kind, lm.path),
            travelable: world.travelReachable[n.id],
            x: n.x,
            y: n.y
          },
          reach
        );
      }

      // Community bubbles: the whole bubble is the target.
      for (const n of nodes) {
        if (n.kind !== 'community') continue;
        const c = communityVisualsRef.current[n.ref];
        const meta = communities?.[n.ref];
        if (!c || !meta) continue;
        consider(
          {
            kind: 'community',
            node: n.id,
            title: c.label,
            href: communityHref(meta.name),
            travelable: world.travelReachable[n.id],
            x: n.x,
            y: n.y
          },
          c.radius
        );
      }

      // Witness citadels: scenery, so they have no node, but they still lead
      // somewhere real. Aim at the crowned head, which is where the eye goes.
      for (const wt of witnessVisualsRef.current) {
        const towerH = 1680 - (wt.rank - 1) * 22;
        consider(
          {
            kind: 'witness',
            node: -1,
            title: `${wt.rank}. ${wt.name}`,
            href: profileHref(wt.name),
            travelable: false,
            x: wt.x,
            y: wt.y - towerH * 0.87
          },
          towerH * 0.34
        );
      }
      return best;
    };

    /**
     * One click handler for the whole world, at both zooms.
     *
     * On the FULL MAP a travelable place warps the bug there and opens its
     * panel on arrival, so one click gets you there and the next gets you to
     * the page. Anything that cannot be travelled to (a witness citadel is
     * scenery) opens its page directly, because there is nothing else it could
     * usefully do.
     *
     * At PLAY zoom a click opens the thing's panel rather than navigating,
     * because a stray click while riding should never throw you out of the
     * game.
     */
    const onCanvasClick = (e: MouseEvent) => {
      const target = targetAt(e.clientX, e.clientY);
      if (!target) {
        setClickedNode(-1);
        setClickedWitness(null);
        return;
      }
      if (fullMapRef.current && target.travelable && target.node >= 0) {
        placeAt(p, edges, incident, target.node);
        warpFxRef.current = 1;
        fullMapRef.current = false;
        setFullMap(false);
        setClickedNode(target.node);
        setClickedWitness(null);
        return;
      }
      if (target.kind === 'witness') {
        setClickedWitness({ title: target.title, href: target.href });
        setClickedNode(-1);
        if (fullMapRef.current && target.href) {
          window.open(target.href, '_blank', 'noopener,noreferrer');
        }
        return;
      }
      setClickedWitness(null);
      setClickedNode(target.node);
    };
    canvas.addEventListener('click', onCanvasClick);

    // Hover names the thing under the cursor, which is the only way to read
    // the map now that nothing is lettered.
    const onCanvasMove = (e: MouseEvent) => {
      const target = targetAt(e.clientX, e.clientY);
      canvas.style.cursor = target ? 'pointer' : 'default';
      const rect = canvas.getBoundingClientRect();
      setHover(
        target
          ? {
              title: target.title,
              kind: target.kind,
              sx: e.clientX - rect.left,
              sy: e.clientY - rect.top
            }
          : null
      );
    };
    canvas.addEventListener('mousemove', onCanvasMove);
    const onCanvasLeave = () => setHover(null);
    canvas.addEventListener('mouseleave', onCanvasLeave);

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
      // The HUD is painted on the canvas every frame, so the token counts
      // need no React state to stay current.
      if (coinsRef.current) updateCoins(coinsRef.current, p, crittersRef.current, factories, TROLL_HOLES, dt);
      if (helmetsRef.current) updateHelmets(helmetsRef.current, p.x, p.y);
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
        formations,
        witnesses: witnessVisualsRef.current,
        flows: flowsRef.current?.particles ?? [],
        traffic: trafficRef.current,
        routeLayers,
        critters: crittersRef.current,
        coins: coinsRef.current,
        helmetState: helmetsRef.current,
        ground,
        activeCommunity: inCommunityTick.current,
        player: p,
        time: ts / 1000,
        tierColors: TIERS.map((tier) => tier.col),
        shake,
        warpFx: warpFxRef.current,
        hud: {
          helmetsLabel: t('hive_frontend_universe.hud.helmets'),
          helmets: helmetsRef.current?.count ?? 0,
          helmetTotal: HELMET_TOTAL,
          tokensLabel: t('hive_frontend_universe.hud.tokens'),
          carried: coinsRef.current?.carried ?? 0,
          banked: coinsRef.current?.banked ?? 0,
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
      canvas.removeEventListener('mouseleave', onCanvasLeave);
    };
    // Visual arrays are read via closure each frame; the world identity is
    // what must rebuild the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, board, factories, cubes, formations, flowCfg, ground]);

  const skip = () => {
    const p = playerRef.current;
    if (p.atNode >= 0) {
      p.skipped = p.atNode;
      p.atNode = -1;
      p.still = 0;
    }
    setAtNode(-1);
    setClickedNode(-1);
    setClickedWitness(null);
  };

  // A clicked post marker wins over the parked-at node for the card.
  const shownNode = clickedNode >= 0 ? clickedNode : atNode;
  const node = shownNode >= 0 ? world.nodes[shownNode] : undefined;
  const atHouse = node?.kind === 'house' && board.houses[node.ref] ? board.houses[node.ref] : null;
  const atLandmark = node?.kind === 'landmark' ? LANDMARKS[node.ref] : null;
  const atCommunity: TopCommunity | null =
    node?.kind === 'community' && communities ? communities[node.ref] ?? null : null;
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

      {/*
        THE HOVER CHIP. Nothing on the map is lettered any more, so this is
        how you read it: point at anything and it names itself. Display only,
        and it never eats a click.
      */}
      {hover ? (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-md border border-white/20 bg-black/85 px-2 py-1 font-mono text-xs font-semibold text-[#e9f4f8] shadow-lg"
          style={{ left: hover.sx, top: hover.sy - 12 }}
          data-testid="hfu-hover-chip"
        >
          {hover.title}
        </div>
      ) : null}

      {/*
        A clicked witness citadel. Citadels are scenery with no world node, so
        they get their own small panel rather than the landmark one.
      */}
      {clickedWitness ? (
        <LandmarkPanel
          title={clickedWitness.title}
          kind={clickedWitness.href ? 'external' : 'none'}
          path={clickedWitness.href ?? ''}
          accent="amber"
          onSkip={() => setClickedWitness(null)}
        />
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
          if (!fullMapRef.current) hopWithO2();
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
