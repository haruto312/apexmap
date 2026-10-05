import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlayer,numeric,format,trackerValue,safeImage,buildRequest,DEMO,makeSnapshot,rankTitle} from '../tracker/model.js';
test('v5 selected legend and tracker arrays normalize; unavailable totals stay unavailable',()=>{
  const player=normalizePlayer(DEMO);
  assert.equal(player.selectedName,'Wraith');assert.equal(trackerValue(player.legends[0].trackers,'kills'),3218);
  assert.equal(trackerValue(player.totals,'kd'),null);assert.equal(trackerValue(player.totals,'wins'),null);
  assert.equal(rankTitle(player.rank),'DIAMOND IV');assert.equal(makeSnapshot(player,42).at,42);
});
test('legacy nested selected shape and keyed tracker objects remain compatible',()=>{
  const player=normalizePlayer({global:{name:'Test',uid:'123',platform:'PC',level:0},legends:{selected:{Lifeline:{kills:0,damage:100}},all:{Lifeline:{data:{kills:{key:'kills',value:0,name:'Kills'}}}}},total:{kills:{value:0}}});
  assert.equal(player.selectedName,'Lifeline');assert.equal(trackerValue(player.legends[0].trackers,'kills'),0);assert.equal(trackerValue(player.legends[0].trackers,'damage'),100);assert.equal(player.rank.score,null);
});
test('missing, sentinel, and invalid numbers are not fabricated as zero',()=>{
  for(const value of [null,undefined,'',-1,'invalid',true,{},Infinity])assert.equal(numeric(value),null);
  assert.equal(numeric(0),0);assert.equal(format(null),'—');assert.equal(format(0),'0');
  assert.throws(()=>normalizePlayer({Error:'player not found'}));
});
test('URLs encode player names, select v5 and use fixed upstream; proxy uses a token header',()=>{
  const direct=buildRequest({mode:'direct',platform:'PC',player:'Player & ?=あ',useUid:false},'bridge','SAMPLE_KEY');
  const url=new URL(direct.url);assert.equal(url.origin,'https://api.apexlegendsstatus.com');assert.equal(url.searchParams.get('player'),'Player & ?=あ');assert.equal(url.searchParams.get('version'),'5');
  const uid=new URL(buildRequest({mode:'direct',platform:'SWITCH',player:'123',useUid:true},'bridge','SAMPLE_KEY').url);assert.equal(uid.searchParams.get('uid'),'123');assert.equal(uid.searchParams.has('player'),false);
  const proxy=buildRequest({mode:'proxy',proxy:'https://example.workers.dev/'},'bridge','TEST_TOKEN');assert.equal(proxy.url,'https://example.workers.dev/bridge');assert.equal(proxy.options.headers.Authorization,'Bearer TEST_TOKEN');assert.equal(proxy.url.includes('TEST_TOKEN'),false);
  assert.throws(()=>buildRequest({mode:'proxy',proxy:'http://example.com'},'bridge','x'));assert.throws(()=>buildRequest({},'evil','x'));
});
test('external image URLs are restricted and upgraded to HTTPS',()=>{
  assert.equal(safeImage('javascript:alert(1)'),null);assert.equal(safeImage('https://evil.example/secret.png'),null);assert.equal(safeImage('http://api.apexlegendsstatus.com/assets/icons/wraith.png'),'https://api.apexlegendsstatus.com/assets/icons/wraith.png');
});
