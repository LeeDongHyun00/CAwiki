#!/usr/bin/env python3
"""Encode the served Wiki portraits from the lossless renders.

render-hardware-portraits.py writes lossless masters to assets/models/redesign.
The list, dialogs and details serve lossy WebP: 1152 px for large and high-DPI
slots, 576 px for small phone cells (srcset). Room previews are built from the
same masters by build_room_previews.py. Run build_inside_manifest.py afterwards.
Requires Pillow.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MASTERS = ROOT / 'assets/models/redesign'
OUT = ROOT / 'assets/inside/redesign'
# q88 keeps brushed-metal grain; mean error on the list background is ~0.3/255.
QUALITY = 88
(OUT / '576').mkdir(parents=True, exist_ok=True)
for master in sorted(MASTERS.glob('*.webp')):
    image = Image.open(master).convert('RGBA')
    image.save(OUT / master.name, 'WEBP', quality=QUALITY, method=6)
for served in sorted(OUT.glob('*.webp')):
    # Downscale the master to avoid a second lossy pass; usb.webp has none
    # (build_principle_usb.py writes it here directly).
    master = MASTERS / served.name
    image = Image.open(master if master.exists() else served).convert('RGBA')
    image.resize((image.width // 2, image.height // 2), Image.Resampling.LANCZOS).save(OUT / '576' / served.name, 'WEBP', quality=QUALITY, method=6)
    print(served.name, served.stat().st_size // 1024, 'KB /', (OUT / '576' / served.name).stat().st_size // 1024, 'KB', flush=True)
