// The screenshot scenes behind ?shot=start|play|ring|landing. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (bank toward the next ring, pitch to hold its altitude, hold
// 70% throttle), so the frame is what a real sortie looks like and the same seed
// always gives the same frame.
import { STEP, PLANE } from './config.js';
import { startSortie, SCREENS } from './world.js';

function autopilotInput(world) {
  const f = world.flight;
  const ring = world.rings[world.nextRing];
  const input = {
    throttleUp: false, throttleDown: false, pitchUp: false, pitchDown: false,
    rollLeft: false, rollRight: false, yawLeft: false, yawRight: false, brake: false,
    pitchFloat: 0, rollFloat: 0,
  };
  if (!ring) return input;
  // Slow down for the ring: 55% inside 150 m tightens the turn and gives
  // the climb time to meet the ring's altitude; 70% on the straights.
  // If the ring ended up behind the plane, slow further to turn tighter.
  const dist = Math.hypot(ring.pos.x - f.pos.x, ring.pos.y - f.pos.y, ring.pos.z - f.pos.z);
  const dx0 = ring.pos.x - f.pos.x; const dz0 = ring.pos.z - f.pos.z;
  const want0 = ((Math.atan2(dx0, -dz0) * 180) / Math.PI + 360) % 360;
  const err0 = Math.abs(((want0 - f.heading + 540) % 360) - 180);
  const targetThrottle = err0 > 120 ? 45 : dist < 200 ? 50 : 70;
  if (f.throttle < targetThrottle - 2) input.throttleUp = true;
  if (f.throttle > targetThrottle + 2) input.throttleDown = true;
  // PD steering toward the ring: pick the turn rate that closes the heading
  // error with a ~2 s time constant, then the bank that gives that rate.
  // The old proportional bank (err / 45) wove across the ring plane and
  // missed by metres every pass; this one flies straight through it.
  const err = ((want0 - f.heading + 540) % 360) - 180;
  const errRad = (err * Math.PI) / 180;
  const wantTurn = Math.max(-0.75, Math.min(0.75, errRad * 1.2));
  const turnAuthority = PLANE.bankTurn;
  const rollTarget = Math.asin(Math.max(-0.99, Math.min(0.99, wantTurn / turnAuthority)));
  // rollFloat is in roll-left-positive units: turning right (err > 0) is
  // negative, matching the arrow-key convention in flight.js.
  input.rollFloat = Math.max(-1, Math.min(1, -rollTarget / 0.85));
  if (Math.abs(err) < 1) input.rollFloat = 0;
  // PD pitch: the climb rate that closes the altitude error in ~3 s.
  // Steady pitch is about 2.1x pitchFloat, so a small float is plenty.
  const altErr = ring.pos.y - f.pos.y;
  input.pitchFloat = Math.max(-1, Math.min(1, altErr * 0.006));
  return input;
}

// Staged by main.js (which owns stepWorld to avoid a circular import): this
// module only describes how long each scene flies and which screen it shows.
export const SHOT_PLAN = {
  start: { seconds: 4, screen: SCREENS.TITLE, autopilot: false },
  // 28 s: the straighter course (S-curve 55 m, not 90) flies faster, so at
  // 30 s the plane is 16 m from the next ring and the gold torus fills the
  // frame as a clipped arc; at 28 s it is ~100 m out and framed whole.
  play: { seconds: 28, screen: SCREENS.PLAY, autopilot: true },
  // 15 s: same drift — at 16 s the next ring is 59 m out and reads as a
  // giant arc; at 15 s it is ~100 m out and framed whole.
  ring: { seconds: 15, screen: SCREENS.PLAY, autopilot: true },
  landing: { seconds: 55, screen: SCREENS.PLAY, autopilot: true },
};

export function shotInput(world) { return autopilotInput(world); }
export function shotSeconds(name) { return (SHOT_PLAN[name] || SHOT_PLAN.start).seconds; }
export function shotScreen(name) { return (SHOT_PLAN[name] || SHOT_PLAN.start).screen; }
export { STEP, startSortie };
