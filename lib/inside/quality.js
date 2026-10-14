// Fixed for the session: resizing must not recreate all geometry and textures.
const requested = new URLSearchParams(location.search).get('quality');
const compact = requested === 'low' || (requested !== 'high' &&
  (matchMedia('(pointer: coarse)').matches || innerWidth <= 760));
export const quality = Object.freeze({
  compact,
  coarseGeometry: requested !== 'high',
  still: requested === 'still',
  pixelRatio: compact ? 1 : 1.5,
  textureEdge: compact ? 512 : 1024,
  labelEdge: compact ? 128 : 256,
  targetWidth: compact ? 1024 : 1536,
  targetSamples: compact ? 0 : 2,
  shadows: requested === 'high' && !compact,
});

// Draw in the author's original coordinate system, into a bounded backing store.
// A narrow label used to allocate a 1024 x 6927 texture even when barely visible.
export function textureCanvas(width, height, draw, maxEdge = quality.textureEdge) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  context.scale(canvas.width / width, canvas.height / height);
  draw(context, width, height);
  return canvas;
}

// The film's drawing buffer, including MSAA, is bounded like the room's. A
// 1920 x 1080 CSS viewport at DPR 2 asked for 2880 x 1620 (4.7 MP); a 5K
// display for 8.3 MP. Never below the CSS resolution, which stays the floor.
export const FILM_PIXELS = 4.2e6;
export function filmPixelRatio(width, height, dpr) {
  const cap = Math.min(dpr, quality.pixelRatio);
  return Math.min(cap, Math.max(Math.min(1, dpr), Math.sqrt(FILM_PIXELS / (width * height))));
}

export const segments = (full, low = Math.max(8, Math.round(full / 2))) =>
  quality.coarseGeometry ? low : full;
