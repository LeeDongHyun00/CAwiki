#!/usr/bin/env python3
"""Downsize existing transparent portraits for the room's distant exhibit LOD.
Requires Pillow only when regenerating; output is served as static WebP.
"""
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
out=root/'assets/inside/room';out.mkdir(exist_ok=True)
for path in sorted((root/'assets/inside/redesign').glob('*.webp')):
 image=Image.open(path).convert('RGBA')
 # Keep the exact framing/alpha padding used by the Wiki and detail image.
 image.thumbnail((512,512),Image.Resampling.LANCZOS)
 image.save(out/path.name,'WEBP',quality=82,method=6)
