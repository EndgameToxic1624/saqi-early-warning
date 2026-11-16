# SAQI (ساقي) — Early Warnings for Desert Water Sources

Hackathon entry for **W-001 · Water & Climate AI**.

SAQI predicts which desert wells are failing weeks before they run dry. It then warns the herders, village councils and water authorities who depend on them.

## What it does
- **3D hologram map** of six water sources across Al Dhafra and Al Ain, Abu Dhabi. Drag to rotate, scroll to zoom, and click a beacon to fly in.
- **Zoom to the problem**: each well shows its own issue up close:
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

## Run
Open `index.html` in Chrome or Edge. There is no build step.

## Narration
Add recorded clips to an `audio/` folder (`intro.mp3`, `liwa.mp3`, `quaa.mp3`, `mz.mp3`, `sw.mp3`, `gh.mp3`, `rm.mp3`, `outro.mp3`) and the site plays them automatically. The scripts are in `VOICEOVER.md`. Without the clips, the site uses the browser's built-in voice.

## Data note
Well sensor readings, herder reports and forecasts are realistically simulated for real places. The satellite datasets are real public datasets available through Google Earth Engine.
