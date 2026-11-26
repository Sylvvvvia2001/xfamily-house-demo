// Overlay registered motion on the support pose already solved by the House player.
export function withRestTransitions(THREE, runtime, {segments,bones,actor,props,motion}, plan) {
  if (plan.version!==1 || plan.sourcePlanSha256!==motion.sourcePlanSha256) throw Error('Rest plan and motion revision differ.');
  const byId=new Map(segments.map(s=>[s.id,s]));
  const layers=new Map();
  const names=motion.bone_names.map(name=>name.split(':').at(-1));
  const unit=new THREE.Quaternion(), out=new THREE.Quaternion(), delta=new THREE.Quaternion();
  const a=new THREE.Quaternion(), b=new THREE.Quaternion(), other=new THREE.Quaternion();
  const smooth=x=>{const u=Math.min(1,Math.max(0,x));return u*u*(3-2*u);};
  function rotation(donor,frame,index,target) {
    const l=Math.floor(frame), h=Math.min(l+1,donor.frames-1);
    a.fromArray(donor.pose,(l*bones.length+index)*10+3);
    b.fromArray(donor.pose,(h*bones.length+index)*10+3);
    return target.copy(a).slerp(b,frame-l);
  }
  function core(donor,clock,index,target) {
    const [lo,hi]=donor.sourceFrameBounds, span=hi-lo;
    const overlap=Math.min(span*.18,donor.fps*.28);
    const period=span-overlap, f=clock%period;
    rotation(donor,lo+f,index,target);
    if (f<overlap) {
      rotation(donor,lo+period+f,index,other);
      target.copy(other.slerp(target,smooth(f/overlap)));
    }
    return target;
  }
  for (const [id,entry] of Object.entries(plan.bindings)) {
    const s=byId.get(id), donor=byId.get(entry.donor);
    if (!s?.naturalPause || s.hidden || s.privacy || s.outside || s.start!==entry.start || s.end!==entry.end ||
        s.state_before.site!==entry.site || s.state_before.posture!==entry.posture ||
        s.state_before.left!==entry.left || s.state_before.right!==entry.right ||
        !donor?.pose || donor.branch_id!==entry.source || donor.phaseLabel!=='core') throw Error('Invalid rest transition '+id);
    const parts=[];
    for (const [i,name] of names.entries()) {
      const arm=/^(Right|Left)(Shoulder|Arm|ForeArm|Hand)/.exec(name);
      const occupied=entry.left!=='empty'||entry.right!=='empty';
      const phoneArm=entry.kind==='phone' && arm?.[1]==='Right';
      // A supported pelvis, planted feet and a carrying arm stay in their solved pose.
      if (!phoneArm && !/^(Head|Neck)$/.test(name) && !(name.startsWith('Spine')&&!occupied) &&
          !(arm && entry[arm[1].toLowerCase()]==='empty' && !name.includes('Hand'))) continue;
      parts.push({i,phoneArm,reference:core(donor,entry.offset,i,new THREE.Quaternion()).invert()});
    }
    // A frozen source sometimes releases into the next reach within its last two frames.
    // Distribute the same upper-body preparation over the end of this pause only.
    const lead=Math.min(.7,(s.end-s.start)*.85);
    const handoff=[];
    if (lead>=.16) {
      runtime.sample(s.end-lead);
      const first=bones.map(b=>b.quaternion.clone());
      runtime.sample(s.end-1e-7);
      for (const [i,bone] of bones.entries()) {
        if (!/^(Spine|Head|Neck|Left(Shoulder|Arm|ForeArm|Hand)|Right(Shoulder|Arm|ForeArm|Hand))/.test(names[i])) continue;
        if (first[i].angleTo(bone.quaternion)>.003) handoff.push({i,first:first[i],last:bone.quaternion.clone()});
      }
    }
    s.title=entry.title; s.restTransition=entry.kind;
    // Expose the action being shown while the base solver retains its support-pose inputs.
    const presented={...s,skill:donor.skill,branch_id:entry.source,phaseLabel:'core',
      graphNodeId:entry.kind==='phone' ? 'context.browse_phone_'+entry.posture+'.core' : s.graphNodeId};
    layers.set(id,{entry,donor,parts,lead,handoff,presented});
  }
  const convert=new THREE.Matrix4().set(1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1);
  const inverse=convert.clone().invert();
  return {...runtime,sample(t) {
    const s=runtime.sample(t), layer=layers.get(s.id);
    if (!layer) return s;
    const {entry,donor,parts,lead,handoff}=layer;
    const elapsed=t-s.start, remaining=s.end-t;
    const fade=entry.kind==='phone' ? .85 : .33;
    const weight=smooth(elapsed/fade)*smooth(remaining/fade);
    if (remaining<lead) for (const {i,first,last} of handoff) {
      bones[i].quaternion.copy(first).slerp(last,smooth(1-remaining/lead));
    }
    const clock=entry.offset+elapsed*donor.fps;
    for (const {i,phoneArm,reference} of parts) {
      core(donor,clock,i,out);
      if (phoneArm) bones[i].quaternion.slerp(out,weight);
      else {
        delta.copy(reference).multiply(out);
        const amplitude=Math.min(1,.16/Math.max(.0001,unit.angleTo(delta)));
        bones[i].quaternion.multiply(delta.slerp(unit,1-amplitude*weight));
      }
    }
    actor.updateMatrixWorld(true);
    if ((remaining<lead && handoff.length) || entry.kind==='phone') runtime.updateObjects();
    if (entry.kind==='phone') {
      const n=props.phone, held=runtime.heldMatrix(n,'Right');
      const calibrated=inverse.clone().multiply(bones[names.indexOf('RightHand')].matrixWorld)
            .multiply(new THREE.Matrix4().set(...donor.phonePoseH.flat()));
      const p=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
      const pt=p.clone(),qt=q.clone(),st=scale.clone();
      held.decompose(p,q,scale); calibrated.decompose(pt,qt,st);
      n.current=new THREE.Matrix4().compose(p.lerp(pt,weight),q.slerp(qt,weight),scale.lerp(st,weight));
      convert.clone().multiply(n.current).multiply(n.inverse).multiply(inverse).decompose(n.g.position,n.g.quaternion,n.g.scale);
      n.g.updateMatrixWorld(true);
    }
    return layer.presented;
  }};
}
