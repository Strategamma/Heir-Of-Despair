import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayer,createGame,startNight,act,departSeat,abandonGame,advancePresentation,viewFor} from '../server/game.js';
const court=()=>{const ps=Array.from({length:5},(_,i)=>newPlayer(`P${i}`)); const g=createGame(ps,ps[0].id); startNight(g); return g;};
test('departure preserves draft passes, finishes both drafts and excludes seat next night',()=>{
 const g=court(), gone=g.players[2]; gone.online=false; const passed=[...gone.draft]; departSeat(g,gone.id);
 assert.equal(gone.alive,false); assert.equal(gone.selected,true);
 for(const p of g.players) if(!p.selected) act(g,p.id,{type:'draft',cardId:p.draft[0]});
 assert.equal(g.stage,'draft2'); assert.deepEqual(g.players[3].draft,passed.slice(1)); assert.equal(gone.selected,true);
 for(const p of g.players) if(!p.selected) act(g,p.id,{type:'draft',cardId:p.draft[0]});
 assert.ok(['night','dawn'].includes(g.stage)); assert.equal(gone.alive,false);
 g.stage='dawn'; startNight(g); assert.equal(g.players.length,4); assert.ok(!g.players.includes(gone)); assert.ok(g.players.every(p=>p.alive));
});
test('cannot forfeit an online seat, host, or drop below four; failure does not mutate',()=>{
 const g=court(); assert.throws(()=>departSeat(g,g.players[1].id),/disconnected/);
 g.players[1].online=false; departSeat(g,g.players[1].id); g.players[2].online=false;
 assert.throws(()=>departSeat(g,g.players[2].id),/four/); assert.equal(g.players[2].departed,undefined);
});
test('pending Usurper departure keeps both inspected identities locked without swapping',()=>{
 const g=court(),p=g.players[1], targets=g.players.slice(2,4); g.stage='night';g.phase=2;g.paced=true;p.online=false;
 const identities=targets.map(t=>({...t.identity})); g.prompt={id:'q',playerId:p.id,kind:'inspect',cardId:'usurper',targets:targets.map(t=>t.id)};
 departSeat(g,p.id); assert.equal(g.prompt,null);assert.deepEqual(targets.map(t=>t.identity),identities); assert.ok(targets.every(t=>t.knownIdentity===null));
});
test('departing reaction owner falls without reaction rewards or killing attacker',()=>{
 const g=court(),p=g.players[1],a=g.players[0];g.stage='night';g.phase=3;g.paced=true;p.online=false;p.hand=['mirror','martyr'];
 g.prompt={id:'q',playerId:p.id,kind:'react',cardId:'assassin1',attackerId:a.id,options:['mirror','martyr']};
 departSeat(g,p.id);assert.equal(p.alive,false);assert.equal(a.alive,true);assert.equal(p.tokens.length,0);assert.equal(g.prompt,null);
});
test('abandon clears pending actions and timers without changing private rewards',()=>{
 const g=court();g.presentation={kind:'phase',until:0};abandonGame(g);assert.equal(g.stage,'abandoned');assert.equal(g.prompt,null);assert.equal(advancePresentation(g,Infinity),false);assert.ok(g.players.every(p=>p.tokens.length===0));assert.equal(viewFor(g,g.hostId).players[1].prestige,undefined);
});
test('Blade target departing after inspection cannot open a dead player reaction',()=>{
 const g=court(),a=g.players[0],t=g.players[1];g.stage='night';g.phase=4;g.paced=true;t.online=false;t.hand=['mirror'];
 g.prompt={id:'q',playerId:a.id,kind:'inspect',cardId:'blade-1',targets:[t.id]};
 departSeat(g,t.id);act(g,a.id,{promptId:'q',choice:'kill'});assert.equal(g.prompt,null);assert.equal(a.alive,true);assert.equal(t.alive,false);
});
