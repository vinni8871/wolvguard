/** Public, permitted provider. No scraping and no API secrets. */
export class ProviderError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
export function validateSearch(body) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ProviderError(
      "INVALID_REQUEST",
      "Provide a search request.",
      400,
    );
  const term =
    typeof body.term === "string" ? body.term.normalize("NFKC").trim() : "";
  if (term.length < 2 || term.length > 100 || /[\x00-\x1f]/.test(term))
    throw new ProviderError(
      "INVALID_TERM",
      "Enter a public brand name between 2 and 100 characters.",
      400,
    );
  const country = body.country || "us";
  if (!["us", "in", "gb", "ca", "au", "de", "fr", "jp"].includes(country))
    throw new ProviderError(
      "INVALID_COUNTRY",
      "Select a supported App Store region.",
      400,
    );
  const limit = body.limit ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 25)
    throw new ProviderError(
      "INVALID_LIMIT",
      "Result limit must be an integer between 1 and 25.",
      400,
    );
  return { term, country, limit };
}
function safeAppleUrl(value, icon = false) {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return "";
    const host = u.hostname;
    return (
      icon
        ? host.endsWith(".mzstatic.com")
        : host === "apps.apple.com" || host === "itunes.apple.com"
    )
      ? u.href
      : "";
  } catch {
    return "";
  }
}
export async function searchApple(params, fetcher = fetch) {
  const url = new URL("https://itunes.apple.com/search");
  url.search = new URLSearchParams({
    term: params.term,
    country: params.country,
    entity: "software",
    limit: String(params.limit),
  }).toString();
  let response;
  try {
    response = await fetcher(url, {
      signal: AbortSignal.timeout(18000),
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ProviderError(
      "PROVIDER_UNREACHABLE",
      "Apple could not be reached. No results were created. Please retry later.",
      503,
    );
  }
  if (response.status === 429)
    throw new ProviderError(
      "RATE_LIMITED",
      "Apple is limiting requests. Wait a minute before retrying.",
      429,
    );
  if (!response.ok)
    throw new ProviderError(
      "PROVIDER_ERROR",
      `Apple returned HTTP ${response.status}. No replacement data was generated.`,
      502,
    );
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ProviderError(
      "INVALID_RESPONSE",
      "Apple returned an unreadable response.",
    );
  }
  if (!Array.isArray(data.results) || typeof data.resultCount !== "number")
    throw new ProviderError(
      "INVALID_RESPONSE",
      "Apple returned an unexpected response format.",
    );
  const seen = new Set();
  const candidates = data.results
    .slice(0, params.limit)
    .filter(
      (x) =>
        x &&
        (typeof x.trackId === "number" || typeof x.trackId === "string") &&
        typeof x.trackName === "string" &&
        safeAppleUrl(x.trackViewUrl),
    )
    .flatMap((x) => {
      const sourceId = String(x.trackId);
      if (seen.has(sourceId)) return [];
      seen.add(sourceId);
      return [
        {
          provider: "apple",
          sourceId,
          name: x.trackName.slice(0, 300),
          sourceUrl: safeAppleUrl(x.trackViewUrl),
          publisher:
            typeof (x.sellerName || x.artistName) === "string"
              ? (x.sellerName || x.artistName).slice(0, 300)
              : "",
          description:
            typeof x.description === "string"
              ? x.description.slice(0, 12000)
              : "",
          iconUrl: safeAppleUrl(x.artworkUrl100, true),
          metadata: {
            bundleId: x.bundleId || null,
            version: x.version || null,
            genre: x.primaryGenreName || null,
            price: typeof x.price === "number" ? x.price : null,
            currency: x.currency || null,
            releaseDate: x.releaseDate || null,
            region: params.country.toUpperCase(),
          },
        },
      ];
    });
  return {
    provider: "apple",
    dataMode: "live",
    fetchedAt: new Date().toISOString(),
    candidates,
    sourceCount: data.results.length,
    omittedCount: data.results.length - candidates.length,
    country: params.country,
    term: params.term,
  };
}
export const providerRegistry = {
  apple: {
    name: "Apple App Store",
    search: searchApple,
    requiresCredentials: false,
  },
};

export async function searchBluesky(params,fetcher=fetch){
 const u=new URL('https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors');u.search=new URLSearchParams({q:params.term,limit:String(params.limit)}).toString();let r;
 try{r=await fetcher(u,{signal:AbortSignal.timeout(18000),headers:{Accept:'application/json'}})}catch{throw new ProviderError('PROVIDER_UNREACHABLE','Bluesky could not be reached. No results were created.',503)}
 if(r.status===429)throw new ProviderError('RATE_LIMITED','Bluesky is limiting requests. Retry later.',429);if(!r.ok)throw new ProviderError('PROVIDER_ERROR',`Bluesky returned HTTP ${r.status}.`,502);
 let d;try{d=await r.json()}catch{throw new ProviderError('INVALID_RESPONSE','Bluesky returned unreadable data.')}
 if(!Array.isArray(d.actors))throw new ProviderError('INVALID_RESPONSE','Bluesky returned an unexpected response.');
 const seen=new Set();const candidates=d.actors.slice(0,params.limit).filter(a=>typeof a.did==='string'&&/^did:(plc|web):[a-zA-Z0-9._:%-]+$/.test(a.did)&&typeof a.handle==='string').flatMap(a=>{if(seen.has(a.did))return [];seen.add(a.did);let avatar='';try{const url=new URL(a.avatar);if(url.protocol==='https:'&&url.hostname==='cdn.bsky.app')avatar=url.href}catch{}return [{provider:'bluesky',sourceId:a.did,name:String(a.displayName||a.handle).slice(0,300),sourceUrl:'https://bsky.app/profile/'+encodeURIComponent(a.did),publisher:a.handle,description:typeof a.description==='string'?a.description.slice(0,12000):'',iconUrl:avatar,metadata:{handle:a.handle,createdAt:a.createdAt||null,bundleId:null,version:null,genre:'Social profile',price:null,currency:null,releaseDate:a.createdAt||null,region:'Global'}}]});
 return {provider:'bluesky',dataMode:'live',fetchedAt:new Date().toISOString(),candidates,sourceCount:d.actors.length,omittedCount:d.actors.length-candidates.length,country:'global',term:params.term};
}
export async function resolveBluesky(actor,fetcher=fetch){if(typeof actor!=='string'||actor.length>250||!/^([a-zA-Z0-9][a-zA-Z0-9.\-]*\.[a-zA-Z]{2,}|did:(plc|web):[a-zA-Z0-9._:%-]+)$/.test(actor))throw new ProviderError('INVALID_ACTOR','Enter a valid Bluesky handle or DID.',400);const u=new URL('https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile');u.search=new URLSearchParams({actor}).toString();let r;try{r=await fetcher(u,{signal:AbortSignal.timeout(12000)})}catch{throw new ProviderError('PROVIDER_UNREACHABLE','Could not resolve the Bluesky account.',503)}if(!r.ok)throw new ProviderError('PROFILE_NOT_FOUND','Bluesky profile could not be resolved.',404);const d=await r.json();if(!d.did||!d.handle)throw new ProviderError('INVALID_RESPONSE','Bluesky returned an invalid profile.');return {did:d.did,handle:d.handle,name:d.displayName||d.handle,url:'https://bsky.app/profile/'+encodeURIComponent(d.did)};}
providerRegistry.bluesky={name:'Bluesky',search:searchBluesky,requiresCredentials:false};
