// Animated Arabian Gulf: depth-based colour, two scrolling normal layers,
// small vertex waves, fresnel, sun glint and a breathing foam line.
import * as THREE from 'three';
import { MAP, SEA, LIGHT } from './config.js';

export function buildSea(scene, terrain, sunDir) {
  const W = MAP.width, D = MAP.depth;
  const geom = new THREE.PlaneGeometry(W, D, 200, 130); geom.rotateX(-Math.PI / 2);
  const pos = geom.attributes.position, shore = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) shore[i] = terrain.shore(pos.getX(i), pos.getZ(i));
  geom.setAttribute('aShore', new THREE.BufferAttribute(shore, 1));
  const uniforms = {
    uTime: { value: 0 }, uSun: { value: sunDir.clone().normalize() }, uSunCol: { value: new THREE.Color(LIGHT.sunColor) },
    uShallow: { value: new THREE.Color(SEA.shallow) }, uDeep: { value: new THREE.Color(SEA.deep) }, uFoam: { value: new THREE.Color(SEA.foam) },
    uSky: { value: new THREE.Color(0x9cc6e8) }, uWaveH: { value: SEA.waveHeight }, uFoamW: { value: SEA.foamWidth }, uSpeed: { value: SEA.waveSpeed },
    uFocus: terrain.uniforms.uFocus, uDim: terrain.uniforms.uDim,
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `attribute float aShore; uniform float uTime,uWaveH,uSpeed; varying float vShore; varying vec3 vW;
void main(){ vec3 p=position; float off=smoothstep(0.0,1.5,-aShore); float t=uTime*uSpeed;
 p.y+=uWaveH*off*(sin(p.x*1.3+t*1.2)+0.7*sin(p.z*1.9-t*0.9)+0.4*sin((p.x+p.z)*3.1+t*1.7));
 vShore=aShore; vec4 w=modelMatrix*vec4(p,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime,uFoamW,uSpeed,uDim; uniform vec3 uSun,uSunCol,uShallow,uDeep,uFoam,uSky; uniform vec2 uFocus; varying float vShore; varying vec3 vW;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
vec2 g(vec2 p){float e=0.05;return vec2(n(p+vec2(e,0))-n(p-vec2(e,0)),n(p+vec2(0,e))-n(p-vec2(0,e)))/(2.0*e);}
void main(){
 if(vShore>0.25) discard;
 float t=uTime*uSpeed;
 vec2 g1=g(vW.xz*2.2+vec2(t*0.11,t*0.06)); vec2 g2=g(vW.xz*5.5+vec2(-t*0.15,t*0.12));
 vec3 nn=normalize(vec3(-(g1.x*0.35+g2.x*0.18),1.0,-(g1.y*0.35+g2.y*0.18)));
 float depth=smoothstep(0.0,4.0,-vShore);
 vec3 col=mix(uShallow,uDeep,pow(depth,0.7));
 vec3 v=normalize(cameraPosition-vW);
 float fres=pow(1.0-max(dot(nn,v),0.0),3.0);
 col=mix(col,uSky,fres*0.45);
 float spec=pow(max(dot(reflect(-uSun,nn),v),0.0),140.0);
 col+=uSunCol*spec*2.2;
 // breathing foam line along the shore, broken up by noise
 float f=uFoamW*(0.55+0.45*sin(uTime*0.9));
 float band=smoothstep(f,f-0.22,-vShore)*smoothstep(-0.05,0.08,-vShore);
 float brk=smoothstep(0.35,0.75,n(vW.xz*6.0+vec2(t*0.3,0.0)));
 float streak=smoothstep(0.82,0.95,n(vW.xz*vec2(3.0,9.0)+t*0.2))*(1.0-depth)*0.5;
 col=mix(col,uFoam,clamp(band*brk*1.1+streak,0.0,1.0));
 float dimK=uDim*smoothstep(2.5,10.0,distance(vW.xz,uFocus)); col*=1.0-0.5*dimK;
 float a=mix(0.72,0.96,depth); a=max(a,band*brk);
 a*=smoothstep(0.25,0.0,vShore);
 gl_FragColor=vec4(col,a);
 #include <colorspace_fragment>
}`,
  });
  const mesh = new THREE.Mesh(geom, mat); mesh.position.y = 0.0; mesh.renderOrder = 1;
  scene.add(mesh);
  return { mesh, uniforms, dispose() { geom.dispose(); mat.dispose(); scene.remove(mesh); } };
}
