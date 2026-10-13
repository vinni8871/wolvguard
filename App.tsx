import { useState, useEffect, lazy, Suspense, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Shield,
  ShieldCheck,
  ScanLine,
  Globe,
  Layers,
  ChevronRight,
  ChevronDown,
  Check,
  Plus,
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  X,
  LayoutDashboard,
  Building2,
  Youtube,
  Smartphone,
  FileSearch,
  History,
  Settings,
  LogOut,
  SlidersHorizontal,
  ExternalLink,
  TriangleAlert,
  Activity,
  LockKeyhole,
  Mail,
  MessageSquare,
  Send,
  Play,
  Command,
  ChevronLeft,
  Download,
  CheckCheck,
  Radio,
  Eye,
  Database,
} from "lucide-react";
const DotGlobeHero = lazy(() =>
  import("./components/ui/globe-hero").then((m) => ({
    default: m.DotGlobeHero,
  })),
);
const LiveWorkspace = lazy(() => import("./components/live/LiveWorkspace"));
import { LogoCloud } from "./components/ui/logo-cloud-2";
import { Button } from "./components/ui/button";
import type { Brand, Finding } from "./lib/data";
import { detect } from "./lib/detection";
import {
  getAuthErrorMessage,
  hasSupabaseConfig,
  signInWithPassword,
  signUpWithPassword,
  supabase,
} from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";
function openDashboard() {
  sessionStorage.setItem("wg-live-page", "Overview");
  location.hash = "live";
}

const navs = [
  ["Overview", LayoutDashboard],
  ["Brand Profiles", Building2],
  ["Social Monitoring", Globe],
  ["App Monitoring", Smartphone],
  ["Findings & Investigations", FileSearch],
  ["Scan History", History],
  ["Notifications", Bell],
  ["Settings", Settings],
] as const;
function Mark() {
  return (
    <svg viewBox="0 0 40 42" fill="none" className="brand-mark">
      <path
        d="M5 5 14 11 20 7 26 11 35 5 32 27 20 38 8 27Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m8 12 12 10 12-10-5 17-7 6-7-6Z"
        fill="currentColor"
        fillOpacity=".18"
      />
      <path
        d="m10 17 7 5-3 3m16-8-7 5 3 3m-9 2 3 3 3-3"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
function Logo() {
  return (
    <span className="logo">
      <Mark />
      WOLV<span>GUARD</span>
      <small>BY WOLVANT</small>
    </span>
  );
}
function Badge({
  children,
  tone = "",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function useLocal<T>(_key: string, initial: T) {
  return useState<T>(initial);
}
export default function App() {
  const [route, setRoute] = useState(() => {
    const current = location.hash.slice(1) || "home";
    if (current === "app" || current === "live") return "live";
    return ["home", "login"].includes(current) ? current : "home";
  });
  const [page, setPage] = useState("Overview");
  const [brands, setBrands] = useLocal<Brand[]>("wg-demo-brands", []);
  const [findings, setFindings] = useLocal<Finding[]>("wg-demo-findings", []);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState("");
  const [editing, setEditing] = useState<Brand | null>(null);
  const [selected, setSelected] = useState<Finding | null>(null);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("All severities");
  const [dateFilter, setDateFilter] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [brandFilter, setBrandFilter] = useState("All brands");
  const [sort, setSort] = useState("Highest risk");
  const [pagination, setPagination] = useState(1);
  const [collapsed, setCollapsed] = useState(false);
  const [light, setLight] = useState(false);
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useLocal("wg-read", false);
  const [scans, setScans] = useLocal("wg-scans", [] as {
    id: string;
    brand: string;
    source: string;
    date: string;
    count: number;
    status: string;
  }[]);
  const [threshold, setThreshold] = useLocal("wg-threshold", 60);
  const [chat, setChat] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!hasSupabaseConfig);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authCooldown, setAuthCooldown] = useState(0);
  useEffect(() => {
    if (!authCooldown) return;
    const timer = window.setTimeout(
      () => setAuthCooldown((remaining) => Math.max(0, remaining - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [authCooldown]);
  useEffect(() => {
    if (!hasSupabaseConfig) return;
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session);
      setAuthReady(true);
    });
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (!error) setAuthSession(data.session);
        setAuthReady(true);
      })
      .catch(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!hasSupabaseConfig || !authReady) return;
    if (route === "live" && !authSession) location.hash = "login";
    if (route === "login" && authSession) location.hash = "live";
  }, [authReady, authSession, route]);
  async function handleAuthSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (authBusy || authCooldown > 0) return;
    const email = authEmail.trim().toLowerCase();
    const password = authPassword;
    if (!email) {
      setToast("Enter your email address.");
      return;
    }
    if (!password) {
      setToast("Enter your password.");
      return;
    }
    if (!hasSupabaseConfig) {
      setToast("Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable Supabase authentication.");
      return;
    }
    if (authMode === "signup") {
      if (password.length < 8) {
        setToast("Choose a password with at least 8 characters.");
        return;
      }
      if (password !== authConfirmPassword) {
        setToast("Passwords do not match.");
        return;
      }
    }
    try {
      setAuthBusy(true);
      if (authMode === "login") {
        const data = await signInWithPassword(email, password);
        setAuthSession(data.session);
        setToast("Signed in successfully.");
        location.hash = "live";
      } else {
        const data = await signUpWithPassword(email, password);
        setAuthSession(data.session);
        setAuthPassword("");
        setAuthConfirmPassword("");
        if (data.session) {
          setToast("Account created successfully.");
          location.hash = "live";
        } else {
          setAuthMode("login");
          setToast("Account created. Check your email if confirmation is required, then sign in.");
        }
      }
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        error.status === 429
      ) {
        setAuthCooldown(60);
      }
      setToast(getAuthErrorMessage(error, authMode));
    } finally {
      setAuthBusy(false);
    }
  }
  useEffect(() => {
    if (location.hash === "#app") location.hash = "live";
    const fn = () => {
      const next = location.hash.slice(1) || "home";
      const normalized =
        next === "app" || next === "live"
          ? "live"
          : ["home", "login"].includes(next)
            ? next
            : "home";
      setRoute(normalized);
      if (normalized !== next) location.hash = normalized;
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (!modal && !selected) return;
    const previous = document.activeElement as HTMLElement;
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,select,textarea,a[href]",
        ) || [],
      );
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal("");
        setSelected(null);
      }
      if (e.key === "Tab") {
        const list = focusable(),
          first = list[0],
          last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [modal, selected?.id]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "k" &&
        location.hash !== "#live"
      ) {
        e.preventDefault();
        go("Findings & Investigations");
        setTimeout(
          () =>
            document
              .querySelector<HTMLInputElement>(".filterbar input")
              ?.focus(),
          0,
        );
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  function go(p: string) {
    sessionStorage.setItem("wg-live-page", p);
    location.hash = "live";
  }
  function notify(t: string) {
    setToast(t);
  }
  function runScan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const brand = String(data.get("brand")),
      source = String(data.get("source"));
    setBusy(true);
    setTimeout(() => {
      const b = brands.find((b) => b.name === brand)!;
      const result = detect(b.name, b.name + " Help", undefined, true);
      const f: Finding = {
        id: crypto.randomUUID(),
        brand: b.name,
        name: b.name + " Help",
        source,
        publisher: "Synthetic demo publisher",
        description:
          "Generated sample candidate. No external API request was made.",
        ...result,
        status: "Needs Review",
        date: new Date().toISOString(),
        history: [],
      };
      setFindings((old) =>
        old.some(
          (v) =>
            v.name === f.name && v.source === f.source && v.brand === f.brand,
        )
          ? old
          : [f, ...old],
      );
      setScans((old) => [
        {
          id: crypto.randomUUID(),
          brand,
          source,
          date: new Date().toISOString(),
          count: 1,
          status: "Completed",
        },
        ...old,
      ]);
      setBusy(false);
      setRead(false);
      setModal("");
      notify("Sample scan completed. Synthetic results only.");
      go("Findings & Investigations");
    }, 1000);
  }
  function saveBrand(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const brand: Brand = {
      id: editing?.id || crypto.randomUUID(),
      name: String(d.get("name")).trim(),
      description: String(d.get("description")).trim(),
      website: String(d.get("website")),
      email: String(d.get("email")),
      logo: String(d.get("logo") || ""),
      assets: editing?.assets || [],
    };
    if (brand.name.length < 2)
      return notify("Enter a brand name with at least 2 characters.");
    setBrands((old) =>
      editing
        ? old.map((b) => (b.id === editing.id ? brand : b))
        : [...old, brand],
    );
    setModal("");
    notify("Brand saved in this browser’s demo workspace.");
  }
  function review(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const d = new FormData(e.currentTarget),
      s = String(d.get("status")),
      note = String(d.get("note"));
    if (
      s === "Confirmed Impersonation" &&
      !confirm(
        "Confirm this classification after independent evidence review? Similarity alone is not proof. This is a demo action.",
      )
    )
      return;
    const updated = {
      ...selected,
      status: s,
      history: [
        ...selected.history,
        { status: s, note, at: new Date().toISOString() },
      ],
    };
    setFindings((old) => old.map((f) => (f.id === updated.id ? updated : f)));
    setSelected(updated);
    notify("Demo review added to history.");
  }
  const filtered = findings
    .filter(
      (f) =>
        (page !== "Social Monitoring" || f.source === "YouTube") &&
        (page !== "App Monitoring" || f.source === "App Store") &&
        (brandFilter === "All brands" || f.brand === brandFilter) &&
        (!dateFilter || f.date.slice(0, 10) >= dateFilter) &&
        (severity === "All severities" || f.severity === severity) &&
        (status === "All statuses" || f.status === status) &&
        `${f.name} ${f.brand} ${f.publisher}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "Newest first"
        ? b.date.localeCompare(a.date)
        : b.score - a.score,
    );
  function table(items: Finding[], compact = false) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Candidate / identity</th>
              <th>Brand</th>
              <th>Source</th>
              <th>Risk score</th>
              <th>Review status</th>
              {!compact && <th>Detected</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((f) => (
              <tr
                key={f.id}
                onClick={() => setSelected(f)}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setSelected(f)}
              >
                <td>
                  <div className="identity">
                    <span
                      className={`avatar ${f.source === "YouTube" ? "red" : "purple"}`}
                    >
                      {f.source === "YouTube" ? (
                        <Youtube size={17} />
                      ) : (
                        <Smartphone size={17} />
                      )}
                    </span>
                    <div>
                      <b>{f.name}</b>
                      <small>
                        {f.source === "YouTube"
                          ? "@" + f.name.toLowerCase().replaceAll(" ", "")
                          : f.publisher}
                      </small>
                    </div>
                  </div>
                </td>
                <td>{f.brand}</td>
                <td>
                  <span className="source-dot" />
                  {f.source}
                </td>
                <td>
                  <span className={`risk ${f.severity.toLowerCase()}`}>
                    {f.score} <small>{f.severity}</small>
                  </span>
                </td>
                <td>
                  <Badge>{f.status}</Badge>
                </td>
                {!compact && (
                  <td>
                    {new Date(f.date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                )}
                <td>
                  <ArrowUpRight size={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <div className="empty">
            <Search />
            <h3>No findings match</h3>
            <p>Try another search or clear your filters.</p>
          </div>
        )}
      </div>
    );
  }
  function dashboard(preview = false) {
    const lastDate = new Date(
      Math.max(
        new Date("2026-10-13T00:00:00Z").getTime(),
        ...findings.map((f) => new Date(f.date).getTime()),
      ),
    );
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lastDate);
      d.setUTCDate(d.getUTCDate() - 6 + i);
      return d.toISOString().slice(0, 10);
    });
    const counts = days.map(
      (d) => findings.filter((f) => f.date.startsWith(d)).length,
    );
    const max = Math.max(3, ...counts);
    const chartPoints = counts.map((c, i) => [i * 100, 135 - (c / max) * 120]);
    const line = chartPoints
      .map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`)
      .join(" ");
    let cumulative = 0;
    const segments = ["Critical", "High", "Medium", "Low"]
      .map((v, i) => {
        const start = cumulative;
        cumulative +=
          (findings.filter((f) => f.severity === v).length /
            Math.max(1, findings.length)) *
          100;
        return `${["#ed6779", "#e99056", "#cab578", "#64bea9"][i]} ${start}% ${cumulative}%`;
      })
      .join(",");
    return (
      <>
        <div className="section-heading">
          <div>
            <div className="eyebrow">YOUR BRAND. YOUR PERIMETER.</div>
            <h2>
              Security overview<span className="heading-dot">.</span>
            </h2>
            <p>A clear view of your brand’s digital exposure.</p>
          </div>
          <div className="action-row">
            <Badge tone="demo">Demo Data</Badge>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setModal("brand");
              }}
            >
              <Plus size={15} />
              Add brand
            </Button>
            <Button onClick={() => setModal("scan")}>
              <ScanLine size={15} />
              Run scan
            </Button>
          </div>
        </div>
        <div className="metrics">
          {[
            [
              Building2,
              "Registered brands",
              brands.filter((b) => !b.archived).length,
              "Your protected identities",
            ],
            [
              Globe,
              "Social candidates",
              findings.filter((f) => f.source === "YouTube").length,
              "YouTube · sample candidates",
            ],
            [
              Smartphone,
              "App listings",
              findings.filter((f) => f.source === "App Store").length,
              "App Store · sample listings",
            ],
            [
              Shield,
              "Potential matches",
              findings.length,
              "Awaiting human verification",
            ],
            [
              TriangleAlert,
              "High-risk findings",
              findings.filter((f) => f.score >= 60).length,
              "Prioritize your review",
            ],
          ].map(([Icon, label, value, sub], i) => {
            const I = Icon as typeof Shield;
            return (
              <div className={`metric metric-${i}`} key={String(label)}>
                <div>
                  <span>{String(label)}</span>
                  <I size={16} />
                </div>
                <strong>{String(value).padStart(2, "0")}</strong>
                <small>{String(sub)}</small>
              </div>
            );
          })}
        </div>
        <div className="chart-grid">
          <div className="panel trend">
            <div className="panel-title">
              <h3>Findings over time</h3>
              <span>
                <i className="dot" />
                Potential matches
              </span>
              <Badge>Last 7 days</Badge>
            </div>
            <div className="line-chart">
              <div className="axis">
                {[max, Math.round((max * 2) / 3), Math.round(max / 3), 0].map(
                  (v, i) => (
                    <span key={i}>{v}</span>
                  ),
                )}
              </div>
              <svg viewBox="0 0 600 145" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                    <stop stopColor="#42d4c3" stopOpacity=".25" />
                    <stop offset="1" stopColor="#42d4c3" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[15, 55, 95, 135].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    x2="600"
                    y1={y}
                    y2={y}
                    stroke="#ffffff0b"
                    strokeDasharray="4 4"
                  />
                ))}
                <path d={`${line} L600 145 L0 145Z`} fill="url(#area)" />
                <path d={line} fill="none" stroke="#52d5c2" strokeWidth="2.5" />
                {chartPoints.map(([x, y]) => (
                  <circle key={x} cx={x} cy={y} r="3" fill="#59e3cf" />
                ))}
              </svg>
            </div>
            <div className="x-axis">
              {days.map((d) => (
                <span key={d}>
                  {new Date(d).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              ))}
            </div>
            <small className="chart-caption">
              Synthetic findings · grouped by scan date
            </small>
          </div>
          <div className="panel">
            <div className="panel-title">
              <h3>Risk distribution</h3>
              <Shield size={15} />
            </div>
            <div className="distribution">
              <div
                className="donut"
                style={{ background: `conic-gradient(${segments})` }}
              >
                <div>
                  <strong>{findings.length}</strong>
                  <small>FINDINGS</small>
                </div>
              </div>
              <div className="legend">
                {["Critical", "High", "Medium", "Low"].map((s, i) => (
                  <div key={s}>
                    <i
                      style={{
                        background: [
                          "#ed6779",
                          "#e99056",
                          "#cab578",
                          "#64bea9",
                        ][i],
                      }}
                    />
                    {s}
                    <b>{findings.filter((f) => f.severity === s).length}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="panel recent">
          <div className="panel-title">
            <h3>
              Recent findings <Badge>{findings.length}</Badge>
            </h3>
            <button
              className="text-button"
              onClick={() => go("Findings & Investigations")}
            >
              View all findings <ArrowRight size={13} />
            </button>
          </div>
          {table(findings.slice(0, preview ? 3 : 5), true)}
        </div>
        {!preview && (
          <div className="chart-grid bottom-grid">
            <div className="panel">
              <div className="panel-title">
                <h3>Recent scan activity</h3>
                <Badge tone="demo">Synthetic</Badge>
              </div>
              {scans.slice(0, 3).map((s) => (
                <div className="activity-row" key={s.id}>
                  <span className="avatar">
                    <ScanLine size={16} />
                  </span>
                  <div>
                    <b>
                      {s.brand} · {s.source}
                    </b>
                    <small>{new Date(s.date).toLocaleString()}</small>
                  </div>
                  <Badge tone="green">{s.status}</Badge>
                </div>
              ))}
            </div>
            <div className="panel">
              <div className="panel-title">
                <h3>Findings by source</h3>
              </div>
              {["YouTube", "App Store"].map((s) => (
                <div className="source-bar" key={s}>
                  <span>
                    {s}
                    <b>{findings.filter((f) => f.source === s).length}</b>
                  </span>
                  <div>
                    <i
                      style={{
                        width:
                          (findings.filter((f) => f.source === s).length /
                            findings.length) *
                            100 +
                          "%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }
  if (
    route === "live" &&
    hasSupabaseConfig &&
    (!authReady || !authSession)
  ) {
    return (
      <div className="workspace-loading" role="status">
        <ShieldCheck size={38} />
        <h2>{authReady ? "Redirecting to sign in" : "Checking your session"}</h2>
        <p>Verifying your Supabase account…</p>
      </div>
    );
  }
  return route === "live" ? (
    <Suspense
      fallback={
        <div className="workspace-loading" role="status">
          <ShieldCheck size={38} />
          <h2>Opening your workspace</h2>
          <p>Loading local controls and source integrations…</p>
        </div>
      }
    >
      <LiveWorkspace userId={authSession?.user.id ?? null} />
    </Suspense>
  ) : (
    <div className={light ? "site light" : "site"}>
      {route === "home" ? (
        <>
          <header className="landing-nav">
            <a href="#home">
              <Logo />
            </a>
            <nav>
              <a
                href="#features"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById("features")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Features
              </a>
              <a
                href="#how"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById("how")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                How it works
              </a>
              <a
                href="#security"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById("security")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Security
              </a>
            </nav>
            <div>
              <a href="#login" className="signin-link">
                Sign in <ArrowUpRight size={13} />
              </a>
              <Button onClick={openDashboard}>
                Get started <ArrowRight size={15} />
              </Button>
            </div>
          </header>
          <main>
            <section className="hero">
              <div className="hero-grid" />
              <div className="hero-copy">
                <div className="hero-badge">
                  <span className="pulse-dot" /> YOUR BRAND HAS A NEW LINE OF
                  DEFENSE <ChevronRight size={13} />
                </div>
                <h1>
                  Protect your brand
                  <br />
                  in the <span>digital wild.</span>
                </h1>
                <p>
                  Impersonators move fast. Stay one step ahead.
                  <br />
                  Uncover lookalike profiles and suspicious apps.
                  <br />
                  Protect the trust you’ve worked to build.
                </p>
                <div className="hero-actions">
                  <Button size="lg" onClick={openDashboard}>
                    Launch dashboard <ArrowRight size={17} />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() =>
                      document
                        .getElementById("features")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    Explore features <ChevronRight size={16} />
                  </Button>
                </div>
                <div className="hero-assurances">
                  <span>
                    <Check size={13} />
                    Explainable risk signals
                  </span>
                  <span>
                    <Check size={13} />
                    Human-led decisions
                  </span>
                  <span>
                    <Check size={13} />
                    Privacy by design
                  </span>
                </div>
              </div>
              <div className="hero-visual">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <Suspense
                  fallback={
                    <div
                      className="globe-wrap globe-loading"
                      aria-hidden="true"
                    />
                  }
                >
                  <DotGlobeHero />
                </Suspense>
                <div className="globe-coordinates">
                  37°46′49.3″N &nbsp; 122°25′09.0″W
                </div>
                <div className="floating-signal signal-one">
                  <span className="signal-icon">
                    <ShieldCheck size={19} />
                  </span>
                  <div>
                    <small>BRAND PERIMETER</small>
                    <b>Eyes on your digital world</b>
                  </div>
                  <i className="pulse-dot" />
                </div>
                <div className="floating-signal signal-two">
                  <span className="signal-icon amber">
                    <ScanLine size={18} />
                  </span>
                  <div>
                    <small>SOURCE REVIEW</small>
                    <b>
                      Human verification required
                    </b>
                    <em>Name similarity is a signal, not a verdict.</em>
                  </div>
                </div>
                <div className="globe-label">
                  <span className="dot" /> SIGNALS, NOT ASSUMPTIONS.
                </div>
              </div>
              <div className="hero-bottom">
                <span>SEE THE IMPERSONATION. STOP THE THREAT.</span>
                <span>
                  01 / INTELLIGENCE WITHOUT THE NOISE <ArrowRight size={13} />
                </span>
              </div>
            </section>
            <LogoCloud />
            <section id="features" className="features-section">
              <div className="section-intro">
                <div>
                  <div className="eyebrow">BUILT TO SEE WHAT OTHERS MISS</div>
                  <h2>
                    One brand. <span>Every angle covered.</span>
                  </h2>
                </div>
                <p>
                  From first signal to final investigation,
                  <br />
                  keep your brand one step ahead.
                </p>
              </div>
              <div className="feature-grid">
                {[
                  [
                    Globe,
                    "Social impersonation detection",
                    "Search public YouTube channels using the configured YouTube Data API key.",
                  ],
                  [
                    Smartphone,
                    "Mobile app monitoring",
                    "Search Apple App Store apps through the Apple Ads Platform API and investigate unexpected developers.",
                  ],
                  [
                    ShieldCheck,
                    "Brand identity protection",
                    "Build a source of truth for your official profiles, applications, and brand assets.",
                  ],
                  [
                    Activity,
                    "Explainable risk scoring",
                    "Understand every signal. Transparent, weighted heuristics—not a black box.",
                  ],
                  [
                    Bell,
                    "Evidence-based alerts",
                    "Focus on the signals that matter, with contextual evidence and review-ready alerts.",
                  ],
                  [
                    FileSearch,
                    "Investigate with confidence",
                    "Bring findings, comparisons, and review history into one focused workspace.",
                  ],
                ].map(([Icon, title, desc], i) => {
                  const I = Icon as typeof Shield;
                  return (
                    <article className="feature" key={String(title)}>
                      <div className="feature-top">
                        <span>
                          <I size={23} />
                        </span>
                        <small>0{i + 1}</small>
                      </div>
                      <h3>{String(title)}</h3>
                      <p>{String(desc)}</p>
                      <button
                        className="text-button"
                        onClick={() => {
                          sessionStorage.setItem(
                            "wg-live-page",
                            navs[[2, 3, 1, 0, 6, 4][i]][0],
                          );
                          location.hash = "live";
                        }}
                      >
                        Explore capability <ArrowUpRight size={13} />
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
            <section className="how-section" id="how">
              <div className="eyebrow">FROM EXPOSURE TO ACTION</div>
              <h2>
                Stay ahead. <span>In three steps.</span>
              </h2>
              <div className="steps">
                {[
                  [
                    "01",
                    "Register your brand",
                    "Add the identities and assets that make your brand yours.",
                  ],
                  [
                    "02",
                    "Detect potential matches",
                    "Search permitted sources and surface explainable risk signals.",
                  ],
                  [
                    "03",
                    "Review and respond",
                    "Validate the evidence. Document decisions. Stay in control.",
                  ],
                ].map(([n, t, d]) => (
                  <div key={n}>
                    <span>{n}</span>
                    <h3>{t}</h3>
                    <p>{d}</p>
                  </div>
                ))}
              </div>
            </section>
            <section id="security" className="security-section">
              <div className="security-emblem">
                <ShieldCheck size={70} />
              </div>
              <div>
                <div className="eyebrow">TRUST IS NOT OPTIONAL</div>
                <h2>Protection with principles.</h2>
                <p>
                  Authorized data sources. Private-by-design architecture. Human
                  verification before any conclusion. Because responsible
                  security is better security.
                </p>
                <div className="hero-assurances">
                  <span>
                    <Check size={13} />
                    Row-level isolation
                  </span>
                  <span>
                    <Check size={13} />
                    Server-side secrets
                  </span>
                  <span>
                    <Check size={13} />
                    No automated takedowns
                  </span>
                </div>
              </div>
            </section>
            <section className="contact-section">
              <div>
                <div className="eyebrow">LET’S TALK PROTECTION</div>
                <h2>
                  Your brand is worth
                  <br />
                  <span>looking out for.</span>
                </h2>
                <p>
                  Have questions about WOLVGUARD?
                  <br />
                  Prepare a message for Team WOLVANT.
                </p>
                <Button variant="outline" onClick={() => setModal("contact")}>
                  <Mail size={16} />
                  Contact the team <ArrowUpRight size={14} />
                </Button>
                <small>Support delivery is not configured in this demo.</small>
              </div>
              <div className="cta-panel">
                <Shield size={28} />
                <h3>
                  Meet your new
                  <br />
                  first line of defense.
                </h3>
                <p>Explore a safer digital world for your brand.</p>
                <Button onClick={openDashboard}>
                  Open workspace <ArrowRight size={16} />
                </Button>
                <small>No sign-up required. Synthetic data only.</small>
              </div>
            </section>
          </main>
          <footer>
            <Logo />
            <span>© 2026 Team WOLVANT. Built to protect what’s yours.</span>
            <button onClick={() => setModal("about")}>
              About the project <ArrowUpRight size={12} />
            </button>
          </footer>
        </>
      ) : route === "login" ? (
        <div className="login-layout">
          <aside>
            <Logo />
            <Suspense
              fallback={
                <div className="globe-wrap globe-loading" aria-hidden="true" />
              }
            >
              <DotGlobeHero />
            </Suspense>
            <h1>
              See the impersonation.
              <br />
              <span>Stop the threat.</span>
            </h1>
            <p>Digital risk protection, with clarity at its core.</p>
            <small>TEAM WOLVANT / WOLVGUARD</small>
          </aside>
          <div className="login-main">
            <a href="#home">
              <ChevronLeft size={15} />
              Back to home
            </a>
            <div>
              <Badge tone={hasSupabaseConfig ? "green" : "demo"}>
                {hasSupabaseConfig ? "Account access" : "Local environment"}
              </Badge>
              <h2>
                Your brand’s
                <br />
                next line of defense.
              </h2>
              <p>
                {authMode === "signup"
                  ? "Create an account to connect your private workspace."
                  : hasSupabaseConfig
                    ? "Sign in with your email and password to open your private workspace."
                    : "Company sign-in is not configured. Use the local live workspace for real public social and app searches, without creating an account."}
              </p>
              <div className="notice">
                <LockKeyhole size={20} />
                <span>
                  {hasSupabaseConfig
                    ? "Your workspace syncs to Supabase after you sign in."
                    : "No private cloud account is connected. Local live data is stored only in this browser. Do not enter sensitive company information."}
                </span>
              </div>
              {hasSupabaseConfig && (
                <form className="supabase-auth" onSubmit={handleAuthSubmit}>
                  <input
                    type="email"
                    autoComplete="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="name@company.com"
                    aria-label="Work email"
                    required
                  />
                  <input
                    type="password"
                    autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Password"
                    aria-label="Password"
                    minLength={authMode === "signup" ? 8 : undefined}
                    required
                  />
                  {authMode === "signup" && (
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={authConfirmPassword}
                      onChange={(e) => setAuthConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      aria-label="Confirm password"
                      minLength={8}
                      required
                    />
                  )}
                  <Button
                    type="submit"
                    disabled={authBusy || authCooldown > 0}
                  >
                    {authBusy
                      ? "Please wait..."
                      : authCooldown > 0
                        ? `Wait ${authCooldown}s`
                        : authMode === "signup"
                          ? "Create account"
                          : "Login"}
                    <ArrowRight size={16} />
                  </Button>
                </form>
              )}
              {hasSupabaseConfig && (
                <button
                  className="text-button auth-mode-switch"
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "signup" : "login");
                    setAuthPassword("");
                    setAuthConfirmPassword("");
                  }}
                >
                  {authMode === "login"
                    ? "Create an account"
                    : "Already have an account? Log in"}
                </button>
              )}
            </div>
            <small>
              {hasSupabaseConfig
                ? "Private workspace access requires a signed-in account."
                : "Local access is not an authenticated session."}
            </small>
          </div>
        </div>
      ) : (
        <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
          <aside className="sidebar">
            <a href="#home">
              <Logo />
            </a>
            <div className="workspace">
              <span className="workspace-avatar">W</span>
              <div>
                <b>Wolvant workspace</b>
                <small>Demo organization</small>
              </div>
              <ChevronDown size={14} />
            </div>
            <div className="nav-label">WORKSPACE</div>
            <nav>
              {navs.map(([n, I]) => (
                <button
                  key={n}
                  aria-label={n}
                  className={page === n ? "active" : ""}
                  onClick={() => go(n)}
                >
                  <I size={18} />
                  <span>{n}</span>
                  {n === "Findings & Investigations" && (
                    <b>{findings.length}</b>
                  )}
                  {n === "Notifications" && !read && <i className="dot" />}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="demo-info">
                <Shield size={22} />
                <b>Explore. Investigate. Protect.</b>
                <p>You’re in a safe, synthetic workspace.</p>
                <button onClick={() => setModal("scan")}>
                  Run a sample scan <ArrowUpRight size={13} />
                </button>
              </div>
              <button
                className="collapse-button"
                onClick={() => setCollapsed(!collapsed)}
              >
                <Menu size={17} />
                <span>Collapse sidebar</span>
              </button>
              <a href="#home">
                <LogOut size={16} />
                <span>Back to website</span>
              </a>
            </div>
          </aside>
          <div className="app-main">
            <header className="topbar">
              <div className="breadcrumbs">
                <button
                  onClick={() => setCollapsed(!collapsed)}
                  aria-label="Toggle sidebar"
                >
                  <Menu size={18} />
                </button>
                <span>Workspace</span>
                <ChevronRight size={13} />
                <b>{page}</b>
              </div>
              <div className="topbar-actions">
                <div className="search">
                  <Search size={15} />
                  <input
                    placeholder="Search findings…"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage("Findings & Investigations");
                    }}
                  />
                  <kbd>⌘ K</kbd>
                </div>
                <button
                  aria-label="Toggle theme"
                  onClick={() => setLight(!light)}
                >
                  {light ? <Moon size={18} /> : <Sun size={18} />}
                </button>
                <button
                  className="notification-button"
                  aria-label="Notifications"
                  onClick={() => go("Notifications")}
                >
                  <Bell size={18} />
                  {!read && <i />}
                </button>
                <button
                  className="user-avatar"
                  onClick={() => setModal("user")}
                >
                  WG
                </button>
              </div>
            </header>
            <div className="demo-banner">
              <span>
                <Radio size={13} />
                <b>Demo Data — Not Live Threat Intelligence</b>
                <span className="demo-extra">
                  All profiles and findings are synthetic.
                </span>
              </span>
              <button onClick={() => (location.hash = "live")}>
                Open live social & app monitoring <ArrowUpRight size={12} />
              </button>
            </div>
            <main className="app-content">
              {page === "Overview" ? (
                dashboard()
              ) : (
                <>
                  <div className="section-heading">
                    <div>
                      <div className="eyebrow">WOLVGUARD WORKSPACE</div>
                      <h2>{page}</h2>
                      <p>
                        {
                          (
                            {
                              "Brand Profiles":
                                "Your official identities. The foundation of your protection.",
                              "Social Monitoring":
                                "Discover potential lookalikes across authorized social sources.",
                              "App Monitoring":
                                "Keep an eye on apps that look a little too familiar.",
                              "Findings & Investigations":
                                "Signals deserve context. Investigate before you conclude.",
                              "Scan History":
                                "A transparent record of every detection run.",
                              Notifications:
                                "The signals that need your attention.",
                              Settings: "Make your workspace work for you.",
                            } as Record<string, string>
                          )[page]
                        }
                      </p>
                    </div>
                    {page === "Brand Profiles" ? (
                      <Button
                        onClick={() => {
                          setEditing(null);
                          setModal("brand");
                        }}
                      >
                        <Plus size={16} />
                        Add brand
                      </Button>
                    ) : [
                        "Social Monitoring",
                        "App Monitoring",
                        "Findings & Investigations",
                      ].includes(page) ? (
                      <Button onClick={() => setModal("scan")}>
                        <ScanLine size={16} />
                        Start sample scan
                      </Button>
                    ) : null}
                  </div>
                  {page === "Brand Profiles" ? (
                    <div className="brand-grid">
                      {brands
                        .filter((b) => !b.archived)
                        .map((b) => (
                          <article className="panel brand-card" key={b.id}>
                            <div className="brand-card-top">
                              <span className="large-avatar">{b.name[0]}</span>
                              <Badge tone="demo">Demo brand</Badge>
                            </div>
                            <h3>{b.name}</h3>
                            <p>{b.description}</p>
                            <a
                              href={b.website}
                              onClick={(e) => {
                                try {
                                  const h = new URL(b.website).hostname;
                                  if (
                                    h.endsWith(".example") ||
                                    h === "example.com"
                                  ) {
                                    e.preventDefault();
                                    notify(
                                      "This is a fictional demo domain, not a live official website. Use the live workspace to register actual assets.",
                                    );
                                  }
                                } catch {
                                  e.preventDefault();
                                  notify(
                                    "This sample URL is not a real source.",
                                  );
                                }
                              }}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {b.website}
                              <ExternalLink size={12} />
                            </a>
                            <div className="brand-meta">
                              <span>{b.assets.length} official assets</span>
                              <span>
                                {
                                  findings.filter((f) => f.brand === b.name)
                                    .length
                                }{" "}
                                findings
                              </span>
                            </div>
                            <div className="brand-buttons">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditing(b);
                                  setModal("assets");
                                }}
                              >
                                View assets <ArrowRight size={13} />
                              </Button>
                              <button
                                onClick={() => {
                                  setEditing(b);
                                  setModal("brand");
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Archive ${b.name}? Scan and review history will remain.`,
                                    )
                                  ) {
                                    setBrands((old) =>
                                      old.map((v) =>
                                        v.id === b.id
                                          ? { ...v, archived: true }
                                          : v,
                                      ),
                                    );
                                    notify("Brand archived in demo workspace.");
                                  }
                                }}
                              >
                                Archive
                              </button>
                            </div>
                          </article>
                        ))}
                    </div>
                  ) : [
                      "Social Monitoring",
                      "App Monitoring",
                      "Findings & Investigations",
                    ].includes(page) ? (
                    <>
                      {page !== "Findings & Investigations" && (
                        <div className="provider-banner">
                          <span className="avatar">
                            {page === "Social Monitoring" ? (
                              <Youtube />
                            ) : (
                              <Smartphone />
                            )}
                          </span>
                          <div>
                            <b>
                              {page === "Social Monitoring"
                                ? "YouTube Data API v3"
                                : "Apple App Store Search"}
                            </b>
                            <p>
                              {page === "Social Monitoring"
                                ? "YouTube only. Instagram, Facebook, and X are not integrated."
                                : "Synthetic sample listings. Switch to the live workspace for real Apple API results."}
                            </p>
                          </div>
                          <Badge tone="demo">Demo Mode</Badge>
                          <button
                            className="text-button"
                            onClick={() => go("Settings")}
                          >
                            Manage <ArrowUpRight size={13} />
                          </button>
                        </div>
                      )}
                      <div className="panel">
                        <div className="filterbar">
                          <div className="search">
                            <Search size={16} />
                            <input
                              placeholder="Search candidates…"
                              value={query}
                              onChange={(e) => {
                                setQuery(e.target.value);
                                setPagination(1);
                              }}
                            />
                          </div>
                          <select
                            value={brandFilter}
                            onChange={(e) => {
                              setBrandFilter(e.target.value);
                              setPagination(1);
                            }}
                          >
                            <option>All brands</option>
                            {brands.map((b) => (
                              <option key={b.id}>{b.name}</option>
                            ))}
                          </select>
                          <select
                            value={severity}
                            onChange={(e) => {
                              setSeverity(e.target.value);
                              setPagination(1);
                            }}
                          >
                            {[
                              "All severities",
                              "Critical",
                              "High",
                              "Medium",
                              "Low",
                            ].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                          <select
                            value={status}
                            onChange={(e) => {
                              setStatus(e.target.value);
                              setPagination(1);
                            }}
                          >
                            {[
                              "All statuses",
                              "Needs Review",
                              "Under Review",
                              "Confirmed Impersonation",
                              "Dismissed",
                            ].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                          <select
                            value={sort}
                            onChange={(e) => setSort(e.target.value)}
                          >
                            <option>Highest risk</option>
                            <option>Newest first</option>
                          </select>
                          <input
                            type="date"
                            aria-label="Findings detected on or after"
                            title="Detected on or after"
                            className="date-filter"
                            value={dateFilter}
                            onChange={(e) => {
                              setDateFilter(e.target.value);
                              setPagination(1);
                            }}
                          />
                        </div>
                        {table(
                          filtered.slice((pagination - 1) * 5, pagination * 5),
                        )}
                        <div className="table-footer">
                          <span>
                            {filtered.length} candidates · Synthetic data
                          </span>
                          <div>
                            <Button
                              variant="ghost"
                              disabled={pagination === 1}
                              onClick={() => setPagination((v) => v - 1)}
                            >
                              <ChevronLeft size={14} />
                            </Button>
                            Page {pagination} of{" "}
                            {Math.max(1, Math.ceil(filtered.length / 5))}
                            <Button
                              variant="ghost"
                              disabled={pagination * 5 >= filtered.length}
                              onClick={() => setPagination((v) => v + 1)}
                            >
                              <ChevronRight size={14} />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="subtle-note">
                        <ShieldCheck size={15} />
                        Similarity is an indicator, not proof of impersonation.
                        All new findings require human review.
                      </div>
                    </>
                  ) : page === "Scan History" ? (
                    <div className="panel">
                      <div className="filterbar">
                        <Search size={16} />
                        <input
                          placeholder="Filter scans by brand or provider…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                        <Badge tone="demo">Demo scans only</Badge>
                      </div>
                      {scans
                        .filter((s) =>
                          (s.brand + s.source)
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                        )
                        .map((s) => (
                          <button
                            className="scan-row"
                            key={s.id}
                            onClick={() => setModal("scan-detail:" + s.id)}
                          >
                            <span className="avatar">
                              <ScanLine size={19} />
                            </span>
                            <div>
                              <b>{s.brand}</b>
                              <small>
                                {s.source} · {new Date(s.date).toLocaleString()}
                              </small>
                            </div>
                            <span>
                              {s.count} candidate{s.count !== 1 ? "s" : ""}
                            </span>
                            <Badge tone="green">{s.status}</Badge>
                            <ChevronRight size={16} />
                          </button>
                        ))}
                    </div>
                  ) : page === "Notifications" ? (
                    <>
                      <div className="provider-banner">
                        <Mail size={22} />
                        <div>
                          <b>Email Not Configured</b>
                          <p>
                            Alerts are previews only. No email has been sent.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => setModal("email")}
                        >
                          Preview alert
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setRead(true);
                            notify("Notifications marked as read.");
                          }}
                        >
                          <CheckCheck size={16} />
                          Mark all read
                        </Button>
                      </div>
                      <div className="panel">
                        {findings
                          .filter((f) => f.score >= threshold)
                          .map((f) => (
                            <button
                              className="scan-row"
                              key={f.id}
                              onClick={() => setSelected(f)}
                            >
                              <span className="avatar amber">
                                <TriangleAlert size={19} />
                              </span>
                              <div>
                                <b>Potential brand match: {f.name}</b>
                                <small>
                                  {f.source} · Score {f.score} · Demo alert, not
                                  delivered
                                </small>
                              </div>
                              <Badge>{read ? "Read" : "New"}</Badge>
                              <ChevronRight size={16} />
                            </button>
                          ))}
                        {!findings.some((f) => f.score >= threshold) && (
                          <div className="empty">
                            <Bell />
                            <h3>You’re all caught up</h3>
                            <p>
                              No sample findings cross your notification
                              threshold.
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : page === "Settings" ? (
                    <div className="settings-grid">
                      <section className="panel settings-panel">
                        <h3>
                          <Building2 size={18} />
                          Workspace details
                        </h3>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const d = new FormData(e.currentTarget);
                            localStorage.setItem(
                              "wg-profile",
                              JSON.stringify(Object.fromEntries(d)),
                            );
                            notify("Demo preferences saved locally.");
                          }}
                        >
                          <label>
                            Workspace name
                            <input
                              name="organization"
                              defaultValue={
                                JSON.parse(
                                  localStorage.getItem("wg-profile") || "{}",
                                ).organization || "Wolvant workspace"
                              }
                              required
                            />
                          </label>
                          <label>
                            Display name
                            <input
                              name="displayName"
                              defaultValue={
                                JSON.parse(
                                  localStorage.getItem("wg-profile") || "{}",
                                ).displayName || ""
                              }
                              placeholder="Your name"
                              required
                            />
                          </label>
                          <p className="muted">
                            Demo preferences only. No authenticated profile is
                            connected.
                          </p>
                          <Button type="submit">Save preferences</Button>
                        </form>
                      </section>
                      <section className="panel settings-panel">
                        <h3>
                          <SlidersHorizontal size={18} />
                          Alert preferences
                        </h3>
                        <label>
                          Notification risk threshold <b>{threshold} / 100</b>
                          <input
                            type="range"
                            min="1"
                            max="100"
                            value={threshold}
                            onChange={(e) =>
                              setThreshold(Number(e.target.value))
                            }
                          />
                        </label>
                        <p>
                          In-app previews are shown for unique findings at or
                          above this score.
                        </p>
                        <label>
                          Data retention
                          <select
                            onChange={(e) => {
                              localStorage.setItem(
                                "wg-retention",
                                e.target.value,
                              );
                              notify(
                                "Preference saved. Automatic deletion requires backend scheduling.",
                              );
                            }}
                            defaultValue={
                              localStorage.getItem("wg-retention") || "30 days"
                            }
                          >
                            <option>30 days</option>
                            <option>90 days</option>
                            <option>365 days</option>
                          </select>
                        </label>
                        <small>
                          Retention is a preference, not an active deletion job.
                        </small>
                      </section>
                      <section className="panel settings-panel wide">
                        <h3>
                          <Database size={18} />
                          Integrations & security
                        </h3>
                        {[
                          [
                            "Supabase",
                            "Authentication and private persistent storage",
                          ],
                          [
                            "YouTube Data API",
                            "Server-side YOUTUBE_API_KEY required",
                          ],
                          [
                            "Apple App Store",
                            "Deploy authenticated Apple scan Edge Function",
                          ],
                          [
                            "Email delivery",
                            "Provider credentials and verified recipients required",
                          ],
                          [
                            "AI assistant",
                            "No language model provider connected",
                          ],
                        ].map(([n, d]) => (
                          <div className="integration-row" key={n}>
                            <div>
                              <b>{n}</b>
                              <small>{d}</small>
                            </div>
                            <Badge>Not Configured</Badge>
                          </div>
                        ))}
                        <div className="notice">
                          <LockKeyhole size={19} />
                          <span>
                            Live Apple monitoring is available through the local
                            Node.js server. Use the live workspace to keep real
                            results separate from these synthetic records. Cloud
                            authentication and email remain unconfigured.
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => setModal("setup")}
                        >
                          View setup guide <ArrowUpRight size={14} />
                        </Button>
                      </section>
                      <section className="panel settings-panel wide">
                        <h3>Demo workspace</h3>
                        <p>
                          Demo brands and review history are stored only in this
                          browser. This is not Supabase persistence.
                        </p>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            if (
                              confirm(
                                "Reset all sample brands, findings and reviews?",
                              )
                            ) {
                              setBrands([]);
                              setFindings([]);
                              notify("Demo brands and findings reset.");
                            }
                          }}
                        >
                          Reset demo data
                        </Button>
                      </section>
                    </div>
                  ) : null}
                </>
              )}
            </main>
            <div className="app-footer">
              <span>WOLVGUARD / TEAM WOLVANT</span>
              <span>
                <span className="dot" />
                Demo environment · No live data
              </span>
            </div>
          </div>
        </div>
      )}
      {route === "app" && (
        <button
          className="chat-launcher"
          aria-label="Open assistant"
          onClick={() => setChat(!chat)}
        >
          {chat ? <X size={22} /> : <MessageSquare size={22} />}
        </button>
      )}
      {chat && (
        <div className="chat-panel">
          <div className="panel-title">
            <h3>
              <Shield size={16} />
              WolvGuard guide
            </h3>
            <Badge>Offline guide</Badge>
          </div>
          <div className="chat-messages">
            <small>No AI provider connected · deterministic help</small>
            <p>
              How can I help? Ask about risk scores, scans, or reviewing
              findings.
            </p>
            {messages.map((m, i) => (
              <p key={i} className={i % 2 === 0 ? "user-message" : ""}>
                {m}
              </p>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = e.currentTarget;
              const v = String(new FormData(f).get("message"));
              setMessages((old) => [
                ...old,
                v,
                /score|risk/i.test(v)
                  ? "Scores combine name (35%), description (15%), and metadata (20%). Logo (30%) is excluded because it is not computed. Available weights are normalized; name-only evidence is capped at 49. These are heuristics, not fraud probabilities."
                  : /scan/i.test(v)
                    ? "This is the synthetic demo. For real Bluesky and Apple API results, switch to the local live workspace using the banner. No provider keys are required for these two sources."
                    : "Open a finding to compare signals, add a note, and change review status. Similarity is not proof. Independent evidence is needed before confirming impersonation.",
              ]);
              f.reset();
            }}
          >
            <input
              name="message"
              required
              placeholder="Ask about the workspace…"
            />
            <button aria-label="Send">
              <Send size={17} />
            </button>
          </form>
        </div>
      )}
      {toast && (
        <div role="status" className="toast">
          <Check size={18} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      )}
      {(modal || selected) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setModal("");
            setSelected(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={selected ? "Finding investigation" : modal}
            className={`modal ${selected ? "investigation" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Close dialog"
              onClick={() => {
                setModal("");
                setSelected(null);
              }}
            >
              <X size={21} />
            </button>
            {selected ? (
              <>
                <div className="eyebrow">FINDING INVESTIGATION / DEMO DATA</div>
                <h2>{selected.name}</h2>
                <p>
                  {selected.source} · {selected.brand} ·{" "}
                  {new Date(selected.date).toLocaleString()}
                </p>
                <div className="investigation-summary">
                  <span
                    className={`big-score ${selected.severity.toLowerCase()}`}
                  >
                    {selected.score}
                    <small>/ 100</small>
                  </span>
                  <div>
                    <Badge tone="amber">
                      {selected.severity} risk indicator
                    </Badge>
                    <p>Heuristic score, not a probability of fraud.</p>
                  </div>
                </div>
                <h3>Evidence & signal breakdown</h3>
                {selected.signals.map((s) => (
                  <div className="signal-row" key={s.code}>
                    <div>
                      <b>{s.label}</b>
                      <small>
                        {s.code} · base weight {s.weight}%
                      </small>
                    </div>
                    <span>
                      {s.value === null
                        ? "Not available"
                        : Math.round(s.value * 100) + "%"}
                    </span>
                  </div>
                ))}
                <div className="notice">
                  <Eye size={20} />
                  <span>
                    {selected.description} Name similarity and available
                    metadata inform this score. Logo comparison has not been
                    calculated.
                  </span>
                </div>
                <h3>Official comparison</h3>
                <p>
                  {brands.find((b) => b.name === selected.brand)?.website} ·
                  Candidate publisher: {selected.publisher}
                </p>
                <p className="muted">
                  No live source URL exists for synthetic candidates. Official
                  assets are excluded only after explicit verification.
                </p>
                <form onSubmit={review}>
                  <label>
                    Review status
                    <select name="status" defaultValue={selected.status}>
                      {[
                        "Needs Review",
                        "Under Review",
                        "Confirmed Impersonation",
                        "Dismissed",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Investigator note
                    <textarea
                      name="note"
                      required
                      placeholder="Record your evidence and reasoning…"
                    />
                  </label>
                  <Button type="submit">
                    Save demo review <Check size={15} />
                  </Button>
                </form>
                <h3>Review history</h3>
                {selected.history.length ? (
                  selected.history.map((h, i) => (
                    <div className="review-entry" key={i}>
                      <b>{h.status}</b>
                      <small>
                        Demo reviewer · {new Date(h.at).toLocaleString()}
                      </small>
                      <p>{h.note}</p>
                    </div>
                  ))
                ) : (
                  <p className="muted">
                    No reviews yet. This finding needs human verification.
                  </p>
                )}
              </>
            ) : modal === "brand" ? (
              <>
                <div className="eyebrow">BRAND IDENTITY / DEMO</div>
                <h2>{editing ? "Edit brand" : "Register your brand"}</h2>
                <p>
                  Define the identity you want to protect. Demo data is local to
                  this browser.
                </p>
                <form onSubmit={saveBrand}>
                  <label>
                    Brand name
                    <input
                      name="name"
                      minLength={2}
                      maxLength={100}
                      defaultValue={editing?.name}
                      required
                      placeholder="e.g. Acme"
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      name="description"
                      defaultValue={editing?.description}
                      required
                      maxLength={1000}
                      placeholder="What does your brand do?"
                    />
                  </label>
                  <label>
                    Official website
                    <input
                      type="url"
                      name="website"
                      defaultValue={editing?.website}
                      required
                      placeholder="https://yourbrand.com"
                      pattern="https://.*"
                    />
                  </label>
                  <label>
                    Company contact email
                    <input
                      type="email"
                      name="email"
                      defaultValue={editing?.email}
                      required
                      placeholder="security@yourbrand.com"
                    />
                  </label>
                  <label>
                    Logo URL (optional)
                    <input
                      name="logo"
                      type="url"
                      pattern="https://.*"
                      defaultValue={editing?.logo}
                      placeholder="https://yourbrand.com/logo.png"
                    />
                  </label>
                  <Button type="submit">
                    {editing ? "Save changes" : "Create brand"}
                    <ArrowRight size={15} />
                  </Button>
                </form>
              </>
            ) : modal === "scan" ? (
              <>
                <div className="eyebrow">DETECTION / DEMO MODE</div>
                <h2>Start a sample scan</h2>
                <p>
                  Explore the detection workflow with synthetic candidates. No
                  external platform is contacted.
                </p>
                <form onSubmit={runScan}>
                  <label>
                    Registered brand
                    <select name="brand" required>
                      {brands
                        .filter((b) => !b.archived)
                        .map((b) => (
                          <option key={b.id}>{b.name}</option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Source
                    <select
                      name="source"
                      defaultValue={
                        page === "App Monitoring" ? "App Store" : "YouTube"
                      }
                    >
                      <option>YouTube</option>
                      <option>App Store</option>
                    </select>
                  </label>
                  <div className="notice">
                    <TriangleAlert size={18} />
                    <span>
                      Demo Data — Not Live Threat Intelligence. Duplicate sample
                      candidates are not added twice.
                    </span>
                  </div>
                  <Button
                    type="submit"
                    disabled={busy || !brands.some((b) => !b.archived)}
                  >
                    <ScanLine size={16} className={busy ? "spin" : ""} />
                    {busy ? "Running sample scan…" : "Run demonstration"}
                  </Button>
                </form>
              </>
            ) : modal === "assets" && editing ? (
              <>
                <h2>{editing.name} assets</h2>
                <p>
                  {scans.filter((s) => s.brand === editing.name).length}{" "}
                  associated sample scans
                </p>
                <p>
                  Demo asset registration. No URL or name is automatically
                  verified.
                </p>
                {editing.assets.map((a, i) => (
                  <div className="asset-row" key={i}>
                    <div>
                      <b>{a.name}</b>
                      <small>
                        {a.platform} · {a.url}
                      </small>
                    </div>
                    <Badge tone={a.verified ? "green" : ""}>
                      {a.verified ? "Demo verified" : "Unverified"}
                    </Badge>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            "Demo verification step: have you independently confirmed ownership? This does not verify a real account.",
                          )
                        ) {
                          const b = {
                            ...editing,
                            assets: editing.assets.map((v, j) =>
                              j === i ? { ...v, verified: true } : v,
                            ),
                          };
                          setEditing(b);
                          setBrands((old) =>
                            old.map((v) => (v.id === b.id ? b : v)),
                          );
                        }
                      }}
                    >
                      Verify
                    </button>
                  </div>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget);
                    const b = {
                      ...editing,
                      assets: [
                        ...editing.assets,
                        {
                          name: String(d.get("name")),
                          platform: String(d.get("platform")),
                          url: String(d.get("url")),
                          publisher: String(d.get("publisher") || ""),
                          iconUrl: String(d.get("icon") || ""),
                          verified: false,
                        },
                      ],
                    };
                    setEditing(b);
                    setBrands((old) => old.map((v) => (v.id === b.id ? b : v)));
                    e.currentTarget.reset();
                    notify("Official asset registered as unverified.");
                  }}
                >
                  <label>
                    Account or app name
                    <input name="name" required />
                  </label>
                  <label>
                    Platform
                    <select name="platform">
                      <option>YouTube</option>
                      <option>App Store</option>
                      <option>Other (registration only)</option>
                    </select>
                  </label>
                  <label>
                    Official URL
                    <input
                      name="url"
                      type="url"
                      required
                      pattern="https://.*"
                    />
                  </label>
                  <label>
                    Publisher / developer (for apps)
                    <input
                      name="publisher"
                      placeholder="Official publisher name"
                    />
                  </label>
                  <label>
                    Icon URL (optional)
                    <input
                      name="icon"
                      type="url"
                      pattern="https://.*"
                      placeholder="https://yourbrand.com/icon.png"
                    />
                  </label>
                  <Button type="submit">
                    <Plus size={15} />
                    Register asset
                  </Button>
                </form>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setBrandFilter(editing.name);
                    setModal("");
                    go("Findings & Investigations");
                  }}
                >
                  View associated findings <ArrowRight size={14} />
                </Button>
              </>
            ) : modal.startsWith("scan-detail:") ? (
              <>
                <h2>Scan details</h2>
                {scans
                  .filter((s) => s.id === modal.split(":")[1])
                  .map((s) => (
                    <div key={s.id}>
                      <Badge tone="demo">Synthetic sample run</Badge>
                      <h3>
                        {s.brand} / {s.source}
                      </h3>
                      <p>Started: {new Date(s.date).toLocaleString()}</p>
                      <p>Status: {s.status}</p>
                      <p>Candidates returned: {s.count}</p>
                      <p>
                        No external request was made. This completed status
                        describes the sample workflow only.
                      </p>
                    </div>
                  ))}
              </>
            ) : modal === "email" ? (
              <>
                <div className="eyebrow">EMAIL PREVIEW — NOT SENT</div>
                <h2>Potential brand match detected</h2>
                <p>Recipient: verified brand contact required</p>
                <div className="notice">
                  <Mail size={22} />
                  <span>
                    A new potential match needs review. Open WOLVGUARD to
                    compare available evidence. This alert is not a
                    determination of fraud.
                  </span>
                </div>
                <p>
                  Email Not Configured. No delivery was attempted. A verified
                  recipient and a configured server-side email provider are
                  required.
                </p>
              </>
            ) : modal === "contact" ? (
              <>
                <h2>Let’s talk protection.</h2>
                <p>
                  Prepare your message locally. Support delivery is not
                  configured.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget);
                    const blob = new Blob(
                      [
                        Array.from(d.entries())
                          .map(([k, v]) => `${k}: ${v}`)
                          .join("\n\n"),
                      ],
                      { type: "text/plain" },
                    );
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "wolvguard-support-draft.txt";
                    a.click();
                    URL.revokeObjectURL(a.href);
                    notify("Support draft downloaded. No message was sent.");
                  }}
                >
                  <label>
                    Full name
                    <input name="Name" required />
                  </label>
                  <label>
                    Company
                    <input name="Company" required />
                  </label>
                  <label>
                    Email
                    <input name="Email" type="email" required />
                  </label>
                  <label>
                    Message
                    <textarea name="Message" required />
                  </label>
                  <Button type="submit">
                    <Download size={15} />
                    Download message draft
                  </Button>
                </form>
              </>
            ) : modal === "setup" ? (
              <>
                <h2>Supported live integrations</h2>
                <p>
                  Apple App Store and Bluesky public profile searches run
                  through the Node.js backend. These two sources need no API
                  key.
                </p>
                <Button
                  onClick={() => {
                    setModal("");
                    location.hash = "live";
                  }}
                >
                  Open live workspace <ArrowRight size={15} />
                </Button>
                <p>
                  Company authentication and email delivery remain unconfigured.
                  Supabase deployment source is retained as an optional future
                  extension, not a prerequisite for current live monitoring.
                </p>
              </>
            ) : modal === "user" ? (
              <>
                <h2>Demo visitor</h2>
                <Badge tone="demo">Not authenticated</Badge>
                <p>
                  Your changes are stored in this browser only. No private
                  account is connected.
                </p>
                <Button
                  onClick={() => {
                    setModal("");
                    location.hash = "login";
                  }}
                >
                  View sign-in status <ArrowRight size={15} />
                </Button>
              </>
            ) : (
              <>
                <h2>WolvGuard</h2>
                <p>
                  AI-Powered Digital Risk Protection for Social Media and Mobile
                  Applications.
                </p>
                <p>Developed by Team WOLVANT.</p>
                <p>
                  Current detection uses transparent string-similarity
                  heuristics, not an AI model. This demo does not assert that
                  any real account is fraudulent.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
