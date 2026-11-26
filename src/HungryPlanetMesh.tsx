import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BallCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { Exoplanet, Sand3D, applyRetroMaterial } from "@pinkaphant/kolmo";
import { PLANET_RADIUS, latLonToPosition, surfacePoseFromDir } from "./planetMath";

function buildKolmogorovPlanetGeometry(radius: number): THREE.BufferGeometry {
  // Minimal Kolmogorov seed -> subdivided icosahedron with deterministic harmonic relief + vertex biomes
  const base = new THREE.IcosahedronGeometry(radius, 5);
  const geo = base.index ? base.toNonIndexed() : base;
  if (base.index) base.dispose();

  const pos = geo.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const c = new THREE.Color();

  const mint = new THREE.Color("#34d399");
  const lime = new THREE.Color("#a3e635");
  const ocean = new THREE.Color("#0284c7");
  const mango = new THREE.Color("#fb923c");
  const raceway = new THREE.Color("#f43f5e");
  const stripe = new THREE.Color("#fde047");

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const dir = v.clone().normalize();

    // Deterministic trigonometric biome field (zero texture downloads)
    const harmonic =
      Math.sin(dir.x * 7.2 + dir.z * 4.3) * 0.45 +
      Math.cos(dir.y * 6.4 - dir.x * 3.8) * 0.35 +
      Math.sin((dir.x + dir.y + dir.z) * 11.1) * 0.2;

    const eqDist = Math.abs(dir.y);
    let radialOffset = 0;

    if (eqDist < 0.055) {
      // Equator Space Car Speedway!
      const isCenterStripe = eqDist < 0.011 && Math.sin(Math.atan2(dir.x, dir.z) * 32) > 0;
      c.copy(isCenterStripe ? stripe : raceway);
      radialOffset = 0.01;
    } else if (harmonic < -0.24) {
      c.copy(ocean);
      radialOffset = -0.05;
    } else if (harmonic > 0.34) {
      c.copy(mango);
      radialOffset = 0.06;
    } else {
      c.copy(mint).lerp(lime, THREE.MathUtils.clamp((harmonic + 0.24) / 0.58, 0, 1));
      radialOffset = harmonic * 0.04;
    }

    v.copy(dir).multiplyScalar(radius + radialOffset);
    pos.setXYZ(i, v.x, v.y, v.z);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

const SNACK_BEACON_COORDS: readonly { lat: number; lon: number; color: string }[] = [
  { lat: 86.5, lon: -28, color: "#ff1744" },
  { lat: 81.5, lon: 55, color: "#ff9100" },
  { lat: 60, lon: -108, color: "#ffd600" },
  { lat: 30, lon: 145, color: "#00e676" },
  { lat: 0, lon: -38, color: "#00e5ff" },
  { lat: -42, lon: 92, color: "#d500f9" },
];

export function HungryPlanetMesh(): React.JSX.Element {
  const haloRef = useRef<THREE.Mesh | null>(null);
  const res = useMemo(() => {
    const planetGeo = buildKolmogorovPlanetGeometry(PLANET_RADIUS);
    const planetMat = applyRetroMaterial(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.78,
        metalness: 0.08,
      }),
    );
    const eqRingMat = new THREE.MeshBasicMaterial({
      color: "#fde047",
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    return { planetGeo, planetMat, eqRingMat };
  }, []);

  useEffect(
    () => () => {
      res.planetGeo.dispose();
      res.planetMat.dispose();
      res.eqRingMat.dispose();
    },
    [res],
  );

  useFrame((_, delta) => {
    if (haloRef.current) {
      haloRef.current.rotation.z += delta * 0.12;
    }
  });

  const landmarks = useMemo(() => {
    const consolePose = surfacePoseFromDir(latLonToPosition(87.2, -45, 1), 0.05);
    const solarPose = surfacePoseFromDir(latLonToPosition(84.8, 135, 1), 0.05);
    const rocketPropPose = surfacePoseFromDir(latLonToPosition(83.5, -10, 1), 0.05);
    return { consolePose, solarPose, rocketPropPose };
  }, []);

  return (
    <>
      {/* Spherical Planetary BallCollider — exact center [0,0,0] matches KolmoPointGravity */}
      <RigidBody type="fixed" colliders={false} userData={{ kind: "planet", radius: PLANET_RADIUS }}>
        <BallCollider args={[PLANET_RADIUS]} friction={1.08} restitution={0.05} />
        <mesh geometry={res.planetGeo} material={res.planetMat} receiveShadow castShadow />
      </RigidBody>

      {/* Orbital Snack Halo Ring */}
      <mesh ref={haloRef} rotation={[Math.PI * 0.42, 0.25, 0]}>
        <torusGeometry args={[PLANET_RADIUS + 24, 0.45, 8, 96]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.3} />
      </mesh>

      {/* 6 Color-Coded Snack Beacons around the globe */}
      {SNACK_BEACON_COORDS.map((b, idx) => {
        const pose = surfacePoseFromDir(latLonToPosition(b.lat, b.lon, 1), 0);
        return (
          <group key={idx} position={pose.position} rotation={pose.euler}>
            <mesh position={[0, 1.5, 0]}>
              <cylinderGeometry args={[0.14, 0.24, 3.0, 6]} />
              <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} flatShading />
            </mesh>
            <mesh position={[0, 3.4, 0]}>
              <octahedronGeometry args={[0.72, 0]} />
              <meshStandardMaterial
                color={b.color}
                emissive={b.color}
                emissiveIntensity={1.1}
                flatShading
              />
            </mesh>
          </group>
        );
      })}

      {/* Fixed Planetary Landmarks from CubicWave out_sand3d GLBs */}
      <Sand3D
        glbUrl="/assets/ss_console_terminal.glb"
        position={landmarks.consolePose.position}
        rotation={landmarks.consolePose.euler}
        fixed
      />
      <Sand3D
        glbUrl="/assets/ss_solar_panel_3m.glb"
        position={landmarks.solarPose.position}
        rotation={landmarks.solarPose.euler}
        fixed
      />
      <Sand3D
        glbUrl="/assets/veh_derby_cardboard_rocket_1p.glb"
        position={landmarks.rocketPropPose.position}
        rotation={landmarks.rocketPropPose.euler}
        fixed
      />

      {/* Distant Ringed Exoplanet backdrop */}
      <Exoplanet
        position={[-260, 140, -380]}
        radius={68}
        ringInner={94}
        ringOuter={148}
        color="#f472b6"
        moonlets
      />
    </>
  );
}
