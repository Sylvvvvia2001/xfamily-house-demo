// Project-local PBR derivatives. The shared glTF geometry and source Blender House stay untouched.
export async function createMaterialQuality(THREE, stats) {
 const manifest=await fetch('../materials/quality-textures.json',{cache:'no-store'}).then(r=>r.json());
 const loader=new THREE.TextureLoader(), images=new Map(), textures=new Map(), applied=new WeakMap();
 stats.materialQuality={schema:'source-slot-fidelity-03',mapsApplied:0,materials:0,failed:[],unmapped:[],sourceMaps:manifest.image_count,networkMB:manifest.network_mb,estimatedDecodedMipMB:manifest.decoded_rgba_mip_mb,uniqueTextures:0,coverage:manifest.coverage,sourceBindingUnresolved:manifest.unresolved_source?.length||0,sourceGapRepairs:[]};
 const summary=stats.materialQuality;
 async function texture(rule,field,old,fallback){
  const color=field==='map',imageKey=rule.path+'|'+color;
  if(!images.has(imageKey))images.set(imageKey,loader.loadAsync(new URL(rule.path,new URL("../materials/",location.href)).href).then(t=>{t.flipY=false;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=8;return t;}));
  const basis=rule.baked?null:(old||fallback),sampling={wrapS:basis?.wrapS??THREE.RepeatWrapping,wrapT:basis?.wrapT??THREE.RepeatWrapping,channel:basis?.channel??rule.uv??0,rotation:basis?.rotation??0,offset:basis?.offset.toArray()??[0,0],repeat:basis?.repeat.toArray()??[1,1],center:basis?.center.toArray()??[0,0]};
  if(rule.udim_atlas){sampling.wrapS=sampling.wrapT=THREE.ClampToEdgeWrapping;sampling.offset=[0,0];sampling.repeat=rule.uv_scale;sampling.rotation=0;}
  const key=imageKey+'|'+JSON.stringify(sampling);
  if(!textures.has(key))textures.set(key,images.get(imageKey).then(source=>{
   const t=source.clone();t.source=source.source;t.wrapS=sampling.wrapS;t.wrapT=sampling.wrapT;t.channel=sampling.channel;t.rotation=sampling.rotation;t.offset.fromArray(sampling.offset);t.repeat.fromArray(sampling.repeat);t.center.fromArray(sampling.center);t.needsUpdate=true;summary.uniqueTextures++;return t;
  }));
  return textures.get(key);
 }
 function properties(m,rule){
  const p=rule.source_principled||{},legacy=rule.legacy_pbr;
  if(rule.source_base_constant&&!rule.map)m.color.fromArray(rule.source_base_constant);
  if(p.Roughness!==undefined&&!rule.roughnessMap)m.roughness=p.Roughness;
  if(p.Metallic!==undefined&&!rule.metalnessMap)m.metalness=p.Metallic;
  if(m.isMeshPhysicalMaterial){
   for(const [src,dst] of [['IOR','ior'],['Sheen Weight','sheen'],['Sheen Roughness','sheenRoughness'],['Coat Weight','clearcoat'],['Coat Roughness','clearcoatRoughness'],['Transmission Weight','transmission']])if(p[src]!==undefined)m[dst]=p[src];
  }
  if(legacy){for(const [k,v]of Object.entries(legacy))m[k]=v;if(legacy.transmission){m.transparent=true;m.opacity=1;m.depthWrite=false;}}
 }
 async function apply(root){
  const refs=new Map();root.traverse(o=>{if(!o.isMesh)return;let sourceName=o.userData.source_object;for(let p=o.parent;p&&!sourceName;p=p.parent)sourceName=p.userData.source_object;for(let [i,m]of (Array.isArray(o.material)?o.material:[o.material]).entries()){if(!m.name&&manifest.object_material_fallbacks?.[sourceName]){m=m.clone();m.name='RuntimeRepair__'+sourceName;m.userData.sourceMaterialRepair=sourceName;if(Array.isArray(o.material))o.material[i]=m;else o.material=m;summary.sourceGapRepairs.push({object:sourceName,reason:'Source material slot unassigned; reused adjacent material on same asset.'});}if(!refs.has(m))refs.set(m,[]);refs.get(m).push([o,i]);}});
  const list=[...refs];let cursor=0;
  async function worker(){while(cursor<list.length){
   const [original,uses]=list[cursor++];
   if(applied.has(original)){const replacement=applied.get(original);if(replacement!==original)for(const[o,i]of uses){if(Array.isArray(o.material))o.material[i]=replacement;else o.material=replacement;}continue;}
   const rule=manifest.materials[original.name]||manifest.object_material_fallbacks?.[original.userData.sourceMaterialRepair];
   if(!rule){summary.unmapped.push(original.name);applied.set(original,original);continue;}
   let m=original;
   if(!m.isMeshPhysicalMaterial&&(rule.legacy_pbr?.transmission||rule.source_principled?.['Sheen Weight']>0||rule.source_principled?.['Coat Weight']>0)){
    m=new THREE.MeshPhysicalMaterial();THREE.MeshStandardMaterial.prototype.copy.call(m,original);m.defines={STANDARD:'',PHYSICAL:''};m.name=original.name;
    for(const[o,i]of uses){if(Array.isArray(o.material))o.material[i]=m;else o.material=m;}
   }
   const old={map:m.map,normalMap:m.normalMap,roughnessMap:m.roughnessMap,metalnessMap:m.metalnessMap,aoMap:m.aoMap,bumpMap:m.bumpMap};
   properties(m,rule);
   for(const field of ['map','normalMap','roughnessMap','metalnessMap','aoMap','bumpMap']){
    const r=rule[field];if(!r)continue;
    try{
     m[field]=await texture(r,field,old[field],old.map);
     // Baked color is the final shader output, so it must not be tinted a second time.
     if(field==='map'&&(r.baked||r.udim_atlas||r.source_udim_tile))m.color.setRGB(1,1,1);
     if(field==='roughnessMap')m.roughness=1;
     if(field==='metalnessMap')m.metalness=1;
     if(field==='bumpMap')m.bumpScale=.006;
     if(field==='normalMap'&&r.baked){m.normalScale.set(1,1);m.bumpMap=null;}
     summary.mapsApplied++;
    }catch(e){summary.failed.push({material:m.name,channel:field,error:String(e)});}
   }
   m.envMapIntensity=.8;m.userData.sourceMaterial=rule.source_material;m.userData.materialFidelity='source-slot-fidelity-03';m.needsUpdate=true;applied.set(original,m);applied.set(m,m);summary.materials++;
  }}
  await Promise.all(Array.from({length:5},worker));
 }
 return {apply,manifest};
}
