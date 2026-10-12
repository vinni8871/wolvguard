import { useState } from "react";
import {
  Check,
  ArrowRight,
  FileDown,
  Presentation,
  ShieldCheck,
  Play,
  ExternalLink,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { runRubricChecks } from "@/lib/rubric-checks";
const criteria = [
  [
    "Social Media Monitoring",
    "30%",
    "Live Bluesky profile search; display name / handle / description / optional avatar comparison. Verified exact DIDs are excluded.",
    "Bluesky coverage only. YouTube requires a key; Instagram, Facebook and X are not integrated.",
    "Social Monitoring",
  ],
  [
    "App Store Monitoring",
    "30%",
    "Live Apple search; name, real image fingerprint, verified-publisher differences and token-based description comparison. Exact official app IDs excluded.",
    "Bounded keyword coverage. Image hashing is a visual heuristic, not a semantic logo detector. Google Play is not integrated.",
    "App Monitoring",
  ],
  [
    "Brand Profile",
    "15%",
    "Validated brand identity, optional local logo upload, official source registration, evidence-backed manual verification and provider-isolated exclusions.",
    "Manual ownership attestation; not a cryptographic or third-party verification service.",
    "Brand Profiles",
  ],
  [
    "User Experience",
    "15%",
    "Responsive navigation, filters, source links, review history, cancellation, safe errors, exports, empty states and separate live/demo data.",
    "Browser-local data, no authenticated shared organization. Provider outages are handled rather than hidden.",
    "Settings",
  ],
  [
    "Presentation & Demo",
    "10%",
    "Six-slide deck, a three-minute walkthrough, live provider demonstration and nine reproducible detection checks.",
    "Synthetic validation fixtures are explicitly labelled and never mixed with live candidates.",
    "Overview",
  ],
];
export default function Evaluation({
  onNavigate,
  onToast,
}: {
  onNavigate: (page: string) => void;
  onToast: (t: string) => void;
}) {
  const [checks, setChecks] = useState<ReturnType<
    typeof runRubricChecks
  > | null>(null);
  return (
    <div className="evaluation">
      <div className="provider-banner">
        <ShieldCheck size={26} />
        <div>
          <b>Rubric readiness—not a promised judge score</b>
          <p>
            All five categories have an implemented prototype path. Coverage and
            deployment limits remain visible below. No claim of perfect
            detection or 100/100.
          </p>
        </div>
        <a
          className="btn primary"
          href="/judge-demo.html"
          target="_blank"
          rel="noreferrer"
        >
          <Presentation size={16} />
          Open presentation
        </a>
      </div>
      <div className="panel">
        <div className="panel-title">
          <h3>Evaluation criteria · 100 points</h3>
          <span>Based on your attached rubric</span>
        </div>
        <div className="table-scroll">
          <table className="rubric-table">
            <thead>
              <tr>
                <th>Criterion</th>
                <th>Weight</th>
                <th>Implemented evidence</th>
                <th>Boundary</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {criteria.map(([name, weight, evidence, limit, page]) => (
                <tr key={name}>
                  <td>
                    <b>{name}</b>
                  </td>
                  <td>{weight}</td>
                  <td>{evidence}</td>
                  <td>{limit}</td>
                  <td>
                    <Button
                      variant="ghost"
                      onClick={() => onNavigate(page)}
                      aria-label={`Open ${name}`}
                    >
                      Inspect <ArrowRight size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="chart-grid evaluation-actions">
        <div className="panel settings-panel">
          <h3>
            <Play size={19} />
            Three-minute judge walkthrough
          </h3>
          <ol>
            <li>Register a brand, description and optional reference logo.</li>
            <li>
              Register official Apple and Bluesky identities. Record independent
              ownership evidence.
            </li>
            <li>
              Run a live social scan and a live app scan. Point out actual
              source URLs and retrieval times.
            </li>
            <li>
              Show official exclusions and a candidate’s signal breakdown. Do
              not label a real account fraudulent without evidence.
            </li>
            <li>
              Add a review note, export evidence and show the scan history.
            </li>
            <li>
              Run the synthetic checks below to demonstrate difficult cases
              without accusing real accounts.
            </li>
          </ol>
          <a className="btn outline" href="/PRESENTER-NOTES.md" download>
            <FileDown size={15} />
            Download presenter notes
          </a>
        </div>
        <div className="panel settings-panel">
          <h3>
            <Check size={19} />
            Reproducible detection checks
          </h3>
          <p>
            Run the actual detection and image-signature code against labelled
            synthetic fixtures. These are tests, not live threat intelligence.
          </p>
          <Button
            onClick={() => {
              const result = runRubricChecks();
              setChecks(result);
              onToast(
                `${result.filter((t) => t.passed).length}/${result.length} synthetic detection checks passed.`,
              );
            }}
          >
            <Play size={15} />
            Run rubric checks
          </Button>
          {checks && (
            <div className="rubric-checks" role="status">
              {checks.map((t) => (
                <div key={t.name}>
                  <span className={`badge ${t.passed ? "green" : "amber"}`}>
                    {t.passed ? "Pass" : "Fail"}
                  </span>
                  <span>{t.name}</span>
                </div>
              ))}
            </div>
          )}
          <div className="notice">
            <Info size={17} />
            <span>
              Passing these checks demonstrates implementation behavior. It does
              not measure real-world fraud-detection precision or guarantee a
              grade.
            </span>
          </div>
        </div>
      </div>
      <div className="panel settings-panel">
        <h3>Source documentation & audit trail</h3>
        <div className="action-row">
          <a
            className="btn outline"
            href="https://endpoints.bsky.app/#bluesky-app"
            target="_blank"
            rel="noreferrer"
          >
            Bluesky API documentation <ExternalLink size={13} />
          </a>
          <a
            className="btn outline"
            href="https://performance-partners.apple.com/search-api"
            target="_blank"
            rel="noreferrer"
          >
            Apple Search API documentation <ExternalLink size={13} />
          </a>
          <a className="btn outline" href="/QA-RESULTS.json" download>
            Download test report <FileDown size={13} />
          </a>
          <a className="btn outline" href="/EVALUATION-AUDIT.md" download>
            Download rubric audit <FileDown size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}
