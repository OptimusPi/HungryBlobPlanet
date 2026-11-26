import * as THREE from "three";
import { ORB_TIERS, type OrbShape, type OrbTier } from "@pinkaphant/kolmo/suika";

export const PLANET_RADIUS = 120;
export const PLANET_SURFACE_G = 9.81;

/**
 * First 7 Suika tiers (Red -> Orange -> Yellow -> Green -> Cyan -> Blue -> Violet)
 * drive Glorb's dynamic shape-shift cravings around the planet.
 */
export const CRAVING_TIERS: readonly OrbTier[] = ORB_TIERS.slice(0, 7);

export const CHONK_TITLES: readonly string[] = [
  "Pea-Sized Intern",
  "Snack-Curious Sphere",
  "Rotund Tourist",
  "Wide Load Citizen",
  "Certified Mega-Chonk",
  "Orbital Chungus",
  "Planetary Snack Tax",
  "Gravitational Singularity",
];

const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _tang = new THREE.Vector3();

/** Convert latitude & longitude (degrees) to Cartesian [x, y, z] on sphere of `radius`. */
export function latLonToPosition(
  latDeg: number,
  lonDeg: number,
  radius: number = PLANET_RADIUS,
): [number, number, number] {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const cosLat = Math.cos(lat);
  return [
    radius * cosLat * Math.sin(lon),
    radius * Math.sin(lat),
    radius * cosLat * Math.cos(lon),
  ];
}

export interface SurfacePose {
  readonly position: [number, number, number];
  readonly quaternion: [number, number, number, number];
  readonly euler: [number, number, number];
}

/**
 * Computes a world pose at `PLANET_RADIUS + altitude` along `dir` with local `+Y`
 * aligned to the outward radial surface normal and local `+Z` tangent to the sphere.
 */
export function surfacePoseFromDir(
  dir: readonly [number, number, number],
  altitude: number = 0,
  planetRadius: number = PLANET_RADIUS,
): SurfacePose {
  _up.set(dir[0], dir[1], dir[2]);
  if (_up.lengthSq() < 1e-8) _up.set(0, 1, 0);
  else _up.normalize();

  // Tangent forward vector pointing roughly along local +Z / -lat
  _fwd.set(0, 0, 1).projectOnPlane(_up);
  if (_fwd.lengthSq() < 1e-6) {
    _fwd.set(1, 0, 0).projectOnPlane(_up);
  }
  _fwd.normalize();
  _right.crossVectors(_up, _fwd).normalize();
  _mat.makeBasis(_right, _up, _fwd);
  _quat.setFromRotationMatrix(_mat);
  _euler.setFromQuaternion(_quat, "XYZ");

  const r = planetRadius + altitude;
  return {
    position: [_up.x * r, _up.y * r, _up.z * r],
    quaternion: [_quat.x, _quat.y, _quat.z, _quat.w],
    euler: [_euler.x, _euler.y, _euler.z],
  };
}

/** Monotonic asymptotic growth curve from 0.44m -> 1.85m as Glorb eats orbs. */
export function computeBlobRadius(mealsEaten: number): number {
  const n = Math.max(0, mealsEaten);
  return Number((0.44 + 1.41 * (1 - Math.exp(-n * 0.14))).toFixed(4));
}

export function computeBlobWeightKg(mealsEaten: number): number {
  const r = computeBlobRadius(mealsEaten);
  // Volume-proportional chonk mass in kg
  return Math.round(42 * Math.pow(r / 0.44, 2.75));
}

export function getChonkTitle(mealsEaten: number): string {
  const idx = Math.min(CHONK_TITLES.length - 1, Math.floor(Math.max(0, mealsEaten) / 3));
  return CHONK_TITLES[idx];
}

/**
 * Kolmogorov-simple craving progression:
 * First 6 meals teach the rainbow Suika ladder Red(0)->Orange(1)->Yellow(2)->Green(3)->Cyan(4)->Blue(5)->Violet(6),
 * then cycles deterministically across tiers 0..5 avoiding repeating the same tier twice in a row.
 */
export function nextCravingTier(mealsEaten: number, prevTier: number): number {
  if (mealsEaten < 6) {
    return (mealsEaten + 1) % CRAVING_TIERS.length;
  }
  const candidate = (prevTier + 1 + ((mealsEaten * 7) % 5)) % (CRAVING_TIERS.length - 1);
  return candidate === prevTier ? (prevTier + 1) % (CRAVING_TIERS.length - 1) : candidate;
}

export function shapeForTier(tier: number): OrbShape {
  return CRAVING_TIERS[Math.max(0, Math.min(CRAVING_TIERS.length - 1, Math.trunc(tier)))].shape;
}

/**
 * Advances a tangent-plane wanderer along a sphere of radius `radius`, preserving exact radial distance.
 */
export function stepSphericalWander(
  pos: readonly [number, number, number],
  heading: readonly [number, number, number],
  speed: number,
  dt: number,
  radius: number,
  turnAngleRad: number = 0,
): {
  position: [number, number, number];
  heading: [number, number, number];
  up: [number, number, number];
} {
  _pos.set(pos[0], pos[1], pos[2]);
  if (_pos.lengthSq() < 1e-8) _pos.set(0, radius, 0);
  _up.copy(_pos).normalize();

  _tang.set(heading[0], heading[1], heading[2]).projectOnPlane(_up);
  if (_tang.lengthSq() < 1e-8) {
    _tang.set(1, 0, 0).projectOnPlane(_up);
    if (_tang.lengthSq() < 1e-8) _tang.set(0, 0, 1).projectOnPlane(_up);
  }
  _tang.normalize();

  if (Math.abs(turnAngleRad) > 1e-6) {
    _quat.setFromAxisAngle(_up, turnAngleRad);
    _tang.applyQuaternion(_quat).normalize();
  }

  _pos.addScaledVector(_tang, speed * dt);
  _pos.normalize().multiplyScalar(radius);
  _up.copy(_pos).normalize();
  _tang.projectOnPlane(_up).normalize();

  return {
    position: [_pos.x, _pos.y, _pos.z],
    heading: [_tang.x, _tang.y, _tang.z],
    up: [_up.x, _up.y, _up.z],
  };
}
