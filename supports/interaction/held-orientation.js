// Object coordinates and bind poses are retained in Blender world axes (Z up).
export function holdPolicy(spec) {
 if (spec.holdRule) {
  if (spec.holdRule.contract!=='house.interactions.2'||!['hand','level','level_except_use','authored_heading'].includes(spec.holdRule.mode)) throw Error('Invalid physical hold rule: '+spec.root);
  return spec.holdRule.mode;
 }
 // Compatibility with recordings predating explicit asset binding.
 const name=spec.root.split('__').at(-1);
 if (/HangingGarment|GarmentWithHanger/i.test(name)) return 'authored_heading';
 if (/Bowl|Plate|ServingPlatter|FryingPan|Saucepan/i.test(name)) return 'level';
 if (/Mug|WaterCup|CoffeeCup|DrinkingCup|Kettle/i.test(name)) return 'level_except_use';
 return spec.upright ? 'level' : 'hand';
}
export function holdConstraint(T,n,hand,raw,H,active,time) {
 const policy=n.orientationPolicy??=holdPolicy(n.spec);
 if(policy==='hand')return null;
 const extract=m=>{const q=new T.Quaternion();m.decompose(new T.Vector3(),q,new T.Vector3());return q};
 const original=n.bindOrientation??=extract(new T.Matrix4().set(...n.spec.original.flat()));
 const rawQ=extract(raw),up=new T.Vector3(0,0,1);
 const delta=rawQ.clone().multiply(original.clone().invert());
 const correction=policy==='authored_heading' ? delta.invert() : new T.Quaternion().setFromUnitVectors(up.clone().applyQuaternion(delta),up);
 let use=0;
 if(policy==='level_except_use'){
  const handSide=hand.toLowerCase(),drinking=active.skill==='drink'&&(!active.activeHand||active.activeHand===handSide||active.activeHand==='both');
  const pouring=active.skill==='pour'&&handSide==='right';
  if(drinking||pouring){
   use=1;
   if(active.phaseLabel==='entry'||active.phaseLabel==='one_shot')use=Math.min(use,Math.max(0,(time-active.start)/.28));
   if(active.phaseLabel==='exit'||active.phaseLabel==='one_shot')use=Math.min(use,Math.max(0,(active.end-time)/.28));
  }
 }
 if(use>=1)return null;
 const fix=new T.Quaternion().slerp(correction,1-use);
 // Rotate about the registered grip point (hand origin in object coordinates).
 // Rotating about a hanger's mesh centre instead displaces the hook.
 const pivot=policy==='authored_heading'&&n.spec.registeredHook?new T.Vector3(...n.spec.registeredHook).applyMatrix4(raw):new T.Vector3().applyMatrix4(H.clone().invert()).applyMatrix4(raw);
 const p=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3();raw.decompose(p,q,scale);
 p.sub(pivot).applyQuaternion(fix).add(pivot);q.premultiply(fix);
 return {matrix:new T.Matrix4().compose(p,q,scale),correction:fix};
}
