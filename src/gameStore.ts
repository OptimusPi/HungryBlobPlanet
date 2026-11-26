import { create } from "zustand";
import type { DestructibleTargetSpec, JunkKind, ProceduralLabelId, RetroPresetId } from "@pinkaphant/kolmo";
import type { OrbShape } from "@pinkaphant/kolmo/suika";
import { setAudioMuted } from "./audioSynth";
import {
  PLANET_RADIUS,
  computeBlobRadius,
  computeBlobWeightKg,
  getChonkTitle,
  latLonToPosition,
  nextCravingTier,
  shapeForTier,
  surfacePoseFromDir,
} from "./planetMath";

export type ToolMode = "suika" | "blaster" | "spawner";

export interface PlasmaBolt {
  readonly id: string;
  readonly pos: [number, number, number];
  readonly vel: [number, number, number];
  readonly color: string;
  readonly bornAt: number;
}

export interface SpawnedVehicleEntry {
  readonly id: string;
  readonly label: string;
  readonly kind: "car" | "craft" | "imported";
  readonly presetOrRecipe: string;
  readonly position: [number, number, number];
  readonly rotation: [number, number, number];
  readonly glbBytes?: Uint8Array;
  readonly glbUrl?: string;
}

export interface NpcBlobState {
  readonly id: string;
  readonly name: string;
  readonly position: [number, number, number];
  readonly heading: [number, number, number];
  readonly mealsEaten: number;
  readonly cravingTier: number;
  readonly bodyColor: string;
  readonly lastQuip: string;
}

export const BUNDLED_GLB_PRESETS = [
  { id: "ss_crate_small_1m", label: "Space Crate (1m)", url: "/assets/ss_crate_small_1m.glb", hp: 50 },
  { id: "ss_canister_fuel_1m", label: "Fuel Canister", url: "/assets/ss_canister_fuel_1m.glb", hp: 35 },
  { id: "ss_tank_oxygen_1.2m", label: "O2 Pressurized Tank", url: "/assets/ss_tank_oxygen_1.2m.glb", hp: 35 },
  { id: "prop_vending_soda", label: "Space Soda Machine", url: "/assets/prop_vending_soda.glb", hp: 70 },
  { id: "obs_banana_crate_spill", label: "Banana Crate Spill", url: "/assets/obs_banana_crate_spill.glb", hp: 35 },
  { id: "obs_fire_hydrant_geyser", label: "Fire Hydrant Geyser", url: "/assets/obs_fire_hydrant_geyser.glb", hp: 55 },
  { id: "launcher_potato_cannon", label: "Potato Cannon Prop", url: "/assets/launcher_potato_cannon.glb", hp: 45 },
] as const;

/** Mutable high-frequency telemetry read inside 60 Hz useFrame hooks without re-renders. */
export const playerBlobMotion = {
  speed: 0,
  chompPulse: 0,
  burpPulse: 0,
  nearCravingDist: Infinity,
  lastEatColor: "#22d3ee",
  worldPos: [0, PLANET_RADIUS + 1.5, 0] as [number, number, number],
  worldUp: [0, 1, 0] as [number, number, number],
};

function createInitialTargets(): DestructibleTargetSpec[] {
  const specs: Array<{
    lat: number;
    lon: number;
    kind: JunkKind;
    labelId: ProceduralLabelId;
    url?: string;
    hp: number;
  }> = [
    { lat: 74, lon: 25, kind: "tin-can", labelId: "garys-beans", hp: 40 },
    { lat: 70, lon: -32, kind: "tin-can", labelId: "tris-soda", hp: 40 },
    { lat: 64, lon: 68, kind: "tin-can", labelId: "goofy-emoji", hp: 40 },
    { lat: 60, lon: -75, kind: "glass-bottle", labelId: "tris-soda", hp: 20 },
    { lat: 52, lon: 115, kind: "glass-bottle", labelId: "target", hp: 20 },
    { lat: 46, lon: -140, kind: "tin-can", labelId: "garys-beans", hp: 40 },
    { lat: 36, lon: 15, kind: "imported-glb", labelId: "custom", url: "/assets/ss_crate_small_1m.glb", hp: 45 },
    { lat: 30, lon: -55, kind: "imported-glb", labelId: "custom", url: "/assets/ss_canister_fuel_1m.glb", hp: 35 },
    { lat: 24, lon: 95, kind: "imported-glb", labelId: "custom", url: "/assets/obs_banana_crate_spill.glb", hp: 35 },
    { lat: 16, lon: -120, kind: "imported-glb", labelId: "custom", url: "/assets/prop_vending_soda.glb", hp: 65 },
    { lat: -12, lon: 42, kind: "imported-glb", labelId: "custom", url: "/assets/obs_fire_hydrant_geyser.glb", hp: 50 },
    { lat: -22, lon: -85, kind: "imported-glb", labelId: "custom", url: "/assets/ss_tank_oxygen_1.2m.glb", hp: 35 },
  ];

  return specs.map((s, idx) => {
    const dir = latLonToPosition(s.lat, s.lon, 1);
    const pose = surfacePoseFromDir(dir, 1.4);
    return {
      id: `junk_init_${idx}`,
      kind: s.kind,
      labelId: s.labelId,
      customAlbedoUrl: null,
      canLodMode: "auto",
      position: pose.position,
      hp: s.hp,
      maxHp: s.hp,
      fragile: s.kind === "glass-bottle",
      shatterPieceCount: 7,
      importedUrl: s.url ?? null,
    };
  });
}

function createInitialVehicles(): SpawnedVehicleEntry[] {
  const carDir = latLonToPosition(76, 12, 1);
  const carPose = surfacePoseFromDir(carDir, 1.5);
  const jetDir = latLonToPosition(72, -62, 1);
  const jetPose = surfacePoseFromDir(jetDir, 2.3);
  return [
    {
      id: "space_car_86",
      label: "Space Drift 86",
      kind: "car",
      presetOrRecipe: "coupe_86",
      position: carPose.position,
      rotation: carPose.euler,
    },
    {
      id: "fighter_delta_1",
      label: "Delta Starfighter",
      kind: "craft",
      presetOrRecipe: "starfighter_delta",
      position: jetPose.position,
      rotation: jetPose.euler,
    },
  ];
}

function createInitialNpcs(): NpcBlobState[] {
  return [
    {
      id: "npc_blorp",
      name: "BLORP",
      position: latLonToPosition(62, 110, PLANET_RADIUS + 0.55),
      heading: [0, 0, 1],
      mealsEaten: 1,
      cravingTier: 0,
      bodyColor: "#a855f7",
      lastQuip: "BLORP SMELL RUBY",
    },
    {
      id: "npc_chonk",
      name: "CHONK-01",
      position: latLonToPosition(35, -145, PLANET_RADIUS + 0.65),
      heading: [1, 0, 0],
      mealsEaten: 3,
      cravingTier: 2,
      bodyColor: "#ec4899",
      lastQuip: "NEED YELLOW SHAPES",
    },
    {
      id: "npc_sir_round",
      name: "SIR ROUND",
      position: latLonToPosition(-28, 30, PLANET_RADIUS + 0.72),
      heading: [0, 0, -1],
      mealsEaten: 5,
      cravingTier: 3,
      bodyColor: "#14b8a6",
      lastQuip: "VERY SPHERICAL DAY",
    },
  ];
}

const EAT_QUIPS = [
  "CRONCH! MY STICK LEGS ARE CRYING FOR HELP",
  "GEOMETRY CONSUMED. I AM BECOME ROUND.",
  "KOLMOGOROV SAYS THAT WAS MINIMAL DESCRIPTION SNACKING",
  "BURP!! NOW I AM 14% MORE POLYHEDRON",
  "MORE! FEED THE SPHERE! RESPECT THE STICK ARMS!",
  "DOCTORS HATE THIS ONE WEIRD PLANETARY DIET",
  "SLURP! TASTES LIKE PURE EUCLIDEAN GOODNESS",
];

const WRONG_QUIPS = [
  "BLEH!! WRONG COLOR! CHECK MY CRAVING HALO!",
  "NO! MY STOMACH ONLY PARSES THE CRAVED WAVELENGTH!",
  "BONKED IT INSTEAD! TRY MERGING TWO TO MATCH MY CRAVING!",
];

export interface GameState {
  mealsEaten: number;
  score: number;
  combo: number;
  merges: number;
  shatters: number;
  cravingTier: number;
  activeShape: "sphere" | OrbShape;
  blobRadius: number;
  blobWeightKg: number;
  chonkTitle: string;
  tool: ToolMode;
  suikaLaunchTier: number | "auto";
  retroPreset: RetroPresetId;
  muted: boolean;
  workshopOpen: boolean;
  lastQuip: string;
  lastQuipAt: number;
  playerMode: "foot" | "car" | "flight";
  activeVehicleId: string | null;
  nearVehicleId: string | null;
  targets: DestructibleTargetSpec[];
  spawnedVehicles: SpawnedVehicleEntry[];
  bolts: PlasmaBolt[];
  npcs: NpcBlobState[];
  customSuikaUrl: string | null;
  customGlbUrl: string | null;
  resetCounter: number;

  recordMeal: (tier: number, scoreBonus: number) => void;
  recordWrongEat: () => void;
  recordNpcFeed: (npcId: string, tier: number) => void;
  recordMerge: (toTier: number, scoreGain: number, combo: number) => void;
  recordShatter: (points?: number) => void;
  setTool: (tool: ToolMode) => void;
  setSuikaLaunchTier: (tier: number | "auto") => void;
  setRetroPreset: (preset: RetroPresetId) => void;
  toggleMute: () => void;
  toggleWorkshop: () => void;
  setWorkshopOpen: (open: boolean) => void;
  setTelemetrySnapshot: (mode: "foot" | "car" | "flight", activeVehicleId: string | null, nearVehicleId: string | null) => void;
  spawnTarget: (opts: {
    pos: [number, number, number];
    kind?: JunkKind;
    labelId?: ProceduralLabelId;
    importedUrl?: string | null;
    hp?: number;
  }) => void;
  spawnVehicle: (entry: Omit<SpawnedVehicleEntry, "id">) => void;
  setCustomSuikaUrl: (url: string | null) => void;
  setCustomGlbUrl: (url: string | null) => void;
  addBolt: (bolt: PlasmaBolt) => void;
  pruneBolts: (now: number) => void;
  triggerQuip: (text: string) => void;
  resetWorld: () => void;
}

let seqCounter = 1;

export const useGameStore = create<GameState>((set) => ({
  mealsEaten: 0,
  score: 0,
  combo: 0,
  merges: 0,
  shatters: 0,
  cravingTier: 0,
  activeShape: "sphere",
  blobRadius: computeBlobRadius(0),
  blobWeightKg: computeBlobWeightKg(0),
  chonkTitle: getChonkTitle(0),
  tool: "suika",
  suikaLaunchTier: "auto",
  retroPreset: "dreamcast",
  muted: false,
  workshopOpen: false,
  lastQuip: "WELCOME TO HUNGRY BLOB PLANET! EAT MATCHING ORBS OR MERGE THEM!",
  lastQuipAt: Date.now(),
  playerMode: "foot",
  activeVehicleId: null,
  nearVehicleId: null,
  targets: createInitialTargets(),
  spawnedVehicles: createInitialVehicles(),
  bolts: [],
  npcs: createInitialNpcs(),
  customSuikaUrl: null,
  customGlbUrl: null,
  resetCounter: 0,

  recordMeal: (tier, scoreBonus) =>
    set((s) => {
      const mealsEaten = s.mealsEaten + 1;
      const cravingTier = nextCravingTier(mealsEaten, tier);
      const quip = EAT_QUIPS[mealsEaten % EAT_QUIPS.length];
      return {
        mealsEaten,
        score: s.score + scoreBonus,
        cravingTier,
        activeShape: shapeForTier(tier),
        blobRadius: computeBlobRadius(mealsEaten),
        blobWeightKg: computeBlobWeightKg(mealsEaten),
        chonkTitle: getChonkTitle(mealsEaten),
        lastQuip: quip,
        lastQuipAt: Date.now(),
      };
    }),

  recordWrongEat: () =>
    set((s) => ({
      lastQuip: WRONG_QUIPS[Math.floor(Math.random() * WRONG_QUIPS.length)],
      lastQuipAt: Date.now(),
      score: Math.max(0, s.score - 5),
    })),

  recordNpcFeed: (npcId, tier) =>
    set((s) => ({
      npcs: s.npcs.map((n) =>
        n.id === npcId
          ? {
              ...n,
              mealsEaten: n.mealsEaten + 1,
              cravingTier: nextCravingTier(n.mealsEaten + 1, tier),
              lastQuip: `${n.name} ATE T0${tier}! GETTING FATTER!`,
            }
          : n,
      ),
      score: s.score + 40,
      lastQuip: `${s.npcs.find((n) => n.id === npcId)?.name ?? "ALIEN"} STOLE A SNACK! (+40)`,
      lastQuipAt: Date.now(),
    })),

  recordMerge: (toTier, scoreGain, combo) =>
    set((s) => ({
      merges: s.merges + 1,
      score: s.score + scoreGain,
      combo,
      lastQuip:
        combo > 1
          ? `SUIKA MERGE x${combo}! EVOLVED TO TIER ${toTier}!`
          : `SUIKA MERGE! NEW TIER ${toTier} ORB FORMED!`,
      lastQuipAt: Date.now(),
    })),

  recordShatter: (points = 100) =>
    set((s) => ({
      shatters: s.shatters + 1,
      score: s.score + points,
      lastQuip: "BVH SHATTER! JUNK OBLITERATED INTO SHARDS!",
      lastQuipAt: Date.now(),
    })),

  setTool: (tool) => set({ tool }),
  setSuikaLaunchTier: (suikaLaunchTier) => set({ suikaLaunchTier }),
  setRetroPreset: (retroPreset) => set({ retroPreset }),
  toggleMute: () =>
    set((s) => {
      const next = !s.muted;
      setAudioMuted(next);
      return { muted: next };
    }),
  toggleWorkshop: () => set((s) => ({ workshopOpen: !s.workshopOpen })),
  setWorkshopOpen: (workshopOpen) => set({ workshopOpen }),
  setTelemetrySnapshot: (playerMode, activeVehicleId, nearVehicleId) =>
    set((s) =>
      s.playerMode === playerMode && s.activeVehicleId === activeVehicleId && s.nearVehicleId === nearVehicleId
        ? s
        : { playerMode, activeVehicleId, nearVehicleId },
    ),

  spawnTarget: ({ pos, kind = "tin-can", labelId = "garys-beans", importedUrl = null, hp = 35 }) =>
    set((s) => ({
      targets: [
        ...s.targets.slice(-28),
        {
          id: `junk_dyn_${seqCounter++}`,
          kind: importedUrl ? "imported-glb" : kind,
          labelId: importedUrl ? "custom" : labelId,
          customAlbedoUrl: null,
          canLodMode: "auto",
          position: pos,
          hp,
          maxHp: hp,
          fragile: kind === "glass-bottle",
          shatterPieceCount: 7,
          importedUrl,
        },
      ],
    })),

  spawnVehicle: (entry) =>
    set((s) => ({
      spawnedVehicles: [
        ...s.spawnedVehicles.slice(-7),
        { ...entry, id: `veh_spawn_${seqCounter++}` },
      ],
      lastQuip: `SPAWNED ${entry.label.toUpperCase()}! WALK NEAR & PRESS [F] TO PILOT!`,
      lastQuipAt: Date.now(),
    })),

  setCustomSuikaUrl: (customSuikaUrl) => set({ customSuikaUrl }),
  setCustomGlbUrl: (customGlbUrl) => set({ customGlbUrl }),
  addBolt: (bolt) => set((s) => ({ bolts: [...s.bolts.slice(-24), bolt] })),
  pruneBolts: (now) =>
    set((s) => {
      if (s.bolts.length === 0) return s;
      const kept = s.bolts.filter((b) => now - b.bornAt < 1100);
      return kept.length === s.bolts.length ? s : { bolts: kept };
    }),
  triggerQuip: (lastQuip) => set({ lastQuip, lastQuipAt: Date.now() }),
  resetWorld: () =>
    set((s) => ({
      mealsEaten: 0,
      score: 0,
      combo: 0,
      merges: 0,
      shatters: 0,
      cravingTier: 0,
      activeShape: "sphere",
      blobRadius: computeBlobRadius(0),
      blobWeightKg: computeBlobWeightKg(0),
      chonkTitle: getChonkTitle(0),
      targets: createInitialTargets(),
      spawnedVehicles: createInitialVehicles(),
      npcs: createInitialNpcs(),
      bolts: [],
      resetCounter: s.resetCounter + 1,
      lastQuip: "PLANET RESET! GLORB IS HUNGRY AGAIN!",
      lastQuipAt: Date.now(),
    })),
}));
