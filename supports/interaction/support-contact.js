// An object can continue moving on a support after detachment, independently of the hand.
export function bottomHeight(points,matrix) {
 const m=matrix.elements;let lowest=Infinity;
 for(const [x,y,z] of points)lowest=Math.min(lowest,m[2]*x+m[6]*y+m[10]*z+m[14]);
 return lowest;
}
export function detachedMatrix(e,n,t,mat,interpolate) {
 const u=Math.min(1,Math.max(0,(t-e.contact.at)/Math.max(.001,e.contact.settled-e.contact.at)));
 if(u>=1)return mat(e.target);
 const a=mat(e.contact.pose),b=mat(e.target),s=u*u*(3-2*u),m=interpolate(a,b,s);
 const floor=e.contact.height;
 // Clearance can only decrease once the hand lets go. Compensate for the actual
 // change of underside during rotation, rather than clamping the object's origin.
 const initial=bottomHeight(n.spec.contactHull,a)-floor;
 if(e.contact.sideApproach&&u<.32){
  const climb=u/.32; a.elements[14]+=(-initial+.006)*climb*climb*(3-2*climb);
  return a;
 }
 if(e.contact.sideApproach){
  const f=(u-.32)/.68,travel=f*f*(3-2*f);
  const raised=a.clone();raised.elements[14]+=-initial+.006;
  const slide=interpolate(raised,b,travel);
  slide.elements[14]+=floor+(1-travel)*.006+travel*e.contact.restGap-bottomHeight(n.spec.contactHull,slide);
  return slide;
 }
 const clearance=Math.max(0,initial);
 m.elements[14]+=floor+(1-s)*clearance+s*e.contact.restGap-bottomHeight(n.spec.contactHull,m);
 return m;
}
