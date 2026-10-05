import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const allowed=new Set(['index.html','mixtape.html','old__map.html','tracker.html','tracker/style.css','tracker/app.js','tracker/model.js','tracker/assets.json']);
const mime={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',json:'application/json'};
const port=Number(process.env.PORT??5173);
createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const path=pathname==='/'?'tracker.html':pathname.slice(1);
  if(!allowed.has(path)){res.writeHead(404);res.end('Not found');return;}
  try{const body=await readFile(new URL(path,root));res.writeHead(200,{'Content-Type':mime[path.split('.').at(-1)],'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Apex tracker: http://127.0.0.1:${port}/tracker.html`));
