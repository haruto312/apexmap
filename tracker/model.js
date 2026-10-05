export const JAPANESE = {Wraith:'レイス',Bloodhound:'ブラッドハウンド',Pathfinder:'パスファインダー',Octane:'オクタン',Horizon:'ホライゾン',Lifeline:'ライフライン',Wattson:'ワットソン',Bangalore:'バンガロール',Gibraltar:'ジブラルタル',Caustic:'コースティック',Mirage:'ミラージュ',Crypto:'クリプト',Revenant:'レヴナント',Loba:'ローバ',Rampart:'ランパート',Fuse:'ヒューズ',Valkyrie:'ヴァルキリー',Seer:'シア',Ash:'アッシュ',MadMaggie:'マッドマギー',Newcastle:'ニューキャッスル',Vantage:'ヴァンテージ',Catalyst:'カタリスト',Ballistic:'バリスティック',Conduit:'コンジット',Alter:'オルター',Sparrow:'スパロー'};
export function numeric(value) {
  const raw = value && typeof value === 'object' ? value.value : value;
  if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function trackers(data) {
  if (!data || typeof data !== 'object') return [];
  return Object.entries(data).map(([key,item])=>({key: typeof item?.key === 'string' ? item.key : key,name:typeof item?.name === 'string' ? item.name : key,value:numeric(item)})).filter(x=>x.value !== null);
}
export function trackerValue(list,key) { return list.find(x=>x.key === key)?.value ?? null; }
export function safeImage(raw) {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw.replace(/^http:\/\//,'https://'));
    if (url.protocol !== 'https:' || !['drop-assets.ea.com','media.contentapi.ea.com','api.apexlegendsstatus.com','apexlegendsstatus.com'].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
export function normalizePlayer(raw) {
  if (!raw?.global || typeof raw.global.name !== 'string') throw new Error('プレイヤーデータを取得できませんでした。IDとプラットフォームを確認してください。');
  const selected = raw.legends?.selected ?? {};
  const nestedName = Object.keys(selected).find(k=>!['Legend','data','ImgAssets','gameInfo'].includes(k));
  const selectedName = typeof selected.Legend === 'string' ? selected.Legend : raw.realtime?.selectedLegend ?? nestedName ?? null;
  const all = raw.legends?.all ?? {};
  const legends = Object.entries(all).map(([name,legend])=>({name,trackers:trackers(legend.data ?? legend),icon:safeImage(legend.ImgAssets?.icon),banner:safeImage(legend.ImgAssets?.banner)}));
  const selectedData = selected.data ? selected : selected[selectedName] ?? all[selectedName] ?? {};
  let active = legends.find(x=>x.name === selectedName);
  if (selectedName && !active) { active = {name:selectedName,trackers:[],icon:null,banner:null}; legends.push(active); }
  if (active) {
    const values = trackers(selectedData.data ?? selectedData);
    if (values.length) active.trackers = values;
    active.icon = safeImage(selectedData.ImgAssets?.icon) ?? active.icon;
    active.banner = safeImage(selectedData.ImgAssets?.banner) ?? active.banner;
  }
  const totals = trackers(raw.total);
  return {name:raw.global.name,uid:String(raw.global.uid ?? ''),platform:raw.global.platform ?? 'PC',level:numeric(raw.global.level),nextLevel:numeric(raw.global.toNextLevelPercent),rank:{name:raw.global.rank?.rankName ?? 'Unranked',division:numeric(raw.global.rank?.rankDiv),score:numeric(raw.global.rank?.rankScore),image:safeImage(raw.global.rank?.rankImg)},online:raw.realtime?.isOnline === 1,inGame:raw.realtime?.isInGame === 1,selectedName,legends,totals};
}
export const format = (value,decimal=false) => value === null || value === undefined ? '—' : new Intl.NumberFormat('ja-JP',decimal ? {minimumFractionDigits:2,maximumFractionDigits:2}:{}).format(value);
export function rankTitle(rank) { return `${rank.name.toUpperCase()}${rank.division >= 1 && rank.division <= 4 ? ' '+['','I','II','III','IV'][rank.division] : ''}`; }
export function profileKey(player) { return `${player.platform}:${player.uid || player.name}`; }
export function makeSnapshot(player,at=Date.now()) { return {at,profile:profileKey(player),name:player.name,rp:player.rank.score,kills:trackerValue(player.totals,'kills'),damage:trackerValue(player.totals,'damage')}; }
export function buildRequest(config,resource,secret) {
  if (!['bridge','maprotation'].includes(resource)) throw new Error('不明なAPIです。');
  if (config.mode === 'proxy') {
    const url = new URL(config.proxy);
    if (url.protocol !== 'https:') throw new Error('プロキシにはHTTPSのURLを指定してください。');
    url.pathname = url.pathname.replace(/\/$/,'') + '/' + resource;
    url.search = ''; url.hash = '';
    return {url:url.href,options:{headers:{Authorization:`Bearer ${secret}`},referrerPolicy:'no-referrer',cache:'no-store'}};
  }
  const url = new URL(`https://api.apexlegendsstatus.com/${resource}`);
  // This API does not allow Authorization in CORS preflight, so direct mode uses its documented auth parameter.
  url.searchParams.set('auth',secret);
  url.searchParams.set('version',resource === 'bridge' ? '5' : '2');
  if (resource === 'bridge') {
    url.searchParams.set(config.useUid ? 'uid' : 'player',config.player);
    url.searchParams.set('platform',config.platform);
  }
  return {url:url.href,options:{referrerPolicy:'no-referrer',cache:'no-store'}};
}
export const DEMO = {
  global:{name:'PLAYER_01',uid:'DEMO',platform:'PC',level:428,toNextLevelPercent:62,rank:{rankName:'Diamond',rankDiv:4,rankScore:11420}},
  realtime:{selectedLegend:'Wraith',isOnline:0,isInGame:0},
  legends:{selected:{Legend:'Wraith'},all:Object.fromEntries([
    ['Wraith',{kills:3218,damage:948210,games_played:1482}],['Horizon',{kills:1840,damage:512430}],['Pathfinder',{kills:1246,damage:361240}],['Octane',{kills:984,damage:268160}],['Bloodhound',{kills:612,damage:182420}],['Bangalore',{kills:382,damage:98770}],['Lifeline',{kills:241,damage:35120}],['Wattson',{kills:119,damage:12580}],
  ].map(([name,data])=>[name,{data:Object.entries(data).map(([key,value])=>({key,value,name:{kills:'キル数',damage:'ダメージ',games_played:'ゲーム数'}[key]}))}]))},
  total:{kills:{value:8642},damage:{value:2418930},kd:{value:-1}},
};
