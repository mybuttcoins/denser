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

## The creatures and the lore

Every creature has a name, a nature and a reason to exist. The fiction is
thin on purpose: each one personifies something a real Hive user actually
meets, so the game doubles as a warning label. The thieves take TOKENS
(engine/coins.ts); the nuisances take TIME (engine/hazards.ts). None of them
can kill; a drifting bug sails over all of them, so jumping is always the
answer.

| Name | Kind | Count | Nature | What it does |
|------|------|-------|--------|--------------|
| Socko | sock puppet | 14 | trap | A mischievous sock with slanty eyes. Touch it and it envelops the bug and flash-posts it to Mount Socko on the far north tip: never fatal, always a detour. |
| Blahgart | the word BLAH, walking | 16 | nuisance | Get close and it spits bright green slime; a slimed bug moves at less than half speed for a few seconds. Loud, sticky, avoidable. |
| Sly Grin | scammer | 8 | thief | Golden head, black domino mask, gaucho hat. Snatches 3 carried tokens and dashes for a troll hole. Pounce on it within its getaway to take them back. |
| Drainiac | extractor | 9 | thief | Half again bigger than anything else, four sucker snouts. Latches on and drains carried tokens at 2.4/s into a pouch of 4, then hauls the pouch home. Jump to break the latch. |
| Copypasta | pasta octopus | 11 | nuisance | An octopus made of spaghetti, the same arm pasted eight times. Brush it and the noodles wrap the bug; three quick jumps tear it free. |

All of them serve **Emperor J SON**, who squats in a black shard castle at
the far south-east edge of the world, half fortress, half surfaced
submarine, where the stolen tokens visibly spiral in. The reference is
Hive's actual founding story: in 2020 a new owner tried to take over the
old chain with a ninja-mined stake, and the community forked away and
built Hive. The Emperor hoards; the chain routes around him. His keep sits
deliberately beyond every jump: only a bug that has compiled all 21 oxygen
helmets (one per consensus witness) can cross the last gap. Troll holes are
his supply lines; whatever a thief drops down one is his.

**Mount Socko** stands on the north tip of the logo, a mountain that is
unmistakably a sock: snow for a cuff, a darned heel, two slanted lights near
the summit. It is where enveloped bugs get posted, visible from the full map
so the displaced can see how far from home they are.

Rides are the friendly half of the same idea. One full rotation on the DHF
ferris wheel earns a breath of **spare air** (a whole extra ring on one jump,
then spent). Drifting against a witness citadel catches the light beam: a
ROUND TRIP up to the crown, where the witness's card opens with their real
chain stats (version, last block, missed blocks), then back down, and the
drift resumes with the air topped up. Both are cosmetic transports: the
player's edge-and-fraction position is never touched mid-ride, which is the
invariant that keeps future multiplayer cheap.

## Verification

The world's invariants can be checked headlessly (the `lib/` and world-building
code is DOM-free and runs under ts-node). During development the game was also
driven in a browser harness that runs the real engine against a scripted
player, which is how the numbers in the commit messages (crossings, gap
widths, frame times) were measured. There is no automated test suite for the
module yet; that is the most honest criticism of it, and the commit history
records what was verified by hand at every pass.

## Design notes (borrowed deliberately)

Choices in this map lean on patterns from games people love returning to,
studied rather than guessed at:

- **Weenies / landmark hierarchy** (theme parks, Zelda): one mega-silhouette
  per region: the tent, the wheel, the citadel ring, Mount Socko, the shard
  castle. You navigate by shapes, not labels.
- **Visible-but-unreachable** (Breath of the Wild's curiosity gap): the
  Emperor's keep is on the map from minute one and out of jump range until
  the helmet hunt is finished. The question "how do I get THERE" is the
  engine of the collectathon.
- **Danger is legible before it is close** (Hollow Knight's area moods): the
  keep corner has a cold aura and no warm light pool; the friendly places
  glow warm. You read safety by colour temperature.
- **Nuisance, not death** (Mario, not roguelikes): every enemy costs time or
  tokens, never progress. The sock trip is a Super Mario World warp pipe with
  a grudge.
- **Travel itself pays** (Odyssey's reward density): tokens, helmets and
  rides are scattered ON the way between places, so movement is never empty.

Candidates deliberately left for later passes: a rotating "buzzing station"
paying double from a date hash, visit-A-then-B destination tickets (Ticket to
Ride), a map-completion counter, and Steem ruins as environmental storytelling.

## Status

Playable and in active development. The commit messages (search `HFU pass`)
are the changelog and each one ends with a KNOWN ISSUES section that says
plainly what is stubbed, unverified or ugly. Current known gaps: thieves walk
straight lines over water, banking has no reward beyond the counter, and
token gifting as post comments is designed but deliberately unbuilt (it
would broadcast).
