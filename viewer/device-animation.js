// Device effects are deterministic functions of the same event timeline shown by the UI.
// This is a visual response layer, not a fluid/thermal or electrical simulation.
export function createDeviceAnimations(THREE, scene, segments, props, timeline = {}) {
 const roots=[], indicators=[], drums=[], state={};
 const clamp=x=>Math.max(0,Math.min(1,x)), P=a=>new THREE.Vector3(a[0],a[2],-a[1]);
 const meta=o=>{let p=o;while(p&&!p.userData.source_object)p=p.parent;return p?.userData||{};};
 const meshes=[];scene.updateMatrixWorld(true);scene.traverse(o=>{if(o.isMesh)meshes.push({o,...meta(o)});});
 const find=name=>meshes.find(x=>x.source_object===name)?.o;
 const bounds=name=>{const o=find(name);return o?new THREE.Box3().setFromObject(o):null;};
 function intervals(id,key,value){const out=[];let start=null;for(const e of timeline.events||[]){for(const c of e.changes||[]){if(c.deviceId!==id||!c.values?.[key])continue;const hit=c.values[key].value===value;if(hit&&start===null)start=e.t;if(!hit&&start!==null){out.push([start,e.t]);start=null;}}}if(start!==null)out.push([start,timeline.duration||97200]);return out;}
 const brews=intervals('dev_dining_room_coffee_machine_01','operating_state','brewing');
 const drinks=segments.filter(s=>s.skill==='drink'&&(s.objects||[]).includes('coffee'));
 const drinkDuration=drinks.reduce((n,s)=>n+s.end-s.start,0);
 const value=(states,id,key,f=null)=>states[id]?.[key]?.value??f;
 const coffeeMaterial=new THREE.MeshPhysicalMaterial({color:'#472313',roughness:.19,clearcoat:1,clearcoatRoughness:.12});
 const cremaMaterial=new THREE.MeshStandardMaterial({color:'#b8874b',roughness:.28,transparent:true,opacity:.50,depthWrite:false});
 let cupSurface=null,crema=null,cupBase=null,cupRadius=.031;
 if(props.coffee){
  const g=props.coffee.g,q=props.coffee.spec,box=new THREE.Box3().setFromObject(g),top=box.max.y;
  // The handle makes the whole-object bounding-box center misleading. Find the upper rim.
  const rim=new THREE.Box3(),v=new THREE.Vector3();let count=0;
  g.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);if(v.y>top-.004){rim.expandByPoint(v);count++;}}});
  const center=count?rim.getCenter(new THREE.Vector3()):box.getCenter(new THREE.Vector3());
  const rimSize=count?rim.getSize(new THREE.Vector3()):box.getSize(new THREE.Vector3());
  cupRadius=Math.min(rimSize.x,rimSize.z)*.40;cupRadius=Math.max(.022,Math.min(.035,cupRadius));
  cupBase={x:center.x,z:center.z,bottom:box.min.y+.014,top:top-.012};
  cupSurface=new THREE.Mesh(new THREE.CylinderGeometry(cupRadius,cupRadius,.002,48),coffeeMaterial);cupSurface.name='CoffeeLiquidSurface';cupSurface.position.set(center.x,cupBase.bottom,center.z);scene.add(cupSurface);g.attach(cupSurface);roots.push(cupSurface);
  crema=new THREE.Mesh(new THREE.RingGeometry(cupRadius*.72,cupRadius*.96,48),cremaMaterial);crema.name='CoffeeCremaRim';crema.rotation.x=-Math.PI/2;crema.position.copy(cupSurface.position);crema.position.y+=.0015;g.add(crema);roots.push(crema);
 }
 // A material change on the liquid surface travels with the actual cup, including on seek.
 const teaCues=[];
 for (const segment of segments) {
  const key=segment.graphNodeId||'';
  if(key.startsWith('serve.hot_water.')) teaCues.push({time:segment.start,filled:segment.end,kind:'tea'});
  else if(key==='fill.water') teaCues.push({time:segment.start,filled:segment.end,kind:'water'});
  else if(key.startsWith('wash.water') || key.startsWith('scope.sleep')) teaCues.push({time:segment.start,kind:'empty'});
 }
 for(const episode of timeline.activities||[])if(episode.l2==='sleeping')teaCues.push({time:episode.t0,kind:'empty'});
 teaCues.sort((a,b)=>a.time-b.time);
 const clearWater=new THREE.Color('#d7edf1'),amberTea=new THREE.Color('#ac5e24');
 let teaSurface=null;
 if(props.water && teaCues.length){
  const cup=props.water.g;cup.updateWorldMatrix(true,true);
  const box=new THREE.Box3().setFromObject(cup),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const radius=Math.min(size.x,size.z)*.42;
  teaSurface=new THREE.Mesh(new THREE.CircleGeometry(radius,48),new THREE.MeshPhysicalMaterial({color:clearWater,roughness:.15,clearcoat:1,transparent:true,opacity:.77,side:THREE.DoubleSide,depthWrite:false}));
  teaSurface.name='WaterCupLiquid';teaSurface.rotation.x=-Math.PI/2;
  teaSurface.position.set(center.x,box.max.y-size.y*.14,center.z);scene.add(teaSurface);cup.attach(teaSurface);teaSurface.visible=false;roots.push(teaSurface);
 }
 function jet(name,start,end,color,radius,opacity){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(radius*.8,radius,1,12),new THREE.MeshPhysicalMaterial({color,roughness:.12,transparent:true,opacity,clearcoat:1,depthWrite:false}));m.name=name;m.visible=false;scene.add(m);roots.push(m);return {m,start:P(start),end:P(end),radius};
 }
 function connect(j,a,b,time){const d=b.clone().sub(a),len=d.length();j.m.position.copy(a).add(b).multiplyScalar(.5);j.m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());j.m.scale.set(1+.06*Math.sin(time*18),len,1+.04*Math.cos(time*21));}
 const coffeeJets=[];
 for(const side of ['Left','Right']){const b=bounds('CoffeeMachine__Portafilter_TwinSpout_'+side);if(b){const c=b.getCenter(new THREE.Vector3());c.y=b.min.y+.0003;const j=jet('CoffeeStream'+side,[c.x,-c.z,c.y],[c.x,-c.z,c.y-.1],'#64381c',.002,.92);coffeeJets.push(j);}}
 const waterJets=[
  jet('KitchenTapWater',[-11.953,-.35687,1.0963],[-11.953,-.35687,.855],'#b7dce7',.004,.48),
  jet('BathroomTapWater',[-8.219,-6.05113,1.0612],[-8.219,-6.05113,.88],'#b7dce7',.004,.48),
  jet('DispenserWater',[-11.27958,-3.12585,1.204],[-11.27958,-3.12585,1.06],'#c1e4ed',.003,.54)
 ];
 const splashes=waterJets.slice(0,2).map((j,i)=>{const g=new THREE.Group();g.name=['KitchenWaterSplash','BathroomWaterSplash'][i];for(let k=0;k<3;k++){const m=new THREE.Mesh(new THREE.RingGeometry(.010,.012,32),new THREE.MeshBasicMaterial({color:'#daeaf0',transparent:true,opacity:.15,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;g.add(m);}g.position.copy(j.end);scene.add(g);roots.push(g);return g;});
 function addIndicator(id,predicate,color='#b8e9ff',mode='on'){
  const selected=meshes.filter(x=>predicate(x.source_object||'',x.source_root||''));
  const mats=[];for(const x of selected){const ar=Array.isArray(x.o.material)?x.o.material:[x.o.material];const cs=ar.map(m=>{const c=m.clone();c.emissive=new THREE.Color(color);c.emissiveIntensity=0;c.userData.deviceEffect=id;mats.push(c);return c;});x.o.material=Array.isArray(x.o.material)?cs:cs[0];roots.push(x.o);}
  if(selected.length)indicators.push({id,mats,mode,meshes:selected.length});
 }
 for(const [room,letter] of [['dining_room','A'],['study','B']])addIndicator('dev_'+room+'_network_speaker_01',n=>n.startsWith('NetworkSpeaker_'+letter+'__LED_Lens'),'#2abce7','music');
 addIndicator('dev_dining_room_coffee_machine_01',n=>/^CoffeeMachine__Control_\d+_MetalButton$/.test(n),'#ffe3b7','coffee');
 addIndicator('dev_kitchen_rice_cooker_01',n=>n.startsWith('RiceCooker__LED_'),'#e3f2ff','operating');
 addIndicator('dev_kitchen_water_dispenser_01',n=>/^WaterDispenser_(Display|StatusDot|DropletIcon|Digit)/.test(n),'#d2ddff','on');
 addIndicator('dev_kitchen_blender_01',n=>n==='Blender__DisplayDigits','#e5f4ff','on');
 addIndicator('dev_kitchen_microwave_01',(n,r)=>r.endsWith('__Microwave')&&n.includes('Print • LED'),'#ddf0ff','operating');
 addIndicator('dev_kitchen_microwave_01',(n,r)=>r.endsWith('__Microwave')&&n.startsWith('Lamp diffuser'),'#ffbd75','cavityLamp');
 addIndicator('dev_kitchen_microwave_01',(n,r)=>r.endsWith('__Microwave')&&/^(Cavity liner|Cavity rear |Turntable • glass)/.test(n),'#ffb273','cavityWall');
 for(const [room,prefix] of [['study','Study'],['bedroom','Bedroom']])addIndicator('dev_'+room+'_air_purifier_01',n=>n===prefix+'_AirPurifier__DisplayScreen','#9cdfcf','on');
 for(const [prefix,id] of [['WashingMachine','dev_balcony_washing_machine_01'],['Dryer','dev_balcony_tumble_dryer_01']]){
  const o=find(prefix+'__Drum');if(o){const box=new THREE.Box3().setFromObject(o),pivot=new THREE.Group();pivot.name=prefix+'AnimatedDrum';pivot.position.copy(box.getCenter(new THREE.Vector3()));scene.add(pivot);pivot.attach(o);roots.push(pivot);drums.push({g:pivot,id});}
  addIndicator(id,n=>n===prefix+'__RightButton','#9dd8fb','operating');
 }
 const coverage={coffee:{nozzles:coffeeJets.length,cup:!!cupSurface,brewing_intervals:brews,drinking_segments:drinks.length},water:['kitchen tap','bathroom tap','water dispenser'],indicator_devices:indicators.map(x=>({id:x.id,meshes:x.meshes})),drum_devices:drums.map(x=>x.id),scope:'Timeline-driven visual cues; no fluid/thermal simulation. Device state is not synthesized.'};
 function update(time,states,active){
  const brewing=value(states,'dev_dining_room_coffee_machine_01','operating_state')==='brewing';
  const interval=brews.find(x=>time>=x[0]&&time<x[1]);
  const completed=brews.some(x=>time>=x[1]);
  const fill=interval?clamp((time-interval[0])/(interval[1]-interval[0])):completed?1:0;
  const spent=drinks.reduce((n,s)=>n+Math.max(0,Math.min(time,s.end)-s.start),0)/Math.max(1,drinkDuration);
  const content=active.state_before?.coffee_content;
  const fraction=clamp(fill-spent),visible=!!cupSurface&&fraction>.005&&(brewing||completed);
  if(cupSurface){cupSurface.visible=crema.visible=visible;cupSurface.position.y=cupBase.bottom+(cupBase.top-cupBase.bottom)*fraction;crema.position.y=cupSurface.position.y+.0013;crema.material.opacity=.35+.10*Math.sin(time*1.2);}
  const liquidWorld=cupSurface?cupSurface.getWorldPosition(new THREE.Vector3()):null;
  for(const j of coffeeJets){j.m.visible=brewing&&props.coffee?.g.visible;let end=j.start.clone();end.y=liquidWorld?liquidWorld.y:1.04;connect(j,j.start,end,time);}
  let tap=false;for(const s of segments){if(s.start>time)break;if(s.skill==='turn_tap'&&s.room==='kitchen'&&time>=s.start+(s.end-s.start)*.55)tap=!/close|off|stop/i.test(s.title);}waterJets[0].m.visible=tap&&!active.privacy;waterJets[1].m.visible=false;
  let cue=null;for(const c of teaCues){if(c.time>time)break;cue=c;}
  const age=cue?time-cue.filled:0,blend=cue?.kind==='tea'?clamp(age/14):0;
  if(teaSurface){
   teaSurface.visible=!!cue && cue.kind!=='empty' && time>cue.time+.4;
   teaSurface.material.color.copy(clearWater).lerp(amberTea,blend*blend*(3-2*blend));
   teaSurface.material.opacity=.45+.46*blend;
  }
  waterJets[2].m.visible=(!!cue && cue.kind!=='empty' && time>=cue.time+.2 && time<cue.filled-.2) || value(states,'dev_kitchen_water_dispenser_01','operating_state')==='dispensing';
  for(let i=0;i<waterJets.length;i++){const j=waterJets[i];connect(j,j.start,j.end,time);if(i<2){const g=splashes[i];g.visible=j.m.visible;g.children.forEach((m,k)=>{const u=(time*1.7+k/3)%1;m.scale.setScalar(.5+u*1.5);m.material.opacity=.18*(1-u);});}}
  for(const x of indicators){const on=value(states,x.id,'is_on',false),op=value(states,x.id,'operating_state','idle'),playing=value(states,x.id,'playback_state')==='playing';let level=0;
   if(x.mode==='music')level=on?(playing?1.4+.6*Math.sin(time*2.1)+.15*Math.sin(time*7.7):.15):0;
   else if(x.mode==='coffee')level=on?(op==='brewing'?.8+.15*Math.sin(time*3):.25):0;
   else if(x.mode==='cavityLamp'||x.mode==='cavityWall')level=['working','running','heating'].includes(op)?(x.mode==='cavityLamp'?.82:.16):0;
   else if(x.mode==='operating')level=!['idle','off','completed'].includes(op)?1.2:.02;
   else level=on?.7:0;
   for(const m of x.mats)m.emissiveIntensity=level;
  }
  for(const x of drums){const op=value(states,x.id,'operating_state','idle'),running=['washing','rinsing','spinning','drying'].includes(op);x.g.rotation.z=running?(op==='spinning'?time*12:Math.sin(time*.36)*Math.PI*2.4):0;}
  Object.assign(state,{time,teaTint:blend,teaSurfaceVisible:!!teaSurface?.visible,microwaveLamp:indicators.find(x=>x.mode==='cavityLamp')?.mats[0]?.emissiveIntensity??0,coffeeBrewing:brewing,coffeeFill:fraction,coffeeJetsVisible:coffeeJets.filter(j=>j.m.visible).length,water:waterJets.map(j=>j.m.visible),activeIndicators:indicators.filter(x=>x.mats.some(m=>m.emissiveIntensity>.1)).map(x=>x.id)});
 }
 return {roots,update,coverage,state};
}
