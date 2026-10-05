import {JAPANESE,normalizePlayer,format,numeric,trackerValue,safeImage,rankTitle,profileKey,makeSnapshot,buildRequest,DEMO} from './model.js';
const $ = id=>document.getElementById(id);
const STORAGE = 'apexmap.tracker.v1';
const date = new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const state = {player:null,secret:'',config:{platform:'PC',player:'',useUid:false,mode:'direct',proxy:''},history:[],demo:true,busy:false,generation:0,lastRequest:0,maps:null,assets:{},controller:null};
try {const saved=JSON.parse(localStorage.getItem(STORAGE));if(saved?.config) Object.assign(state.config,saved.config);if(Array.isArray(saved?.history)) state.history=saved.history.filter(x=>typeof x.profile==='string'&&Number.isFinite(x.at)&&numeric(x.rp)!==null).slice(-5000);} catch { /* Unavailable storage must not block use. */ }
function save() {try{localStorage.setItem(STORAGE,JSON.stringify({config:state.config,history:state.history}));}catch{notify('端末への保存ができません。接続は利用できますが、再読み込みで記録が失われます。','error');}}
function notify(message,type='') {$('notice').textContent=message;$('notice').className=`notice ${type}`;}
function element(tag,className,text) {const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function imageAsset(name,type='tile') {return safeImage(state.assets[name?.toLowerCase()]?.[type]);}
function setImage(node,url) {node.hidden=!url;node.removeAttribute('src');if(url){node.src=url;node.onerror=()=>{node.hidden=true;};}}
function demoHistory() {return [9720,9900,9860,10120,10080,10280,10640,10530,10880,11010,10930,11420].map((rp,i)=>({rp,at:Date.now()-(11-i)*86400000}));}
function currentHistory() {return state.demo ? demoHistory() : state.history.filter(x=>x.profile===profileKey(state.player));}
function renderChart() {
  const history=currentHistory(); const displayed=history.slice(-30);
  $('historyCount').textContent=state.demo?'DEMO SNAPSHOTS':`${history.length} SNAPSHOTS`;
  $('chartScore').replaceChildren(document.createTextNode(`${format(state.player.rank.score)} `),element('small','', 'RP'));
  $('chartLabel').textContent=state.demo?'サンプル推移':displayed.length < 2?'記録を収集中':'直近30回の取得記録';
  $('chartStart').textContent=displayed.length?date.format(displayed[0].at):'—';$('chartEnd').textContent=displayed.length?date.format(displayed.at(-1).at):'—';
  if(displayed.length<2){$('rankChart').textContent='更新するたびに、この端末にRPを記録します。';$('rankChart').setAttribute('aria-label','ランク推移の記録がまだありません');return;}
  const values=displayed.map(x=>x.rp),min=Math.min(...values),range=Math.max(100,Math.max(...values)-min);
  const points=values.map((v,i)=>[i/(values.length-1)*600,112-(v-min)/range*92]);
  const line=points.map(p=>p.join(',')).join(' ');
  const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 600 135');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
  const defs=document.createElementNS(ns,'defs'),gradient=document.createElementNS(ns,'linearGradient');gradient.id='chartFill';gradient.setAttribute('x2','0');gradient.setAttribute('y2','1');
  for(const [offset,opacity] of [['0%','.25'],['100%','0']]){const stop=document.createElementNS(ns,'stop');stop.setAttribute('offset',offset);stop.setAttribute('stop-color','#ed3c43');stop.setAttribute('stop-opacity',opacity);gradient.append(stop);}defs.append(gradient);svg.append(defs);
  for(const y of [20,66,112]){const grid=document.createElementNS(ns,'path');grid.setAttribute('d',`M0 ${y}H600`);grid.setAttribute('stroke','#ffffff10');grid.setAttribute('stroke-dasharray','3 5');svg.append(grid);}
  const fill=document.createElementNS(ns,'polygon');fill.setAttribute('points',`0,135 ${line} 600,135`);fill.setAttribute('fill','url(#chartFill)');svg.append(fill);
  const polyline=document.createElementNS(ns,'polyline');polyline.setAttribute('points',line);polyline.setAttribute('fill','none');polyline.setAttribute('stroke','#ed3c43');polyline.setAttribute('stroke-width','2');svg.append(polyline);
  const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx','600');dot.setAttribute('cy',String(points.at(-1)[1]));dot.setAttribute('r','4');dot.setAttribute('fill','#ed3c43');svg.append(dot);
  $('rankChart').replaceChildren(svg);$('rankChart').setAttribute('aria-label',`ランクポイントの推移、${format(values[0])}から${format(values.at(-1))} RP、${displayed.length}回の記録`);
}
function renderSelected(name=state.player.selectedName) {
  const legend=state.player.legends.find(x=>x.name===name);
  $('selectedTitle').textContent=name===state.player.selectedName?'選択中のレジェンド':'レジェンドのトラッカー';
  $('selectedName').textContent=name?.toUpperCase()??'UNKNOWN';$('selectedJapanese').textContent=JAPANESE[name]??name??'未取得';
  setImage($('selectedIcon'),imageAsset(name)??legend?.icon);
  const list=(legend?.trackers??[]).slice(0,6).map(t=>{const row=element('div','tracker-row');row.append(element('span','',({kills:'キル数',damage:'ダメージ',games_played:'ゲーム数',wins:'勝利数'}[t.key]??t.name)),element('b','',format(t.value)));return row;});
  $('selectedTrackers').replaceChildren(...(list.length?list:[element('p','field-help','このレジェンドのトラッカーは未取得です。ゲーム内のバナーで表示すると取得できる場合があります。')]));
  $('selectedTitle').parentElement.parentElement.querySelector('.micro').textContent=name===state.player.selectedName?'ACTIVE':'DETAIL';
}
function renderLegends() {
  const legends=[...state.player.legends].sort($('legendSort').value==='kills'?(a,b)=>(trackerValue(b.trackers,'kills')??-1)-(trackerValue(a.trackers,'kills')??-1):(a,b)=>a.name.localeCompare(b.name));
  $('legendCount').textContent=String(legends.length).padStart(2,'0');
  $('legends').replaceChildren(...legends.map(legend=>{
    const card=element('button',`legend-card${legend.name===state.player.selectedName?' selected':''}`);card.type='button';card.setAttribute('aria-label',`${JAPANESE[legend.name]??legend.name}のトラッカーを見る`);
    const art=element('div','legend-art'),img=element('img');img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';setImage(img,imageAsset(legend.name)??legend.icon);art.append(img);
    const info=element('div','legend-info'),title=element('div');title.append(element('h3','',legend.name),element('span','',JAPANESE[legend.name]??legend.name));const kills=element('div','legend-kills');kills.append(element('b','',format(trackerValue(legend.trackers,'kills'))),element('small','','KILLS'));info.append(title,kills);card.append(art,info);
    card.addEventListener('click',()=>{renderSelected(legend.name);$('selectedTitle').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});});return card;
  }));
}
function renderPlayer() {
  const player=state.player;
  $('playerName').textContent=player.name;$('playerUid').textContent=state.demo?'YOUR PERSONAL TRACKER':`UID / ${player.uid||'未取得'}`;
  $('platformLabel').textContent=({'PC':'PC / EA ACCOUNT','PS4':'PLAYSTATION','X1':'XBOX','SWITCH':'NINTENDO SWITCH'}[player.platform]??player.platform);
  $('playerLevel').textContent=format(player.level);$('levelPercent').textContent=player.nextLevel===null?'—':`${Math.min(100,player.nextLevel)}%`;
  $('levelProgress').style.width=`${player.nextLevel===null?0:100-Math.min(100,player.nextLevel)}%`;
  $('legendLabel').textContent=`SELECTED LEGEND / ${player.selectedName?.toUpperCase()??'UNKNOWN'}`;
  setImage($('heroPortrait'),imageAsset(player.selectedName,'portrait')??player.legends.find(x=>x.name===player.selectedName)?.banner);
  $('playerStatus').classList.toggle('online',!state.demo&&player.online);$('playerStatus').replaceChildren(element('i'),document.createTextNode(state.demo?'DEMO PLAYER':player.inGame?'IN GAME':player.online?'ONLINE':'OFFLINE'));
  $('connection').textContent=state.demo?'DEMO MODE':'API CONNECTED';$('connection').classList.toggle('live',!state.demo);
  $('rankName').textContent=rankTitle(player.rank);$('rankScore').textContent=format(player.rank.score);
  setImage($('rankIcon'),player.rank.image);$('rankFallback').hidden=Boolean(player.rank.image);$('rankIcon').onerror=()=>{$('rankIcon').hidden=true;$('rankFallback').hidden=false;};
  const history=currentHistory();const previous=history.length>1?history.at(-2).rp:null;
  const delta=previous===null||player.rank.score===null?null:player.rank.score-previous;
  $('rankDelta').textContent=state.demo?'SAMPLE':delta===null?'—':`${delta>0?'+':''}${format(Math.abs(delta))}${delta<0?' ↓':''} RP`;
  $('totalKills').textContent=format(trackerValue(player.totals,'kills'));$('totalDamage').textContent=format(trackerValue(player.totals,'damage'));$('totalWins').textContent=format(trackerValue(player.totals,'wins'));$('totalKd').textContent=format(trackerValue(player.totals,'kd'),true);
  $('updatedAt').textContent=state.demo?'SAMPLE / 実際の戦績ではありません':`取得: ${date.format(Date.now())} JST`;
  $('disconnectButton').hidden=state.demo;renderChart();renderSelected();renderLegends();
}
const fallbackMaps={"World's Edge":'https://drop-assets.ea.com/images/1ANGzrckUvxyjMXBgcF33n/038523604527b713e593e09dc125d2c8/Apex_S30-Season_Worlds-Edge-16x9.jpg',Olympus:'https://drop-assets.ea.com/images/3M9j96pECUCI1nAL06ouH5/ccc3de072fcc869d6c0686d0dae96b7a/Apex_S27-Season_Olympus-16x9.jpg','Broken Moon':'https://drop-assets.ea.com/images/7A38YY4DSVUVne751E02SP/1018cbc3a7d00d862d14d18677fb7b8a/S21_-_BM_-_Quarantine_Zone_2.png'};
function renderMaps() {
  const modes=[['battle_royale','BATTLE ROYALE','カジュアル'],['ranked','RANKED LEAGUE','ランクリーグ'],['ltm','MIXTAPE','ミックステープ']];
  $('maps').replaceChildren(...modes.map(([key,label,jp],i)=>{
    const rotation=state.maps?.[key];const current=rotation?.current;const name=state.demo?Object.keys(fallbackMaps)[i]:current?.map??'未取得';
    const card=element('article','map-card');const img=element('img');img.alt='';img.loading='lazy';setImage(img,safeImage(current?.asset)??fallbackMaps[name]);
    const head=element('div','map-mode',label);const end=Number(current?.end);head.append(element('small','',state.demo?'DEMO':current&&Number.isFinite(end)?`残り ${Math.max(0,Math.ceil((end-Date.now()/1000)/60))} 分`:'—'));
    const bottom=element('div');bottom.append(element('h3','',name),element('p','',`${jp}${rotation?.next?.map?' / NEXT: '+rotation.next.map:''}`));card.append(img,head,bottom);return card;
  }));
  if(state.demo)$('mapNote').textContent='デモ用のマップ例です。現在のローテーションではありません。';
}
function resetConnection() {state.generation++;state.controller?.abort();state.controller=null;state.secret='';state.lastRequest=0;state.busy=false;$('refreshButton').disabled=false;$('connectButton').disabled=false;$('autoRefresh').checked=false;}
function showDemo() {resetConnection();state.demo=true;state.player=normalizePlayer(DEMO);state.maps=null;renderPlayer();renderMaps();notify('サンプルデータを表示しています。接続設定からEA IDとAPIキーを入力すると、自分の戦績に切り替わります。');$('settingsDialog').close();clearSecretInputs();}
function clearSecretInputs() {$('keyInput').value='';$('tokenInput').value='';}
function openSettings() {
  $('playerInput').value=state.config.player;$('platformInput').value=state.config.platform;$('uidInput').checked=state.config.useUid;$('connectionMode').value=state.config.mode;$('proxyInput').value=state.config.proxy;$('settingsError').textContent='';toggleFields();$('settingsDialog').showModal();
}
function toggleFields() {const proxy=$('connectionMode').value==='proxy';$('directFields').hidden=proxy;$('proxyFields').hidden=!proxy;$('keyInput').required=!proxy;$('proxyInput').required=proxy;$('tokenInput').required=proxy;}
const errorMessages={403:'APIキーが無効、またはAPIアクセスが許可されていません。',404:'プレイヤーが見つかりません。EA / Origin IDとプラットフォームを確認してください。',410:'プラットフォームを確認してください。',429:'APIのリクエスト上限に達しました。時間を置いて更新してください。',401:'プロキシのアクセストークンを確認してください。'};
async function request(resource,config,secret,signal) {
  const {url,options}=buildRequest(config,resource,secret);
  let response;
  try {response=await fetch(url,{...options,signal});}catch(error){if(error.name==='AbortError')throw error;throw new Error('APIに接続できません。通信状態を確認してください。直接接続が制限される場合は専用プロキシを利用できます。');}
  if(!response.ok)throw new Error(errorMessages[response.status]??'APIが応答できません。時間を置いて更新してください。');
  let data;try{data=await response.json();}catch{throw new Error('APIから有効なデータが返りませんでした。');}
  if(data?.Error||data?.error)throw new Error('APIがデータを返しませんでした。ID・キー・アクセス権を確認してください。');return data;
}
async function refresh(candidate=null,secret=state.secret) {
  if(state.busy)return;
  if(!secret){openSettings();return;}
  if(!candidate&&Date.now()-state.lastRequest<60000){notify('APIへの負荷を抑えるため、更新は1分以上の間隔を空けてください。');return;}
  const config=candidate??state.config;const generation=state.generation;state.busy=true;state.lastRequest=Date.now();$('refreshButton').disabled=true;$('connectButton').disabled=true;$('settingsError').textContent='';
  const controller=new AbortController();state.controller=controller;const timeout=setTimeout(()=>controller.abort(),20000);
  try {
    const raw=await request('bridge',config,secret,controller.signal);if(generation!==state.generation)return;
    const player=normalizePlayer(raw);state.player=player;state.demo=false;state.secret=secret;
    state.config={...config};if(player.uid&&/^\d+$/.test(player.uid)){state.config.player=player.uid;state.config.useUid=true;}save();
    if(player.rank.score!==null){state.history.push(makeSnapshot(player));state.history=state.history.slice(-5000);save();}
    renderPlayer();state.maps=null;renderMaps();$('settingsDialog').close();clearSecretInputs();notify('戦績を取得しました。APIキーはこのページのメモリ内でのみ保持しています。','success');
    try{const maps=await request('maprotation',config,secret,controller.signal);if(generation!==state.generation)return;state.maps=maps;renderMaps();$('mapNote').textContent=`マップ取得: ${date.format(Date.now())} JST · 更新時点の情報。切り替え後に再取得してください。`;}catch{if(generation!==state.generation)return;$('mapNote').textContent='戦績は取得済み。マップ情報は取得できませんでした。時間を置いて更新してください。';}
  } catch(error) {
    if(generation!==state.generation)return;
    const message=error.name==='AbortError'?'APIの応答がタイムアウトしました。時間を置いて更新してください。':error.message;
    if($('settingsDialog').open)$('settingsError').textContent=message;
    notify(`${message}${!state.demo?' 表示中の戦績は前回取得時のデータです。':''}`,'error');
  } finally {clearTimeout(timeout);if(generation===state.generation){state.busy=false;state.controller=null;$('refreshButton').disabled=false;$('connectButton').disabled=false;}}
}
$('settingsButton').addEventListener('click',openSettings);$('closeSettings').addEventListener('click',()=>{$('settingsDialog').close();clearSecretInputs();});$('settingsDialog').addEventListener('close',clearSecretInputs);
$('connectionMode').addEventListener('change',toggleFields);$('platformInput').addEventListener('change',()=>{if($('platformInput').value==='SWITCH')$('uidInput').checked=true;});
$('settingsForm').addEventListener('submit',event=>{
  event.preventDefault();const config={player:$('playerInput').value.trim(),platform:$('platformInput').value,useUid:$('uidInput').checked,mode:$('connectionMode').value,proxy:$('proxyInput').value.trim()};
  if(!config.player||config.useUid&&!/^\d+$/.test(config.player)||config.platform==='SWITCH'&&!config.useUid){$('settingsError').textContent='有効なプレイヤー名を入力してください。UIDを使う場合は数字のみで入力してください。SwitchではUIDが必要です。';return;}
  const secret=(config.mode==='proxy'?$('tokenInput'):$('keyInput')).value.trim();if(!secret){$('settingsError').textContent='APIキーまたはアクセストークンを入力してください。';return;}
  try{buildRequest(config,'bridge',secret);}catch(error){$('settingsError').textContent=error.message;return;}
  refresh(config,secret);
});
$('refreshButton').addEventListener('click',()=>refresh());$('demoButton').addEventListener('click',showDemo);$('disconnectButton').addEventListener('click',()=>{showDemo();notify('接続を解除し、APIキーをメモリから削除しました。保存済みの記録はこの端末に残ります。');});$('legendSort').addEventListener('change',renderLegends);
$('clearButton').addEventListener('click',()=>{try{localStorage.removeItem(STORAGE);}catch{}state.history=[];state.config={platform:'PC',player:'',useUid:false,mode:'direct',proxy:''};showDemo();notify('この端末のプレイヤー設定と取得記録を削除しました。');});
$('autoRefresh').addEventListener('change',()=>{if($('autoRefresh').checked&&state.demo){$('autoRefresh').checked=false;openSettings();}});
$('exportButton').addEventListener('click',()=>{
  if(state.demo){notify('デモデータは書き出しません。自分のアカウントを接続すると記録を書き出せます。');return;}
  const url=URL.createObjectURL(new Blob([JSON.stringify({exportedAt:new Date().toISOString(),player:{name:state.player.name,uid:state.player.uid,platform:state.player.platform},snapshots:currentHistory()},null,2)],{type:'application/json'}));const a=element('a');a.href=url;a.download=`apex-tracker-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
setInterval(()=>{if($('autoRefresh').checked&&!state.demo&&!document.hidden)refresh();},240000);
setInterval(()=>{$('clock').textContent=`${new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(Date.now())} JST / UTC+09`;},1000);
showDemo();
try{state.assets=await(await fetch('tracker/assets.json')).json();renderPlayer();}catch{ /* API assets and text remain usable if official image metadata is unavailable. */ }
