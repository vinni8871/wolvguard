import {createClient} from 'npm:@supabase/supabase-js@2';import{providers,ProviderError}from'./providers.ts';import{detect,similarity}from'./detection.ts';
const headers={'Access-Control-Allow-Origin':Deno.env.get('APP_ORIGIN')||'http://localhost:5173','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Vary':'Origin'};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
export function handler(provider:string){return async(req:Request)=>{if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return response({error:{code:'METHOD_NOT_ALLOWED',message:'Use POST.'}},405);
let scanId:string|undefined;let written=0;let findingCount=0;let admin:any;
try{
 const auth=req.headers.get('Authorization');if(!auth?.startsWith('Bearer '))return response({error:{code:'UNAUTHORIZED',message:'Sign in to start a scan.'}},401);
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const client=createClient(url,anon,{global:{headers:{Authorization:auth}}});const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return response({error:{code:'UNAUTHORIZED',message:'A valid session is required.'}},401);
 const text=await req.text();if(text.length>2048)return response({error:{code:'INVALID_REQUEST',message:'Request is too large.'}},400);let body:any;try{body=JSON.parse(text)}catch{return response({error:{code:'INVALID_REQUEST',message:'Expected a JSON request.'}},400)}
 if(typeof body.brand_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.brand_id)||body.limit!==undefined&&(!Number.isInteger(body.limit)||body.limit<1||body.limit>25))return response({error:{code:'INVALID_REQUEST',message:'Provide a registered brand UUID and a result limit between 1 and 25.'}},400);
 const {data:brand,error:brandError}=await client.from('brands').select('id,name,description').eq('id',body.brand_id).is('archived_at',null).single();if(brandError||!brand)return response({error:{code:'NOT_FOUND',message:'Registered brand not found.'}},404);
 admin=createClient(url,service,{auth:{persistSession:false}});
 const{count,error:rateError}=await admin.from('scan_runs').select('id',{count:'exact',head:true}).eq('brand_id',brand.id).eq('provider',provider).gte('started_at',new Date(Date.now()-60000).toISOString());if(rateError)throw new ProviderError('STORAGE_ERROR','Could not check scan limits.',503);if((count||0)>0)return response({error:{code:'RATE_LIMITED',message:'Wait one minute between scans of this brand and provider.'}},429);
 const{data:scan,error:scanError}=await admin.from('scan_runs').insert({brand_id:brand.id,provider,status:'Running'}).select('id').single();if(scanError){if(scanError.code==='23505')throw new ProviderError('SCAN_RUNNING','A scan is already running for this brand and provider.',409);throw new ProviderError('STORAGE_ERROR','The scan could not be created.',503)}scanId=scan.id;
 const{data:assets,error:assetError}=await client.from('official_assets').select('platform,source_id,url,publisher,verified_at').eq('brand_id',brand.id).limit(100);if(assetError)throw new ProviderError('STORAGE_ERROR','Official assets could not be loaded.',503);
 const{data:settings}=await client.from('integration_settings').select('risk_thresholds,notification_threshold').eq('owner_id',user.id).maybeSingle();
 const result=await providers[provider].search(brand.name,body.limit||10);
 for(const candidate of result){const{data:c,error:ce}=await admin.from('candidates').insert({...candidate,scan_id:scanId}).select('id').single();if(ce)throw new ProviderError('STORAGE_ERROR','Some candidates could not be stored.',503);written++;
 const verified=(assets||[]).filter((a:any)=>a.verified_at&&a.platform.toLowerCase()===(provider==='apple'?'app store':'youtube'));
 if(verified.some((a:any)=>a.source_id===candidate.source_id||a.url===candidate.source_url))continue;
 // Do not infer metadata mismatch from absent identifiers or a different display name alone.
 const publishers=verified.map((a:any)=>a.publisher).filter(Boolean);const mismatch=candidate.publisher&&publishers.length?publishers.every((p:string)=>similarity(p,candidate.publisher!)<.8):undefined;
 const result=detect(brand.name,candidate.name,brand.description&&candidate.description?[brand.description.slice(0,500),candidate.description.slice(0,500)]:undefined,mismatch,settings?.risk_thresholds||[30,60,85]);
 if(result.signals[0].value!<.3)continue;
 const{data:f,error:fe}=await admin.from('findings').insert({candidate_id:c.id,...result}).select('id').single();if(fe)throw new ProviderError('STORAGE_ERROR','A finding could not be saved.',503);findingCount++;
 if(result.score>=(settings?.notification_threshold??60)){
 // Deduplicate alerts across repeated scans for the same brand/provider/source identity.
 const{data:previous,error:pe}=await admin.from('notifications').select('id,findings!inner(candidates!inner(source_id,scan_runs!inner(brand_id,provider)))').eq('findings.candidates.source_id',candidate.source_id).eq('findings.candidates.scan_runs.brand_id',brand.id).eq('findings.candidates.scan_runs.provider',provider).limit(1);if(pe)throw new ProviderError('STORAGE_ERROR','Alert history could not be checked.',503);
 if(!previous?.length){const{error:ne}=await admin.from('notifications').insert({finding_id:f.id,channel:'in_app',delivery_status:'Preview'});if(ne)throw new ProviderError('STORAGE_ERROR','Alert could not be saved.',503)}
 }
 }
 const{error:doneError}=await admin.from('scan_runs').update({status:'Completed',completed_at:new Date().toISOString(),candidate_count:written,finding_count:findingCount}).eq('id',scanId);if(doneError)throw new ProviderError('STORAGE_ERROR','Completion could not be recorded.',503);
 return response({scan_id:scanId,status:'Completed',data_mode:'live',provider,candidate_count:written,finding_count:findingCount,email_status:'Not Configured'});
}catch(e){const err=e instanceof ProviderError?e:new ProviderError('INTERNAL_ERROR','The scan could not be completed.',500);if(scanId&&admin)await admin.from('scan_runs').update({status:written?'Partial':'Failed',completed_at:new Date().toISOString(),candidate_count:written,finding_count:findingCount,error_code:err.code,error_message:err.safeMessage}).eq('id',scanId);return response({scan_id:scanId,error:{code:err.code,message:err.safeMessage}},err.status)}
}}
