import { Globe, Apple, Database, ShieldCheck } from "lucide-react";

const platforms = [
  { Icon: Globe, name: "Bluesky", detail: "Live social search" },
  { Icon: Apple, name: "App Store", detail: "Live app search" },
  { Icon: Database, name: "Node.js", detail: "Live API backend" },
  { Icon: ShieldCheck, name: "Privacy first", detail: "Local by design" },
];

export function LogoCloud() {
  return (
    <section className="platform-strip" aria-label="Supported platforms and capabilities">
      <p className="platform-strip-heading">
        BUILT FOR THE PLATFORMS
        <br />
        <strong>WHERE YOUR BRAND LIVES.</strong>
      </p>
      <div className="platform-marquee-window">
        <div className="platform-marquee-track">
          {[0, 1, 2].map((copy) => (
            <div className="platform-marquee-group" key={copy} role="list" aria-hidden={copy > 0 ? true : undefined}>
              {platforms.map(({ Icon, name, detail }) => (
                <div className="platform-marquee-item" key={name} role="listitem">
                  <div className="platform-marquee-title"><Icon aria-hidden="true" /><span>{name}</span></div>
                  <small>{detail}</small>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
