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
import {
  WORLD,
  LANDMARKS,
  LANDMARK_ACCOUNTS,
  TROLL_HOLES,
  ARCADE_GAMES,
  DAPP_DIRECTORY,
  STEEM_RUINS,
  witnessPosts
} from '../lib/fixed-world';
import { mulberry32 } from '../lib/mesh';
import { getStorageItem, setStorageItem, StorageTTL } from '@ui/lib/storage-with-ttl';
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
import {
  createHazards,
  updateHazards,
  hazardHolds,
  fightWrap,
  GOO_SLOW,
  type HazardState
} from './hazards';
import { createGems, updateGems, type GemState } from './gems';
import { buildGround } from './ground';
import { requestAvatar, avatarStats } from './avatars';
import { getUserAvatarUrl } from '@ui/lib/avatar-utils';
import { FERRIS_SPIN } from './icons';
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
  /** A clicked or beam-visited witness citadel, which has no world node. */
  const [clickedWitness, setClickedWitness] = useState<{
    title: string;
    href: string | null;
    /** Real chain stats, shown after a beam visit reaches the crown. */
    stats?: { label: string; value: string }[];
  } | null>(null);

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
        // 1.3x the cyan line, per Bryan's proportion ruling: first place
        // by a step, not a shout (was 9.2, which read close to 1.75x).
        width: 8.1,
        spark: '#fff3c0'
      },
      {
        edges: byId(DAPPS_LINE_ID),
        casing: '#04141c',
        glow: PALETTE.dappsGlow,
        core: PALETTE.dapps,
        width: 6.2,
        dash: [30, 22],
        spark: '#e6fcff'
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
    return witnesses.map((w, i) => {
      const x = posts[i].x;
      const y = posts[i].y;
      // THE TRACTOR LANE. The first beam grabbed within 260px of the base,
      // which physics proved unreachable for 14 of the 21 citadels (the ring
      // stands 1000-2200px off the coast; a bare jump dies first). The lane
      // aims from the base AT the nearest rail node and stops 300px short of
      // it, so from that node one ordinary jump into the light always
      // connects, for every citadel, with zero helmets.
      let nx = 0;
      let ny = 0;
      let bestD = Infinity;
      for (const n of world.nodes) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bestD) {
          bestD = d;
          nx = n.x;
          ny = n.y;
        }
      }
      const len = Math.max(400, bestD - 300);
      const laneX = x + ((nx - x) / bestD) * len;
      const laneY = y + ((ny - y) / bestD) * len;
      return { name: w.name, rank: w.rank, x, y, laneX, laneY };
    });
  }, [witnesses, world]);
  useEffect(() => {
    for (const w of witnessVisuals) requestAvatar(w.name);
    // The dApp station's window logos, eagerly: the station is a big landmark
    // meant to read from the map, so its faces load like the witnesses' do.
    for (const d of DAPP_DIRECTORY) {
      if (d.account) requestAvatar(d.account);
    }
  }, [witnessVisuals]);

  // Read through a REF inside the frame loop, never the query state: the
  // loop's closure is created before the witnesses query resolves (the same
  // trap that once made every community bubble unclickable).
  const witnessDataRef = useRef(witnesses);
  witnessDataRef.current = witnesses;

  // State-to-ref mirror so the frame loop can see whether the witness card
  // is open without touching React state mid-frame.
  useEffect(() => {
    witnessCardOpenRef.current = clickedWitness !== null;
  }, [clickedWitness]);

  /**
   * The witness stats rows for the beam-visit card. Real numbers from the
   * same get_witnesses_by_vote call that ranks the citadel ring.
   */
  const witnessStats = (name: string): { label: string; value: string }[] => {
    const w = witnessDataRef.current?.find((x) => x.name === name);
    if (!w) return [];
    return [
      { label: t('hive_frontend_universe.witness.version'), value: w.version || '?' },
      {
        label: t('hive_frontend_universe.witness.last_block'),
        value: w.lastBlock ? `#${w.lastBlock.toLocaleString()}` : '?'
      },
      { label: t('hive_frontend_universe.witness.missed'), value: String(w.missed) }
    ];
  };

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
  /**
   * The current RIDE: cosmetic transport that never touches the player's
   * edge-plus-fraction state. 'wheel' orbits the DHF ferris (a full rotation
   * earns a breath of spare air); 'beam' lifts the bug up a witness citadel,
   * opens the witness's card at the crown, then rides it back DOWN and hands
   * back the drift with the air topped up. A round trip, never a yank home.
   */
  const rideRef = useRef<
    | { type: 'wheel'; node: number; cx: number; cy: number; startAngle: number }
    | {
        type: 'beam';
        /** Where the lane caught the bug; the ride starts and ends here. */
        gx: number;
        gy: number;
        x: number;
        baseY: number;
        topY: number;
        /** Glide (grab point to base) and climb (base to crown) lengths. */
        glide: number;
        climb: number;
        /** Seconds for the full one-way trip, scaled to its length. */
        dur: number;
        t: number;
        /** 1 riding up, -1 riding back down. */
        dir: 1 | -1;
        met: boolean;
        name: string;
        title: string;
        href: string;
      }
    | null
  >(null);
  /** Re-armed by leaving the wheel, so one visit grants one ride. */
  const wheelArmedRef = useRef(true);
  /** Seconds before another beam can catch the bug, so visits stay chosen. */
  const beamCooldownRef = useRef(0);
  /** The nuisance hazards: goo, wrap, the sock trip. */
  const hazardsRef = useRef<HazardState | null>(null);
  /** Colorful collectible gems, reseeded every board. */
  const gemsRef = useRef<GemState | null>(null);
  /** Mirrors the clickedWitness React state for the frame loop: while the
   *  card is open the beam HOLDS the bug at the crown; Skip sends it home. */
  const witnessCardOpenRef = useRef(false);
  /** Trophies mounted on the ferris wheel this board (session only). */
  const wheelTrophiesRef = useRef(0);
  /** Communities the player has stood in, persisted like PLACES. */
  const visitedCommunitiesRef = useRef<Set<string> | null>(null);
  const atNodeTick = useRef(-1);
  const inCommunityTick = useRef(-1);
  const mKeyDownAt = useRef(0);

  /**
   * THE BUZZING STATION: one landmark a day pays double tokens. Picked from
   * the UTC day number alone, no backend: every player sees the same pick,
   * and tomorrow it moves. The trap and the endgame are excluded; the buzz
   * is an invitation, not an ambush.
   */
  const buzz = useMemo(() => {
    const eligible = LANDMARKS.map((lm, i) => ({ lm, i })).filter(
      ({ lm }) => lm.id !== 'json_keep' && lm.id !== 'mount_socko'
    );
    const day = Math.floor(Date.now() / 86400000);
    const pick = eligible[Math.floor(mulberry32((day ^ 0xb22e) | 0)() * eligible.length)];
    const node = world.landmarkNodeByIndex[pick.i] ?? -1;
    if (node < 0) return null;
    const n = world.nodes[node];
    return { x: n.x, y: n.y, r: 1100, landmarkId: pick.lm.id };
  }, [world]);

  /** Named places visited, persisted forever: the map-completion loop. */
  const visitedRef = useRef<Set<string> | null>(null);

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
    // A jump mid-ride: hop OUT of a ferris basket early (no breath earned);
    // during a beam the light has you, the jump does nothing.
    const rd = rideRef.current;
    if (rd) {
      if (rd.type === 'wheel') {
        rideRef.current = null;
        placeAt(p, world.edges, world.incident, rd.node);
      }
      return;
    }
    // A jump while pasta-wrapped tears at the noodles instead of jumping.
    if (hazardsRef.current && fightWrap(hazardsRef.current)) return;
    jump(p, world.edges, inputRef.current);
    if (p.mode === 'drift') {
      const suit = helmetsRef.current;
      let rings = o2Multiplier(suit?.count ?? 0);
      // A breath of spare air (earned on the ferris wheel) is a whole extra
      // ring, spent on this one jump.
      if (suit && suit.spareAir > 0) {
        suit.spareAir--;
        rings += 1;
      }
      p.fuel = MOVE.DRIFT_TIME * rings;
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
    hazardsRef.current = createHazards(crittersRef.current.critters.length);
    gemsRef.current = createGems(world, board.windowStart);
    if (!visitedRef.current) {
      visitedRef.current = new Set(getStorageItem<string[]>('hfu-visited') ?? []);
    }
    if (!visitedCommunitiesRef.current) {
      visitedCommunitiesRef.current = new Set(getStorageItem<string[]>('hfu-visited-communities') ?? []);
    }

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

      // Posts: the hit target is over twice the visual marker with a floor,
      // because "half again" was still too hard to hit in real play.
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
          Math.max(rNode * 2.6, 90)
        );
      }

      // Places.
      for (const n of nodes) {
        if (n.kind !== 'landmark') continue;
        const lm = LANDMARKS[n.ref];
        const vis = landmarkVisuals[n.ref];
        if (!lm || !vis) continue;
        const minor = lm.icon === 'doc' || lm.icon === 'docq';
        const reach = lm.big ? 520 : Math.max(((minor ? 34 : 52) / Math.max(z, 0.45)) * 2.2, 80);
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

      // Community bubbles: the whole bubble is the target, plus a margin.
      //
      // Read through the REF, never the query state: this closure is created
      // once per world, before the communities query resolves, so the state
      // variable in here is permanently undefined. That exact mistake shipped
      // in pass ten and made every community bubble unhoverable and
      // unclickable. The ref carries the community's account handle too, so
      // nothing here needs the query state at all.
      for (const n of nodes) {
        if (n.kind !== 'community') continue;
        const c = communityVisualsRef.current[n.ref];
        if (!c) continue;
        consider(
          {
            kind: 'community',
            node: n.id,
            title: c.label,
            href: communityHref(c.handle),
            travelable: world.travelReachable[n.id],
            x: n.x,
            y: n.y
          },
          c.radius * 1.15
        );
      }

      // The population: every creature answers to a name on hover. Display
      // only; a critter is not a link, so clicking it does nothing.
      if (crittersRef.current) {
        for (const cr of crittersRef.current.critters) {
          consider(
            {
              kind: 'critter',
              node: -1,
              title: t(`hive_frontend_universe.critters.${cr.kind}`),
              href: null,
              travelable: false,
              x: cr.x,
              y: cr.y
            },
            80
          );
        }
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
          towerH * 0.45
        );
      }

      // The Steem Ruins: scenery like the citadels, with exactly one link
      // out of them: the real 2020 announcement of the fork that left them.
      consider(
        {
          kind: 'witness',
          node: -1,
          title: t('hive_frontend_universe.landmarks.steem_ruins'),
          href: STEEM_RUINS.url,
          travelable: false,
          x: STEEM_RUINS.x,
          y: STEEM_RUINS.y
        },
        700
      );
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
      if (target.kind === 'critter') {
        return; // named on hover, but not a destination
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

    // Where the bug is DRAWN while riding something (null when walking).
    // The camera follows this, not the parked physics position, so a beam
    // ride visibly travels up the tower instead of staring at the base.
    let overlayPos: Vec2 | null = null;
    const camUpdate = (dt: number) => {
      const cam = camRef.current;
      const out = mapHeldRef.current || fullMapRef.current;
      const targetZ = out ? fitZ() : playZ();
      const follow = overlayPos ?? p;
      const tx = out ? 0 : follow.x;
      const ty = out ? 0 : follow.y;
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
      const hz = hazardsRef.current;
      // The bug parks while the full travel map is open, hands itself over
      // while ANY ride has it (beam or wheel basket), and is HELD while a
      // sock envelops it or pasta wraps it. Slime never holds, it just makes
      // everything sticky: the movement integrator runs on slowed-down time,
      // movement.ts untouched.
      const riding = rideRef.current !== null;
      const hazardHeld = hz ? hazardHolds(hz) : false;
      if (!fullMapRef.current && !riding && !hazardHeld) {
        const pdt = hz && hz.gooT > 0 ? dt * GOO_SLOW : dt;
        if (p.mode === 'rail') {
          railUpdate(p, edges, incident, inputRef.current, pdt);
        } else {
          const res = driftUpdate(p, edges, inputRef.current, pdt);
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
      if (hz) {
        updateHazards(hz, p, crittersRef.current, dt);
        // The sock has closed around the bug: flash-post it to Mount Socko.
        // Not a death, a DELIVERY; the toll is the walk back.
        if (hz.tripped) {
          hz.tripped = false;
          const sockIdx = LANDMARKS.findIndex((lm) => lm.id === 'mount_socko');
          const sockNode = world.landmarkNodeByIndex[sockIdx] ?? -1;
          if (sockNode >= 0) {
            placeAt(p, edges, incident, sockNode);
            warpFxRef.current = 1;
          }
        }
      }
      // The HUD is painted on the canvas every frame, so the token counts
      // need no React state to stay current.
      if (coinsRef.current) updateCoins(coinsRef.current, p, crittersRef.current, factories, TROLL_HOLES, dt, buzz);
      if (helmetsRef.current) updateHelmets(helmetsRef.current, p.x, p.y);
      if (gemsRef.current) updateGems(gemsRef.current, p.x, p.y);
      requestNearbyAvatars(dt);
      camUpdate(dt);

      if (p.atNode !== atNodeTick.current) {
        atNodeTick.current = p.atNode;
        setAtNode(p.atNode);
        // Map completion: parking at a named place marks it visited, forever.
        const vn = p.atNode >= 0 ? nodes[p.atNode] : undefined;
        if (vn?.kind === 'landmark' && visitedRef.current) {
          const id = LANDMARKS[vn.ref]?.id;
          if (id && !visitedRef.current.has(id)) {
            visitedRef.current.add(id);
            setStorageItem('hfu-visited', Array.from(visitedRef.current), StorageTTL.PERMANENT);
          }
        }
        // Communities light up the same way (dim-until-visited grammar).
        if (vn?.kind === 'community' && visitedCommunitiesRef.current) {
          const ch = communityVisualsRef.current[vn.ref]?.handle;
          if (ch && !visitedCommunitiesRef.current.has(ch)) {
            visitedCommunitiesRef.current.add(ch);
            setStorageItem(
              'hfu-visited-communities',
              Array.from(visitedCommunitiesRef.current),
              StorageTTL.PERMANENT
            );
          }
        }
      }

      // ---- RIDES: cosmetic transport, physics untouched. ----
      const ferrisIdx = LANDMARKS.findIndex((lm) => lm.id === 'proposals');
      const ferrisNode = world.landmarkNodeByIndex[ferrisIdx] ?? -1;
      const wheelRadius = 330; // matches drawFerris: BIG s=150 drawn at R = s * 2.2
      let ride = rideRef.current;

      // Board the wheel by PROXIMITY, in any mode: ride or jump near the
      // wheel and a basket catches you. Bryan's playtest found the old
      // park-exactly-at-the-node rule never triggered in real play. Leaving
      // the area re-arms it, so one visit still means one ride.
      if (ferrisNode >= 0) {
        const fn = nodes[ferrisNode];
        const distWheel = Math.hypot(fn.x - p.x, fn.y - p.y);
        if (!ride && wheelArmedRef.current && !hazardHeld && distWheel < 430) {
          ride = { type: 'wheel', node: ferrisNode, cx: fn.x, cy: fn.y, startAngle: (ts / 1000) * FERRIS_SPIN };
          rideRef.current = ride;
          wheelArmedRef.current = false;
        }
        if (!rideRef.current && distWheel > 580) wheelArmedRef.current = true;
      }

      if (ride?.type === 'wheel') {
        const angle = (ts / 1000) * FERRIS_SPIN;
        if (angle - ride.startAngle >= Math.PI * 2) {
          // One full rotation: a breath of spare air, and the trophy
          // ceremony: carrying at least one helmet mounts it in a gondola
          // for the rest of this board (Bryan's Sagrada wheel).
          if (helmetsRef.current) {
            helmetsRef.current.spareAir++;
            helmetsRef.current.spareFlash = 1.2;
            if (helmetsRef.current.count > 0 && wheelTrophiesRef.current === 0) {
              wheelTrophiesRef.current = 1;
            }
          }
          placeAt(p, edges, incident, ride.node);
          rideRef.current = null;
        }
      }

      // THE TRACTOR LANE. A drifting bug anywhere along the pulsing lane
      // (base to lane end, 220px corridor) is caught. The old rule, 260px
      // around the base point itself, was proven unreachable for 14 of 21
      // citadels: the ring stands 1000-2200px off the coast and a bare
      // jump's air dies first. Now the light comes down to where the bug
      // can actually get.
      if (beamCooldownRef.current > 0) beamCooldownRef.current -= dt;
      if (!ride && p.mode === 'drift' && beamCooldownRef.current <= 0) {
        for (const wt of witnessVisualsRef.current) {
          if (wt.laneX === undefined || wt.laneY === undefined) continue;
          // Distance from the bug to the lane segment (base to lane end).
          const ax = wt.x;
          const ay = wt.y;
          const bx = wt.laneX;
          const by = wt.laneY;
          const abx = bx - ax;
          const aby = by - ay;
          const len2 = abx * abx + aby * aby;
          const u = Math.max(0, Math.min(1, ((p.x - ax) * abx + (p.y - ay) * aby) / len2));
          const cx = ax + abx * u;
          const cy = ay + aby * u;
          if (Math.hypot(p.x - cx, p.y - cy) > 220) continue;
          const towerH = 1680 - (wt.rank - 1) * 22;
          const glide = Math.hypot(cx - ax, cy - ay);
          const climb = towerH * 0.87;
          rideRef.current = {
            type: 'beam',
            gx: cx,
            gy: cy,
            x: wt.x,
            baseY: wt.y,
            topY: wt.y - climb,
            glide,
            climb,
            // Long lanes take longer, so the carry always reads as travel:
            // roughly 700px/s with a floor.
            dur: Math.max(1.6, (glide + climb) / 700),
            t: 0,
            dir: 1,
            met: false,
            name: wt.name,
            title: `${wt.rank}. ${wt.name}`,
            href: profileHref(wt.name)
          };
          break;
        }
      }
      // The beam is a ROUND TRIP: caught in the lane, glided to the base,
      // carried up to the crown where the witness card opens with their real
      // stats, a pause, then back down to the exact grab point, and the
      // drift resumes with the air topped up. The first version yanked the
      // bug home across the map instead, which read as dying.
      if (rideRef.current?.type === 'beam') {
        const beam = rideRef.current;
        if (beam.dir === 1 && beam.t >= 1) {
          if (!beam.met) {
            beam.met = true;
            witnessCardOpenRef.current = true;
            setClickedWitness({ title: beam.title, href: beam.href, stats: witnessStats(beam.name) });
          }
          // STAY at the crown as long as the card is open. Bryan's playtest
          // fix: the visit lasts until the player chooses Skip, and only
          // then does the beam carry them home.
          if (!witnessCardOpenRef.current) beam.dir = -1;
        } else {
          beam.t = Math.max(0, Math.min(1, beam.t + (dt / beam.dur) * beam.dir));
          if (beam.dir === -1 && beam.t <= 0) {
            rideRef.current = null;
            beamCooldownRef.current = 5;
            // Fresh air for the trip home: a visit costs nothing but time.
            if (p.mode === 'drift') {
              p.fuel = MOVE.DRIFT_TIME * o2Multiplier(helmetsRef.current?.count ?? 0);
            }
          }
        }
      }
      if (helmetsRef.current && helmetsRef.current.spareFlash > 0) {
        helmetsRef.current.spareFlash = Math.max(0, helmetsRef.current.spareFlash - dt);
      }
      overlayPos = (() => {
        const rd = rideRef.current;
        if (!rd) return null;
        if (rd.type === 'wheel') {
          const a = (ts / 1000) * FERRIS_SPIN;
          return {
            x: rd.cx + Math.cos(a) * wheelRadius,
            y: rd.cy + Math.sin(a) * wheelRadius + wheelRadius * 0.17
          };
        }
        // Piecewise beam path: glide along the lane to the base, then climb
        // the tower. One eased parameter covers the whole distance.
        const ease = rd.t * rd.t * (3 - 2 * rd.t);
        const d = ease * (rd.glide + rd.climb);
        if (d < rd.glide && rd.glide > 0) {
          const u = d / rd.glide;
          return { x: rd.gx + (rd.x - rd.gx) * u, y: rd.gy + (rd.baseY - rd.gy) * u };
        }
        const u = rd.climb > 0 ? (d - rd.glide) / rd.climb : 1;
        return { x: rd.x, y: rd.baseY + (rd.topY - rd.baseY) * u };
      })();

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
        rideOverlay: overlayPos,
        hazards: hazardsRef.current,
        gems: gemsRef.current,
        visitedCommunities: visitedCommunitiesRef.current,
        wheelTrophies: wheelTrophiesRef.current,
        buzz,
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
          placesLabel: t('hive_frontend_universe.hud.places'),
          places: visitedRef.current?.size ?? 0,
          placesTotal: LANDMARKS.length,
          gemsLabel: t('hive_frontend_universe.hud.gems'),
          gems: gemsRef.current?.collected ?? 0,
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
          stats={clickedWitness.stats}
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
          links={
            atLandmark.id === 'arcade'
              ? ARCADE_GAMES.map((g) => ({ label: g.name, href: g.url }))
              : atLandmark.id === 'our_dapps' || atLandmark.id === 'hive_dapps'
                ? DAPP_DIRECTORY.map((d) => ({ label: d.name, href: d.url }))
                : undefined
          }
          linksLabel={
            atLandmark.id === 'arcade'
              ? t('hive_frontend_universe.panel.real_games')
              : t('hive_frontend_universe.panel.dapps')
          }
          note={
            buzz && atLandmark.id === buzz.landmarkId
              ? t('hive_frontend_universe.panel.buzzing')
              : undefined
          }
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
