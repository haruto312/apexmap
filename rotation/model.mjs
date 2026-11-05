export const SEASON = 'SEASON 31 / CIPHER';
export const SOURCE = 'https://apexlegendsstatus.com';
const image = file => `${SOURCE}/assets/maps/${file}.png`;
export const CATALOG = {
  'Storm Point': {ja:'ストームポイント',image:image('Storm_Point')},
  'E-District': {ja:'E地区（夜）',image:image('E-District')},
  'Broken Moon': {ja:'ブロークンムーン',image:image('Broken_Moon')},
  Thunderdome: {ja:'サンダードーム',image:image('Thunderdome')},
  Fragment: {ja:'フラグメント',image:image('Worlds_Edge')},
  Skulltown: {ja:'スカルタウン',image:image('Kings_Canyon')},
  'Production Yard': {ja:'生産工場',image:image('Broken_Moon')},
  Barometer: {ja:'バロメーター',image:image('Storm_Point')},
  "Wattson's Pylon": {ja:'ワットソンのパイロン',image:image('Storm_Point')},
  Monument: {ja:'モニュメント',image:image('Worlds_Edge')}
};
export const MODE_JA = {TDM:'チームデスマッチ',Control:'コントロール','Gun Run':'ガンラン'};
export const RANKED = ['Storm Point','E-District','Broken Moon'].map(name=>({name,...CATALOG[name]}));
// Only future predictions use this season's observed cycle; current/next always use API intervals.
export const MIXTAPE = [
  ['Skulltown','TDM'],['Thunderdome','Control'],['Monument','Gun Run'],
  ['Thunderdome','TDM'],['Production Yard','Control'],['Skulltown','Gun Run'],
  ['Fragment','TDM'],['Barometer','Control'],["Wattson's Pylon",'Gun Run']
].map(([name,mode])=>({name,...CATALOG[name],mode,modeJa:MODE_JA[mode]}));
function mapName(value) {
  const name = String(value ?? '').trim();
  return ({'E-District Night':'E-District','E District':'E-District','Skull Town':'Skulltown','Wattson Pylon':"Wattson's Pylon",'Wattson Pylon (Storm Point)':"Wattson's Pylon"})[name] ?? name;
}
function modeName(value) {
  const mode = String(value ?? '').replace(/[^a-z]/gi,'').toLowerCase();
  return ({tdm:'TDM',teamdeathmatch:'TDM',control:'Control',gunrun:'Gun Run',gungame:'Gun Run'})[mode] ?? null;
}
export function safeImage(value) {
  if(typeof value !== 'string') return null;
  try {
    const url = new URL(value.replace(/^http:\/\//,'https://'));
    return url.protocol === 'https:' && ['apexlegendsstatus.com','api.apexlegendsstatus.com','drop-assets.ea.com','media.contentapi.ea.com'].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}
function epoch(value) {
  if(typeof value !== 'number' && typeof value !== 'string') return null;
  if(value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n * (n < 1e12 ? 1000 : 1) : null;
}
export function normalizeEntry(raw,kind,startFallback) {
  if(!raw || typeof raw !== 'object') return null;
  let name = mapName(raw.map ?? raw.name), mode = modeName(raw.eventName ?? raw.mode ?? raw.gameMode);
  if(!name) return null;
  const compound = name.match(/^(.*?)\s+-\s+(TDM|Control|Gun Run)$/i);
  if(compound) { name=mapName(compound[1]); mode=modeName(compound[2]); }
  const start=epoch(raw.start) ?? startFallback;
  const seconds=Number(raw.DurationInSecs ?? raw.durationInSecs);
  const duration=Number.isFinite(seconds) && seconds>0 && seconds<=86400 ? seconds*1000 : null;
  // Some v2 next blocks contain an API duration instead of absolute start/end fields.
  const end=epoch(raw.end) ?? (startFallback && duration ? start+duration : null);
  if(!Number.isFinite(start) || !end || end<=start || end-start>86400000) return null;
  if(kind==='mixtape' && !mode) return null;
  const known=CATALOG[name];
  return {name,ja:known?.ja ?? name,mode:kind==='mixtape'?mode:null,modeJa:MODE_JA[mode] ?? '',start,end,image:safeImage(raw.asset ?? raw.image) ?? known?.image ?? null};
}
export function normalizePair(raw,kind) {
  if(!raw || typeof raw!=='object') return null;
  const current=normalizeEntry(raw.current,kind);
  if(!current) return null;
  const next=normalizeEntry(raw.next,kind,current.end);
  return {current,next:next?.start===current.end ? next : null};
}
export function normalizeApi(raw,at=Date.now()) {
  if(!raw || raw.Error || raw.error) throw Error('Map rotation API returned an error');
  const modes={ranked:normalizePair(raw.ranked,'ranked'),mixtape:normalizePair(raw.mixtape ?? raw.ltm,'mixtape')};
  if(!modes.ranked && !modes.mixtape) throw Error('No supported map rotation data in API response');
  // Publish selected public rotation fields only; never persist the raw API payload or authentication.
  return {schemaVersion:1,fetchedAt:at,modes};
}
export function readSnapshot(raw,now=Date.now()) {
  if(raw?.schemaVersion!==1 || !Number.isFinite(raw.fetchedAt) || raw.fetchedAt>now+60000) throw Error('Invalid rotation snapshot');
  const modes={};
  for(const kind of ['ranked','mixtape']) modes[kind]=normalizePair(raw.modes?.[kind],kind);
  return {fetchedAt:raw.fetchedAt,modes};
}
const equal = (a,b,kind) => a.name===b.name && (kind==='ranked' || a.mode===b.mode);
export function buildRotation(pair,kind,now=Date.now()) {
  const confirmed=[pair?.current,pair?.next].filter(Boolean);
  const active=confirmed.find(entry=>entry.start<=now && now<entry.end);
  if(!active) return [];
  const pool=kind==='ranked'?RANKED:MIXTAPE;
  const index=pool.findIndex(entry=>equal(entry,active,kind));
  const duration=active.end-active.start;
  const following=confirmed.find(entry=>entry.start===active.end);
  const expectedDuration=kind==='ranked'?270*60000:15*60000;
  const canPredict=index>=0 && duration===expectedDuration && (!following || equal(pool[(index+1)%pool.length],following,kind));
  const items=[];
  const limit=now+(kind==='ranked'?7*86400000:3*3600000);
  const count=kind==='ranked'?80:13;
  for(let i=0;i<count;i++) {
    const start=active.start+i*duration;
    if(start>=limit) break;
    const exact=confirmed.find(entry=>entry.start===start);
    if(!exact && !canPredict) break;
    const entry=exact ?? {...pool[(index+i)%pool.length],start,end:start+duration};
    items.push({...entry,start:new Date(entry.start),end:new Date(entry.end),isCurrent:i===0,isConfirmed:!!exact,mapIndex:index>=0?(index+i)%pool.length:null});
  }
  return items;
}
