import { DurableObject } from 'cloudflare:workers';

const cleanName = v => String(v||'방문자').replace(/[<>\\]/g,'').trim().slice(0,12)||'방문자';
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):0;
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
 constructor(ctx,env){super(ctx,env);this.lastChat=new WeakMap();this.lastMove=new WeakMap();}
 peers(){return this.ctx.getWebSockets().map(ws=>({ws,state:ws.deserializeAttachment()})).filter(p=>p.state);}
 send(ws,data){try{ws.send(JSON.stringify(data))}catch{}}
 broadcast(data,except){const str=JSON.stringify(data);for(const ws of this.ctx.getWebSockets()){if(ws!==except){try{ws.send(str)}catch{}}}}
 count(){this.broadcast({type:'count',count:this.ctx.getWebSockets().length})}
 async fetch(request){
  const pair=new WebSocketPair();const [client,server]=Object.values(pair);
  this.ctx.acceptWebSocket(server);
  const id=crypto.randomUUID();const state={id,name:'방문자',x:1,y:0,z:28,r:0};server.serializeAttachment(state);
  const peers=this.peers().filter(p=>p.ws!==server).map(p=>p.state);
  this.send(server,{type:'welcome',id,peers});this.broadcast({type:'join',...state},server);this.count();
  return new Response(null,{status:101,webSocket:client});
 }
 async webSocketMessage(ws,raw){
  if(typeof raw!=='string'||raw.length>1200)return;
  let data;try{data=JSON.parse(raw)}catch{return}
  const state=ws.deserializeAttachment();if(!state)return;
  if(data.type==='hello'){
   state.name=cleanName(data.name);ws.serializeAttachment(state);this.broadcast({type:'join',...state},ws);
  }else if(data.type==='move'){
   const now=Date.now();if(now-(this.lastMove.get(ws)||0)<100)return;this.lastMove.set(ws,now);
   state.x=finite(data.x,-200,200);state.y=finite(data.y,-10,40);state.z=finite(data.z,-200,200);state.r=finite(data.r,-7,7);
   ws.serializeAttachment(state);this.broadcast({type:'move',...state},ws);
  }else if(data.type==='chat'){
   const now=Date.now();if(now-(this.lastChat.get(ws)||0)<750)return;this.lastChat.set(ws,now);
   const text=String(data.text||'').trim().slice(0,250);if(text)this.broadcast({type:'chat',id:state.id,name:state.name,text},ws);
  }
 }
 async webSocketClose(ws){const state=ws.deserializeAttachment();if(state)this.broadcast({type:'leave',id:state.id},ws);this.count();}
 async webSocketError(ws){const state=ws.deserializeAttachment();if(state)this.broadcast({type:'leave',id:state.id},ws);this.count();}
}
