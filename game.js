
const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
const W=canvas.width,H=canvas.height;
const overlays={menu:$("#menu"),pause:$("#pause"),result:$("#result")},hud=$("#hud");
let category="fps",mode="flick",state="menu",duration=30,difficulty="normal",crosshairSize=9;
let crosshairColor="#ffffff",targetColor="#67e8f9",backgroundTheme="dark";
let mouseDpi=800,mouseSensitivity=1;
let timeLeft=30,last=0,score=0,hits=0,misses=0,combo=0,bestCombo=0,reactionTimes=[],shots=0,trackingTime=0,trackingOnTarget=0;
let targets=[],projectiles=[],effects=[],player={x:W/2,y:H/2,r:16,hp:100},moveTarget=null;
let spawnTimer=0,reactionReadyAt=0,reactionShownAt=0,keys={},mouse={x:W/2,y:H/2,down:false};
let dodgedCount=0,hitCount=0;
let arena3dTargets=[],camera3d={yaw:0,pitch:0},arena3dSpawnTimer=0;
let arena3dRoom={depth:3400,width:1900,height:1000};

function $(s){return document.querySelector(s)}function $$(s){return [...document.querySelectorAll(s)]}
function hideAll(){Object.values(overlays).forEach(o=>o.classList.remove("show"))}function show(n){hideAll();overlays[n].classList.add("show")}
function diff(){return difficulty==="easy"?.72:difficulty==="hard"?1.65:1}
function sensitivityScale(){
 const dpi=Math.max(100,Math.min(6400,Number(mouseDpi)||800));
 const sens=Math.max(.05,Math.min(5,Number(mouseSensitivity)||1));
 return (dpi/800)*sens;
}
function clampAim(){
 mouse.x=Math.max(0,Math.min(W,mouse.x));
 mouse.y=Math.max(82,Math.min(H,mouse.y));
}
function modeName(){return {flick:"플릭 샷",tracking:"트래킹",reaction:"반응속도",line:"직선 스킬샷",circle:"원형 스킬샷",dodge:"회피 연습",arena3dStatic:"3D 고정 표적",arena3dMoving:"3D 이동 표적"}[mode]}
function flickLifetime(){return difficulty==="easy"?2200:difficulty==="hard"?700:1500}

function resetGame(){
 timeLeft=duration;score=hits=misses=combo=bestCombo=shots=trackingTime=trackingOnTarget=0;reactionTimes=[];targets=[];projectiles=[];effects=[];spawnTimer=0;moveTarget=null;player={x:W/2,y:H/2,r:16,hp:100};dodgedCount=0;hitCount=0;
 if(mode==="flick")spawnFlickTarget();
 if(mode==="tracking")spawnTrackingTarget();
 if(mode==="reaction")scheduleReaction();
 if(mode==="line"||mode==="circle")spawnMobaTargets();
 if(mode==="dodge")spawnTimer=.55;
 if(mode==="arena3dStatic"||mode==="arena3dMoving"){
  camera3d={yaw:0,pitch:0};
  arena3dTargets=[];
  arena3dSpawnTimer=0;
  for(let i=0;i<6;i++)spawn3DTarget();
 }
 updateHud()
}
function lockPointer(){
 if(document.pointerLockElement!==canvas&&canvas.requestPointerLock){
  canvas.requestPointerLock();
 }
}
function unlockPointer(){
 if(document.pointerLockElement&&document.exitPointerLock){
  document.exitPointerLock();
 }
}

function startGame(){
 duration=+$("#duration").value;
 difficulty=$("#difficulty").value;
 crosshairSize=+$("#crosshairSize").value;
 crosshairColor=$("#crosshairColor").value;
 targetColor=$("#targetColor").value;
 backgroundTheme=$("#backgroundTheme").value;
 mouseDpi=Math.max(100,Math.min(6400,+$("#mouseDpi").value||800));
 mouseSensitivity=Math.max(.05,Math.min(5,+$("#mouseSensitivity").value||1));
 $("#mouseDpi").value=mouseDpi;
 $("#mouseSensitivity").value=mouseSensitivity.toFixed(2);

 localStorage.setItem("dualAimSettings",JSON.stringify({
  crosshairColor,targetColor,backgroundTheme,crosshairSize,mouseDpi,mouseSensitivity
 }));

 mouse.x=W/2;
 mouse.y=H/2;
 resetGame();state="playing";hideAll();hud.classList.remove("hidden");
 setTimeout(lockPointer,0);
}
function pauseGame(){
 if(state==="playing"){
  unlockPointer();
  state="paused";
  show("pause");
 }
}
function resumeGame(){
 state="playing";
 hideAll();
 setTimeout(lockPointer,0);
}
function toMenu(){
 unlockPointer();
 state="menu";
 show("menu");
 hud.classList.add("hidden");
}

function resultCard(label,value){return `<div><span>${label}</span><strong>${value}</strong></div>`}
function endGame(){
 unlockPointer();
 state="result";hud.classList.add("hidden");
 const acc=accuracy(),avg=reactionTimes.length?reactionTimes.reduce((a,b)=>a+b,0)/reactionTimes.length:0;
 $("#resultTitle").textContent=`${modeName()} 결과`;

 let cards=[];
 if(mode==="reaction"){
  cards=[resultCard("점수",Math.floor(score).toLocaleString("ko-KR")),resultCard("평균 반응",avg?Math.round(avg)+"ms":"-"),resultCard("최고 콤보",bestCombo),resultCard("적중",hits),resultCard("실패",misses)];
 }else if(mode==="dodge"){
  cards=[resultCard("점수",Math.floor(score).toLocaleString("ko-KR")),resultCard("피한 개수",dodgedCount),resultCard("맞은 개수",hitCount)];
 }else if(mode==="flick"){
  cards=[resultCard("점수",Math.floor(score).toLocaleString("ko-KR")),resultCard("명중률",acc.toFixed(1)+"%"),resultCard("최고 콤보",bestCombo),resultCard("적중",hits),resultCard("실패",misses)];
 }else if(mode==="arena3dStatic"||mode==="arena3dMoving"){
  cards=[resultCard("점수",Math.floor(score).toLocaleString("ko-KR")),resultCard("명중률",acc.toFixed(1)+"%"),resultCard("최고 콤보",bestCombo),resultCard("적중",hits),resultCard("실패",misses)];
 }else{
  cards=[resultCard("점수",Math.floor(score).toLocaleString("ko-KR")),resultCard("명중률",acc.toFixed(1)+"%"),resultCard("최고 콤보",bestCombo),resultCard("적중",hits),resultCard("실패",misses)];
 }
 $("#resultGrid").innerHTML=cards.join("");
 $("#resultComment").textContent=getComment(acc,avg);

 const key=`dualAimBest_${mode}_${difficulty}_${duration}`,old=Number(localStorage.getItem(key)||0);
 if(score>old)localStorage.setItem(key,Math.floor(score));
 updateBestText();show("result")
}
function getComment(acc,avg){
 if(mode==="tracking")return accuracy()>75?"트래킹 유지력이 매우 좋습니다.":"표적의 이동 방향을 부드럽게 따라가 보세요.";
 if(mode==="reaction")return avg&&avg<250?"반응속도가 매우 빠릅니다.":"표적이 나타나기 전 클릭하지 말고 중앙에 집중하세요.";
 if(mode==="dodge")return hitCount===0?"완벽한 회피입니다.":hitCount<=3?"회피 경로 선택이 안정적입니다.":"클릭 이동과 WASD를 함께 사용해 급격히 방향을 바꿔보세요.";
 if(mode==="circle")return acc>=70?"AI 회피 방향을 잘 읽었습니다.":"공격 지점보다 적이 피할 방향까지 예측해보세요.";
 if(mode==="arena3dStatic")return acc>=85?"먼 거리 고정 표적에 대한 정밀도가 좋습니다.":acc>=65?"거리별 크기 변화에 잘 적응하고 있습니다.":"작은 표적일수록 미세하게 조준해보세요.";
 if(mode==="arena3dMoving")return acc>=80?"거리와 이동을 함께 잘 읽고 있습니다.":acc>=60?"움직임을 잘 따라가고 있습니다.":"표적의 진행 방향 앞쪽을 부드럽게 추적해보세요.";
 return acc>=85?"정확도와 속도의 균형이 좋습니다.":acc>=65?"좋은 흐름입니다. 정확한 입력을 우선하세요.":"조준 이동을 줄이고 확실할 때 입력해 보세요."
}
function accuracy(){if(mode==="tracking")return trackingTime?trackingOnTarget/trackingTime*100:0;return shots?hits/shots*100:0}
function updateHud(){$("#hudMode").textContent=modeName();$("#hudScore").textContent=Math.floor(score);$("#hudAcc").textContent=mode==="dodge"?`${dodgedCount} 회피`:accuracy().toFixed(0)+"%";$("#hudTime").textContent=Math.max(0,timeLeft).toFixed(1)}
function updateBestText(){const key=`dualAimBest_${mode}_${$("#difficulty").value}_${+$("#duration").value}`,best=Number(localStorage.getItem(key)||0);$("#bestText").textContent=best?`현재 설정 최고 기록 ${best.toLocaleString("ko-KR")}`:"현재 설정 최고 기록 없음"}
function spawnFlickTarget(){const r=difficulty==="easy"?34:difficulty==="hard"?17:27;targets=[{type:"flick",x:80+Math.random()*(W-160),y:110+Math.random()*(H-160),r,born:performance.now()}]}
function spawnTrackingTarget(){
 const baseSpeed=difficulty==="easy"?145:difficulty==="hard"?275:205;
 const a=Math.random()*Math.PI*2;
 targets=[{
  type:"tracking",
  x:W/2,y:H/2,
  r:difficulty==="easy"?34:difficulty==="hard"?21:28,
  vx:Math.cos(a)*baseSpeed,
  vy:Math.sin(a)*baseSpeed,
  moveTimer:randomTrackingInterval(),
  turnStrength:difficulty==="easy"?.45:difficulty==="hard"?1.05:.72,
  targetSpeed:baseSpeed
 }]
}
function randomTrackingInterval(){
 if(difficulty==="easy")return .65+Math.random()*.75;
 if(difficulty==="hard")return .18+Math.random()*.32;
 return .35+Math.random()*.55;
}
function changeTrackingDirection(t){
 const current=Math.atan2(t.vy,t.vx);
 const maxTurn=difficulty==="easy"?Math.PI*.42:difficulty==="hard"?Math.PI*.95:Math.PI*.65;
 let next=current+(Math.random()*2-1)*maxTurn;

 // occasional sharp turn, especially on hard
 const sharpChance=difficulty==="easy"?.08:difficulty==="hard"?.34:.18;
 if(Math.random()<sharpChance){
  next=current+(Math.random()<.5?-1:1)*(Math.PI*.55+Math.random()*Math.PI*.5);
 }

 const speedVariation=difficulty==="easy"?.16:difficulty==="hard"?.38:.25;
 const speed=t.targetSpeed*(1-speedVariation+Math.random()*speedVariation*2);
 t.vx=Math.cos(next)*speed;
 t.vy=Math.sin(next)*speed;
 t.moveTimer=randomTrackingInterval();
}
function scheduleReaction(){targets=[];reactionReadyAt=performance.now()+800+Math.random()*2200;reactionShownAt=0}
function spawnMobaTargets(){targets=[];const count=difficulty==="easy"?2:difficulty==="hard"?4:3;for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=(difficulty==="hard"?135:90)*diff()+Math.random()*55;targets.push({type:"moba",x:180+Math.random()*(W-360),y:150+Math.random()*(H-260),r:22,vx:Math.cos(a)*s,vy:Math.sin(a)*s,dodgeX:0,dodgeY:0,dodgeTimer:0})}}
function castLine(){shots++;const dx=mouse.x-player.x,dy=mouse.y-player.y,l=Math.hypot(dx,dy)||1;projectiles.push({type:"line",x:player.x,y:player.y,vx:dx/l*650,vy:dy/l*650,r:10,life:1.4})}
function castCircle(){
 shots++;
 projectiles.push({type:"circle",x:mouse.x,y:mouse.y,r:85,delay:.65,life:1,exploded:false});
 for(const t of targets){
  const d=dist(t.x,t.y,mouse.x,mouse.y);
  const awareness=d<230;
  if(awareness){
   const awayX=t.x-mouse.x,awayY=t.y-mouse.y,awayLen=Math.hypot(awayX,awayY)||1;
   const side=Math.random()<.5?-1:1;
   const urgency=Math.max(.35,1-d/230);
   const dodgeSpeed=(86+54*urgency)*(difficulty==="hard"?1.12:difficulty==="easy"?.86:1);
   t.dodgeX=(-awayY/awayLen*side*.72 + awayX/awayLen*.28)*dodgeSpeed;
   t.dodgeY=(awayX/awayLen*side*.72 + awayY/awayLen*.28)*dodgeSpeed;
   t.dodgeTimer=difficulty==="hard"?.72:.55;
  }
 }
}
function spawnDodgeAttack(){
 const roll=Math.random();

 // flying projectile
 if(roll<.45){
  const e=Math.floor(Math.random()*4);let x,y;
  if(e===0){x=Math.random()*W;y=80}
  if(e===1){x=W;y=100+Math.random()*(H-120)}
  if(e===2){x=Math.random()*W;y=H}
  if(e===3){x=0;y=100+Math.random()*(H-120)}
  const dx=player.x-x,dy=player.y-y,l=Math.hypot(dx,dy)||1;
  const base=difficulty==="hard"?540:difficulty==="easy"?300:385;
  projectiles.push({
   type:"enemy",
   x,y,vx:dx/l*base,vy:dy/l*base,
   r:difficulty==="hard"?15:13,
   life:4
  });
  return;
 }

 // circular ground skill centered on the player's current position
 if(roll<.75){
  const warning=difficulty==="hard"?.62:difficulty==="easy"?1.05:.82;
  const radius=difficulty==="hard"?92:difficulty==="easy"?78:86;
  projectiles.push({
   type:"dodgeCircle",
   x:player.x,y:player.y,
   r:radius,
   warning,
   maxWarning:warning,
   active:.18,
   resolved:false
  });
  return;
 }

 // horizontal bar attack crossing a selected lane
 const warning=difficulty==="hard"?.58:difficulty==="easy"?1.0:.78;
 const height=difficulty==="hard"?76:difficulty==="easy"?58:66;
 const centerY=Math.max(130+height/2,Math.min(H-height/2-18,player.y+(Math.random()-.5)*100));
 projectiles.push({
  type:"dodgeBar",
  x:0,y:centerY-height/2,
  w:W,h:height,
  warning,
  maxWarning:warning,
  active:.20,
  resolved:false
 });
}

function spawn3DTarget(){
 let minZ,maxZ,baseRadius,speedX,speedY,spreadX,spreadY;

 if(difficulty==="easy"){
  minZ=1100;maxZ=2200;
  baseRadius=66;
  speedX=85;speedY=58;
  spreadX=1350;spreadY=520;
 }else if(difficulty==="hard"){
  minZ=1550;maxZ=3200;
  baseRadius=38;
  speedX=165;speedY=120;
  spreadX=1750;spreadY=720;
 }else{
  minZ=1300;maxZ=2700;
  baseRadius=50;
  speedX=120;speedY=82;
  spreadX=1550;spreadY=620;
 }

 const z=minZ+Math.random()*(maxZ-minZ);
 const x=(Math.random()-.5)*spreadX;
 const y=(Math.random()-.5)*spreadY;

 arena3dTargets.push({
  x,y,z,
  r:baseRadius,
  vx:(Math.random()-.5)*speedX,
  vy:(Math.random()-.5)*speedY,
  born:performance.now()
 });
}
function rotateToCamera(p){
 const cy=Math.cos(camera3d.yaw),sy=Math.sin(camera3d.yaw);
 const cp=Math.cos(camera3d.pitch),sp=Math.sin(camera3d.pitch);
 let x=cy*p.x-sy*p.z;
 let z=sy*p.x+cy*p.z;
 let y=cp*p.y-sp*z;
 z=sp*p.y+cp*z;
 return {x,y,z};
}
function project3D(p){
 const q=rotateToCamera(p);
 if(q.z<=40)return null;
 const f=760;
 return {x:W/2+q.x*f/q.z,y:H/2-q.y*f/q.z,scale:f/q.z,z:q.z};
}
function shoot3D(){
 shots++;
 let best=-1,bestDist=1e9;
 for(let i=0;i<arena3dTargets.length;i++){
  const s=project3D(arena3dTargets[i]);
  if(!s)continue;
  const rr=arena3dTargets[i].r*s.scale;
  const d=Math.hypot(s.x-W/2,s.y-H/2);
  if(d<=rr&&d<bestDist){best=i;bestDist=d}
 }
 if(best>=0){
  const t=arena3dTargets[best],s=project3D(t);
  hits++;combo++;bestCombo=Math.max(bestCombo,combo);
  const distanceBonus=Math.min(2.4,1+t.z/1000);
  score+=Math.floor(280*distanceBonus*(1+combo*.03));
  burst(s.x,s.y,targetColor);
  arena3dTargets.splice(best,1);
  spawn3DTarget();
 }else{
  misses++;combo=0;score=Math.max(0,score-35);
 }
}

function handleClick(){
 if(state!=="playing")return;
 if(mode==="arena3dStatic"||mode==="arena3dMoving"){shoot3D();return}
 if(mode==="dodge"){moveTarget={x:mouse.x,y:mouse.y};return}
 if(mode==="flick"){
  shots++;const t=targets[0];
  if(t&&dist(mouse.x,mouse.y,t.x,t.y)<=t.r){hits++;combo++;bestCombo=Math.max(bestCombo,combo);score+=350*(1+combo*.03);burst(t.x,t.y,targetColor);spawnFlickTarget()}
  else{misses++;combo=0;score=Math.max(0,score-40)}
 }else if(mode==="reaction"){
  shots++;
  if(targets[0]){hits++;const rt=performance.now()-reactionShownAt;reactionTimes.push(rt);score+=Math.max(50,700-rt);combo++;bestCombo=Math.max(bestCombo,combo);burst(targets[0].x,targets[0].y,targetColor);scheduleReaction()}
  else{misses++;combo=0;score=Math.max(0,score-100);scheduleReaction()}
 }else if(mode==="line")castLine();
 else if(mode==="circle")castCircle()
}
function burst(x,y,color){for(let i=0;i<12;i++){const a=Math.random()*Math.PI*2;effects.push({x,y,vx:Math.cos(a)*120,vy:Math.sin(a)*120,life:.4,color})}}

function update(dt){
 if(state!=="playing")return;
 timeLeft-=dt;if(timeLeft<=0){endGame();return}

 if(mode==="flick"){
  const t=targets[0];
  if(t&&performance.now()-t.born>flickLifetime()){misses++;combo=0;spawnFlickTarget()}
 }else if(mode==="tracking"){
  trackingTime+=dt;
  const t=targets[0];

  t.moveTimer-=dt;
  if(t.moveTimer<=0)changeTrackingDirection(t);

  // subtle curve instead of pure straight movement
  const curve=difficulty==="easy"?.12:difficulty==="hard"?.4:.24;
  const angle=curve*dt*(Math.random()<.5?-1:1);
  const cvx=t.vx*Math.cos(angle)-t.vy*Math.sin(angle);
  const cvy=t.vx*Math.sin(angle)+t.vy*Math.cos(angle);
  t.vx=cvx;t.vy=cvy;

  t.x+=t.vx*dt;
  t.y+=t.vy*dt;

  // stay inside the arena, but choose a new direction instead of simple bounce
  let touched=false;
  if(t.x<t.r){t.x=t.r;touched=true}
  if(t.x>W-t.r){t.x=W-t.r;touched=true}
  if(t.y<100+t.r){t.y=100+t.r;touched=true}
  if(t.y>H-t.r){t.y=H-t.r;touched=true}
  if(touched)changeTrackingDirection(t);

  const on=dist(mouse.x,mouse.y,t.x,t.y)<=t.r;
  if(mouse.down&&on){
   trackingOnTarget+=dt;
   score+=100*dt;
   hits++;
   combo++;
   bestCombo=Math.max(bestCombo,Math.floor(combo/6));
  }else if(mouse.down){
   misses++;
   combo=0;
  }
 }else if(mode==="reaction"){
  if(!targets.length&&performance.now()>=reactionReadyAt){targets=[{type:"reaction",x:100+Math.random()*(W-200),y:130+Math.random()*(H-200),r:30}];reactionShownAt=performance.now()}
 }else if(mode==="line"||mode==="circle"){
  for(const t of targets){
   if(mode==="circle"&&t.dodgeTimer>0){
    t.x+=t.dodgeX*dt;t.y+=t.dodgeY*dt;t.dodgeTimer-=dt;
    t.dodgeX*=.985;t.dodgeY*=.985;
   }else{
    t.x+=t.vx*dt;t.y+=t.vy*dt;
   }
   if(t.x<t.r){t.x=t.r;t.vx=Math.abs(t.vx);t.dodgeX=Math.abs(t.dodgeX)}
   if(t.x>W-t.r){t.x=W-t.r;t.vx=-Math.abs(t.vx);t.dodgeX=-Math.abs(t.dodgeX)}
   if(t.y<100+t.r){t.y=100+t.r;t.vy=Math.abs(t.vy);t.dodgeY=Math.abs(t.dodgeY)}
   if(t.y>H-t.r){t.y=H-t.r;t.vy=-Math.abs(t.vy);t.dodgeY=-Math.abs(t.dodgeY)}
  }
  for(let i=projectiles.length-1;i>=0;i--){
   const p=projectiles[i];
   if(p.type==="line"){
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
    for(let j=targets.length-1;j>=0;j--){
     const t=targets[j];
     if(dist(p.x,p.y,t.x,t.y)<p.r+t.r){
      hits++;combo++;bestCombo=Math.max(bestCombo,combo);score+=300*(1+combo*.04);burst(t.x,t.y,targetColor);respawnMobaTarget(t);projectiles.splice(i,1);break
     }
    }
   }else{
    p.delay-=dt;p.life-=dt;
    if(p.delay<=0&&!p.exploded){
     p.exploded=true;let any=false;
     for(const t of targets){
      if(dist(p.x,p.y,t.x,t.y)<=p.r){
       hits++;combo++;bestCombo=Math.max(bestCombo,combo);score+=260*(1+combo*.03);burst(t.x,t.y,targetColor);respawnMobaTarget(t);any=true
      }
     }
     if(!any){misses++;combo=0}
    }
   }
   if(i<projectiles.length&&p.life<=0)projectiles.splice(i,1)
  }
 }else if(mode==="arena3dStatic"||mode==="arena3dMoving"){
  while(arena3dTargets.length<6)spawn3DTarget();

  if(mode==="arena3dMoving"){
   for(const t of arena3dTargets){
    t.x+=t.vx*dt;
    t.y+=t.vy*dt;

    if(Math.abs(t.x)>arena3dRoom.width/2){
     t.x=Math.sign(t.x)*arena3dRoom.width/2;
     t.vx*=-1;
    }
    if(Math.abs(t.y)>arena3dRoom.height/2){
     t.y=Math.sign(t.y)*arena3dRoom.height/2;
     t.vy*=-1;
    }
   }
  }
 }else if(mode==="dodge"){
  const sp=difficulty==="hard"?285:250;
  let dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),dy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);
  if(dx||dy){
   moveTarget=null;const l=Math.hypot(dx,dy)||1;player.x+=dx/l*sp*dt;player.y+=dy/l*sp*dt
  }else if(moveTarget){
   const mx=moveTarget.x-player.x,my=moveTarget.y-player.y,l=Math.hypot(mx,my);
   if(l<5)moveTarget=null;else{player.x+=mx/l*sp*dt;player.y+=my/l*sp*dt}
  }
  player.x=Math.max(player.r,Math.min(W-player.r,player.x));player.y=Math.max(100+player.r,Math.min(H-player.r,player.y));
  spawnTimer-=dt;
  if(spawnTimer<=0){
   spawnDodgeAttack();
   spawnTimer=difficulty==="hard"?.34:difficulty==="easy"?.95:.62
  }
  score+=20*dt;
  for(let i=projectiles.length-1;i>=0;i--){
   const p=projectiles[i];

   if(p.type==="enemy"){
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
    if(dist(p.x,p.y,player.x,player.y)<p.r+player.r){
     hitCount++;player.hp-=20;burst(player.x,player.y,"#ff6374");projectiles.splice(i,1);
     if(player.hp<=0){endGame();return}
    }else if(p.life<=0||p.x<-40||p.x>W+40||p.y<40||p.y>H+40){
     dodgedCount++;score+=80;projectiles.splice(i,1)
    }
    continue;
   }

   if(p.type==="dodgeCircle"){
    if(p.warning>0){
     p.warning-=dt;
    }else{
     p.active-=dt;
     if(!p.resolved){
      p.resolved=true;
      if(dist(p.x,p.y,player.x,player.y)<=p.r+player.r*.35){
       hitCount++;player.hp-=20;burst(player.x,player.y,"#ff6374");
      }else{
       dodgedCount++;score+=100;
      }
      if(player.hp<=0){endGame();return}
     }
     if(p.active<=0)projectiles.splice(i,1)
    }
    continue;
   }

   if(p.type==="dodgeBar"){
    if(p.warning>0){
     p.warning-=dt;
    }else{
     p.active-=dt;
     if(!p.resolved){
      p.resolved=true;
      const inside=player.x+player.r>p.x&&player.x-player.r<p.x+p.w&&player.y+player.r>p.y&&player.y-player.r<p.y+p.h;
      if(inside){
       hitCount++;player.hp-=20;burst(player.x,player.y,"#ff6374");
      }else{
       dodgedCount++;score+=110;
      }
      if(player.hp<=0){endGame();return}
     }
     if(p.active<=0)projectiles.splice(i,1)
    }
   }
  }
 }

 for(const e of effects){e.x+=e.vx*dt;e.y+=e.vy*dt;e.life-=dt}
 effects=effects.filter(e=>e.life>0);updateHud()
}
function respawnMobaTarget(t){
 const a=Math.random()*Math.PI*2,s=(difficulty==="hard"?135:90)*diff()+Math.random()*55;
 t.x=150+Math.random()*(W-300);t.y=140+Math.random()*(H-240);t.vx=Math.cos(a)*s;t.vy=Math.sin(a)*s;t.dodgeX=0;t.dodgeY=0;t.dodgeTimer=0
}
function dist(a,b,c,d){return Math.hypot(a-c,b-d)}
function bgColors(){if(backgroundTheme==="white")return {bg:"#ffffff",grid:"#e2e8f0",enemy:"#ef4444",player:"#2563eb"};if(backgroundTheme==="blue")return {bg:"#0b1730",grid:"#18345b",enemy:"#ff6374",player:"#67e8f9"};return {bg:"#070c13",grid:"#101a27",enemy:"#ff6374",player:"#67e8f9"}}
function draw(){
 const col=bgColors();
 if((mode==="arena3dStatic"||mode==="arena3dMoving")&&state!=="menu"){draw3DArena(col);return}
 ctx.clearRect(0,0,W,H);ctx.fillStyle=col.bg;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle=col.grid;
 for(let x=0;x<=W;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
 for(let y=0;y<=H;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}

 if(mode==="dodge"&&state!=="menu"){
  if(moveTarget){ctx.strokeStyle=crosshairColor+"88";ctx.beginPath();ctx.arc(moveTarget.x,moveTarget.y,18,0,Math.PI*2);ctx.stroke()}
  ctx.fillStyle=col.player;ctx.beginPath();ctx.arc(player.x,player.y,player.r,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=backgroundTheme==="white"?"#ffffff":"#0b1420";ctx.beginPath();ctx.arc(player.x,player.y,6,0,Math.PI*2);ctx.fill()
 }
 for(const t of targets){
  if(t.type==="flick"||t.type==="reaction"||t.type==="tracking")drawTarget(t.x,t.y,t.r,targetColor);
  else{
   ctx.fillStyle=col.enemy;ctx.beginPath();ctx.arc(t.x,t.y,t.r,0,Math.PI*2);ctx.fill();
   ctx.fillStyle=backgroundTheme==="white"?"#7f1d1d":"#3b1117";ctx.beginPath();ctx.arc(t.x,t.y,8,0,Math.PI*2);ctx.fill();
   if(mode==="circle"&&t.dodgeTimer>0){ctx.strokeStyle="#ffd76a";ctx.lineWidth=2;ctx.beginPath();ctx.arc(t.x,t.y,t.r+7,0,Math.PI*2);ctx.stroke()}
  }
 }
 for(const p of projectiles){
  if(p.type==="line"){
   ctx.fillStyle=targetColor;
   ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
  }else if(p.type==="circle"){
   const progress=Math.max(0,Math.min(1,1-p.delay/.65));
   const pulse=1+Math.sin(performance.now()*.025)*.035;

   ctx.fillStyle=p.exploded?targetColor+"44":targetColor+"18";
   ctx.beginPath();ctx.arc(p.x,p.y,p.r*pulse,0,Math.PI*2);ctx.fill();

   ctx.strokeStyle=p.exploded?targetColor:targetColor+"88";
   ctx.lineWidth=p.exploded?6:3;
   ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.stroke();

   if(!p.exploded){
    ctx.strokeStyle="#ffffff";
    ctx.lineWidth=5;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r+8,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);
    ctx.stroke();

    const remain=Math.max(0,p.delay);
    ctx.fillStyle=backgroundTheme==="white"?"#10201b":"#ffffff";
    ctx.font="bold 18px system-ui";
    ctx.textAlign="center";
    ctx.fillText(remain.toFixed(1),p.x,p.y+6);
    ctx.textAlign="left";
   }
  }else if(p.type==="enemy"){
   ctx.fillStyle=col.enemy;
   ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
  }else if(p.type==="dodgeCircle"){
   const progress=p.warning>0?1-p.warning/p.maxWarning:1;
   const active=p.warning<=0;
   ctx.fillStyle=active?"rgba(255,70,82,.48)":"rgba(255,90,100,.13)";
   ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle=active?"#ffffff":"#ff6374";
   ctx.lineWidth=active?7:4;
   ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.stroke();
   if(!active){
    ctx.strokeStyle="#ffffff";
    ctx.lineWidth=4;
    ctx.beginPath();ctx.arc(p.x,p.y,p.r+7,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.stroke();
   }
  }else if(p.type==="dodgeBar"){
   const progress=p.warning>0?1-p.warning/p.maxWarning:1;
   const active=p.warning<=0;
   ctx.fillStyle=active?"rgba(255,70,82,.58)":"rgba(255,90,100,.14)";
   ctx.fillRect(p.x,p.y,p.w,p.h);
   ctx.strokeStyle=active?"#ffffff":"#ff6374";
   ctx.lineWidth=active?7:4;
   ctx.strokeRect(p.x,p.y,p.w,p.h);
   if(!active){
    ctx.fillStyle="#ffffff";
    ctx.fillRect(p.x,p.y-6,p.w*progress,5);
   }
  }
 }
 for(const e of effects){ctx.globalAlpha=e.life/.4;ctx.fillStyle=e.color;ctx.beginPath();ctx.arc(e.x,e.y,4,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1}
 if(state!=="menu")drawCrosshair(mouse.x,mouse.y);
 if(mode==="line"&&state==="playing"){
  ctx.strokeStyle=targetColor+"55";ctx.beginPath();ctx.moveTo(player.x,player.y);ctx.lineTo(mouse.x,mouse.y);ctx.stroke();
  ctx.fillStyle=col.player;ctx.beginPath();ctx.arc(player.x,player.y,15,0,Math.PI*2);ctx.fill()
 }
}

function draw3DArena(col){
 ctx.clearRect(0,0,W,H);

 // simple indoor training room background
 const sky=ctx.createLinearGradient(0,0,0,H);
 if(backgroundTheme==="white"){
  sky.addColorStop(0,"#eef4f1");
  sky.addColorStop(.55,"#d9e4df");
  sky.addColorStop(1,"#c7d4cf");
 }else if(backgroundTheme==="blue"){
  sky.addColorStop(0,"#102239");
  sky.addColorStop(.55,"#0c1829");
  sky.addColorStop(1,"#08111d");
 }else{
  sky.addColorStop(0,"#101815");
  sky.addColorStop(.55,"#0a100e");
  sky.addColorStop(1,"#050807");
 }
 ctx.fillStyle=sky;
 ctx.fillRect(0,0,W,H);

 const horizon=H*.53+camera3d.pitch*205;

 // smooth rear wall and floor without square panels
 const wallGrad=ctx.createLinearGradient(0,0,0,horizon);
 if(backgroundTheme==="white"){
  wallGrad.addColorStop(0,"#e4ece8");
  wallGrad.addColorStop(1,"#ccd9d4");
 }else if(backgroundTheme==="blue"){
  wallGrad.addColorStop(0,"#12263a");
  wallGrad.addColorStop(1,"#0d1927");
 }else{
  wallGrad.addColorStop(0,"#121b18");
  wallGrad.addColorStop(1,"#0b1210");
 }
 ctx.fillStyle=wallGrad;
 ctx.fillRect(0,0,W,horizon);

 const floorGrad=ctx.createLinearGradient(0,horizon,0,H);
 if(backgroundTheme==="white"){
  floorGrad.addColorStop(0,"#c7d4cf");
  floorGrad.addColorStop(1,"#aebdb7");
 }else if(backgroundTheme==="blue"){
  floorGrad.addColorStop(0,"#0b1724");
  floorGrad.addColorStop(1,"#07101a");
 }else{
  floorGrad.addColorStop(0,"#0a1210");
  floorGrad.addColorStop(1,"#050907");
 }
 ctx.fillStyle=floorGrad;
 ctx.fillRect(0,horizon,W,H-horizon);

 // curved side shadows for a cleaner training tunnel feel
 const leftShade=ctx.createLinearGradient(0,0,180,0);
 leftShade.addColorStop(0,backgroundTheme==="white"?"rgba(60,90,82,.18)":"rgba(0,0,0,.42)");
 leftShade.addColorStop(1,"rgba(0,0,0,0)");
 ctx.fillStyle=leftShade;
 ctx.fillRect(0,0,220,H);

 const rightShade=ctx.createLinearGradient(W,0,W-180,0);
 rightShade.addColorStop(0,backgroundTheme==="white"?"rgba(60,90,82,.18)":"rgba(0,0,0,.42)");
 rightShade.addColorStop(1,"rgba(0,0,0,0)");
 ctx.fillStyle=rightShade;
 ctx.fillRect(W-220,0,220,H);

 // floor perspective lines
 ctx.strokeStyle=backgroundTheme==="white"?"rgba(65,100,90,.32)":"rgba(115,247,212,.18)";
 ctx.lineWidth=1;
 for(let i=-10;i<=10;i++){
  const bx=W/2+i*105-camera3d.yaw*430;
  ctx.beginPath();
  ctx.moveTo(W/2,horizon);
  ctx.lineTo(bx,H);
  ctx.stroke();
 }
 for(let z=240;z<=3400;z+=220){
  const sy=horizon+(H-horizon)*(240/z);
  ctx.beginPath();
  ctx.moveTo(0,sy);
  ctx.lineTo(W,sy);
  ctx.stroke();
 }

 // lane lights
 for(let i=0;i<6;i++){
  const lx=150+i*195;
  const glow=ctx.createRadialGradient(lx,86,2,lx,86,48);
  glow.addColorStop(0,"rgba(115,247,212,.26)");
  glow.addColorStop(1,"rgba(115,247,212,0)");
  ctx.fillStyle=glow;
  ctx.beginPath();
  ctx.arc(lx,86,48,0,Math.PI*2);
  ctx.fill();
  ctx.fillStyle=backgroundTheme==="white"?"#5fb9a3":"#2d8f77";
  ctx.fillRect(lx-18,80,36,6);
 }

 const visible=[];
 for(const t of arena3dTargets){
  const s=project3D(t);
  if(s&&s.x>-120&&s.x<W+120&&s.y>-120&&s.y<H+120)visible.push({t,s});
 }
 visible.sort((a,b)=>b.s.z-a.s.z);

 for(const o of visible){
  const rr=Math.max(7,o.t.r*o.s.scale);

  ctx.fillStyle="rgba(0,0,0,.28)";
  ctx.beginPath();
  ctx.arc(o.s.x+3,o.s.y+4,rr*1.18,0,Math.PI*2);
  ctx.fill();

  ctx.fillStyle=targetColor+"1f";
  ctx.beginPath();
  ctx.arc(o.s.x,o.s.y,rr*1.25,0,Math.PI*2);
  ctx.fill();

  ctx.strokeStyle=targetColor;
  ctx.lineWidth=4;
  ctx.beginPath();
  ctx.arc(o.s.x,o.s.y,rr,0,Math.PI*2);
  ctx.stroke();

  ctx.strokeStyle=backgroundTheme==="white"?"rgba(20,50,42,.75)":"rgba(255,255,255,.8)";
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.arc(o.s.x,o.s.y,rr*.58,0,Math.PI*2);
  ctx.stroke();

  ctx.fillStyle=targetColor;
  ctx.beginPath();
  ctx.arc(o.s.x,o.s.y,Math.max(3,rr*.22),0,Math.PI*2);
  ctx.fill();
 }

 for(const e of effects){
  ctx.globalAlpha=e.life/.4;
  ctx.fillStyle=e.color;
  ctx.beginPath();
  ctx.arc(e.x,e.y,4,0,Math.PI*2);
  ctx.fill();
  ctx.globalAlpha=1;
 }

 drawCrosshair(W/2,H/2);
}
function drawTarget(x,y,r,color){ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();ctx.fillStyle=color+"22";ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r*.25,0,Math.PI*2);ctx.fill()}
function drawCrosshair(x,y){ctx.strokeStyle=crosshairColor;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-crosshairSize-4,y);ctx.lineTo(x-4,y);ctx.moveTo(x+4,y);ctx.lineTo(x+crosshairSize+4,y);ctx.moveTo(x,y-crosshairSize-4);ctx.lineTo(x,y-4);ctx.moveTo(x,y+4);ctx.lineTo(x,y+crosshairSize+4);ctx.stroke();ctx.fillStyle=crosshairColor;ctx.fillRect(x-1,y-1,2,2)}
function loop(t){const dt=Math.min(.033,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(loop)}

document.addEventListener("pointerlockchange",()=>{
 if(state==="playing"&&document.pointerLockElement!==canvas){
  mouse.down=false;
 }
});

canvas.addEventListener("mousemove",e=>{
 const r=canvas.getBoundingClientRect();

 if(state==="playing"){
  const scale=sensitivityScale();
  const canvasScaleX=W/r.width;
  const canvasScaleY=H/r.height;

  mouse.x+=e.movementX*scale*canvasScaleX;
  mouse.y+=e.movementY*scale*canvasScaleY;
  clampAim();

  if(mode==="arena3dStatic"||mode==="arena3dMoving"){
   camera3d.yaw+=e.movementX*.0022*scale;
   camera3d.pitch=Math.max(-.7,Math.min(.7,camera3d.pitch-e.movementY*.0022*scale));
  }
 }else{
  mouse.x=(e.clientX-r.left)*W/r.width;
  mouse.y=(e.clientY-r.top)*H/r.height;
 }
});
canvas.addEventListener("mousedown",e=>{
 if(e.button!==0)return;
 if(state==="playing"&&document.pointerLockElement!==canvas){
  lockPointer();
 }
 mouse.down=true;
 handleClick();
});
window.addEventListener("mouseup",()=>mouse.down=false);
window.addEventListener("keydown",e=>{keys[e.key.toLowerCase()]=true;if(e.key==="Escape"){if(state==="playing")pauseGame();else if(state==="paused")resumeGame()}});
window.addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
canvas.addEventListener("contextmenu",e=>e.preventDefault());

$$(".mode-tab").forEach(b=>b.onclick=()=>{
 category=b.dataset.category;
 $$(".mode-tab").forEach(x=>x.classList.toggle("active",x===b));
 $("#fpsModes").classList.toggle("hidden",category!=="fps");
 $("#mobaModes").classList.toggle("hidden",category!=="moba");
 $("#arena3dModes").classList.toggle("hidden",category!=="arena3d");
 const group=category==="fps"?$("#fpsModes"):category==="moba"?$("#mobaModes"):$("#arena3dModes");
 const first=group.querySelector(".mode-card");
 $$(".mode-card").forEach(x=>x.classList.remove("active"));
 first.classList.add("active");mode=first.dataset.mode;updateBestText()
});
$$(".mode-card").forEach(b=>b.onclick=()=>{$$(".mode-card").forEach(x=>x.classList.remove("active"));b.classList.add("active");mode=b.dataset.mode;updateBestText()});
try{
 const saved=JSON.parse(localStorage.getItem("dualAimSettings")||"{}");
 if(saved.mouseDpi){
  mouseDpi=Math.max(100,Math.min(6400,+saved.mouseDpi||800));
  $("#mouseDpi").value=mouseDpi;
 }
 if(saved.mouseSensitivity){
  mouseSensitivity=Math.max(.05,Math.min(5,+saved.mouseSensitivity||1));
  $("#mouseSensitivity").value=mouseSensitivity.toFixed(2);
 }
}catch(e){}
try{
 const sensitivitySaved=JSON.parse(localStorage.getItem("dualAimSettings")||"{}");
 if(sensitivitySaved.mouseDpi){
  mouseDpi=Math.max(100,Math.min(6400,+sensitivitySaved.mouseDpi||800));
  $("#mouseDpi").value=mouseDpi;
 }
 if(sensitivitySaved.mouseSensitivity){
  mouseSensitivity=Math.max(.05,Math.min(5,+sensitivitySaved.mouseSensitivity||1));
  $("#mouseSensitivity").value=mouseSensitivity.toFixed(2);
 }
}catch(e){}
$("#duration").onchange=updateBestText;$("#difficulty").onchange=updateBestText;
$("#startBtn").onclick=startGame;$("#pauseBtn").onclick=pauseGame;$("#resumeBtn").onclick=resumeGame;$("#menuBtn").onclick=toMenu;$("#retryBtn").onclick=startGame;$("#resultMenuBtn").onclick=toMenu;

try{
 const s=JSON.parse(localStorage.getItem("dualAimSettings")||"{}");
 if(s.crosshairColor)$("#crosshairColor").value=s.crosshairColor;
 if(s.targetColor)$("#targetColor").value=s.targetColor;
 if(s.backgroundTheme)$("#backgroundTheme").value=s.backgroundTheme;
 if(s.crosshairSize)$("#crosshairSize").value=s.crosshairSize
}catch{}
updateBestText();requestAnimationFrame(loop);
