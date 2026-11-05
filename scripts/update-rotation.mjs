import {mkdir,writeFile,rename} from 'node:fs/promises';
import {normalizeApi} from '../rotation/model.mjs';
const key=process.env.APEX_API_KEY?.trim();
if(!key) { console.error('Set the APEX_API_KEY repository secret to enable rotation updates.'); process.exitCode=1; }
else {
  try {
    const response=await fetch('https://api.apexlegendsstatus.com/maprotation?version=2',{
      headers:{Authorization:key},signal:AbortSignal.timeout(20000)
    });
    if(!response.ok) throw Error(`Map API HTTP ${response.status}`);
    const snapshot=normalizeApi(await response.json());
    const entries=Object.values(snapshot.modes).filter(Boolean);
    if(!entries.some(pair=>pair.current.start<=Date.now() && pair.current.end>Date.now())) throw Error('API returned no current interval');
    await mkdir(new URL('../data/',import.meta.url),{recursive:true});
    const path=new URL('../data/rotation.json',import.meta.url);
    await writeFile(new URL('../data/rotation.tmp',import.meta.url),JSON.stringify(snapshot,null,2)+'\n');
    await rename(new URL('../data/rotation.tmp',import.meta.url),path);
    console.log(`Updated map rotation: ${entries.length} modes.`);
  } catch {
    // Do not print request objects, API bodies or environment variables: they can contain secrets.
    console.error('Rotation update failed. Check the API key and API availability. Previous data was retained.');
    process.exitCode=1;
  }
}
