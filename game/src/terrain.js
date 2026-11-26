// The valley: one seeded heightfield island with a lake, a river plain, a
// flattened runway pad, a village, pine forest and snow peaks. terrainHeight(x, z)
// is the single source of truth — the mesh, the collision, the rings and the
// minimap all read it, so they can never disagree.
import * as THREE from 'three';
import { WORLD, RUNWAY, FAR_RUNWAY, PALETTE } from './config.js';
import { createRandom, makeNoise2D, fbm } from './random.js';

function smoothstep(a, b, t) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

function flattenPad(h, x, z, pad) {
  // Blend the terrain to the pad height (3 m) inside the runway rectangle.
  // Both runways are 09/27, so the strip always runs east-west: length
  // along X, width along Z. (An earlier version swapped them for heading
  // 270, which left the far runway buried under 19 m of hillside.)
  const along = Math.abs(x - pad.x);
  const across = Math.abs(z - pad.z);
  const inAlong = smoothstep(pad.length / 2 + 60, pad.length / 2 - 10, along);
  const inAcross = smoothstep(pad.width / 2 + 55, pad.width / 2 - 5, across);
  const w = inAlong * inAcross;
  return h * (1 - w) + 3 * w;
}

export function makeHeightFunction(seed) {
  const noise = makeNoise2D(seed);
  return function terrainHeight(x, z) {
    const half = WORLD.size / 2;
    // Island falloff: the valley sinks to the lake at the edges.
    const edge = Math.max(Math.abs(x), Math.abs(z)) / half;
    const island = 1 - smoothstep(0.55, 1.0, edge);
    let h = fbm(noise, x * 0.0016 + 7.3, z * 0.0016 + 2.1, 4) * 95 + 18;
    h += fbm(noise, x * 0.006 + 1.7, z * 0.006 + 8.4, 3) * 14;
    // A river plain carves a low corridor down the middle for the ring course.
    const river = Math.exp(-((x + 90) * (x + 90)) / (2 * 170 * 170));
    h = h * (1 - river * 0.55) + 6 * river * 0.55;
    h *= (0.25 + 0.75 * island);
    h = flattenPad(h, x, z, RUNWAY);
    h = flattenPad(h, x, z, FAR_RUNWAY);
    return Math.max(h, 0.5);
  };
}

function colourFor(h, slope, rand, field) {
  const c = new THREE.Color();
  if (h < WORLD.waterLevel + 1.2) c.set(PALETTE.sand);
  else if (slope > 0.55) c.set(PALETTE.rock);
  else if (h > 105) c.set(PALETTE.snow);
  else if (h > 62) c.set(PALETTE.forest);
  else if (field > 0.12) c.set(PALETTE.field);
  else c.set(PALETTE.grass);
  // Slight variation so the fields read as patchwork, not flat paint.
  const v = 0.88 + rand() * 0.24;
  c.multiplyScalar(v);
  return c;
}

export function buildTerrain(scene, seed) {
  const terrainHeight = makeHeightFunction(seed);
  const size = WORLD.size; const seg = WORLD.segments;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const rand = createRandom(seed * 31 + 7);
  // Field patchwork from low-frequency noise, so the valley reads as
  // farmland blocks from the air instead of a flat green carpet.
  const fieldNoise = makeNoise2D(seed * 7 + 1);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i); const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const hx = terrainHeight(x + 4, z) - terrainHeight(x - 4, z);
    const hz = terrainHeight(x, z + 4) - terrainHeight(x, z - 4);
    const slope = Math.sqrt(hx * hx + hz * hz) / 8;
    const field = fbm(fieldNoise, x * 0.0035 + 3, z * 0.0035 + 9, 2);
    const c = colourFor(h, slope, rand, field);
    colours[i * 3] = c.r; colours[i * 3 + 1] = c.g; colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  scene.add(mesh);

  // The lake: a flat blue disc at water level in the north-east corner.
  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(420, 40),
    new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.92 }),
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(720, WORLD.waterLevel, -640);
  scene.add(lake);

  buildRunway(scene, RUNWAY);
  buildRunway(scene, FAR_RUNWAY);
  buildVillage(scene, seed);
  buildForest(scene, seed, terrainHeight);
  buildClouds(scene, seed);
  return terrainHeight;
}

function buildRunway(scene, pad) {
  const group = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(pad.length, 0.4, pad.width),
    new THREE.MeshLambertMaterial({ color: PALETTE.runway }),
  );
  strip.position.set(pad.x, 3.1, pad.z);
  group.add(strip);
  // Centreline dashes and threshold bars, painted as thin white boxes.
  const markMat = new THREE.MeshBasicMaterial({ color: PALETTE.marking });
  const half = pad.length / 2;
  for (let d = -half + 40; d < half - 30; d += 40) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(18, 0.1, 1.2), markMat);
    dash.position.set(pad.x + d, 3.35, pad.z);
    group.add(dash);
  }
  for (const end of [-1, 1]) {
    for (let k = -2; k <= 2; k += 1) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 3.4), markMat);
      bar.position.set(pad.x + end * (half - 14), 3.35, pad.z + k * 4.4);
      group.add(bar);
    }
  }
  // PAPI lights: two red, two white beside the threshold.
  const papi = [[0xff4444, 0xff4444, 0xffffff, 0xffffff]];
  papi[0].forEach((col, i) => {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), new THREE.MeshBasicMaterial({ color: col }));
    lamp.position.set(pad.x - half + 30, 3.8, pad.z + pad.width / 2 + 6 + i * 3);
    group.add(lamp);
  });
  // Windsock on a pole at the runway corner.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 6), new THREE.MeshLambertMaterial({ color: '#dddddd' }));
  pole.position.set(pad.x - half + 20, 7.5, pad.z - pad.width / 2 - 8);
  group.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 8), new THREE.MeshLambertMaterial({ color: '#ff7a3c' }));
  sock.rotation.z = Math.PI / 2;
  sock.position.set(pad.x - half + 22.5, 11.4, pad.z - pad.width / 2 - 8);
  group.add(sock);
  scene.add(group);
}

function buildVillage(scene, seed) {
  const rand = createRandom(seed * 97 + 3);
  const houseMat = new THREE.MeshLambertMaterial({ color: '#e8dcc0' });
  const roofMat = new THREE.MeshLambertMaterial({ color: '#b5542e' });
  for (let i = 0; i < 26; i += 1) {
    const x = 180 + rand() * 320; const z = 560 + rand() * 260;
    const w = 8 + rand() * 8; const d = 7 + rand() * 7; const h = 5 + rand() * 4;
    const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), houseMat);
    house.position.set(x, 3 + h / 2, z);
    scene.add(house);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 3.5, 4), roofMat);
    roof.position.set(x, 3 + h + 1.7, z);
    roof.rotation.y = Math.PI / 4;
    scene.add(roof);
  }
}

function buildForest(scene, seed, terrainHeight) {
  const rand = createRandom(seed * 57 + 11);
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#5a3d24' });
  const crownGeo = new THREE.ConeGeometry(3.2, 11, 6);
  const crownMat = new THREE.MeshLambertMaterial({ color: PALETTE.forest });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, 320);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, 320);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const s = new THREE.Vector3();
  let placed = 0; let guard = 0;
  while (placed < 320 && guard < 4000) {
    guard += 1;
    const x = (rand() * 2 - 1) * 1050; const z = (rand() * 2 - 1) * 1050;
    const h = terrainHeight(x, z);
    if (h < 8 || h > 60) continue;
    if (Math.abs(z - 780) < 60 && Math.abs(x) < 260) continue; // keep the home runway clear
    if (Math.abs(z + 820) < 90 && Math.abs(x + 120) < 320) continue; // keep the far runway and its approach clear
    const sc = 0.7 + rand() * 0.9;
    m.compose(new THREE.Vector3(x, h + 2 * sc, z), q, new THREE.Vector3(sc, sc, sc));
    trunks.setMatrixAt(placed, m);
    m.compose(new THREE.Vector3(x, h + (4 + 5.5) * sc, z), q, new THREE.Vector3(sc, sc, sc));
    crowns.setMatrixAt(placed, m);
    placed += 1;
  }
  trunks.count = placed; crowns.count = placed;
  scene.add(trunks); scene.add(crowns);
}

function buildClouds(scene, seed) {
  const rand = createRandom(seed * 13 + 5);
  // Unlit white: Lambert clouds went grey-beige under the warm sun.
  const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });
  for (let i = 0; i < 14; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let p = 0; p < puffs; p += 1) {
      const r = 14 + rand() * 22;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      ball.position.set(p * 18 - puffs * 9, rand() * 4, rand() * 10 - 5);
      ball.scale.y = 0.45;
      cloud.add(ball);
    }
    cloud.position.set((rand() * 2 - 1) * 1000, 190 + rand() * 90, (rand() * 2 - 1) * 1000);
    scene.add(cloud);
  }
}
