# Art direction

Produced by a five-brief design critique cycle (2026-08-21): Bryan fed
board-game-store reference photos and map screenshots to a design agent, the
agent synthesized direction, and pass seventeen implemented the first slice.
This file is the durable record: the direction, the rules every new visual
must obey, the backlog, and the questions still open for Bryan.

## The material story (five sentences)

The Hive world is a thick slab of living red comb-rock, a strange-shaped
planet floating in a deep violet universe that glitters but never shouts.
The planet sheds magic fragments of itself: drifting island chips, floating
stations in its canyon straits, and two great wheels (ferris and rose) that
fill with earned light as players act. Warm light means civic and alive
(gold windows, stained glass, a beating tent-heart); cold light means dead
or dangerous (blue-grey ruins, dim lairs in the wilds). Detail obeys
distance: identity from afar, elaboration up close; get close and find
more. Nothing in the sky, the chrome, or the void may ever outshine the
land, the routes, or the landmarks.

## Hierarchy guardrails (check every new element against these)

- Alpha ceilings: star peaks 0.70 (anchors only), star field average 0.45
  or less, constellation lines 0.15, geometry accents 0.10, streaks 0.10;
  nothing in the void ever reaches alpha 1.0.
- Size ceilings: void elements smaller than the smallest land node (~8px at
  map zoom); anchor stars 4px plus halo, maximum.
- Motion: no ambient period under 2s; one-shot celebrations 1.5s or less;
  ambient drift 3px/s or less; ambient rotation 90s per revolution or more.
- Luminance: void mean under ~8 percent. Squint test: first read is the red
  silhouette, then gold routes, then landmarks. Cut density before color.
- Reserved hues: land red, saturated route gold, saturated lane cyan appear
  nowhere else. Red leaves the planet only as the 5 percent dusty-rose
  stars and (future) coastal chip tops.
- Quiet margins: a star-free band along every coast; a wider fear-fade
  planned around lairs.
- The channels (the logo's negative-space cuts) are CONTENT space, not
  void: one-third star density, small stars only, no constellations or
  streaks there.
- LOD everywhere: every element ships with a far form (shape and color
  only) and a near form (the elaboration). Below ~6px drawn, identity only.
- Text lives in the HUD only, never in the world.
- Performance: pre-render and blit wherever possible; the 12ms map-zoom
  frame budget is the law.

## Shipped in pass seventeen (the S-tier slice)

Colorful screen-space starfield with clumps and twinkle, visible at every
zoom; diagonal light streaks aligned with the logo's slant; five
sacred-geometry constellations tracing Hive iconography (hex, upvote
chevron, key, bee, puppet tower), fixed forever so they double as unlabeled
navigation landmarks; the land's drop shadow (thick slab, light from
upper-left) and a gentle rim-only curvature dim; honeycomb interior texture
at play zoom (the planet IS a comb); line-weight rebalance per Bryan's
ruling (gold 1.3x cyan, cyan unchanged, streets 0.5x cyan with a 2px map
floor, gold bloom halved); the oxygen helmet became a WORN glass dome on
the bug's head, bee-astronaut style; the Basecamp tent's doorway light now
beats like a heart (quick rise, slow fall, 1.2s); witness towers gained lit
windows with a blinking few; the warp effect became a three-arm color
spiral (the bike-wheel brief); Copypasta got big adorable eyes with
catchlights; MAP and HOP buttons shrank ~30 percent (hit targets kept).

## Backlog (designed, parameterized, not yet built)

Medium effort: collectible gems (faceted stickers, eye candy, no economy
yet, per Bryan); floating island chips (coastal red-top and deep-void
crystal-top variants, one structure each, gentle hover); the icon grammar
plus sprite atlas (plate shape = type, plate color = family, glyph =
identity, two-tier LOD); the ferris trophy wheel (8 gondola sockets, bring
an item, ride one rotation, it mounts for the board; first item: a
helmet); channel ports, tethers, ferries and periscope events; the striped
celebration card and arcade interior (UI layer only).

Large effort: channel stations (self-lit modular link platforms); the Rose
Window link cathedral (the wider channel's bridge-base, panes light as the
player actually uses Hive, twin-wheel composition with the ferris);
monster lairs and the elaborated near-scene Steem Ruins (small on the map,
big in the frame).

Deliberately deferred: cliff-band coast strokes (needs coast geometry
work), harbor silhouettes at ports (needs ports first), expansion seeds
(edge-fading road, wrap-around orbiter), control-button chrome redesign.

## Open questions for Bryan (designer recommendation in parentheses)

1. Rose Window inner-six pane inventory? (Write Post, Wallet, Sign Up,
   Communities, Notifications, Profile)
2. Streets: recolor warm rose, or keep the neutral pale at the new width?
   (keep neutral, re-judge now that the rebalance shipped)
3. Streak orange in or out, given gold-ambiguity risk? (in at whisper
   alpha; first thing cut if the squint test fails)
4. Retrofit community ring badges to the dim-until-visited socket grammar?
   (yes, with a resting floor so the ring never looks broken)
5. Lair beast species? Octopus is taken by Copypasta. (a dragon or serpent;
   one silhouette per creature)
6. Amber gems next to route gold: acceptable? (yes; small faceted shapes
   with dark outlines read differently than lines)
7. Trophy slots locked at 8? (yes, fillable within one 30-minute board)
8. Helmet trophy: first helmet mounts, or require all 21? (first mounts;
   the HELMETS counter tracks the rest)
9. Control chrome redesign now or later? (later; resize shipped first)
10. Coastal chip count: 5 per coast enough magic? (yes; scarcity is the
    magic)
