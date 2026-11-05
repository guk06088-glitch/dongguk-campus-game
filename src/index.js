import { DurableObject } from 'cloudflare:workers';

const cleanName = v => String(v||'방문자').replace(/[<>\\]/g,'').trim().slice(0,12)||'방문자';
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):0;
const ELEPHANTS=[{x:-9.6,z:2.8},{x:-6.5,z:4.1},{x:-8,z:7.6}];
const rideIndex=v=>Number.isInteger(v)&&v>=0&&v<ELEPHANTS.length?v:null;
const MAX_WISHES=18;
const WISH_STORAGE_KEY='public-wishes-v1';
const cleanWish=v=>String(v||'').replace(/[\x00-\x1F\x7F<>]/g,'').replace(/\s+/g,' ').trim().slice(0,30);
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/ws'){
   if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
   const id=env.CAMPUS_ROOM.idFromName('public-campus-v1');
   return env.CAMPUS_ROOM.get(id).fetch(request);
  }
  return env.ASSETS.fetch(request);
 }
};
export class CampusRoom extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.lastChat=new WeakMap();this.lastMove=new WeakMap();this.lastGreet=new WeakMap();this.lastWish=new WeakMap();}
 peers(){return this.ctx.getWebSockets().map(ws=>({ws,state:ws.deserializeAttachment()})).filter(p=>p.state);}
 send(ws,data){try{ws.send(JSON.stringify(data))}catch{}}
 broadcast(data,except){const str=JSON.stringify(data);for(const ws of this.ctx.getWebSockets()){if(ws!==except){try{ws.send(str)}catch{}}}}
 count(){this.broadcast({type:'count',count:this.peers().filter(p=>p.state.ready).length})}
 rides(){const out={};for(const {state} of this.peers())if(state.ready&&state.rideId!==null)out[state.rideId]=state.id;return out;}
 async fetch(request){
  const pair=new WebSocketPair();const [client,server]=Object.values(pair);
  this.ctx.acceptWebSocket(server);
  const id=crypto.randomUUID();const state={id,name:'방문자',x:1,y:0,z:28,r:0,ready:false,rideId:null};server.serializeAttachment(state);
  const peers=this.peers().filter(p=>p.ws!==server&&p.state.ready).map(p=>p.state);
  const wishes=await this.ctx.storage.get(WISH_STORAGE_KEY)||[];
  this.send(server,{type:'welcome',id,peers,rides:this.rides(),wishFeature:true,wishes:Array.isArray(wishes)?wishes:[]});
  return new Response(null,{status:101,webSocket:client});
 }
 async webSocketMessage(ws,raw){
  if(typeof raw!=='string'||raw.length>1200)return;
  let data;try{data=JSON.parse(raw)}catch{return}
  const state=ws.deserializeAttachment();if(!state)return;
  if(data.type==='hello'){
   state.name=cleanName(data.name);state.ready=true;ws.serializeAttachment(state);
   this.send(ws,{type:'identity',id:state.id,name:state.name});
   this.broadcast({type:'join',...state},ws);this.count();
  }else if(!state.ready){return;
  }else if(data.type==='move'){
   const now=Date.now();if(now-(this.lastMove.get(ws)||0)<100)return;this.lastMove.set(ws,now);
   state.x=finite(data.x,-200,200);state.y=finite(data.y,-10,40);state.z=finite(data.z,-200,200);state.r=finite(data.r,-7,7);
   ws.serializeAttachment(state);this.broadcast({type:'move',...state},ws);
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
  this.broadcast({type:'leave',id:state.id},ws);
 }this.count();}
 async webSocketError(ws){const state=ws.deserializeAttachment();if(state?.ready){
  if(state.rideId!==null)this.broadcast({type:'rideState',elephantId:state.rideId,ownerId:null},ws);
  this.broadcast({type:'leave',id:state.id},ws);
 }this.count();}
}
