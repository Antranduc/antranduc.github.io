import * as THREE from 'three';
import { buildVehicleScene } from './vehicle';
import { AnimationController } from './animation';
import type { RobotStyle, RobotSceneConfig, StyleColors } from './types';

/**
 * Read the current theme colors from CSS custom properties.
 */
function getThemeColors(): StyleColors {
  const style = getComputedStyle(document.documentElement);
  return {
    accent: new THREE.Color(style.getPropertyValue('--color-accent-primary').trim()),
    accentSecondary: new THREE.Color(style.getPropertyValue('--color-accent-secondary').trim()),
    background: new THREE.Color(style.getPropertyValue('--color-bg').trim()),
    muted: new THREE.Color(style.getPropertyValue('--color-text-muted').trim()),
  };
}

/**
 * Initialize and run the robot vehicle 3D scene.
 *
 * @returns A cleanup function to dispose all resources.
 */
export function initRobotScene(config: RobotSceneConfig): () => void {
  const { canvas, style } = config;

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0); // transparent background

  // --- Scene ---
  const scene = new THREE.Scene();

  // --- Camera (3/4 isometric view) ---
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(4, 3.5, 4);
  camera.lookAt(0, 0, 0);

  function updateCamera(aspect: number) {
    if (aspect < 1) {
      // Portrait: frontal view so the car loop runs left-right across the screen
      camera.position.set(0, 3.5, 6);
    } else {
      // Landscape: original 3/4 isometric view
      camera.position.set(4, 3.5, 4);
    }
    camera.lookAt(0, 0, 0);
  }

  // --- Build vehicle scene ---
  const refs = buildVehicleScene();
  scene.add(refs.vehicle);
  scene.add(refs.cube);

  // --- Create a root group so the style can traverse everything ---
  const sceneRoot = new THREE.Group();
  sceneRoot.name = 'scene-root';
  sceneRoot.add(refs.vehicle);
  sceneRoot.add(refs.cube);
  scene.add(sceneRoot);

  // --- Apply style ---
  let colors = getThemeColors();
  style.apply(sceneRoot, scene, colors);

  // --- Animation controller ---
  const animator = new AnimationController(refs);

  // --- Sizing ---
  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;

    const width = parent.clientWidth;
    const height = parent.clientHeight;
    const aspect = width / height;

    canvas.width = width;
    canvas.height = height;
    renderer.setSize(width, height, false);
    camera.aspect = aspect;
    updateCamera(aspect);
    camera.updateProjectionMatrix();
  }

  resize();
  window.addEventListener('resize', resize);

  // --- Theme change observer ---
  const themeObserver = new MutationObserver(() => {
    colors = getThemeColors();
    style.updateColors(colors);
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  // --- Animation loop ---
  const clock = new THREE.Clock();
  let animationId: number | null = null;

  // Respect prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = prefersReducedMotion.matches;
  const motionHandler = (e: MediaQueryListEvent) => { reducedMotion = e.matches; };
  prefersReducedMotion.addEventListener('change', motionHandler);

  function animate() {
    animationId = requestAnimationFrame(animate);

    const elapsed = clock.getElapsedTime();

    if (!reducedMotion) {
      animator.update(elapsed);
    }

    style.update?.(elapsed);
    renderer.render(scene, camera);
  }

  animate();

  // --- Cleanup ---
  return () => {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
    }
    window.removeEventListener('resize', resize);
    themeObserver.disconnect();
    prefersReducedMotion.removeEventListener('change', motionHandler);

    style.dispose();

    // Dispose all geometries and materials
    sceneRoot.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
    scene.clear();
    renderer.dispose();
  };
}
