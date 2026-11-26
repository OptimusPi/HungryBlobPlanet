# HungryBlobPlanet — Agent & Contributor Guide

- **Pinned Stack**: Resolve `@pinkaphant/kolmo` (`^0.4.5`) and `@khr3/*` from npm with `"@pinkaphant/ecctrl": "2.0.4-beta.4"`, `"@dimforge/rapier3d-compat": "0.19.2"`, and `"three": "0.184.0"` pinned in `dependencies` and `overrides`, bundled via `@pinkaphant/kolmo/vite`.
- **Planetary Physics & Vehicles**: Step radial `KolmoPointGravity` (`R = 120 m`), golden-ratio `<SuikaSystem>` merges, destructible `<KolmoJunk>` props, Kolmogorov math space cars (`coupe_86`, `sedan_92`, `kei_van`), and `starfighter_delta` craft via `useFrame` refs and `@pinkaphant/ecctrl@2.0.4-beta.4`.
- **UX & Hygiene**: Use `100dvh`, `viewport-fit=cover`, `env(safe-area-inset-*)`, `canvas { touch-action: none; }`, `0.08` stick deadzone, `>= 44x44 px` touch buttons, DOM-ref HUD updates, and `<= 250`-line modules. Verify with `npm run lint && npm test && npm run build`.
