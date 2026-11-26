// X/Y route corrections in House v102 metres. All equipment and body rotations remain rigid.
const profiles = {
  'bd20c72d': [[0.0,0.0,0.0],[0.72,-0.043349,-0.110503],[2.4,-0.157945,-0.368344],[2.52,-0.154315,-0.354652],[2.88,-0.143424,0.072718],[4.44,-0.096231,0.070831],[4.8,-0.08534,0.068859],[7.56,-0.0,-0.0],[14.0,-0.0,-0.0]], // floorcare.vacuum.outbound
  '5a40dfd0': [[0.0,-0.0,-0.0],[1.08,-0.0,-0.0],[2.16,-0.03919,0.05455],[3.265,-0.079288,0.031401]], // floorcare.vacuum.pass1
  '5cd1e95c': [[0.0,-0.079288,0.031401],[0.6,-0.10106,0.200735],[1.08,-0.025575,0.055081],[2.28,0.163105,0.164008],[2.4,0.181967,0.114312],[3.0,0.075684,-0.134163],[3.12,-0.044524,-0.133164],[3.24,-0.164731,-0.121136],[3.36,-0.225116,-0.109108],[4.457,-0.034614,0.000887]], // floorcare.vacuum.pass2
  'a5df9d6e': [[0.0,-0.034614,0.000887],[0.36,-0.025574,0.036993],[1.08,-0.007495,-0.000345],[3.24,-0.0,-0.0],[14.0,0.0,0.0]], // floorcare.vacuum.return2
  'fdfff264': [[0.0,0.0,0.0],[0.72,-0.002317,-0.046739],[2.76,-0.047248,-0.179167],[3.24,-0.038248,-0.001644],[3.72,-0.029248,-0.000359],[5.28,-0.0,6.5e-05],[6.24,-0.0,6.5e-05],[6.84,-0.0,0.077025],[9.48,-0.0,-0.0],[14.0,-0.0,-0.0]], // floorcare.floor_washer.outbound
  'bb9e3840': [[0.0,-0.0,-0.0],[0.12,-0.0,-0.0],[2.64,0.062686,0.016797],[3.72,0.05152,0.023998],[4.92,0.039114,0.020674],[6.41,0.037064,0.020125]], // floorcare.floor_washer.pass1
  '77b7b00f': [[0.0,0.037064,0.020125],[0.6,0.036238,0.060985],[1.08,0.035578,0.020028],[3.84,0.03178,0.01901],[4.68,0.030624,-0.13036],[4.92,0.030624,-0.119656],[7.602,0.477202,-0.0]], // floorcare.floor_washer.pass2
  '47bc579c': [[0.0,0.477202,-0.0],[0.36,0.537153,0.016064],[0.48,0.557137,0.042049],[0.6,0.57712,0.168966],[0.84,0.529027,0.084355],[0.96,0.50498,0.042489],[3.12,0.07214,-0.0],[3.48,-0.0,-0.0],[14.0,0.0,0.0]], // floorcare.floor_washer.return2
};
export function floorCareRouteKey(s){
 const r=s.routePlan,c=s.cleaningSource;
 const phases=r.phases.map(p=>[p.kind,Math.round(p.duration*1000),Math.round(p.yaw0*10),Math.round(p.yaw1*10)]);
 const text=JSON.stringify([c.file,r.waypoints,phases,s.routeStartRoot.map(x=>Math.round(x*1000)),s.routeEndRoot.map(x=>Math.round(x*1000))]);
 let hash=2166136261;
 for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);
 return (hash>>>0).toString(16);
}
export function calibratedFloorRoute(s){
 return s.cleanerOffsets || profiles[floorCareRouteKey(s)];
}
export function offsetAt(knots,t){
 let i=1;while(i<knots.length-1 && knots[i][0]<t)i++;
 const a=knots[i-1],b=knots[i],u=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));
 return [a[1]+u*(b[1]-a[1]),a[2]+u*(b[2]-a[2])];
}
