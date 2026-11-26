import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Actor, Game } from "@pinkaphant/kolmo";
import { PlayerBlobMesh, NpcBlobCouncil } from "./BlobAlienMesh";
import { CraftAndVehicles } from "./CraftAndVehicles";
import { GameHud } from "./GameHud";
import { useGameStore } from "./gameStore";
import { HungryPlanetMesh } from "./HungryPlanetMesh";
import { PlanetGameplayRig } from "./PlanetGameplayRig";
import { PLANET_RADIUS, PLANET_SURFACE_G } from "./planetMath";

class GameErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  public state: { error: Error | null } = { error: null };

  public static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("HungryBlobPlanet runtime error:", error, info);
  }

  public render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            width: "100vw",
            height: "100vh",
            background: "#090d1c",
            color: "#fca5a5",
            padding: 32,
            fontFamily: "monospace",
          }}
        >
          <h2>HungryBlobPlanet encountered an error</h2>
          <pre>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App(): React.JSX.Element {
  const retroPreset = useGameStore((s) => s.retroPreset);

  return (
    <GameErrorBoundary>
      <div style={{ position: "relative", width: "100vw", height: "100dvh", overflow: "hidden", touchAction: "none" }}>
        <Game
          retro={retroPreset}
          gravity={{
            kind: "point",
            center: [0, 0, 0],
            surfaceG: PLANET_SURFACE_G,
            radius: PLANET_RADIUS,
          }}
          skybox="nebula"
          fogExp2={null}
        >
          <HungryPlanetMesh />
          <Actor
            position={[0, PLANET_RADIUS + 1.5, 0]}
            ecctrlProps={{
              maxWalkVel: 5.5,
              maxRunVel: 11.5,
              jumpVel: 8.4,
            }}
          >
            <PlayerBlobMesh />
          </Actor>
          <CraftAndVehicles />
          <NpcBlobCouncil />
          <PlanetGameplayRig />
        </Game>
        <GameHud />
      </div>
    </GameErrorBoundary>
  );
}

export default App;
