import * as THREE from 'three';
import type { RobotStyle, StyleColors } from '../types';

/** Cube color that's visible in both light and dark mode. */
const CUBE_COLOR = new THREE.Color(0x7c3aed); // purple

/**
 * Wireframe rendering style — clean CAD/simulation look.
 *
 * Uses EdgesGeometry for sharp-edge-only wireframes (not triangle soup),
 * a grid floor, and subtle fog for depth.
 */
export class WireframeStyle implements RobotStyle {
  private edgeLines: THREE.LineSegments[] = [];
  private cubeEdgeLines: THREE.LineSegments[] = [];
  private grid: THREE.GridHelper | null = null;
  private scene: THREE.Scene | null = null;

  apply(sceneRoot: THREE.Group, scene: THREE.Scene, colors: StyleColors): void {
    this.scene = scene;

    // Traverse all meshes and create edge-based wireframes
    sceneRoot.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Hide the solid mesh
        child.material = new THREE.MeshBasicMaterial({ visible: false });

        // Determine if this is part of the obstacle cube
        const isCube = child.name === 'obstacle-cube';
        const lineColor = isCube ? CUBE_COLOR.clone() : colors.accent;
        const lineOpacity = isCube ? 0.85 : 0.7;

        // Create clean edge lines (only sharp edges, not every triangle)
        const edges = new THREE.EdgesGeometry(child.geometry, 15);
        const lineMaterial = new THREE.LineBasicMaterial({
          color: lineColor,
          transparent: true,
          opacity: lineOpacity,
        });
        const lineSegments = new THREE.LineSegments(edges, lineMaterial);
        lineSegments.name = `${child.name}-edges`;

        // Attach to the same parent so it inherits transforms
        child.add(lineSegments);

        if (isCube) {
          this.cubeEdgeLines.push(lineSegments);
        } else {
          this.edgeLines.push(lineSegments);
        }
      }
    });

    // Grid floor — larger to accommodate the driving path
    this.grid = new THREE.GridHelper(
      12,   // size
      24,   // divisions
      colors.accent.clone().multiplyScalar(0.4),  // center line
      colors.accent.clone().multiplyScalar(0.15)   // grid lines
    );
    this.grid.position.y = -0.02;

    // GridHelper creates an array of 2 materials
    const gridMats = Array.isArray(this.grid.material)
      ? this.grid.material
      : [this.grid.material];
    gridMats.forEach((mat) => {
      mat.transparent = true;
      mat.opacity = 0.35;
    });

    scene.add(this.grid);

    // Subtle exponential fog for depth falloff
    scene.fog = new THREE.FogExp2(colors.background.getHex(), 0.06);
  }

  updateColors(colors: StyleColors): void {
    // Update vehicle edge line colors
    for (const line of this.edgeLines) {
      const mat = line.material as THREE.LineBasicMaterial;
      mat.color.copy(colors.accent);
    }

    // Cube color stays fixed (purple) — visible in both themes

    // Update grid colors
    if (this.grid) {
      const materials = Array.isArray(this.grid.material)
        ? this.grid.material
        : [this.grid.material];

      materials.forEach((mat, i) => {
        if (mat instanceof THREE.LineBasicMaterial) {
          const scale = i === 0 ? 0.4 : 0.15;
          mat.color.copy(colors.accent).multiplyScalar(scale);
        }
      });
    }

    // Update fog color
    if (this.scene?.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(colors.background);
    }
  }

  dispose(): void {
    const allLines = [...this.edgeLines, ...this.cubeEdgeLines];
    for (const line of allLines) {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
      line.parent?.remove(line);
    }
    this.edgeLines = [];
    this.cubeEdgeLines = [];

    if (this.grid) {
      const materials = Array.isArray(this.grid.material)
        ? this.grid.material
        : [this.grid.material];
      materials.forEach((m) => m.dispose());
      this.grid.geometry.dispose();
      this.scene?.remove(this.grid);
      this.grid = null;
    }

    if (this.scene) {
      this.scene.fog = null;
      this.scene = null;
    }
  }
}
