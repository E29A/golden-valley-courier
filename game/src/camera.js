// The cameras: chase (default, the plane in frame with the valley ahead),
// cockpit (from the pilot's seat, nose and lit dash in view) and nose (a clean
// forward view for landing). The chase camera never fights the pilot: it follows
// smoothly behind the plane's heading and eases, it never snaps.
import * as THREE from 'three';

export const CAM_MODES = ['chase', 'cockpit', 'nose'];

export function createCameraRig(camera) {
  let orbitX = 0; let orbitY = 0;
  return {
    orbit(dx, dy) { orbitX += dx * 0.003; orbitY += dy * 0.002; orbitX = Math.max(-0.9, Math.min(0.9, orbitX)); orbitY = Math.max(-0.4, Math.min(0.5, orbitY)); },
    resetOrbit() { orbitX = 0; orbitY = 0; },
    // Put the camera exactly where update() would ease it to: screenshots
    // and the first live frame need the plane in frame now, not after the
    // lerp converges over half a second.
    snap(mode, flight, planePos, planeQuat) { this.update(mode, flight, planePos, planeQuat, 10); },
    update(mode, flight, planePos, planeQuat, dt) {
      const hdg = (flight.heading * Math.PI) / 180;
      if (mode === 'cockpit') {
        // High and forward, over the dash: the fat fuselage top is a long
        // cream "hood" from the pilot's seat, so a seat-level camera (0.75
        // or 0.9) puts it across the whole lower frame and hides the
        // runway. From 1.05 m up and 1.2 m ahead of the seat the nose is a
        // small triangle at the bottom edge and the runway stays in view.
        const eye = new THREE.Vector3(0, 1.05, -1.2).applyQuaternion(planeQuat).add(planePos);
        camera.position.lerp(eye, 1 - Math.pow(0.0001, dt));
        const look = new THREE.Vector3(0, 0.15, -30).applyQuaternion(planeQuat).add(planePos);
        camera.lookAt(look);
        camera.fov = 72;
      } else if (mode === 'nose') {
        const eye = new THREE.Vector3(0, 0.4, -3.4).applyQuaternion(planeQuat).add(planePos);
        camera.position.copy(eye);
        const look = new THREE.Vector3(0, 0, -60).applyQuaternion(planeQuat).add(planePos);
        camera.lookAt(look);
        camera.fov = 68;
      } else {
        // Chase: behind and above, offset by the mouse orbit, looking ahead.
        const back = new THREE.Vector3(Math.sin(hdg + orbitX), 0, -Math.cos(hdg + orbitX));
        const target = planePos.clone().addScaledVector(back, -13).add(new THREE.Vector3(0, 4.6 + orbitY * 8, 0));
        camera.position.lerp(target, 1 - Math.pow(0.001, dt));
        const look = planePos.clone().addScaledVector(new THREE.Vector3(Math.sin(hdg), 0, -Math.cos(hdg)), 26).add(new THREE.Vector3(0, 1.2, 0));
        camera.lookAt(look);
        camera.fov = 62;
      }
      camera.updateProjectionMatrix();
    },
  };
}
