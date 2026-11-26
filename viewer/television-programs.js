// A seekable visual feed on the House television. The volunteer device log owns power/playback.
const programmes = ['football','news','drama','cartoon','film'];
const tvId = 'dev_living_room_smart_tv_01';
const period = 32;
const W = 960, H = 540;

export function televisionClock(timeline) {
  const state = {...timeline.devices?.find(d=>d.id===tvId)?.initial};
  let at = timeline.startSeconds ?? 0, elapsed = 0;
  const spans = [];
  const playing = () => state.is_on?.value === true && state.playback_state?.value === 'playing';
  function save() {
    spans.push({at, elapsed, running:playing(), url:state.media_url?.value || ''});
  }
  save();
  for (const e of timeline.events || []) {
    const changes=e.changes.filter(c=>c.deviceId===tvId);
    if (!changes.length) continue;
    if (playing()) elapsed+=Math.max(0,e.t-at);
    at=e.t;
    for(const c of changes) Object.assign(state,c.values);
    save();
  }
  return (time,states,active) => {
    let lo=0,hi=spans.length;
    while(lo<hi){const mid=(lo+hi)>>1;if(spans[mid].at<=time)lo=mid+1;else hi=mid}
    const span=spans[Math.max(0,lo-1)],st=states[tvId];
    const clock=span.elapsed+(span.running?Math.max(0,time-span.at):0);
    const game=active?.skill==='play_game'||/\/game\//.test(span.url)||
      timeline.activities?.some(a=>a.l2==='gaming'&&a.t0<=time&&time<a.t1);
    let programme=game?'game':programmes[Math.floor(clock/period)%programmes.length];
    if(st?.is_on?.value!==true)programme='off';
    else if(st?.playback_state?.value==='idle'&&!game)programme='standby';
    return {programme,frame:Math.floor(clock*15),clock};
  };
}

export function drawProgramme(g,programme,time) {
  const rect=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x,y,w,h)};
  const oval=(x,y,rx,ry,c)=>{g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=c;g.fill()};
  const poly=(pts,c)=>{g.beginPath();g.moveTo(...pts[0]);for(const p of pts.slice(1))g.lineTo(...p);g.closePath();g.fillStyle=c;g.fill()};
  const line=(pts,c,w=3)=>{g.beginPath();g.moveTo(...pts[0]);for(const p of pts.slice(1))g.lineTo(...p);g.strokeStyle=c;g.lineWidth=w;g.stroke()};
  const type=(v,x,y,size,c,bold=true)=>{g.fillStyle=c;g.font=(bold?'bold ':'')+size+'px system-ui';g.fillText(v,x,y)};
  const sky=(a,b)=>{const grad=g.createLinearGradient(0,0,0,H);grad.addColorStop(0,a);grad.addColorStop(1,b);rect(0,0,W,H,grad)};
  function person(x,y,s,skin,hair,shirt,phase) {
    g.save();g.translate(x,y+2*Math.sin(phase));g.scale(s,s);
    oval(0,0,41,50,hair);oval(0,0,34,44,skin);oval(-3,-32,31,13,hair);
    rect(-12,34,24,24,skin);poly([[-12,49],[-53,56],[-79,141],[77,141],[52,58],[12,49]],shirt);
    for(const dx of [-14,12])oval(dx,-4,3,2.2,'#2b252b');
    oval(2,20,8,1.5+2.5*(1+Math.sin(phase*2)),'#854846');g.restore();
  }
  if(programme==='football'){
    rect(0,0,W,H,'#338449');for(let i=0;i<10;i+=2)rect(i*96,0,96,H,'#459756');
    g.strokeStyle='#d6edcb';g.lineWidth=4;g.strokeRect(25,24,910,492);g.strokeRect(25,139,134,264);g.strokeRect(801,139,134,264);
    line([[480,24],[480,516]],'#d6edcb');g.beginPath();g.arc(480,270,70,0,2*Math.PI);g.stroke();
    const x=480+255*Math.sin(time*.4),y=265+110*Math.sin(time*.77);
    for(let i=0;i<20;i++){const team=i%2,px=104+(i%5)*182+46*Math.sin(time*.75+i),py=85+Math.floor(i/5)*117+27*Math.cos(.79*time+i);
      oval(px+4,py+6,11,5,'#286f45');oval(px,py,9,12,team?'#f6ecca':'#de343f');oval(px,py-8,5,5,'#765340')}
    oval(x+2,y+3,6,5,'#265a35');oval(x,y,6,6,'#fff');rect(30,34,252,42,'#112f32');type('NTH   1   –   0   STH',43,63,23,'white');
  }else if(programme==='news'){
    sky('#102546','#47809a');for(let i=0;i<19;i++)rect(i*58,220-(i*53%145),45,240,'rgba(119,186,213,.32)');
    oval(704,188,134,134,'#386683');for(let i=0;i<5;i++){g.beginPath();g.ellipse(704,188,18+i*27,132,.22,0,Math.PI*2);g.strokeStyle='#75a7bc';g.lineWidth=2;g.stroke()}
    person(345,210,1.48,'#b97d57','#342725','#203957',time*2);
    rect(0,404,W,90,'#f2f0e5');rect(0,404,18,90,'#dc553a');type('Evening edition',37,461,42,'#1c3445');
    rect(0,494,W,46,'#163548');for(let i=-1;i<3;i++)type('CITY NEWS     •     WEATHER     •     THE ARTS',i*570-(time*45)%570,526,22,'#d4e8e6');
  }else if(programme==='drama'){
    sky('#bb987a','#6b4e48');rect(64,56,300,285,'#574d48');rect(77,68,274,260,'#adc7c9');
    for(let i=0;i<7;i++)rect(80+i*41,170-(i*13%53),38,155,'#6e878a');rect(206,67,9,261,'#e0bf93');
    rect(0,363,W,177,'#935f4e');rect(610,87,166,116,'#e0ca9a');rect(618,95,150,100,'#596c61');
    person(319+8*Math.sin(time*.6),263,1.62,'#c08a61','#392c29','#264c52',time);
    person(660,274,1.56,'#dfb493','#573a2d','#a24e47',time+.8);rect(0,493,W,47,'#53372f');
  }else if(programme==='cartoon'){
    sky('#55bfc7','#ffde99');oval(823,107,57,57,'#ffec9c');
    for(let i=0;i<7;i++){const x=((i*183-time*12)%1200+1200)%1200-100;oval(x,80+(i%3)*41,56,18,'#fff1d6')}
    oval(230,550,500,205,'#67ad88');oval(726,561,510,248,'#328777');
    const x=437+120*Math.sin(.57*time),y=370-49*Math.abs(Math.sin(time*2));oval(x,y+40,74,10,'#448779');
    oval(x-41,y-54,17,46,'#ed8560');oval(x+40,y-54,17,46,'#ed8560');oval(x,y,74,60,'#ffa173');
    oval(x-20,y-10,6,8,'#483738');oval(x+24,y-10,6,8,'#483738');oval(x+3,y+7,9,6,'#824b45');
  }else if(programme==='film'||programme==='game'){
    const game=programme==='game';sky(game?'#3d60ac':'#564d75',game?'#badae3':'#f8ba83');oval(723,123,48,48,game?'#fff3b4':'#ffcf92');
    for(let k=0;k<3;k++){const pts=[[-30,H]];for(let i=-1;i<25;i++){const x=i*52-(time*(k+1)*4)%52;pts.push([x,222+35*k+34*Math.sin((x+time*(k+1)*4)*.011+k)])}pts.push([1050,H]);poly(pts,(game?['#6e88a2','#50817c','#366657']:['#998495','#796879','#585869'])[k])}
    if(game){poly([[430,275],[522,275],[905,H],[65,H]],'#414954');
      for(let i=0;i<10;i++){const u=((i/10+time*.45)%1)**2;rect(477,276+u*291,3+u*12,3+u*27,'#f1e5a6')}
      const x=479+90*Math.sin(time*.85);rect(x-60,450,120,48,'#d73e4e');poly([[x-50,451],[x-28,419],[x+31,419],[x+53,451]],'#e5555b');rect(x-23,424,44,19,'#9bdae4');rect(x-62,477,18,22,'#232936');rect(x+44,477,18,22,'#232936');
      rect(27,28,165,42,'#27344a');type('LAP   2 / 3',42,57,24,'#fff3ca');
    }else{rect(0,372,W,168,'#596b80');for(let i=0;i<40;i++)line([[(i*79+time*7)%990,380+i%13*12],[(i*79+time*7)%990+29,380+i%13*12]],'#83939b',2);const x=144+time*9%660;poly([[x,411],[x+82,411],[x+64,427],[x+16,425]],'#293a4b');poly([[x+42,408],[x+42,350],[x+12,407]],'#ebe1c7')}
  }else{rect(0,0,W,H,'#10171c');}
}

export function createTelevision(T,scene,timeline){
  scene.updateMatrixWorld(true);
  const box=new T.Box3();let found=false;
  scene.traverse(o=>{if(o.userData.source_object==='TV_98in_OffScreen'){box.union(new T.Box3().setFromObject(o));found=true}});
  if(!found||box.isEmpty())throw Error('The House television LCD could not be located');
  const size=box.getSize(new T.Vector3()),centre=box.getCenter(new T.Vector3());
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const g=canvas.getContext('2d'),map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  const screen=new T.Mesh(new T.PlaneGeometry(size.x,size.y),new T.MeshBasicMaterial({map,toneMapped:false}));
  screen.name='LivingRoomTelevisionPicture';screen.rotation.y=Math.PI;screen.position.set(centre.x,centre.y,box.min.z-.0008);
  scene.add(screen);
  const clock=televisionClock(timeline);let key='';
  return {screen,update(time,states,active){const p=clock(time,states,active);screen.visible=p.programme!=='off';
    screen.userData.programme=p.programme;const next=p.programme+'|'+p.frame;
    if(!screen.visible||key===next)return;key=next;drawProgramme(g,p.programme,p.frame/15);map.needsUpdate=true;}};
}
