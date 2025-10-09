# Slide Viewer - Data Setup Guide

## Directory Structure

To use the slide viewer, organize your data as follows:

```
/home/alex-mac/slide-viewer/           # Application directory
    ├── index.html                      # Main HTML page
    ├── app.js                          # Vue.js application
    ├── config.js                       # Configuration file
    ├── server.py                       # Python HTTP server
    ├── start.sh                        # Quick start script
    └── generate_thumbnails.py          # Thumbnail generation tool

/mnt/disks/ahaas-persistent-std-tcga/
    ├── results/
    │   └── 10_regr_pos_sin_256_.../
    │       └── profile_results_intermediate.csv  # Metadata CSV
    └── attention_maps/                 # Attention map images
        ├── BL-13-E28458_attention.png
        ├── BL-13-E42518_attention.png
        └── ...

/mnt/disks/pancancer-pathmolecular/
    └── thumbnails/                     # Slide thumbnails
        ├── BL-13-E28458.jpg
        ├── BL-13-E42518.jpg
        └── ...

/home/alex-mac/grandqc/
    └── results/                        # Quality control masks
        ├── BL-13-E28458_qc_mask.png
        ├── BL-13-E42518_qc_mask.png
        └── ...
```

## Step 1: Configure Paths

Edit `config.js` to point to your data locations:

```javascript
const CONFIG = {
    csvPath: '/mnt/disks/ahaas-persistent-std-tcga/results/.../profile_results_intermediate.csv',
    thumbnailBasePath: '/mnt/disks/pancancer-pathmolecular/thumbnails',
    qcMaskBasePath: '/home/alex-mac/grandqc/results',
    attentionMapBasePath: '/mnt/disks/ahaas-persistent-std-tcga/attention_maps',
};
```

## Step 2: Generate Thumbnails (if needed)

If you don't have thumbnails yet, generate them from your whole slide images:

```bash
# From a directory of slide files
python3 generate_thumbnails.py \
    --input /path/to/slides \
    --output /mnt/disks/pancancer-pathmolecular/thumbnails \
    --size 2048 \
    --quality 85

# From a CSV file with slide paths
python3 generate_thumbnails.py \
    --csv /path/to/profile_results.csv \
    --path-column FILE_PATH \
    --id-column SAMPLE_ACCESSION \
    --output /mnt/disks/pancancer-pathmolecular/thumbnails \
    --size 2048 \
    --quality 85
```

### Thumbnail Generation Options:
- `--size`: Maximum dimension (default: 2048 pixels)
- `--quality`: JPEG quality 1-100 (default: 85)
- `--path-column`: CSV column with slide file paths
- `--id-column`: CSV column with sample IDs (used for output filenames)

## Step 3: Generate GrandQC Masks (if needed)

If you need to generate quality control masks, use GrandQC:

```bash
cd /home/alex-mac/grandqc

# Run GrandQC on your slides
python run_grandqc.py \
    --input /path/to/slides \
    --output /home/alex-mac/grandqc/results \
    --save-masks
```

## Step 4: Generate Attention Maps (if needed)

If you want to visualize attention maps, generate them during model inference:

```python
# In your prediction script
from models.model_clam import CLAM_SB

model = CLAM_SB(...)
model.eval()

with torch.no_grad():
    logits, Y_prob, Y_hat, A, instance_dict = model(features, return_attention=True)
    
    # A contains the attention weights
    # Visualize and save attention map
    import matplotlib.pyplot as plt
    plt.figure(figsize=(10, 10))
    plt.imshow(attention_map, cmap='hot', interpolation='nearest')
    plt.colorbar()
    plt.savefig(f'/path/to/attention_maps/{sample_id}_attention.png')
```

## Step 5: Verify CSV Format

Ensure your CSV file has these columns:

### Required Columns:
- `SAMPLE_ACCESSION`: Unique slide identifier (used for searching)
- `onco_tree_code_level_2`: Cancer type classification
- `BIOPSY_SITE`: Tissue/organ location
- `PROCEDURE_DT`: Date of procedure

### Quality Control Columns:
- `qc_tissue_share`: Fraction of tissue (0-1)
- `qc_background_share`: Fraction of background (0-1)
- `qc_folds_share`: Fraction with folds (0-1)
- `qc_dark_share`: Fraction of dark areas (0-1)
- `qc_pen_share`: Fraction with pen marks (0-1)
- `qc_bubbles_share`: Fraction with bubbles (0-1)
- `qc_focus_share`: Fraction with focus issues (0-1)
- `total_pixels`: Total number of pixels

### Prediction Columns (optional):
- `pred_num_tls`: Predicted TLS count
- `pred_num_gc`: Predicted GC count
- `pred_num_tls_raw`: Raw TLS prediction (log-space)
- `pred_num_gc_raw`: Raw GC prediction (log-space)
- `predictions`: Classification result (0 or 1)
- `confidence`: Prediction confidence (0-1)
- `confidence_class_0`: Confidence for class 0
- `confidence_class_1`: Confidence for class 1
- `prediction_successful`: Boolean (True/False)

## Step 6: Start the Server

```bash
cd /home/alex-mac/slide-viewer

# Option 1: Use the start script
./start.sh

# Option 2: Run Python server directly
python3 server.py --port 8080

# Option 3: Custom port
./start.sh --port 9000
```

## Step 7: Access the Viewer

Open your web browser and navigate to:
```
http://localhost:8080
```

## Testing

Test with sample IDs from your CSV:

1. Enter `BL-13-E28458` in the search box
2. Click "Load Slide"
3. Verify that:
   - Slide information loads correctly
   - Thumbnail appears (if available)
   - QC metrics display properly
   - Predictions show up (if computed)
   - Overlays work (if images available)

## Troubleshooting

### Images Not Loading

**Check file existence:**
```bash
# Check thumbnail
ls -lh /mnt/disks/pancancer-pathmolecular/thumbnails/BL-13-E28458.jpg

# Check QC mask
ls -lh /home/alex-mac/grandqc/results/BL-13-E28458_qc_mask.png

# Check attention map
ls -lh /mnt/disks/ahaas-persistent-std-tcga/attention_maps/BL-13-E28458_attention.png
```

**Check file permissions:**
```bash
# Make sure files are readable
chmod -R 644 /mnt/disks/pancancer-pathmolecular/thumbnails/*.jpg
chmod -R 644 /home/alex-mac/grandqc/results/*.png
```

### CSV Not Loading

**Verify CSV path:**
```bash
# Check if CSV exists
ls -lh /mnt/disks/ahaas-persistent-std-tcga/results/.../profile_results_intermediate.csv

# Check first few lines
head -n 5 /mnt/disks/ahaas-persistent-std-tcga/results/.../profile_results_intermediate.csv
```

**Check CSV format:**
```bash
# Count columns
head -n 1 /path/to/results.csv | tr ',' '\n' | wc -l

# List column names
head -n 1 /path/to/results.csv | tr ',' '\n'
```

### Port Already in Use

```bash
# Check what's using the port
lsof -i :8080

# Kill the process (replace PID)
kill <PID>

# Or use a different port
./start.sh --port 9000
```

### CORS Errors

The Python server includes CORS headers by default. If you see CORS errors:

1. Make sure you're using the provided `server.py`
2. Access via `localhost` or `127.0.0.1` (not the IP address)
3. Check browser console for specific error messages

## Advanced Configuration

### Custom Image Path Patterns

Edit `config.js` to add custom path patterns:

```javascript
imagePatterns: {
    thumbnail: [
        '{basePath}/{sampleId}.jpg',
        '{basePath}/{sampleId}.png',
        '{basePath}/custom_folder/{sampleId}_thumb.jpg',
    ],
    // ...
}
```

### Symbolic Links

If your data is in different locations, use symbolic links:

```bash
# Link to thumbnails
ln -s /actual/path/to/thumbnails /mnt/disks/pancancer-pathmolecular/thumbnails

# Link to QC results
ln -s /actual/path/to/qc_results /home/alex-mac/grandqc/results
```

## Performance Tips

1. **Thumbnail Size**: Smaller thumbnails (1024-2048px) load faster
2. **JPEG Quality**: Quality 80-85 is a good balance between size and quality
3. **File Organization**: Keep files in a simple, flat directory structure
4. **Caching**: The viewer caches images in the browser

## Production Deployment

For production use, consider:

1. **Use a proper web server**: nginx or Apache instead of Python's SimpleHTTPServer
2. **Add authentication**: Protect sensitive medical data
3. **HTTPS**: Use SSL/TLS for secure connections
4. **CDN**: Serve static assets from a CDN for better performance
5. **Database**: Store metadata in a database instead of CSV
6. **API**: Create a REST API for data access

## Example nginx Configuration

```nginx
server {
    listen 80;
    server_name slide-viewer.example.com;
    
    root /home/alex-mac/slide-viewer;
    index index.html;
    
    # CORS headers
    add_header Access-Control-Allow-Origin *;
    
    # Serve thumbnails
    location /thumbnails/ {
        alias /mnt/disks/pancancer-pathmolecular/thumbnails/;
    }
    
    # Serve QC masks
    location /qc/ {
        alias /home/alex-mac/grandqc/results/;
    }
    
    # Serve attention maps
    location /attention/ {
        alias /mnt/disks/ahaas-persistent-std-tcga/attention_maps/;
    }
}
```

## Support

For issues or questions:
1. Check browser console (F12) for JavaScript errors
2. Check server logs for file access issues
3. Verify CSV format and column names
4. Ensure file paths and permissions are correct
