/** Deterministic single-player crane stacking. Scores are personal, never ranked globally. */
export const meta = { game: 'Pauer am Haken', minPlayers: 1, maxPlayers: 1 };
const WORLD = 480;
function motion(s, t) {
  const width = s.width;
  const range = WORLD - 44 - width;
  const period = Math.max(1550, 3900 - s.level * 95);
  const phase = t / period * Math.PI * 2 - Math.PI / 2 + (s.level % 2 ? Math.PI : 0);
  const wind = s.level >= 7 ? Math.sin(t / 680 + s.level) * Math.min(13, s.level * .55) : 0;
  return Math.max(22, Math.min(WORLD - 22 - width, 22 + range * (.5 + .5 * Math.sin(phase)) + wind));
}
export function setup(players) {
  return { players: players.slice(0, 1), level: 0, score: 0, width: 210, x: 135, streak: 0, perfects: 0, bestStreak: 0, ended: false, last: null, blocks: [{x:135, width:210, level:-1}] };
}
export function validateAction(s, playerId, a) {
  if (!s || !s.players.includes(playerId)) return {ok:false,error:'Nur die spielende Person kann bauen.'};
  if (s.ended) return {ok:false,error:'Die Runde ist beendet.'};
  if (!a || a.type !== 'drop' || !Number.isInteger(a.level) || a.level !== s.level) return {ok:false,error:'Dieses Bauteil wurde bereits gesetzt.'};
  if (!Number.isInteger(a.elapsed) || a.elapsed < 0 || a.elapsed > 120000) return {ok:false,error:'Ungültiger Zeitpunkt. Bitte neu ansetzen.'};
  return {ok:true};
}
export function applyAction(s, playerId, a) {
  const verdict = validateAction(s,playerId,a);
  if (!verdict.ok) return s;
  const rawX = motion(s,a.elapsed);
  const delta = rawX - s.x;
  const tolerance = Math.max(5, Math.min(10, s.width * .047));
  const perfect = Math.abs(delta) <= tolerance;
  const left = Math.max(rawX,s.x), right = Math.min(rawX+s.width,s.x+s.width);
  const overlap = right-left;
  if (overlap < 9) return {...s,ended:true,last:{type:'miss',rawX,oldWidth:s.width,delta}};
  const streak = perfect ? s.streak+1 : 0;
  const bonus = perfect && streak % 3 === 0;
  let width = perfect ? s.width : overlap;
  let x = perfect ? s.x : left;
  if (bonus) {const gain = Math.min(18,210-width);width+=gain;x=Math.max(22,Math.min(WORLD-22-width,x-gain/2));}
  const points = perfect ? 150 + (bonus ? 200 : 0) : Math.round(50+50*overlap/s.width);
  const blocks = [...s.blocks,{x,width,level:s.level,perfect,bonus}];
  return {...s,level:s.level+1,score:s.score+points,x,width,streak,perfects:s.perfects+(perfect?1:0),bestStreak:Math.max(s.bestStreak,streak),ended:s.level>=999,blocks,last:{type:bonus?'bonus':perfect?'perfect':'placed',rawX,oldWidth:s.width,delta,points}};
}
export function isGameOver(s) {return s.ended ? {over:true,winner:null,score:s.score,height:s.level*3} : {over:false};}
export function viewFor(s,playerId) {return {...s,canPlay:s.players.includes(playerId),motion:{world:WORLD,margin:22,period:Math.max(1550,3900-s.level*95),wind:s.level>=7?Math.min(13,s.level*.55):0}};}
