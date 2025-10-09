# Pathology Slide Viewer

A Vue.js-based web application for viewing pathology slide thumbnails, quality control masks, attention maps, and metadata.

## Features

- 🔍 **Search by ID**: Enter sample accession ID to load slide data
- 📊 **Metadata Display**: View comprehensive slide information and QC metrics
- 🖼️ **Multiple Views**:
  - Original slide thumbnail
  - GrandQC quality control masks
  - Attention maps (if computed)
  - Overlay view with adjustable opacity
- 🎯 **Model Predictions**: Display TLS/GC counts and classification results
- 📈 **Quality Metrics**: Tissue share, background, folds, artifacts, etc.

## Setup

### 1. Configure Paths

Edit `app.js` to set your data paths:

```javascript
config: {
    csvPath: '/path/to/profile_results_intermediate.csv',
    thumbnailBasePath: '/path/to/thumbnails',
    qcMaskBasePath: '/path/to/grandqc/results',
    attentionMapBasePath: '/path/to/attention_maps'
}
```

### 2. Organize Your Data

The viewer expects the following directory structure:

```
/thumbnails/
    BL-13-E28458.jpg
    BL-13-E42518.png
    ...

/grandqc/results/
    BL-13-E28458_qc_mask.png
    BL-13-E42518_qc_mask.png
    ...

/attention_maps/
    BL-13-E28458_attention.png
    BL-13-E42518_attention.png
    ...
```

### 3. Run the Server

```bash
# Navigate to the slide-viewer directory
cd /home/alex-mac/slide-viewer

# Run the Python server
python3 server.py --port 8080

# Or run on a different port
python3 server.py --port 9000
```

### 4. Access the Viewer

Open your browser and navigate to:
```
http://localhost:8080
```

## Usage

1. **Search for a slide**: Enter the `SAMPLE_ACCESSION` ID (e.g., `BL-13-E28458`) in the search box
2. **View slide information**: See cancer type, biopsy site, procedure date
3. **Check predictions**: View TLS/GC counts and confidence scores
4. **Inspect quality metrics**: Review tissue share, artifacts, and quality issues
5. **Explore images**: 
   - View original thumbnail
   - Toggle QC mask overlay
   - Show/hide attention map
   - Adjust overlay opacity with sliders

## Image Path Resolution

The viewer tries multiple possible paths for each image type:

**Thumbnails:**
- `{basePath}/{sampleId}.jpg`
- `{basePath}/{sampleId}.png`
- `{basePath}/{sampleId}_thumbnail.jpg`

**QC Masks:**
- `{basePath}/{sampleId}_qc_mask.png`
- `{basePath}/{sampleId}_mask.png`
- `{basePath}/qc_masks/{sampleId}.png`

**Attention Maps:**
- `{basePath}/{sampleId}_attention.png`
- `{basePath}/{sampleId}_attn.png`
- `{basePath}/attention/{sampleId}.png`

## CSV Format

The viewer expects a CSV file with the following columns:

### Required Columns:
- `SAMPLE_ACCESSION`: Unique slide identifier
- `onco_tree_code_level_2`: Cancer type
- `BIOPSY_SITE`: Tissue source
- `PROCEDURE_DT`: Date of procedure

### QC Metrics Columns:
- `qc_tissue_share`: Fraction of tissue area
- `qc_background_share`: Fraction of background
- `qc_folds_share`: Fraction with folds
- `qc_dark_share`: Fraction of dark areas
- `qc_pen_share`: Fraction with pen marks
- `qc_bubbles_share`: Fraction with bubbles
- `qc_focus_share`: Fraction with focus issues
- `total_pixels`: Total image pixels

### Prediction Columns:
- `pred_num_tls`: Predicted TLS count
- `pred_num_gc`: Predicted GC count
- `pred_num_tls_raw`: Raw TLS prediction (log-space)
- `pred_num_gc_raw`: Raw GC prediction (log-space)
- `predictions`: Classification result
- `confidence`: Prediction confidence
- `prediction_successful`: Boolean success flag

## Troubleshooting

### Images Not Loading

1. **Check file paths**: Verify that image files exist at the configured paths
2. **File permissions**: Ensure the server has read access to image directories
3. **CORS issues**: The Python server includes CORS headers, but if using a different server, ensure CORS is enabled
4. **Browser console**: Open developer tools (F12) to see any loading errors

### CSV Not Loading

1. **Check CSV path**: Verify `csvPath` in `app.js` is correct
2. **File format**: Ensure CSV is properly formatted with headers in first row
3. **File encoding**: CSV should be UTF-8 encoded

### Server Won't Start

1. **Port in use**: Try a different port with `--port` flag
2. **Python version**: Requires Python 3.6+
3. **Permissions**: Ensure you have permission to bind to the port

## Advanced Configuration

### Custom Image Paths

To add custom image path patterns, modify the `loadImagePaths` method in `app.js`:

```javascript
loadImagePaths(sampleId) {
    const thumbnailPaths = [
        `${this.config.thumbnailBasePath}/${sampleId}.jpg`,
        // Add more patterns here
    ];
    // ...
}
```

### Add New Metadata Fields

To display additional metadata fields, edit the metadata section in `index.html`:

```html
<div class="metadata-item">
    <div class="metadata-label">New Field</div>
    <div class="metadata-value">{{ slideData.new_field }}</div>
</div>
```

### Customize Styling

Modify the `<style>` section in `index.html` to change colors, layout, or appearance.

## Development

### Dependencies

The application uses CDN-hosted libraries:
- Vue.js 3
- Axios (for HTTP requests)

No build process or npm packages required!

### File Structure

```
slide-viewer/
├── index.html      # Main HTML page with Vue template
├── app.js          # Vue.js application logic
├── server.py       # Python HTTP server with CORS
└── README.md       # This file
```

## Examples

### Example Search IDs (from your dataset):
- `BL-13-E28458` - Lung Adenocarcinoma
- `BL-13-E42518` - Renal Clear Cell Carcinoma
- `BL-13-M42482` - Prostate Adenocarcinoma
- `BL-14-A44702` - Lung Adenocarcinoma

## Notes

- Images are loaded asynchronously and displayed when available
- Missing images show placeholder messages
- QC metrics are displayed as percentages with appropriate precision
- Predictions are only shown if `prediction_successful` is true
- Overlay view allows comparing multiple image layers

## License

MIT License - Feel free to modify and distribute as needed.

## Support

For issues or questions, check:
1. Browser console for JavaScript errors
2. Server logs for file access issues
3. CSV format and column names
4. Image file paths and permissions
