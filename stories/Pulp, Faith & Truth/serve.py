#!/usr/bin/env python3
"""Serve this folder at http://localhost:8000 so index.html can load the .glb.

Opening index.html straight off the disk won't work: browsers block a file://
page from fetching the model. Run this, then visit http://localhost:8000
"""

import functools
import http.server
import os
import socketserver

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8000

socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(
    ("127.0.0.1", PORT),
    functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT),
) as httpd:
    print(f"Serving {ROOT}\nOpen http://localhost:8000  (ctrl-C to stop)")
    httpd.serve_forever()
