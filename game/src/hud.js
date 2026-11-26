// The HUD: heading tape, altitude, speed, artificial horizon, fuel and score —
// DOM panels over the 3D view, with the instruments lit amber on dark glass so
// they read at a glance in a screenshot.
import { knots, feet } from './flight.js';

const $ = (id) => document.getElementById(id);

function fmtTime(s) {
  const m = Math.floor(s / 60); const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function headingTicks(hdg) {
  const marks = [];
  for (let d = -30; d <= 30; d += 15) {
    const h = ((Math.round(hdg / 15) * 15 + d) % 360 + 360) % 360;
    marks.push(String(h).padStart(3, '0'));
  }
  return `— ${marks.join(' — ')} —`;
}

export function createHud() {
  const horizon = $('horizonCanvas');
  const ctx = horizon.getContext('2d');
  return {
    update(state) {
      const f = state.flight;
      $('hdgVal').textContent = `${String(Math.round(f.heading)).padStart(3, '0')}°`;
      $('tapeTicks').textContent = headingTicks(f.heading);
      $('altVal').textContent = feet(f.pos.y).toLocaleString('en-US');
      const agl = Math.max(0, f.pos.y - state.groundH);
      $('aglVal').textContent = `AGL ${feet(agl).toLocaleString('en-US')}`;
      const vsi = Math.round(f.verticalSpeed * 196.85);
      $('vsiVal').textContent = `VSI ${vsi >= 0 ? '+' : ''}${vsi.toLocaleString('en-US')} ft/min`;
      $('vsiVal').classList.toggle('warn', Math.abs(vsi) > 1800);
      $('spdVal').textContent = knots(f.speed);
      $('thrVal').textContent = `THR ${Math.round(f.throttle)}%`;
      $('thrBig').textContent = `${Math.round(f.throttle)}%`;
      $('flapVal').textContent = f.stalled ? 'STALL — NOSE DOWN' : f.onGround ? 'ON GROUND' : 'FLAPS UP';
      $('flapVal').classList.toggle('warn', f.stalled);
      $('scoreVal').textContent = state.score.toLocaleString('en-US');
      $('timeVal').textContent = fmtTime(state.elapsed);
      $('ringVal').textContent = `Ring ${state.nextRing} / ${state.rings.length}`;
      $('missionName').textContent = state.mission.name;
      $('missionGoal').textContent = state.mission.goal;
      const fuel = Math.round(f.fuel);
      $('fuelVal').textContent = `${fuel}%`;
      $('fuelFill').style.width = `${fuel}%`;
      $('fuelFill').style.background = fuel < 25 ? '#ff7a6b' : '#7dd87d';
      $('dmgVal').textContent = `AIRFRAME ${Math.round(100 - f.damage)}%`;
      $('dmgVal').classList.toggle('warn', f.damage > 50);
      $('msg').textContent = state.message || '';
      $('submsg').textContent = state.submessage || '';
      const next = state.rings[state.nextRing];
      $('ringmark').textContent = next
        ? `NEXT RING ${state.nextRing + 1} · ${Math.round(Math.hypot(next.pos.x - f.pos.x, next.pos.z - f.pos.z))} m`
        : state.rings.length ? 'ALL RINGS FLOWN — LAND ON RUNWAY 27' : '';
      drawHorizon(ctx, f);
      $('status').textContent = `Altitude ${feet(f.pos.y)} feet, speed ${knots(f.speed)} knots, heading ${Math.round(f.heading)} degrees. Score ${state.score}.`;
    },
    showTitle(show) { $('title').style.display = show ? 'flex' : 'none'; },
  };
}

function drawHorizon(ctx, f) {
  const W = 210; const H = 104;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-f.roll);
  const dy = f.pitch * 90;
  ctx.fillStyle = '#2f6fb2';
  ctx.fillRect(-W, -H + dy, W * 2, H);
  ctx.fillStyle = '#8a6a3b';
  ctx.fillRect(-W, dy, W * 2, H);
  ctx.fillStyle = '#f5f0dc';
  ctx.fillRect(-W, dy - 1, W * 2, 2);
  ctx.fillStyle = '#ffd75e';
  for (let k = -2; k <= 2; k += 1) {
    if (k === 0) continue;
    ctx.fillRect(-28, dy + k * 18 - 1, 56, 2);
  }
  ctx.restore();
  // Fixed wings and centre dot: the aircraft symbol never moves.
  ctx.fillStyle = '#ffd75e';
  ctx.fillRect(W / 2 - 34, H / 2 - 2, 22, 4);
  ctx.fillRect(W / 2 + 12, H / 2 - 2, 22, 4);
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(245,240,220,0.4)';
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
}
