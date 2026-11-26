// The 3D scene: golden-hour sun, warm fog, a gradient sky dome, the terrain,
// the plane and the rings. One style throughout — low-poly, warm, readable at
// a glance when the screenshot is shrunk to a contact sheet.
import * as THREE from 'three';
import { PALETTE } from './config.js';
import { buildTerrain } from './terrain.js';
import { buildPlane } from './plane.js';
import { buildRings, updateRings } from './rings.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

export function createScene(seed) {
  const scene = new THREE.Scene();
  // Gradient sky dome: deep blue overhead fading to golden horizon.
  const skyGeo = new THREE.SphereGeometry(2600, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 horizon; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(horizon, top, smoothstep(0.0, 0.55, h)), 1.0); }',
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  scene.fog = new THREE.Fog(0xdfa56e, 800, 3000);
  // Golden-hour sun, low from the west, warm.
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sun.position.set(-900, 420, 500);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x9fc3e8, 0x5d6b3a, 0.9));
  // The sun disc itself, so the sky has a focal point in screenshots.
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(60, 32), new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }));
  sunDisc.position.set(-1500, 300, 900);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);
  const terrainHeight = buildTerrain(scene, seed);
  return { scene, terrainHeight };
}

export function createGameObjects(scene, world) {
  const plane = buildPlane();
  scene.add(plane.group);
  const rings = buildRings(scene, world.rings);
  // Warm fill light that rides with the camera and shines at the plane: the
  // low western sun leaves the chase camera looking at the plane's shadowed
  // side, so in screenshots the amber fuselage read as dark brown. The fill
  // lifts the camera-facing side just enough to read as amber, without
  // flattening the golden-hour look.
  const fill = new THREE.DirectionalLight(0xffe8c0, 0.8);
  scene.add(fill);
  scene.add(fill.target);
  return { plane, rings, fill };
}

export function renderFrame(renderer, scene, camera, world, objects, time) {
  const f = world.flight;
  objects.plane.group.position.copy(f.pos);
  objects.plane.group.quaternion.copy(quaternionOf(f));
  objects.fill.position.copy(camera.position);
  objects.fill.target.position.copy(f.pos);
  // Prop spins with throttle and speed.
  objects.plane.prop.rotation.z += (0.15 + f.throttle * 0.09 + f.speed * 0.02);
  updateRings(objects.rings.meshes, world.nextRing, time);
  renderer.render(scene, camera);
}

function quaternionOf(f) {
  const e = new THREE.Euler(f.pitch, (f.heading * Math.PI) / 180, f.roll, 'YXZ');
  return new THREE.Quaternion().setFromEuler(e);
}
