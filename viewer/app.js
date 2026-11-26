import './assets.js';
import {bindShortPauses,bindShortPauseProps} from './short-pauses.js';
import {topMatches,attachPreservingWorld,createDoorGeometry,repairSurfaceLayers} from './scene-integrity.js?v=native-motion-04';
import {splitWardrobeDoors} from './wardrobe.js';
import {createSequenceRuntime as defaultSequenceRuntime} from './sequence-runtime.js?v=registered-contact-01';

import {createHouseLighting} from './lighting.js?v=native-motion-04';
import {createDeviceDashboard} from './device-dashboard.js?v=native-motion-04';
import {createMaterialQuality} from './material-quality.js?v=native-motion-04';
import {createRoutineDetails} from './runtime-details.js?v=stove-tv-01';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildStaticBatches } from '../engine/render-quality/performance.js';
const $=id=>document.getElementById(id),P=a=>new THREE.Vector3(a[0],a[2],-a[1]),ease=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x)},clock=t=>new Date((t%86400)*1000).toISOString().slice(11,19)+(t>=86400?' +1d':''),nice=s=>String(s??'').replaceAll('_',' '),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params = new URLSearchParams(location.search);
const {days: publishedDays, additionalDates = []} = await fetch('day-catalog.json', {cache:'no-cache'}).then(r => {
 if (!r.ok) throw Error('The published day list is unavailable.');
 return r.json();
});
const participant = params.get('participant') || Object.keys(publishedDays)[0];
const releases = [...Object.entries(publishedDays).map(([id,day])=>({...day,participant:id})), ...additionalDates];
const requestedDate = params.get('date');
const selectedDay = releases.find(day=>day.participant===participant && (!requestedDate || day.date===requestedDate));
if (!selectedDay) {
 $('loading').textContent = 'No published House playback for '+participant+'.';
 throw Error($('loading').textContent);
}
const createSequenceRuntime = selectedDay.runtimeModule ? (await import(new URL(selectedDay.runtimeModule+'?v=portable-objects-02',location.href))).createSequenceRuntime : defaultSequenceRuntime;
const dayBase = selectedDay.base+'days/'+participant+'/';
const dayPicker = $('participant');
dayPicker.replaceChildren(...releases.map(day=>new Option(day.participant+' · '+day.date,day.participant+'@'+day.date)));
dayPicker.value = participant+'@'+selectedDay.date;
$('participant-label').textContent = participant;
dayPicker.onchange = () => {
 const u = new URL(location.href);
 const [id,date] = dayPicker.value.split('@');
 u.searchParams.set('participant',id);
 u.searchParams.set('date',date);
 u.searchParams.delete('t');
 u.searchParams.set('view',$('free-mode').classList.contains('active')?'free':'cameras');
 location.href=u.href;
};
const stats={visualVersion:4,participant,errors:[],sourceHouse:'v102',sourceWindow:['06:00:00','03:00:00 +1d'],ready:false};window.review={stats};window.addEventListener('error',e=>stats.errors.push(e.message));window.addEventListener('unhandledrejection',e=>{$('loading').textContent=String(e.reason);stats.errors.push(String(e.reason));});
const [motion,data,house]=await Promise.all([dayBase+'motion.json',dayBase+'timeline.json','../house/analysis/house-export.json'].map(x=>fetch(x,{cache:'no-cache'}).then(r=>r.json())));if (data.participant!==participant || data.date!==selectedDay.date) throw Error('Participant or date mismatch in compiled playback.');$('date-label').textContent=data.date+' · HOUSE V102'+(selectedDay.status==='diagnostic_preview'?' · Diagnostic preview':'');$('sequence-link').href=selectedDay.sequence;$('timeline-link').href=selectedDay.sequence+'#devices';$('execution-link').href=selectedDay.executionDetails;const scene=new THREE.Scene();scene.background=new THREE.Color('#b7c2c7');const renderer=new THREE.WebGPURenderer({canvas:$('scene'),antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(1.6,devicePixelRatio));renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.18;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;await renderer.init();
const env=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(env,.04).texture;scene.environmentIntensity=.40;env.dispose();const hemi=new THREE.HemisphereLight('#ecf4ff','#a18e70',1.0);scene.add(hemi);
const quality=await createMaterialQuality(THREE,stats);
const pauseBindings=await fetch(dayBase+'short-pauses.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Missing short-pause bindings for '+participant);return r.json()});
bindShortPauses(motion,pauseBindings,participant,data.date);
const loader=new GLTFLoader(),roomObjects=[],curtains=[],allCurtains={},ceiling=[],fixtures={bedroom:[],floorlamp:[]};let actor,bones,rootBone;const segments=motion.segments;let t=21600,playing=false,mode='cameras',group='follow',last=0,dirty=true,renderBusy=false;
const defs=[
 {id:'STUDY · A',room:'study',p:[-3.50,-10.94,2.73],to:[-.35,-8.9,.7],fov:70},
 {id:'STUDY · B',room:'study',p:[1.5,-7.82,2.73],to:[-.9,-9.5,.7],fov:70},
 {id:'BALCONY · A',room:'balcony',p:[3.18,-3.3,2.73],to:[4.76,-1.35,.8],fov:70},
 {id:'BALCONY · B',room:'balcony',p:[5.6,.55,2.73],to:[4.4,-2.2,.7],fov:70},
 {id:'BEDROOM · A',room:'bedroom',p:[-3.52,-7.12,2.74],to:[-.35,-5.23,.65],fov:66},
 {id:'BEDROOM · B',room:'bedroom',p:[1.50,-3.96,2.74],to:[-1.25,-6.12,.65],fov:66},
 {id:'HALLWAY · A',room:'hallway',p:[-5.62,-10.9,2.72],to:[-4.73,-6.4,.6],fov:54},
 {id:'HALLWAY · B',room:'hallway',p:[-4.25,-3.80,2.72],to:[-5.0,-6.9,.55],fov:55},
 {id:'LIVING ROOM · A',room:'living',p:[-3.60,-3.19,2.73],to:[.0,-.40,.75],fov:68},
 {id:'LIVING ROOM · B',room:'living',p:[2.76,.66,2.73],to:[-1.10,-1.60,.65],fov:68},
 {id:'DINING ROOM · A',room:'dining',p:[-5.0,-3.1,2.73],to:[-7.1,-1.1,.8],fov:70},
 {id:'DINING ROOM · B',room:'dining',p:[-8.8,.6,2.73],to:[-6.5,-1.8,.6],fov:70},
 {id:'KITCHEN · A',room:'kitchen',p:[-9.45,-1.3,2.65],to:[-11.55,-1.2,.9],fov:74},
 {id:'KITCHEN · B',room:'kitchen',p:[-10.8,-2.55,2.65],to:[-11.1,-.05,.8],fov:74},
 {id:'ENTRY · A',room:'entry',p:[-5.5,-2.7,2.73],to:[-4.7,.45,.65],fov:64},
 {id:'ENTRY · B',room:'entry',p:[-3.2,.7,2.73],to:[-5,-1.3,.65],fov:64},
 {id:'BATHROOM · A',room:'bathroom',p:[-6.35,-4.0,2.73],to:[-8.0,-6.15,.9],fov:72},
 {id:'BATHROOM · B',room:'bathroom',p:[-6.35,-8.85,2.73],to:[-7.9,-5.5,.85],fov:72}
];
const cameras=defs.map(d=>{const c=new THREE.PerspectiveCamera(d.fov,4/3,.04,100);c.position.copy(P(d.p));c.lookAt(P(d.to));c.layers.enable(1);return c});
const free=new THREE.PerspectiveCamera(43,1,.05,120);const controls=new OrbitControls(free,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2.04;controls.minDistance=2;controls.maxDistance=45;controls.enabled=false;function reset(){free.position.copy(P([14,-20,19]));controls.target.copy(P([-4,-4.5,.6]));controls.update();dirty=true;}reset();controls.addEventListener('change',()=>dirty=true);
async function repairMissingTextureChannels(gltf,path){
 const j=gltf.parser.json,base=new URL(path,location.href),loaded=new Map();
 for(const [mat,a] of gltf.parser.associations){if(!mat.isMaterial||!Number.isInteger(a?.materials))continue;const d=j.materials[a.materials],pbr=d.pbrMetallicRoughness||{};
  for(const [field,info,color]of [['map',pbr.baseColorTexture,true],['metalnessMap',pbr.metallicRoughnessTexture,false],['roughnessMap',pbr.metallicRoughnessTexture,false],['normalMap',d.normalTexture,false],['aoMap',d.occlusionTexture,false],['emissiveMap',d.emissiveTexture,true]]){
   if(!info||mat[field])continue;const uri=j.images?.[j.textures?.[info.index]?.source]?.uri;if(!uri)continue;const key=info.index+'-'+color;
   if(!loaded.has(key)){let tex;for(let attempt=0;attempt<3&&!tex;attempt++){try{tex=await new THREE.TextureLoader().loadAsync(new URL(uri,base).href+'?repair='+attempt);}catch(e){if(attempt===2)throw e;}}
    tex.flipY=false;tex.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;tex.channel=info.texCoord||0;tex.anisotropy=8;const tr=info.extensions?.KHR_texture_transform;if(tr){if(tr.offset)tex.offset.fromArray(tr.offset);if(tr.scale)tex.repeat.fromArray(tr.scale);if(tr.rotation)tex.rotation=tr.rotation;tex.channel=tr.texCoord??tex.channel;}tex.needsUpdate=true;loaded.set(key,tex);
   }mat[field]=loaded.get(key);mat.needsUpdate=true;(stats.recoveredTextureChannels??=[]).push({material:mat.name,field,uri});
  }
 }
}

for(const [i,f] of house.files.entries()){
 $('loading').textContent=`Loading House v102 · ${f.room.replace(/^\d+_/,'')} (${i+1}/${house.files.length})`;
 const gltf=await loader.loadAsync('../house/'+f.path);await repairMissingTextureChannels(gltf,'../house/'+f.path);await quality.apply(gltf.scene);scene.add(gltf.scene);roomObjects.push(gltf.scene);
 gltf.scene.traverse(o=>{
  let meta=o;while(meta&&!meta.userData.source_root)meta=meta.parent;const u=meta?.userData||{};
  if(o.isMesh){o.userData.source_room=u.source_room;const box=new THREE.Box3().setFromObject(o),extent=box.getSize(new THREE.Vector3());o.castShadow=Math.max(extent.x,extent.y,extent.z)>.04 && o.geometry.attributes.position.count<100000;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])for(const v of Object.values(m)){if(v?.isTexture){const k=v.channel?'uv'+v.channel:'uv';if(!o.geometry.attributes[k]&&o.geometry.attributes.uv)o.geometry.setAttribute(k,o.geometry.attributes.uv);}}if(u.ceiling){o.layers.set(1);ceiling.push(o)};for(const m of Array.isArray(o.material)?o.material:[o.material]){m.envMapIntensity=.8;if(m.map)m.map.anisotropy=8;if(m.normalMap)m.normalMap.anisotropy=8;if(m.emissive){if(!m.userData.baseEmit)m.userData.baseEmit=m.emissive.clone();if(/CeilingLight|FloorLamp|Chandelier|Downlight|Pendant|Spotlight|DeskLamp/.test(u.source_root||''))m.emissiveIntensity=0;}if(m.transmission>.1){m.transparent=true;m.opacity=1;m.depthWrite=false;o.castShadow=false;}}
   if((u.source_root||'').includes('04_Bedroom__CeilingLight'))fixtures.bedroom.push(o);if((u.source_root||'').includes('FloorLamp_ABO'))fixtures.floorlamp.push(o);
   if(o.morphTargetInfluences&&(u.source_root||'').includes('Curtain')){const r=({'01_Living':'living_room','04_Bedroom':'bedroom','05_Study':'study','06_Balcony':'living_room'})[u.source_room];if(r)(allCurtains[r]??=[]).push(o);}
   if((u.source_root||'').includes('02_Dining__Smartphone'))o.visible=false;
  }
 });
 await new Promise(r=>setTimeout(r,20));
}
const detachedLeaves = new Set(['door_01_mesh_00.002','door_02_mesh_00.001']);
const spareLeaves = topMatches(scene,o=>o.userData.source_root==='OBJROOT__00_Shared__SharedDoors' && detachedLeaves.has(o.userData.source_object));
stats.unplacedDoorTemplates = spareLeaves.map(o=>o.userData.source_object);
for(const leaf of spareLeaves)leaf.removeFromParent();
repairSurfaceLayers(scene,stats);
$('loading').textContent='Loading the current character and registered motion clips…';const ag=await loader.loadAsync(motion.actor);actor=ag.scene;scene.add(actor);const boneMap=new Map();actor.traverse(o=>{o.frustumCulled=false;if(o.isBone)boneMap.set(o.name,o);if(o.isMesh){o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])for(const v of Object.values(m)){if(v?.isTexture){const k=v.channel?'uv'+v.channel:'uv';if(!o.geometry.attributes[k]&&o.geometry.attributes.uv)o.geometry.setAttribute(k,o.geometry.attributes.uv);}}for(const m of Array.isArray(o.material)?o.material:[o.material]){m.envMapIntensity=.5;if(m.map)m.map.anisotropy=8}}});for(const [obj,a]of ag.parser.associations)if(Number.isInteger(a.nodes)){const n=ag.parser.json.nodes[a.nodes]?.name;if(n)boneMap.set(n,obj)}bones=motion.bone_names.map(n=>boneMap.get(n)||boneMap.get(THREE.PropertyBinding.sanitizeNodeName(n)));if(bones.some(b=>!b))throw Error('Current character joint mapping is incomplete');rootBone=bones[motion.parents.indexOf(-1)];
const streamCache=new Map();for(const s of segments.flatMap(s=>s.cleaningSource?[s,s.cleaningSource]:[s])){if(!s.file)continue;if(!streamCache.has(s.file))streamCache.set(s.file,fetch(new URL(s.file,new URL(selectedDay.base,location.href))).then(r=>{if(!r.ok)throw Error('Motion cache unavailable: '+s.file);return r.arrayBuffer()}).then(x=>new Float32Array(x)));s.pose=await streamCache.get(s.file);}
// Replace only the wardrobe cabinet/leaves with the closed derivative; clothes remain untouched.
const wardrobeOld=[];scene.traverse(o=>{if(o.userData.source_root==='OBJROOT__04_Bedroom__Wardrobe_W03_01')wardrobeOld.push(o)});for(const o of wardrobeOld)o.removeFromParent();
const wardrobeClosed=await loader.loadAsync('../materials/assets/wardrobe-closed.glb');await quality.apply(wardrobeClosed.scene);scene.add(wardrobeClosed.scene);stats.wardrobeInitial='closed';
const physicalReport=await fetch(dayBase+'interaction-checks.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Missing interaction checks for '+participant);return r.json()});
const initialDeltas=new Map();scene.updateMatrixWorld(true);const propSpecs=await fetch(dayBase+'props.json',{cache:'no-cache'}).then(r=>r.json()),propNodes={};
bindShortPauseProps(propSpecs,pauseBindings);
const conv=new THREE.Matrix4().set(1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1),invConv=conv.clone().invert();
const mat=a=>new THREE.Matrix4().set(...a.flat());
for(const [key,spec]of Object.entries(propSpecs)){
 const g=new THREE.Group();g.name='RoutineProp_'+key;g.userData.routine_prop=true;scene.add(g);const objects=topMatches(scene,o=>o.userData.source_object&&o.userData.source_root===spec.root);
 attachPreservingWorld(g,objects);for(const o of objects){o.visible=!(spec.hideMembers||[]).includes(o.userData.source_object);}propNodes[key]={g,spec,inverse:mat(spec.original).invert()};
}
function applyProp(n,M){const delta=conv.clone().multiply(M).multiply(n.inverse).multiply(invConv);delta.decompose(n.g.position,n.g.quaternion,n.g.scale);n.g.updateMatrixWorld(true);}
// Keep the current mouse and mat as a pair at the registered desk hand target.
const deskMouse={};if(motion.deskContact?.mouse){const spec=motion.deskContact.mouse,delta=new THREE.Vector3(...spec.center).sub(new THREE.Vector3(spec.original[0][3],spec.original[1][3],spec.original[2][3]));for(const[key,root]of [['mouse',spec.root],['pad',spec.padRoot]]){const g=new THREE.Group();scene.add(g);const members=topMatches(scene,o=>o.isMesh&&o.userData.source_root===root);attachPreservingWorld(g,members);g.position.copy(P(delta.toArray()));g.updateMatrixWorld(true);deskMouse[key]=g;}window.review.deskMouse=deskMouse;}
const robotCleaning={roots:[],diagnostics:{state:{},scope:'Device states only; participant-specific cleaning routes are not claimed.'},update(){}};
const lighting=createHouseLighting(THREE,scene,hemi,house,stats);
const wardrobeParts=await splitWardrobeDoors(THREE,scene);stats.wardrobeParts=wardrobeParts;const doorGeometry=await createDoorGeometry(THREE,scene,data,stats);const routineDetails=createRoutineDetails(THREE,scene,segments,propNodes,{...data,wardrobePivot:wardrobeParts.pivot,wardrobeRightPivot:wardrobeParts.rightPivot});stats.initialArticulations=initialDeltas.size;stats.shadowPolicy='Active-room 2048px fixture/daylight shadows; props above 4 cm and below 100k vertices cast shadows, detailed geometry remains visible.';stats.batches=buildStaticBatches(scene,{excludeRoots:[actor,...Object.values(propNodes).map(x=>x.g),...routineDetails.roots,...doorGeometry.roots,...lighting.roots,...robotCleaning.roots,...Object.values(deskMouse)],maxAddedBytes:192*1024*1024}).stats;
const playbackContext={segments,bones,actor,props:propNodes,motion};
let playback=createSequenceRuntime(THREE,playbackContext);
if (selectedDay.restTransitions) {
 const [{withRestTransitions},restPlan]=await Promise.all([import('../supports/scheduling/rest-bridges/runtime.js'),fetch(selectedDay.restTransitions,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Rest transitions unavailable.');return r.json()})]);
 if(restPlan.participant!==participant || restPlan.date!==data.date || Object.entries(restPlan.inputs).some(([k,v])=>pauseBindings.inputs[k]!==v))throw Error('Rest transitions belong to another day or scene.');
 playback=withRestTransitions(THREE,playback,playbackContext,restPlan);
}
const phase=(s,t)=>playback.frame(s,t);window.review.playback=playback;
function curtainPosition(time,id){
 let current=data.initial[id]?.position_percent_open?.value||0;
 for(let i=0;i<data.events.length;i++){const e=data.events[i];if(e.t>time)break;const change=e.changes.find(c=>c.deviceId===id&&c.values.position_percent_open);if(!change)continue;const target=change.values.position_percent_open.value;const end=data.events.slice(i+1).find(x=>x.changes.some(c=>c.deviceId===id&&c.values.motion_state?.value==='idle'))?.t??e.t;
  if(time<end)return current+(target-current)*ease((time-e.t)/Math.max(.01,end-e.t));current=target;
 }return current;
}
let active=segments[0],states=data.initial,lastUi=-1,visibleIds=[];
function sample(time){
 t=Math.max(data.startSeconds??21600,Math.min(data.endSeconds??97200,time));active=playback.sample(t);
 if(deskMouse.mouse){const spec=motion.deskContact.mouse;let M=mat(spec.original);M.setPosition(new THREE.Vector3(...spec.center));if(/use_computer_mouse/.test(active.branch_id||'')){M=invConv.clone().multiply(bones[motion.bone_names.findIndex(n=>n.endsWith(':RightHand'))].matrixWorld).multiply(mat(spec.H));M.elements[14]=spec.center[2];}const delta=conv.clone().multiply(M).multiply(mat(spec.original).invert()).multiply(invConv);delta.decompose(deskMouse.mouse.position,deskMouse.mouse.quaternion,deskMouse.mouse.scale);deskMouse.mouse.updateMatrixWorld(true);}
 states=structuredClone(data.initial);for(const e of data.events){if(e.t>t)break;for(const c of e.changes)Object.assign(states[c.deviceId]??={},c.values)}
 routineDetails.update(t,states,active);doorGeometry.update(t);robotCleaning.update(t,states);
 const cp=curtainPosition(t,'dev_bedroom_curtain_01')/100;lighting.update(t,states,{'dev_bedroom_curtain_01':cp*100});
 for(const [r,ms]of Object.entries(allCurtains)){const cp=curtainPosition(t,'dev_'+r+'_curtain_01')/100;for(const m of ms)for(let i=0;i<m.morphTargetInfluences.length;i++)m.morphTargetInfluences[i]=cp;}
 dirty=true;ui();
}
const roomNames={'01_Living':'living','02_Dining':'dining','03_Kitchen':'kitchen','04_Bedroom':'bedroom','05_Study':'study','06_Balcony':'balcony','07_Bathroom':'bathroom','08_Hallway':'hallway','09_Entry':'entry'};
const roomFloors=house.objects.filter(o=>/floor/i.test(o.root)&&!/lamp|washer/i.test(o.root)&&o.bounds[1][2]<.08).map(o=>({room:roomNames[o.room],bounds:o.bounds,area:(o.bounds[1][0]-o.bounds[0][0])*(o.bounds[1][1]-o.bounds[0][1])})).sort((a,b)=>a.area-b.area);
let lastFollowRoom=null;function followedRoom(){
 if((active.routePlan || active.pairedGuitar?.stage?.startsWith("carry_"))&&!active.hidden){const p=rootBone.getWorldPosition(new THREE.Vector3()),x=p.x,y=-p.z;const floor=roomFloors.find(f=>x>=f.bounds[0][0]-.025&&x<=f.bounds[1][0]+.025&&y>=f.bounds[0][1]-.025&&y<=f.bounds[1][1]+.025);if(floor){const old=roomFloors.find(f=>f.room===lastFollowRoom&&x>=f.bounds[0][0]-.12&&x<=f.bounds[1][0]+.12&&y>=f.bounds[0][1]-.12&&y<=f.bounds[1][1]+.12);lastFollowRoom=old?.room||floor.room;return lastFollowRoom;}}
 return {living_room:'living',dining_room:'dining'}[active.room]||active.room;
}
function chosen(){const r=group==='follow'?followedRoom():group;return defs.map((d,i)=>i).filter(i=>r==='all'?['bedroom','living','kitchen'].includes(defs[i].room):defs[i].room===({living_room:'living',dining_room:'dining',outside:'entry',entry_exterior:'entry'}[r]||r))}
function tiles(){const ids=chosen();if(ids.join()===visibleIds.join())return;visibleIds=ids;$('tiles').classList.toggle('all',ids.length>2);$('tiles').innerHTML=ids.map(i=>`<div class="tile" data-camera="${i}"><div class="stamp"><b>${defs[i].id}</b><br><span class="led">●</span> <time>${clock(t)}</time></div></div>`).join('');dirty=true;}
function stateSummary(st){const a=[];if(st.is_on)a.push(st.is_on.status==='known'?(st.is_on.value?'ON':'OFF'):'UNKNOWN');for(const k of ['brightness','position_percent_open','motion_state','operating_state','playback_state','door_state','locked','illuminance_lux'])if(st[k]?.status==='known')a.push(`${nice(k).replace('position percent open','open')}: ${st[k].value}`);return a.slice(0,3).join(' · ')||Object.entries(st).slice(0,2).map(([k,v])=>`${nice(k)}: ${v.status==='known'?v.value:'unknown'}`).join(' · ')}
const dashboard=createDeviceDashboard({container:$('devices'),devices:data.devices,initial:data.initial});
const deviceById=new Map(data.devices.map(d=>[d.id,d]));const ev=[...data.logs.map(l=>({...l,type:'command'})),...data.events.map(e=>({...e,type:'state'}))].sort((a,b)=>a.t-b.t||(a.eventOrder||0)-(b.eventOrder||0));
let lastEventSignature='';
function telemetry(){const filter=$('device-filter').value;const relevant=e=>filter==='all'||(e.type==='command'?deviceById.get(e.deviceId)?.room===filter:e.changes.some(c=>deviceById.get(c.deviceId)?.room===filter));const past=ev.filter(e=>e.t<=t&&relevant(e));$('counts').textContent=`${data.logs.filter(e=>e.t<=t).length} / ${data.logs.length} commands · ${data.events.filter(e=>e.t<=t).length} / ${data.events.length} state events`;
 const eventSignature=filter+'|'+past.length+'|'+(past.at(-1)?.id||'');if(eventSignature!==lastEventSignature){lastEventSignature=eventSignature;$('events').innerHTML=past.length?past.slice(-70).reverse().map(e=>{let title,details;if(e.type==='command'){const d=deviceById.get(e.deviceId);title=`${nice(d?.room||'house')} · ${d?.name||e.deviceId}`;details=e.functionCalls.map(c=>`${nice(c.function)} ${Object.values(c.parameters||{}).join(' ')}`).join(' + ')+` · ${e.initiator} / ${e.trigger}${data.commandExecution?.[e.id] ? ' · performed by phone (remote control)' : ''}`}else{title=e.changes.map(c=>{const d=deviceById.get(c.deviceId);return `${d?.room} · ${d?.name}`}).join(', ');details=e.changes.map(c=>Object.entries(c.values).map(([k,v])=>`${nice(k)} → ${v.status==='known'?v.value??'none':v.status}`).join(' · ')).join('; ')+` · ${e.source}`;}return `<div class="event ${e.type==='command'?'command':''} ${t-e.t<3?'flash':''}" data-t="${e.t}" title="${esc(e.id)}"><time>${clock(e.t)}</time><div class="event-title">${esc(title)}<p>${esc(details)}</p></div></div>`}).join(''):'<div class="event"><span>No trigger yet.</span></div>';
 $('events').querySelectorAll('[data-t]').forEach(el=>el.onclick=()=>{playing=false;sample(+el.dataset.t);});}const selected=data.devices.filter(d=>filter==='all'||d.room===filter);$('device-count').textContent=`${selected.length} DEVICES`;
 dashboard.render(states,filter,t);}

function ui(){const second=Math.floor(t);$('timeline').value=t;$('clock').textContent=clock(t);$('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?'Pause':'Play');$('skill').textContent=active.title;$('provenance').textContent=physicalReport.steps[active.id]?.warning?'HANDOFF DISTANCE · '+Math.round(physicalReport.steps[active.id].warning*100)+' CM':physicalReport.steps[active.id]?.carryEndpointReview?'CARRY ENDPOINT · POSTURE REVIEW':active.unsupported?'MOTION UNAVAILABLE · TEXT ONLY':active.executionStatus==='motion_reference_unbound_prop'?'BODY MOTION · OBJECT NOT BOUND':active.executionStatus==='derived_state_visualization'?'CURRENT ACTIVITY · SUPPORTED POSE':active.executionStatus==='diagnostic_candidate'?'CURRENT SKILL · DIAGNOSTIC CANDIDATE':active.executionStatus==='derived_candidate'?'CURRENT SKILL · DERIVED MOTION':'CURRENT SKILL · '+(active.phaseLabel||active.skill||'').replaceAll('_',' ').toUpperCase();$('execution-note').hidden=!(active.unsupported||active.executionStatus==='motion_reference_unbound_prop');$('execution-note').innerHTML=active.unsupported?'<b>Action not animated</b><span>'+(/route|stance|placement/i.test(active.executionReason||'')?'A compatible placement or route is still pending.':'No compatible motion is currently bound to this step.')+' The activity and device timelines continue.</span>':active.executionStatus==='motion_reference_unbound_prop'?'<b>Body motion only</b><span>A required held object is not bound for this step.</span>':'';$('privacy').hidden=!(active.privacy||active.textOnly||active.outside);$('privacy').querySelector('b').textContent=active.privacy?'PRIVACY':active.outside?'AWAY':active.textOnly?'TEXT ONLY':/route|stance|placement/i.test(active.executionReason||'')?'PLACEMENT PENDING':'MOTION UNAVAILABLE';$('privacy').querySelector('small').textContent=active.privacy_reason||active.unsupportedReason||active.executionReason||active.title||'Personal activity';$('jump').value=active.id;const activity=data.activities.find(a=>a.t0<=t&&a.t1>t);$('activity').textContent=activity?.label||'Unlabelled interval';$('activity-evidence').textContent='HIGH-LEVEL ACTIVITY · '+participant;const sub=(data.secondaryActivities||[]).filter(a=>a.t0<=t&&a.t1>t);$('subactivity').textContent=activity?.description||'';tiles();$('tiles').querySelectorAll('time').forEach(e=>e.textContent=clock(t));if(second!==lastUi){telemetry();lastUi=second;}window.review.time=t;window.review.privacy=!!active.privacy;window.review.segment=active.id;window.review.skill=active.skill;window.review.state=states;}
for(const s of segments){const o=document.createElement('option');o.value=s.id;o.textContent=`${s.clock_start} · ${s.title}`;$('jump').append(o)}
for(const room of [...new Set(data.devices.map(d=>d.room))]){const o=document.createElement('option');o.value=room;o.textContent=nice(room);$('device-filter').append(o)}
let end=data.startSeconds??21600;for(const a of data.activities){if(a.t0>end){const g=document.createElement('div');g.className='activity-block gap';g.style.flex=a.t0-end;$('activity-band').append(g)}const b=document.createElement('div');b.className='activity-block '+(a.evidence==='reconstructed'?'added':'recorded');b.style.flex=a.t1-a.t0;b.title=`${clock(a.t0)}–${clock(a.t1)} ${a.label}`;b.onclick=()=>{playing=false;sample(a.t0)};$('activity-band').append(b);end=a.t1}
function setMode(v){mode=v;controls.enabled=v==='free';$('tiles').hidden=v==='free';$('camera-mode').classList.toggle('active',v==='cameras');$('free-mode').classList.toggle('active',v==='free');$('focus').hidden=$('reset').hidden=v!=='free';$('room').hidden=v==='free';$('hint').textContent=v==='free'?'Drag to orbit · Scroll to zoom · Right-drag to pan':'Synchronized camera views';dirty=true;}
$('camera-mode').onclick=()=>setMode('cameras');$('free-mode').onclick=()=>setMode('free');$('room').onchange=()=>{group=$('room').value;tiles()};$('reset').onclick=reset;$('focus').onclick=()=>{const pos=rootBone.getWorldPosition(new THREE.Vector3());controls.target.copy(pos);const r=followedRoom();const view=defs.find(d=>d.room===r);if(view){free.position.copy(P(view.p));free.position.y+=.20;}else free.position.copy(pos).add(new THREE.Vector3(0,4,3));controls.update();dirty=true;};$('play').onclick=()=>{playing=!playing;if(t>=data.duration)sample(data.startSeconds??21600);ui()};$('timeline').oninput=()=>{playing=false;sample(+$('timeline').value)};$('jump').onchange=()=>{playing=false;sample(segments.find(s=>s.id===$('jump').value).start)};$('device-filter').onchange=telemetry;
let resizePending=false,lastWidth=0,lastHeight=0;function resize(){resizePending=false;const r=$('stage').getBoundingClientRect(),w=Math.round(r.width),h=Math.round(r.height);if(w===lastWidth&&h===lastHeight)return;lastWidth=w;lastHeight=h;renderer.setSize(w,h,false);free.aspect=w/h;free.updateProjectionMatrix();dirty=true;}new ResizeObserver(()=>{if(!resizePending){resizePending=true;requestAnimationFrame(resize);}}).observe($('stage'));resize();
window.review.robotCleaning=robotCleaning;window.review.lighting=lighting;window.review.routineDetails=routineDetails;window.review.effects=routineDetails.effects;window.review.invalidate=()=>{dirty=true};window.review.renderer=renderer;window.review.actor=actor;window.review.scene=scene;window.review.cameras=cameras;window.review.props=propNodes;window.review.motion=motion;window.review.seek=x=>{playing=false;sample(x)};window.review.play=()=>{playing=true};window.review.mode=setMode;
function updateShadowRooms(){lighting.prepareRender(mode,new Set(chosen().map(i=>defs[i].room)));}
document.addEventListener('visibilitychange',()=>{last=0});
const renderDurations=[];async function frame(ms){const renderStart=performance.now();requestAnimationFrame(frame);const dt=last?Math.max(0,(ms-last)/1000):0;last=ms;if(playing&&!document.hidden){sample(t+dt*+$('speed').value);if(t>=data.duration)playing=false;}if(mode==='free')controls.update();if(!dirty||renderBusy)return;renderBusy=true;dirty=false;const box=$('stage').getBoundingClientRect();updateShadowRooms();try{renderer.setScissorTest(false);renderer.clear();if(active.privacy||active.textOnly||active.outside){renderer.setViewport(0,0,box.width,box.height);}else if(mode==='free'){renderer.setViewport(0,0,box.width,box.height);renderer.render(scene,free);}else{renderer.setScissorTest(true);for(const tile of $('tiles').children){const i=+tile.dataset.camera,r=tile.getBoundingClientRect(),x=r.left-box.left,y=renderer.backend.isWebGPUBackend?r.top-box.top:box.bottom-r.bottom;renderer.setViewport(x,y,r.width,r.height);renderer.setScissor(x,y,r.width,r.height);cameras[i].aspect=r.width/r.height;cameras[i].updateProjectionMatrix();renderer.render(scene,cameras[i]);}renderer.setScissorTest(false);}}catch(e){stats.errors.push(String(e));$('loading').style.display='grid';$('loading').textContent=String(e);playing=false;}renderBusy=false;renderDurations.push(performance.now()-renderStart);if(renderDurations.length>180)renderDurations.shift();const sorted=[...renderDurations].sort((a,b)=>a-b);stats.performance={samples:sorted.length,cpuFrameMedianMS:sorted[Math.floor(sorted.length*.5)],cpuFrameP95MS:sorted[Math.floor(sorted.length*.95)]};stats.frames=(stats.frames||0)+1;stats.backend=renderer.backend.isWebGPUBackend?'WebGPU':'WebGL';stats.drawCalls=renderer.info.render.calls;stats.triangles=renderer.info.render.triangles;}
if(params.get('view')==='free')$('free-mode').click();$('loading').hidden=true;$('loading').style.display='none';$('play').disabled=false;stats.ready=true;stats.meshes=house.objects.length;stats.curtainMorphs=Object.values(allCurtains).reduce((n,v)=>n+v.length,0);$('render-info').textContent=`House v102 · ${house.objects.length.toLocaleString()} source meshes · ${segments.length} graph playback intervals · ${data.devices.length} device-state records · ${participant} · Source clock retained. Source PBR maps + baked procedural channels · Exact device clocks · Graph-derived execution preview.`;sample(Number(params.get('t'))||motion.defaultPreviewTime||data.startSeconds||21600);if(mode==='free'&&params.get('focus')==='actor')$('focus').click();requestAnimationFrame(frame);

window.review.setRoom=r=>{group=r;$('room').value=r;tiles();dirty=true;};
window.review.phase=phase;

document.querySelectorAll('[data-seek]').forEach(b=>b.onclick=()=>{playing=false;sample(+b.dataset.seek)});

const chapters=$('chapters');for(const [label,at]of [['Morning',21600],['Midday',43200],['Afternoon',54000],['Evening',64800],['Night',79200]]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{playing=false;sample(at)};chapters.append(b)}if(false){const b=document.createElement('button');b.textContent='TV remote · 22:41';b.onclick=()=>{playing=false;sample(81668.866667)};chapters.append(b)}const link=document.createElement('a');link.href=selectedDay.executionDetails;link.textContent='Daily sequence ↗';chapters.append(link);stats.playbackCoverage=motion.coverage||{counts:motion.counts,seconds:motion.secondsByStatus,limitations:motion.limitations};window.review.data=data;window.review.pause=()=>{playing=false;ui()};

$('spatial-report').textContent=physicalReport.warningCount+' visible handoffs exceed the 30 cm distance screen. Open the interaction review to inspect the individual times.';
fetch(selectedDay.audit).then(r=>r.json()).then(a=>{const d=a.days[participant];window.review.audit=d;if(d.seamsOver3cm.length)$('spatial-report').textContent+=' '+d.seamsOver3cm.length+' approach seams also need review.';}).catch(()=>{});

for(const [label,skill] of [['Meal','eat_with_utensil'],['Laundry','put_in'],['Desk','type']]){const s=segments.find(s=>s.skill===skill&&s.end-s.start>1);if(s){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{playing=false;sample(s.start+Math.min(2,(s.end-s.start)*.5))};chapters.insertBefore(b,link);}}

for(const[label,test]of [['Bed edge',s=>s.siteBefore?.startsWith('bedroom:bed')&&s.phaseLabel==='core'&&/phone/.test(s.skill)],['Rinse',s=>/Rinse the held onion/.test(s.title)&&s.phaseLabel==='core'],['Fridge',s=>s.graphNodeId?.startsWith('door.fridge.close')],['Mouse',s=>/use_computer_mouse/.test(s.branch_id||'')],['Walk',s=>s.routePlan?.distance_m>2&&!s.hidden],['Doors',s=>s.executionEdge?.door],['Pocket phone',s=>s.pocketExtraction&&!s.hidden]]){const s=segments.find(test);if(s){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{playing=false;sample(s.start+Math.min(1.5,(s.end-s.start)*.2))};chapters.append(b);}}

const diagnosticButton=document.createElement('button');diagnosticButton.textContent='Save runtime report';diagnosticButton.onclick=()=>{const report={...stats,time:t,mode,active:active.id,actorVisible:actor.visible,propMeshes:Object.fromEntries(Object.entries(propNodes).map(([k,n])=>[k,{children:n.g.children.length,visible:n.g.visible}])),navigationContract:motion.navigationContract};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));a.download='house-runtime-'+participant+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);};document.querySelector('details.notes').append(diagnosticButton);
