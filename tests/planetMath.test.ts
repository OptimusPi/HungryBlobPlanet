import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PLANET_RADIUS,
  computeBlobRadius,
  computeBlobWeightKg,
  getChonkTitle,
  latLonToPosition,
  nextCravingTier,
  stepSphericalWander,
  surfacePoseFromDir,
} from "../src/planetMath.ts";

describe("HungryBlobPlanet spherical & chonk math", () => {
  it("latLonToPosition places points at exact planet radius", () => {
    const p1 = latLonToPosition(0, 0, PLANET_RADIUS);
    assert.ok(Math.abs(Math.hypot(...p1) - PLANET_RADIUS) < 1e-6);

    const p2 = latLonToPosition(45, -120, PLANET_RADIUS);
    assert.ok(Math.abs(Math.hypot(...p2) - PLANET_RADIUS) < 1e-6);

    const north = latLonToPosition(90, 0, PLANET_RADIUS);
    assert.ok(Math.abs(north[1] - PLANET_RADIUS) < 1e-6);
  });

  it("surfacePoseFromDir places pose at PLANET_RADIUS + altitude", () => {
    const pose = surfacePoseFromDir([1, 2, -1], 1.5, PLANET_RADIUS);
    const dist = Math.hypot(...pose.position);
    assert.ok(Math.abs(dist - (PLANET_RADIUS + 1.5)) < 1e-5);
    const qLen = Math.hypot(...pose.quaternion);
    assert.ok(Math.abs(qLen - 1) < 1e-5);
  });

  it("blob radius and weight grow monotonically as meals increase", () => {
    let prevR = computeBlobRadius(0);
    let prevW = computeBlobWeightKg(0);
    assert.ok(prevR >= 0.44);
    for (let meals = 1; meals <= 30; meals++) {
      const r = computeBlobRadius(meals);
      const w = computeBlobWeightKg(meals);
      assert.ok(r > prevR);
      assert.ok(w >= prevW);
      assert.ok(r <= 1.86);
      prevR = r;
      prevW = w;
    }
    assert.equal(getChonkTitle(0), "Pea-Sized Intern");
    assert.equal(getChonkTitle(30), "Gravitational Singularity");
  });

  it("nextCravingTier teaches rainbow tiers 0..6 and avoids immediate repeats", () => {
    for (let m = 0; m < 6; m++) {
      assert.equal(nextCravingTier(m, m), (m + 1) % 7);
    }
    for (let m = 6; m < 25; m++) {
      const prev = m % 6;
      const next = nextCravingTier(m, prev);
      assert.notEqual(next, prev);
      assert.ok(next >= 0 && next < 6);
    }
  });

  it("stepSphericalWander preserves exact spherical altitude across 100 steps", () => {
    let pos: [number, number, number] = [0, PLANET_RADIUS + 0.5, 0];
    let heading: [number, number, number] = [1, 0, 0.3];
    for (let i = 0; i < 100; i++) {
      const res = stepSphericalWander(pos, heading, 4.0, 0.05, PLANET_RADIUS + 0.5, 0.04);
      pos = res.position;
      heading = res.heading;
      const r = Math.hypot(...pos);
      assert.ok(Math.abs(r - (PLANET_RADIUS + 0.5)) < 1e-5);
      // Heading must stay orthogonal to surface up
      const dot = res.heading[0] * res.up[0] + res.heading[1] * res.up[1] + res.heading[2] * res.up[2];
      assert.ok(Math.abs(dot) < 1e-5);
    }
  });
});
