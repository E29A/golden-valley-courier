// The game state machine: title, flying, paused, landed, crashed. One sortie
// per mission: fly the rings in order, then land on the home runway. Score pays
// for rings (centre bonus, low bonus in Slalom), for a soft centred landing and
// for beating the par time. A crash respawns at the next ring with a penalty;
// fuel empty means gliding home on whatever speed is left.
import * as THREE from 'three';
import { MISSIONS, RUNWAY, SCORE } from './config.js';
import { createFlight, stepFlight } from './flight.js';
import { makeRingCourse, checkRings } from './rings.js';

export const SCREENS = { TITLE: 'title', PLAY: 'play', PAUSED: 'paused', LANDED: 'landed', CRASHED: 'crashed' };

export function createWorld(missionId, terrainHeight, seed) {
  const mission = MISSIONS[missionId] || MISSIONS.ringrun;
  const rings = makeRingCourse(mission, terrainHeight, seed);
  const flight = createFlight({
    x: RUNWAY.x - RUNWAY.length / 2 + 30, y: terrainHeight(RUNWAY.x, RUNWAY.z) + 0.6, z: RUNWAY.z,
    heading: RUNWAY.heading,
  });
  flight.fuel = mission.fuel;
  return {
    mission, rings, flight, terrainHeight,
    screen: SCREENS.TITLE,
    score: 0, elapsed: 0, nextRing: 0,
    message: '', submessage: '', messageUntil: 0,
    best: 0,
    groundH: terrainHeight(RUNWAY.x, RUNWAY.z),
  };
}

export function startSortie(world) {
  world.screen = SCREENS.PLAY;
  world.message = ''; world.submessage = '';
  world.elapsed = 0;
}

export function restartWorld(world, missionId) {
  const fresh = createWorld(missionId, world.terrainHeight, 1);
  Object.keys(fresh).forEach((k) => { world[k] = fresh[k]; });
  world.best = fresh.best;
}

export function stepWorld(world, input, dt, audio) {
  if (world.screen !== SCREENS.PLAY) return;
  world.elapsed += dt;
  const f = world.flight;
  const prev = f.pos.clone();
  const wasStalled = f.stalled;
  stepFlight(f, input, dt, world.terrainHeight);
  world.groundH = world.terrainHeight(f.pos.x, f.pos.z);
  if (f.stalled && !wasStalled) audio.stall();
  // Rings, in order.
  const res = checkRings(world.rings, world.nextRing, prev, f.pos);
  if (res.points > 0) {
    world.score += res.points;
    world.nextRing = res.next;
    audio.ring(res.centre);
    world.message = res.centre ? 'RING — DEAD CENTRE! +150' : res.graze ? 'RING GRAZE +50' : 'RING +100';
    world.submessage = world.nextRing >= world.rings.length ? 'All rings flown — land on Runway 27' : `Next ring ${world.nextRing + 1} of ${world.rings.length}`;
    world.messageUntil = world.elapsed + 2.2;
  } else if (res.missed) {
    world.message = 'RING MISSED — fly through the gold ring';
    world.submessage = '';
    world.messageUntil = world.elapsed + 1.6;
  }
  if (world.elapsed > world.messageUntil) { world.message = ''; world.submessage = ''; }
  // Landing: only counts once all rings are flown and the plane is on a runway.
  if (f.landed) {
    const nearHome = Math.abs(f.pos.z - RUNWAY.z) < RUNWAY.width && Math.abs(f.pos.x - RUNWAY.x) < RUNWAY.length / 2;
    const soft = Math.abs(f.verticalSpeed) < 3.5;
    if (world.nextRing >= world.rings.length && nearHome) {
      const centreBonus = Math.abs(f.pos.z - RUNWAY.z) < 5 ? SCORE.landingCentre : 0;
      const timeBonus = Math.max(0, Math.round((world.mission.timePar - world.elapsed) * 0.8));
      world.score += SCORE.landingSoft + centreBonus + Math.min(SCORE.landingTime, timeBonus);
      world.screen = SCREENS.LANDED;
      world.message = 'TOUCHDOWN — WELCOME HOME';
      world.submessage = `Landing +${SCORE.landingSoft}${centreBonus ? `, centreline +${centreBonus}` : ''}${timeBonus ? `, time +${Math.min(SCORE.landingTime, timeBonus)}` : ''} · Score ${world.score}`;
      audio.touchdown(true);
    } else if (nearHome) {
      // Landed early on the runway: back in the air is not an option, sortie over.
      world.screen = SCREENS.LANDED;
      world.message = 'LANDED EARLY';
      world.submessage = `Rings left: ${world.rings.length - world.nextRing} · Score ${world.score}`;
      audio.touchdown(true);
    } else {
      // Landed off-runway in the fields: a rough field landing, sortie over.
      world.screen = SCREENS.LANDED;
      world.message = 'FIELD LANDING';
      world.submessage = `Not a runway — the mail still gets through · Score ${world.score}`;
      audio.touchdown(false);
    }
  }
  if (f.crashed) {
    world.screen = SCREENS.CRASHED;
    world.message = 'CRASHED';
    world.submessage = 'Press R to fly again — the valley forgives, once';
    audio.crash();
  }
  // Fuel empty and slow on the ground far from a runway: the sortie ends.
  if (f.fuel <= 0 && f.speed < 3 && f.onGround && world.screen === SCREENS.PLAY) {
    world.screen = SCREENS.LANDED;
    world.message = 'OUT OF FUEL';
    world.submessage = `Score ${world.score} — throttle discipline pays next time`;
  }
}

// Respawn after a crash: back in the air at the next ring, minus 150 points.
export function respawn(world) {
  const f = world.flight;
  const ring = world.rings[Math.min(world.nextRing, world.rings.length - 1)];
  const spot = ring ? ring.pos : new THREE.Vector3(RUNWAY.x, 60, RUNWAY.z);
  f.pos.set(spot.x, spot.y + 25, spot.z + 120);
  f.heading = 0; f.pitch = 0; f.roll = 0;
  f.speed = 45; f.throttle = 60; f.damage = Math.max(0, f.damage - 40);
  f.crashed = false; f.landed = false; f.onGround = false;
  world.score = Math.max(0, world.score - 150);
  world.screen = SCREENS.PLAY;
  world.message = 'BACK IN THE AIR';
  world.submessage = '−150 points — fly the next ring';
  world.messageUntil = world.elapsed + 2;
}
