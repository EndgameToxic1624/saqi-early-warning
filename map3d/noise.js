// Small, dependency-free 2D simplex noise (seeded) + helpers.
export function makeNoise(seed = 7) {
  const p = new Uint8Array(512); const perm = new Uint8Array(256);
  let s = seed >>> 0;
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const G = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return function noise(x, y) {
    const sk = (x + y) * F2, i = Math.floor(x + sk), j = Math.floor(y + sk);
    const t = (i + j) * G2, x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    const c = (gx, gy, xx, yy) => { let tt = 0.5 - xx * xx - yy * yy; if (tt < 0) return 0; tt *= tt; const g = G[gx]; return tt * tt * (g[0] * xx + g[1] * yy); };
    n += c(p[ii + p[jj]] & 7, 0, x0, y0);
    n += c(p[ii + i1 + p[jj + j1]] & 7, 0, x1, y1);
    n += c(p[ii + 1 + p[jj + 1]] & 7, 0, x2, y2);
    return 70 * n; // ~[-1,1]
  };
}
export const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
