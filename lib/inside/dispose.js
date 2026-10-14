// Release a model's GPU resources. Kept apart from the model builders so a view
// that only releases meshes (the relationship room) does not load them.
export function disposeCollectionModel(model){
  const geometries=new Set(),materials=new Set(),textures=new Set(),instanced=[];
  const collect=m=>{if(m.userData.persistent)return;materials.add(m);for(const value of Object.values(m))if(value?.isTexture&&!value.userData.persistent)textures.add(value);};
  model.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)instanced.push(o);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])collect(m);});
  for(const m of model.originalMaterials||[])collect(m);
  // Instance matrices belong to the mesh, not to its geometry.
  instanced.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());
}
