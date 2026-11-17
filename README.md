# SAQI (ساقي) — Early Warnings for Desert Water Sources

Hackathon entry for **W-001 · Water & Climate AI**.

SAQI predicts which desert wells are failing weeks before they run dry. It then warns the herders, village councils and water authorities who depend on them.

## What it does
- **3D desert diorama** of six water sources across Al Dhafra and Al Ain, Abu Dhabi, built with Three.js. It has dunes that grow taller to the south, a salt flat, oases, an animated Gulf coast with foam, and a glowing slab edge.
- **Beacons** in each well's alert colour (red act now, amber warning, blue watch, green stable), with the days left on top. They update live with the forecast slider. Drag to turn the map, scroll to zoom, or open it full screen.
- **Well holograms**: click a beacon and the camera flies in while a hologram of the well rises out of the sand. It shows the cut-away ground, the shaft, the pump and the water table, with a small panel for the days left, the danger score and the 8-week chart. Press Back or Esc to return.
- **Zoom to the problem**: each well's hologram acts out its own issue:
  - Hameem: the water table is dropping.
  - Al Qua'a: too many herds are using one well.
  - Madinat Zayed: salt water is creeping in.
  - Sweihan: the sensor is offline, so a satellite takes over.
  - Ghayathi: it has spare capacity to share.
  - Remah: it is recharging after rain.
- **Forecast for each well**: days until it fails, a likely range, model confidence and an 8-week chart.
- **Evidence**: GRACE-FO groundwater, Sentinel-1/2, CHIRPS rainfall, ERA5 climate, well sensors and herder reports.
- **Warning preview**: an Arabic and English SMS for a basic phone, plus a 3-step action plan.
- **Guided tour** with narration and subtitles.
- **Forecast slider** to see the region up to 8 weeks ahead.

## How the forecast works
Everything runs live in the browser (see the "How we calculated this" panel for each well):
1. **Data:** 26 weeks of weekly water-level or salinity readings for each well, plus a monthly GRACE-FO groundwater trend. The readings are realistically simulated.
2. **Kalman filter:** fuses the readings into the current level and its rate of change, with uncertainty. When a sensor goes silent, the filter keeps going on satellite data and the uncertainty grows.
3. **Monte Carlo:** runs 2,000 simulated futures to give the median days until failure, an 80% range, and a confidence score (the share of futures within 30% of the median).
4. **Alert level:** set from the chance of failing within 3, 6 and 8 weeks. A Warning or Act now alert also needs 2 of 3 independent signal groups (sensor, satellite, herders) to agree.
5. **Danger score:** combines the 8-week failure risk, how soon the well fails, and how uncertain the forecast is.

## Run
Live: https://saqi-early-warning.vercel.app/ (mirror: https://endgametoxic1624.github.io/saqi-early-warning/)

To run it locally, serve the folder (the 3D map uses JavaScript modules, which browsers block when opening the file directly):

```
python -m http.server 8000
```

Then open http://localhost:8000 in Chrome or Edge. There is no build step, and Three.js is included in `vendor/`, so it works offline.

## Code layout
- `index.html`: the app (well list, details panel, forecast model, tour, chat).
- `map3d/`: the 3D map. `terrain.js` (dunes and slab), `sea.js` (water shader), `beacons.js` (well beams, labels, links), `wellHologram.js` (the close-up holograms), `effects.js` (lights and glow), `main.js` (camera and wiring), `config.js` (all tunable constants).
- `vendor/three/`: Three.js 0.170.

## Narration
Add recorded clips to an `audio/` folder (`intro.mp3`, `liwa.mp3`, `quaa.mp3`, `mz.mp3`, `sw.mp3`, `gh.mp3`, `rm.mp3`, `outro.mp3`) and the site plays them automatically. The scripts are in `VOICEOVER.md`. Without the clips, the site uses the browser's built-in voice.

## Data note
Well sensor readings, herder reports and forecasts are realistically simulated for real places. The satellite datasets are real public datasets available through Google Earth Engine.
