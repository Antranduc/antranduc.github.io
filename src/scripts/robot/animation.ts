import * as THREE from 'three';
import type { VehicleRefs } from './vehicle';

// ─── Constants ───────────────────────────────────────────────────────────────

const CYCLE_DURATION = 4;

const PHASE = {
  DRIVE_TO:    0.30,
  BONK:        0.38,
  SWERVE:      0.65,
  DRIVE_HOME:  1.00,
} as const;

const CUBE_PATH_T = 0.4;
const STOP_T = CUBE_PATH_T - 0.08;
const REVERSE_DIST = 0.06;
const SWERVE_OFFSET = 1.8;
const REVERSE_FRAC = 0.20;

/** Number of sample points for the swerve detour spline. */
const ARC_SAMPLES = 64;

// ─── Main path (jelly-bean shape) ────────────────────────────────────────────

function createPath(): THREE.CatmullRomCurve3 {
  const points = [
    new THREE.Vector3(2.0,  0, 0),
    new THREE.Vector3(1.2,  0, -1.1),
    new THREE.Vector3(-0.3, 0, -1.3),
    new THREE.Vector3(-1.8, 0, -0.8),
    new THREE.Vector3(-2.0, 0, 0.3),
    new THREE.Vector3(-1.2, 0, 1.1),
    new THREE.Vector3(0.2,  0, 1.0),
    new THREE.Vector3(1.5,  0, 0.6),
  ];
  return new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
}

// ─── Easing utilities ────────────────────────────────────────────────────────

function springEase(t: number, freq = 4.5, damping = 4): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.exp(-damping * t) * Math.cos(freq * t * Math.PI);
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function phaseT(t: number, start: number, end: number): number {
  return clamp01((t - start) / (end - start));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function wrapT(t: number): number {
  return ((t % 1) + 1) % 1;
}

// ─── Animation controller ────────────────────────────────────────────────────

export class AnimationController {
  private mainPath: THREE.CatmullRomCurve3;
  private refs: VehicleRefs;

  private bonkWheelExtra = 0;

  private readonly driveStartT: number;
  private readonly approachLength: number;
  private readonly reversedT: number;

  /**
   * Pre-computed detour spline: goes from reversedT, arcs laterally
   * around the cube, then continues along the main path back to
   * driveStartT. Using getPointAt() on this gives constant-speed travel.
   */
  private readonly detourPath: THREE.CatmullRomCurve3;

  /** Previous frame's facing direction. */
  private prevTangent: THREE.Vector3 | null = null;

  constructor(refs: VehicleRefs) {
    this.refs = refs;
    this.mainPath = createPath();

    this.driveStartT = (CUBE_PATH_T + 0.5) % 1.0;
    this.approachLength = ((STOP_T - this.driveStartT) + 1) % 1;
    this.reversedT = STOP_T - REVERSE_DIST;

    // Compute swerve direction (lateral to the path at the cube)
    const cubeTangent = this.mainPath.getTangentAt(CUBE_PATH_T).normalize();
    const swerveDir = new THREE.Vector3()
      .crossVectors(cubeTangent, new THREE.Vector3(0, 1, 0))
      .normalize();

    // Place cube on the path
    const cubePos = this.mainPath.getPointAt(CUBE_PATH_T);
    refs.cube.position.copy(cubePos);
    refs.cube.position.y = 0.3;

    // ── Build the detour spline ──
    // Sample points from reversedT around the loop back to driveStartT,
    // with a lateral bulge near the cube.
    const forwardLength = ((this.driveStartT - this.reversedT) + 1) % 1;
    const lateralEndT = (CUBE_PATH_T + 0.14) % 1;
    const lateralDist = ((lateralEndT - this.reversedT) + 1) % 1;
    const arcFraction = lateralDist / forwardLength;

    const detourPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= ARC_SAMPLES; i++) {
      const progress = i / ARC_SAMPLES; // 0→1 over full forward journey
      const pathT = wrapT(this.reversedT + forwardLength * progress);
      const basePos = this.mainPath.getPointAt(pathT);

      // Apply lateral offset only in the arc zone
      let lateral = 0;
      if (progress < arcFraction) {
        const arcNorm = progress / arcFraction;
        lateral = Math.pow(Math.sin(arcNorm * Math.PI), 0.6) * SWERVE_OFFSET;
      }

      const point = basePos.clone().addScaledVector(swerveDir, lateral);
      detourPoints.push(point);
    }

    // Create a spline through these sampled points.
    // NOT closed — it's a one-way path from reversedT to driveStartT.
    this.detourPath = new THREE.CatmullRomCurve3(detourPoints, false, 'catmullrom', 0.5);
  }

  update(elapsed: number): void {
    const totalT = elapsed / CYCLE_DURATION;
    const t = totalT - Math.floor(totalT);

    let pos: THREE.Vector3;
    let tangent: THREE.Vector3;
    let driving = false;
    let wheelSpeed = 0;

    if (t < PHASE.DRIVE_TO) {
      // ── Phase 1: Drive toward cube (linear, constant speed) ──
      const pt = phaseT(t, 0, PHASE.DRIVE_TO);
      const pathT = wrapT(this.driveStartT + this.approachLength * pt);
      pos = this.mainPath.getPointAt(pathT);
      tangent = this.mainPath.getTangentAt(pathT).normalize();
      driving = true;
      wheelSpeed = 8;

    } else if (t < PHASE.BONK) {
      // ── Phase 2: Bonk + recoil ──
      const bt = phaseT(t, PHASE.DRIVE_TO, PHASE.BONK);
      const recoil = Math.exp(-bt * 6) * Math.sin(bt * Math.PI * 3) * 0.03;
      const pathT = wrapT(STOP_T - recoil);
      pos = this.mainPath.getPointAt(pathT);
      tangent = this.mainPath.getTangentAt(pathT).normalize();

      const squash = springEase(bt, 5, 5);
      this.refs.carBody.scale.set(
        lerp(1.12, 1.0, squash),
        lerp(0.82, 1.0, squash),
        1.0
      );
      if (bt < 0.15) this.bonkWheelExtra = 25;
      wheelSpeed = 3 * Math.exp(-bt * 8);

    } else if (t < PHASE.SWERVE) {
      // ── Phase 3: Reverse, then arc forward via detour spline ──
      const st = phaseT(t, PHASE.BONK, PHASE.SWERVE);
      this.refs.carBody.scale.set(1, 1, 1);

      if (st < REVERSE_FRAC) {
        // ── Reverse ──
        const rt = easeOut(st / REVERSE_FRAC);
        const pathT = wrapT(lerp(STOP_T, this.reversedT, rt));
        pos = this.mainPath.getPointAt(pathT);
        tangent = this.mainPath.getTangentAt(pathT).normalize();
        wheelSpeed = -5 * (1 - st / REVERSE_FRAC);

      } else {
        // ── Arc + drive forward via detour spline ──
        // Map the remaining swerve time + all of phase 4 time onto
        // detourPath [0,1] uniformly. getPointAt gives constant speed.
        const arcLocalT = (st - REVERSE_FRAC) / (1.0 - REVERSE_FRAC);

        // What fraction of the total forward time is the arc portion?
        const arcTimeBudget = (1.0 - REVERSE_FRAC) * (PHASE.SWERVE - PHASE.BONK);
        const driveTimeBudget = PHASE.DRIVE_HOME - PHASE.SWERVE;
        const totalTimeBudget = arcTimeBudget + driveTimeBudget;

        const detourT = (arcLocalT * arcTimeBudget) / totalTimeBudget;

        pos = this.detourPath.getPointAt(detourT);
        tangent = this.detourPath.getTangentAt(detourT).normalize();
        wheelSpeed = 6;
      }

      driving = true;

    } else {
      // ── Phase 4: Continue forward via detour spline ──
      this.refs.carBody.scale.set(1, 1, 1);

      const arcTimeBudget = (1.0 - REVERSE_FRAC) * (PHASE.SWERVE - PHASE.BONK);
      const driveTimeBudget = PHASE.DRIVE_HOME - PHASE.SWERVE;
      const totalTimeBudget = arcTimeBudget + driveTimeBudget;

      const dt = phaseT(t, PHASE.SWERVE, PHASE.DRIVE_HOME);
      const detourT = (arcTimeBudget + dt * driveTimeBudget) / totalTimeBudget;

      pos = this.detourPath.getPointAt(detourT);
      tangent = this.detourPath.getTangentAt(detourT).normalize();
      driving = true;
      wheelSpeed = 6;
    }

    // ── Smooth facing direction (clamped angular rate) ──
    // Limit rotation to MAX_TURN_RAD per frame so large direction changes
    // (like reverse → arc) produce a gradual steering motion.
    const MAX_TURN_RAD = 0.035; // ~2° per frame at 60fps → ~120°/sec max
    if (this.prevTangent) {
      const angle = this.prevTangent.angleTo(tangent);
      if (angle > MAX_TURN_RAD) {
        const fraction = MAX_TURN_RAD / angle;
        tangent = this.prevTangent.clone().lerp(tangent, fraction).normalize();
      }
    }
    this.prevTangent = tangent.clone();

    // ── Apply position + facing ──
    this.refs.vehicle.position.copy(pos);
    const lookTarget = pos.clone().add(tangent);
    lookTarget.y = pos.y;
    this.refs.vehicle.lookAt(lookTarget);

    // ── Driving bounce + wobble ──
    if (driving) {
      const dist = elapsed * 2.5;
      this.refs.vehicle.position.y += Math.abs(Math.sin(dist * 6)) * 0.015;
      this.refs.carBody.rotation.z = Math.sin(dist * 3) * 0.008;
    } else {
      this.refs.carBody.rotation.z = 0;
    }

    // ── Wheel spin ──
    const totalWheelSpeed = wheelSpeed + this.bonkWheelExtra;
    const wheelDelta = totalWheelSpeed * (1 / 60);
    for (const wheel of this.refs.wheels) {
      wheel.rotation.x += wheelDelta;
    }
    this.bonkWheelExtra *= 0.93;
  }

  getPath(): THREE.CatmullRomCurve3 {
    return this.mainPath;
  }
}
