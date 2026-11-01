// Pure leaderboard logic, shared by the function and its tests. The server recomputes every score from the
// submitted flight stats, so a player can't just post a big number.
export const NAME_RE=/^[A-Za-z0-9 _.\-]{2,16}$/;
const BAD=/(fuck|shit|cunt|nigg|fag|bitch|whore|slut|rape|nazi|hitler|dick|cock|puss|twat|wank|retard|kys|penis|vagina|anal|porn)/i;
const num=(v,lo,hi)=>{const n=Number(v);return Number.isFinite(n)&&n>=lo&&n<=hi?n:null};
export const BOARDS={
  school:{
    clean(x){const time=num(x.time,15,1800),fuelUsed=num(x.fuelUsed,0,100),maxAlt=num(x.maxAlt,0,20000);
      if(time===null||fuelUsed===null||maxAlt===null||maxAlt<300)return null;
      return{caught:!!x.caught,time:Math.round(time),fuelUsed:Math.round(fuelUsed),maxAlt:Math.round(maxAlt)}},
    score:x=>Math.round((x.caught?1000:600)+Math.max(0,180-x.time)*3+Math.max(0,100-x.fuelUsed)*3)
  },
  mission:{
    clean(x){const stars=num(x.stars,1,5),time=num(x.time,150,36000),fuel=num(x.fuel,0,100),off=num(x.off,0,5000),samples=num(x.samples,0,12),integ=num(x.integ,0,100),lost=num(x.lost,0,40);
      if([stars,time,fuel,off,samples,integ,lost].some(v=>v===null))return null;
      return{stars:Math.round(stars),caught:!!x.caught,time:Math.round(time),fuel:Math.round(fuel),off:Math.round(off),samples:Math.round(samples),integ:Math.round(integ),lost:Math.round(lost),rocket:String(x.rocket||'').slice(0,16)}},
    score:x=>Math.max(0,Math.round(1000*x.stars+(x.caught?1500:Math.max(0,500-x.off*10))+x.fuel*20+Math.max(0,1500-x.time)*2+x.samples*250+x.integ*5-x.lost*200))
  }
};
export function cleanName(n){n=String(n||'').trim().replace(/\s+/g,' ');return NAME_RE.test(n)&&!BAD.test(n.replace(/[\s_.\-0-9]/g,''))?n:null}
export const pub=(e,i)=>({r:i+1,n:e.n,s:e.s,d:e.d,x:e.x});
// keep one best entry per player, highest score first, earliest wins ties
export function upsert(list,entry,keep=500){
  const i=list.findIndex(e=>e.id===entry.id);let improved=true;
  if(i>=0){if(list[i].s>=entry.s){improved=false;if(list[i].n!==entry.n)list[i].n=entry.n}else list.splice(i,1,entry)}else list.push(entry);
  list.sort((a,b)=>b.s-a.s||a.t-b.t);list.length=Math.min(list.length,keep);
  const rank=list.findIndex(e=>e.id===entry.id)+1;return{list,rank,improved,best:rank?list[rank-1].s:entry.s}
}
