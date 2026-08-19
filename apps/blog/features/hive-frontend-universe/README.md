# Hive Frontend Universe

A canvas game that doubles as a map of hive.blog. You are a red bug on a
surfboard, riding a transit network woven across terrain shaped like the Hive
mark. Every post, profile, community and tool on the map is real and clickable:
the game is another way to navigate the site.

It lives inside [Denser](https://gitlab.syncad.com/hive/denser) as one feature
module. Everything is in this directory; the only touchpoints outside it are
the game registry entry in `features/basecamp/games/registry.ts` and the
translation files in `apps/blog/locales/*/common_blog.json`.

## Run it

```bash
pnpm install
pnpm dev:blog
```

Two gotchas, both real:

1. The blog's `predev` script wipes `public/auth/` on every start, which
   silently breaks login. After the dev server is up, restore the auth worker:

   ```bash
   cd apps/blog && pnpm run copy:worker && pnpm run copy:assets
   ```

2. The game is gated behind a logged-in Hive account **older than one year**
   (`hooks/use-age-gate.ts`). This is a deliberate design decision: the game is
   built for people who already know Hive, not onboarding. If you want to
   develop against it without an account, see the note on the harness below.

Then open `http://localhost:3000/basecamp`, pick the **I'm here to help** tab,
then **Puppet Patrol Games**, then **Hive Frontend Universe**.

Controls: arrows/WASD ride the rails, Space/Z jumps into open space (drift),
M held peeks at the whole map, M tapped opens the travel map where clicking
any landmark warps you there. Click anything to see where it leads.

## What is real

More of this than you might expect is live chain data, not decoration:

- The ~30 post markers are real posts from the current 30-minute window, with
  the authors' real profile photos (via the app's own avatar proxy).
- The witness citadels ringing the world are the actual top 21 consensus
  witnesses, in vote order, fetched from `condenser_api.get_witnesses_by_vote`.
- The collectable JSON tokens are minted from the window's real `custom_json`
  operation count (one per thousand ops, floored so the map is never empty).
- The ambient particle flows on the lines are scaled from the window's real
  vote / comment / transfer / custom_json counts.
- Communities are the top page of `bridge.list_communities`, with their real
  avatars.

Everything read, nothing written: **this module never signs or broadcasts
anything**. The Hive API calls live in `data/` (one file per fetch, each cached
in localStorage with a TTL).

## Architecture

The dependency direction is `lib/` <- `engine/` <- `canvas-map.tsx`, and
`data/` + `hooks/` feed React state in from the side.

```
lib/        Pure, DOM-free. The world's shape and rules.
  landmass.ts     Generated terrain cells; silhouette = the Hive mark, eroded.
  fixed-world.ts  Every hand-tunable position: landmarks, clusters, holes.
  mesh.ts         Poisson + Gabriel planar mesh, rewoven per 30-min window.
  routes.ts       Named edge-id lists over the mesh (post line, dApps line).
  targets.ts      What every clickable thing links to. One mapping, one file.
  board.ts        Raw chain data -> the window's board (posts, tiers, counts).

engine/     Canvas + game state. No React except canvas-map.tsx.
  world.ts        Welds mesh + clusters + communities into one graph, then
                  MEASURES its own invariants (crossings, angles, gaps).
  movement.ts     Rail riding and drift. Position is always edge + fraction.
  coins.ts        The token economy: collect, bank, thieves, recapture.
  helmets.ts      The 21 oxygen helmets and the drift-range upgrade ladder.
  critters.ts     The population: five kinds, their look and their wander.
  ground.ts       The terrain paint: base, additive glass, halo. Built once
                  per window, only blitted per frame.
  render.ts       One draw pass over the whole scene, viewport-culled.
  icons.ts        Every code-drawn illustration (no image assets).
  canvas-map.tsx  The React shell: frame loop, input, hover/click, HUD.

data/       One fetch per file, localStorage-cached.
hooks/      TanStack Query wrappers + the age gate.
card/       The DOM panels (post card, landmark panel).
```

## Invariants

These are the rules everything above is built on. If you extend the module,
keep them; several are load-bearing for future multiplayer.

- **The world is deterministic from the window start time.** Every player in
  the same 30-minute window sees the identical world. No `Math.random()` in
  world building; everything seeds from `windowStart` (mulberry32).
- **Position is always `edge + t`.** Two numbers locate any entity, which is
  what will make positions cheap to share later. Nothing stores world x/y as
  its source of truth.
- **The mesh is verified, not assumed**: planar (zero crossings), max degree
  4, minimum 35 degrees between edges at a junction, junction spacing tuned to
  1.5-2s of travel. `world.ts` measures all of this and reports it in
  `world.stats`; if you change generation, the stats will tell on you.
- **`movement.ts` does not change.** Abilities layer on top by reading player
  state or adjusting fuel after `jump()` runs (see `helmets.ts`), never by
  editing the movement integrator.
- **Nothing broadcasts.** Read-only chain access. When gifting/rewards arrive
  they will go through the app's `transactionService`, like every other write
  in Denser.
- **No image assets.** All art is drawn in code (`icons.ts`, `critters.ts`),
  except real avatars, which come through the app's own proxy.
- **Every user-facing string goes through `t()`.**

## Extending it

- **New landmark**: one line in `lib/fixed-world.ts` (position, link, icon
  key), one icon case in `engine/icons.ts`, one label key per locale.
- **New route line**: add a stop list + builder in `lib/routes.ts` and a
  `RouteLayer` (colour/width/dash) where routes are assembled in
  `canvas-map.tsx`. Routes are edge-id lists; they never add geometry.
- **New critter kind**: extend the union + counts + a draw function in
  `engine/critters.ts`. Give it behaviour in `engine/coins.ts` only if it
  interacts with the token economy.
- **New collectable/system**: follow `helmets.ts`; it is the smallest complete
  example (state, create/update/draw, persistence).
- **Porting to another frontend**: `lib/` and `engine/` have two React-free
  external dependencies to replace: the avatar URL helper and the
  localStorage-with-TTL helper. Everything else is canvas + fetch. The React
  shell (`canvas-map.tsx`, `card/`, `hooks/`) is the Denser-specific part.

## Verification

The world's invariants can be checked headlessly (the `lib/` and world-building
code is DOM-free and runs under ts-node). During development the game was also
driven in a browser harness that runs the real engine against a scripted
player, which is how the numbers in the commit messages (crossings, gap
widths, frame times) were measured. There is no automated test suite for the
module yet; that is the most honest criticism of it, and the commit history
records what was verified by hand at every pass.

## Status

Playable and in active development. The commit messages (search `HFU pass`)
are the changelog and each one ends with a KNOWN ISSUES section that says
plainly what is stubbed, unverified or ugly. Current known gaps: thieves walk
straight lines over water, only two of five critter kinds steal, banking has
no reward beyond the counter, and token gifting as post comments is designed
but deliberately unbuilt (it would broadcast).
