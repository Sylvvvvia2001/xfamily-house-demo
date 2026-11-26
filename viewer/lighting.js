// Deterministic visual lighting driven by the same device state snapshot as the dashboard.
// Indoor bounce is an explicit real-time approximation, not a baked Cycles light field.
export function createHouseLighting(THREE,scene,hemi,house,stats){
 const P=a=>new THREE.Vector3(a[0],a[2],-a[1]), clamp=THREE.MathUtils.clamp;
 const roomKey=r=>({'01_Living':'living','02_Dining':'dining','03_Kitchen':'kitchen','04_Bedroom':'bedroom','05_Study':'study','06_Balcony':'balcony','07_Bathroom':'bathroom','08_Hallway':'hallway','09_Entry':'entry'}[r]);
 const ids=r=>'dev_'+({living:'living_room',dining:'dining_room'}[r]||r);
 const bindings=[],daylights=[],roots=[],seen=new Set();
 function kelvin(k){const t=clamp(k||3000,1800,10000)/100;const r=t<=66?255:329.698727446*Math.pow(t-60,-.13320476),g=t<=66?99.4708025861*Math.log(t)-161.1195681661:288.1221695283*Math.pow(t-60,-.07551485),b=t>=66?255:t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307;return new THREE.Color().setRGB(clamp(r,0,255)/255,clamp(g,0,255)/255,clamp(b,0,255)/255,THREE.SRGBColorSpace);}
 function spot(name,room,pos,target,power,angle=1.32){const l=new THREE.SpotLight('#fff0d9',0,10,angle,.85,2);l.name=name;l.position.copy(P(pos));l.target.position.copy(P(target));l.userData.shadowEligible=true;l.userData.shadowRoom=room;l.userData.visualRoom=room;l.shadow.mapSize.set(2048,2048);l.shadow.bias=-.00015;l.shadow.normalBias=.002;l.shadow.camera.near=.04;l.shadow.camera.layers.enable(1);scene.add(l,l.target);return l;}
 function inverseMetalMask(m){const tex=m.metalnessMap;if(!tex?.image)return null;try{const image=tex.image,c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const pix=ctx.getImageData(0,0,c.width,c.height);for(let i=0;i<pix.data.length;i+=4){const v=255-pix.data[i+2];pix.data[i]=pix.data[i+1]=pix.data[i+2]=v;pix.data[i+3]=255;}ctx.putImageData(pix,0,0);const t=new THREE.CanvasTexture(c);t.flipY=tex.flipY;t.wrapS=tex.wrapS;t.wrapT=tex.wrapT;t.repeat.copy(tex.repeat);t.offset.copy(tex.offset);t.rotation=tex.rotation;t.channel=tex.channel;t.colorSpace=THREE.NoColorSpace;return t;}catch{return null;}}
 function bindFixture(rootName,room,id,bounds,kind='ceiling',onlyName=null){
  const [lo,hi]=bounds,center=lo.map((x,i)=>(x+hi[i])/2),power=kind==='downlight'?38:kind==='desk'?60:kind==='floor'?125:280;
  const z=kind==='floor'?hi[2]-.1:kind==='desk'?hi[2]-.025:lo[2]-.018,pos=[center[0],center[1],z];
  const target=[center[0],center[1],kind==='downlight'?.95:.35];if(kind==='desk')target[1]-=.32;
  const l=spot('fixture_'+room+'_'+bindings.length,room,pos,target,power,kind==='downlight'?.60:1.32),mats=[];
  // Only diffuser/bulb slots emit; housing, chrome and screws keep original PBR.
  scene.traverse(o=>{if(!o.isMesh)return;let meta=o;while(meta&&!meta.userData.source_root)meta=meta.parent;if(meta?.userData.source_root!==rootName||onlyName&&meta.userData.source_object!==onlyName)return;roots.push(o);const name=meta.userData.source_object||o.name;const list=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const glow=/opal_glass_diffuser|LEDLens|__Lens/.test(name)||/LEDGlow|emissive_white/i.test(m.name)||(/NativePBR/.test(m.name)&&m.emissive?.getHex()>0);if(!glow)return m;const n=m.clone();n.emissive=new THREE.Color(0);n.emissiveIntensity=0;if(/NativePBR/.test(n.name)&&!n.emissiveMap)n.emissiveMap=inverseMetalMask(n);n.needsUpdate=true;mats.push(n);return n;});o.material=Array.isArray(o.material)?list:list[0];});
  const bounce=new THREE.PointLight('#ffe2b8',0,kind==='downlight'?1.4:3.8,2);bounce.position.copy(P([center[0],center[1],Math.min(2.1,z-.15)]));bounce.userData.visualRoom=room;scene.add(bounce);
  bindings.push({id,room,kind,root:rootName,light:l,bounce,mats,power});
 }
 const grouped=new Map();for(const o of house.objects){if(!/CeilingLight|FloorLamp_ABO|CounterDownlight|TableLamp$|VanitySpotLights/.test(o.root))continue;let g=grouped.get(o.root);if(!g){g={room:roomKey(o.room),lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity]};grouped.set(o.root,g);}for(let i=0;i<3;i++){g.lo[i]=Math.min(g.lo[i],o.bounds[0][i]);g.hi[i]=Math.max(g.hi[i],o.bounds[1][i]);}}
 for(const [root,g]of grouped){let kind='ceiling',id=ids(g.room)+'_ceiling_light_01';if(/FloorLamp/.test(root)){kind='floor';id=ids(g.room)+'_floor_lamp_01';}if(/TableLamp/.test(root)){kind='desk';id=ids(g.room)+'_desk_lamp_01';}if(/Downlight/.test(root)){kind='downlight';id='dev_dining_room_downlight_group_01';}if(/VanitySpot/.test(root)){kind='downlight';id='dev_bathroom_downlight_01';}if(/VanitySpot/.test(root)){for(const lens of house.objects.filter(o=>o.root===root&&/__Head_\d+__Lens$/.test(o.name)))bindFixture(root,g.room,id,lens.bounds,kind,lens.name);}else bindFixture(root,g.room,id,[g.lo,g.hi],kind);}
 const windows=[
 ['living',[2.92,-1.25,2.30],[-1.3,-1.1,.25],220,'dev_living_room_curtain_01'],
 ['dining',[-6.95,.75,2.12],[-6.9,-2.1,.5],150,'dev_dining_room_curtain_01'],
 ['kitchen',[-12.17,-.75,2.10],[-10.2,-1.0,.55],170,'dev_kitchen_blind_01'],
 ['bedroom',[1.53,-5.55,2.12],[-2.1,-5.6,.5],180,'dev_bedroom_curtain_01'],
 ['study',[1.53,-9.55,2.12],[-2.1,-9.5,.5],180,'dev_study_curtain_01'],
 ['bathroom',[-7.48,-8.98,2.15],[-7.5,-5.7,.5],135,'dev_bathroom_blind_01'],
 ['balcony',[5.85,-1.6,2.35],[3.65,-1.7,.3],160,null],
 ['hallway',[-4.8,-3.45,2.2],[-4.8,-8,.5],35,null]
 ];
 for(const [room,pos,to,power,curtain]of windows){const l=spot('daylight_'+room,room,pos,to,power);l.color.set('#fff0d6');daylights.push({light:l,power,curtain});}
 stats.lightBindings=bindings.map(b=>({device:b.id,room:b.room,source_root:b.root,emissive_slots:b.mats.length}));
 stats.lightingLimitations=['Real-time window/fixture direct lighting with bounded bounce approximation; not path-traced GI.','Bedroom/study floor lamps and hallway chandelier have no matching physical fixture or device log respectively; no synthetic device events added.'];
 function update(time,states,positions={}){const get=(id,k,f=0)=>k==='position_percent_open'&&positions[id]!==undefined?positions[id]:states[id]?.[k]?.value??f,h=(time%86400)/3600;
  const day=h<6.25||h>18.8?0:Math.pow(Math.max(0,Math.sin((h-6.25)/12.55*Math.PI)),.52);
  hemi.intensity=.025+1.05*day;scene.environmentIntensity=.025+.47*day;
  scene.background.set(day>.02?'#b7c5cf':'#121927');
  for(const b of bindings){const brightness=clamp(Number(get(b.id,'brightness',b.kind==='ceiling'?170:100))/(b.kind==='ceiling'?255:100),0,1),on=!!get(b.id,'is_on'),fraction=on?brightness:0,k=get(b.id,'color_temperature_k',3000),color=kelvin(k);b.light.intensity=b.power*fraction;b.light.visible=fraction>0;b.light.color.copy(color);b.bounce.intensity=b.power*.095*fraction;b.bounce.visible=fraction>0;b.bounce.color.copy(color);for(const m of b.mats){m.emissive.copy(color);m.emissiveIntensity=3.4*fraction;}b.last={on,brightness:brightness*100,kelvin:k,intensity:b.light.intensity};}
  for(const d of daylights){const open=d.curtain?get(d.curtain,'position_percent_open')/100:1;d.light.intensity=d.power*day*(.33+.67*open);d.light.visible=d.light.intensity>.01;}
  stats.lighting={dayFactor:day,time,environment:scene.environmentIntensity,ambient:hemi.intensity,devices:Object.fromEntries(bindings.map(b=>[b.id,b.last]))};
 }
 // Fixed-size render pools keep the GPU shader layout stable across room and state changes.
 // Logical lights above remain available for inspection, but only these nodes enter rendering.
 const spotPool=Array.from({length:8},(_,i)=>{const l=spot('RenderSpot'+i,'pool',[0,0,3],[0,0,0],0);delete l.userData.visualRoom;l.userData.shadowEligible=false;l.castShadow=true;l.shadow.autoUpdate=false;l.shadow.needsUpdate=true;return l;});
 const bouncePool=Array.from({length:4},()=>{const l=new THREE.PointLight('#ffe0bb',0,4,2);scene.add(l);return l;});
 function prepareRender(mode,rooms){
  const logical=[...bindings.map(b=>b.light),...daylights.map(d=>d.light)],allow=l=>mode==='free'||rooms.has(l.userData.visualRoom)||(['living','dining','entry'].includes(l.userData.visualRoom)&&[...rooms].some(r=>['living','dining','entry'].includes(r)));
  const candidates=logical.filter(l=>l.intensity>.01&&allow(l)).sort((a,b)=>{const af=a.name.startsWith('fixture_'),bf=b.name.startsWith('fixture_');return (bf-af)*10000+b.intensity-a.intensity;});
  for(const l of logical)l.visible=false;
  for(let i=0;i<spotPool.length;i++){const dst=spotPool[i],src=candidates[i];dst.visible=true;dst.intensity=src?.intensity||0;if(src){dst.position.copy(src.position);dst.target.position.copy(src.target.position);dst.color.copy(src.color);dst.angle=src.angle;dst.penumbra=src.penumbra;dst.distance=src.distance;dst.decay=src.decay;dst.shadow.needsUpdate=true;}else dst.shadow.needsUpdate=false;}
  const bs=bindings.map(b=>b.bounce).filter(l=>l.intensity>.01&&allow(l)).sort((a,b)=>b.intensity-a.intensity);for(const b of bindings)b.bounce.visible=false;
  for(let i=0;i<bouncePool.length;i++){const dst=bouncePool[i],src=bs[i];dst.intensity=src?.intensity||0;if(src){dst.position.copy(src.position);dst.color.copy(src.color);dst.distance=src.distance;}}
  stats.lighting.renderPool={spots:candidates.slice(0,8).map(l=>l.name),bounces:Math.min(bs.length,4),deferredMinorLights:Math.max(0,candidates.length-8),policy:'Eight shadowed spots and four local bounce lights; actual fixtures prioritized. Stable shaders across seeks; all materials and fixture emitters retained.'};
 }
 return {update,prepareRender,roots,bindings,daylights};
}
