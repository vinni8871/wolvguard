import http from 'node:http';import{readFile,stat}from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';
import{validateSearch,providerRegistry,ProviderError,resolveBluesky}from'./providers.mjs';import{imageFingerprint}from'./images.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');const cache=new Map(),clients=new Map();const windows={apple:[],bluesky:[]};let inflight=0;
const status={apple:{status:'Available',lastSuccess:null,lastError:null},bluesky:{status:'Available',lastSuccess:null,lastError:null}};
function json(res,code,data,extra={}){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});res.end(JSON.stringify(data))}
async function body(req){const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>4096)throw new ProviderError('REQUEST_TOO_LARGE','Request exceeds 4 KiB.',413);chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString())}catch{throw new ProviderError('INVALID_JSON','Provide valid JSON.',400)}}
const server=http.createServer(async(req,res)=>{const pathname=new URL(req.url,'http://local').pathname;
 if(pathname.startsWith('/api/')){
 if(req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:{code:'CROSS_ORIGIN',message:'Use the same-origin workspace.'}});
 if(pathname==='/api/providers'&&req.method==='GET')return json(res,200,{...status,youtube:{status:'Not Configured',message:'YouTube requires an authorized server-side API key.'},auth:{status:'Not Configured'},email:{status:'Not Configured'},storage:'browser-local',imageComparison:{status:'Available',method:'dhash64-rgb-v1'}});
 const provider=pathname==='/api/apple/search'?'apple':pathname==='/api/bluesky/search'?'bluesky':null;
 const isImage=pathname==='/api/image-fingerprint',isResolve=pathname==='/api/bluesky/resolve';if(!provider&&!isImage&&!isResolve)return json(res,404,{error:{code:'NOT_FOUND',message:'Endpoint not supported.'}});
 if(req.method!=='POST')return json(res,405,{error:{code:'METHOD_NOT_ALLOWED',message:'Use POST.'}},{Allow:'POST'});if(!(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:{code:'CONTENT_TYPE',message:'Use application/json.'}});
 const now=Date.now(),peer=(req.socket.remoteAddress||'shared')+(isImage?':images':':search');const times=(clients.get(peer)||[]).filter(t=>now-t<60000);if(times.length>=(isImage?100:20))return json(res,429,{error:{code:'RATE_LIMITED',message:'Too many requests. Retry in one minute.'}},{'Retry-After':'60'});clients.set(peer,[...times,now]);
 try{const input=await body(req);if(isImage)return json(res,200,await imageFingerprint(input?.url));if(isResolve)return json(res,200,await resolveBluesky(input?.actor));
 const params=validateSearch(input),key=provider+JSON.stringify(params);const stored=cache.get(key);if(stored&&now-stored.at<300000)return json(res,200,{...stored.data,cacheHit:true,requestAt:new Date().toISOString()});
 windows[provider]=windows[provider].filter(t=>now-t<60000);if(windows[provider].length>=15||inflight>=2)throw new ProviderError('RATE_LIMITED','Provider budget is busy. Retry in one minute.',429);windows[provider].push(now);inflight++;
 let data;try{data=await providerRegistry[provider].search(params)}finally{inflight--}
 status[provider]={status:'Connected',lastSuccess:data.fetchedAt,lastError:null};if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{data,at:Date.now()});return json(res,200,{...data,cacheHit:false,requestAt:new Date().toISOString()});
 }catch(error){const e=error instanceof ProviderError?error:new ProviderError('INTERNAL_ERROR','Request could not be completed.',500);if(provider&&e.status>=500)status[provider]={...status[provider],status:'Error',lastError:e.message};return json(res,e.status,{error:{code:e.code,message:e.message}},e.status===429?{'Retry-After':'60'}:{})}
 }
 if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:{message:'Method not allowed.'}});
 try{let relative;try{relative=decodeURIComponent(pathname)}catch{return json(res,400,{error:{message:'Invalid path.'}})}let file=path.resolve(root,'.'+relative);if(!file.startsWith(root+path.sep)&&file!==root)return json(res,403,{error:{message:'Access denied.'}});try{if(!(await stat(file)).isFile())file=path.join(root,'index.html')}catch{if(path.extname(file)&&path.extname(file)!=='.html')return json(res,404,{error:{message:'File not found.'}});file=path.join(root,'index.html')}
 const data=await readFile(file),ext=path.extname(file),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.pdf':'application/pdf'}[ext]||'application/octet-stream';res.writeHead(200,{'Content-Type':mime,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':ext==='.html'?'no-cache':'public, max-age=3600'});res.end(req.method==='HEAD'?undefined:data)
 }catch{json(res,503,{error:{message:'Frontend not built. Run npm run build.'}})}
});
setInterval(()=>{const now=Date.now();for(const[k,v]of cache)if(now-v.at>300000)cache.delete(k);for(const[k,v]of clients)if(v.every(t=>now-t>60000))clients.delete(k)},60000).unref();
server.listen(Number(process.env.PORT)||5173,'0.0.0.0',()=>console.log('WOLVGUARD: Apple + Bluesky public providers, image comparison, local-browser workspace. Port '+(process.env.PORT||5173)));
