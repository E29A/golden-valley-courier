// The ring course: gold torus rings strung down the valley from the home runway
// to the far runway. The next ring glows gold and pulses; flown rings turn green;
// later rings stay cyan. A ring counts when the plane crosses its plane inside
// the torus — centre passes pay a bonus, low passes in Slalom pay double.
import * as THREE from 'three';
import { createRandom } from './random.js';
import { RUNWAY, FAR_RUNWAY, PALETTE, SCORE } from './config.js';

export function makeRingCourse(mission, terrainHeight, seed) {
  const rand = createRandom(seed * 101 + mission.rings);
  const rings = [];
  const start = new THREE.Vector3(RUNWAY.x, 0, RUNWAY.z);
  const end = new THREE.Vector3(FAR_RUNWAY.x, 0, FAR_RUNWAY.z);
  for (let i = 0; i < mission.rings; i += 1) {
    const t = (i + 1) / (mission.rings + 1);
    // A smooth S-curve down the valley, not independent jitter: consecutive
    // rings move only a few metres sideways, so the course is a slalom a
    // plane can actually fly instead of a 50 m jump every 123 m. (An earlier
    // 90 m S-curve left the last ring in a stable circling limit cycle: the
    // plane's turn radius is ~50 m and it kept missing by 2 m.) A little
    // random wobble keeps it from being a perfect sine.
    const x = start.x + (end.x - start.x) * t + 55 * Math.sin(t * 2.4 + 0.6) + (rand() * 2 - 1) * 12;
    const z = start.z + (end.z - start.z) * t;
    const low = mission.id === 'slalom';
    // Early rings sit lower so the climb from the runway meets them; the
    // course rises as the valley does. Rings are wide (24 m) — at 60 m/s a
    // 14 m ring is a needle to thread, and the game should reward flying,
    // not punish it.
    const alt = low ? terrainHeight(x, z) + 22 + rand() * 14
      : terrainHeight(x, z) + (t < 0.3 ? 30 + rand() * 25 : 42 + rand() * 38);
    rings.push({
      index: i,
      pos: new THREE.Vector3(x, alt, z),
      radius: low ? 16 : 24,
      done: false, passed: false,
    });
  }
  return rings;
}

export function buildRings(scene, rings) {
  const group = new THREE.Group();
  const geo = new THREE.TorusGeometry(1, 0.09, 10, 40);
  const meshes = rings.map((ring) => {
    const mat = new THREE.MeshBasicMaterial({ color: PALETTE.ringLater, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(ring.pos);
    mesh.scale.setScalar(ring.radius);
    // Face the course direction (roughly north along the valley).
    mesh.rotation.y = Math.PI / 2;
    mesh.userData.ring = ring;
    group.add(mesh);
    // A small centre beacon so the hole reads at distance.
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    dot.position.copy(ring.pos);
    group.add(dot);
    return mesh;
  });
  scene.add(group);
  return { group, meshes };
}

export function updateRings(meshes, nextIndex, time) {
  meshes.forEach((mesh, i) => {
    const ring = mesh.userData.ring;
    if (ring.done) { mesh.material.color.set(PALETTE.ringDone); mesh.scale.setScalar(ring.radius); return; }
    if (i === nextIndex) {
      mesh.material.color.set(PALETTE.ringNext);
      const pulse = 1 + Math.sin(time * 4) * 0.06;
      mesh.scale.setScalar(ring.radius * pulse);
    } else {
      mesh.material.color.set(PALETTE.ringLater);
      mesh.scale.setScalar(ring.radius);
    }
  });
}

// Returns the points earned this step (0 when nothing was crossed).
export function checkRings(rings, nextIndex, prevPos, pos) {
  if (nextIndex >= rings.length) return { points: 0, next: nextIndex, centre: false };
  const ring = rings[nextIndex];
  // Did the segment cross the ring's plane (z of the ring, course runs north)?
  const crossed = (prevPos.z - ring.pos.z) * (pos.z - ring.pos.z) <= 0 && Math.abs(pos.z - ring.pos.z) < 30;
  if (!crossed) return { points: 0, next: nextIndex, centre: false };
  const dx = pos.x - ring.pos.x; const dy = pos.y - ring.pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist > ring.radius + 6) return { points: 0, next: nextIndex, centre: false, missed: true };
  ring.done = true; ring.passed = true;
  // A graze (just outside the torus) still counts — it keeps a near miss
  // from soft-locking the sortie into endless circling — but it pays half.
  if (dist > ring.radius) return { points: 50, next: nextIndex + 1, centre: false, graze: true };
  const centre = dist < ring.radius * 0.35;
  let points = SCORE.ring + (centre ? SCORE.ringCentreBonus : 0);
  return { points, next: nextIndex + 1, centre };
}
