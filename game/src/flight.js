// The arcade flight model: speed chases the throttle target, bank couples into
// yaw, pitch trades speed for altitude, and below stall speed the wing gives up
// and the nose drops. Fuel burns with throttle; damage comes only from hard
// contact with the ground. All angles in radians, all speeds in m/s.
import * as THREE from 'three';
import { PLANE, STEP } from './config.js';

export function createFlight(start) {
  return {
    pos: new THREE.Vector3(start.x, start.y, start.z),
    heading: start.heading, // degrees, 0 = north (-Z), 90 = east (+X)
    pitch: 0, roll: 0,
    speed: 0, throttle: 0,
    fuel: 100, damage: 0,
    verticalSpeed: 0, onGround: true,
    stalled: false, crashed: false, landed: false,
    wasAirborne: false, touchVs: 0,
  };
}

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

export function stepFlight(f, input, dt, terrainHeight) {
  if (f.crashed || f.landed) return f;
  // Throttle: W/S move the lever, 0–100%.
  f.throttle = clamp(f.throttle + (input.throttleUp ? 45 : 0) * dt + (input.throttleDown ? -45 : 0) * dt, 0, 100);
  const targetSpeed = (f.throttle / 100) * PLANE.maxSpeed;
  f.speed += clamp(targetSpeed - f.speed, -PLANE.accel * dt, PLANE.accel * dt);
  // Ground roll: the plane needs speed before it can lift.
  const groundH = terrainHeight(f.pos.x, f.pos.z);
  const agl = f.pos.y - groundH;
  // On the ground while low AND (slow, or not rotated): liftoff needs both
  // rotate speed and a pulled nose. Speed alone used to flip onGround false
  // mid-roll, and the ground-contact branch then damaged the plane every
  // step for rolling on its own runway. Tolerance 0.9 m, not 0.6: the spawn
  // height is ground + 0.6, and 3.6 - 3 in floating point is a hair above 0.6.
  f.onGround = agl <= 0.9 && (f.speed < 28 || f.pitch < 0.12);
  if (f.onGround && f.speed < 18) {
    f.pos.y = groundH + 0.6;
    f.pitch = 0; f.roll *= 0.9;
  }
  // Pitch and roll from the arrows, eased toward the commanded bank.
  // The autopilot may pass proportional floats instead of the booleans.
  const pitchCmd = input.pitchFloat !== undefined
    ? input.pitchFloat : (input.pitchUp ? 1 : 0) - (input.pitchDown ? 1 : 0);
  const rollCmd = input.rollFloat !== undefined
    ? input.rollFloat : (input.rollLeft ? 1 : 0) - (input.rollRight ? 1 : 0);
  f.pitch += clamp(pitchCmd * PLANE.pitchRate * dt - f.pitch * 0.4 * dt, -0.06, 0.06);
  f.pitch = clamp(f.pitch, -0.45, 0.5);
  const targetRoll = rollCmd * 0.85;
  f.roll += clamp(targetRoll - f.roll, -PLANE.rollRate * dt, PLANE.rollRate * dt);
  // Rudder yaws the nose directly; bank turns it too. Turn rate comes from
  // bank alone, so a slow plane turns tighter than a fast one.
  const yawCmd = (input.yawLeft ? 1 : 0) - (input.yawRight ? 1 : 0);
  f.heading -= (yawCmd * PLANE.yawRate + Math.sin(f.roll) * PLANE.bankTurn) * dt * (180 / Math.PI);
  f.heading = ((f.heading % 360) + 360) % 360;
  // Stall: below min speed the wing stops flying and the nose drops.
  f.stalled = !f.onGround && f.speed < PLANE.minSpeed;
  if (f.stalled) f.pitch = Math.max(f.pitch - 0.5 * dt, -0.5);
  // Velocity from heading, pitch and speed; climb trades speed for height.
  const hdg = (f.heading * Math.PI) / 180;
  const forward = new THREE.Vector3(Math.sin(hdg), 0, -Math.cos(hdg));
  const climb = Math.sin(f.pitch) * f.speed * PLANE.climbFactor;
  // Ground effect: a little extra lift cushion just above the ground.
  const ge = agl < 8 && !f.onGround ? PLANE.groundEffect : 1;
  const vs = f.onGround ? 0 : climb * ge - (f.stalled ? 6 : 0);
  f.verticalSpeed = vs;
  f.pos.addScaledVector(forward, f.speed * Math.cos(f.pitch) * dt);
  f.pos.y += vs * dt;
  if (f.onGround) f.pos.y = groundH + 0.6;
  // Fuel burns with throttle; empty tanks mean the engine quits.
  f.fuel = Math.max(0, f.fuel - (0.045 + (f.throttle / 100) * 0.11) * dt);
  if (f.fuel <= 0) f.throttle = 0;
  // Touchdown: a plane that was properly airborne and is now rolling on the
  // ground has landed. This is the normal landing path — a gentle descent
  // onto the runway — and without it a perfect landing just rolled forever.
  // wasAirborne is only set above 2 m, so the takeoff roll at spawn never
  // counts as a landing.
  if (!f.onGround && agl > 2) { f.wasAirborne = true; f.touchVs = vs; }
  if (f.onGround && f.wasAirborne && f.speed < 45) {
    const sink = -f.touchVs;
    if (sink < 3.5 && Math.abs(f.roll) < 0.35 && f.speed < 42) {
      f.landed = true; f.speed *= 0.4;
    } else if (sink < 8 && f.speed < 55) {
      f.damage = Math.min(100, f.damage + 30 + sink * 4);
      f.speed *= 0.35;
      if (f.damage >= 100) f.crashed = true;
    } else {
      f.crashed = true;
    }
    f.wasAirborne = false;
  }
  // Ground contact: a gentle touchdown lands, a hard one damages, a fast one crashes.
  // Only while actually sinking (vs < -0.5 m/s): the earlier guard used the
  // step-start altitude, which made gradual descents never touch down at
  // all — the plane surfed the runway at 1 m forever. A rolling plane is
  // safe because onGround is true for it; a lifting plane is safe because
  // it is climbing, not sinking.
  const newGround = terrainHeight(f.pos.x, f.pos.z);
  if (f.pos.y <= newGround + 0.6 && !f.onGround && vs < -0.5) {
    const sink = -vs;
    if (sink < 3.5 && Math.abs(f.roll) < 0.35 && f.speed < 42) {
      f.landed = true; f.speed *= 0.4;
    } else if (sink < 8 && f.speed < 55) {
      f.damage = Math.min(100, f.damage + 30 + sink * 4);
      f.speed *= 0.35; f.pos.y = newGround + 0.6; f.pitch = 0;
      if (f.damage >= 100) f.crashed = true;
    } else {
      f.crashed = true;
    }
  }
  if (f.pos.y < newGround + 0.6) f.pos.y = newGround + 0.6;
  // Keep the sortie inside the valley.
  const r = Math.hypot(f.pos.x, f.pos.z);
  if (r > 1180) {
    const k = 1180 / r; f.pos.x *= k; f.pos.z *= k;
    f.heading = (f.heading + 180) % 360;
  }
  return f;
}

// Where the plane sits and how it is oriented, for the renderer.
export function planeTransform(f) {
  const hdg = (f.heading * Math.PI) / 180;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(f.pitch, hdg, f.roll, 'YXZ'));
  return { position: f.pos.clone(), quaternion: q };
}

export function knots(ms) { return Math.round(ms * 1.94384); }
export function feet(m) { return Math.round(m * 3.28084); }
export { STEP };
