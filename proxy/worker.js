// Optional Cloudflare Worker: a server-side API key, a fixed player, and a private access token.
const cache=new Map();
const pending=new Map();
function respond(body,status,origin) {
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Vary':'Origin','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
async function tokenMatches(input,expected) {
  const encoder=new TextEncoder();
  const [a,b]=await Promise.all([input,expected].map(v=>crypto.subtle.digest('SHA-256',encoder.encode(v))));
  const aa=new Uint8Array(a),bb=new Uint8Array(b);let mismatch=0;for(let i=0;i<aa.length;i++)mismatch|=aa[i]^bb[i];return mismatch===0;
}
export default {
  async fetch(request,env) {
    const origin=env.ALLOWED_ORIGIN;
    if(!origin||!env.APEX_API_KEY||!env.ACCESS_TOKEN||!/^\d+$/.test(env.PLAYER_UID??'')||!['PC','PS4','X1','SWITCH'].includes(env.PLAYER_PLATFORM))return respond({error:'Proxy configuration required'},503,origin??'null');
    if(request.headers.get('Origin')!==origin)return respond({error:'Origin not allowed'},403,origin);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET','Access-Control-Allow-Headers':'Authorization','Access-Control-Max-Age':'86400','Vary':'Origin'}});
    if(request.method!=='GET')return respond({error:'Method not allowed'},405,origin);
    if(!await tokenMatches(request.headers.get('Authorization')??'',`Bearer ${env.ACCESS_TOKEN}`))return respond({error:'Unauthorized'},401,origin);
    const path=new URL(request.url).pathname;
    if(!['/bridge','/maprotation'].includes(path))return respond({error:'Not found'},404,origin);
    const cacheKey=`${path}:${env.PLAYER_PLATFORM}:${env.PLAYER_UID}`;
    const cached=cache.get(cacheKey);
    if(cached&&cached.expires>Date.now())return respond(cached.data,200,origin);
    if(!pending.has(cacheKey)) {
      const work=(async()=>{
        const upstream=new URL(`https://api.apexlegendsstatus.com${path}`);
        upstream.searchParams.set('version',path==='/bridge'?'5':'2');
        if(path==='/bridge'){upstream.searchParams.set('uid',env.PLAYER_UID);upstream.searchParams.set('platform',env.PLAYER_PLATFORM);}
        const response=await fetch(upstream,{headers:{Authorization:env.APEX_API_KEY},signal:AbortSignal.timeout(15000)});
        const data=await response.json();
        if(!response.ok||data?.Error||data?.error)return {data:{error:'Upstream unavailable'},status:response.ok?502:response.status};
        cache.set(cacheKey,{data,expires:Date.now()+60000});return {data,status:200};
      })();pending.set(cacheKey,work);
    }
    try{const result=await pending.get(cacheKey);return respond(result.data,result.status,origin);}catch{return respond({error:'Upstream unavailable'},502,origin);}finally{pending.delete(cacheKey);}
  }
};
