import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { defaultSuikaArbiter, OrbShapeGeometry, type OrbShape } from "@pinkaphant/kolmo/suika";
import { playerBlobMotion, useGameStore } from "./gameStore";
import { CRAVING_TIERS, PLANET_RADIUS, computeBlobRadius, shapeForTier, stepSphericalWander } from "./planetMath";

export interface BlobAlienVisualProps {
  readonly radius: number;
  readonly bodyColor: string;
  readonly cravingColor: string;
  readonly activeShape: "sphere" | OrbShape;
  readonly speed?: number;
  readonly mouthOpen?: number;
  readonly chompPulse?: number;
  readonly burpPulse?: number;
  readonly getMotion?: () => { speed: number; mouthOpen: number; chompPulse: number; burpPulse: number };
  readonly nameTag?: string;
}

/**
 * Dynamic spherical alien with tiny stick legs & stick arms that poke hilariously
 * out of an ever-fatter squishy sphere, plus a translucent shape-shift polyhedron aura!
 */
export function BlobAlienVisual({
  radius,
  bodyColor,
  cravingColor,
  activeShape,
  speed = 0,
  mouthOpen = 0,
  chompPulse = 0,
  burpPulse = 0,
  getMotion,
  nameTag,
}: BlobAlienVisualProps): React.JSX.Element {
  const rootRef = useRef<THREE.Group | null>(null);
  const bodyRef = useRef<THREE.Group | null>(null);
  const legLRef = useRef<THREE.Group | null>(null);
  const legRRef = useRef<THREE.Group | null>(null);
  const armLRef = useRef<THREE.Group | null>(null);
  const armRRef = useRef<THREE.Group | null>(null);
  const shellRef = useRef<THREE.Mesh | null>(null);
  const haloRef = useRef<THREE.Mesh | null>(null);
  const mouthRef = useRef<THREE.Mesh | null>(null);
  const phaseRef = useRef(Math.random() * Math.PI * 2);

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const live = getMotion ? getMotion() : { speed, mouthOpen, chompPulse, burpPulse };
    phaseRef.current += dt * (2.6 + Math.min(8, live.speed * 1.45));
    const t = phaseRef.current;

    const moving = live.speed > 0.35;
    const walkSwing = moving ? Math.sin(t * 2.1) * 0.72 : Math.sin(t * 0.6) * 0.1;
    const armWave = moving ? Math.sin(t * 2.6) * 0.85 : Math.sin(t * 1.1) * 0.25;

    // Squash & stretch on chomp, burp, and walking bounce
    const chompSquash = Math.sin(live.chompPulse * Math.PI) * 0.24;
    const burpBloat = Math.sin(live.burpPulse * Math.PI) * 0.18;
    const walkBounce = moving ? Math.abs(Math.sin(t * 2.1)) * 0.08 : Math.sin(t * 0.7) * 0.02;

    if (bodyRef.current) {
      const sx = 1 + chompSquash + burpBloat;
      const sy = 1 - chompSquash * 0.7 + burpBloat * 0.5 + walkBounce;
      const sz = 1 + chompSquash + burpBloat;
      bodyRef.current.scale.set(sx, sy, sz);
      bodyRef.current.rotation.z = moving ? Math.sin(t * 2.1) * 0.08 : 0;
    }

    if (legLRef.current && legRRef.current) {
      legLRef.current.rotation.x = walkSwing;
      legRRef.current.rotation.x = -walkSwing;
    }
    if (armLRef.current && armRRef.current) {
      armLRef.current.rotation.z = 0.45 + armWave + burpBloat * 2.0;
      armRRef.current.rotation.z = -0.45 - armWave - burpBloat * 2.0;
      armLRef.current.rotation.x = walkSwing * 0.4;
      armRRef.current.rotation.x = -walkSwing * 0.4;
    }
    if (shellRef.current) {
      shellRef.current.rotation.y += dt * 0.9;
      shellRef.current.rotation.x += dt * 0.45;
    }
    if (haloRef.current) {
      haloRef.current.rotation.y -= dt * 1.8;
    }
    if (mouthRef.current) {
      const openScale = 0.4 + Math.min(1.4, live.mouthOpen * 0.9 + live.chompPulse * 1.1 + live.burpPulse * 0.8);
      mouthRef.current.scale.set(1.0 + live.chompPulse * 0.3, openScale, 1);
    }
  });

  // Feet sit near y = -0.52 (matching Ecctrl capsule bottom), belly expands upward as radius grows!
  const legLength = 0.26;
  const footY = -0.52;
  const hipY = footY + legLength;
  const bellyCenterY = hipY + radius * 0.82;
  const limbX = Math.max(0.18, radius * 0.42);
  const armShoulderX = radius * 0.9;
  const armShoulderY = bellyCenterY + radius * 0.05;
  const faceZ = radius * 0.86;
  const eyeSpread = Math.min(0.45, radius * 0.34);

  return (
    <group ref={rootRef}>
      {/* Tiny Stick Legs */}
      <group ref={legLRef} position={[-limbX * 0.65, hipY, 0]}>
        <mesh position={[0, -legLength * 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.042, 0.036, legLength, 6]} />
          <meshStandardMaterial color="#1e293b" roughness={0.6} flatShading />
        </mesh>
        <mesh position={[0, -legLength + 0.03, 0.05]} castShadow>
          <boxGeometry args={[0.11, 0.07, 0.18]} />
          <meshStandardMaterial color={cravingColor} roughness={0.45} flatShading />
        </mesh>
      </group>
      <group ref={legRRef} position={[limbX * 0.65, hipY, 0]}>
        <mesh position={[0, -legLength * 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.042, 0.036, legLength, 6]} />
          <meshStandardMaterial color="#1e293b" roughness={0.6} flatShading />
        </mesh>
        <mesh position={[0, -legLength + 0.03, 0.05]} castShadow>
          <boxGeometry args={[0.11, 0.07, 0.18]} />
          <meshStandardMaterial color={cravingColor} roughness={0.45} flatShading />
        </mesh>
      </group>

      {/* Main Spherical Belly + Shape-Shift Shell + Stick Arms + Googly Face */}
      <group ref={bodyRef} position={[0, bellyCenterY, 0]}>
        {/* Squishy Dynamic Blob Sphere */}
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[radius, 20, 16]} />
          <meshStandardMaterial
            color={bodyColor}
            emissive={bodyColor}
            emissiveIntensity={0.18}
            roughness={0.35}
            metalness={0.1}
            flatShading
          />
        </mesh>

        {/* Eaten Suika Shape-Shift Morph Shell */}
        {activeShape !== "sphere" && (
          <mesh ref={shellRef}>
            <OrbShapeGeometry shape={activeShape} radius={radius * 1.18} sphereSegments={14} />
            <meshStandardMaterial
              color={bodyColor}
              emissive={bodyColor}
              emissiveIntensity={0.45}
              transparent
              opacity={0.38}
              wireframe={false}
              flatShading
            />
          </mesh>
        )}

        {/* Tiny Stick Arms poking out the sides */}
        <group ref={armLRef} position={[-armShoulderX, armShoulderY - bellyCenterY, 0.06]}>
          <mesh position={[-0.18, 0, 0]} rotation={[0, 0, Math.PI * 0.5]} castShadow>
            <cylinderGeometry args={[0.034, 0.03, 0.36, 6]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} flatShading />
          </mesh>
          <mesh position={[-0.36, 0, 0]}>
            <sphereGeometry args={[0.065, 8, 8]} />
            <meshStandardMaterial color={cravingColor} flatShading />
          </mesh>
        </group>
        <group ref={armRRef} position={[armShoulderX, armShoulderY - bellyCenterY, 0.06]}>
          <mesh position={[0.18, 0, 0]} rotation={[0, 0, Math.PI * 0.5]} castShadow>
            <cylinderGeometry args={[0.034, 0.03, 0.36, 6]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} flatShading />
          </mesh>
          <mesh position={[0.36, 0, 0]}>
            <sphereGeometry args={[0.065, 8, 8]} />
            <meshStandardMaterial color={cravingColor} flatShading />
          </mesh>
        </group>

        {/* Googly Eyes */}
        <group position={[-eyeSpread, radius * 0.25, faceZ]}>
          <mesh>
            <sphereGeometry args={[Math.min(0.24, 0.11 + radius * 0.07), 10, 10]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 0, 0.09]}>
            <sphereGeometry args={[Math.min(0.12, 0.055 + radius * 0.035), 8, 8]} />
            <meshBasicMaterial color="#0f172a" />
          </mesh>
        </group>
        <group position={[eyeSpread, radius * 0.28, faceZ]}>
          <mesh>
            <sphereGeometry args={[Math.min(0.26, 0.12 + radius * 0.075), 10, 10]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.02, 0.02, 0.1]}>
            <sphereGeometry args={[Math.min(0.13, 0.06 + radius * 0.035), 8, 8]} />
            <meshBasicMaterial color="#0f172a" />
          </mesh>
        </group>

        {/* Hungry Mouth */}
        <mesh ref={mouthRef} position={[0, -radius * 0.06, faceZ + 0.02]}>
          <sphereGeometry args={[Math.min(0.32, 0.12 + radius * 0.11), 10, 8]} />
          <meshBasicMaterial color="#450a0a" />
        </mesh>

        {/* Craving Color Halo Ring floating above head */}
        <mesh ref={haloRef} position={[0, radius + 0.48, 0]} rotation={[Math.PI * 0.5, 0, 0]}>
          <torusGeometry args={[Math.max(0.28, radius * 0.52), 0.055, 8, 24]} />
          <meshStandardMaterial
            color={cravingColor}
            emissive={cravingColor}
            emissiveIntensity={1.6}
            flatShading
          />
        </mesh>

        {/* Optional tiny antenna beacon for NPCs */}
        {nameTag && (
          <mesh position={[0, radius + 0.72, 0]}>
            <octahedronGeometry args={[0.14, 0]} />
            <meshStandardMaterial color={cravingColor} emissive={cravingColor} emissiveIntensity={1.4} />
          </mesh>
        )}
      </group>
    </group>
  );
}

/** Player Glorb visual inside <Actor>, reading live 60 Hz motion refs + Zustand chonk state. */
export function PlayerBlobMesh(): React.JSX.Element {
  const blobRadius = useGameStore((s) => s.blobRadius);
  const cravingTier = useGameStore((s) => s.cravingTier);
  const activeShape = useGameStore((s) => s.activeShape);
  const mealsEaten = useGameStore((s) => s.mealsEaten);

  const tierDef = CRAVING_TIERS[cravingTier] ?? CRAVING_TIERS[0];
  const prevEatenColor =
    mealsEaten === 0
      ? "#38bdf8"
      : (CRAVING_TIERS[(mealsEaten - 1 + CRAVING_TIERS.length) % CRAVING_TIERS.length]?.color ?? "#38bdf8");
  const bodyColor = playerBlobMotion.lastEatColor || prevEatenColor;

  const motionSnapshotRef = useRef({ speed: 0, mouthOpen: 0, chompPulse: 0, burpPulse: 0 });
  const getMotion = useMemo(
    () => () => motionSnapshotRef.current,
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    playerBlobMotion.chompPulse = Math.max(0, playerBlobMotion.chompPulse - dt * 2.8);
    playerBlobMotion.burpPulse = Math.max(0, playerBlobMotion.burpPulse - dt * 1.9);
    motionSnapshotRef.current.speed = playerBlobMotion.speed;
    motionSnapshotRef.current.mouthOpen =
      playerBlobMotion.nearCravingDist < 5.5 ? 1 - playerBlobMotion.nearCravingDist / 5.5 : 0;
    motionSnapshotRef.current.chompPulse = playerBlobMotion.chompPulse;
    motionSnapshotRef.current.burpPulse = playerBlobMotion.burpPulse;
  });

  return (
    <BlobAlienVisual
      radius={blobRadius}
      bodyColor={bodyColor}
      cravingColor={tierDef.color}
      activeShape={activeShape}
      getMotion={getMotion}
    />
  );
}

const _npcPos = new THREE.Vector3();
const _npcUp = new THREE.Vector3();
const _npcFwd = new THREE.Vector3();
const _npcRight = new THREE.Vector3();
const _npcMat = new THREE.Matrix4();
const _npcQuat = new THREE.Quaternion();
const _orbPos = new THREE.Vector3();

function NpcBlobActor({
  id,
  name,
  initialPos,
  initialHeading,
  mealsEaten,
  cravingTier,
  bodyColor,
}: {
  id: string;
  name: string;
  initialPos: [number, number, number];
  initialHeading: [number, number, number];
  mealsEaten: number;
  cravingTier: number;
  bodyColor: string;
}): React.JSX.Element {
  const groupRef = useRef<THREE.Group | null>(null);
  const posRef = useRef<[number, number, number]>([...initialPos]);
  const headRef = useRef<[number, number, number]>([...initialHeading]);
  const chompRef = useRef(0);
  const turnTimerRef = useRef(Math.random() * 2);
  const turnBiasRef = useRef((Math.random() - 0.5) * 1.4);
  const recordNpcFeed = useGameStore((s) => s.recordNpcFeed);

  const radius = useMemo(() => computeBlobRadius(mealsEaten), [mealsEaten]);
  const tierDef = CRAVING_TIERS[cravingTier] ?? CRAVING_TIERS[0];

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    chompRef.current = Math.max(0, chompRef.current - dt * 2.5);

    turnTimerRef.current -= dt;
    if (turnTimerRef.current <= 0) {
      turnTimerRef.current = 1.4 + Math.random() * 2.2;
      turnBiasRef.current = (Math.random() - 0.5) * 1.6;
    }

    // Look for a matching craving orb within 14m to chase!
    const orbs = defaultSuikaArbiter.getEntities();
    let targetOrb: { id: string; pos: [number, number, number]; dist: number } | null = null;
    _npcPos.set(posRef.current[0], posRef.current[1], posRef.current[2]);

    for (const orb of orbs) {
      if (orb.tier !== cravingTier) continue;
      _orbPos.set(orb.position[0], orb.position[1], orb.position[2]);
      const d = _npcPos.distanceTo(_orbPos);
      if (d < 14 && (!targetOrb || d < targetOrb.dist)) {
        targetOrb = { id: orb.id, pos: orb.position, dist: d };
      }
    }

    let heading = headRef.current;
    let turnAngle = turnBiasRef.current * dt;
    let speed = 2.6;

    if (targetOrb) {
      speed = 4.4;
      turnAngle = 0;
      const dx = targetOrb.pos[0] - posRef.current[0];
      const dy = targetOrb.pos[1] - posRef.current[1];
      const dz = targetOrb.pos[2] - posRef.current[2];
      heading = [dx, dy, dz];

      if (targetOrb.dist <= radius + 0.9) {
        if (defaultSuikaArbiter.remove(targetOrb.id)) {
          chompRef.current = 1;
          recordNpcFeed(id, cravingTier);
        }
      }
    }

    const stepped = stepSphericalWander(
      posRef.current,
      heading,
      speed,
      dt,
      PLANET_RADIUS + 0.52,
      turnAngle,
    );
    posRef.current = stepped.position;
    headRef.current = stepped.heading;

    if (groupRef.current) {
      groupRef.current.position.set(stepped.position[0], stepped.position[1], stepped.position[2]);
      _npcUp.set(stepped.up[0], stepped.up[1], stepped.up[2]);
      _npcFwd.set(stepped.heading[0], stepped.heading[1], stepped.heading[2]).normalize();
      _npcRight.crossVectors(_npcUp, _npcFwd).normalize();
      _npcMat.makeBasis(_npcRight, _npcUp, _npcFwd);
      _npcQuat.setFromRotationMatrix(_npcMat);
      groupRef.current.quaternion.copy(_npcQuat);
    }
  });

  return (
    <group ref={groupRef} position={initialPos}>
      <BlobAlienVisual
        radius={radius}
        bodyColor={bodyColor}
        cravingColor={tierDef.color}
        activeShape={mealsEaten > 0 ? shapeForTier(cravingTier) : "sphere"}
        speed={3.2}
        mouthOpen={0.45}
        chompPulse={chompRef.current}
        nameTag={name}
      />
    </group>
  );
}

/** Three autonomous chonky NPC Blob Aliens roaming the planet competing for snacks! */
export function NpcBlobCouncil(): React.JSX.Element {
  const npcs = useGameStore((s) => s.npcs);
  return (
    <>
      {npcs.map((npc) => (
        <NpcBlobActor
          key={npc.id}
          id={npc.id}
          name={npc.name}
          initialPos={npc.position}
          initialHeading={npc.heading}
          mealsEaten={npc.mealsEaten}
          cravingTier={npc.cravingTier}
          bodyColor={npc.bodyColor}
        />
      ))}
    </>
  );
}
