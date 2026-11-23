import assert from 'node:assert/strict';
import {setup,validateAction,applyAction,isGameOver,viewFor} from '../src/logic.js';
const p='builder';let s=setup([p]);
const action=(t,level=s.level)=>({type:'drop',elapsed:t,level});
assert.equal(validateAction(s,'spectator',action(0)).ok,false);
for(const a of [null,{},action(-1),action(NaN),action(Infinity),action(120001),action(50,5),{type:'drop',elapsed:'3',level:0}])assert.equal(validateAction(s,p,a).ok,false);
const original=JSON.stringify(s);const first=applyAction(s,p,action(975));assert.equal(JSON.stringify(s),original);assert.equal(first.level,1);assert.equal(first.last.type,'perfect');assert.equal(first.width,210);assert.equal(first.score,150);
s=first;for(let n=0;n<2;n++){const v=viewFor(s,p);s=applyAction(s,p,action(Math.round(v.motion.period/4)));}assert.equal(s.last.type,'bonus');assert.equal(s.score,650);assert.equal(s.perfects,3);
const miss=applyAction({...setup([p]),x:220,width:80},p,{type:'drop',level:0,elapsed:0});assert.equal(isGameOver(miss).over,true);assert.equal(validateAction(miss,p,action(975,0)).ok,false);
const edge=applyAction(setup([p]),p,{type:'drop',level:0,elapsed:0});assert.equal(edge.width,97);assert.equal(edge.level,1);assert.ok(edge.score>0&&edge.score<150);
let random=setup([p]);for(let i=0;i<1000;i++){const a={type:'drop',level:random.level,elapsed:(i*1731)%10000};if(!validateAction(random,p,a).ok)break;random=applyAction(random,p,a);assert.ok(random.width>0&&random.width<=210);assert.ok(random.x>=22&&random.x+random.width<=458);assert.equal(JSON.stringify(random),JSON.stringify(JSON.parse(JSON.stringify(random))));if(random.ended)break;}
assert.equal(viewFor(s,'spectator').canPlay,false);assert.equal(viewFor(s,p).canPlay,true);
assert.deepEqual(applyAction(first,p,{type:'drop',level:0,elapsed:975}),first);
console.log('Rules verified: precision, shrink, bonus, miss, replay protection, boundaries, serialization, spectators.');
