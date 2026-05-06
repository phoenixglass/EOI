import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { loadConfig, getTenantFromQuery } from "./config/loader";
import type { FacilityConfig } from "./config/schema";
import { formReducer, makeInitialState } from "./state/formState";
import { Header } from "./components/Header";
import { PlanBasics } from "./sections/PlanBasics";
import { ServiceTier } from "./sections/ServiceTier";
import { TierRules } from "./sections/TierRules";
import { EstimateBasis } from "./sections/EstimateBasis";
import { FinancialActivity } from "./sections/FinancialActivity";
import { FinalCheck } from "./sections/FinalCheck";
import { renderSummaries } from "./summary/render";
import { isFieldComplete, type FieldKey } from "./sections/sectionUtils";
import { computeFinancials } from "./calc/calculations";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; config: FacilityConfig }
  | { kind: "error"; errors: string[] };

export function App() {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    loadConfig(getTenantFromQuery()).then((res) => {
      if (res.ok) setLoad({ kind: "ready", config: res.config });
      else setLoad({ kind: "error", errors: res.errors });
    });
  }, []);

  if (load.kind === "loading") {
    return <div className="app">Loading…</div>;
  }
  if (load.kind === "error") {
    return <ErrorScreen errors={load.errors} />;
  }
  return <Configured config={load.config} />;
}

function ErrorScreen({ errors }: { errors: string[] }) {
  return (
    <div className="error-screen">
      <h2>Configuration error</h2>
      <p>The facility config failed to load or validate. First issues:</p>
      <ul>
        {errors.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}

function Configured({ config }: { config: FacilityConfig }) {
  const initial = useMemo(() => makeInitialState(config), [config]);
  const [state, dispatch] = useReducer(formReducer, initial);
  const [output, setOutput] = useState<{
    staff: string;
    patient: string;
  } | null>(null);
  const [tab, setTab] = useState<"staff" | "patient">("patient");
  const [toast, setToast] = useState<string | null>(null);

  // Apply theme colors.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary", config.branding.primaryColor);
    root.style.setProperty("--accent", config.branding.accentColor);
    document.title = `${config.branding.facilityName} — Care Snapshot`;
  }, [config]);

  // Idle auto-clear.
  const lastActivity = useRef<number>(Date.now());
  useEffect(() => {
    const minutes = config.behavior.idleClearMinutes;
    if (!minutes || minutes <= 0) return;
    const ms = minutes * 60 * 1000;
    const bump = () => {
      lastActivity.current = Date.now();
    };
    window.addEventListener("keydown", bump);
    window.addEventListener("mousedown", bump);
    window.addEventListener("touchstart", bump);
    const id = window.setInterval(() => {
      if (Date.now() - lastActivity.current >= ms) {
        dispatch({ type: "reset", initial });
        setOutput(null);
        setToast(`Form cleared after ${minutes} minutes of inactivity.`);
        lastActivity.current = Date.now();
      }
    }, 30_000);
    return () => {
      window.removeEventListener("keydown", bump);
      window.removeEventListener("mousedown", bump);
      window.removeEventListener("touchstart", bump);
      window.clearInterval(id);
    };
  }, [config, initial]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const sections = config.sections;

  const requiredKeys: FieldKey[] = (
    Object.keys(config.fields) as FieldKey[]
  ).filter((k) => config.fields[k].enabled && config.fields[k].required);
  const requiredKeysFilled = requiredKeys.every((k) => isFieldComplete(state, k));
  const requiredChecks = config.finalCheck
    .filter((c) => c.required)
    .every((c) => state.finalCheck[c.id]);
  const canGenerate = requiredKeysFilled && requiredChecks;

  const financials = computeFinancials(state);

  const handleClear = () => {
    dispatch({ type: "reset", initial });
    setOutput(null);
    setToast("Form cleared.");
  };

  const handleGenerate = () => {
    const out = renderSummaries(config, state);
    setOutput({ staff: out.staff, patient: out.patient });
  };

  return (
    <div className="app">
      <Header branding={config.branding} onClear={handleClear} />

      {config.behavior.draftAutosave && (
        <div className="warning-banner">
          Draft autosave is on. Form values are stored in this browser&apos;s
          localStorage. Clear before walking away.
        </div>
      )}

      {financials.crossTierWarning && (
        <div className="banner">
          Heads up: the verified tier from the payer differs from the current
          tier on file. Review before generating the snapshot.
        </div>
      )}

      {sections.planBasics.enabled && (
        <PlanBasics config={config} state={state} dispatch={dispatch} />
      )}
      {sections.serviceTier.enabled && (
        <ServiceTier config={config} state={state} dispatch={dispatch} />
      )}
      {sections.tierRules.enabled && (
        <TierRules config={config} state={state} dispatch={dispatch} />
      )}
      {sections.estimateBasis.enabled && (
        <EstimateBasis config={config} state={state} dispatch={dispatch} />
      )}
      {sections.financialActivity.enabled && (
        <FinancialActivity config={config} state={state} dispatch={dispatch} />
      )}
      {sections.finalCheck.enabled && (
        <FinalCheck config={config} state={state} dispatch={dispatch} />
      )}

      <div className="footer-bar">
        <button
          className="primary"
          disabled={!canGenerate}
          onClick={handleGenerate}
        >
          Generate Snapshot
        </button>
      </div>

      {output && (
        <SummaryView
          output={output}
          tab={tab}
          setTab={setTab}
          config={config}
          onCopied={() => setToast("Copied to clipboard.")}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

interface SummaryProps {
  output: { staff: string; patient: string };
  tab: "staff" | "patient";
  setTab: (t: "staff" | "patient") => void;
  config: FacilityConfig;
  onCopied: () => void;
}

function SummaryView({ output, tab, setTab, config, onCopied }: SummaryProps) {
  const text = tab === "staff" ? output.staff : output.patient;
  const patientLabel = labelForPatientTab(config);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      onCopied();
    } catch {
      // ignore
    }
  };
  const handlePrint = () => window.print();

  return (
    <div className="summary-output">
      <div className="tabs">
        <button
          className={tab === "staff" ? "active" : ""}
          onClick={() => setTab("staff")}
        >
          Staff
        </button>
        <button
          className={tab === "patient" ? "active" : ""}
          onClick={() => setTab("patient")}
        >
          {patientLabel}
        </button>
      </div>
      <div className="actions">
        {config.behavior.showCopyButton && (
          <button onClick={handleCopy}>Copy</button>
        )}
        {config.behavior.showPrintButton && (
          <button onClick={handlePrint}>Print</button>
        )}
      </div>
      <pre>{text}</pre>
    </div>
  );
}

function labelForPatientTab(config: FacilityConfig): string {
  const noun = config.vocabulary.patientNoun;
  return noun.charAt(0).toUpperCase() + noun.slice(1);
}

