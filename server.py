#!/usr/bin/env python3
"""
Simple HTTP server for the slide viewer application.
Serves files from the slide-viewer directory and provides CORS support.
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import sys
import json
from urllib.parse import urlparse, parse_qs, unquote


class CORSRequestHandler(SimpleHTTPRequestHandler):
    """HTTP request handler with CORS support"""

    def translate_path(self, path):
        """Translate URL path to filesystem path, handling absolute paths"""
        # Remove query string
        original_path = path
        path = path.split('?')[0]
        
        print(f"   [translate_path] Input: {original_path} -> {path}")
        
        # Check if this looks like an absolute filesystem path
        # If path starts with /mnt/, /home/, etc., treat as absolute
        if path.startswith('/mnt/') or path.startswith('/home/') or path.startswith('/tmp/') or path.startswith('/usr/') or path.startswith('/var/') or path.startswith('/opt/'):
            # It's already an absolute path, return as-is
            print(f"   [translate_path] Detected absolute path, returning: {path}")
            return path
        
        # Default behavior: relative to current directory
        result = super().translate_path(path)
        print(f"   [translate_path] Using parent translation: {result}")
        return result

    def end_headers(self):
        # Add CORS headers
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        """Handle GET requests with debugging"""
        print(f"\n🔍 [DEBUG] GET Request: {self.path}")

        parsed_path = urlparse(self.path)
        path = parsed_path.path

        # Handle experiment listing request
        if path.startswith("/api/list-experiments"):
            self.serve_experiments(parsed_path)
            return

        # Handle attention map info request
        if path.startswith("/api/attention-map"):
            self.serve_attention_map_info(parsed_path)
            return

        # Translate path to see what file we're looking for
        translated_path = self.translate_path(self.path)
        print(f"   [do_GET] Translated to: {translated_path}")

        if os.path.exists(translated_path):
            print(f"✅ [DEBUG] File found: {translated_path}")
        else:
            print(f"❌ [DEBUG] File NOT found: {translated_path}")
            print(f"   Looking in: {os.getcwd()}")

        # Call parent implementation
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

            candidates = [
                os.path.join(slide_dir, f"{slide_id}_attention_standard.png"),
                os.path.join(slide_dir, "plots", "overlay_smoothed.png"),
                os.path.join(slide_dir, "plots", "attention_map.png"),
            ]
            image_path = next((p for p in candidates if os.path.isfile(p)), None)

            metadata = None
            meta_file = os.path.join(slide_dir, "metadata.json")
            if os.path.isfile(meta_file):
                with open(meta_file) as f:
                    metadata = json.load(f)

            self.send_json({
                "available": image_path is not None,
                "imagePath": image_path,
                "slideDir": slide_dir,
                "metadata": metadata,
            })
        except Exception as e:
            print(f"❌ [DEBUG] Error in attention-map info: {e}")
            self.send_error(500, str(e))

    def send_json(self, data):
        """Send a JSON response"""
        body = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)
    
    def log_message(self, format, *args):
        # Custom logging format - log all requests
        # Convert status code to string (it might be HTTPStatus object)
        status_code = str(args[1]) if len(args) > 1 else '???'
        if status_code == '200':
            icon = '✅'
        elif status_code == '404':
            icon = '❌'
        else:
            icon = '⚠️'
        sys.stdout.write(f"{icon} [{self.log_date_time_string()}] {format % args}\n")


def run_server(port=8080, directory=None):
    """Run the HTTP server"""

    if directory:
        os.chdir(directory)

    server_address = ("", port)
    httpd = HTTPServer(server_address, CORSRequestHandler)

    print("=" * 60)
    print("🔬 TLScope Server")
    print("=" * 60)
    print(f"Server running at: http://localhost:{port}")
    print(f"Serving directory: {os.getcwd()}")
    print("\nPress Ctrl+C to stop the server")
    print("=" * 60)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\nServer stopped.")
        httpd.server_close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run slide viewer HTTP server")
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
