// Procedural desert diorama: dune heightmap, sand shading, salt flat, oases,
// wet shoreline, faint hologram grid + contours, slab walls, teal rim, glass table.
import * as THREE from 'three';
import { MAP, TERRAIN, LIGHT } from './config.js';
import { makeNoise, smoothstep, lerp } from './noise.js';

// Simplified Abu Dhabi coastline (lon, lat). Sea is north of this line.
export const COAST = [[52.0, 24.08], [52.6, 24.18], [53.1, 24.12], [53.6, 24.17], [54.05, 24.25], [54.35, 24.42], [54.6, 24.5], [54.95, 24.78], [55.2, 25.0], [55.6, 25.4]];
const ISLANDS = [[53.35, 24.33, 0.10, 0.05], [53.75, 24.36, 0.07, 0.035], [54.55, 24.62, 0.06, 0.04], [52.85, 24.30, 0.05, 0.03]];
const OASES = [[53.78, 23.12, 0.10, 0.035], [53.95, 23.09, 0.07, 0.03], [54.12, 23.13, 0.06, 0.025], [55.72, 24.20, 0.08, 0.06], [53.68, 23.66, 0.04, 0.03], [55.40, 24.46, 0.05, 0.03]];

export function geo() {
  const [lon0, lon1] = MAP.lon, [lat0, lat1] = MAP.lat;
  const toX = lon => ((lon - lon0) / (lon1 - lon0) - 0.5) * MAP.width;
  const toZ = lat => (0.5 - (lat - lat0) / (lat1 - lat0)) * MAP.depth;
  const lonOf = x => lon0 + (x / MAP.width + 0.5) * (lon1 - lon0);
  const latOf = z => lat0 + (0.5 - z / MAP.depth) * (lat1 - lat0);
  const unitsPerDeg = MAP.depth / (lat1 - lat0);
  const coastLat = lon => { for (let k = 0; k < COAST.length - 1; k++) { const [a, b] = COAST[k], [c, d] = COAST[k + 1]; if (lon >= a && lon <= c) return b + (d - b) * (lon - a) / (c - a); } return lon < COAST[0][0] ? COAST[0][1] : 99; };
  return { toX, toZ, lonOf, latOf, unitsPerDeg, coastLat };
}

export function buildTerrain(scene, { lowEnd = false } = {}) {
  const G = geo(), N = makeNoise(11), N2 = makeNoise(29), N3 = makeNoise(53);
  const W = MAP.width, D = MAP.depth, seg = lowEnd ? 160 : TERRAIN.segments;
  const wind = TERRAIN.windDirDeg * Math.PI / 180, cw = Math.cos(wind), sw = Math.sin(wind);
  const blob = (lon, lat, b) => Math.exp(-(((lon - b[0]) / b[2]) ** 2 + ((lat - b[1]) / b[3]) ** 2));

  // ---- signed distance to shore (scene units, + inland) incl. islands
  function shore(x, z) {
    const lon = G.lonOf(x), lat = G.latOf(z);
    let d = (G.coastLat(lon) - lat) * G.unitsPerDeg;
    for (const isl of ISLANDS) { const k = blob(lon, lat, isl); if (k > 0.35) d = Math.max(d, (k - 0.35) * 2.2); }
    return d;
  }
  // ---- height + material channels
  function sample(x, z) {
    const lon = G.lonOf(x), lat = G.latOf(z), d = shore(x, z);
    const south = Math.pow(smoothstep(24.25, 22.85, lat), 1.15);
    const u = x * cw + z * sw, v = -x * sw + z * cw, sc = TERRAIN.duneScale;
    const ridge = n => { const r = 1 - Math.abs(n); return r * r; };
    const big = ridge(N(u * 0.16 * sc, v * 0.62 * sc));
    const mid = ridge(N2(u * 0.42 * sc + 3.1, v * 1.35 * sc));
    const small = N3(u * 1.9, v * 3.2) * 0.5 + 0.5;
    const base = N(x * 0.045 + 9, z * 0.045 - 4) * 0.5 + 0.5;
    const amp = lerp(TERRAIN.duneHeightCoast, TERRAIN.duneHeightSouth, south);
    let dune = (big * 0.75 + mid * 0.32 + small * 0.04) * amp;
    let h = 0.05 + base * (0.18 + 0.55 * south) + dune;
    // Jebel Hafeet + Hajar foothills (rocky)
    const jebel = 2.4 * Math.exp(-(((lon - 55.78) / 0.07) ** 2 + ((lat - 24.06) / 0.2) ** 2)) * (0.85 + 0.25 * N2(x * 0.9, z * 0.9));
    const hajar = 1.1 * smoothstep(55.92, 56.1, lon) * (0.6 + 0.4 * (N(x * 0.5, z * 0.5) * 0.5 + 0.5));
    const rock = Math.min(1, (jebel + hajar) / 1.2);
    h += jebel + hajar;
    // Sabkha (salt flat) west coast: flatten
    const sab = Math.min(1, blob(lon, lat, [52.95, 23.88, 0.42, 0.16]) * 1.3) * smoothstep(-0.2, 0.6, d);
    h = lerp(h, 0.07 + 0.01 * small, sab * 0.92);
    // coastal plain taper and sea floor
    let land = smoothstep(0, 2.4, d);
    if (d >= 0) h = h * (0.12 + 0.88 * land) + 0.03 * smoothstep(0, 0.5, d);
    else h = -0.06 - 1.15 * smoothstep(0, 4.5, -d) + N3(x * 0.7, z * 0.7) * 0.04;
    let oasis = 0; for (const o of OASES) oasis = Math.max(oasis, blob(lon, lat, o));
    oasis = oasis > 0.35 && d > 0.3 ? smoothstep(0.35, 0.7, oasis) * (N2(x * 3, z * 3) > -0.2 ? 1 : 0.3) : 0;
    return { h, d, dune: dune / Math.max(0.2, amp), south, sab, oasis, rock };
  }

  // ---- top surface
  const geom = new THREE.PlaneGeometry(W, D, seg, Math.round(seg * D / W));
  geom.rotateX(-Math.PI / 2);
  const pos = geom.attributes.position, n = pos.count, colors = new Float32Array(n * 3), data = new Array(n);
  for (let i = 0; i < n; i++) { const s = sample(pos.getX(i), pos.getZ(i)); data[i] = s; pos.setY(i, s.h); }
  geom.computeVertexNormals();
  const C = k => new THREE.Color(TERRAIN.sand[k]);
  const cL = C('light'), cM = C('mid'), cD = C('deep'), cS = C('shadow'), cW = C('wet'), cSalt = C('salt'), cO = C('oasis'), cRock = new THREE.Color(0x8a6a52), cSeabed = new THREE.Color(0xd9c08a);
  const nrm = geom.attributes.normal, tmp = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const s = data[i], slope = 1 - nrm.getY(i);
    // crest = light gold, valley = deep orange, more orange to the south
    tmp.copy(cM).lerp(cL, smoothstep(0.25, 0.9, s.dune) * (1 - 0.35 * s.south));
    tmp.lerp(cD, (1 - smoothstep(0.1, 0.55, s.dune)) * (0.25 + 0.55 * s.south));
    tmp.lerp(cS, smoothstep(0.25, 0.7, slope) * 0.35);
    if (s.d < 0) tmp.copy(cSeabed).lerp(new THREE.Color(0x6c8f8a), smoothstep(0, 2.5, -s.d));
    else tmp.lerp(cW, (1 - smoothstep(0.0, 0.45, s.d)) * 0.85);
    tmp.lerp(cSalt, s.sab * 0.9);
    tmp.lerp(cRock, s.rock * 0.8);
    tmp.lerp(cO, s.oasis);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const uniforms = { uFocus: { value: new THREE.Vector2(0, 0) }, uDim: { value: 0 }, uTime: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0.0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms, { uGridCol: { value: new THREE.Color(TERRAIN.gridColor) } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWPos; uniform vec2 uFocus; uniform float uDim; uniform float uTime; uniform vec3 uGridCol;
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float grain=hsh(floor(vWPos.xz*90.0));
diffuseColor.rgb*=0.94+0.1*grain;
float dimK=uDim*smoothstep(2.5,10.0,distance(vWPos.xz,uFocus));
diffuseColor.rgb*=1.0-0.5*dimK;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// wind ripples + sand grain as a tiny normal perturbation
vec2 rd=normalize(vec2(${cw.toFixed(3)},${sw.toFixed(3)}));
float ph=dot(vWPos.xz,rd)*26.0+vnz(vWPos.xz*3.0)*6.0;
vec3 pw=vec3(rd.x,0.0,rd.y)*cos(ph)*0.10+vec3(hsh(vWPos.xz*211.0)-0.5,0.0,hsh(vWPos.zx*197.0)-0.5)*0.10;
normal=normalize(normal+(viewMatrix*vec4(pw,0.0)).xyz*step(0.02,vWPos.y));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
vec2 gw=fwidth(vWPos.xz); vec2 gl=abs(fract(vWPos.xz/2.0-0.5)-0.5)/max(gw/2.0,1e-4);
float grid=1.0-min(min(gl.x,gl.y),1.0);
float cw2=fwidth(vWPos.y)/${TERRAIN.contourEvery.toFixed(3)}; float cl=abs(fract(vWPos.y/${TERRAIN.contourEvery.toFixed(3)}-0.5)-0.5)/max(cw2,1e-4);
float contour=(1.0-min(cl,1.0))*step(0.12,vWPos.y);
totalEmissiveRadiance+=uGridCol*(grid*${TERRAIN.gridOpacity.toFixed(3)}+contour*${TERRAIN.contourOpacity.toFixed(3)})*(1.0-0.6*dimK);`);
  };
  const top = new THREE.Mesh(geom, mat); top.receiveShadow = true; top.castShadow = true;

  // ---- slab walls + base (strata) and teal rim
  const wallPos = [], wallCol = [], wallIdx = [], bottom = -MAP.baseDepth;
  const strata = y => { const t = (y - bottom) / (MAP.baseDepth + 2); const b = 0.5 + 0.5 * Math.sin(y * 9.0); return new THREE.Color(0x7d4a24).lerp(new THREE.Color(0xc98d4f), 0.35 + 0.35 * b * t); };
  const water = new THREE.Color(0x1b8fa8);
  const rimPts = [];
  const edge = (pts) => {
    const base = wallPos.length / 3;
    pts.forEach(([x, z]) => {
      const s = sample(x, z), hTop = Math.max(s.h, 0), hMid = s.h;
      [[hTop, hTop > hMid + 0.001 ? water : strata(hTop)], [hMid, strata(hMid)], [bottom, new THREE.Color(0x3a2414)]].forEach(([y, c]) => { wallPos.push(x, y, z); wallCol.push(c.r, c.g, c.b); });
      rimPts.push(new THREE.Vector3(x, hTop + 0.015, z));
    });
    for (let k = 0; k < pts.length - 1; k++) { const a = base + k * 3, b = a + 3; for (let r = 0; r < 2; r++) wallIdx.push(a + r, b + r, a + r + 1, b + r, b + r + 1, a + r + 1); }
  };
  const S = 120, hw = W / 2, hd = D / 2, side = (f) => Array.from({ length: S + 1 }, (_, k) => f(k / S));
  edge(side(t => [-hw + t * W, hd])); edge(side(t => [hw, hd - t * D])); edge(side(t => [hw - t * W, -hd])); edge(side(t => [-hw, -hd + t * D]));
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3)); wg.setAttribute('color', new THREE.Float32BufferAttribute(wallCol, 3)); wg.setIndex(wallIdx); wg.computeVertexNormals();
  const walls = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide })); walls.castShadow = true;
  const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, D), new THREE.MeshStandardMaterial({ color: 0x24160d, roughness: 1 })); baseMesh.position.y = bottom;
  const rimMat = new THREE.LineBasicMaterial({ color: new THREE.Color(TERRAIN.rimColor).multiplyScalar(2.2), transparent: true, opacity: 0.95, toneMapped: false });
  const rim = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(rimPts), rimMat);
  const rimLow = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, z]) => new THREE.Vector3(x, bottom + 0.02, z))), rimMat);
  // soft teal glow strip hugging the slab edge
  const glowMat = new THREE.MeshBasicMaterial({ color: TERRAIN.rimColor, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const glow = new THREE.Mesh(new THREE.BoxGeometry(W + 0.25, MAP.baseDepth + 0.6, D + 0.25), glowMat); glow.position.y = bottom + (MAP.baseDepth + 0.6) / 2 - 0.05;
  // ---- dark glass table
  const table = new THREE.Mesh(new THREE.PlaneGeometry(220, 160), new THREE.MeshStandardMaterial({ color: 0x0c1418, roughness: 0.22, metalness: 0.55 }));
  table.rotation.x = -Math.PI / 2; table.position.y = bottom - 0.03; table.receiveShadow = true;
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.6, D * 1.8), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: new THREE.Color(TERRAIN.rimColor) } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 vUv;uniform vec3 uCol;void main(){vec2 p=(vUv-0.5)*2.0;float r=length(p*vec2(1.0,1.15));gl_FragColor=vec4(uCol*0.16*smoothstep(1.0,0.45,r),1.0);}' }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = bottom - 0.02;

  const group = new THREE.Group(); group.add(top, walls, baseMesh, rim, rimLow, glow, table, halo);
  scene.add(group);
  const heightAt = (x, z) => sample(x, z).h;
  return { group, top, uniforms, heightAt, shore, geo: G, sample,
    dispose() { group.traverse(o => { o.geometry && o.geometry.dispose(); o.material && (Array.isArray(o.material) ? o.material.forEach(m => m.dispose()) : o.material.dispose()); }); scene.remove(group); } };
}
