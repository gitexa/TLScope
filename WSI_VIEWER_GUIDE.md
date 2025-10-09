# 🔬 WSI Viewer Feature - Complete Guide

## Overview

The slide viewer now includes a **pyramidal whole slide image (WSI) viewer** powered by OpenSeadragon! This allows you to explore high-resolution pathology slides directly in your browser with smooth zoom and pan.

## ✨ New Features

### Pyramidal Viewing
- **Smooth zooming**: Zoom from overview to cellular detail
- **Fast panning**: Navigate large slides (100,000+ pixels) smoothly
- **Tile-based loading**: Only loads visible portions for performance
- **Mini-map navigator**: See your position in the whole slide

### Viewer Controls
- **Mouse wheel**: Zoom in/out
- **Click and drag**: Pan around the slide
- **Double-click**: Zoom to point
- **Reset button**: Return to full slide view
- **Fullscreen button**: Expand to full screen
- **Zoom display**: Shows current magnification level

## 🚀 Getting Started

### 1. Install OpenSlide

OpenSlide is required for WSI viewing:

```bash
# Install OpenSlide Python bindings
pip install openslide-python

# On Ubuntu/Debian (if openslide library not installed):
# sudo apt-get install openslide-tools python3-openslide

# On macOS:
# brew install openslide
```

### 2. Start the Enhanced Server

```bash
cd /home/alex-mac/slide-viewer
./start.sh
```

The start script automatically detects OpenSlide and uses the enhanced server if available.

### 3. Load a Slide

1. Enter a sample ID (e.g., `BL-13-E42518`)
2. Click "Load Slide"
3. Scroll down to the "Whole Slide Image Viewer" section
4. Click "Load WSI Viewer"

## 🎯 Using the Viewer

### Navigation

**Zoom:**
- Scroll mouse wheel up/down
- Use ➕/➖ buttons
- Double-click to zoom to a point

**Pan:**
- Click and drag to move around
- Use arrow keys (if enabled)

**Reset:**
- Click 🏠 button to return to full slide view
- Click ⛶ for fullscreen mode

### Mini-Map Navigator

The navigator (bottom-right corner) shows:
- Red box: Your current viewport
- Click anywhere: Jump to that region
- Drag the red box: Pan efficiently

### Performance Tips

1. **Initial Load**: First load may take a few seconds
2. **Zooming**: Tiles load on-demand as you zoom
3. **Caching**: Viewed tiles are cached in browser
4. **Network**: Faster on local storage vs network drives

## 📊 Technical Details

### How It Works

1. **Server-Side**:
   - `server_enhanced.py` uses OpenSlide to read SVS/TIFF files
   - Deep Zoom Image (DZI) format generates tiles on-demand
   - Tiles are 254x254 pixels (configurable)
   - Multiple zoom levels (pyramid structure)

2. **Client-Side**:
   - OpenSeadragon loads tiles as you navigate
   - Smooth animations and transitions
   - Optimized for performance

### Supported Formats

OpenSlide supports many whole slide image formats:
- ✅ **Aperio (.svs, .tif)**
- ✅ **Hamamatsu (.ndpi, .vms, .vmu)**
- ✅ **Leica (.scn)**
- ✅ **MIRAX (.mrxs)**
- ✅ **Philips (.tiff)**
- ✅ **Sakura (.svslide)**
- ✅ **Trestle (.tif)**
- ✅ **Ventana (.bif, .tif)**
- ✅ **Generic tiled TIFF**

### File Size Handling

The viewer can handle very large slides:
- **Small** (< 10,000 pixels): Instant loading
- **Medium** (10,000-50,000 pixels): 1-2 seconds
- **Large** (50,000-100,000 pixels): 2-5 seconds
- **Very Large** (> 100,000 pixels): 5-10 seconds

## 🎨 Viewer Configuration

### Adjust Settings in app.js

```javascript
// In initViewer() method
this.viewer = OpenSeadragon({
    // Performance
    animationTime: 0.5,      // Zoom/pan animation duration
    blendTime: 0.1,          // Tile fade-in time
    zoomPerScroll: 1.2,      // Zoom increment per scroll
    
    // Quality
    maxZoomPixelRatio: 2,    // Max zoom level (2 = 200%)
    minZoomLevel: 0.5,       // Min zoom level
    
    // Behavior
    constrainDuringPan: false,  // Allow panning outside bounds
    visibilityRatio: 1,         // How much must be visible
});
```

### Server Configuration

Edit `server_enhanced.py`:

```python
# In get_deepzoom() method
dz = DeepZoomGenerator(
    slide, 
    tile_size=254,    # Tile size (larger = fewer tiles, more memory)
    overlap=1,        // Pixel overlap between tiles
    limit_bounds=False  # Allow viewing beyond slide bounds
)
```

## 🐛 Troubleshooting

### Viewer Doesn't Load

**Problem**: "Failed to load whole slide image"

**Solutions**:
1. Check if OpenSlide is installed: `python3 -c "import openslide"`
2. Verify slide path exists: Check `FILE_PATH` column in CSV
3. Check file permissions: Server must be able to read the file
4. Look at browser console (F12) for specific errors

### Tiles Not Loading

**Problem**: Black tiles or loading errors

**Solutions**:
1. Check server console for errors
2. Verify slide file is not corrupted
3. Try a different slide to isolate the issue
4. Increase server timeout in app.js

### Slow Performance

**Problem**: Viewer is laggy or slow

**Solutions**:
1. **Reduce tile size**: Smaller tiles = faster generation
2. **Check network**: Slow if slide is on network storage
3. **Close other tabs**: Free up browser memory
4. **Use local storage**: Copy slides to local SSD

### Memory Issues

**Problem**: Server crashes or becomes unresponsive

**Solutions**:
1. **Reduce cache size**: Lower `MAX_CACHE_SIZE` in server_enhanced.py
2. **Restart server**: Clears all cached data
3. **Reduce concurrent users**: One viewer per slide at a time

## 📈 Optimization

### For Best Performance

1. **Local Storage**:
   ```bash
   # Copy frequently viewed slides to local SSD
   cp /path/to/network/slide.svs /tmp/slide.svs
   ```

2. **Pregenerate Tiles** (optional):
   ```python
   # Pregenerate all tiles for a slide
   from openslide import OpenSlide
   from openslide.deepzoom import DeepZoomGenerator
   
   slide = OpenSlide('slide.svs')
   dz = DeepZoomGenerator(slide, tile_size=254, overlap=1)
   
   # Generate all tiles (slow but one-time)
   for level in range(dz.level_count):
       for col in range(dz.level_tiles[level][0]):
           for row in range(dz.level_tiles[level][1]):
               tile = dz.get_tile(level, (col, row))
               # Save tile to disk...
   ```

3. **Use Nginx** (production):
   ```nginx
   location /dzi/ {
       proxy_pass http://localhost:8080;
       proxy_cache tiles_cache;
       proxy_cache_valid 200 7d;
   }
   ```

## 🔒 Security Notes

### For Production Use

1. **Validate Paths**: Prevent directory traversal
2. **Limit File Access**: Whitelist allowed directories
3. **Rate Limiting**: Prevent abuse
4. **Authentication**: Require login for sensitive data
5. **HTTPS**: Encrypt all traffic

### Example Path Validation

```python
# In server_enhanced.py
ALLOWED_PATHS = [
    '/mnt/disks/pancancer-pathmolecular/path-images',
    '/path/to/other/slides'
]

def validate_path(slide_path):
    # Resolve to absolute path
    abs_path = os.path.abspath(slide_path)
    
    # Check if in allowed directories
    for allowed in ALLOWED_PATHS:
        if abs_path.startswith(allowed):
            return True
    
    return False
```

## 📚 Advanced Features

### Annotations (Future)

OpenSeadragon supports overlays:
- Draw regions of interest
- Mark areas with annotations
- Export annotations as JSON

### Multi-Channel Viewing

For immunofluorescence slides:
- Toggle individual channels
- Adjust intensity/color
- Overlay multiple stains

### Comparison View

View multiple slides side-by-side:
- Synchronized zooming
- Synchronized panning
- Perfect for comparing stains

## 🎓 Resources

- **OpenSeadragon**: https://openseadragon.github.io/
- **OpenSlide**: https://openslide.org/
- **Deep Zoom**: https://en.wikipedia.org/wiki/Deep_Zoom
- **Digital Pathology**: https://digitalpathologyassociation.org/

## 💡 Tips & Tricks

1. **Keyboard Shortcuts**:
   - `+` / `-`: Zoom in/out
   - Arrow keys: Pan (if enabled)
   - `F`: Fullscreen toggle
   - `Home`: Reset view

2. **Touch Gestures** (on tablets):
   - Pinch: Zoom
   - Two-finger drag: Pan
   - Double-tap: Zoom to point

3. **Bookmarking**:
   - Copy viewer state from console
   - Share specific zoom/pan positions
   - Create tours of interesting regions

## ✅ Quick Checklist

Before using the WSI viewer:

- [ ] OpenSlide installed (`pip install openslide-python`)
- [ ] Enhanced server running (`./start.sh`)
- [ ] Slide file exists (check FILE_PATH in CSV)
- [ ] Slide file readable (check permissions)
- [ ] Browser supports WebGL (modern browsers)
- [ ] Sufficient memory available (2GB+ recommended)

## 🎉 You're Ready!

Start exploring high-resolution pathology slides:

```bash
cd /home/alex-mac/slide-viewer
./start.sh
# Open http://localhost:8080
# Search for: BL-13-E42518
# Click "Load WSI Viewer"
# Zoom and explore!
```

Happy viewing! 🔬✨
