/**
 * Hive Frontend Universe - the three landmasses.
 *
 * The ground is not an abstract blob. Its silhouette is the REAL Hive mark
 * (viewBox 0 0 220 190, the same path data the site header uses, see
 * engine/icons.ts) eroded into terrain: the solid DIAMOND on the left, and the
 * two CHEVRON BLADES in the centre and east.
 *
 * Each piece is filled with overlapping globular cells of hard-mixed sizes
 * (largest is ~6.7x the smallest radius), inscribed inside the mark with a
 * generous inset. That inset is the erosion: it eats the mark's sharp corners,
 * scallops the outline, and leaves a ragged coastline rather than vector
 * edges. The intent is that at play zoom this is simply terrain, and only at
 * full map zoom does the mark dawn on you.
 *
 * The two CHANNELS between the three landmasses are the wide gaps. They are
 * measured on the ragged rims (not assumed) and reported by engine/world.ts
 * against the simulated max hop distance.
 *
 * This table is GENERATED, not hand-placed, and is therefore identical for
 * every player forever: the silhouette never varies by window, only the mesh
 * woven inside it does. Regenerate with the offline script described in the
 * pass-six notes; hand-tunable positions live in fixed-world.ts instead.
 *
 * Packed as flat quads [x, y, r, landmass] to keep the file readable.
 */

/** Landmass ids. Index into LANDMASS_KEYS; -1 means open void. */
export const LANDMASS_KEYS = ['diamond', 'centre_blade', 'east_blade'] as const;
export type LandmassKey = (typeof LANDMASS_KEYS)[number];
export const LANDMASS_COUNT = LANDMASS_KEYS.length;

/** One globular terrain cell. Sizes are mixed hard on purpose. */
export interface BodyCell {
  x: number;
  y: number;
  r: number;
  /** Which landmass this cell belongs to (index into LANDMASS_KEYS). */
  land: number;
  /**
   * True for the narrow isthmus cells that bridge the two straits. The mesh
   * treats them as ordinary land, so rail lines weave across freely; the
   * ground paints them dimmer so the three-piece silhouette still reads.
   */
  strait?: boolean;
}

const CELL_DATA: readonly number[] = [
  -3031, -7, 286, 0,  -3017, 273, 286, 0,  -3031, -287, 462, 0,  -2765, 91, 672, 0,  -3423, -7, 462, 0,  -3017, 707, 672, 0,
  -3031, -749, 286, 0,  -3031, -1029, 286, 0,  -3311, -651, 286, 0,  -2751, -651, 672, 0,  -3521, -455, 286, 0,  -3031, -1309, 462, 0,
  -3017, 1379, 462, 0,  -3619, 413, 840, 0,  -3353, -931, 462, 0,  -2107, 7, 286, 0,  -2205, -259, 286, 0,  -3801, -399, 286, 0,
  -2345, 609, 840, 0,  -3031, -1771, 286, 0,  -3017, 1841, 286, 0,  -3731, -679, 462, 0,  -3451, 1225, 462, 0,  -3031, -2051, 286, 0,
  -4067, -287, 672, 0,  -2569, -1295, 840, 0,  -1827, -35, 840, 0,  -3017, 2121, 462, 0,  -3311, -1673, 672, 0,  -2555, 1407, 840, 0,
  -3325, 1715, 286, 0,  -3031, -2331, 840, 0,  -3745, -1169, 672, 0,  -3017, 2583, 462, 0,  -3605, 1659, 672, 0,  -4445, 259, 286, 0,
  -4655, 21, 286, 0,  -1869, -861, 286, 0,  -4025, 1141, 286, 0,  -4431, 553, 286, 0,  -2569, 2233, 672, 0,  -3437, 2303, 462, 0,
  -4249, 945, 840, 0,  -3017, 3045, 462, 0,  -4347, -889, 672, 0,  -4725, -259, 672, 0,  -3045, -3157, 672, 0,  -1589, -833, 840, 0,
  -1519, 735, 462, 0,  -1757, 1197, 462, 0,  -3955, -1813, 840, 0,  -2247, -2065, 462, 0,  -1001, 7, 277, 0,  -3437, 2765, 272, 0,
  -3017, 3507, 624, 0,  -4865, 385, 263, 0,  -1057, 273, 720, 0,  -2583, 2905, 576, 0,  -1897, -1771, 374, 0,  -3899, 2261, 221, 0,
  -1771, 1659, 641, 0,  -3479, 3031, 342, 0,  -3045, -3829, 616, 0,  -5117, 273, 488, 0,  -3717, 2667, 481, 0,  -4263, 1771, 198, 0,
  -2233, -2541, 576, 0,  -3661, -2863, 562, 0,  -4081, 2121, 309, 0,  -875, -413, 164, 0,  -1281, 1127, 386, 0,  -3003, 4123, 463, 0,
  -5383, -133, 355, 0,  -1911, 2275, 443, 0,  -2387, -3087, 237, 0,  -1547, -1659, 237, 0,  -4459, 1743, 339, 0,  -1799, -2135, 323, 0,
  -5005, -861, 146, 0,  -5061, 749, 222, 0,  -4697, -1449, 208, 0,  -721, -357, 146, 0,  -4137, 2429, 146, 0,  -2051, 2695, 194, 0,
  -805, -567, 186, 0,  -3619, 3339, 271, 0,  -4991, -1029, 266, 0,  -5131, -791, 183, 0,  -2415, -3353, 175, 0,  -4389, 2079, 146, 0,
  -1561, -1925, 146, 0,  -595, -273, 146, 0,  -4865, -1309, 239, 0,  -5341, -497, 299, 0,  -3045, -4445, 161, 0,  -2499, -3535, 161, 0,
  -5075, 973, 223, 0,  -3591, -3535, 146, 0,  -497, -161, 146, 0,  -413, -21, 279, 0,  -3801, 3143, 146, 0,  -2401, 3451, 219, 0,
  -4291, 2345, 146, 0,  -3689, -3423, 146, 0,  -4165, -2611, 196, 0,  -5607, 133, 146, 0,  -931, 973, 146, 0,  -1309, -1617, 146, 0,
  -637, -483, 192, 0,  -4179, 2569, 146, 0,  -5705, 7, 180, 0,  -5285, 721, 225, 0,  -4781, 1575, 146, 0,  -4389, 2233, 180, 0,
  -3017, 4585, 146, 0,  -1421, -1855, 146, 0,  -4767, -1645, 146, 0,  -2009, 2891, 171, 0,  -3045, -4613, 206, 0,  -2149, -3101, 164, 0,
  -763, -749, 206, 0,  -2247, -3283, 160, 0,  -5033, 1197, 146, 0,  -4893, 1463, 146, 0,  -3619, 3619, 146, 0,  -2457, -3689, 146, 0,
  -1155, 1491, 146, 0,  -4543, 2065, 146, 0,  -3941, 3087, 146, 0,  -2429, 3675, 146, 0,  -2583, 3941, 146, 0,  -1491, -2051, 174, 0,
  -4977, 1337, 146, 0,  -3437, 3955, 174, 0,  -2877, -4417, 166, 0,  -3633, -3675, 146, 0,  -5313, -791, 146, 0,  -455, -301, 146, 0,
  -5607, 287, 146, 0,  -4305, 2499, 166, 0,  -1855, 2709, 146, 0,  -3213, -4417, 146, 0,  -2331, -3507, 146, 0,  -4879, -1547, 146, 0,
  -5243, -931, 146, 0,  -2205, 3325, 146, 0,  -2485, 3815, 146, 0,  -1169, -1547, 146, 0,  -2037, 3059, 146, 0,  -3577, 3759, 146, 0,
  -1295, -1771, 146, 0,  -791, 931, 146, 0,  -4193, 2723, 146, 0,  -3731, -3563, 140, 0,  -3829, -3395, 140, 0,  -1673, -2429, 140, 0,
  -889, 1113, 140, 0,  -3017, 4739, 140, 0,  -4795, 1729, 135, 0,  -2107, 3213, 135, 0,  -3885, 3269, 135, 0,  -357, -4543, 582, 1,
  -63, -4053, 198, 1,  35, -3885, 198, 1,  133, -3717, 465, 1,  357, -3311, 320, 1,  525, -3031, 198, 1,  623, -2863, 198, 1,
  721, -2695, 582, 1,  1001, -2191, 320, 1,  1169, -1925, 320, 1,  1323, -1645, 320, 1,  1435, 1463, 198, 1,  1337, 1631, 198, 1,
  1239, 1799, 198, 1,  1141, 1967, 198, 1,  1043, 2135, 465, 1,  805, 2541, 320, 1,  637, 2821, 582, 1,  357, 3325, 320, 1,
  189, 3605, 198, 1,  91, 3773, 465, 1,  -147, 4179, 320, 1,  -301, 4459, 198, 1,  1491, -1379, 196, 1,  -441, 4599, 295, 1,
  1603, 1365, 483, 1,  1659, -1281, 477, 1,  1141, 1631, 230, 1,  1435, 1813, 318, 1,  -245, -3983, 216, 1,  -441, 4305, 146, 1,
  -105, 4501, 146, 1,  -693, 4753, 384, 1,  91, -4179, 302, 1,  -147, 4641, 282, 1,  245, -3017, 266, 1,  679, -3269, 146, 1,
  1001, -1659, 168, 1,  1169, -1365, 305, 1,  847, -1911, 239, 1,  -847, -4837, 146, 1,  1323, -2205, 146, 1,  1491, -1911, 164, 1,
  2023, -987, 164, 1,  2219, -665, 146, 1,  1981, 1071, 161, 1,  35, 3311, 161, 1,  525, 3591, 161, 1,  2247, -525, 146, 1,
  2233, -371, 157, 1,  2233, -217, 146, 1,  2233, -63, 146, 1,  2233, 91, 228, 1,  2233, 315, 146, 1,  2233, 469, 146, 1,
  2233, 623, 146, 1,  -469, 4165, 228, 1,  49, 4431, 228, 1,  567, -3549, 146, 1,  1225, -2415, 223, 1,  2135, -833, 153, 1,
  1127, 1393, 146, 1,  -343, 3927, 146, 1,  35, -3269, 150, 1,  133, 3101, 150, 1,  175, 4235, 273, 1,  -315, 4865, 217, 1,
  2177, 777, 216, 1,  651, -3423, 212, 1,  693, -2121, 146, 1,  1617, -1757, 146, 1,  665, 3395, 265, 1,  -609, 4361, 207, 1,
  1435, -2093, 146, 1,  917, 1687, 146, 1,  595, 2247, 146, 1,  1169, 2583, 146, 1,  -973, -4907, 176, 1,  -329, -3787, 214, 1,
  1239, -1071, 146, 1,  2121, 987, 146, 1,  1141, 1239, 146, 1,  1225, 1071, 146, 1,  -469, -3983, 155, 1,  833, -3255, 146, 1,
  -1015, 4949, 146, 1,  987, 1463, 149, 1,  -119, 3367, 146, 1,  595, -3689, 146, 1,  -105, -3325, 146, 1,  2359, -637, 146, 1,
  1505, 2121, 146, 1,  -7, 3157, 146, 1,  553, 3759, 180, 1,  -371, 3787, 180, 1,  -777, -4963, 146, 1,  2359, -147, 146, 1,
  2359, 385, 146, 1,  2359, 539, 146, 1,  2079, -693, 146, 1,  -917, -4711, 166, 1,  -105, 4921, 146, 1,  1463, -2233, 146, 1,
  833, -1673, 146, 1,  2191, -973, 146, 1,  2289, -791, 146, 1,  2107, -553, 160, 1,  2373, -455, 146, 1,  2373, -301, 146, 1,
  2107, -147, 160, 1,  2107, 385, 146, 1,  2107, 539, 146, 1,  -7, -3115, 146, 1,  1659, -1897, 146, 1,  2107, -1127, 146, 1,
  777, 1757, 154, 1,  581, 2093, 146, 1,  385, -4109, 146, 1,  539, -2149, 146, 1,  1575, -2051, 146, 1,  903, -1519, 146, 1,
  2065, 1211, 146, 1,  1323, 2499, 146, 1,  77, 2961, 146, 1,  -497, 3941, 146, 1,  1309, -945, 146, 1,  623, -1995, 140, 1,
  2373, 693, 140, 1,  1995, 903, 140, 1,  1869, 959, 136, 1,  1771, -1743, 135, 1,  455, 2275, 135, 1,  1897, -875, 134, 1,
  -1127, -5005, 132, 1,  2079, -399, 132, 1,  2401, 245, 132, 1,  -301, -3563, 126, 1,  -217, -3423, 126, 1,  1211, 2723, 126, 1,
  413, 4109, 126, 1,  5257, -7, 346, 2,  5103, -315, 481, 2,  5103, 315, 481, 2,  3185, -3661, 201, 2,  3339, -3395, 324, 2,
  3647, -2863, 324, 2,  4361, -1631, 201, 2,  4515, -1365, 590, 2,  4823, -833, 472, 2,  4823, 833, 590, 2,  4515, 1365, 201, 2,
  4361, 1631, 201, 2,  3647, 2863, 324, 2,  3339, 3395, 472, 2,  2667, -4543, 320, 2,  2835, -4277, 320, 2,  2989, -3997, 320, 2,
  3815, -2583, 320, 2,  3969, -2303, 198, 2,  4067, -2135, 465, 2,  4249, 1813, 198, 2,  4151, 1981, 320, 2,  3997, 2261, 465, 2,
  3101, 3801, 582, 2,  2807, 4305, 465, 2,  2499, 4655, 164, 2,  3395, -3073, 377, 2,  4319, 1435, 244, 2,  4557, 1561, 355, 2,
  2401, -4711, 234, 2,  3269, -3843, 334, 2,  2975, -3675, 404, 2,  4151, 1645, 323, 2,  3633, 2541, 146, 2,  3941, 2723, 146, 2,
  2345, 4739, 219, 2,  2639, 4739, 219, 2,  4361, 1197, 146, 2,  4459, 1897, 287, 2,  3745, 3171, 186, 2,  3661, -3339, 324, 2,
  3325, 2919, 146, 2,  2401, 4515, 324, 2,  2821, -4823, 146, 2,  5607, -7, 313, 2,  2667, -4011, 168, 2,  3493, -2583, 244, 2,
  3647, -2317, 146, 2,  4487, -1953, 168, 2,  4025, -1673, 146, 2,  3493, 2583, 168, 2,  2191, -4837, 300, 2,  2513, -4263, 239, 2,
  2989, -4557, 146, 2,  3157, -4263, 239, 2,  3969, -2863, 146, 2,  3969, 2863, 299, 2,  2863, 4767, 299, 2,  2583, -4851, 157, 2,
  4137, -2597, 285, 2,  3535, -3647, 146, 2,  3563, 2415, 146, 2,  2149, 4851, 279, 2,  2933, -4711, 146, 2,  2345, -4487, 146, 2,
  3045, -3269, 146, 2,  3885, -3087, 146, 2,  3367, 2709, 259, 2,  3871, 1813, 239, 2,  4291, 1071, 187, 2,  4879, 1421, 234, 2,
  2485, 4907, 146, 2,  4179, 1239, 146, 2,  3185, 2947, 146, 2,  3885, -1715, 146, 2,  5285, -763, 164, 2,  4459, 2191, 206, 2,
  2723, -4935, 161, 2,  3129, -4501, 160, 2,  3605, -2177, 155, 2,  4627, -413, 146, 2,  3801, 3353, 146, 2,  4011, -3003, 146, 2,
  5579, 301, 146, 2,  4207, 2667, 146, 2,  3927, 3157, 146, 2,  2891, -4949, 146, 2,  3283, -2709, 146, 2,  4529, -2121, 180, 2,
  3955, -1547, 180, 2,  5579, -315, 146, 2,  3535, 2275, 146, 2,  3493, -2331, 146, 2,  4067, 1337, 146, 2,  2457, -4963, 146, 2,
  2625, 4963, 146, 2,  2205, -4543, 146, 2,  2611, -3843, 166, 2,  4655, -1939, 146, 2,  3073, -4683, 146, 2,  3381, -4151, 146, 2,
  2499, -4025, 146, 2,  3017, -3129, 146, 2,  4109, -2891, 146, 2,  4361, -805, 146, 2,  3605, -3773, 146, 2,  3269, 4347, 146, 2,
  5089, -1225, 146, 2,  5397, 693, 146, 2,  3409, 2429, 146, 2,  2541, 3927, 146, 2,  1925, -4991, 146, 2,  3003, -4837, 140, 2,
  2289, -4347, 140, 2,  3059, 3017, 140, 2,  5425, -665, 135, 2,  1911, 4991, 135, 2,  2891, -3283, 126, 2,  3955, -3213, 126, 2,
  4389, -2471, 126, 2,  3619, -2023, 126, 2,  3759, -1785, 126, 2,  4501, -497, 126, 2,  4627, 287, 126, 2,  4739, 1869, 126, 2,
  3157, 4599, 126, 2
];

/**
 * THE STRAITS. Pass six sized the two channels as uncrossable walls and the
 * world became three sealed islands: half the posts were unreachable, the post
 * line could only serve one piece, and map travel silently refused every
 * landmark off the spawn's landmass. Pass seven reverses that.
 *
 * These hand-tuned chains of small cells are narrow land bridges. There are
 * FOUR of them: a northern and a southern crossing between each adjacent pair
 * of landmasses, so the world has a ring rather than a single chokepoint and
 * a player never has to double back the length of a blade to change piece.
 * Each was placed at the narrowest open water in its half (1312 to 1417px).
 *
 * They are ordinary land as far as the mask and the mesh are concerned, so the
 * weave runs across them under the same rules as everywhere else and no
 * special-case bridging code exists anywhere. Only the paint treats them
 * differently, dimming so the three-piece mark still reads.
 *
 * Move a bridge by editing these coordinates; widen one by raising its radii.
 */
const STRAIT_CELLS: readonly BodyCell[] = [
  /* ---- NORTHERN crossings ---- */
  // diamond to centre_blade, north (1348px of open water at its narrowest)
  { x: -1156, y: -1623, r: 193, land: 0, strait: true },
  { x: -1033, y: -1714, r: 207, land: 0, strait: true },
  { x: -791, y: -1856, r: 220, land: 0, strait: true },
  { x: -664, y: -1937, r: 229, land: 0, strait: true },
  { x: -532, y: -2010, r: 234, land: 0, strait: true },
  { x: -396, y: -2073, r: 234, land: 1, strait: true },
  { x: -256, y: -2126, r: 229, land: 1, strait: true },
  { x: -112, y: -2171, r: 220, land: 1, strait: true },
  { x: 153, y: -2264, r: 207, land: 1, strait: true },
  { x: 302, y: -2299, r: 193, land: 1, strait: true },
  // centre_blade to east_blade, north (1417px at its narrowest)
  { x: 1187, y: -2796, r: 193, land: 1, strait: true },
  { x: 1327, y: -2831, r: 206, land: 1, strait: true },
  { x: 1583, y: -2923, r: 218, land: 1, strait: true },
  { x: 1720, y: -2965, r: 227, land: 1, strait: true },
  { x: 1853, y: -3014, r: 233, land: 1, strait: true },
  { x: 1984, y: -3070, r: 235, land: 2, strait: true },
  { x: 2110, y: -3134, r: 233, land: 2, strait: true },
  { x: 2233, y: -3205, r: 227, land: 2, strait: true },
  { x: 2353, y: -3283, r: 218, land: 2, strait: true },
  { x: 2588, y: -3421, r: 206, land: 2, strait: true },
  { x: 2704, y: -3506, r: 193, land: 2, strait: true },

  /* ---- SOUTHERN crossings ---- */
  // diamond to centre_blade, south
  { x: -1086, y: 1653, r: 205, land: 0, strait: true },
  { x: -982, y: 1759, r: 220, land: 0, strait: true },
  { x: -761, y: 1939, r: 234, land: 0, strait: true },
  { x: -651, y: 2037, r: 244, land: 0, strait: true },
  { x: -536, y: 2127, r: 249, land: 0, strait: true },
  { x: -415, y: 2208, r: 249, land: 1, strait: true },
  { x: -288, y: 2280, r: 244, land: 1, strait: true },
  { x: -156, y: 2344, r: 234, land: 1, strait: true },
  { x: 95, y: 2479, r: 220, land: 1, strait: true },
  { x: 233, y: 2535, r: 205, land: 1, strait: true },
  // centre_blade to east_blade, south
  { x: 2060, y: 1530, r: 205, land: 1, strait: true },
  { x: 2188, y: 1609, r: 220, land: 1, strait: true },
  { x: 2413, y: 1785, r: 234, land: 1, strait: true },
  { x: 2533, y: 1872, r: 244, land: 1, strait: true },
  { x: 2647, y: 1965, r: 249, land: 1, strait: true },
  { x: 2754, y: 2067, r: 249, land: 2, strait: true },
  { x: 2853, y: 2176, r: 244, land: 2, strait: true },
  { x: 2946, y: 2291, r: 234, land: 2, strait: true },
  { x: 3134, y: 2507, r: 220, land: 2, strait: true },
  { x: 3219, y: 2630, r: 205, land: 2, strait: true }
];

export const BODY_CELLS: readonly BodyCell[] = (() => {
  const out: BodyCell[] = [];
  for (let i = 0; i < CELL_DATA.length; i += 4) {
    out.push({ x: CELL_DATA[i], y: CELL_DATA[i + 1], r: CELL_DATA[i + 2], land: CELL_DATA[i + 3] });
  }
  return out.concat(STRAIT_CELLS);
})();

/**
 * Coastline noise: each cell's radius is modulated around its rim so the edge
 * is ragged like a coastline, never a smooth circle. Phases are index-hashed,
 * so the coast is identical for everyone forever.
 */
export function cellRadiusAt(cellIndex: number, angleRad: number): number {
  const cell = BODY_CELLS[cellIndex];
  const p1 = ((cellIndex * 2654435761) % 628) / 100;
  const p2 = ((cellIndex * 40503 + 977) % 628) / 100;
  const p3 = ((cellIndex * 22695477 + 311) % 628) / 100;
  // Three octaves at roughly +/- 27%. The first pass used +/- 16%, which left
  // the coast too smooth: at map zoom the landmasses read as three clean
  // shapes, which is to say as a logo rather than as terrain. Deeper, lumpier
  // rims are what keep the mark from looking like a billboard.
  return (
    cell.r *
    (1 +
      0.16 * Math.sin(5 * angleRad + p1) +
      0.09 * Math.sin(9 * angleRad + p2) +
      0.05 * Math.sin(14 * angleRad + p3))
  );
}

/**
 * Bucket grid over the cells. The mesh generator calls the region test tens of
 * thousands of times while filling, so a linear scan of 400+ cells would show
 * up in world build time.
 */
const GRID_CELL = 900;
const gridKey = (cx: number, cy: number): number => (cx + 4096) * 8192 + (cy + 4096);
const CELL_GRID: Map<number, number[]> = (() => {
  const map = new Map<number, number[]>();
  BODY_CELLS.forEach((c, i) => {
    const rMax = c.r * 1.32;
    for (let cx = Math.floor((c.x - rMax) / GRID_CELL); cx <= Math.floor((c.x + rMax) / GRID_CELL); cx++) {
      for (let cy = Math.floor((c.y - rMax) / GRID_CELL); cy <= Math.floor((c.y + rMax) / GRID_CELL); cy++) {
        const k = gridKey(cx, cy);
        const arr = map.get(k);
        if (arr) arr.push(i);
        else map.set(k, [i]);
      }
    }
  });
  return map;
})();

/** Which landmass covers this point, or -1 for open void. */
export function landmassAt(x: number, y: number): number {
  const bucket = CELL_GRID.get(gridKey(Math.floor(x / GRID_CELL), Math.floor(y / GRID_CELL)));
  if (!bucket) return -1;
  for (const i of bucket) {
    const c = BODY_CELLS[i];
    const dx = x - c.x;
    const dy = y - c.y;
    const d2 = dx * dx + dy * dy;
    const rMax = c.r * 1.32;
    if (d2 > rMax * rMax) continue;
    const rr = cellRadiusAt(i, Math.atan2(dy, dx));
    if (d2 <= rr * rr) return c.land;
  }
  return -1;
}

/** Region test: on any landmass. */
export function insideBody(x: number, y: number): boolean {
  return landmassAt(x, y) >= 0;
}

/** Cell indexes belonging to one landmass. */
export function cellsOfLandmass(land: number): number[] {
  const out: number[] = [];
  BODY_CELLS.forEach((c, i) => {
    if (c.land === land) out.push(i);
  });
  return out;
}

/**
 * Seeded sampler, area-weighted across ALL three landmasses, so live posts
 * spread over the whole world rather than crowding the biggest piece.
 */
export function sampleBodyPoint(rng: () => number): { x: number; y: number } {
  const weights = BODY_CELLS.map((c) => c.r * c.r);
  const total = weights.reduce((a, b) => a + b, 0);
  for (let attempt = 0; attempt < 24; attempt++) {
    let pick = rng() * total;
    let idx = 0;
    while (idx < BODY_CELLS.length - 1 && pick >= weights[idx]) {
      pick -= weights[idx];
      idx++;
    }
    const c = BODY_CELLS[idx];
    const ang = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * c.r * 0.92;
    const x = c.x + Math.cos(ang) * rad;
    const y = c.y + Math.sin(ang) * rad;
    if (insideBody(x, y)) return { x, y };
  }
  return { x: BODY_CELLS[0].x, y: BODY_CELLS[0].y };
}

/**
 * Distance from a landmass-interior origin out to its coast along a ray,
 * marched so it respects the ragged noise. Used to float community bubbles
 * just off a chosen coastline.
 */
export function coastDistanceFrom(
  originX: number,
  originY: number,
  angleDeg: number,
  land: number
): number {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = -Math.sin(rad);
  let last = 0;
  for (let r = 120; r <= 9000; r += 40) {
    if (landmassAt(originX + dx * r, originY + dy * r) === land) last = r;
  }
  return last;
}
