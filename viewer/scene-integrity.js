// One ownership rule for all dynamic assets. A child is never extracted twice.
export function topMatches(scene,predicate){const found=[];scene.traverse(o=>{if(predicate(o))found.push(o)});const set=new Set(found);return found.filter(o=>{for(let p=o.parent;p;p=p.parent)if(set.has(p))return false;return true;});}
export function attachPreservingWorld(group,objects){for(const o of objects){o.updateWorldMatrix(true,true);if(!o.matrixAutoUpdate){o.matrix.decompose(o.position,o.quaternion,o.scale);o.matrixAutoUpdate=true;}group.attach(o);o.updateMatrix();o.updateMatrixWorld(true);}}
export async function createDoorGeometry(THREE,scene,timeline,stats){
 const config=await fetch('assets/doorways.json').then(r=>r.json()),conv=new THREE.Matrix4().set(1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1),inv=conv.clone().invert(),P=p=>new THREE.Vector3(p[0],p[2],-p[1]),roots=[],defs=[];
 scene.updateMatrixWorld(true);stats.doorGeometry=[];
 for(const d of config.doors){const g=new THREE.Group();g.name='RoutineDoor_'+d.id;g.userData.dynamic=true;scene.add(g);let members=[];
  if(d.kind==='hinge'){
   members=topMatches(scene,o=>o.userData.source_object===d.source);attachPreservingWorld(g,members);
   const A=new THREE.Matrix4().makeTranslation(...d.closedCenter).multiply(new THREE.Matrix4().makeRotationZ(d.sourceToClosedAngle)).multiply(new THREE.Matrix4().makeScale(d.width/d.sourceWidth,1,1)).multiply(new THREE.Matrix4().makeTranslation(...d.sourceCenter.map(x=>-x)));
   const delta=conv.clone().multiply(A).multiply(inv);delta.decompose(g.position,g.quaternion,g.scale);g.updateMatrixWorld(true);
   const pivot=new THREE.Group();pivot.name='RoutineDoorPivot_'+d.id;pivot.position.copy(P(d.pivot));scene.add(pivot);pivot.attach(g);pivot.userData.dynamic=true;roots.push(pivot);defs.push({d,g:pivot});
  }else{
   members=topMatches(scene,o=>{const n=o.userData.source_object||'';return n.startsWith(d.sourcePrefix)&&/SlidingLeaf|Handle|Roller/.test(n)&&!/Fixed/.test(n)});attachPreservingWorld(g,members);roots.push(g);defs.push({d,g});
  }
  stats.doorGeometry.push({door:d.id,members:members.length,sourcePreserved:true,sharedPlannerGeometry:true});
 }
 const events=timeline.navigationDoorEvents||[],ease=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x)};
 function update(t){for(const n of defs){let v=0;for(const e of events){if(e.door!==n.d.id)continue;if(t<e.start)break;const to=e.open?1:0;v=THREE.MathUtils.lerp(v,to,ease((t-e.start)/Math.max(.001,e.end-e.start)));if(t<e.end)break;}if(n.d.kind==='hinge')n.g.rotation.y=n.d.openAngle*v;else n.g.position.copy(P(n.d.openOffset)).multiplyScalar(v);}}
 return{roots,update,defs};
}

// Deliberately layered finish/printed-detail meshes need explicit depth order.
// A 20-micrometre source separation is below practical depth precision in house views.
export function repairSurfaceLayers(scene,stats){stats.depthLayers=[];scene.traverse(o=>{if(!o.isMesh)return;let n=o.userData.source_object;for(let p=o.parent;!n&&p;p=p.parent)n=p.userData.source_object;if(!n?.startsWith('InductionHob__'))return;const detail=/CeramicInk|HeatMark|Induction$|Readout|Minus|Plus|Touch|Glyph|Hands|Boost|PowerStroke/.test(n),glass=n.endsWith('GlassCeramic');if(!detail&&!glass)return;o.material=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const x=m.clone();x.polygonOffset=true;x.polygonOffsetFactor=detail?-2:-1;x.polygonOffsetUnits=detail?-4:-2;return x;})[0];if(detail)o.castShadow=false;stats.depthLayers.push({source:n,layer:detail?'printed_surface':'hob_finish'});});}
