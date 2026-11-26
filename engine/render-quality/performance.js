import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// This module never decimates, rewrites source assets, or changes a material's values.
// Call after every runtime prop/device has been extracted and room layers assigned.
// Original objects remain in the hierarchy; dispose() restores their visibility.
const dynamicName = /Routine|Pivot|Door|Curtain|Blind|Faucet|Tap|Valve|Screen|Display|Speaker|CeilingLight|Downlight|Pendant|LightBulb|Lamp|Vacuum|Washer|Dryer|RiceCooker/i;
const ignoredMaterialKeys = new Set(['id','uuid','name','userData','version','_listeners']);
function materialKey(material) {
  if(!material || material.isNodeMaterial || !(material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) || material.transparent || material.opacity!==1 || material.alphaTest>0 || material.transmission>0 || material.lightMap || material.clippingPlanes?.length || material.userData?.originalEmissiveIntensity !== undefined || material.emissiveMap || (material.emissive && material.emissive.getHex()!==0)) return null;
  if(Object.prototype.hasOwnProperty.call(material,'onBeforeCompile') || Object.prototype.hasOwnProperty.call(material,'customProgramCacheKey')) return null;
  const values=[];
  for(const key of Object.keys(material).sort()){
    if(ignoredMaterialKeys.has(key))continue;
    const value=material[key];
    if(typeof value==='function')continue;
    if(value===null || ['number','boolean','string'].includes(typeof value))values.push([key,value]);
    else if(value?.isTexture)values.push([key,'texture',value.uuid]); // runtime already deduplicates exact texture content + sampling configuration
    else if(value?.toArray)values.push([key,value.toArray()]);
    else if(Array.isArray(value) && value.every(x=>x===null || ['number','boolean','string'].includes(typeof x)))values.push([key,value]);
    else if(key==='defines' && value && Object.values(value).every(x=>['number','boolean','string'].includes(typeof x)))values.push([key,Object.entries(value).sort()]);
    else return null; // unknown custom state must not be silently conflated
  }
  return JSON.stringify(values);
}
function geometryLayout(g){return JSON.stringify([!!g.index,...Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,v.itemSize,v.normalized,v.array?.constructor.name,v.gpuType])]);}
function ancestorInfo(o,world,excluded){let room='',source='';for(let p=o;p&&p!==world;p=p.parent){if(!p.visible)return null;if(excluded.has(p)||p.userData.dynamic||p.userData.routine_prop||p.userData.routine_device||p.userData.runtimeDerived||p.userData.routine_static_batch)return null;const label=[p.name,p.userData.source_root,p.userData.source_object].join(' ');if(dynamicName.test(label))return null;room ||= p.userData.source_room||'';source ||= p.userData.source_root||'';}return {room,source};}
function geometryBytes(g){return Object.values(g.attributes).reduce((n,a)=>n+(a.array?.byteLength||0),0)+(g.index?.array?.byteLength||0);}
export function buildStaticBatches(world,{excludeRoots=[],cellSize=2,maxVertices=250000,maxAddedBytes=256*1024*1024,minMeshes=3,apply=true}={}){
  world.updateMatrixWorld(true);const excluded=new Set(excludeRoots.filter(Boolean)),buckets=new Map(),materialKeys=new Map();
  const stats={schema:'xfamily.lossless-static-batches.1',applied:apply,meshesSeen:0,candidateMeshes:0,mergedSourceMeshes:0,batches:0,drawCallsSavedUpperBound:0,addedGeometryBytes:0,materialGroups:0,invalidatedBatches:0,skipped:{},limits:{cellSize,maxVertices,maxAddedBytes,minMeshes},scope:'Exact existing material state; static opaque geometry only. Draw savings are counts before frustum culling, not a measured GPU speedup.'};
  const skip=reason=>stats.skipped[reason]=(stats.skipped[reason]||0)+1;
  const box=new THREE.Box3(),center=new THREE.Vector3();
  world.traverse(o=>{
    if(!o.isMesh)return;stats.meshesSeen++;
    if(o.isSkinnedMesh||o.isInstancedMesh||o.isBatchedMesh||o.morphTargetInfluences?.length||Array.isArray(o.material)){skip('special_mesh');return;}
    const info=ancestorInfo(o,world,excluded);if(!info){skip('dynamic_or_hidden');return;}
    const g=o.geometry;if(!g?.attributes.position||g.morphAttributes.position?.length||g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.values(g.attributes).some(a=>a.isInterleavedBufferAttribute)||o.matrixWorld.determinant()<=0){skip('nonstandard_geometry');return;}
    if(['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'].some(k=>Object.prototype.hasOwnProperty.call(o,k))){skip('custom_callback');return;}
    if(!materialKeys.has(o.material))materialKeys.set(o.material,materialKey(o.material));const mk=materialKeys.get(o.material);if(mk===null){skip('dynamic_or_custom_material');return;}
    g.computeBoundingBox();box.copy(g.boundingBox).applyMatrix4(o.matrixWorld);box.getCenter(center);
    const spatial=[center.x,center.y,center.z].map(v=>Math.floor(v/cellSize));
    const key=JSON.stringify([info.room,o.layers.mask,o.castShadow,o.receiveShadow,o.renderOrder,spatial,geometryLayout(g),mk]);
    if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);stats.candidateMeshes++;
  });
  stats.materialGroups=new Set([...materialKeys.values()].filter(x=>x!==null)).size;
  const records=[];
  function addBatch(meshes){
    if(meshes.length<minMeshes)return;
    const bytes=meshes.reduce((n,m)=>n+geometryBytes(m.geometry),0);
    if(stats.addedGeometryBytes+bytes>maxAddedBytes){skip('memory_budget');return;}
    stats.mergedSourceMeshes+=meshes.length;stats.batches++;stats.drawCallsSavedUpperBound+=meshes.length-1;stats.addedGeometryBytes+=bytes;
    if(!apply)return;
    const geometries=meshes.map(m=>{const g=m.geometry.clone();g.applyMatrix4(m.matrixWorld);g.clearGroups();return g;});
    const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
    if(!geometry){skip('merge_rejected');return;}
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const reference=meshes[0],batch=new THREE.Mesh(geometry,reference.material);
    batch.name='StaticRenderBatch_'+records.length;batch.layers.mask=reference.layers.mask;batch.castShadow=reference.castShadow;batch.receiveShadow=reference.receiveShadow;batch.renderOrder=reference.renderOrder;batch.matrixAutoUpdate=false;batch.userData={routine_static_batch:true,source_room:reference.userData.source_room||'',source_mesh_count:meshes.length};
    const originals=meshes.map(m=>({mesh:m,parent:m.parent,visibility:m.visible,matrix:m.matrixWorld.clone(),material:m.material}));
    world.add(batch);batch.updateMatrixWorld(true);for(const m of meshes)m.visible=false;
    records.push({batch,originals,active:true});
  }
  for(const meshes of buckets.values()){let chunk=[],vertices=0;for(const m of meshes){const n=m.geometry.attributes.position.count;if(chunk.length&&vertices+n>maxVertices){addBatch(chunk);chunk=[];vertices=0;}chunk.push(m);vertices+=n;}addBatch(chunk);}
  function restore(record){if(!record.active)return;record.batch.removeFromParent();record.batch.geometry.dispose();for(const r of record.originals)r.mesh.visible=r.visibility;record.active=false;stats.invalidatedBatches++;}
  return {
    stats,
    // Cheap movement safeguard; call after updating object/world matrices, before render.
    validateTransforms(){for(const record of records){if(!record.active)continue;for(const r of record.originals){if(r.mesh.parent!==r.parent||!r.mesh.matrixWorld.equals(r.matrix)||r.mesh.material!==r.material||r.mesh.visible){restore(record);break;}}}return stats;},
    // Recheck after a material/light-map configuration change, not necessarily every frame.
    validateMaterials(){for(const record of records){if(!record.active)continue;const key=materialKey(record.batch.material);if(key===null||record.originals.some(r=>materialKey(r.mesh.material)!==key))restore(record);}return stats;},
    dispose(){for(const record of records)restore(record);},
  };
}

export function renderBudgetSnapshot(renderer){
  const i=renderer.info;
  return {backend:renderer.backend.isWebGPUBackend?'webgpu':'webgl',compatibilityMode:renderer.backend.compatibilityMode??null,pixelRatio:renderer.getPixelRatio(),size:renderer.getSize(new THREE.Vector2()).toArray(),render:structuredClone(i.render),memory:structuredClone(i.memory),gpuTimestampAvailable:renderer.hasFeature?.('timestamp-query')??false,scope:'Renderer info counters; timestamp values require trackTimestamp at renderer creation and resolveTimestampsAsync. Queue-completion wall time is not isolated GPU timing.'};
}

/** Three r187 instance-level adaptation; no vendor file modification.
 * ReflectorBaseNode normally sizes from the full canvas even when rendering a tile RT.
 * This hook runs before it binds the reflection target, so getRenderTarget() is the
 * actual source camera's target. Per-camera RT ownership/update frequency is unchanged.
 */
export function installPerViewReflectorBudget(reflectorNode,{scale=.5,minSize=64,maxSize=1024}={}){
  const base=reflectorNode?.reflector;
  if(THREE.REVISION!=='187'||!base||typeof base._updateResolution!=='function')throw new Error('Reflector sizing adapter requires the audited Three r187 ReflectorBaseNode API.');
  const original=base._updateResolution,bufferSize=new THREE.Vector2(),stats={calls:0,last:null,scope:'Reflection dimensions follow the source camera RT; separate camera reflection targets and RENDER updates are retained.'};
  const ratio=THREE.MathUtils.clamp(scale,.1,1),lower=Math.max(1,minSize),upper=Math.max(lower,maxSize);
  base._updateResolution=function(reflectionTarget,renderer){
    const source=renderer.getRenderTarget();let width,height;
    if(source&&source!==reflectionTarget){width=source.width;height=source.height;}else{renderer.getDrawingBufferSize(bufferSize);width=bufferSize.x;height=bufferSize.y;}
    // Preserve aspect; cap the largest dimension without independently clamping axes.
    let factor=ratio;factor=Math.min(factor,upper/Math.max(width,height));factor=Math.max(factor,Math.min(1,lower/Math.min(width,height)));
    const w=Math.max(1,Math.round(width*factor)),h=Math.max(1,Math.round(height*factor));
    reflectionTarget.setSize(w,h);stats.calls++;stats.last={sourceWidth:width,sourceHeight:height,width:w,height:h,scale:factor,offscreenSource:!!source};
  };
  return {stats,dispose(){base._updateResolution=original;}};
}
