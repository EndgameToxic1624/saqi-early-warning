// Floating holographic well that materialises above a selected beacon.
// Procedural geometry only: ground cut-away with strata, shaft + pump head,
// animated water table, floating particles, an HTML HUD, and a per-well
// "problem" animation (dropping water, crowding herds, salt, dead sensor,
// spare capacity, recharging rain).
import * as THREE from 'three';
import { ALERT_COLORS } from './config.js';

const CYAN = 0x5ff3ff, BLUE = 0x3aa0ff, LIFT = 3.6, R = 1.5, DEPTH = 3.0;

function holoUniforms() { return { uTime: { value: 0 }, uReveal: { value: 0 }, uGlitch: { value: 0 }, uBase: { value: 0 }, uHeight: { value: 7 }, uPulse: { value: 1 } }; }
function holoMat(U, color, opacity = 0.35, { stripes = 0, solid = false } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: solid ? THREE.NormalBlending : THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { ...U, uCol: { value: new THREE.Color(color) }, uOp: { value: opacity }, uStripes: { value: stripes } },
    vertexShader: 'varying vec3 vW;varying vec3 vN;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform float uTime,uReveal,uGlitch,uBase,uHeight,uPulse,uOp,uStripes;uniform vec3 uCol;varying vec3 vW;varying vec3 vN;
void main(){float k=(vW.y-uBase)/uHeight; if(k>uReveal)discard;
 vec3 v=normalize(cameraPosition-vW); float fr=pow(1.0-abs(dot(normalize(vN),v)),2.0);
 float scan=0.78+0.22*sin(vW.y*38.0-uTime*5.0);
 float strata=uStripes>0.5?(0.65+0.35*step(0.5,fract(vW.y*2.6))):1.0;
 float edge=smoothstep(0.06,0.0,uReveal-k)*2.5;
 float gl=1.0-uGlitch*step(0.55,fract(vW.y*11.0+uTime*37.0));
 float a=uOp*(0.3+0.9*fr)*scan*strata*gl*uPulse;
 ${solid ? 'gl_FragColor=vec4(uCol*(0.85+0.6*fr)*scan*strata*gl+edge*0.6, clamp(uOp*(0.55+0.6*fr)*gl*uPulse+edge,0.0,0.92));' : 'gl_FragColor=vec4(uCol*(a+edge*0.8),1.0);'}}`,
  });
}
function lineMat(U, color, opacity = 0.9) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...U, uCol: { value: new THREE.Color(color) }, uOp: { value: opacity } },
    vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform float uTime,uReveal,uGlitch,uBase,uHeight,uPulse,uOp;uniform vec3 uCol;varying vec3 vW;
void main(){float k=(vW.y-uBase)/uHeight; if(k>uReveal)discard; float gl=1.0-uGlitch*step(0.5,fract(vW.y*9.0+uTime*41.0));
 gl_FragColor=vec4(uCol*uOp*1.6*gl*uPulse,1.0);}`,
  });
}
const edges = (geo, mat) => new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), mat);
function arrowMesh(U, color, dir = -1) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), holoMat(U, color, 0.9));
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 12), holoMat(U, color, 1.0));
  shaft.position.y = 0.35 * -dir; head.position.y = 0; head.rotation.x = dir < 0 ? Math.PI : 0; g.add(shaft, head); return g;
}
function camelGeo() { const parts = [[0.62, 0.22, 0.2, 0, 0.42, 0], [0.18, 0.2, 0.18, -0.05, 0.62, 0], [0.12, 0.34, 0.1, 0.33, 0.6, 0], [0.18, 0.1, 0.1, 0.42, 0.78, 0]];
  for (const [lx, lz] of [[-0.22, -0.07], [-0.22, 0.07], [0.22, -0.07], [0.22, 0.07]]) parts.push([0.05, 0.34, 0.05, lx, 0.17, lz]);
  return merge(parts); }
function sheepGeo() { const parts = [[0.32, 0.2, 0.2, 0, 0.26, 0], [0.12, 0.12, 0.1, 0.2, 0.32, 0]]; for (const [lx, lz] of [[-0.1, -0.06], [-0.1, 0.06], [0.1, -0.06], [0.1, 0.06]]) parts.push([0.04, 0.17, 0.04, lx, 0.08, lz]); return merge(parts); }
function merge(parts) { const geos = parts.map(([w, h, d, x, y, z]) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); return b.toNonIndexed(); });
  const pos = []; geos.forEach(g => pos.push(...g.attributes.position.array)); const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.computeVertexNormals(); return out; }

export function createWellHologram(scene, site, ctx) {
  const { status, colorHex, anchor, hudLayer, reducedMotion } = ctx;
  const U = holoUniforms(); U.uBase.value = anchor.y + LIFT - DEPTH - 0.1; U.uHeight.value = DEPTH + 4.6;
  const root = new THREE.Group(); root.position.set(anchor.x, anchor.y + LIFT, anchor.z); scene.add(root);
  const spin = new THREE.Group(); root.add(spin);
  const alertCol = new THREE.Color(colorHex);
  // ground cut-away (270°) with strata, top disc and wedge faces
  const colGeo = new THREE.CylinderGeometry(R, R, DEPTH, 48, 1, true, 0.5 * Math.PI, 1.5 * Math.PI); colGeo.translate(0, -DEPTH / 2, 0);
  spin.add(new THREE.Mesh(colGeo, holoMat(U, 0xd99a55, 0.35, { stripes: 1, solid: true })), edges(colGeo, lineMat(U, CYAN, 0.55)));
  for (const y of [-0.55, -1.15, -1.75, -2.35, -3.0]) { const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 49 }, (_, k) => { const a = 0.5 * Math.PI + 1.5 * Math.PI * k / 48; return new THREE.Vector3(Math.cos(a) * R, y, -Math.sin(a) * R); })), lineMat(U, CYAN, 0.45)); spin.add(ring); }
  const wedgeGeo = new THREE.PlaneGeometry(R, DEPTH); wedgeGeo.translate(R / 2, -DEPTH / 2, 0);
  const w1 = new THREE.Mesh(wedgeGeo, holoMat(U, 0xc98840, 0.4, { stripes: 1, solid: true })); const w2 = w1.clone(); w2.rotation.y = Math.PI / 2; spin.add(w1, w2);
  const topDisc = new THREE.Mesh(new THREE.CircleGeometry(R, 48, 0.5 * Math.PI, 1.5 * Math.PI).rotateX(-Math.PI / 2), holoMat(U, 0xffd59a, 0.08)); spin.add(topDisc);
  const plat = new THREE.Mesh(new THREE.RingGeometry(R + 0.05, 4.2, 64, 1).rotateX(-Math.PI / 2), holoMat(U, CYAN, 0.08)); spin.add(plat);
  const platRing = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 97 }, (_, k) => new THREE.Vector3(Math.cos(k / 96 * Math.PI * 2) * 4.2, 0, Math.sin(k / 96 * Math.PI * 2) * 4.2))), lineMat(U, CYAN, 0.6)); spin.add(platRing);
  // shaft, inlet, pump head
  const shaftGeo = new THREE.CylinderGeometry(0.13, 0.13, DEPTH + 0.45, 18, 1, true); shaftGeo.translate(0, -DEPTH / 2 + 0.22, 0);
  spin.add(new THREE.Mesh(shaftGeo, holoMat(U, 0x2fd6e8, 0.6, { solid: true })), edges(shaftGeo, lineMat(U, 0x9ff6ff, 0.8)));
  const INLET = -2.35; const inlet = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 24).rotateX(Math.PI / 2), holoMat(U, 0xffffff, 1)); inlet.position.y = INLET; spin.add(inlet);
  const pump = new THREE.Group(); pump.position.y = 0.45;
  const pBody = new THREE.BoxGeometry(0.5, 0.36, 0.36), pArm = new THREE.BoxGeometry(0.9, 0.06, 0.06), pWheel = new THREE.TorusGeometry(0.22, 0.03, 8, 24);
  pump.add(new THREE.Mesh(pBody, holoMat(U, 0x1fb8c8, 0.6, { solid: true })), edges(pBody, lineMat(U, CYAN)));
  const arm = new THREE.Mesh(pArm, holoMat(U, CYAN, 0.8)); arm.position.set(0.25, 0.3, 0); pump.add(arm);
  const wheel = new THREE.Mesh(pWheel, holoMat(U, CYAN, 0.8)); wheel.position.set(-0.32, 0.12, 0.2); pump.add(wheel);
  spin.add(pump);
  // water table: column + wavy surface
  const waterCol = holoMat(U, 0x1e7bff, 0.5, { solid: true }); const wGeo = new THREE.CylinderGeometry(R - 0.06, R - 0.06, 1, 48, 1, false, 0.5 * Math.PI, 1.5 * Math.PI); wGeo.translate(0, 0.5, 0);
  const water = new THREE.Mesh(wGeo, waterCol); water.position.y = -DEPTH; spin.add(water);
  const surfGeo = new THREE.CircleGeometry(R - 0.06, 40, 0.5 * Math.PI, 1.5 * Math.PI); surfGeo.rotateX(-Math.PI / 2);
  const surfBase = surfGeo.attributes.position.array.slice();
  const surf = new THREE.Mesh(surfGeo, holoMat(U, 0x58b4ff, 0.6, { solid: true })); spin.add(surf);
  // floating particles
  const PN = reducedMotion ? 40 : 140, pp = new Float32Array(PN * 3), pv = [];
  for (let i = 0; i < PN; i++) { const a = Math.random() * Math.PI * 2, r = Math.random() * 3.6; pp.set([Math.cos(a) * r, -DEPTH + Math.random() * 6.5, Math.sin(a) * r], i * 3); pv.push(0.15 + Math.random() * 0.35); }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const parts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: CYAN, size: 0.05, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); root.add(parts);
  // light beam connecting hologram to the beacon below
  const tether = new THREE.Mesh(new THREE.CylinderGeometry(0.9, R + 0.2, LIFT + 0.2, 40, 1, true), holoMat(U, alertCol.getHex(), 0.05)); tether.position.y = -DEPTH - (LIFT) / 2 + 0.1; tether.visible = false; root.add(tether);

  // ---- per-well problem animation
  const fx = { waterY: -1.2, salt: 0, tint: 0, extra: () => {} };
  const id = site.id;
  if (id === 'liwa') {
    const old = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 49 }, (_, k) => { const a = 0.5 * Math.PI + 1.5 * Math.PI * k / 48; return new THREE.Vector3(Math.cos(a) * (R - 0.04), -0.75, -Math.sin(a) * (R - 0.04)); })), lineMat(U, 0xffffff, 0.35)); spin.add(old);
    const arr = arrowMesh(U, ALERT_COLORS.act, -1); arr.position.set(R + 0.55, -1.2, 0.2); spin.add(arr);
    fx.extra = (t) => { const ph = (t % 7) / 7; fx.waterY = -0.85 - 1.85 * Math.min(1, ph * 1.15); arr.position.y = -0.9 - ((t * 0.9) % 1) * 1.3; arr.children.forEach(m => m.material.uniforms.uOp.value = 1 - ((t * 0.9) % 1) * 0.6); };
  } else if (id === 'quaa') {
    fx.waterY = -1.7;
    const amber = new THREE.Color(ALERT_COLORS.warn);
    const mk = (geo, n, color) => new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), n);
    const camels = mk(camelGeo(), 7, amber.clone().multiplyScalar(1.6)), sheep = mk(sheepGeo(), 12, new THREE.Color(CYAN).multiplyScalar(1.4));
    spin.add(camels, sheep);
    const herd = [...Array(7)].map((_, i) => ({ m: camels, i, a: i / 7 * Math.PI * 2 + 0.3, stop: 2.05 + (i % 2) * 0.35, delay: i * 0.45 }))
      .concat([...Array(12)].map((_, i) => ({ m: sheep, i, a: i / 12 * Math.PI * 2 + 0.1, stop: 1.75 + (i % 3) * 0.25, delay: 0.2 + i * 0.3 })));
    const pulse = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.0, 64).rotateX(-Math.PI / 2), holoMat(U, ALERT_COLORS.warn, 1.0)); pulse.position.y = 0.02; spin.add(pulse);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    fx.extra = (t) => {
      const cyc = t % 12;
      for (const h of herd) { const k = Math.min(1, Math.max(0, (cyc - h.delay) / 4.5)); const r = 4.05 - (4.05 - h.stop) * (1 - Math.pow(1 - k, 2)); const jig = k >= 1 ? Math.sin(t * 3 + h.i) * 0.03 : 0;
        P.set(Math.cos(h.a) * (r + jig), 0.0 + (k < 1 ? Math.abs(Math.sin(t * 9 + h.i)) * 0.03 : 0), Math.sin(h.a) * (r + jig)); Q.setFromAxisAngle(Y, -h.a + Math.PI); M.compose(P, Q, S); h.m.setMatrixAt(h.i, M); }
      camels.instanceMatrix.needsUpdate = sheep.instanceMatrix.needsUpdate = true;
      const p = (t * 0.8) % 1; pulse.scale.setScalar(1 + p * 3.0); pulse.material.uniforms.uOp.value = 1 - p;
    };
  } else if (id === 'mz') {
    const salt = new THREE.Mesh(wGeo.clone(), holoMat(U, 0xf5e6c8, 0.55, { solid: true })); salt.position.y = -DEPTH; spin.add(salt);
    fx.waterY = -1.15;
    fx.extra = (t) => { const ph = (t % 8) / 8; const top = -DEPTH + 0.05 + (fx.waterY + DEPTH - 0.1) * Math.min(1, ph * 1.1); salt.scale.y = Math.max(0.01, top + DEPTH); fx.tint = Math.min(1, ph * 1.2); };
  } else if (id === 'sw') {
    fx.waterY = -1.4;
    const sensor = new THREE.Group(); const sb = new THREE.BoxGeometry(0.22, 0.22, 0.22); sensor.add(new THREE.Mesh(sb, holoMat(U, 0xff6b6b, 1)), edges(sb, lineMat(U, 0xff6b6b)));
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6), holoMat(U, 0xff6b6b, 1)); ant.position.y = 0.3; sensor.add(ant); sensor.position.set(0.05, 1.15, 0); spin.add(sensor);
    const sat = new THREE.Group(); const body = new THREE.BoxGeometry(0.4, 0.3, 0.3), panel = new THREE.BoxGeometry(0.75, 0.02, 0.32);
    sat.add(new THREE.Mesh(body, holoMat(U, BLUE, 0.8)), edges(body, lineMat(U, BLUE)));
    [-0.6, 0.6].forEach(x => { const p = new THREE.Mesh(panel, holoMat(U, 0x6fb6ff, 0.7)); p.position.x = x; const pe = edges(panel, lineMat(U, 0x6fb6ff)); pe.position.x = x; sat.add(p, pe); });
    sat.position.set(-2.2, 4.4, 0.6); root.add(sat);
    const beamPts = [new THREE.Vector3(-2.2, 4.25, 0.6), new THREE.Vector3(0, 0.75, 0)];
    const bGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 41 }, (_, k) => beamPts[0].clone().lerp(beamPts[1], k / 40))); bGeo.setAttribute('aU', new THREE.BufferAttribute(new Float32Array([...Array(41)].map((_, k) => k / 40)), 1));
    const bMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { ...U, uCol: { value: new THREE.Color(BLUE) } },
      vertexShader: 'attribute float aU;varying float vU;void main(){vU=aU;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform float uTime,uReveal;uniform vec3 uCol;varying float vU;void main(){if(uReveal<0.98)discard;float d=step(0.55,fract(vU*18.0-uTime*1.6));gl_FragColor=vec4(uCol*d*2.0,1.0);}' });
    root.add(new THREE.Line(bGeo, bMat));
    fx.extra = (t) => { const c = t % 5; const on = c < 1.4 ? (Math.random() > 0.45 ? 1 : 0.15) : 0.12; sensor.children.forEach(m => m.material.uniforms.uOp.value = on); sat.rotation.y = Math.sin(t * 0.5) * 0.4; };
  } else if (id === 'gh') {
    fx.waterY = -0.4;
    const arrows = [0, 1, 2].map(i => { const a = arrowMesh(U, ALERT_COLORS.ok, 1); a.rotation.z = -Math.PI / 2; const holder = new THREE.Group(); holder.rotation.y = i / 3 * Math.PI * 2 + 0.4; holder.add(a); spin.add(holder); return a; });
    const dash = [0, 1, 2].map(i => { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(R, 0.05, 0), new THREE.Vector3(4.1, 0.05, 0)]); const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: ALERT_COLORS.ok, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.9, toneMapped: false })); l.computeLineDistances(); l.rotation.y = i / 3 * Math.PI * 2 + 0.4; spin.add(l); return l; });
    fx.extra = (t) => { arrows.forEach((a, i) => { const p = (t * 0.45 + i / 3) % 1; a.position.set(R + 0.3 + p * 2.3, 0.15, 0); a.children.forEach(m => m.material.uniforms.uOp.value = 1 - p * 0.7); }); };
  } else if (id === 'rm') {
    const RN = reducedMotion ? 60 : 220, rp = new Float32Array(RN * 6), seeds = [];
    for (let i = 0; i < RN; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 3.2; seeds.push([Math.cos(a) * r, Math.sin(a) * r, Math.random()]); }
    const rGeo = new THREE.BufferGeometry(); rGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    const rain = new THREE.LineSegments(rGeo, new THREE.LineBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); root.add(rain);
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), holoMat(U, 0xbfe6ff, 0.18)); cloud.scale.set(2.6, 0.45, 1.6); cloud.position.y = 4.1; root.add(cloud);
    const arr = arrowMesh(U, ALERT_COLORS.ok, 1); arr.position.set(R + 0.55, -2.0, 0.2); spin.add(arr);
    fx.extra = (t) => { const ph = (t % 9) / 9; fx.waterY = -2.4 + 1.7 * ph;
      for (let i = 0; i < RN; i++) { const [x, z, o] = seeds[i]; const y = 3.8 - ((t * 0.9 + o) % 1) * 3.8; rp.set([x, y, z, x, y - 0.18, z], i * 6); } rGeo.attributes.position.needsUpdate = true;
      arr.position.y = -2.2 + ((t * 0.7) % 1) * 1.3; arr.children.forEach(m => m.material.uniforms.uOp.value = 1 - ((t * 0.7) % 1) * 0.6); };
  }

  // ---- HUD (HTML): big days number, gauge, mini 8-week chart
  const hud = document.createElement('div'); hud.className = 'holoHud';
  const band = site.model.band || []; const vals = band.flatMap(b => [b.lo, b.hi]).concat([site.thr]); const mn = Math.min(...vals), mx = Math.max(...vals);
  const NB = Math.max(1, band.length - 1); const X = i => 6 + i / NB * 148, Yv = v => 56 - (v - mn) / ((mx - mn) || 1) * 48;
  const mid = band.map((b, i) => `${X(i).toFixed(1)},${Yv(b.mid).toFixed(1)}`).join(' ');
  const area = band.map((b, i) => `${X(i)},${Yv(b.hi)}`).join(' ') + ' ' + [...band].reverse().map((b, i) => `${X(NB - i)},${Yv(b.lo)}`).join(' ');
  const score = site.danger ? site.danger.score : 50, ang = Math.PI * (1 - score / 100);
  const gx = 40 + Math.cos(ang) * 30, gy = 40 - Math.sin(ang) * 30;
  hud.innerHTML = `<div class="hh-title">${site.name}</div>
   <div class="hh-row"><div class="hh-days" style="color:${colorHex}">${ctx.daysLabel}<small>days until ${site.unit === 'mS/cm' ? 'unsafe' : 'dry'}</small></div>
   <svg class="hh-gauge" viewBox="0 0 80 48"><path d="M10 40 A30 30 0 0 1 70 40" fill="none" stroke="rgba(95,243,255,.25)" stroke-width="6" stroke-linecap="round"/><path d="M10 40 A30 30 0 0 1 ${gx.toFixed(1)} ${gy.toFixed(1)}" fill="none" stroke="${colorHex}" stroke-width="6" stroke-linecap="round"/><text x="40" y="38" text-anchor="middle">${score}</text><text x="40" y="47" text-anchor="middle" class="sm">danger</text></svg></div>
   <svg class="hh-chart" viewBox="0 0 160 62"><line x1="6" x2="154" y1="${Yv(site.thr).toFixed(1)}" y2="${Yv(site.thr).toFixed(1)}" stroke="#ff4757" stroke-dasharray="3 3"/><polygon points="${area}" fill="${colorHex}" opacity=".18"/><polyline points="${mid}" fill="none" stroke="${colorHex}" stroke-width="2"/><text x="6" y="61">now</text><text x="154" y="61" text-anchor="end">+8 wk</text></svg>
   <div class="hh-foot">${ctx.issue}</div>`;
  hudLayer.appendChild(hud);

  // ---- life cycle
  let t0 = performance.now() / 1000, state = 'in', stateT = 0, nextGlitch = 2 + Math.random() * 3, onGone = null;
  const v3 = new THREE.Vector3();
  function setWater(y) { y = Math.max(-DEPTH + 0.02, Math.min(-0.15, y)); water.scale.y = y + DEPTH; surf.position.y = y; }
  const api = {
    root,
    update(time, dt, camera, w, h) {
      const t = time - t0; U.uTime.value = time; stateT += dt;
      if (state === 'in') { U.uReveal.value = Math.min(1.02, stateT / 0.9); U.uGlitch.value = stateT < 0.6 ? (Math.random() > 0.5 ? 0.8 : 0) : 0; if (stateT > 0.95) { state = 'idle'; tether.visible = true; } }
      else if (state === 'out') { U.uReveal.value = Math.max(0, 1 - stateT / 0.6); U.uGlitch.value = Math.random() > 0.5 ? 0.6 : 0; if (stateT > 0.62 && onGone) { const f = onGone; onGone = null; api.dispose(); f(); return; } }
      else { nextGlitch -= dt; if (!reducedMotion && nextGlitch < 0) { U.uGlitch.value = 0.7; if (nextGlitch < -0.12) { U.uGlitch.value = 0; nextGlitch = 3 + Math.random() * 4; } } }
      U.uPulse.value = 0.88 + 0.12 * Math.sin(time * 2.4);
      spin.rotation.y += dt * (reducedMotion ? 0.04 : 0.14);
      root.position.y = anchor.y + LIFT + Math.sin(time * 1.1) * 0.08;
      U.uBase.value = root.position.y - DEPTH - 0.1;
      fx.extra(t);
      setWater(fx.waterY);
      const sp = surfGeo.attributes.position; for (let i = 0; i < sp.count; i++) { const x = surfBase[i * 3], z = surfBase[i * 3 + 2]; sp.setY(i, Math.sin(x * 3 + time * 2) * 0.03 + Math.cos(z * 3.5 - time * 1.6) * 0.03); } sp.needsUpdate = true;
      if (id === 'mz') { const c = new THREE.Color(BLUE).lerp(new THREE.Color(0xffc48a), fx.tint * 0.7); waterCol.uniforms.uCol.value.copy(c); surf.material.uniforms.uCol.value.copy(c); }
      const pa = pGeo.attributes.position; for (let i = 0; i < PN; i++) { let y = pa.getY(i) + pv[i] * dt; if (y > 3.5) y = -DEPTH; pa.setY(i, y); } pa.needsUpdate = true;
      // HUD follows the hologram on screen
      v3.set(root.position.x, root.position.y + 1.2, root.position.z).project(camera);
      const sx = (v3.x * 0.5 + 0.5) * w, sy = (-v3.y * 0.5 + 0.5) * h; const rev = Math.min(1, U.uReveal.value);
      hud.style.transform = `translate(${Math.min(w - 250, sx + 120).toFixed(0)}px,${Math.max(70, sy - 120).toFixed(0)}px)`; hud.style.opacity = rev.toFixed(2);
    },
    exit(cb) { if (state === 'out') return; state = 'out'; stateT = 0; tether.visible = false; onGone = cb || (() => {}); },
    dispose() { root.traverse(o => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose && o.material.dispose(); }); scene.remove(root); hud.remove(); },
  };
  return api;
}
