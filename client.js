import {setup,validateAction,applyAction,viewFor} from './rules.js';
import {T} from './strings.js';
import {LocalRoom} from './local-room.js';
import {setupLeaderboard} from './leaderboard.js';
const $=id=>document.getElementById(id);
const canvas=$('game'),ctx=canvas.getContext('2d',{alpha:false});
const W=480,H=660,BLOCK=43,GROUND=566;
const store={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
const session={get(k,d){try{let v=sessionStorage.getItem(k);if(!v){v=d;sessionStorage.setItem(k,v)}return v}catch{return d}}};
const player=session.get('pauer-player',crypto.randomUUID());
const query=new URLSearchParams(location.search);
const queryRoom=query.get('room');
const room=queryRoom&&/^[A-Za-z0-9_-]{1,64}$/.test(queryRoom)?queryRoom:session.get('pauer-room','solo-'+crypto.randomUUID());
let s=viewFor(setup([player]),player),phase='menu',priorPhase='playing',elapsed=0,fallTime=0,fall=null,pending=null,connected=false,started=false,awaitReset=false,initial=true,ws,retry=0;
let best=store.get('pauer-best-v1',{height:0,score:0});if(!Number.isFinite(best.height)||!Number.isFinite(best.score))best={height:0,score:0};
let reduced=store.get('pauer-reduced',matchMedia('(prefers-reduced-motion: reduce)').matches),sound=store.get('pauer-sound',false),camera=0,targetCamera=0,shake=0,feedbackTime=0,lastFrame=0,fps=60,drawCount=0;
let lastRun=null,runCounter=0,menuTime=0,gamepadHeld=false,shareBusy=false,newRecord=false,debris=null;
const particles=Array.from({length:36},()=>({x:0,y:0,vx:0,vy:0,life:0,size:0}));
const bg=new Image();bg.src='assets/alps.webp';const logo=new Image();logo.src='assets/imboden-logo.svg';
const music=new Audio('assets/music.mp3');music.loop=true;music.volume=.32;music.preload='none';
const impact=new Audio('assets/impact.mp3');impact.volume=.55;impact.preload='auto';
let audioContext;
function audioPlay(a){if(sound&&!document.hidden)a.play().catch(()=>{});}
function tone(bonus=false){if(!sound)return;try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();const start=audioContext.currentTime;[523,659,bonus?1047:784].forEach((f,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0,start+i*.07);g.gain.linearRampToValueAtTime(.055,start+i*.07+.015);g.gain.exponentialRampToValueAtTime(.001,start+i*.07+.22);o.connect(g).connect(audioContext.destination);o.start(start+i*.07);o.stop(start+i*.07+.23)})}catch{}}
function syncSound(){ $('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?T.soundOn:T.soundOff);$('sound').title=sound?T.soundOn:T.soundOff;$('sound-wave').setAttribute('d',sound?'M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14':'m16 9 6 6m0-6-6 6');if(sound&&started&&phase!=='paused')audioPlay(music);else music.pause();}
function syncMotion(){document.body.classList.toggle('reduced',reduced);$('motion').setAttribute('aria-pressed',String(reduced));store.set('pauer-reduced',reduced)}
$('sound').onclick=()=>{sound=!sound;store.set('pauer-sound',sound);syncSound()};$('motion').onclick=()=>{reduced=!reduced;syncMotion()};syncMotion();syncSound();
$('best').textContent=best.height;$('start').disabled=true;$('start').firstChild.textContent=T.loading+' ';
function banner(text){$('connection').textContent=text;$('connection').hidden=!text}
function connect(){
  clearTimeout(retry);ws=new LocalRoom(room);
  ws.onopen=()=>{ws.send(JSON.stringify({type:'join',playerId:player}));};
  ws.onmessage=e=>{if(e.data==='__pong')return;let m;try{m=JSON.parse(e.data)}catch{return}if(m.type==='error'){banner(m.error);if(phase==='fall'){fall=null;phase='paused';showPause()}return}if(m.type!=='state'||!m.view)return;
    connected=true;banner('');if($('start'))$('start').disabled=false;const v=m.view;
    if(!v.canPlay){s=v;phase='spectator';$('start').disabled=true;$('start').textContent=T.spectator;return}
    if(phase==='fall'){pending=v;return}
    s=v;syncHud();
    if(awaitReset){awaitReset=false;startPlay();return}
    if(initial){initial=false;$('start').disabled=false;$('start').innerHTML=T.start+' <span aria-hidden="true">↓</span>';if(s.level>0&&!s.ended){$('overlay-copy').textContent=T.resumed;$('start').firstChild.textContent=T.continue+' ';}if(s.ended)showResult();return}
    if(s.ended&&phase!=='over')showResult();else if(phase==='paused')$('start').disabled=false;
  };
  ws.onclose=()=>{connected=false;if(started&&phase!=='over')pause();banner(T.offline);$('start').disabled=true;retry=setTimeout(connect,1600)};
  ws.onerror=()=>{};
}
connect();setInterval(()=>{if(ws?.readyState===WebSocket.OPEN)ws.send('__ping')},25000);
function syncHud(){ $('height').textContent=s.level*3;$('score').textContent=s.score.toLocaleString('de-CH');$('best').textContent=best.height;const dots=$('pauer-indicator').querySelectorAll('i');for(let i=0;i<3;i++)dots[i].classList.toggle('on',i<s.streak%3);targetCamera=Math.max(0,s.level-5)*BLOCK;}
function startPlay(){leaderboard.reset();debris=null;started=true;phase='playing';elapsed=0;fall=null;pending=null;camera=targetCamera=Math.max(0,s.level-5)*BLOCK;$('overlay').hidden=true;$('play-controls').hidden=false;$('drop').disabled=false;canvas.setAttribute('aria-label','Kran-Spiel. Tippen oder Leertaste zum Setzen. Escape pausiert.');syncHud();audioPlay(music);}
function start(){if(!connected)return;if(phase==='paused'){phase=priorPhase;$('overlay').hidden=true;$('play-controls').hidden=false;audioPlay(music);return}if(phase==='over'||s.ended){awaitReset=true;$('start').disabled=true;ws.send(JSON.stringify({type:'reset'}));return}startPlay()}
$('start').onclick=start;
function xAt(t){const range=W-44-s.width,ph=t/s.motion.period*Math.PI*2-Math.PI/2+(s.level%2?Math.PI:0),wind=s.motion.wind?Math.sin(t/680+s.level)*s.motion.wind:0;return Math.max(22,Math.min(W-22-s.width,22+range*(.5+.5*Math.sin(ph))+wind));}
function currentTop(){return GROUND-s.level*BLOCK+camera}
function drop(customElapsed){if(phase!=='playing'||!connected||ws?.readyState!==WebSocket.OPEN)return;const t=Number.isInteger(customElapsed)?customElapsed:Math.round(elapsed);const a={type:'drop',level:s.level,elapsed:t};if(!validateAction(s,player,a).ok)return;
 const next=viewFor(applyAction(s,player,a),player);fall={x:next.last.rawX,width:s.width,y:currentTop()-BLOCK-120,target:currentTop()-BLOCK,next,level:s.level};fallTime=0;pending=null;phase='fall';$('drop').disabled=true;ws.send(JSON.stringify({type:'action',action:a}));
}
$('drop').onclick=()=>drop();canvas.addEventListener('pointerdown',e=>{e.preventDefault();if(phase==='playing')drop()});
function announce(text){$('announcer').textContent=text}
function flash(text){$('feedback').textContent=text;$('feedback').classList.add('show');feedbackTime=1350;announce(text)}
function emit(x,y,bonus){if(reduced)return;for(let i=0;i<particles.length;i++){const p=particles[i];p.x=x;p.y=y;p.vx=Math.sin(i*2.399)*(.04+(i%4)*.015);p.vy=-.09-(i%5)*.025;p.life=600+(i%4)*100;p.size=bonus?4:2.5;}}
function land(){const next=pending||fall.next;const last=next.last;const px=fall.x+fall.width/2,py=fall.target;if(last.type==='placed'&&last.oldWidth-next.width>1)debris={x:last.delta>0?last.rawX+next.width:last.rawX,y:py,width:last.oldWidth-next.width,age:0,dir:last.delta>0?1:-1};s=next;fall=null;pending=null;elapsed=0;syncHud();
 if(last.type==='miss'){phase='over';showResult();return}
 impact.currentTime=0;audioPlay(impact);shake=reduced?0:4;emit(px,py,last.type==='bonus');
 flash(last.type==='bonus'?T.bonus:last.type==='perfect'?T.perfect:T.placed);if(last.type==='bonus'||last.type==='perfect')tone(last.type==='bonus');
 if(s.level===7)setTimeout(()=>{if(phase==='playing')flash(T.wind)},1400);
 phase='playing';$('drop').disabled=false;if(s.ended)showResult();
}
function showPause(){ $('feedback').classList.remove('show');feedbackTime=0; $('overlay').hidden=false;$('play-controls').hidden=true;$('overlay-panel').innerHTML=`<p class="overlay-kicker">${T.goal}</p><h2>${T.pause}</h2><p>${T.pauseHint}</p><button id="start" class="primary">${T.continue}<span aria-hidden="true">→</span></button><span class="controls-hint">${T.controls}</span>`;$('start').onclick=start;$('start').disabled=!connected;music.pause();}
function pause(){if(phase!=='playing'&&phase!=='fall')return;priorPhase=phase;phase='paused';showPause()}
$('pause').onclick=pause;
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();music.pause()}});window.addEventListener('blur',pause);
function showResult(){$('feedback').classList.remove('show');feedbackTime=0;phase='over';started=true;music.pause();$('play-controls').hidden=true;$('overlay').hidden=false;newRecord=s.level*3>best.height;
 best={height:Math.max(best.height,s.level*3),score:Math.max(best.score,s.score)};store.set('pauer-best-v1',best);syncHud();lastRun={id:++runCounter,score:s.score,height:s.level*3,floors:s.level,perfects:s.perfects,bestStreak:s.bestStreak};
 $('overlay-panel').innerHTML=`<p class="overlay-kicker">${newRecord?T.newRecord:T.miss}</p><h2 class="result-title">${T.result}</h2><div class="result-stats"><div><strong>${s.level*3}<small> m</small></strong><span>${s.level} ${T.floors}</span></div><div><strong>${s.score.toLocaleString('de-CH')}</strong><span>${T.score}</span></div></div><button id="to-board" class="primary">${T.toBoard}<span aria-hidden="true">↗</span></button><button id="start" class="primary outline">${T.again}<span aria-hidden="true">↻</span></button><div class="result-actions"><button id="share" class="text-button">${T.share} ↗</button><button id="save-card" class="text-button">${T.download} ↓</button></div><a class="result-link" href="https://www.walliser-pauer.ch/jobs" target="_blank" rel="noopener">BAU MIT UNS WEITER ↗</a>`;
 $('start').onclick=start;$('to-board').onclick=()=>document.dispatchEvent(new Event('pauer:board'));$('share').onclick=shareResult;$('save-card').onclick=saveCard;announce(`${T.roundEnded}. ${s.level*3} Meter, ${s.score} Punkte.`);
}
const dialog=$('help-dialog');$('help-copy').textContent=T.helpCopy;$('help').onclick=()=>{pause();dialog.showModal()};function closeHelp(){dialog.close()}$('help-close').onclick=closeHelp;$('help-x').onclick=closeHelp;dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
window.addEventListener('keydown',e=>{if(dialog.open||$('board-dialog').open)return;if(e.code==='Escape'){if(phase==='paused')start();else pause();return}if(e.code!=='Space'&&e.code!=='Enter')return;if(e.target.closest('button,a,input')&&e.code==='Enter')return;e.preventDefault();if(e.repeat)return;if(phase==='playing')drop();else if(phase==='menu'||phase==='paused'||phase==='over')start()});
function drawBlock(x,y,w,level,active=false){ctx.fillStyle=active?'#fddb01':level%3===0?'#eadfae':'#d5d6ca';ctx.fillRect(x,y,w,BLOCK-2);ctx.fillStyle=active?'#b38f00':'#9ba9b1';ctx.fillRect(x,y+BLOCK-10,w,8);ctx.fillStyle=active?'#fff18a':'#f2f0dc';ctx.fillRect(x,y,w,4);ctx.strokeStyle='#0a123e';ctx.lineWidth=2;ctx.strokeRect(x,y,w,BLOCK-2);ctx.fillStyle=active?'#0a123e99':'#152c4c';for(let i=12;i<w-13;i+=32){ctx.fillRect(x+i,y+11,15,15);ctx.fillStyle='#ffffff35';ctx.fillRect(x+i+2,y+13,3,11);ctx.fillStyle=active?'#0a123e99':'#152c4c';}if(w>90){ctx.fillStyle=active?'#0a123e':'#617486';ctx.fillRect(x+8,y+BLOCK-8,w-16,2);}drawCount+=6;}
function drawCrane(bx,by,bw){const mastX=433,boomY=148;ctx.strokeStyle='#0a123e';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(mastX,54);ctx.lineTo(mastX,H);ctx.moveTo(48,boomY);ctx.lineTo(480,boomY);ctx.stroke();ctx.strokeStyle='#d7b82f';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(mastX-11,70);ctx.lineTo(mastX-11,H);ctx.moveTo(mastX+11,70);ctx.lineTo(mastX+11,H);for(let y=75;y<H;y+=31){ctx.moveTo(mastX-11,y);ctx.lineTo(mastX+11,y+31);ctx.moveTo(mastX+11,y);ctx.lineTo(mastX-11,y+31)}ctx.moveTo(48,boomY-12);ctx.lineTo(480,boomY-12);ctx.moveTo(48,boomY+5);ctx.lineTo(480,boomY+5);for(let x=48;x<480;x+=27){ctx.moveTo(x,boomY-12);ctx.lineTo(x+27,boomY+5);ctx.lineTo(x+27,boomY-12)}ctx.stroke();ctx.lineWidth=1.5;ctx.strokeStyle='#bed0d4';ctx.beginPath();ctx.moveTo(65,boomY-12);ctx.lineTo(mastX,54);ctx.lineTo(480,boomY-12);ctx.stroke();ctx.fillStyle='#fddb01';ctx.fillRect(407,146,30,28);ctx.fillStyle='#142e48';ctx.fillRect(410,150,21,15);ctx.fillStyle='#778992';ctx.fillRect(451,149,32,31);ctx.fillStyle='#0a123e';ctx.fillRect(325,133,64,20);if(logo.complete&&logo.naturalWidth)ctx.drawImage(logo,330,138,53,12);
 const hookX=bx+bw/2;ctx.strokeStyle='#e5e6cd';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(hookX,boomY+8);ctx.lineTo(hookX,by-25);ctx.stroke();ctx.fillStyle='#0a123e';ctx.fillRect(hookX-8,boomY-8,16,22);ctx.fillStyle='#fddb01';ctx.fillRect(hookX-7,by-33,14,14);ctx.strokeStyle='#d2d7d1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(bx+9,by);ctx.lineTo(hookX,by-18);ctx.lineTo(bx+bw-9,by);ctx.stroke();drawCount+=14;}
const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#101c42');sky.addColorStop(1,'#467080');
function draw(){drawCount=0;ctx.save();ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 if(bg.complete&&bg.naturalWidth){const ratio=bg.naturalWidth/bg.naturalHeight;const bh=H,bw=bh*ratio;ctx.globalAlpha=.83;ctx.drawImage(bg,-(bw-W)*.68,45-camera*.045,bw,bh);ctx.globalAlpha=1;}else{ctx.fillStyle='#6a8798';ctx.beginPath();ctx.moveTo(0,500);ctx.lineTo(75,350);ctx.lineTo(145,415);ctx.lineTo(300,245);ctx.lineTo(480,480);ctx.lineTo(480,660);ctx.lineTo(0,660);ctx.fill();}
 ctx.fillStyle='#0a123e24';ctx.fillRect(0,0,W,H);if(shake>0&&!reduced)ctx.translate(Math.sin(lastFrame*.1)*shake,Math.cos(lastFrame*.1)*shake*.5);
 const g=GROUND+camera; if(g<H+120){ctx.fillStyle='#162a42';ctx.fillRect(0,g+BLOCK,W,H);ctx.fillStyle='#687b86';ctx.fillRect(0,g+BLOCK,W,5);ctx.fillStyle='#243b50';for(let i=0;i<12;i++){ctx.fillRect(i*47+(i%3)*5,g+50+(i%3)*11,26,3)}ctx.fillStyle='#0a123e';ctx.fillRect(98,g+BLOCK-3,284,21);ctx.fillStyle='#fddb01';for(let i=0;i<12;i++){ctx.save();ctx.beginPath();ctx.rect(99,g+BLOCK,282,16);ctx.clip();ctx.translate(100+i*28,g+BLOCK);ctx.transform(1,0,-.55,1,0,0);ctx.fillRect(0,0,12,16);ctx.restore()}}
 if(phase==='menu'&&!started&&s.level===0){drawBlock(135,GROUND,210,-1);drawBlock(138,GROUND-BLOCK,204,0);drawBlock(145,GROUND-BLOCK*2,190,1);drawBlock(145,GROUND-BLOCK*3,190,2);}else{for(let i=Math.max(0,s.blocks.length-13);i<s.blocks.length;i++){const b=s.blocks[i],y=GROUND-(b.level+1)*BLOCK+camera;if(y>-BLOCK&&y<H)drawBlock(b.x,y,b.width,b.level);}}
 if(debris&&debris.age<850&&!reduced){ctx.save();ctx.translate(debris.x+debris.width/2+debris.dir*debris.age*.025,debris.y+debris.age*debris.age*.0005);ctx.rotate(debris.dir*debris.age*.001);drawBlock(-debris.width/2,0,debris.width,0);ctx.restore();}let bx,by,bw=s.width;
 if(fall){bx=fall.x;bw=fall.width;const t=Math.min(1,fallTime/430);by=fall.y+(fall.target-fall.y)*t*t;if(fall.next.ended)by=fall.y+(H+120-fall.y)*Math.min(1,fallTime/650)**2;drawCrane(bx,fall.y,bw);drawBlock(bx,by,bw,fall.level,true);}
 else if(phase!=='over'){bx=xAt(phase==='menu'?menuTime:elapsed);by=currentTop()-BLOCK-120;if(phase==='menu'&&!started&&s.level===0)by=265;drawCrane(bx,by,bw);drawBlock(bx,by,bw,s.level,true);if(phase==='playing'){ctx.strokeStyle='#fddb0155';ctx.setLineDash([4,6]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(bx+bw/2,by+BLOCK);ctx.lineTo(bx+bw/2,currentTop());ctx.stroke();ctx.setLineDash([]);}}
 else drawCrane(180,260,120);
 for(let i=0;i<particles.length;i++){const p=particles[i];if(p.life<=0)continue;ctx.globalAlpha=Math.min(1,p.life/200);ctx.fillStyle=i%3?'#fddb01':'#e9e9d9';ctx.fillRect(p.x,p.y,p.size,p.size)}ctx.globalAlpha=1;
 ctx.fillStyle='#0a123e';ctx.fillRect(0,H-74,W,74);ctx.fillStyle='#ffffff20';ctx.fillRect(0,H-74,W,1);ctx.restore();
}
function tick(now){const dt=Math.min(40,Math.max(0,now-lastFrame||16));lastFrame=now;fps=fps*.94+(1000/Math.max(1,dt))*.06;if(phase==='playing'){elapsed+=dt;if(elapsed>119000)pause();}if(phase==='menu'&&!reduced)menuTime+=dt;if(phase==='fall'){fallTime+=dt;if(fallTime>(fall?.next.ended?700:460))land();}if(phase!=='paused'){if(debris)debris.age+=dt;camera+=(targetCamera-camera)*(reduced?1:Math.min(1,dt*.008));shake*=.85;for(let i=0;i<particles.length;i++){const p=particles[i];if(p.life<=0)continue;p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=dt*.00025}}if(feedbackTime>0){feedbackTime-=dt;if(feedbackTime<=0)$('feedback').classList.remove('show')}
 const pads=navigator.getGamepads?.();const pad=pads?.[0];if(pad){const pressed=!!pad.buttons[0]?.pressed;if(pressed&&!gamepadHeld){if(phase==='playing')drop();else if(phase==='menu'||phase==='paused'||phase==='over')start()}gamepadHeld=pressed;}
 draw();if(query.has('debug')){$('debug').hidden=false;$('debug').textContent=`${fps.toFixed(0)} fps · ${(1000/fps).toFixed(1)} ms\n${phase} · ${drawCount} draws · ${s.level} floors`;}
 requestAnimationFrame(tick);
}
const ro=new ResizeObserver(()=>{const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0)});ro.observe(canvas);requestAnimationFrame(tick);
async function resultBlob(){await document.fonts.ready;const c=document.createElement('canvas');c.width=1080;c.height=1350;const g=c.getContext('2d');g.fillStyle='#0a123e';g.fillRect(0,0,c.width,c.height);if(bg.complete&&bg.naturalWidth){g.globalAlpha=.65;g.drawImage(bg,-620,370,2300,1294);g.globalAlpha=1;}const shade=g.createLinearGradient(0,0,0,1350);shade.addColorStop(0,'#0a123e');shade.addColorStop(.55,'#0a123e20');shade.addColorStop(1,'#0a123e');g.fillStyle=shade;g.fillRect(0,0,1080,1350);if(logo.complete)g.drawImage(logo,70,70,330,76);g.fillStyle='#fddb01';g.font='800 125px Display';g.fillText('PAUER AM HAKEN.',70,320);g.fillStyle='#f3f3f3';g.font='400 32px Bitter';g.fillText('So hoch reicht mini Pauer.',74,390);g.fillStyle='#fddb01';g.font='800 300px Display';g.fillText(String(s.level*3),65,770);g.font='700 100px Display';const mw=g.measureText(String(s.level*3));g.fillText('METER',70,890);g.fillStyle='#f3f3f3';g.font='700 36px Sans';g.fillText(`${s.score.toLocaleString('de-CH')} Punkte · ${s.level} Stockwerke`,74,990);g.strokeStyle='#ffffff50';g.beginPath();g.moveTo(70,1130);g.lineTo(1010,1130);g.stroke();g.font='700 30px Sans';g.fillText('UND WIE VIEL PAUER HESCH DÜ?',74,1200);g.fillStyle='#fddb01';g.font='500 25px Sans';g.fillText(location.hostname,74,1255);return new Promise(resolve=>c.toBlob(resolve,'image/png'));}
async function saveCard(){if(shareBusy)return;shareBusy=true;try{const blob=await resultBlob();if(!blob)throw Error('empty');const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`pauer-am-haken-${s.level*3}m.png`;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}catch{flash(T.shareFail)}finally{shareBusy=false}}
async function shareResult(){if(shareBusy)return;shareBusy=true;try{const blob=await resultBlob(),file=blob?new File([blob],'mini-pauer.png',{type:'image/png'}):null;const data={title:'Pauer am Haken',text:`${s.level*3} Meter, ${s.score} Punkte. So hoch reicht mini Pauer!`,url:location.origin+location.pathname};if(file&&navigator.canShare?.({files:[file]})){await navigator.share({...data,files:[file]})}else if(navigator.share){await navigator.share(data)}else if(navigator.clipboard){await navigator.clipboard.writeText(data.text+' '+data.url);flash(T.copied)}else{flash(T.shareFail)}}catch(e){if(e.name!=='AbortError')flash(T.shareFail)}finally{shareBusy=false}}
if(query.has('debug'))window.__pauer={snapshot:()=>({state:JSON.parse(JSON.stringify(s)),phase,elapsed,connected,fps,drawCount,room,player}),drop:t=>drop(t),start,pause};

const leaderboard=setupLeaderboard({getRun:()=>lastRun});
document.addEventListener('pauer:pause',pause);document.addEventListener('pauer:again',()=>{if(phase==='over'||s.ended)start()});
document.querySelectorAll('[data-board]').forEach(b=>b.addEventListener('click',()=>document.dispatchEvent(new Event('pauer:board'))));
