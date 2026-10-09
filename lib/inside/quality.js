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

export const segments = (full, low = Math.max(8, Math.round(full / 2))) =>
  quality.coarseGeometry ? low : full;
