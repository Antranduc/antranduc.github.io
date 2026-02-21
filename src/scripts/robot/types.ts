import * as THREE from 'three';

/**
 * Interface that every robot rendering style must implement.
 * Each style takes the raw arm geometry group and applies its own
 * materials, scene decorations (grid, fog, lights), and colors.
 */
export interface RobotStyle {
  /**
   * Apply materials and scene decorations for this style.
   * Called once during initialization.
   *
   * @param armGroup - The robot arm Object3D hierarchy (meshes have no material yet)
   * @param scene - The Three.js scene to add decorations to (grid, fog, lights, etc.)
   * @param colors - Theme-derived colors to use
   */
  apply(armGroup: THREE.Group, scene: THREE.Scene, colors: StyleColors): void;

  /**
   * Update colors when the theme changes (light/dark toggle).
   * Called whenever the data-theme attribute changes.
   */
  updateColors(colors: StyleColors): void;

  /**
   * Optional per-frame update (e.g. for animated shaders).
   * Called every frame in the animation loop.
   */
  update?(time: number): void;

  /**
   * Clean up any resources created by this style.
   */
  dispose(): void;
}

/**
 * Colors derived from the current CSS theme.
 */
export interface StyleColors {
  accent: THREE.Color;
  accentSecondary: THREE.Color;
  background: THREE.Color;
  muted: THREE.Color;
}

/**
 * Configuration passed to the scene initializer.
 */
export interface RobotSceneConfig {
  canvas: HTMLCanvasElement;
  style: RobotStyle;
}
