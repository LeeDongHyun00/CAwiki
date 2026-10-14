// Three r170 compileAsync polls material.currentProgram without checking whether
// dispose()/context restoration removed it. A route cancellation can otherwise
// throw from its timer and leave the preparation promise unresolved forever.
// Keep the vendor unchanged; isolate the r170 property access in this adapter.
async function compilePrograms(renderer, scene, camera, isCurrent, lightingScene, materials) {
  const context = renderer.getContext();
  if (context.isContextLost() || !isCurrent()) return false;
  for (const material of renderer.compile(scene, camera, lightingScene)) materials.add(material);
  if (!renderer.extensions.has('KHR_parallel_shader_compile')) return true;
  while (isCurrent() && !context.isContextLost()) {
    let pending = false;
    for (const material of materials) {
      const program = renderer.properties.get(material).currentProgram;
      // A disposed material or a restored context no longer owns this program.
      if (!program) return false;
      if (!program.isReady()) pending = true;
    }
    if (!pending) return true;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  return false;
}
export async function preparePrograms(renderer, scene, camera, isCurrent = () => true, lightingScene = scene) {
  const materials = new Set();
  if (!await compilePrograms(renderer, scene, camera, isCurrent, lightingScene, materials)) return false;
  // Three deletes a program's shader objects and reads its uniforms on first
  // use. Do it now: the first draw is cheaper, and a prepared variant that is
  // never drawn no longer keeps its shaders after the program is released.
  for (const material of materials) renderer.properties.get(material).currentProgram?.getUniforms();
  return true;
}
