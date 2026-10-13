import sharp from 'sharp';import{ProviderError}from'./providers.mjs';
const cache=new Map();let running=0;
export function allowedImage(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(u.hostname==='cdn.bsky.app'||u.hostname==='yt3.ggpht.com'||u.hostname==='i.ytimg.com'||/^is\d+-ssl\.mzstatic\.com$/.test(u.hostname))}catch{return false}}
export async function imageFingerprint(url){
 if(typeof url!=='string'||url.length>2000||!allowedImage(url))throw new ProviderError('IMAGE_SOURCE_NOT_ALLOWED','Only image URLs returned by Apple, YouTube, or Bluesky are accepted.',400);
 const stored=cache.get(url);if(stored&&Date.now()-stored.at<3600000)return {...stored.value,cacheHit:true};
 if(running>=4)throw new ProviderError('IMAGE_BUSY','Image comparison is temporarily busy.',429);
 running++;try{
 let r;try{r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(8000)})}catch{throw new ProviderError('IMAGE_UNAVAILABLE','Source image could not be fetched.',502)}
 if(!r.ok||!/^image\/(png|jpeg|webp)/i.test(r.headers.get('content-type')||''))throw new ProviderError('IMAGE_UNAVAILABLE','Provider image is unavailable or unsupported.',502);
 if(Number(r.headers.get('content-length')||0)>2*1024*1024)throw new ProviderError('IMAGE_TOO_LARGE','Provider image exceeds 2 MB.',413);
 const reader=r.body.getReader();const chunks=[];let size=0;while(true){const{value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2*1024*1024){await reader.cancel();throw new ProviderError('IMAGE_TOO_LARGE','Provider image exceeds 2 MB.',413)}chunks.push(value)}
 let raw;try{raw=await sharp(Buffer.concat(chunks),{limitInputPixels:20_000_000}).rotate().flatten({background:'#ffffff'}).toColourspace('srgb').resize(9,8,{fit:'fill'}).removeAlpha().raw().toBuffer()}catch{throw new ProviderError('IMAGE_DECODE_ERROR','Source image cannot be compared.',422)}
 const mean=[0,0,0];let hash='';const grey=i=>.299*raw[i]+.587*raw[i+1]+.114*raw[i+2];for(let y=0;y<8;y++)for(let x=0;x<9;x++){const i=(y*9+x)*3;for(let c=0;c<3;c++)mean[c]+=raw[i+c]/72;if(x<8)hash+=grey(i)>grey(i+3)?'1':'0'}
 const value={signature:{hash,mean:mean.map(n=>Math.round(n)),method:'dhash64-rgb-v1'},fetchedAt:new Date().toISOString()};if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(url,{value,at:Date.now()});return {...value,cacheHit:false};
 }finally{running--}
}
