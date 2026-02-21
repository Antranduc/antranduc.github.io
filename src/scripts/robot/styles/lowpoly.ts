import * as THREE from 'three';
import type { RobotStyle, StyleColors } from '../types';

/**
 * Low-poly flat-shaded rendering style.
 *
 * Uses MeshPhongMaterial with flatShading for a faceted look,
 * directional + ambient lights, a ground plane, and subtle fog.
 * The cube gets a distinct accent-secondary color.
 */
export class LowPolyStyle implements RobotStyle {
  private vehicleMaterials: THREE.MeshPhongMaterial[] = [];
  private cubeMaterial: THREE.MeshPhongMaterial | null = null;
  private groundMaterial: THREE.MeshPhongMaterial | null = null;
  private ground: THREE.Mesh | null = null;
  private ambientLight: THREE.AmbientLight | null = null;
  private dirLight: THREE.DirectionalLight | null = null;
  private fillLight: THREE.DirectionalLight | null = null;
  private scene: THREE.Scene | null = null;

  apply(sceneRoot: THREE.Group, scene: THREE.Scene, colors: StyleColors): void {
    this.scene = scene;

    // ── Lighting ──
    // Ambient: soft fill based on the accent color
    this.ambientLight = new THREE.AmbientLight(
      colors.accent.clone().lerp(new THREE.Color(0xffffff), 0.6),
      0.5
    );
    scene.add(this.ambientLight);

    // Key light: warm directional from upper-right-front
    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    this.dirLight.position.set(4, 6, 3);
    scene.add(this.dirLight);

    // Fill light: cooler, dimmer, from the opposite side
    this.fillLight = new THREE.DirectionalLight(
      colors.accentSecondary.clone().lerp(new THREE.Color(0xffffff), 0.5),
      0.3
    );
    this.fillLight.position.set(-3, 2, -2);
    scene.add(this.fillLight);

    // ── Apply materials to meshes ──
    sceneRoot.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const isCube = child.name === 'obstacle-cube';
        const isWheel = child.name.startsWith('wheel-');

        if (isCube) {
          this.cubeMaterial = new THREE.MeshPhongMaterial({
            color: colors.accentSecondary,
            flatShading: true,
            transparent: true,
            opacity: 0.85,
            shininess: 30,
          });
          child.material = this.cubeMaterial;
        } else {
          // Vary the vehicle color slightly per part for visual interest
          const baseColor = colors.accent.clone();
          if (isWheel) {
            baseColor.lerp(new THREE.Color(0x333333), 0.5);
          } else if (child.name === 'car-cabin') {
            baseColor.lerp(new THREE.Color(0xffffff), 0.15);
          }

          const mat = new THREE.MeshPhongMaterial({
            color: baseColor,
            flatShading: true,
            transparent: true,
            opacity: 0.8,
            shininess: 20,
          });
          child.material = mat;
          this.vehicleMaterials.push(mat);
        }
      }
    });

    // ── Ground plane ──
    const groundGeom = new THREE.PlaneGeometry(14, 14);
    this.groundMaterial = new THREE.MeshPhongMaterial({
      color: colors.accent.clone().multiplyScalar(0.15),
      flatShading: true,
      transparent: true,
      opacity: 0.3,
      shininess: 5,
    });
    this.ground = new THREE.Mesh(groundGeom, this.groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.02;
    scene.add(this.ground);

    // ── Fog ──
    scene.fog = new THREE.FogExp2(colors.background.getHex(), 0.06);
  }

  updateColors(colors: StyleColors): void {
    // Vehicle materials
    for (const mat of this.vehicleMaterials) {
      mat.color.copy(colors.accent);
    }

    // Cube
    if (this.cubeMaterial) {
      this.cubeMaterial.color.copy(colors.accentSecondary);
    }

    // Ground
    if (this.groundMaterial) {
      this.groundMaterial.color.copy(colors.accent).multiplyScalar(0.15);
    }

    // Ambient light
    if (this.ambientLight) {
      this.ambientLight.color.copy(colors.accent).lerp(new THREE.Color(0xffffff), 0.6);
    }

    // Fill light
    if (this.fillLight) {
      this.fillLight.color.copy(colors.accentSecondary).lerp(new THREE.Color(0xffffff), 0.5);
    }

    // Fog
    if (this.scene?.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(colors.background);
    }
  }

  dispose(): void {
    for (const mat of this.vehicleMaterials) {
      mat.dispose();
    }
    this.vehicleMaterials = [];

    this.cubeMaterial?.dispose();
    this.cubeMaterial = null;

    if (this.ground) {
      this.ground.geometry.dispose();
      this.groundMaterial?.dispose();
      this.scene?.remove(this.ground);
      this.ground = null;
      this.groundMaterial = null;
    }

    if (this.ambientLight) {
      this.scene?.remove(this.ambientLight);
      this.ambientLight = null;
    }
    if (this.dirLight) {
      this.scene?.remove(this.dirLight);
      this.dirLight = null;
    }
    if (this.fillLight) {
      this.scene?.remove(this.fillLight);
      this.fillLight = null;
    }

    if (this.scene) {
      this.scene.fog = null;
      this.scene = null;
    }
  }
}
