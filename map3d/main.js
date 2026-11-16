// SAQI 3D map entry point. Builds the diorama inside #holo and exposes
// window.SAQI3D = { focus, reset, refresh, zoom, back } to the page.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA, ALERT_COLORS } from './config.js';
import { detectLowEnd, buildRenderer, buildLights, buildComposer } from './effects.js';
import { buildTerrain } from './terrain.js';
import { buildSea } from './sea.js';
import { buildBeacons } from './beacons.js';
import { createWellHologram } from './wellHologram.js';

const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function start() {
  const app = window.SAQI_APP, container = document.getElementById('holo');
  if (!app || !container) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowEnd = detectLowEnd() || /[?&]low=1/.test(location.search);
  let w = container.clientWidth || 800, h = container.clientHeight || 600;

  const renderer = buildRenderer(container, { lowEnd });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, w / h, 0.1, 400);
  camera.position.set(...CAMERA.start);
  const { sunDir } = buildLights(scene, { lowEnd });
  const terrain = buildTerrain(scene, { lowEnd });
  const sea = buildSea(scene, terrain, sunDir);
  const layer = document.createElement('div'); layer.className = 'map3dLayer'; container.appendChild(layer);
  const beacons = buildBeacons(scene, terrain, app, layer);
  const composer = buildComposer(renderer, scene, camera, { lowEnd, w, h });

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = CAMERA.minDistance; controls.maxDistance = CAMERA.maxDistance; controls.maxPolarAngle = CAMERA.maxPolar;
  controls.autoRotate = false; controls.autoRotateSpeed = CAMERA.autoRotateSpeed; controls.target.set(0, 0, 1);
  controls.screenSpacePanning = false; controls.panSpeed = 0.6; controls.enableZoom = true; controls.zoomSpeed = 1.1; controls.zoomToCursor = true;
  const HOME = { pos: new THREE.Vector3(...CAMERA.start), target: new THREE.Vector3(0, 0, 1) };
  let idleT = 0;
  controls.addEventListener('start', () => { controls.autoRotate = false; idleT = 0; fly = null; });
  controls.addEventListener('end', () => { idleT = 0; });

  // ---- back button (hologram view)
  const backBtn = document.createElement('button'); backBtn.className = 'map3dBack'; backBtn.type = 'button'; backBtn.textContent = '← Back to map'; backBtn.hidden = true; layer.appendChild(backBtn);
  backBtn.addEventListener('click', () => app.onBack ? app.onBack() : api.reset());
  const tip = document.createElement('div'); tip.className = 'map3dTip'; layer.appendChild(tip);

  // ---- camera flights
  let fly = null;
  function flyTo(pos, target, dur = CAMERA.flyTime) {
    fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, k: 0, dur: reducedMotion ? 0.01 : dur };
    controls.autoRotate = false;
  }
  // ---- selection + hologram
  let current = null, holo = null, selected = null; const leaving = new Set();
  function openHolo(s) {
    const a = beacons.world(s); if (!a) return;
    const st = app.statusOf(s);
    const make = () => { holo = createWellHologram(scene, s, { status: st, colorHex: '#' + new THREE.Color(ALERT_COLORS[st]).getHexString(), anchor: a, hudLayer: layer, reducedMotion, daysLabel: app.daysLabel(s), issue: s.issue || '' }); current = s; };
    if (holo) { const old = holo; holo = null; leaving.add(old); old.exit(() => { leaving.delete(old); if (selected === s) make(); }); } else make();
  }
  const api = {
    focus(s) {
      selected = s; beacons.setSelected(s);
      const a = beacons.world(s); if (!a) return;
      const dir = camera.position.clone().sub(controls.target).setY(0); if (dir.lengthSq() < 1e-3) dir.set(0, 0, 1); dir.normalize();
      const target = new THREE.Vector3(a.x, a.y + 3.0, a.z);
      const pos = target.clone().add(dir.multiplyScalar(CAMERA.focusDistance * 0.82)).add(new THREE.Vector3(0, CAMERA.focusDistance * 0.55, 0));
      flyTo(pos, target);
      terrain.uniforms.uFocus.value.set(a.x, a.z);
      backBtn.hidden = false; openHolo(s);
    },
    reset() {
      selected = null; beacons.setSelected(null); backBtn.hidden = true;
      if (holo) { const old = holo; holo = null; leaving.add(old); old.exit(() => leaving.delete(old)); } current = null;
      flyTo(HOME.pos.clone(), HOME.target.clone(), 1.3); idleT = 0;
    },
    refresh() { beacons.refresh(); },
    zoom(f) { const off = camera.position.clone().sub(controls.target); const d = THREE.MathUtils.clamp(off.length() * f, CAMERA.minDistance, CAMERA.maxDistance); flyTo(controls.target.clone().add(off.setLength(d)), controls.target.clone(), 0.6); },
    get selected() { return selected; },
  };
  window.SAQI3D = api;

  // ---- picking
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let down = null, hoverS = null;
  function pick(e) { const r = renderer.domElement.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mouse, camera); const hit = ray.intersectObjects(beacons.hitMeshes, false)[0]; return hit ? hit.object.userData.site : null; }
  renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointermove', e => {
    const s = pick(e); if (s !== hoverS) { hoverS = s; beacons.setHover(s); renderer.domElement.style.cursor = s ? 'pointer' : 'grab'; }
    if (s) { const r = container.getBoundingClientRect(); tip.textContent = `${s.name} · ${app.daysLabel(s)} days`; tip.style.transform = `translate(${e.clientX - r.left + 14}px,${e.clientY - r.top + 12}px)`; tip.classList.add('on'); } else tip.classList.remove('on');
  });
  renderer.domElement.addEventListener('pointerleave', () => { hoverS = null; beacons.setHover(null); tip.classList.remove('on'); });
  renderer.domElement.addEventListener('pointerup', e => { if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; const s = pick(e); if (s) app.onPick(s); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && selected && document.getElementById('coach')?.hidden !== false) backBtn.click(); });

  // ---- resize
  // camera that fills the panel with the slab while keeping every well in view
  const wellPts = app.SITES.map(s => { const x = terrain.geo.toX(s.lon), z = terrain.geo.toZ(s.lat); return new THREE.Vector3(x, Math.max(terrain.heightAt(x, z), 0) + 4.5, z); })
    .concat(app.SITES.map(s => { const x = terrain.geo.toX(s.lon), z = terrain.geo.toZ(s.lat); return new THREE.Vector3(x, 0, z); }));
  function fitHome() {
    const c = new THREE.PerspectiveCamera(CAMERA.fov, camera.aspect, 0.1, 400), hw = 20, hd = 13;
    const cx = wellPts.reduce((a, v) => a + v.x, 0) / wellPts.length;
    const place = (el, d, tz) => { c.position.set(cx * 0.6, Math.sin(el) * d, Math.cos(el) * d + tz); c.lookAt(cx * 0.6, 0, tz); c.updateMatrixWorld(); c.updateProjectionMatrix(); };
    const wellsFit = () => wellPts.every(v => { const q = v.clone().project(c); return Math.abs(q.x) <= 0.9 && q.y <= 0.78 && q.y >= (v.y < 0.5 ? -0.97 : -0.88) && q.z < 1; });
    const coversV = () => new THREE.Vector3(0, 0, -hd).project(c).y >= 0.97 && new THREE.Vector3(0, -1.6, hd).project(c).y <= -0.97;
    let best = null;
    for (let deg = 46; deg <= 62; deg += 4) {
      const el = THREE.MathUtils.degToRad(deg);
      for (let tz = 6; tz >= -6; tz -= 0.5) {
        let lo = 5, hi = 160; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; place(el, m, tz); wellsFit() ? hi = m : lo = m; }
        place(el, hi, tz);
        const nearY = new THREE.Vector3(0, -1.6, hd).project(c).y, nearX = new THREE.Vector3(-hw, -1.6, hd).project(c).x;
        if (nearY > -0.92) continue;            // front edge must fill the bottom of the panel
        const score = hi - deg * 0.05;                         // closest framing wins, slight bias to steeper
        if (!best || score < best.score) best = { el, d: hi, tz, score };
      }
    }
    if (!best) best = { el: THREE.MathUtils.degToRad(52), d: 46, tz: 1, fb: 1 };
    HOME.target.set(cx * 0.6, 0, best.tz);
    HOME.pos.set(cx * 0.6, Math.sin(best.el) * best.d, Math.cos(best.el) * best.d + best.tz);
    controls.maxDistance = Math.max(CAMERA.maxDistance, best.d * 1.6);
  }
  let first = true;
  function resize() { w = container.clientWidth || w; h = container.clientHeight || h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); composer && composer.setSize(w, h); fitHome(); if (first || (!selected && !fly && controls.autoRotate)) { camera.position.copy(HOME.pos); controls.target.copy(HOME.target); first = false; } }
  new ResizeObserver(resize).observe(container); resize();

  // ---- loop (30fps cap on low-end)
  const clock = new THREE.Clock(); let acc = 0, raf = 0, alive = true;
  function loop() {
    if (!alive) return; raf = requestAnimationFrame(loop);
    const dt0 = Math.min(0.1, clock.getDelta()); acc += dt0; if (lowEnd && acc < 1 / 30) return; const dt = acc; acc = 0;
    const t = clock.elapsedTime;
    if (fly) { fly.k = Math.min(1, fly.k + dt / fly.dur); const k = ease(fly.k); camera.position.lerpVectors(fly.p0, fly.p1, k); controls.target.lerpVectors(fly.t0, fly.t1, k); if (fly.k >= 1) fly = null; }
    if (!selected && !fly && !reducedMotion) { idleT += dt; if (idleT > 6) { const a = Math.sin((idleT - 6) * 0.15) * 0.0018; camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), a).add(controls.target); } }
    controls.update(dt);
    const dimT = selected ? 1 : 0; terrain.uniforms.uDim.value += (dimT - terrain.uniforms.uDim.value) * Math.min(1, dt * 3);
    sea.uniforms.uTime.value = t; terrain.uniforms.uTime.value = t;
    beacons.update(t, camera, w, h);
    if (holo) holo.update(t, dt, camera, w, h);
    leaving.forEach(o => o.update(t, dt, camera, w, h));
    composer ? composer.render(dt) : renderer.render(scene, camera);
  }
  loop();
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); } else { clock.getDelta(); loop(); } });
  addEventListener('pagehide', () => { alive = false; cancelAnimationFrame(raf); controls.dispose(); beacons.dispose(); sea.dispose(); terrain.dispose(); composer && composer.dispose && composer.dispose(); renderer.dispose(); });

  // replay calls the page made before the module loaded
  (window.SAQI3D_Q || []).forEach(([m, a]) => api[m] && api[m](...a)); window.SAQI3D_Q = [];
  container.classList.add('ready3d');
}
if (window.SAQI_APP) start(); else addEventListener('saqi-app-ready', start, { once: true });
