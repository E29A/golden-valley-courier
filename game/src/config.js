// Every tuning number and colour in one place. Distances are metres, speeds are
// knots in the HUD (converted from m/s), altitudes are feet. The world is one
// seeded island valley, about 2.4 km across, so every screenshot is reproducible.

export const STEP = 1 / 60;

export const WORLD = {
  size: 2400,
  segments: 128,
  seed: 1,
  waterLevel: 2.0,
  maxHeight: 150,
};

export const PLANE = {
  // Arcade flight model: speed chases the throttle target, bank couples into yaw,
  // below stall speed the nose drops and the wing warns.
  minSpeed: 24,      // m/s, below this the wing stalls
  cruiseSpeed: 55,   // m/s at 70% throttle
  maxSpeed: 88,      // m/s flat out
  accel: 14,         // m/s^2 toward throttle target
  pitchRate: 0.85,   // rad/s
  rollRate: 2.4,     // rad/s
  yawRate: 0.55,     // rad/s from rudder
  bankTurn: 1.0,     // rad/s at full bank: turn rate depends on bank, not
                     // speed, so slowing down tightens the turn — a slow
                     // plane threads a ring, a fast one sweeps wide
  climbFactor: 0.55, // pitch authority on vertical speed
  drag: 0.12,
  groundEffect: 1.25,
};

// Runway 09/27: a flattened strip at the valley's south end, heading 090/270.
export const RUNWAY = {
  x: 0, z: 780, heading: 90, length: 420, width: 26,
};

// Far runway for the Precision Landing leg, heading 270.
export const FAR_RUNWAY = { x: -120, z: -820, heading: 270, length: 380, width: 26 };

export const MISSIONS = {
  ringrun: {
    id: 'ringrun', name: 'RING RUN',
    goal: 'Fly all 12 rings, then land on Runway 27',
    rings: 12, fuel: 100, timePar: 240,
  },
  slalom: {
    id: 'slalom', name: 'CANYON SLALOM',
    goal: 'Thread 10 low rings through the canyon — low and fast pays double',
    rings: 10, fuel: 85, timePar: 180,
  },
  landing: {
    id: 'landing', name: 'PRECISION LANDING',
    goal: 'Fly the valley, then grease it onto Runway 27 — centreline and soft wins',
    rings: 6, fuel: 90, timePar: 200,
  },
};

export const SCORE = {
  ring: 100, ringCentreBonus: 50, ringLowBonus: 50,
  landingSoft: 400, landingCentre: 150, landingTime: 200,
};

export const PALETTE = {
  skyTop: '#2f5d8f', skyHorizon: '#f7b95c', sun: '#ffd75e',
  grass: '#5d9b4a', field: '#8fae4e', forest: '#2f6b33', sand: '#d9c27a',
  rock: '#8d8578', snow: '#f2f5f7', water: '#2f6fb2',
  planeAmber: '#f08c1e', planeCream: '#f5ead2', planeDark: '#2b2f36',
  ringNext: '#ffd75e', ringLater: '#37c8e8', ringDone: '#7dd87d',
  runway: '#3a3f46', marking: '#f5f0dc',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'golden-valley-courier.best';
