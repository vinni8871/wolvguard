import { Globe, Apple, Database, ShieldCheck } from "lucide-react";
export function LogoCloud() {
  return (
    <div className="logo-cloud">
      <span>
        BUILT FOR THE PLATFORMS
        <br />
        <b>WHERE YOUR BRAND LIVES.</b>
      </span>
      <div>
        <Globe />
        Bluesky <small>Live social search</small>
      </div>
      <div>
        <Apple />
        App Store <small>Live app search</small>
      </div>
      <div>
        <Database />
        Node.js <small>Live API backend</small>
      </div>
      <div>
        <ShieldCheck />
        Privacy first <small>Local by design</small>
      </div>
    </div>
  );
}
