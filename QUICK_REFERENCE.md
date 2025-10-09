# 🚀 Slide Viewer - Quick Reference

## 📂 File Overview

```
slide-viewer/
├── index.html              # Main web page (Vue.js + HTML + CSS)
├── app.js                  # Vue.js application logic
├── config.js               # Configuration (EDIT THIS FIRST!)
├── server.py               # Python HTTP server
├── start.sh                # Quick start script
├── test_setup.sh           # Test your setup
├── generate_thumbnails.py  # Generate thumbnails from WSI
├── README.md               # User documentation
├── SETUP_GUIDE.md          # Detailed setup instructions
└── PACKAGE_INFO.md         # Complete package information
```

## ⚡ Common Commands

```bash
# Test your setup
./test_setup.sh

# Start the viewer
./start.sh

# Start on different port
./start.sh --port 9000

# Generate thumbnails from directory
python3 generate_thumbnails.py --input /path/to/slides --output /path/to/thumbnails

# Generate thumbnails from CSV
python3 generate_thumbnails.py --csv results.csv --output /path/to/thumbnails
```

## 🔧 Configuration

Edit `config.js`:

```javascript
csvPath: '/path/to/profile_results_intermediate.csv'
thumbnailBasePath: '/path/to/thumbnails'
qcMaskBasePath: '/path/to/grandqc/results'
attentionMapBasePath: '/path/to/attention_maps'
```

## 🎯 Quick Start

1. **Configure**: Edit `config.js` with your paths
2. **Test**: Run `./test_setup.sh`
3. **Start**: Run `./start.sh`
4. **Browse**: Open `http://localhost:8080`
5. **Search**: Enter sample ID (e.g., `BL-13-E28458`)

## 📊 Features at a Glance

| Feature | Description |
|---------|-------------|
| 🔍 Search | Enter sample accession ID |
| 📋 Metadata | View slide info and QC metrics |
| 🖼️ Thumbnails | Display original slide images |
| 🎨 QC Masks | Show quality control overlays |
| 🔥 Attention Maps | Visualize model attention |
| 🎚️ Opacity Control | Adjust overlay transparency |
| 🔄 Toggle Overlays | Show/hide individual layers |
| 💾 Auto-save | Cache images in browser |

## 🗂️ Data Structure

```
CSV File (required):
  /path/to/profile_results_intermediate.csv

Thumbnails (recommended):
  /thumbnails/BL-13-E28458.jpg
  /thumbnails/BL-13-E42518.jpg

QC Masks (optional):
  /grandqc/results/BL-13-E28458_qc_mask.png
  /grandqc/results/BL-13-E42518_qc_mask.png

Attention Maps (optional):
  /attention_maps/BL-13-E28458_attention.png
  /attention_maps/BL-13-E42518_attention.png
```

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Slide not found | Check sample ID spelling |
| Images not loading | Verify paths in config.js |
| Port already in use | Use different port: `./start.sh --port 9000` |
| CSV not loading | Check csvPath in config.js |
| CORS errors | Use provided server.py |

## 📝 CSV Required Columns

**Essential:**
- `SAMPLE_ACCESSION` - Unique identifier
- `onco_tree_code_level_2` - Cancer type
- `BIOPSY_SITE` - Tissue location
- `PROCEDURE_DT` - Procedure date

**QC Metrics:**
- `qc_tissue_share`, `qc_background_share`
- `qc_folds_share`, `qc_dark_share`
- `qc_pen_share`, `qc_bubbles_share`
- `qc_focus_share`

**Predictions (optional):**
- `pred_num_tls`, `pred_num_gc`
- `predictions`, `confidence`
- `prediction_successful`

## 🎨 Customization

**Change colors**: Edit CSS in `index.html`
**Add metadata fields**: Edit metadata section in `index.html`
**Custom image paths**: Modify patterns in `config.js`
**Adjust layout**: Edit HTML structure in `index.html`

## 🔒 Security Reminder

⚠️ **Development tool only**

For production:
- Add authentication
- Use HTTPS
- Implement access controls
- Use proper web server (nginx)
- Protect sensitive data

## 📱 Browser Support

✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+

## 💡 Tips

1. **Thumbnail Size**: 2048px is optimal
2. **JPEG Quality**: 85 is recommended
3. **Port**: Use 8080-9000 range
4. **Sample IDs**: Case-sensitive
5. **Images**: .jpg for thumbnails, .png for masks/attention

## 📖 Full Documentation

- `README.md` - User guide and features
- `SETUP_GUIDE.md` - Detailed setup and troubleshooting
- `PACKAGE_INFO.md` - Complete package information

## 🚀 Next Steps

After setup:
1. ✅ Test with known sample IDs
2. ✅ Generate missing thumbnails
3. ✅ Verify all overlays work
4. ✅ Customize styling as needed
5. ✅ Add authentication for production

## 📞 Getting Help

1. Run `./test_setup.sh` to diagnose issues
2. Check browser console (F12) for errors
3. Review `SETUP_GUIDE.md` for detailed help
4. Verify file paths and permissions

---

**Version**: 1.0 | **Platform**: Linux | **Python**: 3.6+
