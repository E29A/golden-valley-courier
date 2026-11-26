// Keyboard and mouse input. Arrows fly the plane, W/S work the throttle,
// A/D the rudder, Space the brake. Mouse drag orbits the chase camera a little.
// The same input object drives the live game and the screenshot autopilot.
export function createInput(onAction) {
  const keys = new Set();
  const input = {
    throttleUp: false, throttleDown: false,
    pitchUp: false, pitchDown: false,
    rollLeft: false, rollRight: false,
    yawLeft: false, yawRight: false,
    brake: false,
  };
  function sync() {
    input.throttleUp = keys.has('KeyW');
    input.throttleDown = keys.has('KeyS');
    input.pitchUp = keys.has('ArrowDown');
    input.pitchDown = keys.has('ArrowUp');
    input.rollLeft = keys.has('ArrowLeft');
    input.rollRight = keys.has('ArrowRight');
    input.yawLeft = keys.has('KeyA');
    input.yawRight = keys.has('KeyD');
    input.brake = keys.has('Space');
  }
  const down = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    sync();
    onAction(e.code);
  };
  const up = (e) => { keys.delete(e.code); sync(); };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => { keys.clear(); sync(); });
  let dragging = false; let lastX = 0; let lastY = 0;
  const canvas = document.getElementById('scene');
  canvas.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    onAction('orbit', e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
  });
  return input;
}
