// Well beacons: light beam + diamond + pulsing ground ring, red risk glow,
// animated capacity links, hit areas and de-overlapped HTML day tags.
import * as THREE from 'three';
import { ALERT_COLORS, URGENCY } from './config.js';

const BEAM_H = { act: 5.2, warn: 4.4, watch: 3.8, ok: 3.3 };
const LBL = { act: 'Act now', warn: 'Warning', watch: 'Watch', ok: 'Stable' };

// terrain-conforming square patch (so rings/glows hug the dunes)
function groundPatch(terrain, x, z, r, res, material) {
  const g = new THREE.PlaneGeometry(r * 2, r * 2, res, res); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const px = p.getX(i) + x, pz = p.getZ(i) + z; p.setY(i, Math.max(terrain.heightAt(px, pz), 0.0) + 0.04); p.setX(i, px); p.setZ(i, pz); }
  const m = new THREE.Mesh(g, material); m.renderOrder = 3; return m;
}
const ringMat = (color) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(color) }, uC: { value: new THREE.Vector2() }, uR: { value: 2 }, uSpeed: { value: 1 }, uBright: { value: 1 } },
  vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader: `uniform float uTime,uR,uSpeed,uBright;uniform vec3 uCol;uniform vec2 uC;varying vec3 vW;
void main(){float d=distance(vW.xz,uC)/uR; if(d>1.0)discard;
 float a=0.0; for(int k=0;k<2;k++){float ph=fract(uTime*uSpeed*0.5+float(k)*0.5); float rr=ph; a+=smoothstep(0.035,0.0,abs(d-rr))*(1.0-ph);}
 a+=smoothstep(0.03,0.0,abs(d-0.16))*0.9 + smoothstep(0.2,0.0,d)*0.25;
 gl_FragColor=vec4(uCol*a*1.6*uBright,1.0);}`,
});
const glowMat = (color) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(color) }, uC: { value: new THREE.Vector2() }, uR: { value: 3.4 } },
  vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader: `uniform float uTime,uR;uniform vec3 uCol;uniform vec2 uC;varying vec3 vW;
void main(){float d=distance(vW.xz,uC)/uR;float a=smoothstep(1.0,0.0,d);a=a*a*(0.75+0.25*sin(uTime*2.2));gl_FragColor=vec4(uCol*a*0.55,1.0);}`,
});
const beamMat = (color, width) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(color) }, uBright: { value: 1 }, uW: { value: width } },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: `uniform float uTime,uBright,uW;uniform vec3 uCol;varying vec2 vUv;
void main(){float fade=pow(1.0-vUv.y,1.3)*0.9+0.1; float edge=1.0-abs(vUv.x-0.5)*2.0; edge=pow(max(edge,0.0),uW);
 float flow=0.75+0.25*sin(vUv.y*40.0-uTime*6.0);
 gl_FragColor=vec4(uCol*fade*edge*flow*1.8*uBright,1.0);}`,
});

export function buildBeacons(scene, terrain, app, layer) {
  const { toX, toZ } = terrain.geo;
  const group = new THREE.Group(); scene.add(group);
  const items = [], hitMeshes = [];
  const tagWrap = document.createElement('div'); tagWrap.className = 'tags3d'; layer.appendChild(tagWrap);

  for (const s of app.SITES) {
    const x = toX(s.lon), z = toZ(s.lat), y = Math.max(terrain.heightAt(x, z), 0);
    const g = new THREE.Group(); g.position.set(x, y, z); group.add(g);
    // beam: two crossed billboarded planes (inner core + soft halo)
    const core = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 1), beamMat(0xffffff, 1.2));
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1), beamMat(0xffffff, 3.0));
    [core, halo].forEach(m => { m.geometry.translate(0, 0.5, 0); g.add(m); m.renderOrder = 4; });
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    const dWire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.28, 0)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, toneMapped: false }));
    g.add(diamond, dWire);
    const ring = groundPatch(terrain, x, z, 2.6, 26, ringMat(0xffffff)); ring.material.uniforms.uC.value.set(x, z); group.add(ring);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 6.5, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.position.y = 3.0; hit.userData.site = s; g.add(hit); hitMeshes.push(hit);
    const tag = document.createElement('div'); tag.className = 'tag3d'; tag.innerHTML = '<i></i><b></b><span></span>'; tagWrap.appendChild(tag);
    tag.addEventListener('click', () => app.onPick(s)); tag.addEventListener('mouseenter', () => api.setHover(s)); tag.addEventListener('mouseleave', () => api.setHover(null));
    items.push({ s, g, core, halo, diamond, dWire, ring, hit, tag, x, z, y, st: 'ok', h: 3, glow: null });
  }
  // risk glow decals (created for wells in "act")
  const glows = new THREE.Group(); group.add(glows);
  // capacity links: dashed animated arcs from green wells to nearby amber wells, with travelling dots
  const linkGroup = new THREE.Group(); group.add(linkGroup); let links = [];
  const linkMat = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(0x5ff3ff) } },
    vertexShader: 'attribute float aU;varying float vU;void main(){vU=aU;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform float uTime;uniform vec3 uCol;varying float vU;void main(){float d=step(0.5,fract(vU*26.0-uTime*0.9));gl_FragColor=vec4(uCol*d*1.4,1.0);}' });
  function rebuildLinks() {
    linkGroup.clear(); links = [];
    const greens = items.filter(i => i.st === 'ok'), ambers = items.filter(i => i.st === 'warn');
    for (const gI of greens) {
      const near = ambers.map(a => [a, Math.hypot(a.x - gI.x, a.z - gI.z)]).filter(([, d]) => d < 26).sort((a, b) => a[1] - b[1]).slice(0, 1);
      for (const [a] of near) {
        const pts = []; const N = 60;
        for (let k = 0; k <= N; k++) { const u = k / N, x = gI.x + (a.x - gI.x) * u, z = gI.z + (a.z - gI.z) * u; pts.push(new THREE.Vector3(x, Math.max(terrain.heightAt(x, z), 0) + 0.15 + Math.sin(u * Math.PI) * 1.6, z)); }
        const geo = new THREE.BufferGeometry().setFromPoints(pts); geo.setAttribute('aU', new THREE.BufferAttribute(new Float32Array(pts.map((_, k) => k / N)), 1));
        const line = new THREE.Line(geo, linkMat()); linkGroup.add(line);
        const dots = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0x9ffcff, toneMapped: false })); linkGroup.add(m); return m; });
        links.push({ line, dots, pts });
      }
    }
  }
  let hover = null, selected = null;
  const api = {
    group, hitMeshes,
    refresh() {
      glows.clear();
      for (const it of items) {
        const st = app.statusOf(it.s); it.st = st; const col = new THREE.Color(ALERT_COLORS[st]);
        it.h = BEAM_H[st]; it.core.scale.y = it.h; it.halo.scale.y = it.h * 0.92;
        it.core.material.uniforms.uCol.value.copy(col).lerp(new THREE.Color(0xffffff), 0.35); it.halo.material.uniforms.uCol.value.copy(col);
        it.diamond.material.color.copy(col).multiplyScalar(1.6); it.dWire.material.color.copy(col).multiplyScalar(1.8);
        it.diamond.position.y = it.dWire.position.y = it.h + 0.35;
        const u = URGENCY[st]; const rm = it.ring.material.uniforms; rm.uCol.value.copy(col); rm.uSpeed.value = u.speed; rm.uR.value = u.size * 1.35;
        if (st === 'act') { const gp = groundPatch(terrain, it.x, it.z, 3.6, 30, glowMat(ALERT_COLORS.act)); gp.material.uniforms.uC.value.set(it.x, it.z); glows.add(gp); }
        const days = app.daysLabel(it.s);
        it.tag.style.setProperty('--c', '#' + col.getHexString());
        it.tag.querySelector('b').textContent = days; it.tag.querySelector('span').textContent = `${it.s.name} · ${LBL[st]}`;
      }
      rebuildLinks();
    },
    setHover(s) { hover = s; },
    setSelected(s) { selected = s; },
    update(t, camera, w, h, dim) {
      const v = new THREE.Vector3(); const placed = [];
      const order = items.map(it => ({ it, d: camera.position.distanceTo(new THREE.Vector3(it.x, it.y, it.z)) })).sort((a, b) => a.d - b.d);
      for (const it of items) {
        const hot = hover === it.s || selected === it.s, other = selected && selected !== it.s, open = selected === it.s;
        it.core.visible = it.halo.visible = it.diamond.visible = it.dWire.visible = it.ring.visible = !open;
        [it.core, it.halo].forEach(m => { m.quaternion.copy(camera.quaternion); m.rotation.x = 0; m.rotation.z = 0; m.lookAt(camera.position.x, it.y + m.position.y, camera.position.z); m.material.uniforms.uTime.value = t; m.material.uniforms.uBright.value = (hot ? 1.6 : 1) * (other ? 0.45 : 1); });
        it.diamond.rotation.y = t * 1.2; it.dWire.rotation.y = -t * 0.8; const bob = Math.sin(t * 2 + it.x) * 0.08; it.diamond.position.y = it.dWire.position.y = it.h + 0.35 + bob;
        it.ring.material.uniforms.uTime.value = t; it.ring.material.uniforms.uBright.value = (hot ? 1.5 : 1) * (other ? 0.4 : 1);
      }
      glows.children.forEach(gp => gp.material.uniforms.uTime.value = t);
      links.forEach(L => { L.line.material.uniforms.uTime.value = t; L.dots.forEach((m, k) => { const u = (t * 0.12 + k / 3) % 1, f = u * (L.pts.length - 1), i0 = Math.floor(f); m.position.copy(L.pts[i0]).lerp(L.pts[Math.min(i0 + 1, L.pts.length - 1)], f - i0); }); L.line.visible = !selected; L.dots.forEach(m => m.visible = !selected); });
      // labels: nearest first, avoid overlaps, fade with distance
      for (const { it, d } of order) {
        v.set(it.x, it.y + it.h + 0.75, it.z).project(camera);
        const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h, hot = hover === it.s || selected === it.s;
        it.tag.classList.toggle('full', hot);
        let vis = v.z < 1 && sx > -40 && sx < w + 40 && sy > -20 && sy < h + 20 && !selected;
        const tw = it.tag.offsetWidth || (hot ? 210 : 62), th = 24; let x0 = sx - 10, y0 = sy - th - 4;
        for (let tries = 0; tries < 6 && vis; tries++) { const hitR = placed.find(r => x0 < r[0] + r[2] && x0 + tw > r[0] && y0 < r[1] + r[3] && y0 + th > r[1]); if (!hitR) break; if (tries % 2 === 0) x0 = hitR[0] + hitR[2] + 4; else { x0 = sx - 10; y0 = hitR[1] - th - 4; } }
        if (vis) placed.push([x0, y0, tw, th]);
        const fade = Math.max(0.6, Math.min(1, (115 - d) / 40));
        it.tag.style.opacity = vis ? (hot ? 1 : fade) : 0; it.tag.style.pointerEvents = vis ? 'auto' : 'none';
        it.tag.style.transform = `translate(${x0.toFixed(1)}px,${y0.toFixed(1)}px)`; it.tag.style.zIndex = hot ? 5 : 1;
      }
    },
    world(s) { const it = items.find(i => i.s === s); return it ? new THREE.Vector3(it.x, it.y, it.z) : null; },
    dispose() { group.traverse(o => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose && o.material.dispose(); }); scene.remove(group); tagWrap.remove(); },
  };
  api.refresh();
  return api;
}
