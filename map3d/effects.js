// Renderer, lights, fog and the optional bloom pass.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LIGHT, MAP } from './config.js';

export function detectLowEnd() {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || Math.min(screen.width, screen.height) < 700;
  const cores = navigator.hardwareConcurrency || 4;
  return mobile || cores <= 2;
}

export function buildRenderer(container, { lowEnd }) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !lowEnd, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1) * (lowEnd ? 0.8 : 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !lowEnd; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;outline:none';
  container.appendChild(renderer.domElement);
  return renderer;
}

export function buildLights(scene, { lowEnd }) {
  scene.background = null;
  scene.fog = new THREE.FogExp2(LIGHT.fogColor, LIGHT.fogDensity);
  const hemi = new THREE.HemisphereLight(LIGHT.skyColor, LIGHT.groundColor, LIGHT.hemiIntensity);
  const sun = new THREE.DirectionalLight(LIGHT.sunColor, LIGHT.sunIntensity);
  sun.position.set(...LIGHT.sunFrom); sun.target.position.set(0, 0, 0);
  if (!lowEnd) {
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera; c.left = -MAP.width * 0.62; c.right = MAP.width * 0.62; c.top = MAP.depth * 0.75; c.bottom = -MAP.depth * 0.75; c.near = 1; c.far = 90;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  }
  const fill = new THREE.DirectionalLight(0x8fd8ff, 0.35); fill.position.set(18, 10, 14);
  scene.add(hemi, sun, sun.target, fill);
  return { sun, sunDir: new THREE.Vector3(...LIGHT.sunFrom).normalize() };
}

export function buildComposer(renderer, scene, camera, { lowEnd, w, h }) {
  if (lowEnd) return null;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.45, 0.5, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return composer;
}
