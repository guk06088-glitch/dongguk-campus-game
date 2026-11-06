import { DurableObject } from 'cloudflare:workers';
import { serveWithAuth, rateLimitAttempt } from './auth.js';

const cleanName = v => String(v||'방문자').replace(/[<>\\]/g,'').trim().slice(0,12)||'방문자';
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):0;
const ELEPHANTS=[{x:-9.6,z:2.8},{x:-6.5,z:4.1},{x:-8,z:7.6}];
const rideIndex=v=>Number.isInteger(v)&&v>=0&&v<ELEPHANTS.length?v:null;
const MAX_WISHES=18;
// R13: global simulated ordination ceremony; the Durable Object is authoritative.
const SG_X=28, SG_Z=-13;
const SG_INSIDE=(x,z)=>Math.abs(x-SG_X)<12.12&&z>SG_Z-8.22&&z<SG_Z+8.25;
const SG_SEATS=Array.from({length:60},(_,i)=>{const row=Math.floor(i/10),col=i%10;return {id:i+1,x:SG_X+(col<5?-10.6+col*1.91:2.96+(col-5)*1.91),z:SG_Z-2.77+row*1.08}});
const SG_STORAGE='dgu-sugye-r13-v2';
const SG_RANDOM_DELAY=()=>120_000+Math.floor(Math.random()*240_001); // random 2–6 minutes before 60-second notice
const SG_NEW=()=>({phase:'idle',eventId:0,scheduleVersion:5,nextAt:Date.now()+SG_RANDOM_DELAY(),noticeAt:0,startAt:0,endAt:0,nextCallAt:0,calledAt:0,current:0,queue:[]});
const SG_SPOT={x:SG_X,y:2.38,z:SG_Z-4.25};

const WISH_STORAGE_KEY='public-wishes-v1';
const LOOK_ROBES=new Set(['gray', 'charcoal', 'brown', 'ochre', 'plum', 'sage', 'ivory', 'sand', 'amber', 'navy', 'indigo', 'teal', 'forest', 'burgundy', 'rose', 'lavender', 'sky', 'black']);
const LOOK_HATS=new Set(['none', 'cap', 'straw', 'hood', 'beanie', 'bucket', 'wrap', 'band', 'travel', 'beret', 'lotus']);
const LOOK_BAGS=new Set(['none', 'pouch', 'shoulder', 'satchel', 'backpack', 'tote', 'crossbody', 'basket', 'scroll', 'bookbag']);
const LOOK_ACCESSORY_COLORS=new Set(['sand', 'cream', 'charcoal', 'brown', 'white', 'indigo', 'teal', 'forest', 'plum', 'pink', 'orange', 'navy']);
const cleanLook=v=>({
 robe:LOOK_ROBES.has(v?.robe)?v.robe:'gray',
 hat:LOOK_HATS.has(v?.hat)?v.hat:'none',
 hatColor:LOOK_ACCESSORY_COLORS.has(v?.hatColor)?v.hatColor:'sand',
 bag:LOOK_BAGS.has(v?.bag)?v.bag:'pouch',
 bagColor:LOOK_ACCESSORY_COLORS.has(v?.bagColor)?v.bagColor:'sand'
});
const cleanWish=v=>String(v||'').replace(/[\x00-\x1F\x7F<>]/g,'').replace(/\s+/g,' ').trim().slice(0,30);
async function fetchGame(request,env){
 const url=new URL(request.url);
 if(url.pathname==='/ws'){
  const id=env.CAMPUS_ROOM.idFromName('public-campus-v1');
  return env.CAMPUS_ROOM.get(id).fetch(request);
 }
 return env.ASSETS.fetch(request);
}
export default {
 async fetch(request,env){
  return serveWithAuth(request,env,fetchGame);
 }
};
export class CampusRoom extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.lastChat=new WeakMap();this.lastMove=new WeakMap();this.lastGreet=new WeakMap();this.lastWish=new WeakMap();this.lastLook=new WeakMap();
  // Storage survives WebSocket hibernation, object restarts and reconnects.
  ctx.blockConcurrencyWhile(async()=>{this.sugye=(await ctx.storage.get(SG_STORAGE))||SG_NEW();
    // Upgrade the persistent R13 schedule once: keep an in-progress event but randomize the next idle ceremony.
    if(this.sugye.scheduleVersion!==5){this.sugye.scheduleVersion=5;if(this.sugye.phase==='idle')this.sugye.nextAt=Date.now()+SG_RANDOM_DELAY();await ctx.storage.put(SG_STORAGE,this.sugye);}
    await this.sugyeWake();});
 }
 // Drop sockets established before auth was enabled or whose 12-hour session expired.
 authorizedSocket(ws){const a=ws.deserializeAttachment();const valid=Number.isFinite(a?.authExpiresAt)&&a.authExpiresAt>Date.now();
  if(!valid){try{ws.send(JSON.stringify({type:'authExpired'}));ws.close(1008,'Authentication expired')}catch{}}
  return valid;
 }
 peers(){return this.ctx.getWebSockets().filter(ws=>this.authorizedSocket(ws)).map(ws=>({ws,state:ws.deserializeAttachment()})).filter(p=>p.state);}
 send(ws,data){try{ws.send(JSON.stringify(data))}catch{}}
 broadcast(data,except){const str=JSON.stringify(data);for(const ws of this.ctx.getWebSockets()){if(ws!==except&&this.authorizedSocket(ws)){try{ws.send(str)}catch{}}}}
 count(){this.broadcast({type:'count',count:this.peers().filter(p=>p.state.ready).length})}
 rides(){const out={};for(const {state} of this.peers())if(state.ready&&state.rideId!==null)out[state.rideId]=state.id;return out;}
 seats(excludeWs=null){const seats={};for(const {ws,state} of this.peers())if(ws!==excludeWs&&state.ready&&Number.isInteger(state.seatId))seats[state.seatId]=state.id;return seats;}
 sugyePacket(){const a=this.sugye;return {type:'sugyeState',phase:a.phase,eventId:a.eventId,noticeAt:a.noticeAt,startAt:a.startAt,endAt:a.endAt,nextAt:a.nextAt,calledAt:a.calledAt,current:a.current,queue:a.queue.map(q=>({id:q.id,seatId:q.seatId,done:q.done||false,skipped:q.skipped||false}))};}
 sugyeBroadcast(){this.broadcast(this.sugyePacket());}
 async sugyeWake(){const a=this.sugye;let n=a.phase==='idle'?a.nextAt:a.phase==='notice'?a.startAt:Math.min(a.endAt,a.calledAt?a.calledAt+65000:a.nextCallAt||a.endAt);
  await this.ctx.storage.setAlarm(Math.max(Date.now()+300,Number(n)||Date.now()+60000));}
 async sugyeSave(){await this.ctx.storage.put(SG_STORAGE,this.sugye);await this.sugyeWake();this.sugyeBroadcast();}
 async sugyeNotice(now=Date.now()){
  const a=this.sugye;if(a.phase!=='idle')return;
  a.phase='notice';a.eventId++;a.noticeAt=now;a.startAt=now+60_000;a.endAt=0;a.current=0;a.queue=[];a.calledAt=0;a.nextCallAt=0;
  for(const {ws,state} of this.peers()){if(state.sugyeIntent){state.sugyeIntent=false;ws.serializeAttachment(state)}}
  await this.sugyeSave();
 }
 async sugyeBegin(now=Date.now()){
  const a=this.sugye;if(a.phase!=='notice')return;
  const peers=this.peers();a.phase='active';a.startAt=Math.min(a.startAt,now);a.endAt=now+6*60_000;
  a.queue=peers.filter(({state})=>state.ready&&state.sugyeIntent&&Number.isInteger(state.seatId)&&SG_INSIDE(state.x,state.z))
   .map(({state})=>({id:state.id,seatId:state.seatId,done:false,skipped:false})).sort((l,r)=>l.seatId-r.seatId);
  a.current=0;a.calledAt=0;a.nextCallAt=now+3600;
  a.endAt=a.queue.length?now+Math.max(90000,a.queue.length*72000+30000):now+35_000;
  for(const {ws,state} of peers){if(SG_INSIDE(state.x,state.z)&&!a.queue.some(q=>q.id===state.id)){
   state.x=SG_X;state.y=2.38;state.z=SG_Z+10.8;state.seatId=null;ws.serializeAttachment(state);
   this.send(ws,{type:'sugyeEjected',reason:'ceremony'});this.broadcast({type:'move',...state},ws);
  }}
  this.broadcast({type:'sugyeSeatState',seats:this.seats()});
  await this.sugyeSave();
 }
 async sugyeFinish(now=Date.now()){
  const a=this.sugye;if(a.phase==='idle')return;
  a.phase='idle';a.nextAt=now+SG_RANDOM_DELAY();a.noticeAt=0;a.startAt=0;a.endAt=0;a.calledAt=0;a.nextCallAt=0;a.queue=[];a.current=0;
  for(const {ws,state} of this.peers())if(state.sugyeIntent){state.sugyeIntent=false;ws.serializeAttachment(state)}
  await this.sugyeSave();
 }
 async sugyeAdvance(now=Date.now()){
  let a=this.sugye;if(a.phase==='idle'&&now>=a.nextAt){await this.sugyeNotice(now);return}
  if(a.phase==='notice'&&now>=a.startAt){await this.sugyeBegin(now);return}
  if(a.phase!=='active')return;
  if(now>=a.endAt){await this.sugyeFinish(now);return}
  if(a.calledAt&&now-a.calledAt>=65_000){const q=a.queue[a.current];if(q)q.skipped=true;a.current++;a.calledAt=0;a.nextCallAt=now+4_000;await this.sugyeSave();return}
  if(!a.calledAt&&now>=a.nextCallAt){
   if(a.current>=a.queue.length){await this.sugyeFinish(now);return;}
   const q=a.queue[a.current];if(!this.peers().some(p=>p.state.ready&&p.state.id===q.id)){
    q.skipped=true;a.current++;a.nextCallAt=now+1700;await this.sugyeSave();return;
   }
   a.calledAt=now;await this.sugyeSave();return;
  }
 }
 async alarm(){await this.sugyeAdvance();await this.sugyeWake();}

 async fetch(request){
  if(new URL(request.url).pathname==='/__auth/rate-limit')return rateLimitAttempt(request,this.ctx);
  const expiresAt=Number(request.headers.get('X-DGU-Auth-Expires'));
  if(!Number.isSafeInteger(expiresAt)||expiresAt<=Date.now()||expiresAt>Date.now()+12*60*60_000)
   return new Response('Unauthorized',{status:401});
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
  const pair=new WebSocketPair();const [client,server]=Object.values(pair);
  this.ctx.acceptWebSocket(server);
  const id=crypto.randomUUID();const state={id,authExpiresAt:expiresAt,name:'방문자',x:1,y:0,z:28,r:0,ready:false,rideId:null,seatId:null,sugyeIntent:false,look:cleanLook(null)};server.serializeAttachment(state);
  const peers=this.peers().filter(p=>p.ws!==server&&p.state.ready).map(p=>p.state);
  const wishes=await this.ctx.storage.get(WISH_STORAGE_KEY)||[];
  await this.sugyeAdvance();this.send(server,{type:'welcome',id,peers,rides:this.rides(),wishFeature:true,wishes:Array.isArray(wishes)?wishes:[],sugyeFeature:true,sugye:this.sugyePacket(),seats:this.seats()});
  return new Response(null,{status:101,webSocket:client});
 }
 async webSocketMessage(ws,raw){
  if(typeof raw!=='string'||raw.length>1200)return;
  let data;try{data=JSON.parse(raw)}catch{return}
  if(!this.authorizedSocket(ws))return;
  const state=ws.deserializeAttachment();if(!state)return;
  await this.sugyeAdvance();
  if(data.type==='hello'){
   state.name=cleanName(data.name);state.look=cleanLook(data.look);state.ready=true;ws.serializeAttachment(state);
   this.send(ws,{type:'identity',id:state.id,name:state.name});
   this.broadcast({type:'join',...state},ws);this.count();
  }else if(!state.ready){return;
  }else if(data.type==='move'){
   const now=Date.now();if(now-(this.lastMove.get(ws)||0)<100)return;this.lastMove.set(ws,now);
   state.x=finite(data.x,-200,200);state.y=finite(data.y,-10,40);state.z=finite(data.z,-200,200);state.r=finite(data.r,-7,7);
   if(this.sugye.phase==='active'&&SG_INSIDE(state.x,state.z)&&!this.sugye.queue.some(q=>q.id===state.id)){
    state.x=SG_X;state.y=2.38;state.z=SG_Z+10.8;this.send(ws,{type:'sugyeEjected',reason:'locked'});
   }
   if(Number.isInteger(state.seatId)&&Math.hypot(state.x-SG_SEATS[state.seatId-1].x,state.z-SG_SEATS[state.seatId-1].z)>3.5){state.seatId=null;this.broadcast({type:'sugyeSeatState',seats:this.seats()})}
   ws.serializeAttachment(state);this.broadcast({type:'move',...state},ws);
  }else if(data.type==='sugyeGet'){
   this.send(ws,this.sugyePacket());this.send(ws,{type:'sugyeSeatState',seats:this.seats()});
  }else if(data.type==='sugyeJoin'){
   const a=this.sugye;
   if(a.phase!=='notice'){this.send(ws,{type:'sugyeInfo',reason:'join-position'});return;}
   if(typeof data.x==='number'&&typeof data.z==='number'&&SG_INSIDE(data.x,data.z)){state.x=finite(data.x,-200,200);state.z=finite(data.z,-200,200);state.y=2.38;this.broadcast({type:'move',...state},ws);}
   if(!SG_INSIDE(state.x,state.z)){this.send(ws,{type:'sugyeInfo',reason:'join-position'});return;}
   state.sugyeIntent=true;ws.serializeAttachment(state);
   this.send(ws,{type:'sugyeJoined'});
  }else if(data.type==='sugyeDecline'){
   state.sugyeIntent=false;state.seatId=null;state.x=SG_X;state.y=2.38;state.z=SG_Z+10.8;ws.serializeAttachment(state);
   this.broadcast({type:'sugyeSeatState',seats:this.seats()});
   this.send(ws,{type:'sugyeEjected',reason:'declined'});
   this.broadcast({type:'move',...state},ws);
  }else if(data.type==='sugyeSeatClaim'){
   const seat=SG_SEATS[Number(data.seatId)-1];
   if(typeof data.x==='number'&&typeof data.z==='number'&&SG_INSIDE(data.x,data.z)&&(SG_INSIDE(state.x,state.z)||this.sugye.phase!=='active'||this.sugye.queue.some(q=>q.id===state.id))){state.x=finite(data.x,-200,200);state.z=finite(data.z,-200,200);state.y=2.38;}
   if(!seat||!SG_INSIDE(state.x,state.z)||Math.hypot(state.x-seat.x,state.z-seat.z)>(data.moveToSeat===true?7.5:3.2)||
    (this.sugye.phase==='active'&&!this.sugye.queue.some(q=>q.id===state.id))){
     this.send(ws,{type:'sugyeSeatDenied',reason:'distance'});return;
   }
   if(this.peers().some(p=>p.ws!==ws&&p.state.seatId===seat.id)){
    this.send(ws,{type:'sugyeSeatDenied',reason:'occupied',seatId:seat.id});return;
   }
   state.seatId=seat.id;if(data.moveToSeat===true){state.x=seat.x;state.y=2.38;state.z=seat.z;this.broadcast({type:'move',...state},ws);}
   ws.serializeAttachment(state);
   this.send(ws,{type:'sugyeSeatGranted',seatId:seat.id});
   this.broadcast({type:'sugyeSeatState',seats:this.seats()});
  }else if(data.type==='sugyeSeatRelease'){
   if(Number.isInteger(state.seatId)){
    state.seatId=null;ws.serializeAttachment(state);
    this.broadcast({type:'sugyeSeatState',seats:this.seats()});
   }
  }else if(data.type==='sugyeReceive'){
   const a=this.sugye,q=a.queue[a.current];const now=Date.now();
   if(a.phase!=='active'||!a.calledAt||!q||q.id!==state.id||q.done||
    Number.isInteger(state.seatId)||Math.hypot(state.x-SG_SPOT.x,state.z-SG_SPOT.z)>3.3){
     this.send(ws,{type:'sugyeInfo',reason:'not-ready'});return;
   }
   q.done=true;a.calledAt=0;a.current++;a.nextCallAt=now+4500;
   this.broadcast({type:'sugyeCompleted',seatId:q.seatId,id:state.id});
   await this.sugyeSave();
  }else if(data.type==='look'){
   state.look=cleanLook(data.look);ws.serializeAttachment(state);
   this.broadcast({type:'look',id:state.id,look:state.look},ws);
  }else if(data.type==='rideRequest'){
   const id=rideIndex(data.elephantId),pos=id===null?null:ELEPHANTS[id];
   if(id===null||state.rideId!==null||Math.hypot(state.x-pos.x,state.z-pos.z)>5.2){
    this.send(ws,{type:'rideDenied',elephantId:data.elephantId,reason:'distance'});return;
   }
   const occupied=this.peers().some(p=>p.ws!==ws&&p.state.ready&&p.state.rideId===id);
   if(occupied){this.send(ws,{type:'rideDenied',elephantId:id,reason:'occupied'});return;}
   // A Durable Object handles messages sequentially; reserve immediately in attachment.
   state.rideId=id;ws.serializeAttachment(state);
   this.send(ws,{type:'rideGranted',elephantId:id});
   this.broadcast({type:'rideState',elephantId:id,ownerId:state.id});
  }else if(data.type==='rideLeave'){
   if(state.rideId===null)return;
   const id=state.rideId;state.rideId=null;ws.serializeAttachment(state);
   this.broadcast({type:'rideState',elephantId:id,ownerId:null});
  }else if(data.type==='greet'){
   // One short synchronized motion; no user-provided text or positions accepted.
   const now=Date.now();if(now-(this.lastGreet.get(ws)||0)<1600)return;
   this.lastGreet.set(ws,now);this.broadcast({type:'greet',id:state.id},ws);
  }else if(data.type==='wish'){
   const now=Date.now();
   if(now-(this.lastWish.get(ws)||0)<3500){this.send(ws,{type:'wishDenied',reason:'rate'});return;}
   const wish=cleanWish(data.text);
   if(!wish){this.send(ws,{type:'wishDenied',reason:'empty'});return;}
   this.lastWish.set(ws,now);
   try{
    const stored=await this.ctx.storage.get(WISH_STORAGE_KEY);
    const old=Array.isArray(stored)?stored:[];
    const entry={id:crypto.randomUUID(),text:wish,createdAt:now};
    const wishes=[...old,entry].slice(-MAX_WISHES);
    await this.ctx.storage.put(WISH_STORAGE_KEY,wishes);
    // Send a complete, ordered view to every connected visitor, including the author.
    this.broadcast({type:'wishSync',wishes,createdBy:state.id});
   }catch(err){console.error('wish storage failure',err);this.send(ws,{type:'wishDenied',reason:'storage'});}
  }else if(data.type==='chat'){
   const now=Date.now();if(now-(this.lastChat.get(ws)||0)<750)return;this.lastChat.set(ws,now);
   const text=String(data.text||'').trim().slice(0,250);if(text)this.broadcast({type:'chat',id:state.id,name:state.name,text},ws);
  }
 }
 async webSocketClose(ws){const state=ws.deserializeAttachment();if(state?.ready){
  if(state.rideId!==null)this.broadcast({type:'rideState',elephantId:state.rideId,ownerId:null},ws);
  this.broadcast({type:'leave',id:state.id},ws);if(Number.isInteger(state.seatId))this.broadcast({type:'sugyeSeatState',seats:this.seats(ws)},ws);
 }this.count();}
 async webSocketError(ws){const state=ws.deserializeAttachment();if(state?.ready){
  if(state.rideId!==null)this.broadcast({type:'rideState',elephantId:state.rideId,ownerId:null},ws);
  this.broadcast({type:'leave',id:state.id},ws);if(Number.isInteger(state.seatId))this.broadcast({type:'sugyeSeatState',seats:this.seats(ws)},ws);
 }this.count();}
}
