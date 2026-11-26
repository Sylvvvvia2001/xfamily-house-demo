import {holdConstraint} from '../supports/interaction/held-orientation.js';
import {detachedMatrix} from '../supports/interaction/support-contact.js';
// Deterministic, seekable playback of the current graph-selected source intervals.
// No scheduler, fallback animation selection, or source event time modification.
export function createSequenceRuntime(THREE,{segments,bones,actor,props,motion}){
 const conv=new THREE.Matrix4().set(1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1),inv=conv.clone().invert();
 const mat=a=>new THREE.Matrix4().set(...a.flat()),vec=a=>new THREE.Vector3(a[0],a[2],-a[1]);
 const root=motion.parents.indexOf(-1),names=motion.bone_names.map(x=>x.split(':').at(-1)),byId=new Map(segments.map(s=>[s.id,s]));
 const ease=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x)};
 const quat=new THREE.Quaternion(),temp=new THREE.Vector3(),tempQ=new THREE.Quaternion();
 let active=segments[0],time=0;
 const diagnostic={schema:'graph-runtime.1',samples:0,missingMeshes:[],privacyActorHidden:true};
 function at(items,t,field='start'){let lo=0,hi=items.length;while(lo<hi){const m=(lo+hi)>>1;if(items[m][field]<=t)lo=m+1;else hi=m;}return items[Math.max(0,lo-1)];}
 function profileAt(xs,ys,x){let k=1;while(k<xs.length-1&&xs[k]<x)k++;return THREE.MathUtils.lerp(ys[k-1],ys[k],THREE.MathUtils.clamp((x-xs[k-1])/Math.max(1e-9,xs[k]-xs[k-1]),0,1));}
 function routeProgress(s,t){const r=s.routePlan,u=THREE.MathUtils.clamp((t-r.start)/(r.end-r.start),0,1);return r.timeFractions?profileAt(r.timeFractions,r.distanceFractions,u):u;}
 function routePhase(s,t){
  const r=s.routePlan,dt=THREE.MathUtils.clamp(t-r.start,0,r.end-r.start),phase=at(r.phases,dt,'t0');
  return {phase,dt,elapsed:THREE.MathUtils.clamp(dt-phase.t0,0,phase.duration)};
 }
 function gaitFrame(s,p,elapsed){
  if(p.kind==='turn')return Math.min(p.frame1,p.frame0+elapsed*s.fps*p.rate);
  if(p.kind==='walk')return (elapsed*s.fps*p.rate)%(s.walkFrames-1);
  const phases=s.routePlan.phases,prior=phases[phases.indexOf(p)-1];
  return prior?gaitFrame(s,prior,prior.duration):0;
 }
 function frame(s,t){
  if(!s.windows)return 0;
  if(s.routePlan?.phases){const {phase,elapsed}=routePhase(s,t);return gaitFrame(s,phase,elapsed);}
  const dt=Math.max(0,t-s.start),w=at(s.windows,dt),f=w.hold?w.frame0:w.frame0+(dt-w.start)*s.fps*w.rate;
  return THREE.MathUtils.clamp(f,Math.min(w.frame0,w.frame1),Math.max(w.frame0,w.frame1));
 }
 function raw(s,f,i,p,q){const a=Math.min(s.frames-1,Math.max(0,f)),j=Math.floor(a),k=Math.min(j+1,s.frames-1),u=a-j,off=(j*bones.length+i)*10,off2=(k*bones.length+i)*10;p.fromArray(s.pose,off);temp.fromArray(s.pose,off2);p.lerp(temp,u);q.fromArray(s.pose,off+3);tempQ.fromArray(s.pose,off2+3);q.slerp(tempQ,u);}
 for(const s of segments){
  if(!s.anchor)continue;
  s._matrix=conv.clone().multiply(mat(s.anchor)).multiply(inv);s._rotation=new THREE.Quaternion().setFromRotationMatrix(s._matrix);
  if(s.routePlan){
   let pts=s.routePlan.waypoints.map(p=>new THREE.Vector2(...p));
   // Corner cutting stays inside the small triangle around each route turn.
   for(let pass=0;pass<2&&pts.length>2&&!s.routePlan.curvePrechecked;pass++){const next=[pts[0]];for(let i=0;i<pts.length-1;i++){next.push(pts[i].clone().lerp(pts[i+1],.25),pts[i].clone().lerp(pts[i+1],.75));}next.push(pts.at(-1));pts=next;}
   s._route=pts;s._distance=[0];for(let i=1;i<pts.length;i++)s._distance.push(s._distance.at(-1)+pts[i].distanceTo(pts[i-1]));
  }
 }
 function route(s,t,p,q){
  const u=routeProgress(s,t),pts=s._route,l=s._distance.at(-1),d=u*l;
  let k=1;while(k<s._distance.length-1&&s._distance[k]<d)k++;
  const a=pts[k-1]||pts[0],b=pts[k]||a,v=b.clone().sub(a),f=(d-s._distance[k-1])/Math.max(1e-6,s._distance[k]-s._distance[k-1]);
  const x=a.x+v.x*f,y=a.y+v.y*f;
  let angle=Math.atan2(v.y,v.x),a0=s.routePlan.yaw0*Math.PI/180,a1=s.routePlan.yaw1*Math.PI/180;
  const shortest=(a,b)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a));
  if(s.routePlan.headings){const h=s.routePlan.headings;angle=THREE.MathUtils.lerp(h[k-1],h[k],f);}else{angle=a0+(shortest(a0,angle)-a0)*ease(u/.13);angle+=(shortest(angle,a1)-angle)*ease((u-.87)/.13);}
  // q already includes the source's anchor heading. Supply path heading only.
  let old=s.routeSourceYaw*Math.PI/180;
  if(s.routePlan.phases){
   const {phase,elapsed}=routePhase(s,t);
   if(phase.kind==='turn'){
    const src=motion.nativeTurns[phase.source],f=gaitFrame(s,phase,elapsed)-src.offset,j=Math.floor(f);
    const yaw=THREE.MathUtils.lerp(src.yaw[j],src.yaw[Math.min(j+1,src.count-1)],f-j);
    angle=(phase.yaw0+yaw-src.yaw[0])*Math.PI/180;
    old=yaw*Math.PI/180+Math.atan2(s.anchor[1][0],s.anchor[0][0]);
   }else if(phase.kind==='walk'){
    // At a hard corner each travel leg uses its own forward tangent.
    const h=s.routePlan.headings,left=k-1===phase.firstVertex?phase.yaw0*Math.PI/180:h[k-1],right=k===phase.lastVertex?phase.yaw1*Math.PI/180:h[k];
    angle=left+Math.atan2(Math.sin(right-left),Math.cos(right-left))*f;
   }else if(phase.kind==='settle'){
    angle=phase.yaw1*Math.PI/180;
    const prior=s.routePlan.phases[s.routePlan.phases.indexOf(phase)-1];
    if(prior?.kind==='turn'){
     const src=motion.nativeTurns[prior.source];old=(src.yaw[0]+prior.yaw1-prior.yaw0)*Math.PI/180+Math.atan2(s.anchor[1][0],s.anchor[0][0]);
    }
   }
  }
  const rot=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle-old);
  q.premultiply(rot);const rp=s.routePlan.waypoints;p.x=x+THREE.MathUtils.lerp(s.routeStartRoot[0]-rp[0][0],s.routeEndRoot[0]-rp.at(-1)[0],u);p.z=-y-THREE.MathUtils.lerp(s.routeStartRoot[1]-rp[0][1],s.routeEndRoot[1]-rp.at(-1)[1],u);
  // Preserve the source pelvis excursion around its forward stride or turning
  // support. Only remove net displacement already supplied by the routed root.
  if(s.routePlan.phases){
   const {phase,elapsed}=routePhase(s,t);
   if(phase.kind!=='settle'){
    const isTurn=phase.kind==='turn',first=isTurn?phase.frame0:0,last=isTurn?phase.frame1:s.walkFrames-1;
    const f=gaitFrame(s,phase,elapsed),fraction=(f-first)/Math.max(1e-8,last-first);
    const datum=(fi,k)=>{const j=Math.floor(fi),lo=(j*bones.length+root)*10+k,hi=(Math.min(j+1,s.frames-1)*bones.length+root)*10+k;return THREE.MathUtils.lerp(s.pose[lo],s.pose[hi],fi-j);};
    const residual=[0,1,2].map(k=>datum(f,k)-THREE.MathUtils.lerp(datum(first,k),datum(last,k),fraction));
    const anchorYaw=Math.atan2(s.anchor[1][0],s.anchor[0][0]),align=isTurn?phase.yaw0*Math.PI/180-motion.nativeTurns[phase.source].yaw[0]*Math.PI/180:angle-old+anchorYaw;
    p.x+=Math.cos(align)*residual[0]+Math.sin(align)*residual[2];
    p.z+=-Math.sin(align)*residual[0]+Math.cos(align)*residual[2];
    p.y=THREE.MathUtils.lerp(s.routeStartRoot[2],s.routeEndRoot[2],u)+residual[1];
   }else p.y=s.routeEndRoot[2];
  }else p.y=THREE.MathUtils.lerp(s.routeStartRoot[2],s.routeEndRoot[2],u)+(p.y-(s.routeSourceHipY??p.y));

 }

 // One clock owns pose, support correction and source-root compensation.
 // A loop overlap must never blend the skeleton while jumping its support datum.
 function sourceSamples(s,t){
  if(s.routePlan)return [{f:frame(s,t),w:1}];
  const dt=Math.max(0,t-s.start),w=at(s.windows,dt),i=s.windows.indexOf(w),next=s.windows[i+1],f=frame(s,t);
  const overlap=next?Math.min(.22,(w.end-w.start)*.18,(next.end-next.start)*.18):0;
  if(overlap&&dt>w.end-overlap){
   const before=dt-w.end,u=ease(1+before/overlap);
   // Sample real source pre-roll where available; never warp either clock.
   const incoming=THREE.MathUtils.clamp(next.frame0+before*s.fps*next.rate,0,s.frames-1);
   return [{f,w:1-u},{f:incoming,w:u}];
  }
  return [{f,w:1}];
 }
 function stabilize(s,t,p){
  if(!s.rootLock)return;const track=motion.stabilizers?.[s.branch_id]?.[s.rootLock];if(!track)return;
  const point=f=>{f=Math.max(0,Math.min(track.length-1,f||0));const a=Math.floor(f),b=Math.min(track.length-1,a+1);return new THREE.Vector3(...track[a]).lerp(new THREE.Vector3(...track[b]),f-a)};
  const now=new THREE.Vector3();for(const v of sourceSamples(s,t))now.addScaledVector(point(v.f),v.w);
  const delta=point(frame(s,s.start)).sub(now);if(s.rootLock==='feet')delta.z=0;
  p.add(vec(delta.toArray()).applyQuaternion(s._rotation));
 }
 // Cache each declared endpoint. Arm masks are carried through chains without
 // recursive evaluation or accumulating pose drift while scrubbing backwards.
 const terminal=new Map(),seatSupports=new Map();
 for(const s of segments){
  if(!s.pose)continue;
  const end=frame(s,s.end),qs=[],ps=[];s._overrides={};
  const seated=s.state_before?.posture==='seated'&&!['stand_up','get_up','lie_down'].includes(s.skill);s._seat=seated?seatSupports.get(s.siteBefore):null;
  const prev=terminal.get(s.previousStepId),carry=terminal.get(s.carryFromStep||s.previousStepId),hands=s.handsBefore||{};
  for(let i=0;i<bones.length;i++){
   const p=new THREE.Vector3(),q=new THREE.Quaternion();raw(s,end,i,p,q);
   if(i===root){p.applyMatrix4(s._matrix);q.premultiply(s._rotation);if(s._route)route(s,s.end,p,q);else stabilize(s,s.end,p);if(s.postureVerticalCorrection)p.y+=s.postureVerticalCorrection;if(s.postureApproachDelta&&s.skill==='stand_up'){p.x+=s.postureApproachDelta[0];p.z-=s.postureApproachDelta[1];}}
   const name=names[i],side=name.startsWith('Left')?'left':name.startsWith('Right')?'right':null;
   const isArm=/Shoulder|Arm|Hand/.test(name),mask=s.bodyMask;
   if(mask&&prev&&i!==root&&!name.startsWith('Left'))s._overrides[i]=prev.q[i];
   if(side&&isArm&&hands[side]&&carry&&(s.carryFromStep||s.composition?.preserveArmFingerPose||(['left','right'].includes(s.activeHand)&&s.activeHand!==side)))s._overrides[i]=carry.q[i];
   if((s.preserveSourceUpper||s.preserveCoffeeSource)&&isArm)delete s._overrides[i];seatedUpper(s,s.end,i,q);if(s._overrides[i])q.fromArray(s._overrides[i]);if(s.naturalPause&&prev){p.fromArray(prev.p[i]);q.fromArray(prev.q[i]);}
   if(s._seat&&(i===root||/UpLeg|Leg|Foot|Toe/.test(name))){q.fromArray(s._seat.q[i]);if(i===root)p.fromArray(s._seat.p[i]);}ps.push(p.toArray());qs.push(q.toArray());
  }
  terminal.set(s.id,{p:ps,q:qs});if(s.skill==='sit_down')seatSupports.set(s.siteAfter,{p:ps,q:qs});
 }
 function sourceRootRotation(s,t){const p=new THREE.Vector3(),q=new THREE.Quaternion();loopPose(s,t,root,p,q);return q.premultiply(s._rotation);}
 function seatedUpper(s,t,i,q){if(s._seat&&names[i]==='Spine'){const original=sourceRootRotation(s,t),supported=new THREE.Quaternion().fromArray(s._seat.q[root]);q.premultiply(supported.invert().multiply(original));}}
 function loopPose(s,t,i,p,q){
  const samples=sourceSamples(s,t);raw(s,samples[0].f,i,p,q);
  if(samples.length>1){const pp=new THREE.Vector3(),qq=new THREE.Quaternion();raw(s,samples[1].f,i,pp,qq);p.lerp(pp,samples[1].w);q.slerp(qq,samples[1].w);}
 }
 function pose(s,t,i,p,q,transition=true,phaseBlend=true){
  if(s.routePlan?.phases){
   const {phase,elapsed}=routePhase(s,t);
   if(phaseBlend){
    // Integrate a fixed-width blend across all nearby phase boundaries. A
    // 5 mm connector must not switch the full gait pose on and off in 4 ms.
    const parts=s.routePlan.phases,dt=t-s.start,h=.10;
    if(parts.some((v,k)=>k&&Math.abs(dt-v.t0)<h)){
     const pp=new THREE.Vector3(),qq=new THREE.Quaternion();let total=0;
     for(let k=0;k<parts.length;k++){
      const part=parts[k],left=k?ease(.5+(dt-part.t0)/(2*h)):1,right=k+1<parts.length?ease(.5+(dt-part.t1)/(2*h)):0,w=left-right;
      if(w<=1e-8)continue;
      const tLocal=THREE.MathUtils.clamp(dt,part.t0+1e-6,part.t1-1e-6);pose(s,s.start+tLocal,i,pp,qq,false,false);
      if(!total){p.copy(pp);q.copy(qq);}else{p.lerp(pp,w/(total+w));q.slerp(qq,w/(total+w));}total+=w;
     }
     if(total)return;
    }
   }
   if(phase.kind==='settle'&&s.routeSettleTarget){const target=byId.get(s.routeSettleTarget);
    if(target?.pose&&!target.routePlan&&elapsed>1e-7){const pp=new THREE.Vector3(),qq=new THREE.Quaternion();pose(s,s.start+phase.t0,i,p,q,false,false);pose(target,target.start,i,pp,qq,false);const u=ease(elapsed/Math.min(.24,phase.duration));p.lerp(pp,u);q.slerp(qq,u);return;}}
  }

  if(s.naturalPause){const x=terminal.get(s.id);if(x){p.fromArray(x.p[i]);q.fromArray(x.q[i]);return;}}
  loopPose(s,t,i,p,q);if(i===root){p.applyMatrix4(s._matrix);q.premultiply(s._rotation);if(s._route)route(s,t,p,q);else stabilize(s,t,p);if(s.postureVerticalCorrection)p.y+=s.postureVerticalCorrection*ease((t-s.start)/(s.end-s.start));if(s.postureApproachDelta){const u=ease((t-s.start)/(s.end-s.start)),w=s.skill==='stand_up'?u:1-u;p.x+=s.postureApproachDelta[0]*w;p.z-=s.postureApproachDelta[1]*w;}}
  seatedUpper(s,t,i,q);
  if(s._overrides[i])q.fromArray(s._overrides[i]);if(s._seat&&(i===root||/UpLeg|Leg|Foot|Toe/.test(names[i]))){q.fromArray(s._seat.q[i]);if(i===root)p.fromArray(s._seat.p[i]);}
  if(transition&&s.transitionToStepId){const prev=byId.get(s.transitionFromStepId);if(prev?.pose)pose(prev,prev.end,i,p,q,false);const n=byId.get(s.transitionToStepId);if(n?.pose){const p1=new THREE.Vector3(),q1=new THREE.Quaternion();pose(n,n.start,i,p1,q1,false);const u=ease((t-s.start)/(s.end-s.start));p.lerp(p1,u);q.slerp(q1,u);}}
 }
 // Evaluate a single chain without mutating the live actor; usable for seekable
 // contact targets and deterministic foot plants on curved routes.
 function jointAt(s,t,j){const chain=[];for(let i=j;i>=0;i=motion.parents[i])chain.unshift(i);const M=new THREE.Matrix4();for(const i of chain){const p=new THREE.Vector3(),q=new THREE.Quaternion();pose(s,t,i,p,q,false);M.multiply(new THREE.Matrix4().compose(p,q,new THREE.Vector3(1,1,1)));}return M;}
 function setWorldRotation(b,q){b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));b.updateWorldMatrix(false,true);}
 function solveLimb(upperName,lowerName,endName,target,orientation){
  const a=bones[names.indexOf(upperName)],b=bones[names.indexOf(lowerName)],c=bones[names.indexOf(endName)],A=a.getWorldPosition(new THREE.Vector3()),B=b.getWorldPosition(new THREE.Vector3()),C=c.getWorldPosition(new THREE.Vector3()),l1=A.distanceTo(B),l2=B.distanceTo(C),v=target.clone().sub(A),requested=v.length();
  if(requested<1e-6)return;const dist=Math.min(l1+l2-.001,Math.max(Math.abs(l1-l2)+.001,requested)),dir=v.normalize(),bend=B.clone().sub(A).addScaledVector(dir,-B.clone().sub(A).dot(dir));if(bend.lengthSq()<1e-7)bend.set(0,0,1).addScaledVector(dir,-dir.z);bend.normalize();const along=(l1*l1-l2*l2+dist*dist)/(2*dist),height=Math.sqrt(Math.max(0,l1*l1-along*along)),elbow=A.clone().addScaledVector(dir,along).addScaledVector(bend,height);
  const aq=a.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromUnitVectors(B.clone().sub(A).normalize(),elbow.clone().sub(A).normalize()));setWorldRotation(a,aq);
  const nowB=b.getWorldPosition(new THREE.Vector3()),nowC=c.getWorldPosition(new THREE.Vector3()),bq=b.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromUnitVectors(nowC.sub(nowB).normalize(),target.clone().sub(nowB).normalize()));setWorldRotation(b,bq);if(orientation)setWorldRotation(c,orientation);
 }
 // Drift compensation is a common world-space translation. It must never
 // overwrite the registered hip, knee, ankle or toe rotations.
 function contacts(){
  const desk=active.room==='study'&&active.state_before?.posture==='seated';
  if(desk&&active.skill==='type'){
   for(const side of ['Left','Right']){const hand=bones[names.indexOf(side+'Hand')],j=names.indexOf(side+'Hand'),reference=jointAt(active,active.start,j),orientation=new THREE.Quaternion().setFromRotationMatrix(reference);
    // Retain the registered typing hand and reduce only extreme finger excursions.
    for(let i=0;i<bones.length;i++)if(names[i].startsWith(side+'Hand')&&i!==j){const p=new THREE.Vector3(),q=new THREE.Quaternion();raw(active,motion.typingFingerReference?.[active.branch_id]?.[side]??active.windows[0].frame0,i,p,q);bones[i].quaternion.copy(q.slerp(bones[i].quaternion,.10));}
    setWorldRotation(hand,orientation);actor.updateMatrixWorld(true);const tips=['Index','Middle','Ring','Pinky'].map(n=>bones[names.indexOf(side+'Hand'+n+'4')].getWorldPosition(new THREE.Vector3())),mean=tips.reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(.25),goal=mean.clone();goal.x=THREE.MathUtils.clamp(goal.x,side==='Left'?-.48:-.30,side==='Left'?-.34:-.16);const lo=Math.min(...tips.map(p=>p.y)),hi=Math.max(...tips.map(p=>p.y));goal.y=mean.y+(.980-lo);goal.z=THREE.MathUtils.clamp(goal.z,8.34,8.40);const target=hand.getWorldPosition(new THREE.Vector3()).add(goal.sub(mean));solveLimb(side+'Arm',side+'ForeArm',side+'Hand',target,hand.getWorldQuaternion(new THREE.Quaternion()));}
  }
  if(desk&&/use_computer_mouse/.test(active.branch_id||'')){
   const spec=motion.deskContact?.mouse;if(spec){
    for(const[ix,q]of Object.entries(spec.fingerLocal||{}))bones[+ix].quaternion.fromArray(q);
    actor.updateMatrixWorld(true);const M=mat(spec.original);M.setPosition(new THREE.Vector3(...spec.center));const targetM=conv.clone().multiply(M).multiply(mat(spec.H).invert()),p=new THREE.Vector3().setFromMatrixPosition(targetM),q=new THREE.Quaternion().setFromRotationMatrix(targetM),hand=bones[names.indexOf('RightHand')];
    const current=hand.getWorldPosition(new THREE.Vector3());p.x+=THREE.MathUtils.clamp(current.x-p.x,-.012,.012);p.z+=THREE.MathUtils.clamp(current.z-p.z,-.012,.012);
    solveLimb('RightArm','RightForeArm','RightHand',p,q);
   }
  }
  actor.updateMatrixWorld(true);
 }
 function gripMatrix(n,hand){const i=names.indexOf(hand+'Hand');let H=n.spec[hand==='Left'?'H_left':'H'];
  if(n.spec===props.phone?.spec){let s=active;for(let k=0;s&&k<50;k++,s=byId.get(s.carryFromStep||s.previousStepId)){if(s.phonePoseH){H=s.phonePoseH;break;}if(!s.handsBefore?.right&&!s.handsAfter?.right)break;}}
  return mat(H);
 }
 function heldTransform(n,hand){
  const H=gripMatrix(n,hand),bone=bones[names.indexOf(hand+'Hand')];
  const raw=inv.clone().multiply(bone.matrixWorld).multiply(H);
  return {raw,constraint:holdConstraint(THREE,n,hand,raw,H,active,time)};
 }
 function handMatrix(n,hand){
  const {raw,constraint}=heldTransform(n,hand);
  if(n.orientationPolicy==='authored_heading')return constraint?.matrix||raw;
  // After contact the corrected hand itself carries the complete registered transform.
  const e=eventFor(n,time);
  if((e?.kind==='acquire'&&time<e.end)||(e?.kind==='release'&&!e.contact))return constraint?.matrix||raw;
  return raw;
 }
 function pocketMatrix(){
  const a=bones[names.indexOf('RightUpLeg')],b=bones[names.indexOf('RightLeg')],p=a.getWorldPosition(new THREE.Vector3()).lerp(b.getWorldPosition(new THREE.Vector3()),.20);
  const q=a.getWorldQuaternion(new THREE.Quaternion());return inv.clone().multiply(new THREE.Matrix4().compose(p,q,new THREE.Vector3(1,1,1)));
 }
 function interpolate(a,b,u){const p=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),p2=new THREE.Vector3(),q2=new THREE.Quaternion(),sc2=new THREE.Vector3();a.decompose(p,q,sc);b.decompose(p2,q2,sc2);return new THREE.Matrix4().compose(p.lerp(p2,u),q.slerp(q2,u),sc.lerp(sc2,u));}
 function eventFor(n,t){let e=null;for(const v of n.spec.events){if((v.contact?.at??v.start)<=t)e=v;}return e;}
 function fingers(phoneOnly){
  for(const [key,n]of Object.entries(props)){
   if((key==='phone')!==phoneOnly)continue;
   const e=eventFor(n,time);if(!e)continue;let w=0,h=e.hand;
   if(e.kind==='acquire')w=ease((time-e.start)/Math.max(.001,e.end-e.start));
   if(e.kind==='release')w=1-ease((time-(e.contact?.at??e.start))/Math.max(.001,(e.contact?.settled??e.end)-(e.contact?.at??e.start)));
   if(w<=0||!h)continue;if(key==='phone'&&(active.preserveSourceUpper||active.phonePoseH))continue;
   for(const [ix,q]of Object.entries(n.spec.fingerLocal?.[h.toLowerCase()]||{})){
    if(active.skill==='operate_device'&&key==='remote'&&names[+ix].includes('Thumb'))continue;
    bones[+ix].quaternion.slerp(quat.fromArray(q),w);
   }
  }
 }
 function wrists(){
  actor.updateMatrixWorld(true);
  for(const n of Object.values(props)){
   const e=eventFor(n,time);if(!e?.hand||!['acquire','release'].includes(e.kind))continue;
   const releaseAt=e.contact?.at??e.start,releaseEnd=e.contact?.settled??e.end;
   const weight=e.kind==='acquire'?ease((time-e.start)/Math.max(.001,e.end-e.start)):1-ease((time-releaseAt)/Math.max(.001,releaseEnd-releaseAt));
   if(!weight)continue;
   const {constraint}=heldTransform(n,e.hand);if(!constraint)continue;
   const bone=bones[names.indexOf(e.hand+'Hand')],fore=bones[names.indexOf(e.hand+'ForeArm')],cq=new THREE.Quaternion().setFromRotationMatrix(conv);
   const correction=cq.clone().multiply(constraint.correction).multiply(cq.invert());
   const full=n.orientationPolicy!=='authored_heading';
   const strength=full?weight:Math.min(1,.4/Math.max(1e-8,correction.angleTo(new THREE.Quaternion())))*weight;
   const delta=new THREE.Quaternion().slerp(correction,strength);
   const desired=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(delta);
   if(full){
    // Put pronation/supination on the forearm. Rotation about the elbow-wrist
    // line preserves the wrist endpoint; the wrist supplies only the remaining swing.
    const axis=bone.getWorldPosition(new THREE.Vector3()).sub(fore.getWorldPosition(new THREE.Vector3())).normalize();
    const projection=delta.x*axis.x+delta.y*axis.y+delta.z*axis.z;
    const twist=THREE.MathUtils.clamp(2*Math.atan2(projection,delta.w),-1.20,1.20);
    setWorldRotation(fore,fore.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromAxisAngle(axis,twist)));
   }
   setWorldRotation(bone,desired);

  }
 }
 function objects(){
  for(const [key,n]of Object.entries(props)){
   const e=eventFor(n,time);let M=mat(n.spec.initial),visible=n.spec.initialVisible!==false;if(key==='phone'&&n.spec.initialPocket){M=pocketMatrix();visible=true;}
   if(e){
    const u=ease((time-e.start)/Math.max(.001,e.end-e.start));
    if(e.kind==='hide')visible=false;
    else if(e.kind==='place'){M=key==='phone'&&e.hideAfter?pocketMatrix():mat(e.target);visible=key==='phone'||!e.hideAfter;}
    else if(e.kind==='contained'){const parent=props[e.parent];M=parent?.current?.clone()||M;visible=!!parent?.g.visible;M.elements[14]+=(parent?.spec.size?.[2]||.03)*.35;}
    else if(e.kind==='acquire'){
     visible=true;const from=key==='phone'&&e.fromPocket?pocketMatrix():mat(e.from);M=interpolate(from,handMatrix(n,e.hand),u);if(u<1)M.elements[14]+=.018*Math.sin(Math.PI*u);
     
    }else if(e.kind==='release'){const target=key==='phone'&&e.hideAfter?pocketMatrix():mat(e.target);M=e.contact?detachedMatrix(e,n,time,mat,interpolate):u>=1?target:interpolate(handMatrix(n,e.hand),target,u);visible=key==='phone'||!(e.hideAfter&&u>=1);}
   }
   n.current=M;n.g.visible=visible&&!active.privacy&&!active.textOnly&&!(active.hidden&&e?.kind==='acquire');
   const delta=conv.clone().multiply(M).multiply(n.inverse).multiply(inv);delta.decompose(n.g.position,n.g.quaternion,n.g.scale);n.g.updateMatrixWorld(true);
  }
  // Resolve containment after all carriers, independent of object dictionary order.
  for(const n of Object.values(props)){const e=eventFor(n,time);if(e?.kind!=='contained')continue;const parent=props[e.parent];if(!parent?.current)continue;const M=parent.current.clone();M.elements[14]+=(parent.spec.size?.[2]||.03)*.35;n.current=M;n.g.visible=parent.g.visible;const delta=conv.clone().multiply(M).multiply(n.inverse).multiply(inv);delta.decompose(n.g.position,n.g.quaternion,n.g.scale);n.g.updateMatrixWorld(true);}
 }
 function sample(t){
  time=t;active=at(segments,t);actor.visible=!active.hidden&&!active.privacy&&!active.textOnly;
  if(active.pose){
   const idx=segments.indexOf(active),next=segments[idx+1],prev=segments[idx-1];
   // Start the incoming source on its own clock. A centred crossfade uses
   // the adjacent endpoint outside each clip, without advancing then rewinding it.
   let target=null,u=0,baseTime=t,targetTime=t;
   const width=(a,b)=>Math.min(b?.blend_seconds||0,(a?.end-a?.start||0)*.2,(b?.end-b?.start||0)*.2);
   const after=width(active,next)*.5,before=width(prev,active)*.5;
   if(after&&next?.pose&&!active.hidden&&!next.hidden&&Math.abs(next.start-active.end)<.002&&t>=next.start-after){
    target=next;targetTime=next.start;u=ease(.5+(t-next.start)/(2*after));
   }else if(before&&prev?.pose&&!active.hidden&&!prev.hidden&&Math.abs(prev.end-active.start)<.002&&t<active.start+before){
    target=prev;targetTime=prev.end;u=1-ease(.5+(t-active.start)/(2*before));
   }
   const original=active,realTime=time;
   function posed(segment,at){active=segment;time=at;for(let i=0;i<bones.length;i++){const p=new THREE.Vector3(),q=new THREE.Quaternion();pose(segment,at,i,p,q);bones[i].position.copy(p);bones[i].quaternion.copy(q);bones[i].scale.set(1,1,1);}actor.updateMatrixWorld(true);contacts();fingers(true);}
   posed(original,baseTime);
   if(target){const ps=bones.map(b=>b.position.clone()),qs=bones.map(b=>b.quaternion.clone());posed(target,targetTime);for(let i=0;i<bones.length;i++){bones[i].position.lerpVectors(ps[i],bones[i].position.clone(),u);bones[i].quaternion.copy(qs[i].slerp(bones[i].quaternion,u));}}
   active=original;time=realTime;actor.updateMatrixWorld(true);fingers(false);wrists();
  }
  objects();diagnostic.samples++;diagnostic.privacyActorHidden=!(active.privacy||active.textOnly)||!actor.visible;
  return active;
 }
 return {sample,frame,diagnostic,props,terminal,jointAt,updateObjects:objects,heldMatrix:handMatrix};
}
