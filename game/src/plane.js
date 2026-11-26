// The aircraft: a low-poly courier plane built from primitives, amber and cream
// with a spinning prop, nav lights and fixed gear — it has to look built, not
// drawn, from the chase view and from the cockpit.
import * as THREE from 'three';
import { PALETTE } from './config.js';

export function buildPlane() {
  const group = new THREE.Group();
  const amber = new THREE.MeshLambertMaterial({ color: PALETTE.planeAmber });
  const cream = new THREE.MeshLambertMaterial({ color: PALETTE.planeCream });
  const dark = new THREE.MeshLambertMaterial({ color: PALETTE.planeDark });
  const glass = new THREE.MeshLambertMaterial({ color: '#9fd8ef' });

  // Fuselage: a tapered cylinder pointing forward (-Z is forward here).
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 5.4, 10), amber);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.4;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.4, 10), cream);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.0;
  group.add(nose);
  // Canopy.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8), glass);
  canopy.scale.set(0.85, 0.6, 1.5);
  canopy.position.set(0, 0.55, -0.9);
  group.add(canopy);
  // Main wing, low and straight, with cream tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.18, 1.7), amber);
  wing.position.set(0, -0.1, -0.2);
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 1.7), cream);
    tip.position.set(side * 4.5, -0.1, -0.2);
    group.add(tip);
    // Tailplane.
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.14, 1.0), amber);
    tail.position.set(0, 0.25, 2.9);
    group.add(tail);
    // Fin.
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 1.4), cream);
    fin.position.set(0, 0.9, 2.9);
    group.add(fin);
  }
  // Propeller: hub + two blades, spun by the flight model.
  const prop = new THREE.Group();
  prop.position.set(0, 0, -3.75);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 8), dark);
  hub.rotation.x = Math.PI / 2;
  prop.add(hub);
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.6, 0.08), dark);
    blade.rotation.z = a;
    prop.add(blade);
  }
  group.add(prop);
  // Fixed gear: two wheels and a tail wheel.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 6), dark);
    leg.position.set(side * 0.9, -0.9, -0.6);
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.9, -1.35, -0.6);
    group.add(wheel);
  }
  // Nav lights: red left, green right, white tail — emissive so they read as lit.
  const lightGeo = new THREE.SphereGeometry(0.12, 8, 6);
  const red = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: '#ff2e2e' }));
  red.position.set(-4.7, -0.1, -0.2); group.add(red);
  const green = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: '#2eff5e' }));
  green.position.set(4.7, -0.1, -0.2); group.add(green);
  const white = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  white.position.set(0, 0.25, 3.6); group.add(white);
  // Dashboard panel for the cockpit view: dark panel, six lit gauge faces.
  const dash = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.1), dark);
  dash.add(panel);
  const gaugeCols = ['#ffd75e', '#7dd87d', '#37c8e8', '#ff9a3c', '#f5f0dc', '#ff7a6b'];
  gaugeCols.forEach((col, i) => {
    const g = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), new THREE.MeshBasicMaterial({ color: col }));
    g.position.set(-0.62 + (i % 3) * 0.62, i < 3 ? 0.12 : -0.14, 0.06);
    dash.add(g);
  });
  dash.position.set(0, -0.05, -1.95);
  group.add(dash);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group, prop, dash };
}
