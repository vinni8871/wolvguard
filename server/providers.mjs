import { createSign } from "node:crypto";

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

let appleAdsToken = { value: "", expiresAt: 0 };

function appleAdsCredentials() {
  const clientId = process.env.APPLE_ADS_CLIENT_ID;
  const teamId = process.env.APPLE_ADS_TEAM_ID;
  const keyId = process.env.APPLE_ADS_KEY_ID;
  const accountId = process.env.APPLE_ADS_AD_ACCOUNT_ID;
  const privateKey = process.env.APPLE_ADS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientId || !teamId || !keyId || !accountId || !privateKey) {
    throw new ProviderError(
      "NOT_CONFIGURED",
      "Apple Ads credentials are not configured on the server.",
      503,
    );
  }
  return { clientId, teamId, keyId, accountId, privateKey };
}

async function getAppleAdsAccessToken(fetcher = fetch) {
  if (appleAdsToken.value && appleAdsToken.expiresAt > Date.now() + 30000) {
    return appleAdsToken.value;
  }
  const { clientId, teamId, keyId, privateKey } = appleAdsCredentials();
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = [
    encode({ alg: "ES256", kid: keyId }),
    encode({
      iss: teamId,
      iat: now,
      exp: now + 86400,
      aud: "https://appleid.apple.com",
      sub: clientId,
    }),
  ].join(".");
  let clientSecret;
  try {
    const signer = createSign("SHA256");
    signer.update(unsigned);
    signer.end();
    clientSecret = `${unsigned}.${signer.sign({ key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  } catch {
    throw new ProviderError("APPLE_ADS_KEY_INVALID", "Apple Ads private key is invalid.", 503);
  }

  let response;
  try {
    response = await fetcher("https://appleid.apple.com/auth/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "searchadsorg",
      }),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new ProviderError("APPLE_AUTH_UNREACHABLE", "Apple Ads authentication is unavailable.", 503);
  }
  if (!response.ok) {
    throw new ProviderError("APPLE_AUTH_FAILED", "Apple Ads rejected its server credentials.", 503);
  }
  const data = await response.json().catch(() => null);
  if (typeof data?.access_token !== "string" || typeof data?.expires_in !== "number") {
    throw new ProviderError("APPLE_AUTH_RESPONSE", "Apple Ads returned an invalid token response.", 503);
  }
  appleAdsToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return appleAdsToken.value;
}

export async function searchAppleAds(params, fetcher = fetch) {
  const { accountId } = appleAdsCredentials();
  const accessToken = await getAppleAdsAccessToken(fetcher);
  const url = new URL("https://api.ads.apple.com/v1/search/apps");
  url.search = new URLSearchParams({
    query: params.term,
    storeFronts: params.country.toUpperCase(),
    limit: String(params.limit),
    offset: "0",
  }).toString();
  let response;
  try {
    response = await fetcher(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-AP-Context": `adAccountId=${accountId}`,
      },
      signal: AbortSignal.timeout(18000),
    });
  } catch {
    throw new ProviderError("PROVIDER_UNREACHABLE", "Apple Ads could not be reached.", 503);
  }
  if (response.status === 429) {
    throw new ProviderError("RATE_LIMITED", "Apple Ads is limiting requests. Wait before retrying.", 429);
  }
  if (response.status === 401 || response.status === 403) {
    throw new ProviderError("APPLE_ADS_ACCESS", "Apple Ads credentials lack access to this ad account.", 503);
  }
  if (!response.ok) {
    throw new ProviderError("PROVIDER_ERROR", `Apple Ads returned HTTP ${response.status}.`, 502);
  }
  const data = await response.json().catch(() => null);
  if (!Array.isArray(data?.result)) {
    throw new ProviderError("INVALID_RESPONSE", "Apple Ads returned an unexpected app-search response.");
  }
  const candidates = data.result
    .filter((app) => Number.isSafeInteger(app?.adamId) && typeof app?.appName === "string")
    .slice(0, params.limit)
    .map((app) => ({
      provider: "apple",
      sourceId: String(app.adamId),
      name: app.appName.slice(0, 300),
      sourceUrl: `https://apps.apple.com/app/id${app.adamId}`,
      publisher: typeof app.developerName === "string" ? app.developerName.slice(0, 300) : "",
      description: "",
      iconUrl: "",
      metadata: {
        bundleId: null,
        version: null,
        genre: null,
        price: null,
        currency: null,
        releaseDate: null,
        region: params.country.toUpperCase(),
      },
    }));
  return {
    provider: "apple",
    dataMode: "live",
    fetchedAt: new Date().toISOString(),
    candidates,
    sourceCount: data.result.length,
    omittedCount: data.result.length - candidates.length,
    country: params.country,
    term: params.term,
  };
}

export async function searchYouTube(params, fetcher = fetch) {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) {
    throw new ProviderError("NOT_CONFIGURED", "YouTube API credentials are not configured on the server.", 503);
  }
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams({
    part: "snippet",
    type: "channel",
    q: params.term,
    regionCode: params.country.toUpperCase(),
    maxResults: String(Math.min(params.limit, 25)),
    key,
  }).toString();
  let response;
  try {
    response = await fetcher(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ProviderError("PROVIDER_UNREACHABLE", "YouTube could not be reached.", 503);
  }
  if (response.status === 429) {
    throw new ProviderError("RATE_LIMITED", "YouTube is limiting requests. Wait before retrying.", 429);
  }
  if (response.status === 403) {
    throw new ProviderError("PROVIDER_ACCESS", "YouTube API quota or permissions are unavailable.", 503);
  }
  if (!response.ok) {
    throw new ProviderError("PROVIDER_ERROR", `YouTube returned HTTP ${response.status}.`, 502);
  }
  const data = await response.json().catch(() => null);
  if (!Array.isArray(data?.items)) {
    throw new ProviderError("INVALID_RESPONSE", "YouTube returned an unexpected channel-search response.");
  }
  const candidates = data.items
    .filter((item) => item?.id?.kind === "youtube#channel" && typeof item?.id?.channelId === "string" && typeof item?.snippet?.title === "string")
    .slice(0, params.limit)
    .map((item) => ({
      provider: "youtube",
      sourceId: item.id.channelId,
      name: item.snippet.title.slice(0, 300),
      sourceUrl: `https://www.youtube.com/channel/${encodeURIComponent(item.id.channelId)}`,
      publisher: "",
      description: typeof item.snippet.description === "string" ? item.snippet.description.slice(0, 12000) : "",
      iconUrl: item.snippet.thumbnails?.default?.url || "",
      metadata: {
        bundleId: null,
        version: null,
        genre: "YouTube channel",
        price: null,
        currency: null,
        releaseDate: item.snippet.publishedAt || null,
        region: params.country.toUpperCase(),
      },
    }));
  return {
    provider: "youtube",
    dataMode: "live",
    fetchedAt: new Date().toISOString(),
    candidates,
    sourceCount: Array.isArray(data.items) ? data.items.length : 0,
    omittedCount: data.items.length - candidates.length,
    country: params.country,
    term: params.term,
  };
}
export const providerRegistry = {
  apple: {
    name: "Apple App Store",
    search: searchAppleAds,
    requiresCredentials: true,
  },
  youtube: {
    name: "YouTube",
    search: searchYouTube,
    requiresCredentials: true,
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
