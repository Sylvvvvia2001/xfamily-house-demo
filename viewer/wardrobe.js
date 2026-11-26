// Reuse the retained door fixture's exact geometric partition, in House coordinates.
export async function splitWardrobeDoors(THREE,scene){
 const f=await fetch('assets/wardrobe-articulation.json').then(r=>r.json()),W=new THREE.Matrix4().set(...f.world_to_fixture.flat()),V=new THREE.Vector3(),convert=new THREE.Matrix4().set(1,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,1);
 const leaves=f.meshes.filter(x=>['wardrobe_left','wardrobe_right'].includes(x.source)),counts={};scene.updateMatrixWorld(true);const source=[];
 scene.traverse(o=>{if(o.isMesh&&o.userData.source_object==='W03_01__defaultMaterial')source.push(o)});
 for(const o of source){let remaining=Array.from(o.geometry.index?.array||Array.from({length:o.geometry.attributes.position.count},(_,i)=>i));
  for(const leaf of leaves){const selected=[],keep=[],[lo,hi]=leaf.bounds,inside=i=>{V.fromBufferAttribute(o.geometry.attributes.position,i).applyMatrix4(o.matrixWorld).applyMatrix4(convert).applyMatrix4(W);return V.x>=lo[0]-.002&&V.x<=hi[0]+.002&&V.y>=lo[1]-.002&&V.y<=hi[1]+.002&&V.z>=lo[2]-.002&&V.z<=hi[2]+.002};for(let k=0;k<remaining.length;k+=3){const tri=remaining.slice(k,k+3);(tri.every(inside)?selected:keep).push(...tri);}remaining=keep;
   if(selected.length){const geo=o.geometry.clone();geo.setIndex(selected);geo.clearGroups();geo.computeBoundingBox();geo.computeBoundingSphere();const mesh=new THREE.Mesh(geo,o.material);mesh.name=leaf.source;mesh.userData={...o.userData,source_object:leaf.source};mesh.matrixAutoUpdate=false;mesh.matrix.copy(o.matrixWorld);scene.add(mesh);mesh.castShadow=true;mesh.receiveShadow=true;counts[leaf.source]=selected.length/3;}}
  o.geometry=o.geometry.clone();o.geometry.setIndex(remaining);o.geometry.clearGroups();o.geometry.computeBoundingSphere();}
 const pivot=new THREE.Vector3(...f.hinge).applyMatrix4(W.clone().invert());const right=leaves.find(x=>x.source==='wardrobe_right'),rp=new THREE.Vector3(right.bounds[1][0]-.005,f.hinge[1],f.hinge[2]).applyMatrix4(W.clone().invert());return {counts,pivot:pivot.toArray(),rightPivot:rp.toArray()};
}
