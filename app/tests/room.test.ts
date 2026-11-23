import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
async function open(room:string,player:string){
 const r=await SELF.fetch(`https://game.test/ws/${room}`,{headers:{Upgrade:'websocket'}});expect(r.status).toBe(101);const ws=r.webSocket!;ws.accept();const frames:any[]=[];ws.addEventListener('message',(e:MessageEvent)=>{try{frames.push(JSON.parse(String(e.data)))}catch{}});ws.send(JSON.stringify({type:'join',playerId:player}));
 async function next(pred:(f:any)=>boolean){for(let i=0;i<100;i++){const f=frames.find(pred);if(f)return f;await scheduler.wait(10)}throw Error('No matching frame')};return{ws,next};
}
describe('Pauer single-player room',()=>{
 it('starts with one player and preserves a perfect floor on reconnect',async()=>{const room='pauer-'+crypto.randomUUID();const a=await open(room,'alice');const initial=await a.next(f=>f.type==='state');expect(initial.status).toBe('playing');expect(initial.view.level).toBe(0);a.ws.send(JSON.stringify({type:'action',action:{type:'drop',level:0,elapsed:975}}));const placed=await a.next(f=>f.view?.level===1);expect(placed.view.score).toBe(150);const b=await open(room,'alice');expect((await b.next(f=>f.type==='state')).view.level).toBe(1);a.ws.close();b.ws.close()});
 it('refuses spectator actions and reset',async()=>{const room='pauer-'+crypto.randomUUID();const a=await open(room,'alice');await a.next(f=>f.type==='state');const b=await open(room,'spectator');expect((await b.next(f=>f.type==='state')).view.canPlay).toBe(false);b.ws.send(JSON.stringify({type:'action',action:{type:'drop',level:0,elapsed:975}}));expect((await b.next(f=>f.type==='error')).error).toBe('spectators cannot act');b.ws.send(JSON.stringify({type:'reset'}));expect((await b.next(f=>f.error==='spectators cannot reset')).type).toBe('error');a.ws.close();b.ws.close()});
 it('rejects non-websocket requests',async()=>{expect((await SELF.fetch('https://game.test/ws')).status).toBe(426)});
});
