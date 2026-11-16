// ===== SAQI 3D map: look-and-feel settings (tweak freely) =====
export const MAP = {
  width: 40,            // east-west size of the slab (scene units)
  depth: 26,            // north-south size of the slab
  lon: [52.4, 56.1],    // geographic bounds shown on the slab
  lat: [22.75, 25.0],
  baseDepth: 1.6,       // thickness of the slab below sea level
};

export const TERRAIN = {
  segments: 256,            // 160 is used automatically on low-end devices
  windDirDeg: 315,          // shamal wind from the north-west stretches the dunes
  duneHeightSouth: 1.45,     // tallest dunes, Empty Quarter (south edge)
  duneHeightCoast: 0.18,    // near-flat coastal plain
  duneScale: 0.55,          // dune spacing (higher = more, smaller dunes)
  sand: { light: 0xf1d29a, mid: 0xe8b46e, deep: 0xd98a45, shadow: 0xa8673a, wet: 0x9c7a55, salt: 0xf3efe6, oasis: 0x2f5a2c },
  gridColor: 0x5ff3ff, gridOpacity: 0.05, contourEvery: 0.35, contourOpacity: 0.045,
  rimColor: 0x2ef0e4,
};

export const SEA = {
  shallow: 0x3fd6cf, deep: 0x0b3f6e, foam: 0xffffff,
  waveSpeed: 1.0, waveHeight: 0.035, foamWidth: 0.55,
};

export const LIGHT = {
  sunColor: 0xffd29a, sunIntensity: 3.4, sunFrom: [-22, 16, -6],   // golden hour, from the left (west)
  skyColor: 0xbfdcff, groundColor: 0x6b4a2a, hemiIntensity: 0.9,
  fogColor: 0x0d1418, fogDensity: 0.006, background: 0x0b1115,
};

export const ALERT_COLORS = { act: 0xff4757, warn: 0xffb020, watch: 0x3d8bff, ok: 0x2ee59d };
export const URGENCY = { act: { speed: 1.6, size: 1.9 }, warn: { speed: 1.1, size: 1.5 }, watch: { speed: 0.8, size: 1.25 }, ok: { speed: 0.5, size: 1.0 } };

export const CAMERA = { fov: 38, start: [0, 24, 30], minDistance: 7, maxDistance: 80, maxPolar: 1.22, autoRotateSpeed: 0.35, focusDistance: 14, flyTime: 1.2 };
