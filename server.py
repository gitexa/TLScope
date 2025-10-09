#!/usr/bin/env python3
"""
Simple HTTP server for the slide viewer application.
Serves files from the slide-viewer directory and provides CORS support.
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import sys


class CORSRequestHandler(SimpleHTTPRequestHandler):
    """HTTP request handler with CORS support"""

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

    def log_message(self, format, *args):
        # Custom logging format
        sys.stdout.write(f"[{self.log_date_time_string()}] {format % args}\n")


def run_server(port=8080, directory=None):
    """Run the HTTP server"""

    if directory:
        os.chdir(directory)

    server_address = ("", port)
    httpd = HTTPServer(server_address, CORSRequestHandler)

    print("=" * 60)
    print("🔬 Pathology Slide Viewer Server")
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
