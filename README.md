# SAQI (ساقي) — Early Warnings for Desert Water Sources

Hackathon entry for **W-001 · Water & Climate AI**.

An interactive holographic dashboard that warns herders, village councils and water authorities that a desert well is failing **weeks before it runs dry**.

## Features
- Interactive 3D hologram of the Al Dhafra / Al Ain aquifer region (Abu Dhabi): drag to rotate, scroll to zoom, click a beacon
- AI voiceover and live captions for each water source (browser speech engine)
- Guided briefing mode that tours all six sources for the pitch
- Forecast for each source: days left, 80% range, model confidence, and a 20-week history with an 8-week forecast chart
- The signals fused for each source: GRACE-FO, Sentinel-2, Sentinel-1 SAR, CHIRPS, ERA5, sensors, herder reports
- A basic-phone SMS preview in Arabic and English
- A forecast horizon slider (today to +8 weeks)
- Desert rules: what happens when a sensor dies, when an image is cloudy, and how false alarms are balanced against missed ones

## Run
Open `index.html` in Chrome. No build step.

Sensor data and forecasts are realistically simulated. The satellite datasets named are real public datasets available through Google Earth Engine.
