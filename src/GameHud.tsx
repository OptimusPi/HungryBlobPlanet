import React, { useRef } from "react";
import { ingestSand3dOrGlb } from "@pinkaphant/kolmo/sand3d";
import { kolmoActions, kolmoWorld, type RetroPresetId } from "@pinkaphant/kolmo";
import { BUNDLED_GLB_PRESETS, playerBlobMotion, useGameStore } from "./gameStore";
import { CRAVING_TIERS, latLonToPosition, surfacePoseFromDir } from "./planetMath";

const PANEL_BG = "rgba(10, 15, 32, 0.82)";
const BORDER_SUBTLE = "1px solid rgba(148, 163, 184, 0.28)";

function spawnOffsetOnPlanet(alt: number): { position: [number, number, number]; rotation: [number, number, number] } {
  const [x, y, z] = playerBlobMotion.worldPos;
  const [ux, uy, uz] = playerBlobMotion.worldUp;
  // Offset slightly sideways in tangent plane (~7m on R=120m) so new spawn doesn't crush the player
  const rawDir: [number, number, number] = [ux + 0.06, uy, uz + 0.06];
  const pose = surfacePoseFromDir(rawDir, alt);
  if (!Number.isFinite(x + y + z)) {
    const fallback = surfacePoseFromDir(latLonToPosition(87, 15, 1), alt);
    return { position: fallback.position, rotation: fallback.euler };
  }
  return { position: pose.position, rotation: pose.euler };
}

export function GameHud(): React.JSX.Element {
  const mealsEaten = useGameStore((s) => s.mealsEaten);
  const score = useGameStore((s) => s.score);
  const combo = useGameStore((s) => s.combo);
  const merges = useGameStore((s) => s.merges);
  const shatters = useGameStore((s) => s.shatters);
  const cravingTier = useGameStore((s) => s.cravingTier);
  const activeShape = useGameStore((s) => s.activeShape);
  const blobRadius = useGameStore((s) => s.blobRadius);
  const blobWeightKg = useGameStore((s) => s.blobWeightKg);
  const chonkTitle = useGameStore((s) => s.chonkTitle);
  const tool = useGameStore((s) => s.tool);
  const suikaLaunchTier = useGameStore((s) => s.suikaLaunchTier);
  const retroPreset = useGameStore((s) => s.retroPreset);
  const muted = useGameStore((s) => s.muted);
  const workshopOpen = useGameStore((s) => s.workshopOpen);
  const lastQuip = useGameStore((s) => s.lastQuip);
  const playerMode = useGameStore((s) => s.playerMode);
  const activeVehicleId = useGameStore((s) => s.activeVehicleId);
  const nearVehicleId = useGameStore((s) => s.nearVehicleId);
  const spawnedVehicles = useGameStore((s) => s.spawnedVehicles);
  const npcs = useGameStore((s) => s.npcs);

  const setTool = useGameStore((s) => s.setTool);
  const setSuikaLaunchTier = useGameStore((s) => s.setSuikaLaunchTier);
  const setRetroPreset = useGameStore((s) => s.setRetroPreset);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const toggleWorkshop = useGameStore((s) => s.toggleWorkshop);
  const spawnTarget = useGameStore((s) => s.spawnTarget);
  const spawnVehicle = useGameStore((s) => s.spawnVehicle);
  const setCustomSuikaUrl = useGameStore((s) => s.setCustomSuikaUrl);
  const triggerQuip = useGameStore((s) => s.triggerQuip);
  const resetWorld = useGameStore((s) => s.resetWorld);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importTargetKindRef = useRef<"junk" | "suika" | "vehicle">("junk");

  const cravingDef = CRAVING_TIERS[cravingTier] ?? CRAVING_TIERS[0];

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const mode = importTargetKindRef.current;

    try {
      const url = URL.createObjectURL(file);
      if (mode === "suika") {
        setCustomSuikaUrl(url);
        setTool("suika");
        triggerQuip(`IMPORTED ${file.name} AS SUIKA LAUNCH ORB SKIN!`);
        return;
      }

      const buf = await file.arrayBuffer();
      const ingested = await ingestSand3dOrGlb(buf, file.name);
      const isVehicleDrop = mode === "vehicle" || ingested.worldKind === "vehicle";
      const pose = spawnOffsetOnPlanet(isVehicleDrop ? 0.45 : 2.0);

      if (isVehicleDrop) {
        spawnVehicle({
          label: ingested.name,
          kind: "imported",
          presetOrRecipe: ingested.name,
          position: pose.position,
          rotation: pose.rotation,
          glbBytes: ingested.glbBytes,
        });
      } else {
        spawnTarget({ pos: pose.position, importedUrl: url, hp: 45 });
        triggerQuip(`IMPORTED ${file.name} AS DESTRUCTIBLE BVH TARGET!`);
      }
    } catch (err) {
      // Fallback: compile raw THREE scene via compileKhrAssetGlb or direct URL junk
      const url = URL.createObjectURL(file);
      const pose = spawnOffsetOnPlanet(2.0);
      spawnTarget({ pos: pose.position, importedUrl: url, hp: 45 });
      triggerQuip(`DROPPED ${file.name} (${err instanceof Error ? err.message : "fallback junk"})`);
    }
  };

  const quickBoardCarOrJet = (id: string) => {
    if (activeVehicleId === id) {
      kolmoActions(kolmoWorld).exitVehicle();
    } else {
      kolmoActions(kolmoWorld).boardVehicle(id);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        color: "#f8fafc",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 12,
        boxSizing: "border-box",
      }}
    >
      {/* TOP BAR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        {/* Top-Left: Glorb Chonk & Craving Card */}
        <div
          style={{
            pointerEvents: "auto",
            background: PANEL_BG,
            backdropFilter: "blur(8px)",
            border: BORDER_SUBTLE,
            borderRadius: 12,
            padding: "10px 14px",
            minWidth: 255,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.8, color: "#38bdf8" }}>
              HUNGRY BLOB PLANET
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 99,
                background: "rgba(56, 189, 248, 0.16)",
                color: "#7dd3fc",
              }}
            >
              {playerMode === "foot" ? "ON STICK LEGS" : playerMode === "car" ? "SPACE CAR" : "FIGHTER JET"}
            </span>
          </div>

          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{chonkTitle}</div>
          <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 2 }}>
            Weight: <b>{blobWeightKg} kg</b> · Radius: <b>{blobRadius.toFixed(2)}m</b> · Shape: <b>{activeShape}</b>
          </div>

          {/* BIG CRAVING INDICATOR */}
          <div
            style={{
              marginTop: 8,
              padding: "7px 10px",
              borderRadius: 8,
              background: "rgba(15, 23, 42, 0.9)",
              border: `2px solid ${cravingDef.color}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.7, color: "#94a3b8" }}>
                GLORB CRAVES COLOR + SHAPE
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: cravingDef.color }}>
                {cravingDef.code} {cravingDef.name.toUpperCase()} ({cravingDef.shape.toUpperCase()})
              </div>
            </div>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: cravingDef.shape === "cube" ? 4 : "50%",
                background: cravingDef.color,
                boxShadow: `0 0 12px ${cravingDef.color}`,
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 12, color: "#e2e8f0" }}>
            <span>Score: <b>{score}</b></span>
            <span>Eaten: <b>{mealsEaten}</b></span>
            <span>Merges: <b>{merges}</b>{combo > 1 ? ` (x${combo})` : ""}</span>
            <span>Shatters: <b>{shatters}</b></span>
          </div>
        </div>

        {/* Top-Center: Comedy Quip & Quick Controls */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, maxWidth: 460 }}>
          <div
            style={{
              background: "rgba(15, 23, 42, 0.88)",
              border: "1px solid rgba(250, 204, 21, 0.45)",
              borderRadius: 99,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              color: "#fde047",
              textAlign: "center",
              boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            }}
          >
            {lastQuip}
          </div>
          <div
            style={{
              background: "rgba(15, 23, 42, 0.65)",
              borderRadius: 8,
              padding: "4px 10px",
              fontSize: 11,
              color: "#cbd5e1",
              textAlign: "center",
            }}
          >
            WASD Move/Drive · Drag Orbit Cam · Click / [J] Fire · [H] Force-Chomp · [F] Board/Exit · [R] Flip · [Tab] Forge
          </div>
          {nearVehicleId && playerMode === "foot" && (
            <button
              type="button"
              onClick={() => quickBoardCarOrJet(nearVehicleId)}
              style={{
                pointerEvents: "auto",
                cursor: "pointer",
                background: "#22c55e",
                color: "#052e16",
                fontWeight: 800,
                border: "none",
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 13,
              }}
            >
              Press [F] or Click to Board {nearVehicleId}
            </button>
          )}
        </div>

        {/* Top-Right: Quick Hop Car/Jet + Forge + Sound + Shader */}
        <div style={{ pointerEvents: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {spawnedVehicles.slice(0, 3).map((v) => {
              const pilotingThis = activeVehicleId === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => quickBoardCarOrJet(v.id)}
                  style={{
                    cursor: "pointer",
                    background: pilotingThis ? "#f59e0b" : PANEL_BG,
                    color: pilotingThis ? "#0f172a" : "#f8fafc",
                    border: BORDER_SUBTLE,
                    borderRadius: 8,
                    padding: "7px 11px",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {pilotingThis ? `Exit ${v.label} [F]` : `${v.kind === "craft" ? "✈" : "🚗"} Hop in ${v.label}`}
                </button>
              );
            })}
            <button
              type="button"
              onClick={toggleWorkshop}
              style={{
                cursor: "pointer",
                background: workshopOpen ? "#38bdf8" : "#0284c7",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                padding: "7px 12px",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {workshopOpen ? "Close Forge [Tab]" : "🛠 Stuff Maker & GLBs [Tab]"}
            </button>
            <button
              type="button"
              onClick={toggleMute}
              style={{
                cursor: "pointer",
                background: PANEL_BG,
                color: "#f8fafc",
                border: BORDER_SUBTLE,
                borderRadius: 8,
                padding: "7px 10px",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {muted ? "🔇 Muted" : "🔊 SFX"}
            </button>
          </div>

          {/* Alien Rival Leaderboard Pill */}
          <div
            style={{
              background: PANEL_BG,
              border: BORDER_SUBTLE,
              borderRadius: 10,
              padding: "6px 10px",
              fontSize: 11,
              color: "#cbd5e1",
            }}
          >
            <div style={{ fontWeight: 700, color: "#f472b6", marginBottom: 2 }}>RIVAL BLOB COUNCIL</div>
            {npcs.map((n) => {
              const t = CRAVING_TIERS[n.cravingTier] ?? CRAVING_TIERS[0];
              return (
                <div key={n.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span>{n.name} ({n.mealsEaten} eaten)</span>
                  <span style={{ color: t.color, fontWeight: 700 }}>wants {t.code}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SLIDE-OVER STUFF MAKER & IMPORTER DRAWER */}
      {workshopOpen && (
        <div
          style={{
            pointerEvents: "auto",
            position: "fixed",
            right: 14,
            top: 120,
            bottom: 86,
            width: 340,
            overflowY: "auto",
            background: "rgba(9, 13, 28, 0.94)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(56, 189, 248, 0.45)",
            borderRadius: 14,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: 14, color: "#38bdf8" }}>KOLMO STUFF MAKER & GLB IMPORTER</strong>
            <button
              type="button"
              onClick={toggleWorkshop}
              style={{ background: "transparent", color: "#94a3b8", border: "none", cursor: "pointer", fontSize: 16 }}
            >
              ✕
            </button>
          </div>

          {/* 3D Math Vehicles & Fighter Jets */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#fbbf24", marginBottom: 6 }}>
              3D MATH CARS & FIGHTER SPACE JETS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {(
                [
                  { label: "🚗 Coupe 86", kind: "car", recipe: "coupe_86" },
                  { label: "🚕 Sedan 92", kind: "car", recipe: "sedan_92" },
                  { label: "🚐 Kei Space Van", kind: "car", recipe: "kei_van" },
                  { label: "✈ Delta Fighter", kind: "craft", recipe: "starfighter_delta" },
                  { label: "🛸 VTOL Dropship", kind: "craft", recipe: "vtol_dropship" },
                  { label: "🚀 Hover Skiff", kind: "craft", recipe: "hover_skiff" },
                  { label: "🌕 Orbital Lander", kind: "craft", recipe: "orbital_lander" },
                ] as const
              ).map((item) => (
                <button
                  key={item.recipe}
                  type="button"
                  onClick={() => {
                    const pose = spawnOffsetOnPlanet(item.kind === "craft" ? 2.4 : 0.35);
                    spawnVehicle({
                      label: item.label.replace(/^[^\s]+\s/, ""),
                      kind: item.kind,
                      presetOrRecipe: item.recipe,
                      position: pose.position,
                      rotation: pose.rotation,
                    });
                  }}
                  style={{
                    cursor: "pointer",
                    background: "rgba(30, 41, 59, 0.9)",
                    color: "#f8fafc",
                    border: BORDER_SUBTLE,
                    borderRadius: 7,
                    padding: "6px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    textAlign: "left",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Labeled Cans & Bottles */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#34d399", marginBottom: 6 }}>
              LABELED CANS & SHATTER BOTTLES
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button
                type="button"
                onClick={() => spawnTarget({ pos: spawnOffsetOnPlanet(1.6).position, kind: "tin-can", labelId: "garys-beans", hp: 35 })}
                style={{ cursor: "pointer", background: "#7f1d1d", color: "#fef3c7", border: "none", borderRadius: 7, padding: "6px 8px", fontSize: 11, fontWeight: 700 }}
              >
                🥫 Gary&apos;s Beans
              </button>
              <button
                type="button"
                onClick={() => spawnTarget({ pos: spawnOffsetOnPlanet(1.6).position, kind: "tin-can", labelId: "tris-soda", hp: 35 })}
                style={{ cursor: "pointer", background: "#0369a1", color: "#fde047", border: "none", borderRadius: 7, padding: "6px 8px", fontSize: 11, fontWeight: 700 }}
              >
                🥤 Tris&apos; Soda
              </button>
              <button
                type="button"
                onClick={() => spawnTarget({ pos: spawnOffsetOnPlanet(1.6).position, kind: "tin-can", labelId: "goofy-emoji", hp: 35 })}
                style={{ cursor: "pointer", background: "#a16207", color: "#fef9c3", border: "none", borderRadius: 7, padding: "6px 8px", fontSize: 11, fontWeight: 700 }}
              >
                🤪 Goofy Can
              </button>
              <button
                type="button"
                onClick={() => spawnTarget({ pos: spawnOffsetOnPlanet(1.6).position, kind: "glass-bottle", labelId: "tris-soda", hp: 20 })}
                style={{ cursor: "pointer", background: "#065f46", color: "#d1fae5", border: "none", borderRadius: 7, padding: "6px 8px", fontSize: 11, fontWeight: 700 }}
              >
                🍾 Glass Bottle
              </button>
            </div>
          </div>

          {/* Bundled CubicWave GLBs */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#c084fc", marginBottom: 6 }}>
              BUNDLED CUBICWAVE KHR3 GLBS (SHATTERABLE!)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {BUNDLED_GLB_PRESETS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    spawnTarget({ pos: spawnOffsetOnPlanet(1.8).position, importedUrl: g.url, hp: g.hp });
                    triggerQuip(`SPAWNED ${g.label.toUpperCase()}!`);
                  }}
                  style={{
                    cursor: "pointer",
                    background: "rgba(49, 46, 129, 0.75)",
                    color: "#e0e7ff",
                    border: BORDER_SUBTLE,
                    borderRadius: 7,
                    padding: "6px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    textAlign: "left",
                  }}
                >
                  📦 {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom GLB / USD / Sand3D File Importer */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#f472b6", marginBottom: 6 }}>
              IMPORT ANY .GLB / .USD / .SAND3D (OR DRAG-DROP!)
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb,.gltf,.usd,.usda,.usdc,.usdz,.sand3d,.s3d"
              style={{ display: "none" }}
              onChange={handleImportFile}
            />
            <div style={{ display: "flex", gap: 6 }}>
              {(["junk", "suika", "vehicle"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    importTargetKindRef.current = kind;
                    fileInputRef.current?.click();
                  }}
                  style={{
                    flex: 1,
                    cursor: "pointer",
                    background: "#831843",
                    color: "#fce7f3",
                    border: "none",
                    borderRadius: 7,
                    padding: "7px 6px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  + {kind === "junk" ? "Junk" : kind === "suika" ? "Suika" : "Car/Jet"}
                </button>
              ))}
            </div>
          </div>

          {/* Retro Shader & Reset */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "space-between", borderTop: BORDER_SUBTLE, paddingTop: 10 }}>
            <select
              value={retroPreset}
              onChange={(e) => setRetroPreset(e.target.value as RetroPresetId)}
              style={{
                background: "#0f172a",
                color: "#f8fafc",
                border: BORDER_SUBTLE,
                borderRadius: 7,
                padding: "6px 8px",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              <option value="dreamcast">Shader: Dreamcast</option>
              <option value="psx_plus">Shader: PSX+</option>
              <option value="ps2_shinobi">Shader: PS2 Shinobi</option>
              <option value="clean_hd">Shader: Clean HD</option>
            </select>
            <button
              type="button"
              onClick={resetWorld}
              style={{
                cursor: "pointer",
                background: "#dc2626",
                color: "#ffffff",
                border: "none",
                borderRadius: 7,
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              Reset Planet
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM DOCK: LAUNCHER & CHOMP CONTROLS */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div
          style={{
            pointerEvents: "auto",
            background: PANEL_BG,
            backdropFilter: "blur(8px)",
            border: BORDER_SUBTLE,
            borderRadius: 12,
            padding: "6px 10px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {(
            [
              { id: "suika", label: "[1] Suika Launcher" },
              { id: "blaster", label: "[2] Junk Blaster" },
              { id: "spawner", label: "[3] Junk Dropper" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              style={{
                cursor: "pointer",
                background: tool === t.id ? "#38bdf8" : "rgba(30, 41, 59, 0.85)",
                color: tool === t.id ? "#082f49" : "#e2e8f0",
                border: "none",
                borderRadius: 8,
                padding: "7px 11px",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {t.label}
            </button>
          ))}

          {tool === "suika" && (
            <div style={{ display: "flex", gap: 4, marginLeft: 4 }}>
              <button
                type="button"
                onClick={() => setSuikaLaunchTier("auto")}
                style={{
                  cursor: "pointer",
                  background: suikaLaunchTier === "auto" ? "#f8fafc" : "#1e293b",
                  color: suikaLaunchTier === "auto" ? "#0f172a" : "#cbd5e1",
                  border: "none",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                Auto
              </button>
              {[0, 1, 2, 3].map((tierIdx) => {
                const td = CRAVING_TIERS[tierIdx];
                return (
                  <button
                    key={tierIdx}
                    type="button"
                    onClick={() => setSuikaLaunchTier(tierIdx)}
                    style={{
                      cursor: "pointer",
                      background: suikaLaunchTier === tierIdx ? td.color : "#1e293b",
                      color: suikaLaunchTier === tierIdx ? "#090d16" : td.color,
                      border: `1px solid ${td.color}`,
                      borderRadius: 6,
                      padding: "4px 7px",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {td.code}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("hbp:fire"))}
            style={{
              cursor: "pointer",
              background: "#f43f5e",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 800,
              marginLeft: 4,
            }}
          >
            FIRE!
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("hbp:chomp"))}
            style={{
              cursor: "pointer",
              background: cravingDef.color,
              color: "#090d16",
              border: "none",
              borderRadius: 8,
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            CHOMP [H]
          </button>
        </div>
      </div>
    </div>
  );
}
