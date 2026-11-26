// Golden Valley Courier — bootstrap. One sortie per mission: fly the rings in
// order down the valley, then land on the home runway. Live play runs on
// requestAnimationFrame with a fixed 1/60 s step; ?shot= stages a deterministic
// scene with the autopilot for screenshots; window.render_game_to_text() and
// window.advanceTime(ms) expose the state for scripted playtests.
import * as THREE from 'three';
import { STEP, WORLD, MISSIONS, BEST_KEY } from './config.js';
import { createRenderer, createScene, createGameObjects, renderFrame } from './render.js';
import { createWorld, startSortie, restartWorld, stepWorld, respawn, SCREENS } from './world.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createCameraRig, CAM_MODES } from './camera.js';
import { createAudio } from './audio.js';
import { shotInput, shotSeconds, shotScreen } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || WORLD.seed) || 1;
const shotName = params.get('shot') || '';
const missionId = params.get('mission') || 'ringrun';

const canvas = document.getElementById('scene');
const renderer = createRenderer(canvas);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 6000);
const { scene, terrainHeight } = createScene(seed);
const world = createWorld(missionId, terrainHeight, seed);
const objects = createGameObjects(scene, world);
const hud = createHud();
const audio = createAudio();
const rig = createCameraRig(camera);
const cameraRig = rig;

let camMode = 'chase';
let paused = false;
let time = 0;
let best = Number(window.localStorage.getItem(BEST_KEY) || 0);
world.best = best;

const input = createInput((code, dx, dy) => {
  if (code === 'orbit') { rig.orbit(dx, dy); return; }
  audio.ensure();
  if (code === 'Enter') {
    if (world.screen === SCREENS.TITLE) { audio.click(); startSortie(world); hud.showTitle(false); }
    return;
  }
  if (code === 'KeyC') { camMode = CAM_MODES[(CAM_MODES.indexOf(camMode) + 1) % CAM_MODES.length]; rig.resetOrbit(); return; }
  if (code === 'KeyP') {
    if (world.screen === SCREENS.PLAY) { paused = !paused; world.message = paused ? 'PAUSED' : ''; world.submessage = paused ? 'P — resume · R — restart' : ''; }
    return;
  }
  if (code === 'KeyM') { const m = audio.toggleMute(); world.submessage = m ? 'Sound off' : 'Sound on'; return; }
  if (code === 'KeyR') {
    if (world.screen === SCREENS.CRASHED) { respawn(world); return; }
    restartWorld(world, world.mission.id); startSortie(world); hud.showTitle(false);
    return;
  }
  if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') {
    const id = code === 'Digit1' ? 'ringrun' : code === 'Digit2' ? 'slalom' : 'landing';
    restartWorld(world, id); startSortie(world); hud.showTitle(false);
  }
});
document.getElementById('startBtn').addEventListener('click', () => {
  audio.ensure(); audio.click(); startSortie(world); hud.showTitle(false);
});

function landingInput(world) {
  const f = world.flight;
  const input = {
    throttleUp: false, throttleDown: false, pitchUp: false, pitchDown: false,
    rollLeft: false, rollRight: false, yawLeft: false, yawRight: false, brake: false,
  };
  if (f.throttle < 34) input.throttleUp = true;
  if (f.throttle > 38) input.throttleDown = true;
  let err = ((270 - f.heading + 540) % 360) - 180;
  if (err > 6) input.rollRight = true;
  else if (err < -6) input.rollLeft = true;
  const ground = world.terrainHeight(f.pos.x, f.pos.z);
  const agl = f.pos.y - ground;
  const dist = Math.abs(f.pos.x - -120);
  const wantAgl = Math.max(4, dist * 0.06);
  if (agl > wantAgl + 4) input.pitchDown = true;
  else if (agl < wantAgl - 4) input.pitchUp = true;
  return input;
}

function stageShot(name) {
  hud.showTitle(false);
  const seconds = shotSeconds(name);
  if (name === 'landing') {
    // Final approach: all rings flown, plane on a 270 heading toward Runway 27.
    startSortie(world);
    world.nextRing = world.rings.length;
    world.rings.forEach((r) => { r.done = true; });
    const f = world.flight;
    // Start the approach closer (x=420, not 620): after ~14 s the plane is
    // over the strip itself, so the runway — threshold bars, centreline,
    // PAPI — is in the frame, not a smudge 250 m out.
    f.pos.set(420, world.terrainHeight(420, -820) + 55, -820);
    f.heading = 270; f.pitch = -0.08; f.roll = 0; f.speed = 46; f.throttle = 36; f.onGround = false;
    for (let i = 0; i < Math.round(14 / STEP); i += 1) {
      stepWorld(world, landingInput(world), STEP, audio);
      if (world.screen !== SCREENS.PLAY) break;
    }
    world.message = '';
    world.submessage = '';
    return;
  }
  if (name === 'start') {
    // On the runway, throttle up, nose toward the valley and the first ring.
    world.screen = SCREENS.PLAY;
    for (let i = 0; i < Math.round(4 / STEP); i += 1) {
      stepWorld(world, { throttleUp: true, throttleDown: false, pitchUp: false, pitchDown: false, rollLeft: false, rollRight: false, yawLeft: false, yawRight: false, brake: false }, STEP, audio);
    }
    world.flight.throttle = 55;
    // No centre text on the cover shot: the HUD already says everything,
    // and the message would sit exactly where the plane is.
    world.message = '';
    world.submessage = '';
    return;
  }
  startSortie(world);
  const total = Math.round(seconds / STEP);
  for (let i = 0; i < total; i += 1) {
    stepWorld(world, shotInput(world), STEP, audio);
    if (world.screen !== SCREENS.PLAY) break;
  }
  if (world.screen === SCREENS.PLAY) {
    world.message = '';
    world.submessage = '';
  }
  void shotScreen;
}

function stateText() {
  const f = world.flight;
  return JSON.stringify({
    screen: world.screen, mission: world.mission.id, score: world.score,
    elapsed: Math.round(world.elapsed * 10) / 10,
    ringsFlown: world.nextRing, ringsTotal: world.rings.length,
    altitudeFt: Math.round(f.pos.y * 3.28084), speedKnots: Math.round(f.speed * 1.94384),
    heading: Math.round(f.heading), throttle: Math.round(f.throttle),
    fuel: Math.round(f.fuel), damage: Math.round(f.damage),
    stalled: f.stalled, crashed: f.crashed, landed: f.landed,
    position: { x: Math.round(f.pos.x), y: Math.round(f.pos.y), z: Math.round(f.pos.z) },
  });
}

// Deterministic stepping for scripted playtests (no rendering).
window.advanceTime = function advanceTime(ms) {
  const steps = Math.round(ms / 1000 / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.screen !== SCREENS.PLAY || paused) break;
    stepWorld(world, input, STEP, audio);
    time += STEP;
  }
  hud.update(world);
  renderFrame(renderer, scene, camera, world, objects, time);
  return stateText();
};
window.render_game_to_text = function renderGameToText() { return stateText(); };
window.__game = { world, input };

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - (frame.last || now)) / 1000 || STEP);
  frame.last = now;
  if (!frame.snapped) {
    frame.snapped = true;
    rig.snap(camMode, world.flight, world.flight.pos, objects.plane.group.quaternion);
  }
  if (world.screen === SCREENS.PLAY && !paused) {
    let acc = dt;
    let n = 0;
    while (acc >= STEP && n < 5) { stepWorld(world, input, STEP, audio); time += STEP; acc -= STEP; n += 1; }
    audio.update(world.flight);
  }
  if (world.screen === SCREENS.LANDED || world.screen === SCREENS.CRASHED) {
    const s = world.score;
    if (s > best) { best = s; window.localStorage.setItem(BEST_KEY, String(best)); world.best = best; }
  }
  rig.update(camMode, world.flight, world.flight.pos, objects.plane.group.quaternion, dt);
  hud.update(world);
  renderFrame(renderer, scene, camera, world, objects, time);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (shotName) {
  stageShot(shotName);
  rig.snap('chase', world.flight, world.flight.pos, objects.plane.group.quaternion);
  hud.update(world);
  renderFrame(renderer, scene, camera, world, objects, 0);
  window.__shotReady = true;
} else {
  hud.update(world);
  renderFrame(renderer, scene, camera, world, objects, 0);
  requestAnimationFrame(frame);
}
