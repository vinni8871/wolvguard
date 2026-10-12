import {
  useState,
  useEffect,
  useRef,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  FileSearch,
  Globe,
  History,
  Info,
  Layers,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  Menu,
  Plus,
  Radio,
  RefreshCw,
  ScanLine,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  TriangleAlert,
  X,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { scoreCandidate } from "@/lib/live-detection";
import { uploadSignature } from "@/lib/image-signature";
import Evaluation from "./Evaluation";
import type {
  Asset,
  LiveBrand,
  LiveCandidate,
  LiveState,
  LocalAlert,
  ProviderCandidate,
  ProviderStatus,
  ReviewStatus,
  Scan,
} from "./types";
const STORAGE = "wolvguard-live-workspace-v1";
const INITIAL: LiveState = {
  version: 1,
  brands: [],
  candidates: [],
  scans: [],
  alerts: [],
  prefs: { threshold: 60, thresholds: [30, 60, 85], retention: 90 },
};
const sections = [
  ["Overview", LayoutDashboard],
  ["Brand Profiles", Building2],
  ["Social Monitoring", Globe],
  ["App Monitoring", Smartphone],
  ["Findings & Investigations", FileSearch],
  ["Scan History", History],
  ["Notifications", Bell],
  ["Settings", Settings],
  ["Demo & Evaluation", Activity],
] as const;
const statuses: ReviewStatus[] = [
  "Needs Review",
  "Under Review",
  "Confirmed Impersonation",
  "Dismissed",
];
const regions = {
  us: "United States",
  in: "India",
  gb: "United Kingdom",
  ca: "Canada",
  au: "Australia",
  de: "Germany",
  fr: "France",
  jp: "Japan",
};
function loadState(): LiveState {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE) || "null");
    if (
      data?.version !== 1 ||
      !Array.isArray(data.brands) ||
      !Array.isArray(data.candidates) ||
      !Array.isArray(data.scans) ||
      !Array.isArray(data.alerts) ||
      !data.prefs
    )
      return structuredClone(INITIAL);
    return {
      ...data,
      scans: data.scans.map((s: Scan) =>
        s.status === "Running"
          ? {
              ...s,
              status: "Failed",
              completedAt: new Date().toISOString(),
              error:
                "Browser session ended before completion could be verified. Please run a new scan.",
            }
          : s,
      ),
    };
  } catch {
    return structuredClone(INITIAL);
  }
}
function time(value: string | null) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
}
function Tag({ children, tone = "" }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty live-empty">
      <ScanLine size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const list = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select,textarea,a[href]",
        ) || [],
      );
    list()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const a = list();
        if (e.shiftKey && document.activeElement === a[0]) {
          e.preventDefault();
          a.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === a.at(-1)) {
          e.preventDefault();
          a[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "investigation" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <div className="eyebrow">WOLVGUARD / LOCAL LIVE WORKSPACE</div>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
function download(data: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function validHttps(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
export default function LiveWorkspace() {
  const [state, setState] = useState<LiveState>(loadState);
  const [page, setPage] = useState(
    () => sessionStorage.getItem("wg-live-page") || "Overview",
  );
  const [scanProvider, setScanProvider] = useState<"apple" | "bluesky">(
    "apple",
  );
  const [logoDraft, setLogoDraft] = useState<LiveBrand["logo"]>();
  const [imageBusy, setImageBusy] = useState(false);
  const [assetBusy, setAssetBusy] = useState(false);
  const [assetProvider, setAssetProvider] = useState<"apple" | "bluesky">(
    "apple",
  );
  const controller = useRef<AbortController | null>(null);
  const [light, setLight] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("all");
  useEffect(() => {
    sessionStorage.setItem("wg-live-page", page);
    window.scrollTo(0, 0);
  }, [page]);
  const [provider, setProvider] = useState<ProviderStatus | null>(null);
  const [providerError, setProviderError] = useState("");
  const [toast, setToast] = useState("");
  const [storageError, setStorageError] = useState("");
  const [modal, setModal] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanDetail, setScanDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [sort, setSort] = useState("newest");
  const [pagination, setPagination] = useState(1);
  const [verification, setVerification] = useState<Asset | null>(null);
  const selected = state.candidates.find((c) => c.id === selectedId);
  const editing = state.brands.find((b) => b.id === editId);
  const scan = state.scans.find((s) => s.id === scanDetail);
  const activeBrands = state.brands.filter((b) => !b.archived);
  const potential = state.candidates.filter((c) => c.potential && !c.official);
  const unread = state.alerts.filter((a) => !a.read).length;
  useEffect(() => {
    if (modal === "brand") setLogoDraft(editing?.logo);
  }, [modal, editId]);
  useEffect(() => () => controller.current?.abort(), []);
  async function chooseLogo(file?: File) {
    if (!file) return;
    setImageBusy(true);
    try {
      setLogoDraft(await uploadSignature(file));
      setToast(
        "Logo fingerprint computed locally. Your uploaded image stays in this browser.",
      );
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Image could not be decoded.");
    } finally {
      setImageBusy(false);
    }
  }

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(state));
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is full or unavailable. Changes exist only in memory. Export your workspace before leaving.",
      );
    }
  }, [state]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  async function refreshStatus(feedback = false) {
    try {
      const r = await fetch("/api/providers");
      if (!r.ok) throw new Error();
      setProvider(await r.json());
      setProviderError("");
      if (feedback) setToast("Integration status refreshed from the server.");
    } catch {
      setProviderError(
        "The local provider server is unreachable. Start npm start after building the app.",
      );
    }
  }
  useEffect(() => {
    refreshStatus();
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document
          .querySelector<HTMLInputElement>(".live-global-search input")
          ?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  // Local retention is applied when the workspace is opened, never on a remote company database.
  useEffect(() => {
    setState((s) => {
      const cutoff = Date.now() - s.prefs.retention * 86400000;
      const candidates = s.candidates.filter(
        (c) => new Date(c.lastScanAt).getTime() >= cutoff,
      );
      const ids = new Set(candidates.map((c) => c.id));
      return {
        ...s,
        candidates,
        scans: s.scans.filter((r) => new Date(r.startedAt).getTime() >= cutoff),
        alerts: s.alerts.filter((a) => ids.has(a.candidateId)),
      };
    });
  }, []);
  function navigate(next: string) {
    setPage(next);
    setSourceFilter("all");
    setQuery("");
    setPagination(1);
    setMobileMenu(false);
  }
  function startScan() {
    setScanProvider(page === "Social Monitoring" ? "bluesky" : "apple");
    if (!activeBrands.length) {
      setEditId(null);
      setModal("brand");
    } else setModal("scan");
  }
  const filtered = state.candidates
    .filter(
      (c) =>
        (page !== "Social Monitoring" ||
          (c.provider || "apple") === "bluesky") &&
        (page !== "App Monitoring" || (c.provider || "apple") === "apple") &&
        (page !== "Findings & Investigations" ||
          (c.potential && !c.official)) &&
        (sourceFilter === "all" || (c.provider || "apple") === sourceFilter) &&
        (brandFilter === "all" || c.brandId === brandFilter) &&
        (severity === "all" || c.severity === severity) &&
        (reviewFilter === "all" || c.status === reviewFilter) &&
        (!from || c.lastScanAt.slice(0, 10) >= from) &&
        `${c.name} ${c.publisher} ${c.sourceId}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "risk"
        ? b.score - a.score
        : b.lastScanAt.localeCompare(a.lastScanAt),
    );
  useEffect(
    () => setPagination(1),
    [query, brandFilter, severity, reviewFilter, from, page, sourceFilter],
  );
  function saveBrand(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") || "").trim();
    const website = String(data.get("website") || "").trim();
    if (
      name.length < 2 ||
      name.length > 100 ||
      (website && !validHttps(website))
    )
      return setToast(
        "Enter a 2–100 character brand name and an HTTPS website, if provided.",
      );
    const b: LiveBrand = {
      id: editing?.id || crypto.randomUUID(),
      name,
      website,
      description: String(data.get("description") || "").trim(),
      logo: logoDraft,
      archived: editing?.archived || false,
      assets: editing?.assets || [],
      createdAt: editing?.createdAt || new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      brands: editing
        ? s.brands.map((v) => (v.id === b.id ? b : v))
        : [...s.brands, b],
    }));
    setModal("");
    setToast(
      "Brand saved only in this browser. Run a scan to calculate fresh comparisons.",
    );
    navigate("Brand Profiles");
  }
  async function runScan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const data = new FormData(e.currentTarget);
    const brand = state.brands.find((b) => b.id === data.get("brand"));
    if (!brand || brand.archived) return;
    const country =
      scanProvider === "bluesky" ? "us" : String(data.get("country"));
    controller.current = new AbortController();
    const signal = AbortSignal.any([
      controller.current.signal,
      AbortSignal.timeout(120000),
    ]);
    const id = crypto.randomUUID(),
      startedAt = new Date().toISOString();
    const run: Scan = {
      provider: scanProvider,
      id,
      brandId: brand.id,
      brandName: brand.name,
      country:scanProvider==='bluesky'?'global':country,
      startedAt,
      completedAt: null,
      fetchedAt: null,
      status: "Running",
      count: 0,
      matches: 0,
      excluded: 0,
      cacheHit: false,
      error: null,
      candidateIds: [],
    };
    setState((s) => ({ ...s, scans: [run, ...s.scans] }));
    setBusy(true);
    setModal("");
    navigate("Scan History");
    try {
      const response = await fetch(`/api/${scanProvider}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: brand.name,
          country,
          limit: Number(data.get("limit")),
        }),
        signal,
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error(
          "Provider server returned an unreadable response. No results were saved.",
        );
      }
      if (!response.ok)
        throw new Error(result.error?.message || "The live search failed.");
      if (
        result.dataMode !== "live" ||
        !Array.isArray(result.candidates) ||
        !result.fetchedAt
      )
        throw new Error(
          "Provider response could not be verified. No results were saved.",
        );
      // Missing or blocked images remain unavailable, never replaced with made-up similarities.
      const raw: ProviderCandidate[] = result.candidates.map(
        (c: ProviderCandidate) => ({ ...c, provider: scanProvider }),
      );
      if (brand.logo) {
        let next = 0;
        await Promise.all(
          Array.from({ length: 3 }, async () => {
            while (next < raw.length) {
              const c = raw[next++];
              if (!c.iconUrl) {
                c.imageError = "Provider supplied no image";
                continue;
              }
              try {
                const r = await fetch("/api/image-fingerprint", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ url: c.iconUrl }),
                  signal,
                });
                const image = await r.json();
                if (!r.ok)
                  throw new Error(
                    image.error?.message || "Image comparison unavailable",
                  );
                c.imageSignature = image.signature;
              } catch (e) {
                if (signal.aborted) throw e;
                c.imageError =
                  e instanceof Error ? e.message : "Image unavailable";
              }
            }
          }),
        );
      }
      if (signal.aborted)
        throw new DOMException("Scan cancelled by user.", "AbortError");
      const completedAt = new Date().toISOString();
      const scored: LiveCandidate[] = raw.map((c: ProviderCandidate) => ({
        ...c,
        ...scoreCandidate(brand, c, state.prefs.thresholds),
        id: `${brand.id}:${scanProvider === "bluesky" ? "global" : country}:${c.sourceId}`,
        brandId: brand.id,
        scanId: id,
        fetchedAt: result.fetchedAt,
        lastScanAt: completedAt,
        status: "Needs Review",
        reviews: [],
      }));
      setState((previous) => {
        const merged = [...previous.candidates];
        const alerts = [...previous.alerts];
        for (const candidate of scored) {
          const index = merged.findIndex((c) => c.id === candidate.id);
          const old = merged[index];
          const updated = old
            ? { ...candidate, status: old.status, reviews: old.reviews }
            : candidate;
          if (index < 0) merged.unshift(updated);
          else merged[index] = updated;
          if (
            updated.potential &&
            updated.score >= previous.prefs.threshold &&
            !["Dismissed", "Confirmed Impersonation"].includes(
              updated.status,
            ) &&
            !alerts.some((a) => a.candidateId === updated.id)
          )
            alerts.unshift({
              id: crypto.randomUUID(),
              candidateId: updated.id,
              createdAt: completedAt,
              read: false,
              score: updated.score,
            });
        }
        return {
          ...previous,
          candidates: merged,
          alerts,
          scans: previous.scans.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: result.omittedCount ? "Partial" : "Completed",
                  completedAt,
                  fetchedAt: result.fetchedAt,
                  count: scored.length,
                  matches: scored.filter((c) => c.potential).length,
                  excluded: scored.filter((c) => c.official).length,
                  cacheHit: result.cacheHit,
                  error: result.omittedCount
                    ? `${result.omittedCount} upstream listings were omitted because they did not have valid public listing URLs or identifiers.`
                    : null,
                  candidateIds: scored.map((c) => c.id),
                  evidence: scored,
                }
              : s,
          ),
        };
      });
      setToast(
        `${scored.length} real ${scanProvider === "bluesky" ? "Bluesky profiles" : "App Store listings"} received. ${scored.filter((c) => c.potential).length} potential matches need context, not assumptions.`,
      );
      navigate(
        scanProvider === "bluesky" ? "Social Monitoring" : "App Monitoring",
      );
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "Scan cancelled. No new candidates were saved."
          : error instanceof Error && error.name === "TimeoutError"
            ? "Search timed out. Completion was not verified. No replacement data was created."
            : error instanceof Error
              ? error.message
              : "Search failed.";
      setState((s) => ({
        ...s,
        scans: s.scans.map((r) =>
          r.id === id
            ? {
                ...r,
                status: "Failed",
                completedAt: new Date().toISOString(),
                error: message,
              }
            : r,
        ),
      }));
      setToast(message);
    } finally {
      setBusy(false);
      controller.current = null;
      refreshStatus();
    }
  }
  function saveReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const data = new FormData(e.currentTarget);
    const status = String(data.get("status")) as ReviewStatus;
    const note = String(data.get("note") || "").trim();
    if (!note || !statuses.includes(status)) return;
    if (selected.official && status === "Confirmed Impersonation")
      return setToast(
        "This is a verified official identity. Revoke verification first if your evidence has changed.",
      );
    if (
      status === "Confirmed Impersonation" &&
      !confirm(
        "This is a serious manual classification. Have you independently verified impersonation beyond name or publisher similarity? Your decision is a local note, not an automated report.",
      )
    )
      return;
    setState((s) => ({
      ...s,
      candidates: s.candidates.map((c) =>
        c.id === selected.id
          ? {
              ...c,
              status,
              reviews: [
                ...c.reviews,
                {
                  id: crypto.randomUUID(),
                  status,
                  note,
                  at: new Date().toISOString(),
                  scoreAtReview: c.score,
                  evidenceFetchedAt: c.fetchedAt,
                },
              ],
            }
          : c,
      ),
    }));
    setToast("Review recorded locally. No account was reported or removed.");
    (e.currentTarget.elements.namedItem("note") as HTMLTextAreaElement).value =
      "";
  }
  async function addAsset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing || assetBusy) return;
    const form = e.currentTarget,
      data = new FormData(form);
    const url = String(data.get("url")).trim();
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return setToast("Enter a valid HTTPS source URL.");
    }
    if (u.protocol !== "https:")
      return setToast("Only HTTPS official source links are accepted.");
    setAssetBusy(true);
    try {
      let sourceId = "",
        publisher = String(data.get("publisher") || "").trim(),
        officialUrl = url;
      if (assetProvider === "apple") {
        const match = u.pathname.match(/\/id(\d+)/);
        if (u.hostname !== "apps.apple.com" || !match)
          throw new Error(
            "Use an apps.apple.com URL containing its numeric app ID.",
          );
        sourceId = match[1];
      } else {
        if (u.hostname !== "bsky.app" || !u.pathname.startsWith("/profile/"))
          throw new Error("Use https://bsky.app/profile/handle-or-did");
        const actor = decodeURIComponent(
          u.pathname.split("/profile/")[1].split("/")[0],
        );
        const r = await fetch("/api/bluesky/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor }),
        });
        const profile = await r.json();
        if (!r.ok)
          throw new Error(
            profile.error?.message || "Profile resolution failed.",
          );
        sourceId = profile.did;
        publisher = profile.handle;
        officialUrl = profile.url;
      }
      if (
        editing.assets.some(
          (a) =>
            (a.provider || "apple") === assetProvider &&
            a.sourceId === sourceId,
        )
      )
        throw new Error("This identity is already registered.");
      const asset: Asset = {
        id: crypto.randomUUID(),
        provider: assetProvider,
        name: String(data.get("name")).trim(),
        publisher,
        url: officialUrl,
        sourceId,
        verifiedAt: null,
        evidence: "",
      };
      setState((s) => ({
        ...s,
        brands: s.brands.map((b) =>
          b.id === editing.id ? { ...b, assets: [...b.assets, asset] } : b,
        ),
      }));
      form.reset();
      setToast(
        "Asset registered as unverified. Record independent evidence before exclusion.",
      );
    } catch (e) {
      setToast(
        e instanceof Error ? e.message : "Could not register the asset.",
      );
    } finally {
      setAssetBusy(false);
    }
  }
  function verifyAsset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing || !verification) return;
    const data = new FormData(e.currentTarget);
    const evidence = String(data.get("evidence")).trim();
    if (evidence.length < 15 || !data.get("confirm")) return;
    setState((s) => {
      const brands = s.brands.map((b) =>
        b.id === editing.id
          ? {
              ...b,
              assets: b.assets.map((a) =>
                a.id === verification.id
                  ? { ...a, verifiedAt: new Date().toISOString(), evidence }
                  : a,
              ),
            }
          : b,
      );
      const brand = brands.find((b) => b.id === editing.id)!;
      // An exact verified identity must disappear from current findings immediately.
      const candidates = s.candidates.map((c) =>
        c.brandId === brand.id
          ? { ...c, ...scoreCandidate(brand, c, s.prefs.thresholds) }
          : c,
      );
      const officialIds = new Set(
        candidates.filter((c) => c.official).map((c) => c.id),
      );
      return {
        ...s,
        brands,
        candidates,
        alerts: s.alerts.filter((a) => !officialIds.has(a.candidateId)),
      };
    });
    setVerification(null);
    setToast(
      "Verification evidence saved. Exact official identities are now excluded from current findings and alerts.",
    );
  }
  function changeAsset(id: string, action: "revoke" | "remove") {
    if (
      !editing ||
      !confirm(
        action === "remove"
          ? "Remove this official asset? Source evidence and historical scan snapshots will remain."
          : "Revoke this manual verification? This identity can become a potential match again.",
      )
    )
      return;
    setState((s) => {
      const brands = s.brands.map((b) =>
        b.id === editing.id
          ? {
              ...b,
              assets:
                action === "remove"
                  ? b.assets.filter((a) => a.id !== id)
                  : b.assets.map((a) =>
                      a.id === id
                        ? { ...a, verifiedAt: null, evidence: "" }
                        : a,
                    ),
            }
          : b,
      );
      const brand = brands.find((b) => b.id === editing.id)!;
      return {
        ...s,
        brands,
        candidates: s.candidates.map((c) =>
          c.brandId === brand.id
            ? { ...c, ...scoreCandidate(brand, c, s.prefs.thresholds) }
            : c,
        ),
      };
    });
    setVerification(null);
    setToast(
      action === "remove"
        ? "Official asset removed."
        : "Verification revoked and current comparisons refreshed.",
    );
  }
  function renderTable(items: LiveCandidate[], compact = false) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Profile / app identity</th>
              <th>Brand</th>
              <th>Evidence</th>
              <th>Risk indicator</th>
              {!compact && <th>Review status</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setSelectedId(c.id)}
              >
                <td>
                  <div className="identity">
                    {c.iconUrl ? (
                      <img
                        src={c.iconUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="app-icon"
                        loading="lazy"
                      />
                    ) : (
                      <span className="avatar purple">
                        <Smartphone size={17} />
                      </span>
                    )}
                    <div>
                      <b>{c.name}</b>
                      <small>{c.publisher || "Publisher unavailable"}</small>
                    </div>
                  </div>
                </td>
                <td>
                  {state.brands.find((b) => b.id === c.brandId)?.name ||
                    "Archived brand"}
                </td>
                <td>
                  <Tag tone={c.official ? "green" : ""}>
                    {c.official
                      ? "Official · excluded"
                      : c.potential
                        ? "Potential match"
                        : "Search candidate"}
                  </Tag>
                  <small className="block-small">
                    {c.provider === "bluesky" ? "Bluesky API" : "Apple API"} ·{" "}
                    {c.metadata.region}
                  </small>
                </td>
                <td>
                  <span className={`risk ${c.severity.toLowerCase()}`}>
                    {c.official ? (
                      <>Excluded</>
                    ) : (
                      <>
                        {c.score} <small>{c.severity}</small>
                      </>
                    )}
                  </span>
                </td>
                {!compact && (
                  <td>
                    <Tag>{c.status}</Tag>
                  </td>
                )}
                <td>
                  <ArrowUpRight size={15} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <Empty
            title="No listings to show"
            text={
              state.candidates.length
                ? "Try clearing filters or running another scan."
                : "Register a brand and run a live source search. No sample records are loaded here."
            }
          >
            <Button onClick={startScan}>
              <ScanLine size={15} />
              {activeBrands.length ? "Start live scan" : "Register a brand"}
            </Button>
          </Empty>
        )}
      </div>
    );
  }
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return d.toISOString().slice(0, 10);
  });
  const dayCounts = days.map((d) =>
    state.scans
      .filter((s) => s.startedAt.startsWith(d))
      .reduce((n, s) => n + s.matches, 0),
  );
  const chartMax = Math.max(1, ...dayCounts);
  return (
    <div
      className={`site live-site app-shell ${light ? "light" : ""} ${collapsed ? "collapsed" : ""} ${mobileMenu ? "live-mobile-open" : ""}`}
    >
      <aside className="sidebar">
        <button
          className="live-nav-close"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        >
          <X size={18} />
        </button>
        <a href="#home" className="live-wordmark">
          <ShieldCheck size={29} />
          <span>
            WOLV<span>GUARD</span>
            <small>BY WOLVANT</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">
            <Radio size={14} />
          </span>
          <div>
            <b>Local live workspace</b>
            <small>This browser only</small>
          </div>
        </div>
        <div className="nav-label">PUBLIC SOURCE MONITORING</div>
        <nav>
          {sections.map(([label, Icon]) => (
            <button
              key={label}
              aria-label={label}
              className={page === label ? "active" : ""}
              onClick={() => navigate(label)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Notifications" && unread > 0 && <b>{unread}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-info">
            <ShieldCheck size={22} />
            <b>Real sources. Clear boundaries.</b>
            <p>
              Live social & app results.
              <br />
              No simulated intelligence.
            </p>
            <button onClick={startScan}>
              Start a live search <ArrowUpRight size={13} />
            </button>
          </div>
          <button
            className="collapse-button"
            onClick={() => setCollapsed(!collapsed)}
          >
            <Menu size={17} />
            <span>Collapse sidebar</span>
          </button>
          <a href="#app">
            <Layers size={16} />
            <span>Switch to Demo Mode</span>
          </a>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              aria-label="Toggle navigation"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Menu size={18} />
            </button>
            <span>Live workspace</span>
            <ChevronRight size={13} />
            <b>{page}</b>
          </div>
          <div className="topbar-actions">
            <div className="search live-global-search">
              <Search size={15} />
              <input
                aria-label="Global candidate search"
                placeholder="Search all candidates…"
                value={query}
                onChange={(e) => {
                  setPage("Findings & Investigations");
                  setQuery(e.target.value);
                  setBrandFilter("all");
                  setSourceFilter("all");
                }}
              />
            </div>
            <button
              aria-label="Toggle light or dark theme"
              onClick={() => setLight(!light)}
            >
              <Activity size={17} />
            </button>
            <a href="#app" className="mode-switch">
              <Layers size={14} />
              Demo mode
            </a>
            <button
              aria-label="Notifications"
              className="notification-button"
              onClick={() => navigate("Notifications")}
            >
              <Bell size={18} />
              {unread > 0 && <i />}
            </button>
            <button
              className="user-avatar"
              aria-label="Local storage and privacy settings"
              onClick={() => navigate("Settings")}
            >
              L
            </button>
          </div>
        </header>
        <div className="demo-banner live-banner">
          <span>
            <Radio size={13} />
            <b>Live public API results · Not verified threats</b>
            <span className="demo-extra">
              Local browser storage · Not signed in
            </span>
          </span>
          <button onClick={() => navigate("Settings")}>
            Storage & privacy <ArrowUpRight size={12} />
          </button>
        </div>
        {storageError && (
          <div className="notice storage-warning" role="alert">
            <TriangleAlert size={18} />
            {storageError}
            <Button
              variant="outline"
              onClick={() => download(state, "wolvguard-live-workspace.json")}
            >
              Export now
            </Button>
          </div>
        )}
        <main className="app-content">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                {page === "App Monitoring"
                  ? "AUTHORIZED DATA. ACTIONABLE CONTEXT."
                  : "WOLVGUARD / LIVE WORKSPACE"}
              </div>
              <h2>
                {page === "Overview" ? "Your live risk landscape" : page}
                <span className="heading-dot">.</span>
              </h2>
              <p>
                {
                  (
                    {
                      Overview:
                        "Real App Store evidence, kept separate from the demonstration workspace.",
                      "Brand Profiles":
                        "Register brand assets, upload a reference logo, and verify official identities.",
                      "App Monitoring":
                        "Search Apple’s public catalog. Compare evidence. Stay in control.",
                      "Social Monitoring":
                        "Search real Bluesky profiles with name, description, account and optional logo signals.",
                      "Findings & Investigations":
                        "Potential matches are review leads—not conclusions about fraud.",
                      "Scan History":
                        "Every live search, including failures and empty results.",
                      Notifications:
                        "Local in-app alerts. No emails have been sent.",
                      "Demo & Evaluation":
                        "A traceable rubric audit and a short, honest presentation for judges.",
                      Settings:
                        "Supported services, local data controls, and honest integration status.",
                    } as Record<string, string>
                  )[page]
                }
              </p>
            </div>
            <div className="action-row">
              {busy && (
                <Button
                  variant="outline"
                  onClick={() => controller.current?.abort()}
                >
                  Cancel scan
                </Button>
              )}
              {page === "Brand Profiles" ? (
                <Button
                  onClick={() => {
                    setEditId(null);
                    setModal("brand");
                  }}
                >
                  <Plus size={15} />
                  Add brand
                </Button>
              ) : [
                  "Overview",
                  "App Monitoring",
                  "Social Monitoring",
                  "Findings & Investigations",
                  "Scan History",
                ].includes(page) ? (
                <Button disabled={busy} onClick={startScan}>
                  {busy ? (
                    <Loader2 size={15} className="spin" />
                  ) : (
                    <ScanLine size={15} />
                  )}{" "}
                  {busy ? "Scanning source…" : "Start live scan"}
                </Button>
              ) : null}
            </div>
          </div>
          {page === "Overview" ? (
            <>
              <div className="metrics">
                {[
                  [
                    Building2,
                    "Registered brands",
                    activeBrands.length,
                    "Local identity profiles",
                  ],
                  [
                    Smartphone,
                    "Listings scanned",
                    state.scans.reduce((n, s) => n + s.count, 0),
                    "Actual returned candidates",
                  ],
                  [
                    FileSearch,
                    "Potential matches",
                    potential.length,
                    "Unverified review leads",
                  ],
                  [
                    TriangleAlert,
                    "High / critical",
                    potential.filter((c) =>
                      ["High", "Critical"].includes(c.severity),
                    ).length,
                    "Multiple signals required",
                  ],
                  [
                    ShieldCheck,
                    "Completed scans",
                    state.scans.filter((s) => s.status === "Completed").length,
                    "Verified API completion",
                  ],
                ].map(([Icon, label, value, subtitle]) => {
                  const I = Icon as typeof Shield;
                  return (
                    <div className="metric" key={String(label)}>
                      <div>
                        <span>{String(label)}</span>
                        <I size={16} />
                      </div>
                      <strong>{String(value).padStart(2, "0")}</strong>
                      <small>{String(subtitle)}</small>
                    </div>
                  );
                })}
              </div>
              <div className="chart-grid">
                <div className="panel">
                  <div className="panel-title">
                    <h3>Potential matches by scan day</h3>
                    <Tag>Last 7 days</Tag>
                  </div>
                  <div className="live-bar-chart">
                    {dayCounts.map((n, i) => (
                      <div key={days[i]}>
                        <span>{n}</span>
                        <i
                          style={{
                            height: `${Math.max(n ? 5 : 0, (n / chartMax) * 110)}px`,
                          }}
                        />
                        <small>
                          {new Date(days[i]).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </small>
                      </div>
                    ))}
                  </div>
                  <p className="chart-caption">
                    Counts reflect each scan’s returned potential matches,
                    including repeat observations.
                  </p>
                </div>
                <div className="panel">
                  <div className="panel-title">
                    <h3>Risk distribution</h3>
                    <Tag>Current findings</Tag>
                  </div>
                  <div className="live-severities">
                    {["Critical", "High", "Medium", "Low"].map((sev) => (
                      <div className="source-bar" key={sev}>
                        <span>
                          {sev}
                          <b>
                            {potential.filter((c) => c.severity === sev).length}
                          </b>
                        </span>
                        <div>
                          <i
                            style={{
                              width: `${(potential.filter((c) => c.severity === sev).length / Math.max(1, potential.length)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="panel recent">
                <div className="panel-title">
                  <h3>Recent candidates</h3>
                  <button
                    className="text-button"
                    onClick={() => navigate("App Monitoring")}
                  >
                    View all listings <ArrowRight size={14} />
                  </button>
                </div>
                {renderTable(state.candidates.slice(0, 5), true)}
              </div>
            </>
          ) : null}
          {page === "Overview" && (
            <div className="panel source-comparison">
              <div className="panel-title">
                <h3>Social versus app findings</h3>
                <Tag>Current unverified leads</Tag>
              </div>
              {(["bluesky", "apple"] as const).map((p) => (
                <div className="source-bar" key={p}>
                  <span>
                    {p === "bluesky"
                      ? "Bluesky social profiles"
                      : "Apple app listings"}
                    <b>
                      {
                        potential.filter((c) => (c.provider || "apple") === p)
                          .length
                      }
                    </b>
                  </span>
                  <div>
                    <i
                      style={{
                        width:
                          (potential.filter(
                            (c) => (c.provider || "apple") === p,
                          ).length /
                            Math.max(1, potential.length)) *
                            100 +
                          "%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {page === "Brand Profiles" ? (
            <>
              {!state.brands.length ? (
                <div className="panel">
                  <Empty
                    title="Every search starts with your brand"
                    text="Register a public brand name. Add official apps later to improve comparisons and exclude manually verified identities."
                  >
                    <Button
                      onClick={() => {
                        setEditId(null);
                        setModal("brand");
                      }}
                    >
                      <Plus size={15} />
                      Register first brand
                    </Button>
                  </Empty>
                </div>
              ) : (
                <div className="brand-grid">
                  {state.brands.map((b) => (
                    <article className="panel brand-card" key={b.id}>
                      <div className="brand-card-top">
                        <span className="large-avatar">{b.name[0]}</span>
                        <Tag tone={b.archived ? "" : "green"}>
                          {b.archived ? "Archived" : "Local brand"}
                        </Tag>
                      </div>
                      <h3>{b.name}</h3>
                      <p>
                        {b.description ||
                          "No description added. Description similarity will be unavailable."}
                      </p>
                      {b.website && (
                        <a href={b.website} target="_blank" rel="noreferrer">
                          Official website <ExternalLink size={12} />
                        </a>
                      )}
                      <div className="brand-meta">
                        <span>{b.assets.length} official assets</span>
                        <span>
                          {state.scans.filter((s) => s.brandId === b.id).length}{" "}
                          scans
                        </span>
                      </div>
                      <div className="brand-buttons">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditId(b.id);
                            setVerification(null);
                            setModal("assets");
                          }}
                        >
                          Manage assets <ArrowRight size={12} />
                        </Button>
                        <button
                          onClick={() => {
                            setEditId(b.id);
                            setModal("brand");
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `${b.archived ? "Restore" : "Archive"} ${b.name}? Existing evidence and history will be retained.`,
                              )
                            )
                              setState((s) => ({
                                ...s,
                                brands: s.brands.map((v) =>
                                  v.id === b.id
                                    ? { ...v, archived: !v.archived }
                                    : v,
                                ),
                              }));
                          }}
                        >
                          {b.archived ? "Restore" : "Archive"}
                        </button>
                      </div>
                      <button
                        className="text-button brand-finding-link"
                        onClick={() => {
                          setBrandFilter(b.id);
                          navigate("Findings & Investigations");
                        }}
                      >
                        View associated findings <ArrowUpRight size={12} />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : null}
          {[
            "App Monitoring",
            "Social Monitoring",
            "Findings & Investigations",
          ].includes(page) ? (
            <>
              <div className="provider-banner">
                <span className="avatar">
                  <Smartphone size={21} />
                </span>
                <div>
                  <b>
                    {page === "Social Monitoring"
                      ? "Bluesky public profile search"
                      : page === "Findings & Investigations"
                        ? "Cross-source investigations"
                        : "Apple App Store Search"}
                  </b>
                  <p>
                    {page === "Social Monitoring"
                      ? "Global public profiles · stable DIDs · up to 25 results"
                      : "Public app catalog · 8 regions · up to 25 results"}{" "}
                    · No API key required
                  </p>
                </div>
                <Tag
                  tone={
                    !providerError &&
                    (page === "Social Monitoring"
                      ? provider?.bluesky
                      : provider?.apple
                    )?.status === "Connected"
                      ? "green"
                      : ""
                  }
                >
                  {providerError
                    ? "Error"
                    : (page === "Social Monitoring"
                        ? provider?.bluesky
                        : provider?.apple
                      )?.status || "Checking…"}
                </Tag>
                <button
                  className="text-button"
                  onClick={() => refreshStatus(true)}
                  aria-label="Refresh provider status"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              {providerError && (
                <div className="notice" role="alert">
                  <TriangleAlert size={18} />
                  {providerError}
                </div>
              )}
              <div className="panel">
                <div className="filterbar">
                  <div className="search">
                    <Search size={15} />
                    <input
                      aria-label="Search live candidates"
                      placeholder="App, publisher, or listing ID…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  {page==='Findings & Investigations'&&<select aria-label="Filter by source" value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)}><option value="all">All sources</option><option value="bluesky">Bluesky</option><option value="apple">Apple App Store</option></select>}
                  <select
                    aria-label="Filter by brand"
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                  >
                    <option value="all">All brands</option>
                    {state.brands.map((b) => (
                      <option value={b.id} key={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by severity"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                  >
                    <option value="all">All severities</option>
                    {["Critical", "High", "Medium", "Low"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter review status"
                    value={reviewFilter}
                    onChange={(e) => setReviewFilter(e.target.value)}
                  >
                    <option value="all">All reviews</option>
                    {statuses.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Sort candidates"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="newest">Newest first</option>
                    <option value="risk">Highest risk</option>
                  </select>
                  <input
                    className="date-filter"
                    aria-label="Scanned on or after"
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                  <button
                    className="text-button"
                    onClick={() => {
                      setQuery("");
                      setBrandFilter("all");
                      setSeverity("all");
                      setReviewFilter("all");
                      setFrom("");
                      setSourceFilter("all");
                    }}
                  >
                    Reset
                  </button>
                </div>
                {renderTable(
                  filtered.slice((pagination - 1) * 8, pagination * 8),
                )}
                <div className="table-footer">
                  <span>{filtered.length} real candidates · API evidence</span>
                  <div>
                    <Button
                      variant="ghost"
                      aria-label="Previous page"
                      disabled={pagination === 1}
                      onClick={() => setPagination((n) => n - 1)}
                    >
                      <ChevronLeft size={15} />
                    </Button>
                    {pagination} / {Math.max(1, Math.ceil(filtered.length / 8))}
                    <Button
                      variant="ghost"
                      aria-label="Next page"
                      disabled={pagination * 8 >= filtered.length}
                      onClick={() => setPagination((n) => n + 1)}
                    >
                      <ChevronRight size={15} />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="subtle-note">
                <ShieldCheck size={15} />A catalog match is not an accusation.
                Scores are heuristic indicators, not probabilities of fraud.
              </div>
            </>
          ) : null}
          {page === "Scan History" ? (
            <div className="panel">
              <div className="filterbar">
                <div className="search">
                  <Search size={15} />
                  <input
                    aria-label="Search scans"
                    value={query}
                    placeholder="Filter by brand or status…"
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <Tag tone="green">Live requests only</Tag>
              </div>
              {state.scans
                .filter((s) =>
                  (s.brandName + " " + s.status)
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((s) => (
                  <button
                    key={s.id}
                    className="scan-row"
                    onClick={() => setScanDetail(s.id)}
                  >
                    <span className="avatar">
                      {s.status === "Running" ? (
                        <Loader2 className="spin" size={18} />
                      ) : s.status === "Failed" ? (
                        <TriangleAlert size={18} />
                      ) : (
                        <ScanLine size={18} />
                      )}
                    </span>
                    <div>
                      <b>
                        {s.brandName} ·{" "}
                        {s.provider === "bluesky"
                          ? "Bluesky Global"
                          : "App Store " + s.country.toUpperCase()}
                      </b>
                      <small>
                        {time(s.startedAt)}
                        {s.cacheHit ? " · Cached provider response" : ""}
                      </small>
                    </div>
                    <span>
                      {s.count} listings · {s.matches} potential matches
                    </span>
                    <Tag
                      tone={
                        s.status === "Completed"
                          ? "green"
                          : s.status === "Failed"
                            ? "amber"
                            : ""
                      }
                    >
                      {s.status}
                    </Tag>
                    <ChevronRight size={15} />
                  </button>
                ))}
              {!state.scans.length && (
                <Empty
                  title="No live scans yet"
                  text="Completed, failed, partial and in-progress requests will all appear here."
                >
                  <Button onClick={startScan}>
                    Start your first live scan <ArrowRight size={15} />
                  </Button>
                </Empty>
              )}
            </div>
          ) : null}
          {page === "Notifications" ? (
            <>
              <div className="provider-banner">
                <Bell size={21} />
                <div>
                  <b>Local alerts are active</b>
                  <p>
                    Unique candidates at or above {state.prefs.threshold}/100.
                    Email Not Configured. No delivery is simulated.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      alerts: s.alerts.map((a) => ({ ...a, read: true })),
                    }))
                  }
                >
                  <CheckCheck size={15} />
                  Mark all read
                </Button>
              </div>
              <div className="panel">
                {state.alerts.map((a) => {
                  const c = state.candidates.find(
                    (c) => c.id === a.candidateId,
                  );
                  return c ? (
                    <button
                      className="scan-row"
                      key={a.id}
                      onClick={() => {
                        setSelectedId(c.id);
                        setState((s) => ({
                          ...s,
                          alerts: s.alerts.map((v) =>
                            v.id === a.id ? { ...v, read: true } : v,
                          ),
                        }));
                      }}
                    >
                      <span className="avatar amber">
                        <TriangleAlert size={18} />
                      </span>
                      <div>
                        <b>Review candidate: {c.name}</b>
                        <small>
                          {c.provider === "bluesky" ? "Bluesky" : "Apple"} API ·
                          Score {a.score} at alert · {time(a.createdAt)}
                        </small>
                      </div>
                      <Tag>{a.read ? "Read" : "New"}</Tag>
                      <ChevronRight size={15} />
                    </button>
                  ) : null;
                })}
                {!state.alerts.length && (
                  <Empty
                    title="No threshold alerts"
                    text="New potential matches that cross your alert threshold appear here once. Lower the threshold in Settings to alert on future scans."
                  />
                )}
              </div>
            </>
          ) : null}
          {page === "Demo & Evaluation" && (
            <Evaluation onNavigate={navigate} onToast={setToast} />
          )}
          {page === "Settings" ? (
            <div className="settings-grid">
              <section className="panel settings-panel wide">
                <h3>
                  <Database size={18} />
                  Supported integrations
                </h3>
                {[
                  [
                    "Apple App Store",
                    "Live public search · no credentials required",
                    providerError
                      ? "Error"
                      : provider?.apple.status || "Checking…",
                  ],
                  [
                    "Bluesky",
                    "Live public profile search · no credentials required",
                    providerError
                      ? "Error"
                      : provider?.bluesky?.status || "Checking…",
                  ],
                  [
                    "YouTube",
                    "Authorized API key and authentication needed",
                    "Not Configured",
                  ],
                  [
                    "Company accounts",
                    "No private cloud workspace or simulated login",
                    "Not Configured",
                  ],
                  [
                    "Email delivery",
                    "No provider or verified-recipient workflow",
                    "Not Configured",
                  ],
                  [
                    "AI assistant",
                    "Transparent local heuristics replace unsupported AI calls",
                    "Not Configured",
                  ],
                ].map(([name, desc, status]) => (
                  <div className="integration-row" key={name}>
                    <div>
                      <b>{name}</b>
                      <small>{desc}</small>
                    </div>
                    <Tag tone={status === "Connected" ? "green" : ""}>
                      {status}
                    </Tag>
                  </div>
                ))}
                <p>
                  Last successful Apple provider response:{" "}
                  {time(provider?.apple.lastSuccess || null)}
                </p>
                <p>
                  Last successful Bluesky response:{" "}
                  {time(provider?.bluesky?.lastSuccess || null)}
                </p>
                {provider?.bluesky?.lastError && (
                  <p role="alert">Bluesky: {provider.bluesky.lastError}</p>
                )}
                {provider?.apple.lastError && (
                  <p role="alert">
                    Last provider error: {provider.apple.lastError}
                  </p>
                )}
                <Button variant="outline" onClick={() => refreshStatus(true)}>
                  <RefreshCw size={14} />
                  Refresh status
                </Button>
              </section>
              <section className="panel settings-panel">
                <h3>
                  <SlidersHorizontal size={18} />
                  Risk & alert thresholds
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget),
                      medium = Number(d.get("medium")),
                      high = Number(d.get("high")),
                      critical = Number(d.get("critical")),
                      threshold = Number(d.get("alert"));
                    if (!(
                      medium >= 1 &&
                      high >= 50 &&
                      medium < high &&
                      high < critical &&
                      critical <= 100
                    ))
                      return setToast(
                        "Use ascending thresholds: Medium ≥1, High ≥50, Critical ≤100.",
                      );
                    setState((s) => ({
                      ...s,
                      prefs: {
                        ...s.prefs,
                        threshold,
                        thresholds: [medium, high, critical],
                      },
                    }));
                    setToast(
                      "Thresholds saved. New scans use these weights and labels; historical observations remain unchanged.",
                    );
                  }}
                >
                  <div className="threshold-fields">
                    <label>
                      Medium from
                      <input
                        name="medium"
                        type="number"
                        min="1"
                        max="98"
                        required
                        defaultValue={state.prefs.thresholds[0]}
                      />
                    </label>
                    <label>
                      High from
                      <input
                        name="high"
                        type="number"
                        min="50"
                        max="99"
                        required
                        defaultValue={state.prefs.thresholds[1]}
                      />
                    </label>
                    <label>
                      Critical from
                      <input
                        name="critical"
                        type="number"
                        min="51"
                        max="100"
                        required
                        defaultValue={state.prefs.thresholds[2]}
                      />
                    </label>
                  </div>
                  <label>
                    Notify at score
                    <input
                      name="alert"
                      type="number"
                      min="0"
                      max="100"
                      required
                      defaultValue={state.prefs.threshold}
                    />
                  </label>
                  <small>
                    Applies to future scans. Name-only evidence is always capped
                    below High. Duplicate alerts are suppressed.
                  </small>
                  <Button type="submit">Save thresholds</Button>
                </form>
              </section>
              <section className="panel settings-panel">
                <h3>
                  <LockKeyhole size={18} />
                  Local storage & privacy
                </h3>
                <p>
                  This workspace is not authenticated. Brands, scans, decisions,
                  and alerts are kept in this browser’s localStorage, separate
                  from demo data. Anyone using this browser profile may access
                  them.
                </p>
                <p>
                  Only the public brand name, region, and result limit are sent
                  to the selected provider through this server. Descriptions,
                  official asset evidence and review notes stay in your browser.
                  The server caches public search responses in memory for five
                  minutes.
                </p>
                <label>
                  Local history retention
                  <select
                    value={state.prefs.retention}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        prefs: {
                          ...s.prefs,
                          retention: Number(e.target.value),
                        },
                      }))
                    }
                  >
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                    <option value={365}>365 days</option>
                  </select>
                </label>
                <small>
                  Expired scan history and candidate evidence are removed when
                  you next open this workspace. Brand registrations remain.
                </small>
                <Button
                  variant="outline"
                  onClick={() =>
                    download(state, "wolvguard-live-workspace.json")
                  }
                >
                  <ArrowDownToLine size={15} />
                  Export local workspace
                </Button>
              </section>
              <section className="panel settings-panel wide">
                <h3>Data controls</h3>
                <p>
                  Clear only this browser’s live workspace. Demo records and
                  remote platforms are unaffected. Export your reviews first.
                </p>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Permanently clear all live brands, scan history, evidence, alerts and reviews in this browser?",
                      )
                    ) {
                      setState(structuredClone(INITIAL));
                      setToast("Local live workspace cleared.");
                      setSelectedId(null);
                    }
                  }}
                >
                  <Trash2 size={15} />
                  Clear live workspace
                </Button>
              </section>
            </div>
          ) : null}
        </main>
        <div className="app-footer">
          <span>WOLVGUARD / TEAM WOLVANT</span>
          <span>
            <span className="dot" />
            Live public data · Local workspace
          </span>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Info size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal === "brand" && (
        <Dialog
          title={editing ? "Edit registered brand" : "Register a public brand"}
          onClose={() => setModal("")}
        >
          <p>
            No account is created. Use a public brand name—not confidential
            company information.
          </p>
          <form onSubmit={saveBrand}>
            <label>
              Brand name
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                defaultValue={editing?.name}
                placeholder="e.g. Notion"
              />
            </label>
            <label>
              Official website (optional)
              <input
                name="website"
                type="url"
                pattern="https://.*"
                defaultValue={editing?.website}
                placeholder="https://yourbrand.com"
              />
            </label>
            <label>
              Brand description (optional)
              <textarea
                name="description"
                maxLength={1000}
                defaultValue={editing?.description}
                placeholder="Used for a local text comparison when provided."
              />
            </label>
            <label>
              Reference logo (PNG, JPEG or WebP · max 2 MB)
              <input
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => chooseLogo(e.target.files?.[0])}
              />
            </label>
            {imageBusy && <p role="status">Computing logo fingerprint…</p>}
            {logoDraft && (
              <div className="logo-reference">
                <img src={logoDraft.preview} alt="Reference logo" />
                <div>
                  <b>Image fingerprint ready</b>
                  <small>dHash-64 + mean RGB · computed, not assumed</small>
                </div>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setLogoDraft(undefined)}
                >
                  Remove logo
                </Button>
              </div>
            )}
            <div className="notice">
              <LockKeyhole size={18} />
              <span>
                Saved only in this browser. Registration does not prove
                ownership or verify any app.
              </span>
            </div>
            <Button type="submit" disabled={imageBusy}>
              Save brand <Check size={15} />
            </Button>
          </form>
        </Dialog>
      )}
      {modal === "scan" && (
        <Dialog title="Scan a live source" onClose={() => setModal("")}>
          <p>
            This sends your public brand name to the selected documented search
            API. Only actual returned listings will be shown.
          </p>
          <form onSubmit={runScan}>
            <label>
              Provider
              <select
                name="provider"
                value={scanProvider}
                onChange={(e) =>
                  setScanProvider(e.target.value as "apple" | "bluesky")
                }
              >
                <option value="apple">Apple App Store</option>
                <option value="bluesky">Bluesky social profiles</option>
              </select>
            </label>
            <label>
              Registered brand
              <select name="brand" required>
                {activeBrands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {scanProvider === "apple"
                ? "App Store region"
                : "Region (Bluesky searches globally)"}
              <select
                name="country"
                defaultValue="us"
                disabled={scanProvider === "bluesky"}
              >
                {Object.entries(regions).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Maximum listings
              <select name="limit" defaultValue="10">
                <option value="5">5 listings</option>
                <option value="10">10 listings</option>
                <option value="25">25 listings</option>
              </select>
            </label>
            <div className="notice">
              <Info size={18} />
              <span>
                Bounded keyword search, not comprehensive platform coverage.
                Repeated searches may use a five-minute cache; the original
                retrieval time is preserved.
              </span>
            </div>
            <Button type="submit" disabled={busy || !activeBrands.length}>
              <ScanLine size={16} />
              {scanProvider === "bluesky"
                ? "Run live Bluesky scan"
                : "Run live Apple scan"}
            </Button>
          </form>
        </Dialog>
      )}
      {modal === "assets" && editing && (
        <Dialog
          title={`${editing.name} · official assets`}
          onClose={() => {
            setModal("");
            setVerification(null);
          }}
          wide
        >
          <p>
            Only an exact provider identifier with explicitly recorded
            verification evidence is excluded. A similar name or a matching
            publisher does not automatically verify an app.
          </p>
          {editing.assets.map((a) => (
            <div className="asset-row" key={a.id}>
              <div>
                <b>{a.name}</b>
                <small>
                  {a.publisher || "Publisher not provided"} ·{" "}
                  {a.provider === "bluesky" ? "Bluesky DID" : "Apple ID"}{" "}
                  {a.sourceId}
                </small>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-button"
                >
                  Open listing <ExternalLink size={12} />
                </a>
                {a.verifiedAt && (
                  <small>
                    Manual evidence recorded {time(a.verifiedAt)}: {a.evidence}
                  </small>
                )}
              </div>
              <Tag tone={a.verifiedAt ? "green" : ""}>
                {a.verifiedAt ? "Manually verified" : "Unverified"}
              </Tag>
              {a.verifiedAt && (
                <button onClick={() => changeAsset(a.id, "revoke")}>
                  Revoke
                </button>
              )}
              <button onClick={() => changeAsset(a.id, "remove")}>
                Remove
              </button>
              {!a.verifiedAt && (
                <button onClick={() => setVerification(a)}>Verify</button>
              )}
            </div>
          ))}
          {verification ? (
            <form onSubmit={verifyAsset}>
              <h3>Verify {verification.name}</h3>
              <label>
                Independent evidence
                <textarea
                  name="evidence"
                  minLength={15}
                  required
                  placeholder="Describe how you verified ownership, such as a link from the official brand website."
                />
              </label>
              <label className="checkbox-label">
                <input name="confirm" type="checkbox" required />I have
                independently checked ownership. This is my manual attestation,
                not automated verification.
              </label>
              <Button type="submit">
                <ShieldCheck size={15} />
                Record verification
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setVerification(null)}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <form onSubmit={addAsset}>
              <h3>Register an official identity</h3>
              <label>
                Asset provider
                <select
                  name="assetProvider"
                  value={assetProvider}
                  onChange={(e) =>
                    setAssetProvider(e.target.value as "apple" | "bluesky")
                  }
                >
                  <option value="apple">Apple App Store</option>
                  <option value="bluesky">Bluesky</option>
                </select>
              </label>
              <label>
                Profile / app name
                <input name="name" required maxLength={200} />
              </label>
              <label>
                Official source URL
                <input
                  name="url"
                  type="url"
                  required
                  placeholder={
                    assetProvider === "apple"
                      ? "https://apps.apple.com/us/app/example/id123456789"
                      : "https://bsky.app/profile/yourbrand.com"
                  }
                />
              </label>
              <label>
                {assetProvider === "apple"
                  ? "Publisher / developer (optional)"
                  : "Handle (resolved from Bluesky automatically)"}
                <input
                  name="publisher"
                  disabled={assetProvider === "bluesky"}
                  maxLength={200}
                  placeholder="Exact registered publisher name"
                />
              </label>
              <Button type="submit" disabled={assetBusy}>
                <Plus size={15} />
                Add unverified asset
              </Button>
            </form>
          )}
        </Dialog>
      )}
      {selected && (
        <Dialog title={selected.name} onClose={() => setSelectedId(null)} wide>
          <div className="live-evidence-header">
            {selected.iconUrl && (
              <img
                className="app-icon"
                src={selected.iconUrl}
                alt="App icon"
                referrerPolicy="no-referrer"
              />
            )}
            <div>
              <Tag tone="green">
                Real {selected.provider === "bluesky" ? "Bluesky" : "Apple"} API
                result
              </Tag>
              <p>
                {selected.publisher || "Publisher metadata unavailable"} ·{" "}
                {selected.metadata.region}
              </p>
            </div>
            <a
              className="btn outline"
              href={selected.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open source <ExternalLink size={14} />
            </a>
          </div>
          <div className="investigation-summary">
            <span className={`big-score ${selected.severity.toLowerCase()}`}>
              {selected.score}
              <small>/ 100</small>
            </span>
            <div>
              <Tag tone={selected.official ? "green" : "amber"}>
                {selected.official
                  ? "Official identity · excluded"
                  : `${selected.severity} risk indicator`}
              </Tag>
              <p>
                {selected.official
                  ? "Excluded by manually verified exact provider identity."
                  : selected.potential
                    ? "Potential match requiring independent review."
                    : "Catalog candidate; below the potential-match filter."}
              </p>
              <small>Not a calibrated probability of fraud.</small>
            </div>
          </div>
          <h3>Source & observation</h3>
          <div className="evidence-grid">
            <div>
              <small>Associated brand</small>
              <b>{state.brands.find((b) => b.id === selected.brandId)?.name}</b>
            </div>
            <div>
              <small>
                {selected.provider === "bluesky"
                  ? "Bluesky DID"
                  : "Apple listing ID"}
              </small>
              <b>{selected.sourceId}</b>
            </div>
            <div>
              <small>Fetched from provider</small>
              <b>{time(selected.fetchedAt)}</b>
            </div>
            <div>
              <small>Last scanned locally</small>
              <b>{time(selected.lastScanAt)}</b>
            </div>
            <div>
              <small>Bundle / version</small>
              <b>
                {selected.metadata.bundleId || "Unavailable"} ·{" "}
                {selected.metadata.version || "Unavailable"}
              </b>
            </div>
            <div>
              <small>Category</small>
              <b>{selected.metadata.genre || "Unavailable"}</b>
            </div>
          </div>
          {selected.imageError && (
            <div className="notice">
              <Info size={17} />
              <span>
                Logo signal unavailable: {selected.imageError}. Other signals
                were still computed.
              </span>
            </div>
          )}
          <h3>Explainable score breakdown</h3>
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
                  : `${Math.round(s.value * 100)}%`}
              </span>
            </div>
          ))}
          <div className="notice">
            <Shield size={19} />
            <span>
              Available signal weights are normalized. Name-only evidence is
              capped at 49 or below the High threshold. Publisher differences
              are evaluated only against manually verified official publishers.
              Logo similarity uses an actual 64-bit image difference hash and
              mean RGB when a reference and source image are available. This is
              not semantic image recognition or an AI fraud verdict.
            </span>
          </div>
          <details className="evidence-description">
            <summary>View provider description</summary>
            <p>
              {selected.description ||
                "Description not provided by the source."}
            </p>
          </details>
          <h3>Official asset comparison</h3>
          {state.brands.find((b) => b.id === selected.brandId)?.assets
            .length ? (
            state.brands
              .find((b) => b.id === selected.brandId)!
              .assets.filter(
                (a) =>
                  (a.provider || "apple") === (selected.provider || "apple"),
              )
              .map((a) => (
                <div className="signal-row" key={a.id}>
                  <div>
                    <b>
                      {a.name} · {a.publisher || "Publisher not specified"}
                    </b>
                    <small>
                      Source ID {a.sourceId} ·{" "}
                      {a.verifiedAt ? "Manually verified" : "Not verified"}
                    </small>
                  </div>
                  <span>
                    {a.sourceId === selected.sourceId
                      ? "Exact ID match"
                      : "Different app ID"}
                  </span>
                </div>
              ))
          ) : (
            <p className="muted">
              No official identities registered. Metadata difference is
              unavailable, not assumed.
            </p>
          )}
          <form onSubmit={saveReview}>
            <label>
              Review status
              <select name="status" defaultValue={selected.status}>
                {statuses.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Investigator note
              <textarea
                name="note"
                required
                maxLength={8000}
                placeholder="Record your evidence, uncertainty, and reasoning…"
              />
            </label>
            <Button type="submit">
              Save local review <Check size={15} />
            </Button>
          </form>
          <h3>Review history</h3>
          {selected.reviews.length ? (
            selected.reviews.map((r) => (
              <div className="review-entry" key={r.id}>
                <b>{r.status}</b>
                <small>Local reviewer (not authenticated) · {time(r.at)}</small>
                <p>{r.note}</p>
                <small>
                  Score at review: {r.scoreAtReview} · Evidence fetched{" "}
                  {time(r.evidenceFetchedAt)}
                </small>
              </div>
            ))
          ) : (
            <p className="muted">
              No reviews yet. No automated accusation or report has been made.
            </p>
          )}
          <Button
            className="evidence-export"
            variant="outline"
            onClick={() =>
              download(
                {
                  dataMode: "live",
                  source:
                    selected.provider === "bluesky"
                      ? "Bluesky public profile search"
                      : "Apple App Store Search",
                  candidate: selected,
                  brand: state.brands.find((b) => b.id === selected.brandId),
                },
                `wolvguard-evidence-${selected.sourceId}.json`,
              )
            }
          >
            <ArrowDownToLine size={15} />
            Export evidence & reviews
          </Button>
        </Dialog>
      )}
      {scan && (
        <Dialog title="Live scan details" onClose={() => setScanDetail(null)}>
          <Tag tone={scan.status === "Completed" ? "green" : "amber"}>
            {scan.status}
          </Tag>
          <h3>
            {scan.brandName} ·{" "}
            {scan.provider === "bluesky"
              ? "Bluesky Global"
              : "Apple App Store · " + scan.country.toUpperCase()}
          </h3>
          <div className="evidence-grid">
            <div>
              <small>Started</small>
              <b>{time(scan.startedAt)}</b>
            </div>
            <div>
              <small>Completed</small>
              <b>{time(scan.completedAt)}</b>
            </div>
            <div>
              <small>Provider retrieval time</small>
              <b>{time(scan.fetchedAt)}</b>
            </div>
            <div>
              <small>Returned / potential / official</small>
              <b>
                {scan.count} / {scan.matches} / {scan.excluded}
              </b>
            </div>
          </div>
          <p>
            {scan.cacheHit
              ? "A cached real provider response was used; the original fetch timestamp is preserved."
              : "No cached response was used for this run."}
          </p>
          {scan.error && (
            <div className="notice" role="alert">
              <TriangleAlert size={18} />
              {scan.error}
            </div>
          )}
          <p>
            Provider:{" "}
            {scan.provider === "bluesky"
              ? "Bluesky public AppView"
              : "Apple public Search API"}
            . Data mode: Live. This record is stored only in your current
            browser.
          </p>
          <Button
            variant="outline"
            onClick={() => download(scan, `wolvguard-scan-${scan.id}.json`)}
          >
            <ArrowDownToLine size={14} />
            Export scan record
          </Button>
        </Dialog>
      )}
    </div>
  );
}
