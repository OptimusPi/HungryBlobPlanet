# HungryBlobPlanet

A spherical 3D planetary Suika-merge + chonk-evolution arcade game built with **`@pinkaphant/kolmo`**, **`@khr3/*`**, **`@pinkaphant/ecctrl`**, **React Three Fiber**, and **Rapier**, deployed on **Cloudflare Workers**.

## Concept & Kolmogorov Simplicity

Instead of downloading gigabytes of textures or external character rigs, **HungryBlobPlanet** generates its world, physics, audio, and entities from compact mathematical seeds:

- **Spherical Point Gravity Planet (`R = 120 m`)**: A subdivided icosahedron (`IcosahedronGeometry(120, 5)`) with deterministic trigonometric biome coloring (Alien Mint pastures, Berry Oceans, Mango Craters, and a Neon Equator Space-Car Speedway) paired with a Rapier `BallCollider` and `KolmoPointGravity`.
- **Dynamic Hungry Blob Alien (Glorb) & Rival Blob Council**: A glossy sphere that grows asymptotically fatter (`0.44 m` → `1.85 m`) as it eats Suika orbs matching its **color + shape craving halo** (`T00 Ruby Pyramid` → `T01 Amber Cube` → `T02 Helios Dodecahedron` → `T03 Beryl Octahedron` → `T04 Cerenkov Icosahedron` → `T05 Cobalt Geodesic` → `T06 Violet Geode`). Tiny stick legs and stick arms wave faster as he gets fatter, and eating an orb wraps Glorb in that polyhedron's translucent shape-shift shell!
- **Golden-Ratio Suika Launcher (`@pinkaphant/kolmo/suika` + `@khr3/launchers`)**: Fire Suika orbs across the curved horizon; matching tiers collide and merge up the golden-ratio ladder (`1.618×`) with combo popups and procedural Web Audio chimes.
- **3D Math Space Cars & Fighter Space Jets (`@khr3/vehicles` + `@pinkaphant/kolmo/importer`)**: Hop into the **Space Drift 86** (`buildPaperShellAssembly` / `coupe_86`) or launch in the **Delta Starfighter** (`buildProceduralCraftScene("starfighter_delta")` + `compileKhrAssetGlb`), or spawn extra 3D-math cars/crafts (`sedan_92`, `kei_van`, `vtol_dropship`, `hover_skiff`, `orbital_lander`) from the Stuff Maker (`[Tab]`).
- **Destructible BVH Junk & Bundled CubicWave GLBs (`@pinkaphant/kolmo/junk`)**: Blast labeled cans (`GARY'S BEANS`, `TRIS' SODA`, `GOOFY EMOJI`), glass bottles, and bundled Khronos-VALID `.glb` props (`ss_crate_small_1m`, `ss_canister_fuel_1m`, `ss_tank_oxygen_1.2m`, `prop_vending_soda`, `obs_banana_crate_spill`, `obs_fire_hydrant_geyser`, `launcher_potato_cannon`) into dynamic physics shards, or drag-and-drop any `.glb` / `.usd` / `.sand3d` file onto the planet.

## Controls

- `W A S D` + `Space` — Walk/jump on stick legs, drive Space Car, or pilot Fighter Jet
- `Left Click` / `[J]` / `FIRE!` — Launch Suika orb (`[1]`), fire Junk Blaster (`[2]`), or drop Stuff (`[3]`)
- `[H]` / `CHOMP` — Force-chomp nearby orb
- `[F]` (or top-right hop buttons) — Board / Exit Space Car or Fighter Jet
- `[R]` — Flip vehicle upright relative to local planetary normal
- `[Tab]` — Open the **Stuff Maker & GLB Importer** drawer

## Development

```bash
npm install
npm run lint
npm test
npm run build
npx wrangler deploy
```
