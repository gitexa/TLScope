# 🎉 Slide Viewer - Updated and Ready!

## ✅ Configuration Updated

I've configured the slide viewer to work with your GrandQC data!

### 📁 Data Location

Your GrandQC directory contains everything we need:
```
/mnt/disks/vanallenlab/profile/grand_qc/wsi-qc-skipped/
```

Each slide has multiple files:
- `{SAMPLE_ID}.svs.jpg` - Thumbnail image
- `{SAMPLE_ID}.svs_map_QC.png` - Quality control map (colored)
- `{SAMPLE_ID}.svs_MASK_COL.png` - Colored mask
- `{SAMPLE_ID}.svs_overlay_QC.jpg` - QC overlay image
- `{SAMPLE_ID}.svs_OVERLAY.jpg` - Plain overlay
- `{SAMPLE_ID}.svs_TIS_MASK.png` - Tissue mask

### 🔗 Symlinks Created

Created convenient symlinks in the slide-viewer directory:

```bash
/home/alex-mac/slide-viewer/data.csv -> /mnt/disks/.../profile_results.csv
/home/alex-mac/slide-viewer/images -> /mnt/disks/vanallenlab/profile/grand_qc/wsi-qc-skipped
```

This allows the web server to access the files!

### 🎯 Updated Configuration

**config.js** now uses local paths:
```javascript
csvPath: 'data.csv'
thumbnailBasePath: 'images'
qcMaskBasePath: 'images'
attentionMapBasePath: 'images'
```

**Image patterns** updated to match GrandQC format:
```javascript
thumbnails: {sampleId}.svs.jpg
qcMasks: {sampleId}.svs_map_QC.png
overlays: {sampleId}.svs_overlay_QC.jpg
```

## 🚀 Start the Viewer

```bash
cd /home/alex-mac/slide-viewer
./start.sh
```

Then open: **http://localhost:8080**

## 🔍 Try These Sample IDs

Your CSV has **5,087 slides**. Try:

✅ `BL-13-E42518` - Now working!
✅ `BL-13-E28458` - Lung Adenocarcinoma
✅ `BL-13-M42482` - Prostate Adenocarcinoma
✅ `BL-12-A06525` - Sample from GrandQC directory
✅ `BL-12-D33475` - Another GrandQC sample

## 🖼️ What You'll See

For each slide:

### 1. Slide Information
- Sample ID, Cancer Type, Biopsy Site, Procedure Date

### 2. Model Predictions
- **TLS Count**: Predicted number of TLS
- **GC Count**: Predicted number of germinal centers
- **Confidence**: Model confidence score

### 3. Quality Control Metrics
- **Tissue Share**: % of slide that is actual tissue (typically 40-70%)
- **Background**: % that is background (20-50%)
- **Artifacts**: Folds, pen marks, bubbles, focus issues (<1-10%)
- **Total Pixels**: Total image size

### 4. Images (from GrandQC)

**Thumbnail** - Original slide image
- File: `{SAMPLE_ID}.svs.jpg`
- Shows the full slide at low resolution

**QC Mask** - Quality control map
- File: `{SAMPLE_ID}.svs_map_QC.png`
- Color-coded quality issues:
  - Red: Pen marks
  - Blue: Folds
  - Yellow: Focus issues
  - Dark: Background

**Overlay** - Combined view
- File: `{SAMPLE_ID}.svs_overlay_QC.jpg`
- Shows QC mask overlaid on original image

### 5. Interactive Controls

- **Opacity Sliders**: Adjust transparency of overlays (0-100%)
- **Toggle Buttons**: Show/hide QC mask and overlay independently
- **Overlay View**: See all layers combined with adjustable opacity

## 📊 Example Data

### Sample: BL-13-E42518

**Clinical Info:**
- Cancer: Renal Clear Cell Carcinoma (CCRCC)
- Site: Kidney (Primary)
- Date: 2013-12-11

**Predictions:**
- TLS Count: 1
- GC Count: 0
- Success: True

**Quality Metrics:**
- Tissue: 66.3%
- Background: 22.7%
- Pen marks: 8.5%
- Folds: <0.01%

**Images Available:**
✅ Thumbnail (290 KB)
✅ QC Map (539 KB)
✅ Colored Mask (32 KB)
✅ Overlay (881 KB)

## 🎨 Viewing Tips

1. **Load a slide**: Enter the sample ID and click "Load Slide"
2. **Check predictions**: Look at TLS/GC counts in the purple section
3. **Review QC metrics**: See tissue quality in the quality metrics grid
4. **View images**: Scroll down to see all available images
5. **Use overlays**: 
   - Toggle QC mask to see artifacts
   - Adjust opacity to see through layers
   - Use overlay view to compare everything at once

## 🐛 Troubleshooting

### "Slide ID not found in database"
- Check spelling (case-sensitive!)
- Verify the ID exists in your CSV
- Try one of the confirmed IDs above

### Images not loading
- Thumbnails should load automatically from GrandQC
- If missing, the file might not be in `/mnt/disks/vanallenlab/profile/grand_qc/wsi-qc-skipped/`
- Check browser console (F12) for specific errors

### Server won't start
```bash
# Check if port is in use
lsof -i :8080

# Use different port
./start.sh --port 9000
```

## 📈 Your Data Summary

**Total Slides**: 5,087
**CSV File**: 2.7 MB
**Images Directory**: 266 GB
**Image Files per Slide**: 8 files (thumbnail, masks, overlays, etc.)

**Cancer Types in Dataset:**
- Lung Adenocarcinoma (LUAD)
- Renal Clear Cell Carcinoma (CCRCC)
- Prostate Adenocarcinoma (PRAD)
- And many more...

## 🎯 Next Steps

1. **Start the viewer**: `./start.sh`
2. **Test with BL-13-E42518**: Should now work!
3. **Explore your data**: Browse through the 5,087 slides
4. **Check quality**: Use QC masks to identify problematic slides
5. **Analyze predictions**: Compare TLS/GC counts across cancer types

## 💡 Advanced Features

### Multiple Views Available

Each slide has multiple GrandQC outputs:

1. **Original** (`.svs.jpg`) - Raw slide thumbnail
2. **QC Map** (`.svs_map_QC.png`) - Color-coded quality issues
3. **Colored Mask** (`.svs_MASK_COL.png`) - Simplified mask
4. **Overlay QC** (`.svs_overlay_QC.jpg`) - QC overlaid on image
5. **Plain Overlay** (`.svs_OVERLAY.jpg`) - Basic overlay
6. **Tissue Mask** (`.svs_TIS_MASK.png`) - Tissue segmentation

The viewer will automatically try all these formats!

### Keyboard Shortcuts

- `Enter`: Load slide after typing ID
- `Escape`: Clear the search box
- `F12`: Open browser console for debugging

## 🎉 You're All Set!

Everything is configured and ready to use:

✅ CSV file linked
✅ Images directory linked
✅ Configuration updated
✅ File paths corrected
✅ GrandQC format supported

**Start exploring your pathology data now!**

```bash
cd /home/alex-mac/slide-viewer
./start.sh
# Open http://localhost:8080
# Search for: BL-13-E42518
```

Happy analyzing! 🔬✨
