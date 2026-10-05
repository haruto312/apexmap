import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../proxy/worker.js';
const env={ALLOWED_ORIGIN:'https://haruto312.github.io',APEX_API_KEY:'TEST_API_KEY',ACCESS_TOKEN:'TEST_PRIVATE_TOKEN',PLAYER_UID:'123',PLAYER_PLATFORM:'PC'};
const request=(path='/bridge',headers={},method='GET')=>new Request('https://example.workers.dev'+path,{method,headers:{Origin:env.ALLOWED_ORIGIN,Authorization:'Bearer TEST_PRIVATE_TOKEN',...headers}});
test('proxy rejects foreign origins, unauthenticated requests, and arbitrary paths',async()=>{
  assert.equal((await worker.fetch(request('/bridge',{Origin:'https://evil.example'}),env)).status,403);
  assert.equal((await worker.fetch(request('/bridge',{Authorization:'Bearer wrong'}),env)).status,401);
  assert.equal((await worker.fetch(request('/evil'),env)).status,404);
  assert.equal((await worker.fetch(request('/bridge',{},'POST'),env)).status,405);
  const preflight=await worker.fetch(request('/bridge',{},'OPTIONS'),env);assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Headers'),'Authorization');
});
test('proxy fixes the player, hides its API key from URLs, and coalesces requests',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(url.searchParams.get('uid'),'123');assert.equal(url.searchParams.get('platform'),'PC');assert.equal(url.searchParams.has('auth'),false);assert.equal(options.headers.Authorization,'TEST_API_KEY');return Response.json({global:{name:'Test'}});};
  try{const responses=await Promise.all([worker.fetch(request('/bridge?uid=999'),env),worker.fetch(request('/bridge'),env)]);assert.equal(calls,1);for(const response of responses){assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal((await response.json()).global.name,'Test');}await worker.fetch(request(),env);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
