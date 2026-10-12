import{scoreCandidate}from'./live-detection';import{fingerprint,imageSimilarity}from'./image-signature';import type{LiveBrand,ProviderCandidate}from'../components/live/types';
/** Synthetic validation only. These fixtures are never inserted into either workspace. */
export function runRubricChecks(){
 const signature=fingerprint(Uint8ClampedArray.from({length:288},(_,i)=>i%4===3?255:Math.floor(i/4)%9*25));
 const brand:LiveBrand={id:'fixture',name:'Acme',description:'Secure payments for connected businesses',website:'https://acme.example',archived:false,createdAt:'2026-10-13T00:00:00Z',logo:{signature,preview:''},assets:[{id:'app',provider:'apple',name:'Acme',sourceId:'123',url:'https://apps.apple.com/us/app/id123',publisher:'Acme Inc',verifiedAt:'2026-10-13',evidence:'Synthetic validation fixture'},{id:'social',provider:'bluesky',name:'Acme',sourceId:'did:plc:officialfixture',url:'https://bsky.app/profile/did:plc:officialfixture',publisher:'acme.example',verifiedAt:'2026-10-13',evidence:'Synthetic validation fixture'}]};
 const c:ProviderCandidate={provider:'apple',sourceId:'999',name:'Acme Support',sourceUrl:'https://apps.apple.com/us/app/id999',publisher:'Unknown Studio',description:brand.description,iconUrl:'',imageSignature:signature,metadata:{region:'US',bundleId:null,version:null,genre:null,price:null,currency:null,releaseDate:null}};
 const tests:[string,()=>boolean][]=[
 ['Verified official app is excluded',()=>{const r=scoreCandidate(brand,{...c,sourceId:'123'},[30,60,85]);return r.official&&!r.potential}],
 ['Verified official social DID is excluded',()=>{const r=scoreCandidate(brand,{...c,provider:'bluesky',sourceId:'did:plc:officialfixture'},[30,60,85]);return r.official&&!r.potential}],
 ['An unverified matching ID is not silently excluded',()=>!scoreCandidate({...brand,assets:brand.assets.map(a=>({...a,verifiedAt:null}))},{...c,sourceId:'123'},[30,60,85]).official],
 ['Copied name, logo, description and publisher difference surface a lead',()=>{const r=scoreCandidate(brand,c,[30,60,85]);return r.potential&&r.score>=60}],
 ['Similar name alone never creates High risk',()=>scoreCandidate({...brand,logo:undefined,description:'',assets:[]},{...c,imageSignature:undefined},[30,60,85]).score<60],
 ['Image similarity is calculated from actual normalized pixels',()=>imageSimilarity(signature,fingerprint(Uint8ClampedArray.from({length:288},(_,i)=>i%4===3?255:Math.floor(i/4)%9*25)))===1],
 ['Missing image is unavailable, not a fabricated match',()=>scoreCandidate(brand,{...c,imageSignature:undefined},[30,60,85]).signals[3].value===null],
 ['Lookalike Unicode characters are recognized',()=>scoreCandidate({...brand,logo:undefined,description:'',assets:[]},{...c,name:'Аcme'.replace('А','а'),imageSignature:undefined},[30,60,85]).signals[0].value!>.9],
 ['Official identifiers are isolated by provider',()=>!scoreCandidate(brand,{...c,provider:'bluesky',sourceId:'123'},[30,60,85]).official],
 ];return tests.map(([name,run])=>{try{return {name,passed:run(),mode:'Synthetic fixture'}}catch{return {name,passed:false,mode:'Synthetic fixture'}}})
}
