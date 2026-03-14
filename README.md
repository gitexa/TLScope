# TLScope — Pathology Slide Viewer

A Vue.js web application for interactive exploration of whole-slide images (WSI), GrandQC quality control masks, attention heatmaps, and model predictions.

## Features

- **Whole-Slide Image Viewer**: OpenSeadragon-based pan/zoom viewer with DZI tile streaming
- **Attention Heatmap Overlay**: Per-patch attention scores rendered directly onto the WSI
- **QC Mask Visualization**: Color-coded GrandQC mask with per-category layer toggles, opacity control, and pie-chart statistics
- **QC WSI Overlay**: QC mask projected onto the WSI viewer in real time
- **Experiment Results Panel**:
  - Static attention map images (smoothed / unsmoothed overlays)
  - Per-slide prediction statistics
  - Experiment navigator: sort slides by worst/best prediction mismatch
- **Multi-dataset support**: configurable datasets in `config.js`
- **Navigation**: arrow-key and button navigation through the slide list; cancer-type filtering

## Quick Start

```bash
cd slide_viewer
./start.sh          # auto-detects OpenSlide; runs on port 8080
./start.sh --port 9000   # custom port
```

Open `http://localhost:8080` in your browser.

**Requirements**:
- Python 3.8+
- `openslide-python` + system OpenSlide library (for WSI viewing and QC mask serving)
- `Pillow` and `numpy` (for QC mask downsampling)

```bash
pip install openslide-python pillow numpy
```

## File Structure

```
slide_viewer/
├── index.html          # Vue template + CSS
├── app.js              # Vue application logic
├── config.js           # Dataset and path configuration
├── server.py           # Basic HTTP server (no OpenSlide)
├── server_enhanced.py  # Full server with OpenSlide, DZI, and API endpoints
└── start.sh            # Launch script
```

## Configuration

All dataset paths and column mappings live in `config.js`. Each dataset entry has the form:

```javascript
{
    name: "My Dataset",
    csvPath: '/path/to/slides.csv',
    thumbnailBasePath: '/path/to/thumbnails',
    qcMaskBasePath: '/path/to/qc_masks',
    resultsBasePath: '/path/to/results',
    analysisDir: 'analysis_subdir',
    defaultExperiment: 'my_experiment',
    predictionsFile: 'predictions.csv',
    columnMapping: {
        sampleId: 'SAMPLE_ACCESSION',
        cancerType: 'cancer_type',
        filePath: 'SVS_PATH',
        maskPath: 'MASK_PATH',
    },
    imagePatterns: { ... },
}
```

## Server API Endpoints

| Endpoint | Description |
|---|---|
| `GET /dzi/slide.dzi?path=...` | DZI metadata for a WSI |
| `GET /dzi/slide_files/?path=...` | DZI tile images |
| `GET /slide-info?path=...` | Slide dimensions and level count |
| `GET /api/list-experiments?resultsBasePath=...` | List experiment folders |
| `GET /api/attention-map?...` | Attention map image paths + metadata JSON |
| `GET /api/attention-scores?...` | Per-patch attention scores (numpy → JSON) |
| `GET /api/qc-mask?path=...&maxDim=2048&raw=1` | Downsampled QC mask PNG |
| `GET /api/predictions?...` | Single-slide prediction row |
| `GET /api/all-predictions?...` | Full predictions CSV for experiment navigator |

## Expected Directory Layout (Results)

```
{resultsBasePath}/
└── {experiment}/
    └── {analysisDir}/
        ├── attention_maps/
        │   └── {cancerType}/
        │       └── {slideId}/
        │           ├── attention.npy
        │           ├── coords.npy
        │           ├── metadata.json
        │           └── plots/
        │               ├── overlay_smoothed.png
        │               └── overlay_unsmoothed.png
        └── predictions/
            └── {predictionsFile}.csv
```

## Troubleshooting

**Attention maps / images not loading after a navigation action**
- The server must be run with `server_enhanced.py` (not `server.py`) to support DZI, QC masks, and attention scores.
- `server_enhanced.py` uses a threaded HTTP server so slow requests (e.g. large QC mask rendering) don't block other API calls.

**QC mask renders incorrectly**
- The `/api/qc-mask` endpoint handles both grayscale and RGB mask PNGs automatically.
- Category values 1–7 map to the colors defined in `config.js` under `qcMask.categories`.

**Port already in use**
```bash
fuser -k 8080/tcp && ./start.sh
```

**OpenSlide not found**
```bash
# Ubuntu/Debian
sudo apt-get install openslide-tools libopenslide-dev
pip install openslide-python
```
