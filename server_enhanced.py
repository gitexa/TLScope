#!/usr/bin/env python3
"""
Enhanced slide viewer server with OpenSlide DZI support
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
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


class EnhancedSlideHandler(SimpleHTTPRequestHandler):
    """Enhanced HTTP request handler with DZI support"""

    def end_headers(self):
        # Add CORS headers
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS, POST")
        self.send_header("Access-Control-Allow-Headers", "*")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        """Handle GET requests"""

        parsed_path = urlparse(self.path)
        path = parsed_path.path

        # Handle DZI metadata request
        if path.startswith("/dzi/") and path.endswith(".dzi"):
            if OPENSLIDE_AVAILABLE:
                self.serve_dzi(parsed_path)
            else:
                self.send_error(501, "OpenSlide not available")
            return

        # Handle tile request
        elif path.startswith("/dzi/") and "_files/" in path:
            if OPENSLIDE_AVAILABLE:
                self.serve_tile(parsed_path)
            else:
                self.send_error(501, "OpenSlide not available")
            return

        # Handle slide info request
        elif path.startswith("/slide-info"):
            if OPENSLIDE_AVAILABLE:
                self.serve_slide_info(parsed_path)
            else:
                self.send_error(501, "OpenSlide not available")
            return

        # Handle other requests normally
        else:
            super().do_GET()

    def serve_dzi(self, parsed_path):
        """Serve DZI metadata XML"""
        try:
            # Extract slide path from URL
            # Format: /dzi/slide.dzi?path=/full/path/to/slide.svs
            query_params = parse_qs(parsed_path.query)
            slide_path = query_params.get("path", [None])[0]

            if not slide_path:
                self.send_error(400, "Missing path parameter")
                return

            slide_path = unquote(slide_path)

            if not os.path.exists(slide_path):
                self.send_error(404, f"Slide not found: {slide_path}")
                return

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

            self.send_response(200)
            self.send_header("Content-Type", "application/xml")
            self.send_header("Content-Length", len(dzi_xml))
            self.send_header("Cache-Control", "public, max-age=86400")
            self.end_headers()
            self.wfile.write(dzi_xml.encode())

        except Exception as e:
            print(f"Error serving DZI: {e}")
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
                self.send_error(400, "Missing path parameter")
                return

            slide_path = unquote(slide_path)

            if not os.path.exists(slide_path):
                self.send_error(404, f"Slide not found: {slide_path}")
                return

            # Parse tile coordinates from path
            # Format: /dzi/slide_files/14/0_0.jpeg
            match = re.search(r"/(\d+)/(\d+)_(\d+)\.(jpeg|jpg)", parsed_path.path)
            if not match:
                self.send_error(400, "Invalid tile request format")
                return

            level = int(match.group(1))
            col = int(match.group(2))
            row = int(match.group(3))

            # Get or create DeepZoomGenerator
            dz = self.get_deepzoom(slide_path)

            # Generate tile
            try:
                tile_img = dz.get_tile(level, (col, row))
            except Exception as e:
                print(f"Error getting tile {level}/{col}_{row}: {e}")
                # Return blank tile instead of error
                tile_img = Image.new("RGB", (dz.tile_size, dz.tile_size), color="black")

            # Convert to JPEG
            buf = io.BytesIO()
            tile_img.save(buf, "JPEG", quality=90)
            tile_data = buf.getvalue()

            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", len(tile_data))
            self.send_header("Cache-Control", "public, max-age=86400")
            self.end_headers()
            self.wfile.write(tile_data)

        except Exception as e:
            print(f"Error serving tile: {e}")
            import traceback

            traceback.print_exc()
            self.send_error(500, f"Error generating tile: {str(e)}")

    def serve_slide_info(self, parsed_path):
        """Serve slide metadata"""
        try:
            query_params = parse_qs(parsed_path.query)
            slide_path = query_params.get("path", [None])[0]

            if not slide_path:
                self.send_error(400, "Missing path parameter")
                return

            slide_path = unquote(slide_path)

            if not os.path.exists(slide_path):
                self.send_error(404, f"Slide not found: {slide_path}")
                return

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

            json_data = json.dumps(info, indent=2)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", len(json_data))
            self.end_headers()
            self.wfile.write(json_data.encode())

        except Exception as e:
            print(f"Error serving slide info: {e}")
            self.send_error(500, f"Error getting slide info: {str(e)}")

    def get_deepzoom(self, slide_path):
        """Get or create DeepZoomGenerator for a slide"""
        global dz_cache

        cache_key = slide_path

        if cache_key in dz_cache:
            return dz_cache[cache_key]

        # Open slide and create DeepZoomGenerator
        slide = OpenSlide(slide_path)
        dz = DeepZoomGenerator(slide, tile_size=254, overlap=1, limit_bounds=False)

        # Add to cache
        dz_cache[cache_key] = dz

        # Limit cache size
        if len(dz_cache) > MAX_CACHE_SIZE:
            oldest_key = next(iter(dz_cache))
            dz_cache.pop(oldest_key)

        print(f"Cached DZI for: {os.path.basename(slide_path)}")

        return dz

    def log_message(self, format, *args):
        """Custom logging - only log non-200 responses"""
        if args[1] != "200":
            sys.stdout.write(f"[{self.log_date_time_string()}] {format % args}\n")


def run_server(port=8080, directory=None):
    """Run the enhanced server"""

    if directory:
        os.chdir(directory)

    server_address = ("", port)
    httpd = HTTPServer(server_address, EnhancedSlideHandler)

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
