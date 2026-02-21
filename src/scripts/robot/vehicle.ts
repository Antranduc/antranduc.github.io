import * as THREE from 'three';

// ─── Exported references for animation ───────────────────────────────────────

export interface VehicleRefs {
  /** Root group that moves along the path. Scale/rotate this for squash-stretch and wobble. */
  vehicle: THREE.Group;
  /** The car body group (body + cabin). Useful for squash-stretch scaling. */
  carBody: THREE.Group;
  /** All four wheel meshes — rotate on local X for rolling. */
  wheels: THREE.Mesh[];
  /** The obstacle cube. */
  cube: THREE.Mesh;
}

// ─── Build everything ────────────────────────────────────────────────────────

/**
 * Build the full scene geometry: car + obstacle cube.
 * All meshes use invisible placeholder materials — styles apply real materials.
 *
 * Car orientation: long axis along Z (forward = +Z), width along X, height along Y.
 * This matches Three.js lookAt() which orients +Z toward the target.
 */
export function buildVehicleScene(): VehicleRefs {
  // ── Vehicle root ──
  const vehicle = new THREE.Group();
  vehicle.name = 'vehicle';

  // ── Car body group (for squash-stretch) ──
  const carBody = new THREE.Group();
  carBody.name = 'car-body-group';
  vehicle.add(carBody);

  // Main body — long axis along Z (length=1.0), width along X (0.55), height Y (0.35)
  const body = makeMesh(
    new THREE.BoxGeometry(0.55, 0.35, 1.0),
    'car-body'
  );
  body.position.y = 0.25;
  carBody.add(body);

  // Cabin — trapezoid cross-section (in XY plane) extruded along Z (car length)
  const cabinGeom = createTrapezoidGeometry(
    0.55,  // bottom width (matches car body X width)
    0.35,  // top width (narrower)
    0.22,  // height
    0.55   // depth along Z (shorter than full body — sits in the middle)
  );
  const cabin = makeMesh(cabinGeom, 'car-cabin');
  // Place cabin bottom at top of body: body center Y=0.25, half height=0.175, so top=0.425
  cabin.position.set(0, 0.425, -0.05);
  carBody.add(cabin);

  // ── Wheels ──
  // Cylinder axis along X (axle spans car width). Rolling forward along Z = rotation around X.
  const wheelGeom = new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12);
  wheelGeom.rotateZ(Math.PI / 2); // orient cylinder axis along X

  // Front-right
  const wheelFR = makeMesh(wheelGeom.clone(), 'wheel-fr');
  wheelFR.position.set(0.3, 0.14, 0.35);
  vehicle.add(wheelFR);

  // Front-left
  const wheelFL = makeMesh(wheelGeom.clone(), 'wheel-fl');
  wheelFL.position.set(-0.3, 0.14, 0.35);
  vehicle.add(wheelFL);

  // Rear-right
  const wheelRR = makeMesh(wheelGeom.clone(), 'wheel-rr');
  wheelRR.position.set(0.3, 0.14, -0.35);
  vehicle.add(wheelRR);

  // Rear-left
  const wheelRL = makeMesh(wheelGeom.clone(), 'wheel-rl');
  wheelRL.position.set(-0.3, 0.14, -0.35);
  vehicle.add(wheelRL);

  const wheels = [wheelFR, wheelFL, wheelRR, wheelRL];

  // ── Obstacle cube ──
  const cube = makeMesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    'obstacle-cube'
  );
  cube.position.y = 0.3;

  return {
    vehicle,
    carBody,
    wheels,
    cube,
  };
}

// ─── Trapezoid geometry (extruded 2D shape) ──────────────────────────────────

/**
 * Creates a trapezoid (car cabin) by extruding a 2D trapezoidal cross-section.
 * The cross-section is in the XY plane, extruded along Z.
 * Result is centered on X and Z, with bottom at Y=0.
 */
function createTrapezoidGeometry(
  bottomWidth: number,
  topWidth: number,
  height: number,
  depth: number
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const bw = bottomWidth / 2;
  const tw = topWidth / 2;
  const h = height;

  shape.moveTo(-bw, 0);
  shape.lineTo(bw, 0);
  shape.lineTo(tw, h);
  shape.lineTo(-tw, h);
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });

  // Center the extrusion on Z
  geom.translate(0, 0, -depth / 2);

  return geom;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMesh(geometry: THREE.BufferGeometry, name: string): THREE.Mesh {
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ visible: false })
  );
  mesh.name = name;
  return mesh;
}
