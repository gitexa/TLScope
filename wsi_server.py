#!/usr/bin/env python3
"""
DZI Tile Server for Whole Slide Images
Serves Deep Zoom Image tiles for OpenSeadragon viewer
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import sys
import json
import io
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import hashlib

try:
    import openslide
    from openslide import OpenSlide
    from openslide.deepzoom import DeepZoomGenerator
except ImportError:
    print("Error: openslide-python not installed")
    print("Install with: pip install openslide-python")
    sys.exit(1)

from PIL import Image

# Cache for DeepZoomGenerator objects
dz_cache = {}
MAX_CACHE_SIZE = 10


class WSITileHandler(SimpleHTTPRequestHandler):
    """HTTP request handler for WSI tiles"""

    def end_headers(self):
        # Add CORS headers
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "public, max-age=86400")  # Cache for 1 day
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        """Handle GET requests for tiles and DZI metadata"""

        parsed_path = urlparse(self.path)
        path = parsed_path.path

        # Handle DZI metadata request
        if path.endswith(".dzi"):
            self.serve_dzi(parsed_path)

        # Handle tile request
        elif "_files/" in path:
            self.serve_tile(parsed_path)

        # Handle other requests (HTML, JS, CSS, etc.)
        else:
            super().do_GET()

    def serve_dzi(self, parsed_path):
        """Serve DZI metadata XML"""
        try:
            # Get slide path from query parameter
            query_params = parse_qs(parsed_path.query)
            slide_path = query_params.get("path", [None])[0]

            if not slide_path or not os.path.exists(slide_path):
                self.send_error(404, f"Slide not found: {slide_path}")
                return

            # Get or create DeepZoomGenerator
            dz = self.get_deepzoom(slide_path)

            # Generate DZI XML
            dzi_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Image xmlns="http://schemas.microsoft.com/deepzoom/2008"
       Format="jpeg"
       Overlap="1"
       TileSize="{dz.tile_size}">
    <Size Width="{dz.level_dimensions[-1][0]}"
          Height="{dz.level_dimensions[-1][1]}"/>
</Image>"""

            self.send_response(200)
            self.send_header("Content-Type", "application/xml")
            self.send_header("Content-Length", len(dzi_xml))
            self.end_headers()
            self.wfile.write(dzi_xml.encode())

        except Exception as e:
            print(f"Error serving DZI: {e}")
            self.send_error(500, f"Error generating DZI: {str(e)}")

    def serve_tile(self, parsed_path):
        """Serve a specific tile"""
        try:
            # Parse tile request: /slide_files/level/col_row.jpeg
            query_params = parse_qs(parsed_path.query)
            slide_path = query_params.get("path", [None])[0]

            if not slide_path or not os.path.exists(slide_path):
                self.send_error(404, f"Slide not found: {slide_path}")
                return

            # Parse tile coordinates from path
            # Format: /slide_files/14/0_0.jpeg
            parts = parsed_path.path.split("/")
            level = int(parts[-2])
            tile_name = parts[-1].replace(".jpeg", "").replace(".jpg", "")
            col, row = map(int, tile_name.split("_"))

            # Get or create DeepZoomGenerator
            dz = self.get_deepzoom(slide_path)

            # Generate tile
            tile_img = dz.get_tile(level, (col, row))

            # Convert to JPEG
            buf = io.BytesIO()
            tile_img.save(buf, "JPEG", quality=90)
            tile_data = buf.getvalue()

            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", len(tile_data))
            self.end_headers()
            self.wfile.write(tile_data)

        except Exception as e:
            print(f"Error serving tile: {e}")
            self.send_error(500, f"Error generating tile: {str(e)}")

    def get_deepzoom(self, slide_path):
        """Get or create DeepZoomGenerator for a slide"""
        global dz_cache

        # Use slide path as cache key
        cache_key = slide_path

        if cache_key in dz_cache:
            return dz_cache[cache_key]

        # Open slide and create DeepZoomGenerator
        slide = OpenSlide(slide_path)
        dz = DeepZoomGenerator(slide, tile_size=254, overlap=1)

        # Add to cache
        dz_cache[cache_key] = dz

        # Limit cache size
        if len(dz_cache) > MAX_CACHE_SIZE:
            # Remove oldest entry
            dz_cache.pop(next(iter(dz_cache)))

        return dz

    def log_message(self, format, *args):
        """Custom logging"""
        # Only log errors
        if args[1] != "200":
            sys.stdout.write(f"[{self.log_date_time_string()}] {format % args}\n")


def run_server(port=8080, directory=None):
    """Run the tile server"""

    if directory:
        os.chdir(directory)

    server_address = ("", port)
    httpd = HTTPServer(server_address, WSITileHandler)

    print("=" * 60)
    print("🔬 WSI Tile Server (OpenSeadragon)")
    print("=" * 60)
    print(f"Server running at: http://localhost:{port}")
    print(f"Serving directory: {os.getcwd()}")
    print("\nSupports Deep Zoom Image (DZI) tiling for:")
    print("  • SVS files")
    print("  • TIFF files")
    print("  • NDPI files")
    print("  • And other OpenSlide formats")
    print("\nPress Ctrl+C to stop the server")
    print("=" * 60)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\nServer stopped.")
        httpd.server_close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Run WSI tile server for OpenSeadragon"
    )
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
