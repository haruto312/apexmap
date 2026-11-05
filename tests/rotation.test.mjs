import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as model from '../rotation/model.mjs';
const at=Date.parse('2026-11-05T03:30:00Z');
function fixture(){return {ranked:{current:{map:'Storm Point',start:at/1000-3600,end:at/1000+12600},next:{map:'E-District',start:at/1000+12600,end:at/1000+28800}},ltm:{current:{map:'Thunderdome',eventName:'Control',start:at/1000,end:at/1000+900},next:{map:'Monument',eventName:'Gun Run',start:at/1000+900,end:at/1000+1800}}};}
test('API seconds become absolute times; snapshot round-trip keeps Japanese names and filters fields',()=>{
 const raw=fixture();raw.secret='MUST_NOT_PUBLISH';raw.ltm.current.auth='MUST_NOT_PUBLISH';
 const data=model.normalizeApi(raw,at);assert.equal(data.modes.mixtape.current.start,at);
 assert.equal(data.modes.mixtape.current.ja,'サンダードーム');
 const serialized=JSON.stringify(data);assert.ok(!serialized.includes('MUST_NOT_PUBLISH'));
 assert.deepEqual(model.readSnapshot(JSON.parse(serialized),at),{fetchedAt:at,modes:data.modes});
});
test('current and next use actual API times at the exact boundary; later predictions are labelled',()=>{
 const data=model.normalizeApi(fixture(),at),pair=data.modes.mixtape;
 const rows=model.buildRotation(pair,'mixtape',at+1000);
 assert.equal(rows.length,13);assert.equal(rows[0].name,'Thunderdome');assert.equal(rows[1].name,'Monument');
 assert.equal(rows[0].isConfirmed,true);assert.equal(rows[1].isConfirmed,true);assert.equal(rows[2].isConfirmed,false);
 assert.equal(rows[2].mode,'TDM');assert.equal(rows[3].name,'Production Yard');
 assert.equal(model.buildRotation(pair,'mixtape',at+900000)[0].name,'Monument');
 assert.equal(model.buildRotation(pair,'mixtape',at+1800000).length,0);
});
test('mismatched or new cycles never produce invented future slots',()=>{
 const raw=fixture();raw.ltm.next.map='Skulltown';
 const pair=model.normalizeApi(raw,at).modes.mixtape;
 assert.equal(model.buildRotation(pair,'mixtape',at).length,2);
 const unknown={current:{...pair.current,name:'Future Arena',ja:'Future Arena'},next:null};
 assert.equal(model.buildRotation(unknown,'mixtape',at).length,1);
});
test('new ranked pool, seven-day predictions and next without a start field are supported',()=>{
 const raw=fixture();delete raw.ranked.next.start;
 const pair=model.normalizeApi(raw,at).modes.ranked;
 assert.equal(pair.next.start,pair.current.end);
 const rows=model.buildRotation(pair,'ranked',at);assert.ok(rows.length>=37);
 assert.deepEqual(rows.slice(0,3).map(row=>row.name),['Storm Point','E-District','Broken Moon']);
 assert.equal(rows[1].ja,'E地区（夜）');
});
test('invalid dates, API errors and unsupported images are rejected',()=>{
 assert.throws(()=>model.normalizeApi({Error:'Unauthorized'},at));
 assert.throws(()=>model.readSnapshot({schemaVersion:1,fetchedAt:null,modes:{}},at));
 assert.equal(model.normalizeEntry({map:'Storm Point',start:null,end:at},'ranked'),null);
 assert.equal(model.safeImage('https://unknown.example/map.png'),null);
 assert.equal(model.safeImage('javascript:alert(1)'),null);
});
test('v2 next duration without timestamps uses the current API end',()=>{
 const raw=fixture();raw.ltm.next={map:'Monument',eventName:'Gun Run',DurationInSecs:900};
 const pair=model.normalizeApi(raw,at).modes.mixtape;
 assert.equal(pair.next.start,at+900000);assert.equal(pair.next.end,at+1800000);
 const rows=model.buildRotation(pair,'mixtape',at);assert.equal(rows[1].isConfirmed,true);
});
for(const [file,kind] of [['index.html','ranked'],['mixtape.html','mixtape']]){
 test(`${file}: initial missing data, successful refresh, Japanese cards and API images`,async()=>{
  const html=await readFile(new URL('../'+file,import.meta.url),'utf8');
  const code=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;\s*$/m,'');
  const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));const nodes=new Map();
  function element(){return {style:{setProperty(k,v){this[k]=v},removeProperty(k){delete this[k]}},children:[],parentElement:{},append(...v){this.children.push(...v)},appendChild(v){this.children.push(v)},replaceChildren(...v){this.children=v},setAttribute(){},addEventListener(){}};}
  const document={getElementById(id){assert.ok(ids.has(id),'Missing DOM id '+id);if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)},createElement:element,createDocumentFragment:element,addEventListener(){},hidden:false};
  const now=Date.now();const input=fixture();const delta=Math.floor((now-at)/1000);for(const pair of Object.values(input))for(const entry of Object.values(pair)){entry.start+=delta;entry.end+=delta;}
  const snapshot=model.normalizeApi(input,now);
  const ctx=vm.createContext({...model,document,Date,Intl,Map,Math,String,AbortSignal,setInterval(){},fetch:async()=>({ok:true,json:async()=>snapshot})});
  vm.runInContext(code,ctx);await new Promise(resolve=>setImmediate(resolve));
  assert.notEqual(nodes.get('currentMap').textContent,'取得待ち');
  assert.ok(nodes.get('hero').style['--hero-image']);
  assert.ok(nodes.get('schedule').children.length);
  if(kind==='mixtape')assert.equal(nodes.get('currentMap').textContent,'サンダードーム');
  vm.runInContext('apiSnapshot=null;render(true);',ctx);
  assert.equal(nodes.get('currentMap').textContent,'取得待ち');
 });
}
