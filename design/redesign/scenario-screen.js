// Every screen is a small, reversible scene. No timers, video requests or autoplay.
const clamp=x=>Math.max(0,Math.min(1,x)),mix=(a,b,t)=>a+(b-a)*t;
const ease=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10);};
const C={bg:'#0b191d',panel:'#1a3030',edge:'#3c5b52',mint:'#bbd7c8',dim:'#6f9285',gold:'#d6bb83',blue:'#8ca9c9'};
function rect(c,x,y,w,h,color,r=8){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function txt(c,s,x,y,size=24,color=C.mint){c.fillStyle=color;c.font=`${size}px Arial, sans-serif`;c.fillText(s,x,y);}
function line(c,x,y,a,b,color=C.dim,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(a,b);c.stroke();}
function alpha(c,a,draw){c.save();c.globalAlpha*=clamp(a);draw();c.restore();}
function clip(c,x,y,w,h,draw){c.save();c.beginPath();c.roundRect(x,y,w,h,10);c.clip();draw();c.restore();}
function pointer(c,x,y,press=0){c.save();c.translate(x,y+press*3);c.scale(1-press*.1,1-press*.1);c.fillStyle='#e8eddf';c.strokeStyle='#173029';c.lineWidth=2;c.beginPath();c.moveTo(0,0);c.lineTo(2,27);c.lineTo(9,19);c.lineTo(16,32);c.lineTo(22,28);c.lineTo(15,16);c.lineTo(26,15);c.closePath();c.fill();c.stroke();c.restore();}
function check(c,x,y,t){c.strokeStyle=C.mint;c.lineWidth=3;c.lineCap='round';const pts=[[x-11,y],[x-3,y+8],[x+14,y-11]];c.beginPath();c.moveTo(...pts[0]);if(t<.35)c.lineTo(mix(pts[0][0],pts[1][0],t/.35),mix(pts[0][1],pts[1][1],t/.35));else{c.lineTo(...pts[1]);c.lineTo(mix(pts[1][0],pts[2][0],(t-.35)/.65),mix(pts[1][1],pts[2][1],(t-.35)/.65));}c.stroke();}
function dots(c,x,y,t){for(let j=0;j<3;j++)rect(c,x+j*13,y,5,5,j/3<t?C.mint:C.edge,3);}
function landscape(c,x,y,w,h,time=0){
 const sky=c.createLinearGradient(0,y,0,y+h);sky.addColorStop(0,'#708e91');sky.addColorStop(.65,'#bec8b5');sky.addColorStop(1,'#9fb5a5');rect(c,x,y,w,h,sky,0);
 const pan=time*.055;c.fillStyle='#e4ddbe';c.beginPath();c.arc(x+w*(.77-pan*.12),y+h*.24,h*.095,0,Math.PI*2);c.fill();
 for(let layer=0;layer<3;layer++){
  c.fillStyle=['#789689','#4e756b','#234c48'][layer];c.beginPath();c.moveTo(x-100,y+h);
  for(let j=-2;j<13;j++){const px=x+j*w*.13-pan*w*(.35+layer*.45),py=y+h*(.53+layer*.14)-Math.sin(j*1.2+layer)*h*(.15-layer*.025);c.lineTo(px,py);}
  c.lineTo(x+w+100,y+h);c.closePath();c.fill();
 }
 for(let j=0;j<8;j++){const yy=y+h*(.82+j*.021),xx=x+w*(.12+Math.sin(j*1.7+time*.6)*.04);line(c,xx,yy,xx+w*(.45+j*.025),yy,'#6c9481',1);}
}
function player(c,time,{game=false}={}){
 clip(c,65,45,830,390,()=>landscape(c,65,45,830,390,time));
 if(game){
  const x=310+time*88,y=319-Math.sin(time*2)*12;rect(c,x-12,y,24,53,'#d5dac1',5);rect(c,x-17,y+8,5,34,C.dim,2);rect(c,x+12,y+8,5,34,C.dim,2);
  line(c,465,225,495,225,C.mint,2);line(c,480,210,480,240,C.mint,2);
 }else{
  rect(c,72,476,813,4,C.edge,2);rect(c,72,476,813*clamp(time/3),4,C.mint,2);c.fillStyle=C.mint;c.beginPath();c.arc(72+813*clamp(time/3),478,6,0,Math.PI*2);c.fill();txt(c,`00:${String(Math.floor(time)).padStart(2,'0')}`,78,460,18,C.dim);
 }
}
function portrait(c,x,y,w,h,time=0,color='#90b09c'){
 rect(c,x,y,w,h,'#23413e',12);const sway=Math.sin(time*1.8)*w*.012,headX=x+w*.5+sway,headY=y+h*.37+Math.sin(time*2.2)*h*.009;
 c.fillStyle=color;c.beginPath();c.ellipse(x+w*.5,y+h*.99,w*.29,h*.30,0,0,Math.PI*2);c.fill();
 c.beginPath();c.ellipse(headX,headY,w*.13,h*.175,Math.sin(time)*.025,0,Math.PI*2);c.fill();
 c.fillStyle='#304e45';for(const sign of [-1,1]){c.beginPath();c.ellipse(headX+sign*w*.041,headY-h*.025,w*.011,h*.007,0,0,Math.PI*2);c.fill();}
 c.beginPath();c.ellipse(headX,headY+h*.07,w*.026,h*(.007+Math.abs(Math.sin(time*8))*.013),0,0,Math.PI*2);c.fill();
 // A small greeting follows the same progress as the remote voice indicator.
 const handX=x+w*.76,handY=y+h*(.63-.08*Math.sin(time*2));c.fillStyle=color;c.beginPath();c.ellipse(handX,handY,w*.055,h*.075,-.3+Math.sin(time*3)*.16,0,Math.PI*2);c.fill();
}
function audioBars(c,x,y,w,h,time,color=C.mint){for(let j=0;j<30;j++){const height=(.12+.88*Math.abs(Math.sin(j*.73+time*6)*Math.sin(j*.19+time*2)))*h;rect(c,x+j*w/30,y+(h-height)/2,w/30-4,height,color,2);}}
function windowFrame(c,x,y,w,h,title,draw,color=C.panel){rect(c,x,y,w,h,color,13);txt(c,title,x+24,y+36,22);line(c,x+24,y+53,x+w-24,y+53,C.edge,1);clip(c,x+12,y+60,w-24,h-72,draw);}
function document(c,{letter=null,caret=true,lines=0}={}){
 windowFrame(c,75,46,810,450,'나의 기록',()=>{
  txt(c,'오늘의 생각',116,180,30,'#d6e4d8');
  if(letter!==null){txt(c,letter,116,242,35);if(caret)line(c,158,214,158,246,C.mint,2);}
  else for(let j=0;j<5;j++)rect(c,117,215+j*33,[550,460,590,390,480][j]*clamp(lines*5-j),5,C.dim,2);
 });
}
function desktop(c){for(let j=0;j<3;j++){rect(c,72,82+j*96,47,47,[C.dim,C.edge,'#a3b198'][j],9);rect(c,66,140+j*96,60,3,C.edge,1);}rect(c,303,504,354,18,'#29443e',9);}
function jobWindows(c,t,{opening=false}={}){
 const jobs=[{x:62,y:52,w:448,h:303,title:'문서',color:'#29473d'},{x:338,y:115,w:534,h:310,title:'브라우저',color:'#233d43'},{x:173,y:293,w:335,h:200,title:'음악',color:'#3d4d40'}];
 jobs.forEach((a,j)=>{const q=opening?ease(t*2-j*.28):1;c.save();c.globalAlpha=q;c.translate(a.x+a.w/2,a.y+a.h/2+15*(1-q));c.scale(.92+.08*q,.92+.08*q);c.translate(-a.w/2,-a.h/2);
  windowFrame(c,0,0,a.w,a.h,a.title,()=>{
   if(j===0){txt(c,'생각을 기록합니다'.slice(0,Math.floor(3+t*8)),24,95,23);for(let k=0;k<4;k++)rect(c,24,123+k*27,[320,275,300,230][k],4,C.dim,2);line(c,28+Math.floor(3+t*8)*22,75,28+Math.floor(3+t*8)*22,98,C.mint,2);}
   if(j===1){for(let k=0;k<7;k++){const y=78+k*57-t*58;rect(c,24,y,98,41,['#507a71','#709186','#a9b69b'][k%3],4);rect(c,143,y+7,220-(k%3)*24,5,C.mint,2);rect(c,143,y+22,280-(k%2)*30,4,C.dim,2);}}
   if(j===2){audioBars(c,25,85,280,50,t*2);rect(c,24,162,280,3,C.edge,1);rect(c,24,162,280*(.15+.65*t),3,C.gold,1);}
  },a.color);c.restore();});
}
export function paintScenarioScreen(c,id,e,local,p,{remote=false}={}){
 const t=ease(local),action=ease(local/.62);c.clearRect(0,0,960,540);rect(c,0,0,960,540,C.bg,0);
 if(id==='typing'){
  document(c,{letter:e==='typed'?null:'ㄱ',lines:0});
  if(e==='typed'){
   alpha(c,1-ease(t/.25),()=>txt(c,'ㄱ',116,242,35));
   clip(c,113,206,42*ease((t-.08)/.62),47,()=>txt(c,'가',116,242,35));
   line(c,158,215,158,247,C.mint,2);
  }
 }else if(id==='save'){
  document(c,{lines:1});const done=e==='saved',q=done?ease(local/.65):0;
  const progress=done?.86+.14*ease(local/.36):.84*p;
  rect(c,113,453,600,3,C.edge,1);rect(c,113,453,600*progress,3,C.mint,1);
  alpha(c,1-ease((q-.3)/.3),()=>{txt(c,e==='save-keys'&&action<.3?'수정됨':'저장 중',752,92,19,C.dim);dots(c,752,112,progress);});
  if(done)alpha(c,ease((q-.3)/.3),()=>{txt(c,'저장됨',752,92,19);check(c,729,86,ease((q-.3)/.7));});
 }else if(id==='launch'){
  desktop(c);
  if(e==='double-click'){pointer(c,96,96,Math.sin(action*Math.PI*2)**2);}
  if(e==='window'){
   const q=ease(local/.65);c.save();c.translate(480,271);c.scale(.4+.6*q,.4+.6*q);c.globalAlpha=q;
   windowFrame(c,-350,-200,700,400,'작업 공간',()=>{for(let j=0;j<4;j++)alpha(c,ease((q-j*.13)/.45),()=>rect(c,-310+j*155,-105+(1-q)*15,132,112,[C.dim,C.edge,'#9ba997','#618f82'][j],7));for(let j=0;j<3;j++)rect(c,-310,61+j*36,490-j*58,5,C.dim,2);});c.restore();
  }
 }else if(id==='music'){
  windowFrame(c,70,50,820,445,'음악',()=>{clip(c,109,138,292,255,()=>landscape(c,109,138,292,255,p*1.5));txt(c,'지금 재생 중',454,178,26);audioBars(c,453,228,374,103,e==='play'?action:p*3);rect(c,110,439,733,4,C.edge,2);rect(c,110,439,733*(e==='play'?action*.12:.12+p*.72),4,C.mint,2);});
  if(e==='play'){pointer(c,505,382,Math.sin(action*Math.PI));if(action<.4){c.fillStyle=C.mint;c.beginPath();c.moveTo(482,363);c.lineTo(482,391);c.lineTo(508,377);c.fill();}else{rect(c,482,363,8,27,C.mint,1);rect(c,499,363,8,27,C.mint,1);}}
 }else if(id==='streaming'){
  const playing=e==='video';player(c,playing?local*2.8:0);
  if(!playing){alpha(c,e==='av-sync'?.5:1,()=>{rect(c,315,204,330,96,'#132b28ed',12);txt(c,e==='video-request'?'재생 준비':'다음 장면을 기다리는 중',345,254,22);const q=e==='buffer-low'?1-action:e==='buffer-refill'?action:p;rect(c,345,274,270,3,C.edge,1);rect(c,345,274,270*q,3,C.mint,1);});}
  else alpha(c,1-ease(local/.18),()=>rect(c,65,45,830,390,'#0b191d',10));
 }else if(id==='call'){
  const result=e==='call-result',q=result?ease(local/.3):remote?.08:1,time=result?local*2.7:p*2;
  alpha(c,q,()=>portrait(c,65,58,830,425,time,remote?'#94b6a3':'#78988b'));
  alpha(c,result?ease((local-.12)/.3):1,()=>portrait(c,710,352,145,105,time+.4,'#577e74'));
  txt(c,remote?'상대방의 컴퓨터':'내 컴퓨터',95,101,21);audioBars(c,99,428,137,23,time,C.gold);
  if(remote&&!result)dots(c,464,269,p);
 }else if(id==='multitasking'){
  jobWindows(c,e==='windows'?action:e==='multitask-result'?.15+.85*local:.15,{opening:e==='windows'});
 }else if(id==='usb'){
  windowFrame(c,75,50,810,440,'파일',()=>{
   if(e==='drive'){
    const q=ease(local/.35);alpha(c,q,()=>{rect(c,112,159+14*(1-q),176,220,C.edge,10);rect(c,166,207,65,39,C.dim,5);rect(c,185,193,28,18,C.mint,2);txt(c,'USB 저장장치',126,326,21);});
    for(let j=0;j<3;j++){const a=ease((local-.12-j*.13)/.28);alpha(c,a,()=>{const x=349+j*154,y=190+18*(1-a);rect(c,x,y,48,14,C.mint,3);rect(c,x,y+10,114,76,C.dim,7);txt(c,['문서','사진','작업'][j],x+24,310,21);});}
    if(local>.5)pointer(c,520-30*ease((local-.5)/.5),330-80*ease((local-.5)/.5),0);
   }else{txt(c,'연결한 장치를 준비합니다',286,269,24,C.dim);dots(c,458,306,p);}
  });
 }else if(id==='sleep'){
  let glow=1;if(e==='sleep-request')glow=1-action*.35;if(['quiesce','retain'].includes(e))glow=.25*(1-action);if(['power-low','wake','restore'].includes(e))glow=0;if(e==='resumed')glow=ease(local/.6);
  alpha(c,glow,()=>{document(c,{lines:1});line(c,117,381,117,404,C.mint,2);});
 }else if(id==='ai'){
  windowFrame(c,80,50,800,444,'답변',()=>{
   const prompt='컴퓨터는 어떻게 답을 만들까?',submitted=e!=='prompt'||action>.52;
   if(submitted)txt(c,prompt,128,141,26);
   if(e==='prompt'){const typed=prompt.slice(0,Math.floor(clamp(action/.5)*prompt.length));rect(c,111,395,738,62,C.edge,10);txt(c,submitted?'질문하기':typed,135,434,22);if(action>.38)pointer(c,812,425,Math.sin(action*Math.PI));}
   else{rect(c,111,409,738,48,C.edge,10);txt(c,'질문하기',135,440,19,C.dim);}
   const lines=['모델이 질문을 작은 단위로 읽고','지금까지의 내용을 바탕으로','다음 응답 조각을 차례로 계산합니다'];
   const amount=e==='answer'?.15+.85*local:e==='tokens-return'?action*.15:0;
   if(amount===0&&submitted)dots(c,129,209,p);
   lines.forEach((s,j)=>{const count=Math.floor(s.length*clamp(amount*3-j));txt(c,s.slice(0,count),128,230+j*55,25);if(count>0&&count<s.length)line(c,128+count*23,210+j*55,128+count*23,235+j*55,C.mint,2);});
  });
 }else if(id==='loading'){
  const playing=e==='play-game';player(c,playing?local*2.6:0,{game:true});
  alpha(c,playing?1-ease(local/.22):1,()=>{rect(c,235,202,490,112,'#132b28f2',12);txt(c,e==='load-request'&&action<.25?'플레이':'장면을 준비하고 있습니다',287,250,24);rect(c,280,279,400,4,C.edge,2);rect(c,280,279,400*(playing?1:p),4,C.mint,2);});
  if(e==='load-request')pointer(c,491,247,Math.sin(action*Math.PI));
 }else if(id==='record'){
  const result=e==='record-end',time=result?Math.max(0,local-.25)*3.3:p*2;player(c,time);
  if(!result){const rec=e!=='record-start'||action>.25;rect(c,86,62,128,37,'#16342ceb',8);c.fillStyle=rec?C.gold:C.dim;c.beginPath();c.arc(106,81,6,0,Math.PI*2);c.fill();txt(c,e==='drain'?'마무리 중':rec?'녹화 중':'녹화 시작',123,88,19,C.gold);}
  if(e==='record-start')pointer(c,139,81,Math.sin(action*Math.PI));
  if(result){
   const q=ease(local/.40);alpha(c,1-ease((local-.18)/.3),()=>{rect(c,315,151,330,206,'#17312ff5',12);txt(c,'녹화한 영상',389,214,27);c.fillStyle=C.mint;c.beginPath();c.moveTo(467,247);c.lineTo(467,304);c.lineTo(516,276);c.fill();pointer(c,484,278,Math.sin(q*Math.PI));});
   alpha(c,ease((local-.2)/.3),()=>txt(c,'녹화한 영상',91,86,22));
  }
 }
}
