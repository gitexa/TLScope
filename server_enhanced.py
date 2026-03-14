#!/usr/bin/env python3
"""
Enhanced slide viewer server with OpenSlide DZI support
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
import os
import sys
import json
import io
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote
import re

try:
    import openslide
    from openslide import OpenSlide
    from openslide.deepzoom import DeepZoomGenerator

    OPENSLIDE_AVAILABLE = True
except ImportError:
    OPENSLIDE_AVAILABLE = False
    print("Warning: openslide-python not installed. WSI viewing will not be available.")
    print("Install with: pip install openslide-python")

from PIL import Image

# Cache for DeepZoomGenerator objects
dz_cache = {}
MAX_CACHE_SIZE = 10

# Tile cache for faster repeated access
tile_cache = {}
MAX_TILE_CACHE_SIZE = 500  # Cache up to 500 tiles in memory


class EnhancedSlideHandler(SimpleHTTPRequestHandler):
    """Enhanced HTTP request handler with DZI support"""

    def end_headers(self):
        # Add CORS headers
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS, POST")
        self.send_header("Access-Control-Allow-Headers", "*")
        
        # Add cache control headers for config and HTML files to prevent caching
        # This ensures the browser always gets the latest version
        path = self.path.split("?")[0]
        if path.endswith(('.html', '.js')) and not path.startswith('/dzi/'):
            # No caching for HTML and JS files (except DZI tiles)
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        
        super().end_headers()

    def translate_path(self, path):
        """Translate URL path to filesystem path, handling absolute paths"""
        # Remove query string
        original_path = path
        path = path.split("?")[0]

        print(f"   [translate_path] Input: {original_path} -> {path}")

        # Check if this looks like an absolute filesystem path (not just a URL path)
        # URL paths like "/" or "/index.html" should use default behavior
        # Only treat as filesystem path if it starts with /mnt/, /home/, etc.
        is_filesystem_path = path.startswith(
            ("/mnt/", "/home/", "/tmp/", "/usr/local/", "/opt/")
        )

        if is_filesystem_path:
            # Normalize path to resolve .. and symlinks for security
            real_path = os.path.realpath(path)

            # Allow absolute paths that start with common mount points
            # This allows /mnt/, /home/, etc. but prevents access to system files
            allowed_prefixes = ("/mnt/", "/home/", "/tmp/", "/usr/local/", "/opt/")

            if any(real_path.startswith(prefix) for prefix in allowed_prefixes):
                # Check if file exists and is readable
                if os.path.exists(real_path) and os.access(real_path, os.R_OK):
                    print(f"   [translate_path] Absolute path allowed: {real_path}")
                    return real_path
                else:
                    print(
                        f"   [translate_path] Absolute path not found or not readable: {real_path}"
                    )
                    return real_path  # Return anyway, let parent handle 404
            else:
                print(
                    f"   [translate_path] Absolute path DENIED (not in allowed prefixes): {real_path}"
                )
                # Return a non-existent path to trigger 404
                return "/dev/null/forbidden"

        # Default behavior: relative to current directory for URL paths
        result = super().translate_path(path)
        print(f"   [translate_path] Using parent translation: {result}")
        return result

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        """Handle GET requests"""
        print(f"\n🔍 [DEBUG] GET Request: {self.path}")

        parsed_path = urlparse(self.path)
        path = parsed_path.path

        # Handle DZI metadata request
        if path.startswith("/dzi/") and path.endswith(".dzi"):
            print(f"🔬 [DEBUG] DZI metadata request")
            if OPENSLIDE_AVAILABLE:
                self.serve_dzi(parsed_path)
            else:
                print(f"❌ [DEBUG] OpenSlide not available")
                self.send_error(501, "OpenSlide not available")
            return

        # Handle tile request
        elif path.startswith("/dzi/") and "_files/" in path:
            if OPENSLIDE_AVAILABLE:
                self.serve_tile(parsed_path)
            else:
                print(f"❌ [DEBUG] OpenSlide not available for tiles")
                self.send_error(501, "OpenSlide not available")
            return

        # Handle slide info request
        elif path.startswith("/slide-info"):
            print(f"📊 [DEBUG] Slide info request")
            if OPENSLIDE_AVAILABLE:
                self.serve_slide_info(parsed_path)
            else:
                print(f"❌ [DEBUG] OpenSlide not available for slide info")
                self.send_error(501, "OpenSlide not available")
            return

        # Handle experiment listing request
        elif path.startswith("/api/list-experiments"):
            self.serve_experiments(parsed_path)
            return

        # Handle attention map info request
        elif path.startswith("/api/attention-map"):
            self.serve_attention_map_info(parsed_path)
            return

        # Handle predictions request
        elif path.startswith("/api/predictions"):
            self.serve_predictions(parsed_path)
            return

        # Handle attention scores request
        elif path.startswith("/api/attention-scores"):
            self.serve_attention_scores(parsed_path)
            return

        # Handle QC mask (downsampled) request
        elif path.startswith("/api/qc-mask"):
            self.serve_qc_mask(parsed_path)
            return

        # Handle all-predictions request (full CSV for experiment-based navigation)
        elif path.startswith("/api/all-predictions"):
            self.serve_all_predictions(parsed_path)
            return

        # Handle other requests normally
        else:
            # Check if file exists
            if path.startswith("/"):
                file_path = path[1:].split("?")[0]  # Remove leading / and query params
                if file_path:
                    full_path = os.path.join(os.getcwd(), file_path)
                    if os.path.exists(full_path):
                        print(f"✅ [DEBUG] File found: {file_path}")
                    else:
                        print(f"❌ [DEBUG] File NOT found: {file_path}")
                        print(f"   Looking in: {os.getcwd()}")
            super().do_GET()

    def serve_experiments(self, parsed_path):
        """List experiment folders in a results base path"""
        try:
            query_params = parse_qs(parsed_path.query)
            results_base = query_params.get("resultsBasePath", [None])[0]
            if not results_base:
                self.send_error(400, "Missing resultsBasePath parameter")
                return
            results_base = unquote(results_base)
            if not os.path.isdir(results_base):
                self.send_json({"experiments": []})
                return
            experiments = sorted([
                entry for entry in os.listdir(results_base)
                if os.path.isdir(os.path.join(results_base, entry))
            ])
            self.send_json({"experiments": experiments})
        except Exception as e:
            print(f"❌ [DEBUG] Error listing experiments: {e}")
            self.send_error(500, str(e))

    def serve_attention_map_info(self, parsed_path):
        """Check if attention map exists for a slide and return available image paths + metadata"""
        try:
            query_params = parse_qs(parsed_path.query)
            results_base = unquote(query_params.get("resultsBasePath", [None])[0] or "")
            experiment   = unquote(query_params.get("experiment", [None])[0] or "")
            analysis_dir = unquote(query_params.get("analysisDir", [None])[0] or "")
            cancer_type  = unquote(query_params.get("cancerType", [None])[0] or "")
            slide_id     = unquote(query_params.get("slideId", [None])[0] or "")

            if not all([results_base, experiment, analysis_dir, cancer_type, slide_id]):
                self.send_json({"available": False, "reason": "Missing parameters"})
                return

            slide_dir = os.path.join(results_base, experiment, analysis_dir,
                                     "attention_maps", cancer_type, slide_id)

            if not os.path.isdir(slide_dir):
                self.send_json({"available": False, "reason": "Attention map folder not found"})
                return

            standard_path   = os.path.join(slide_dir, f"{slide_id}_attention_standard.png")
            smoothed_path   = os.path.join(slide_dir, "plots", "overlay_smoothed.png")
            unsmoothed_path = os.path.join(slide_dir, "plots", "overlay_unsmoothed.png")
            fallback_path   = os.path.join(slide_dir, "plots", "attention_map.png")

            image_path            = next((p for p in [standard_path, smoothed_path, fallback_path] if os.path.isfile(p)), None)
            smoothed_image_path   = smoothed_path   if os.path.isfile(smoothed_path)   else None
            unsmoothed_image_path = unsmoothed_path if os.path.isfile(unsmoothed_path) else None

            # Load metadata if present
            metadata = None
            meta_file = os.path.join(slide_dir, "metadata.json")
            if os.path.isfile(meta_file):
                with open(meta_file) as f:
                    metadata = json.load(f)

            self.send_json({
                "available": image_path is not None,
                "imagePath": image_path,
                "smoothedImagePath": smoothed_image_path,
                "unsmoothedImagePath": unsmoothed_image_path,
                "slideDir": slide_dir,
                "metadata": metadata,
            })
        except Exception as e:
            print(f"❌ [DEBUG] Error in attention-map info: {e}")
            self.send_error(500, str(e))

    def serve_predictions(self, parsed_path):
        """Return predictions row for a specific slide from the predictions CSV"""
        try:
            import csv
            query_params = parse_qs(parsed_path.query)
            results_base  = unquote(query_params.get("resultsBasePath", [None])[0] or "")
            experiment    = unquote(query_params.get("experiment",      [None])[0] or "")
            analysis_dir  = unquote(query_params.get("analysisDir",     [None])[0] or "")
            pred_file     = unquote(query_params.get("predictionsFile", [None])[0] or "")
            slide_id      = unquote(query_params.get("slideId",         [None])[0] or "")

            if not all([results_base, experiment, analysis_dir, pred_file, slide_id]):
                self.send_json({"available": False, "reason": "Missing parameters"})
                return

            csv_path = os.path.join(results_base, experiment, analysis_dir, "predictions", pred_file)
            if not os.path.isfile(csv_path):
                self.send_json({"available": False, "reason": "Predictions file not found", "path": csv_path})
                return

            with open(csv_path, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    for col in ("slide_id", "SAMPLE_ACCESSION", "sample_id", "case"):
                        if col in row and row[col] == slide_id:
                            self.send_json({"available": True, "predictions": dict(row)})
                            return

            self.send_json({"available": False, "reason": "Slide not found in predictions"})
        except Exception as e:
            print(f"❌ [DEBUG] Error in predictions: {e}")
            self.send_error(500, str(e))

    def serve_attention_scores(self, parsed_path):
        """Load attention.npy + coords.npy and return normalized scores as JSON"""
        try:
            import numpy as np
            query_params = parse_qs(parsed_path.query)
            results_base = unquote(query_params.get("resultsBasePath", [None])[0] or "")
            experiment   = unquote(query_params.get("experiment",      [None])[0] or "")
            analysis_dir = unquote(query_params.get("analysisDir",     [None])[0] or "")
            cancer_type  = unquote(query_params.get("cancerType",      [None])[0] or "")
            slide_id     = unquote(query_params.get("slideId",         [None])[0] or "")

            if not all([results_base, experiment, analysis_dir, cancer_type, slide_id]):
                self.send_json({"available": False, "reason": "Missing parameters"})
                return

            slide_dir = os.path.join(results_base, experiment, analysis_dir,
                                     "attention_maps", cancer_type, slide_id)

            attention_path = os.path.join(slide_dir, "attention.npy")
            coords_path    = os.path.join(slide_dir, "coords.npy")

            if not os.path.isfile(attention_path) or not os.path.isfile(coords_path):
                self.send_json({"available": False, "reason": "attention.npy or coords.npy not found"})
                return

            scores = np.load(attention_path).flatten().astype(float)
            coords = np.load(coords_path)

            # Normalize scores to [0, 1] using percentile clipping for better contrast
            p1  = float(np.percentile(scores, 1))
            p99 = float(np.percentile(scores, 99))
            if p99 > p1:
                scores = np.clip((scores - p1) / (p99 - p1), 0.0, 1.0)
            else:
                scores = np.zeros_like(scores)

            self.send_json({
                "available": True,
                "coords": coords.tolist(),
                "scores": scores.tolist(),
                "patchSize": 256,
            })
        except Exception as e:
            print(f"❌ [DEBUG] Error in attention-scores: {e}")
            import traceback; traceback.print_exc()
            self.send_error(500, str(e))

    def serve_qc_mask(self, parsed_path):
        """Serve a downsampled, colorized QC mask PNG"""
        try:
            from PIL import Image
            import numpy as np
            Image.MAX_IMAGE_PIXELS = None

            query_params = parse_qs(parsed_path.query)
            mask_path = unquote(query_params.get("path", [None])[0] or "")
            max_dim   = int(query_params.get("maxDim", ["2048"])[0])

            if not mask_path or not os.path.isfile(mask_path):
                self.send_error(404, "Mask not found")
                return

            # Use draft() to decode at reduced resolution without loading full image
            img = Image.open(mask_path)
            w, h = img.size

            scale = min(max_dim / w, max_dim / h, 1.0)
            if scale < 1.0:
                new_w = max(1, int(w * scale))
                new_h = max(1, int(h * scale))
                # draft() hints to PIL to decode at a reduced size (only works for JPEG/some formats)
                img.draft(img.mode, (new_w, new_h))
                img = img.resize((new_w, new_h), Image.NEAREST)

            arr = np.array(img)
            # If multi-channel (RGB/RGBA), take the first channel as the category value
            if arr.ndim == 3:
                arr = arr[:, :, 0]
            raw_mode = query_params.get("raw", ["0"])[0] == "1"

            if raw_mode:
                # Return raw grayscale (category values) for client-side colorization
                out_img = Image.fromarray(arr, 'L')
            else:
                # Colorize: map category values to RGBA
                COLORS = {
                    1: (76,  175, 80,  255),
                    2: (255, 193, 7,   255),
                    3: (139, 69,  19,  255),
                    4: (233, 30,  99,  255),
                    5: (33,  150, 243, 255),
                    6: (158, 158, 158, 255),
                    7: (245, 245, 245, 255),
                }
                rgba = np.zeros((*arr.shape, 4), dtype=np.uint8)
                for v, color in COLORS.items():
                    rgba[arr == v] = color
                out_img = Image.fromarray(rgba, 'RGBA')
            buf = io.BytesIO()
            out_img.save(buf, 'PNG', optimize=False)
            buf.seek(0)
            data = buf.read()

            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", len(data))
            self.send_header("Cache-Control", "public, max-age=86400")
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            print(f"❌ [DEBUG] Error in qc-mask: {e}")
            import traceback; traceback.print_exc()
            self.send_error(500, str(e))

    def serve_all_predictions(self, parsed_path):
        """Return all rows from a predictions CSV for experiment-based slide navigation"""
        try:
            import csv
            query_params = parse_qs(parsed_path.query)
            results_base  = unquote(query_params.get("resultsBasePath", [None])[0] or "")
            experiment    = unquote(query_params.get("experiment",      [None])[0] or "")
            analysis_dir  = unquote(query_params.get("analysisDir",     [None])[0] or "")
            pred_file     = unquote(query_params.get("predictionsFile", [None])[0] or "")

            if not all([results_base, experiment, analysis_dir, pred_file]):
                self.send_json({"available": False, "reason": "Missing parameters"})
                return

            csv_path = os.path.join(results_base, experiment, analysis_dir, "predictions", pred_file)
            if not os.path.isfile(csv_path):
                self.send_json({"available": False, "reason": "Predictions file not found"})
                return

            rows = []
            with open(csv_path, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    rows.append(dict(row))

            self.send_json({"available": True, "rows": rows})
        except Exception as e:
            print(f"❌ [DEBUG] Error in all-predictions: {e}")
            self.send_error(500, str(e))

    def send_json(self, data):
        """Send a JSON response"""
        body = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def serve_dzi(self, parsed_path):
        """Serve DZI metadata XML"""
        try:
            # Extract slide path from URL
            # Format: /dzi/slide.dzi?path=/full/path/to/slide.svs
            query_params = parse_qs(parsed_path.query)
            slide_path = query_params.get("path", [None])[0]

            print(f"📋 [DEBUG] DZI Request - Query params: {query_params}")

            if not slide_path:
                print(f"❌ [DEBUG] Missing path parameter in DZI request")
                self.send_error(400, "Missing path parameter")
                return

            slide_path = unquote(slide_path)
            print(f"📂 [DEBUG] Decoded slide path: {slide_path}")

            if not os.path.exists(slide_path):
                print(f"❌ [DEBUG] Slide file does not exist: {slide_path}")
                self.send_error(404, f"Slide not found: {slide_path}")
                return

            print(f"✅ [DEBUG] Slide file exists, creating DeepZoom...")
            # Get or create DeepZoomGenerator
            dz = self.get_deepzoom(slide_path)

            # Generate DZI XML
            dzi_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Image xmlns="http://schemas.microsoft.com/deepzoom/2008"
       Format="jpeg"
       Overlap="1"
       TileSize="254">
    <Size Width="{dz.level_dimensions[-1][0]}"
          Height="{dz.level_dimensions[-1][1]}"/>
</Image>"""

            print(
                f"✅ [DEBUG] Serving DZI metadata - Dimensions: {dz.level_dimensions[-1]}"
            )
            self.send_response(200)
            self.send_header("Content-Type", "application/xml")
            self.send_header("Content-Length", len(dzi_xml))
            self.send_header("Cache-Control", "public, max-age=86400")
            self.end_headers()
            self.wfile.write(dzi_xml.encode())

        except Exception as e:
            print(f"❌ [ERROR] Error serving DZI: {e}")
            import traceback

            traceback.print_exc()
            self.send_error(500, f"Error generating DZI: {str(e)}")

    def serve_tile(self, parsed_path):
        """Serve a specific tile"""
        try:
            # Parse URL: /dzi/slide_files/14/0_0.jpeg?path=/full/path/to/slide.svs
            query_params = parse_qs(parsed_path.query)
            slide_path = query_params.get("path", [None])[0]

            if not slide_path:
                print(f"❌ [DEBUG] Missing path parameter in tile request")
                self.send_error(400, "Missing path parameter")
                return

            slide_path = unquote(slide_path)

            if not os.path.exists(slide_path):
                print(f"❌ [DEBUG] Slide not found for tile: {slide_path}")
                self.send_error(404, f"Slide not found: {slide_path}")
                return

            # Parse tile coordinates from path
            # Format: /dzi/slide_files/14/0_0.jpeg
            match = re.search(r"/(\d+)/(\d+)_(\d+)\.(jpeg|jpg)", parsed_path.path)
            if not match:
                print(f"❌ [DEBUG] Invalid tile request format: {parsed_path.path}")
                self.send_error(400, "Invalid tile request format")
                return

            level = int(match.group(1))
            col = int(match.group(2))
            row = int(match.group(3))

            # Only log occasionally to avoid spam (every 10th tile)
            if (col + row) % 10 == 0:
                print(f"🎨 [DEBUG] Serving tile: level={level}, col={col}, row={row}")

            # Check tile cache first
            tile_key = f"{slide_path}:{level}:{col}:{row}"
            global tile_cache

            if tile_key in tile_cache:
                tile_data = tile_cache[tile_key]
            else:
                # Get or create DeepZoomGenerator
                dz = self.get_deepzoom(slide_path)

                # Generate tile
                try:
                    tile_img = dz.get_tile(level, (col, row))
                except Exception as e:
                    print(f"Error getting tile {level}/{col}_{row}: {e}")
                    # Return blank tile instead of error
                    tile_img = Image.new("RGB", (254, 254), color="black")

                # Convert to JPEG with higher compression for network efficiency
                buf = io.BytesIO()
                tile_img.save(buf, "JPEG", quality=75, optimize=True)
                tile_data = buf.getvalue()

                # Cache the tile
                tile_cache[tile_key] = tile_data

                # Limit cache size
                if len(tile_cache) > MAX_TILE_CACHE_SIZE:
                    # Remove oldest entries (simple FIFO)
                    oldest_key = next(iter(tile_cache))
                    tile_cache.pop(oldest_key)

            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", len(tile_data))
            self.send_header("Cache-Control", "public, max-age=86400")
            self.end_headers()
            self.wfile.write(tile_data)

        except Exception as e:
            print(f"❌ [ERROR] Error serving tile: {e}")
            import traceback

            traceback.print_exc()
            self.send_error(500, f"Error generating tile: {str(e)}")

    def serve_slide_info(self, parsed_path):
        """Serve slide metadata"""
        try:
            query_params = parse_qs(parsed_path.query)
            slide_path = query_params.get("path", [None])[0]

            print(f"📊 [DEBUG] Slide info request - Query params: {query_params}")

            if not slide_path:
                print(f"❌ [DEBUG] Missing path parameter in slide-info request")
                self.send_error(400, "Missing path parameter")
                return

            slide_path = unquote(slide_path)
            print(f"📂 [DEBUG] Requesting info for: {slide_path}")

            if not os.path.exists(slide_path):
                print(f"❌ [DEBUG] Slide file not found: {slide_path}")
                self.send_error(404, f"Slide not found: {slide_path}")
                return

            print(f"✅ [DEBUG] Opening slide to get metadata...")
            # Open slide and get info
            slide = OpenSlide(slide_path)

            info = {
                "dimensions": slide.dimensions,
                "level_count": slide.level_count,
                "level_dimensions": slide.level_dimensions,
                "level_downsamples": slide.level_downsamples,
                "properties": dict(slide.properties),
                "vendor": slide.detect_format(slide_path),
            }

            slide.close()

            print(
                f"✅ [DEBUG] Slide info retrieved - Dimensions: {info['dimensions']}, Levels: {info['level_count']}"
            )

            json_data = json.dumps(info, indent=2)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", len(json_data))
            self.end_headers()
            self.wfile.write(json_data.encode())

        except Exception as e:
            print(f"❌ [ERROR] Error serving slide info: {e}")
            import traceback

            traceback.print_exc()
            self.send_error(500, f"Error getting slide info: {str(e)}")

    def get_deepzoom(self, slide_path):
        """Get or create DeepZoomGenerator for a slide"""
        global dz_cache

        cache_key = slide_path

        if cache_key in dz_cache:
            return dz_cache[cache_key]

        # Open slide and create DeepZoomGenerator
        # Use limit_bounds=True for better performance on network storage
        slide = OpenSlide(slide_path)
        dz = DeepZoomGenerator(slide, tile_size=254, overlap=1, limit_bounds=True)

        # Add to cache
        dz_cache[cache_key] = dz

        # Limit cache size
        if len(dz_cache) > MAX_CACHE_SIZE:
            oldest_key = next(iter(dz_cache))
            dz_cache.pop(oldest_key)

        print(f"✅ [DEBUG] Cached DZI for: {os.path.basename(slide_path)}")
        print(f"   Slide dimensions: {slide.dimensions}")
        print(f"   DZI level count: {dz.level_count}")

        return dz

    def log_message(self, format, *args):
        """Custom logging - log all responses with icons"""
        # Convert status code to string (it might be HTTPStatus object)
        status_code = str(args[1]) if len(args) > 1 else "???"

        if status_code == "200":
            icon = "✅"
        elif status_code == "404":
            icon = "❌"
        elif status_code.startswith("5"):
            icon = "💥"
        else:
            icon = "⚠️"

        # Skip logging for tile requests to avoid spam, unless it's an error
        path = str(args[0]) if len(args) > 0 else ""
        if "_files/" in path and status_code == "200":
            return

        sys.stdout.write(f"{icon} [{self.log_date_time_string()}] {format % args}\n")


def run_server(port=8080, directory=None):
    """Run the enhanced server"""

    if directory:
        os.chdir(directory)

    class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
        daemon_threads = True

    server_address = ("", port)
    httpd = ThreadedHTTPServer(server_address, EnhancedSlideHandler)

    print("=" * 70)
    print("🔬 Enhanced Pathology Slide Viewer Server")
    print("=" * 70)
    print(f"Server running at: http://localhost:{port}")
    print(f"Serving directory: {os.getcwd()}")

    if OPENSLIDE_AVAILABLE:
        print("\n✅ OpenSlide support: ENABLED")
        print("   • Deep Zoom Image (DZI) tiling available")
        print("   • Whole slide image viewing enabled")
    else:
        print("\n⚠️  OpenSlide support: DISABLED")
        print("   • Install openslide-python for WSI viewing")

    print("\nPress Ctrl+C to stop the server")
    print("=" * 70)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\nServer stopped.")
        httpd.server_close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run enhanced slide viewer server")
    parser.add_argument(
        "--port", type=int, default=8080, help="Port to run server on (default: 8080)"
    )
    parser.add_argument(
        "--dir",
        type=str,
        default=".",
        help="Directory to serve (default: current directory)",
    )

    args = parser.parse_args()
    run_server(port=args.port, directory=args.dir)
