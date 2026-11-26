import React, { useEffect, useState } from "react";
import type { PaperShellPresetId } from "@khr3/vehicles/paper-shell";
import { Vehicle, type KhrAssetBundle } from "@pinkaphant/kolmo";
import {
  CRAFT_PROCEDURAL_RECIPES,
  buildProceduralCraftScene,
  compileKhrAssetGlb,
} from "@pinkaphant/kolmo/importer";
import { ingestSand3dOrGlb } from "@pinkaphant/kolmo/sand3d";
import { useGameStore, type SpawnedVehicleEntry } from "./gameStore";

const craftBundleCache = new Map<string, Promise<KhrAssetBundle>>();

export function compileProceduralCraftBundle(recipeId: string): Promise<KhrAssetBundle> {
  const hit = craftBundleCache.get(recipeId);
  if (hit) return hit;

  const spec = CRAFT_PROCEDURAL_RECIPES.find((r) => r.id === recipeId) ?? CRAFT_PROCEDURAL_RECIPES[0];
  const task = (async () => {
    const scene = buildProceduralCraftScene(spec.id);
    const bytes = await compileKhrAssetGlb(scene, {
      archetype: "craft",
      massKg: spec.massKg,
      powerOrThrust: spec.powerOrThrust ?? 24000,
      name: spec.id,
    });
    const ingested = await ingestSand3dOrGlb(bytes, `${spec.id}.glb`);
    return ingested.bundle;
  })();
  craftBundleCache.set(recipeId, task);
  return task;
}

function ProceduralCraftVehicle({ entry }: { entry: SpawnedVehicleEntry }): React.JSX.Element | null {
  const [bundle, setBundle] = useState<KhrAssetBundle | null>(null);

  useEffect(() => {
    let alive = true;
    void compileProceduralCraftBundle(entry.presetOrRecipe)
      .then((b) => {
        if (alive) setBundle(b);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [entry.presetOrRecipe]);

  if (!bundle) return null;

  return (
    <Vehicle
      id={entry.id}
      bundle={bundle}
      position={entry.position}
      rotation={entry.rotation}
      flightMode
      ccd
      droneConfig={{
        controlMode: "VELOCITY",
        maxHorizSpeed: 54,
        maxVertSpeed: 22,
        maxYawRate: 2.6,
        maxTiltAngle: 0.58,
      }}
    />
  );
}

export function CraftAndVehicles(): React.JSX.Element {
  const spawnedVehicles = useGameStore((s) => s.spawnedVehicles);

  return (
    <>
      {spawnedVehicles.map((entry) => {
        if (entry.kind === "car") {
          return (
            <Vehicle
              key={entry.id}
              id={entry.id}
              preset={entry.presetOrRecipe as PaperShellPresetId}
              horsepower={360}
              position={entry.position}
              rotation={entry.rotation}
              ccd
              carConfig={{
                engineHorsepower: 360,
                maxSteerAngle: 0.58,
                steerRate: 4.5,
              }}
            />
          );
        }
        if (entry.kind === "craft") {
          return <ProceduralCraftVehicle key={entry.id} entry={entry} />;
        }
        if (entry.glbBytes) {
          return (
            <Vehicle
              key={entry.id}
              id={entry.id}
              rawGlbBytes={entry.glbBytes}
              position={entry.position}
              rotation={entry.rotation}
              ccd
            />
          );
        }
        if (entry.glbUrl) {
          return (
            <Vehicle
              key={entry.id}
              id={entry.id}
              src={entry.glbUrl}
              position={entry.position}
              rotation={entry.rotation}
              ccd
            />
          );
        }
        return null;
      })}
    </>
  );
}
