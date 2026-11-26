import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import * as THREE from "three";
import {
  ActorTrait,
  DestructibleTarget,
  PilotedTag,
  SuikaSystem,
  TransformTrait,
  VehicleTrait,
  VelocityTrait,
  kolmoTelemetry,
  kolmoWorld,
  pilotedVehicleQuery,
  spawnSuikaOrb,
  type DestructibleTargetHandle,
  type SuikaMergeEvent,
} from "@pinkaphant/kolmo";
import { defaultSuikaArbiter } from "@pinkaphant/kolmo/suika";
import { DEFAULT_AMMO_CATALOG, KOLMOGOROV_CARBINE, createLauncherState, stepLauncher } from "@khr3/launchers";
import { playBlobChomp, playLauncherFire, playShatter, playSuikaMerge } from "./audioSynth";
import { playerBlobMotion, useGameStore, type PlasmaBolt } from "./gameStore";
import { CRAVING_TIERS, PLANET_RADIUS, latLonToPosition, surfacePoseFromDir } from "./planetMath";

const _playerPos = new THREE.Vector3();
const _playerUp = new THREE.Vector3();
const _orbPos = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _hitPt = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();

function BoltMesh({ bolt }: { readonly bolt: PlasmaBolt }): React.JSX.Element {
  const ref = useRef<THREE.Mesh | null>(null);
  const posRef = useRef<[number, number, number]>([...bolt.pos]);

  useFrame((_, dt) => {
    posRef.current[0] += bolt.vel[0] * dt;
    posRef.current[1] += bolt.vel[1] * dt;
    posRef.current[2] += bolt.vel[2] * dt;
    ref.current?.position.set(posRef.current[0], posRef.current[1], posRef.current[2]);
  });

  return (
    <mesh ref={ref} position={bolt.pos}>
      <sphereGeometry args={[0.16, 8, 8]} />
      <meshBasicMaterial color={bolt.color} />
    </mesh>
  );
}

/** Seed 14 colorful Suika orbs across the planet surface on boot / reset. */
function seedInitialSuikaFeast(): void {
  defaultSuikaArbiter.clear();
  defaultSuikaArbiter.setInSpace(false);
  const seeds: Array<{ lat: number; lon: number; tier: number }> = [
    { lat: 86, lon: 18, tier: 0 },
    { lat: 82, lon: -24, tier: 0 },
    { lat: 79, lon: 48, tier: 0 },
    { lat: 74, lon: -52, tier: 1 },
    { lat: 68, lon: 88, tier: 1 },
    { lat: 62, lon: -12, tier: 2 },
    { lat: 55, lon: 132, tier: 2 },
    { lat: 42, lon: -96, tier: 3 },
    { lat: 28, lon: 45, tier: 3 },
    { lat: 15, lon: -165, tier: 1 },
    { lat: -10, lon: 75, tier: 0 },
    { lat: -25, lon: -40, tier: 2 },
    { lat: -48, lon: 120, tier: 4 },
    { lat: -65, lon: -115, tier: 0 },
  ];

  for (const s of seeds) {
    const dir = latLonToPosition(s.lat, s.lon, 1);
    const pose = surfacePoseFromDir(dir, 1.25);
    spawnSuikaOrb({
      tier: s.tier,
      position: pose.position,
      linearDamping: 0.14,
    });
  }
}

export function PlanetGameplayRig(): React.JSX.Element {
  const { camera, gl } = useThree();
  const { world: rapierWorld } = useRapier();
  const targetHandlesRef = useRef(new Map<string, DestructibleTargetHandle>());
  const launcherStateRef = useRef(createLauncherState(KOLMOGOROV_CARBINE.spec));
  const fireRequestedRef = useRef<{ active: boolean; ndcX: number; ndcY: number; oneShot: boolean }>({
    active: false,
    ndcX: 0,
    ndcY: 0,
    oneShot: false,
  });
  const chompKeyRef = useRef(false);
  const wrongEatCooldownRef = useRef(0);
  const telemetryTimerRef = useRef(0);

  const targets = useGameStore((s) => s.targets);
  const bolts = useGameStore((s) => s.bolts);
  const resetCounter = useGameStore((s) => s.resetCounter);
  const recordMeal = useGameStore((s) => s.recordMeal);
  const recordWrongEat = useGameStore((s) => s.recordWrongEat);
  const recordMerge = useGameStore((s) => s.recordMerge);
  const recordShatter = useGameStore((s) => s.recordShatter);
  const addBolt = useGameStore((s) => s.addBolt);
  const pruneBolts = useGameStore((s) => s.pruneBolts);
  const spawnTarget = useGameStore((s) => s.spawnTarget);
  const setTelemetrySnapshot = useGameStore((s) => s.setTelemetrySnapshot);
  const setTool = useGameStore((s) => s.setTool);
  const toggleWorkshop = useGameStore((s) => s.toggleWorkshop);
  const setCustomSuikaUrl = useGameStore((s) => s.setCustomSuikaUrl);
  const setCustomGlbUrl = useGameStore((s) => s.setCustomGlbUrl);

  // Seed initial orbs on mount and reset
  useEffect(() => {
    seedInitialSuikaFeast();
  }, [resetCounter]);

  const registerTarget = useCallback((id: string, handle: DestructibleTargetHandle | null) => {
    if (handle) targetHandlesRef.current.set(id, handle);
    else targetHandlesRef.current.delete(id);
  }, []);

  const handleShatter = useCallback(() => {
    playShatter();
    recordShatter(100);
  }, [recordShatter]);

  const handleMerge = useCallback(
    (ev: SuikaMergeEvent) => {
      playSuikaMerge(ev.toTier);
      recordMerge(ev.toTier, ev.scoreGain, ev.combo);
    },
    [recordMerge],
  );

  // Canvas pointer firing + hotkeys + global drag-and-drop GLB importer
  useEffect(() => {
    const dom = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const rect = dom.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      fireRequestedRef.current = { active: true, ndcX, ndcY, oneShot: false };
    };
    const onPointerUp = () => {
      fireRequestedRef.current.active = false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === "Digit1") setTool("suika");
      else if (e.code === "Digit2") setTool("blaster");
      else if (e.code === "Digit3") setTool("spawner");
      else if (e.code === "KeyJ") {
        fireRequestedRef.current = { active: true, ndcX: 0, ndcY: 0.05, oneShot: true };
      } else if (e.code === "KeyE") {
        chompKeyRef.current = true;
      } else if (e.code === "Tab") {
        e.preventDefault();
        toggleWorkshop();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "KeyJ") fireRequestedRef.current.active = false;
      if (e.code === "KeyE") chompKeyRef.current = false;
    };

    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const st = useGameStore.getState();
      if (st.tool === "suika") {
        setCustomSuikaUrl(url);
        st.triggerQuip(`LOADED ${file.name} AS SUIKA LAUNCH SKIN!`);
      } else {
        setCustomGlbUrl(url);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
        const dropPos = camera.position.clone().addScaledVector(dir, 5.5);
        spawnTarget({ pos: [dropPos.x, dropPos.y, dropPos.z], importedUrl: url, hp: 45 });
        st.triggerQuip(`DROPPED ${file.name} ONTO PLANET AS BVH DESTRUCTIBLE!`);
      }
    };

    // Custom event dispatched by HUD fire/chomp buttons
    const onHudFire = () => {
      fireRequestedRef.current = { active: true, ndcX: 0, ndcY: 0.08, oneShot: true };
    };
    const onHudChomp = () => {
      chompKeyRef.current = true;
    };

    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    window.addEventListener("hbp:fire", onHudFire);
    window.addEventListener("hbp:chomp", onHudChomp);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("hbp:fire", onHudFire);
      window.removeEventListener("hbp:chomp", onHudChomp);
    };
  }, [gl, camera, setTool, toggleWorkshop, setCustomSuikaUrl, setCustomGlbUrl, spawnTarget]);

  const ammoSpeed = useMemo(() => DEFAULT_AMMO_CATALOG.orb?.muzzleSpeedMs ?? 24, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, Math.max(1e-4, rawDt));
    const st = useGameStore.getState();
    if (wrongEatCooldownRef.current > 0) wrongEatCooldownRef.current = Math.max(0, wrongEatCooldownRef.current - dt);

    // 1. Track live player position & speed from Koota ECS (either piloted vehicle or Glorb on foot)
    const pilotedVeh = kolmoWorld.queryFirst(pilotedVehicleQuery);
    const actorEnt = kolmoWorld.queryFirst(ActorTrait, TransformTrait);
    if (pilotedVeh && pilotedVeh.has(TransformTrait)) {
      const tr = pilotedVeh.get(TransformTrait);
      const vel = pilotedVeh.has(VelocityTrait) ? pilotedVeh.get(VelocityTrait) : undefined;
      if (tr) {
        _playerPos.set(tr.x, tr.y, tr.z);
        playerBlobMotion.worldPos = [tr.x, tr.y, tr.z];
        playerBlobMotion.speed = vel?.speedKmh ? vel.speedKmh / 3.6 : 0;
      }
    } else if (actorEnt) {
      const tr = actorEnt.get(TransformTrait);
      const vel = actorEnt.has(VelocityTrait) ? actorEnt.get(VelocityTrait) : undefined;
      if (tr) {
        _playerPos.set(tr.x, tr.y, tr.z);
        playerBlobMotion.worldPos = [tr.x, tr.y, tr.z];
        playerBlobMotion.speed = vel?.speedKmh ? vel.speedKmh / 3.6 : 0;
      }
    } else {
      _playerPos.copy(camera.position);
    }

    _playerUp.copy(_playerPos);
    if (_playerUp.lengthSq() > 1e-6) _playerUp.normalize();
    else _playerUp.set(0, 1, 0);
    playerBlobMotion.worldUp = [_playerUp.x, _playerUp.y, _playerUp.z];

    // Sync telemetry mode / nearby vehicle to React HUD at ~10 Hz
    telemetryTimerRef.current += dt;
    if (telemetryTimerRef.current >= 0.1) {
      telemetryTimerRef.current = 0;
      setTelemetrySnapshot(kolmoTelemetry.mode, kolmoTelemetry.activeVehicleId, kolmoTelemetry.nearVehicleId);
    }

    // 2. Glorb's Dynamic Color-Craving Eat Loop (only when walking or pressing [E]!)
    const eatReach = st.blobRadius + 1.05;
    let nearestCraving = Infinity;
    const orbs = defaultSuikaArbiter.getEntities();

    for (const orb of orbs) {
      _orbPos.set(orb.position[0], orb.position[1], orb.position[2]);
      const dist = _playerPos.distanceTo(_orbPos);
      if (orb.tier === st.cravingTier && dist < nearestCraving) {
        nearestCraving = dist;
      }
      if (dist <= eatReach && (orb.tier === st.cravingTier || chompKeyRef.current)) {
        if (orb.tier === st.cravingTier || chompKeyRef.current) {
          const matched = orb.tier === st.cravingTier;
          if (matched) {
            if (defaultSuikaArbiter.remove(orb.id)) {
              const tierDef = CRAVING_TIERS[orb.tier] ?? CRAVING_TIERS[0];
              playerBlobMotion.chompPulse = 1;
              playerBlobMotion.burpPulse = 1;
              playerBlobMotion.lastEatColor = tierDef.color;
              const fatness = (st.blobRadius - 0.44) / 1.41;
              playBlobChomp(true, fatness);
              recordMeal(orb.tier, tierDef.scoreValue * 2);
              chompKeyRef.current = false;
              break;
            }
          } else if (chompKeyRef.current && wrongEatCooldownRef.current === 0) {
            wrongEatCooldownRef.current = 0.7;
            playBlobChomp(false, 0);
            recordWrongEat();
            chompKeyRef.current = false;
          }
        }
      }
    }
    playerBlobMotion.nearCravingDist = nearestCraving;
    if (chompKeyRef.current) chompKeyRef.current = false;

    // 3. Step @khr3/launchers state machine & fire Suika / Blaster / Stuff Dropper!
    const triggerActive = fireRequestedRef.current.active;
    const ev = stepLauncher(launcherStateRef.current, { trigger: triggerActive, reload: false }, dt);
    if (fireRequestedRef.current.oneShot) {
      fireRequestedRef.current.active = false;
      fireRequestedRef.current.oneShot = false;
    }

    if (ev) {
      _pointerNdc.set(fireRequestedRef.current.ndcX, fireRequestedRef.current.ndcY);
      _raycaster.setFromCamera(_pointerNdc, camera);
      _rayOrigin.copy(_raycaster.ray.origin);
      _rayDir.copy(_raycaster.ray.direction).normalize();

      const spawnPt = _playerPos
        .clone()
        .addScaledVector(_playerUp, st.blobRadius + 0.85)
        .addScaledVector(_rayDir, st.blobRadius + 1.15);

      playLauncherFire(st.tool);

      if (st.tool === "suika") {
        const launchTier =
          st.suikaLaunchTier === "auto"
            ? Math.max(0, Math.min(3, st.cravingTier))
            : st.suikaLaunchTier;
        const speed = Math.min(26, Math.max(15, ammoSpeed * 0.75));
        spawnSuikaOrb({
          tier: launchTier,
          position: [spawnPt.x, spawnPt.y, spawnPt.z],
          velocity: [
            _rayDir.x * speed + _playerUp.x * 3.5,
            _rayDir.y * speed + _playerUp.y * 3.5,
            _rayDir.z * speed + _playerUp.z * 3.5,
          ],
          linearDamping: 0.14,
          importedUrl: st.customSuikaUrl,
        });
      } else if (st.tool === "blaster") {
        const now = performance.now();
        addBolt({
          id: `bolt_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          pos: [spawnPt.x, spawnPt.y, spawnPt.z],
          vel: [_rayDir.x * 58, _rayDir.y * 58, _rayDir.z * 58],
          color: "#38bdf8",
          bornAt: now,
        });

        let bestId: string | null = null;
        let bestDist = 110;
        targetHandlesRef.current.forEach((handle, id) => {
          const snap = handle.getSnapshot();
          if (!snap.alive) return;
          _targetPos.set(snap.position[0], snap.position[1], snap.position[2]);
          _toTarget.subVectors(_targetPos, _rayOrigin);
          const proj = _toTarget.dot(_rayDir);
          if (proj < 0 || proj > bestDist) return;
          _closest.copy(_rayOrigin).addScaledVector(_rayDir, proj);
          if (_closest.distanceTo(_targetPos) <= 1.55) {
            bestDist = proj;
            bestId = id;
          }
        });

        if (bestId) {
          const h = targetHandlesRef.current.get(bestId);
          if (h) {
            _hitPt.copy(_rayOrigin).addScaledVector(_rayDir, bestDist);
            h.applyHit({
              targetId: bestId,
              point: [_hitPt.x, _hitPt.y, _hitPt.z],
              normal: [-_rayDir.x, -_rayDir.y, -_rayDir.z],
              impulse: [_rayDir.x * 18, _rayDir.y * 18, _rayDir.z * 18],
              distance: bestDist,
            });
          }
        } else {
          // Shove dynamic Suika orbs / shards along the ray for trick-shot merges!
          rapierWorld.bodies.forEach((rb) => {
            if (!rb.isDynamic()) return;
            const p = rb.translation();
            _targetPos.set(p.x, p.y, p.z);
            _toTarget.subVectors(_targetPos, _rayOrigin);
            const proj = _toTarget.dot(_rayDir);
            if (proj < 1 || proj > 90) return;
            _closest.copy(_rayOrigin).addScaledVector(_rayDir, proj);
            if (_closest.distanceTo(_targetPos) <= 2.4) {
              rb.applyImpulse({ x: _rayDir.x * 22, y: _rayDir.y * 22, z: _rayDir.z * 22 }, true);
            }
          });
        }
      } else {
        const labels = ["garys-beans", "tris-soda", "goofy-emoji"] as const;
        const pick = labels[Math.floor(Math.random() * labels.length)];
        spawnTarget({
          pos: [spawnPt.x + _rayDir.x * 2.5, spawnPt.y + _rayDir.y * 2.5, spawnPt.z + _rayDir.z * 2.5],
          kind: Math.random() < 0.35 ? "glass-bottle" : "tin-can",
          labelId: pick,
          importedUrl: st.customGlbUrl,
          hp: 35,
        });
      }
    }

    // Prune visual plasma bolts + rescue any orb that flew out past orbital capture
    pruneBolts(performance.now());
    for (const orb of orbs) {
      const r = Math.hypot(orb.position[0], orb.position[1], orb.position[2]);
      if (r > PLANET_RADIUS * 4.2) {
        defaultSuikaArbiter.remove(orb.id);
      }
    }
  });

  // Expose quick board helper for HUD
  useEffect(() => {
    const onBoardNearest = (e: Event) => {
      const custom = e as CustomEvent<{ id?: string }>;
      const requestedId = custom.detail?.id;
      const piloted = kolmoWorld.queryFirst(pilotedVehicleQuery);
      if (piloted && !requestedId) {
        // Exit currently piloted vehicle
        const v = piloted.get(VehicleTrait);
        if (v) {
          piloted.remove(PilotedTag);
        }
        return;
      }
      if (requestedId) {
        // Board requested vehicle directly
        for (const ent of kolmoWorld.query(VehicleTrait)) {
          const v = ent.get(VehicleTrait);
          if (v?.id === requestedId) {
            for (const prev of kolmoWorld.query(pilotedVehicleQuery)) {
              prev.remove(PilotedTag);
            }
            ent.add(PilotedTag);
            kolmoTelemetry.activeVehicleId = v.id;
            kolmoTelemetry.mode = v.isFlight ? "flight" : "car";
            break;
          }
        }
      }
    };
    window.addEventListener("hbp:board", onBoardNearest);
    return () => window.removeEventListener("hbp:board", onBoardNearest);
  }, []);

  return (
    <>
      <SuikaSystem minCoreRadius={PLANET_RADIUS} onMerge={handleMerge} />

      {targets.map((spec) => (
        <DestructibleTarget
          key={spec.id}
          spec={spec}
          registerTarget={registerTarget}
          onShatter={handleShatter}
        />
      ))}

      {bolts.map((b) => (
        <BoltMesh key={b.id} bolt={b} />
      ))}
    </>
  );
}
