# 🔬 Pathology Slide Viewer - Complete Package

A modern, Vue.js-based web application for viewing and analyzing pathology slide thumbnails, quality control metrics, and model predictions.

## 📦 Package Contents

```
slide-viewer/
├── index.html              # Main HTML page with Vue.js template
├── app.js                  # Vue.js application logic
├── config.js               # Configuration file
├── server.py               # Python HTTP server with CORS support
├── start.sh                # Quick start script
├── generate_thumbnails.py  # Tool for generating slide thumbnails
├── README.md               # User documentation
└── SETUP_GUIDE.md          # Detailed setup instructions
```

## ✨ Features

### Core Features
- 🔍 **Search by Sample ID**: Enter sample accession to load slide data
- 📊 **Rich Metadata Display**: View comprehensive slide information
- 🖼️ **Multiple Image Views**:
  - Original slide thumbnails
  - GrandQC quality control masks
  - Model attention maps
  - Interactive overlay view

### Data Display
- 🎯 **Model Predictions**: TLS/GC counts, classification results, confidence scores
- 📈 **Quality Metrics**: Tissue share, background, folds, artifacts, focus issues
- 🏥 **Clinical Information**: Cancer type, biopsy site, procedure date
- 📋 **Full Metadata**: All available fields from CSV

### Interactive Features
- 🎚️ **Adjustable Opacity**: Slider controls for overlays
- 🔄 **Toggle Overlays**: Show/hide QC masks and attention maps independently
- 🖱️ **Responsive Design**: Works on desktop and tablet devices
- ⚡ **Fast Loading**: Async image loading with fallbacks

## 🚀 Quick Start

### 1. Navigate to Directory
```bash
cd /home/alex-mac/slide-viewer
```

### 2. Configure Paths
Edit `config.js` to point to your data:
```javascript
const CONFIG = {
    csvPath: '/path/to/profile_results_intermediate.csv',
    thumbnailBasePath: '/path/to/thumbnails',
    qcMaskBasePath: '/path/to/grandqc/results',
    attentionMapBasePath: '/path/to/attention_maps',
};
```

### 3. Start Server
```bash
./start.sh
```

### 4. Open Browser
Navigate to: `http://localhost:8080`

### 5. Search for a Slide
Enter a sample ID (e.g., `BL-13-E28458`) and click "Load Slide"

## 📁 Data Requirements

### CSV File Format
Your CSV must contain:

**Required Columns:**
- `SAMPLE_ACCESSION` - Unique slide identifier
- `onco_tree_code_level_2` - Cancer type
- `BIOPSY_SITE` - Tissue location
- `PROCEDURE_DT` - Procedure date

**QC Metrics (recommended):**
- `qc_tissue_share`, `qc_background_share`
- `qc_folds_share`, `qc_dark_share`, `qc_pen_share`
- `qc_bubbles_share`, `qc_focus_share`
- `total_pixels`

**Predictions (optional):**
- `pred_num_tls`, `pred_num_gc` - Model predictions
- `predictions`, `confidence` - Classification results
- `prediction_successful` - Success flag

### Image Files

**Thumbnails:**
```
/thumbnails/BL-13-E28458.jpg
```

**QC Masks:**
```
/grandqc/results/BL-13-E28458_qc_mask.png
```

**Attention Maps:**
```
/attention_maps/BL-13-E28458_attention.png
```

## 🛠️ Tools Included

### Thumbnail Generator
Generate thumbnails from whole slide images:

```bash
# From directory
python3 generate_thumbnails.py \
    --input /path/to/slides \
    --output /path/to/thumbnails

# From CSV
python3 generate_thumbnails.py \
    --csv results.csv \
    --output /path/to/thumbnails
```

### HTTP Server
Simple Python server with CORS support:

```bash
python3 server.py --port 8080
```

### Start Script
One-command startup:

```bash
./start.sh --port 8080
```

## 📖 Documentation

- **README.md**: User guide and feature documentation
- **SETUP_GUIDE.md**: Detailed setup instructions and troubleshooting
- **config.js**: Configuration options with comments

## 🎨 Customization

### Change Colors
Edit CSS in `index.html`:
```css
.btn-primary {
    background: #3498db;  /* Change to your color */
}
```

### Add Metadata Fields
Edit the metadata section in `index.html`:
```html
<div class="metadata-item">
    <div class="metadata-label">New Field</div>
    <div class="metadata-value">{{ slideData.new_field }}</div>
</div>
```

### Custom Image Paths
Add patterns in `config.js`:
```javascript
imagePatterns: {
    thumbnail: [
        '{basePath}/{sampleId}.jpg',
        '{basePath}/custom/{sampleId}_thumb.png',
    ]
}
```

## 🔧 Technical Details

### Dependencies
- **Vue.js 3**: Frontend framework (CDN)
- **Axios**: HTTP requests (CDN)
- **Python 3.6+**: HTTP server
- **Modern Browser**: Chrome, Firefox, Safari, Edge

### No Build Required
- All dependencies loaded via CDN
- No npm, webpack, or build process
- Just edit and refresh!

### Browser Support
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 📊 Example Data

### Sample IDs to Try
Based on your CSV file:
- `BL-13-E28458` - Lung Adenocarcinoma (LUAD)
- `BL-13-E42518` - Renal Clear Cell Carcinoma (CCRCC)
- `BL-13-M42482` - Prostate Adenocarcinoma (PRAD)
- `BL-14-A44702` - Lung Adenocarcinoma (LUAD)

### Expected QC Metrics
- Tissue Share: 40-70%
- Background: 20-50%
- Pen Marks: 5-10%
- Artifacts: <1%

### Prediction Values
- TLS Count: 0-20
- GC Count: 0-5
- Confidence: 0.5-0.99

## 🐛 Troubleshooting

### Common Issues

**"Slide ID not found"**
- Check spelling of sample ID
- Verify ID exists in CSV
- Check CSV path in config.js

**Images not loading**
- Verify file paths in config.js
- Check file permissions
- View browser console (F12) for errors

**Server won't start**
- Check if port is in use: `lsof -i :8080`
- Try different port: `./start.sh --port 9000`
- Verify Python 3 is installed

**CORS errors**
- Use provided server.py (includes CORS headers)
- Access via localhost, not IP address
- Check browser security settings

## 📈 Performance

### Optimization Tips
1. **Thumbnails**: 1024-2048px is optimal
2. **JPEG Quality**: 80-85 balances quality and size
3. **Workers**: Adjust num_workers based on CPU cores
4. **Caching**: Browser caches images automatically

### Expected Load Times
- CSV load: <1 second
- Thumbnail load: 0.5-2 seconds per image
- QC mask: 0.5-1 second
- Attention map: 0.5-1 second

## 🔒 Security Notes

**Important**: This is a development tool

For production use:
- ✅ Add authentication
- ✅ Use HTTPS/SSL
- ✅ Implement access controls
- ✅ Sanitize inputs
- ✅ Use proper web server (nginx/Apache)
- ✅ Protect sensitive medical data

## 📝 License

MIT License - Free to use, modify, and distribute

## 🤝 Contributing

To extend or modify:

1. **Add features**: Edit Vue.js code in `app.js`
2. **Change styling**: Modify CSS in `index.html`
3. **New data sources**: Update `config.js` and data loading logic
4. **Custom overlays**: Add new image types following existing patterns

## 📞 Support

For help:
1. Check `SETUP_GUIDE.md` for detailed instructions
2. Review browser console for JavaScript errors
3. Verify data paths and file permissions
4. Test with known working sample IDs

## 🎓 Learning Resources

- **Vue.js**: https://vuejs.org/guide/
- **JavaScript**: https://developer.mozilla.org/
- **OpenSlide**: https://openslide.org/
- **Pathology ML**: https://arxiv.org/

## 🔮 Future Enhancements

Potential improvements:
- [ ] Zoom/pan for images
- [ ] Side-by-side comparison
- [ ] Batch viewing mode
- [ ] Export reports
- [ ] Annotation tools
- [ ] Integration with PACS systems
- [ ] Real-time collaboration
- [ ] Mobile app

## 📦 File Sizes

Typical file sizes:
- Thumbnails: 200-500 KB (JPEG)
- QC Masks: 100-300 KB (PNG)
- Attention Maps: 100-400 KB (PNG)
- CSV: 1-10 MB (5000 slides)

## 🌐 Network Requirements

For remote access:
- Minimum bandwidth: 1 Mbps
- Recommended: 10+ Mbps
- Latency: <100ms for good UX

## ✅ Checklist

Before using:
- [ ] Configured paths in config.js
- [ ] Generated thumbnails (if needed)
- [ ] CSV file accessible
- [ ] Image files organized
- [ ] Server port available
- [ ] Browser updated

---

**Created**: October 2025  
**Version**: 1.0  
**Platform**: Linux  
**Python**: 3.6+  
**Node**: Not required

**Ready to explore your pathology data!** 🔬🎉
