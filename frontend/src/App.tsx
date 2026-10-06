import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  Database,
  Download,
  Droplets,
  Factory,
  FlaskConical,
  GitBranch,
  Home,
  Info,
  Landmark,
  Layers3,
  Leaf,
  MapPin,
  Maximize2,
  Minimize2,
  Moon,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Waves,
  X,
} from "lucide-react";
import {
  baseline,
  municipalities,
  sectorColors,
  sectorNames,
  simulate,
  simulateMunicipality,
  type Inputs,
  type Scenario,
} from "./engine/simulation";
import { FlowDiagram, SamarMap, SectionHeading } from "./Visuals";
import Reservoir from "./Reservoir";
import CityMaquette from "./CityMaquette";
import DevelopmentPlanner from "./DevelopmentPlanner";
import { validDevelopment, type Development } from "./engine/developments";
const pilots = municipalities.filter((m) => m.activeInSimulation);
type ExploreLayout = "split" | "map-expanded" | "planning-expanded";
const number = (v: number) =>
  v.toLocaleString("en-US", { maximumFractionDigits: 1 });
const coverageColor = (coverage: number, sectorColor: string) =>
  coverage >= .999 ? sectorColor : coverage >= .5 ? "#e2b13c" : "#d95757";
const wedgePath = (cx: number, cy: number, inner: number, outer: number, start: number, end: number) => {
  const point = (radius: number, angle: number) => {
    const radians = (angle - 90) * Math.PI / 180;
    return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
  };
  const [outerStartX, outerStartY] = point(outer, start);
  const [outerEndX, outerEndY] = point(outer, end);
  const [innerEndX, innerEndY] = point(inner, end);
  const [innerStartX, innerStartY] = point(inner, start);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${outerStartX} ${outerStartY} A ${outer} ${outer} 0 ${largeArc} 1 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${inner} ${inner} 0 ${largeArc} 0 ${innerStartX} ${innerStartY} Z`;
};
const money = (v: number) => "₱" + number(v);
const percentChange = (value: number, reference: number) => {
  if (reference <= 0) return value <= 0 ? "0% vs baseline" : "New vs baseline";
  const change = Math.round(((value - reference) / reference) * 100);
  return `${change > 0 ? "+" : ""}${change}% vs baseline`;
};
const baselineScenario = baseline();
const droughtScenario = baseline("drought", "Drought response");
droughtScenario.inputs.pinabacdao.drought = 40;
function readSaved(): Scenario[] {
  try {
    const raw = JSON.parse(
      localStorage.getItem("water-economics-scenarios-v1") || "[]",
    );
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (s) =>
        typeof s.id === "string" &&
        typeof s.name === "string" &&
        pilots.every((m) => {
          const p = s.inputs?.[m.id];
          return (
            p &&
            Object.values(p).every(
              (v) =>
                typeof v === "boolean" ||
                (typeof v === "number" && Number.isFinite(v) && v >= 0) ||
                (Array.isArray(v) &&
                  v.every(
                    (n) =>
                      typeof n === "number" && Number.isFinite(n) && n >= 0,
                  )),
            ) &&
            p.income > 0 &&
            p.drought <= 100 &&
            p.allocation <= 100 &&
            p.sourceOutputs.length === m.sources.length &&
            p.sectorDemand.length === 4 &&
            (!p.allocationShares || p.allocationShares.length === 4)
          );
        }),
    ).map((s) => ({...s, inputs: Object.fromEntries(pilots.map((m) => [m.id, {...s.inputs[m.id], nrw: s.inputs[m.id].nrw ?? 28, reserve: s.inputs[m.id].reserve ?? 22, allocationShares: s.inputs[m.id].allocationShares || [25,25,25,25]}])), developments:Array.isArray(s.developments)?s.developments.filter(validDevelopment):[]}));
  } catch {
    return [];
  }
}
function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "%",
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="slider-control">
      <span>
        {label}
        <strong>
          {number(value)}
          {unit}
        </strong>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        style={
          {
            "--range": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
      />
    </label>
  );
}
function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <button
      className="toggle-row"
      role="switch"
      aria-checked={value}
      onClick={onChange}
    >
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className={`toggle ${value ? "on" : ""}`}>
        <i />
      </span>
    </button>
  );
}
export default function App() {
  const [page, setPage] = useState("Simulation"),
    [appearance, setAppearance] = useState<"day" | "night">(() => {
      try { return localStorage.getItem("water-economics-appearance-v1") === "night" ? "night" : "day"; }
      catch { return "day"; }
    }),
    [scope, setScope] = useState("combined"),
    [scenarios, setScenarios] = useState<Scenario[]>(() => [
      baselineScenario,
      droughtScenario,
      ...readSaved().filter((s) => !["baseline", "drought"].includes(s.id)),
    ]),
    [scenarioId, setScenarioId] = useState("baseline"),
    [controlTab, setControlTab] = useState("Sources"),
    [view, setView] = useState("Reservoir"),
    [reservoirDetailsOpen, setReservoirDetailsOpen] = useState(false),
    [sector, setSector] = useState(0),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState(false),
    [scenarioName, setScenarioName] = useState(""),
    [compareMode, setCompareMode] = useState("Scenarios"),
    [controlsOpen, setControlsOpen] = useState(false),
    [impactOpen, setImpactOpen] = useState(false),
    [sectorDetailOpen, setSectorDetailOpen] = useState(false),
    [expandedSpatialSector, setExpandedSpatialSector] = useState<string | null>(null),
    [hoverSpatialSector, setHoverSpatialSector] = useState<string | null>(null),
    [exploreLayout, setExploreLayout] = useState<ExploreLayout>("split"),
    [waterBalanceOpen, setWaterBalanceOpen] = useState(false),
    [nrwSimulatorOpen, setNrwSimulatorOpen] = useState(false),
    [plannerOpen, setPlannerOpen] = useState(false),
    [plannerSelectedId, setPlannerSelectedId] = useState<string | null>(null),
    [daloyOpen, setDaloyOpen] = useState(false),
    [daloyQuestion, setDaloyQuestion] = useState("");
  const closePlanner=useCallback(()=>setPlannerOpen(false),[]);
  useEffect(() => {
    document.body.dataset.appearance = appearance;
    try { localStorage.setItem("water-economics-appearance-v1", appearance); } catch { /* Appearance still applies for this session. */ }
  }, [appearance]);
  const handleDamDetailsToggle = () => {
    if (!controlsOpen && !impactOpen && !reservoirDetailsOpen) {
      setControlsOpen(true);
      setImpactOpen(true);
      setReservoirDetailsOpen(true);
      return;
    }
    setReservoirDetailsOpen((open) => !open);
  };
  const scenario = scenarios.find((s) => s.id === scenarioId) || scenarios[0];
  const result = useMemo(() => simulate(scenario, scope), [scenario, scope]);
  const baselineResult = useMemo(() => simulate(baselineScenario, scope), [scope]);
  const selected = pilots.filter((m) => scope === "combined" || m.id === scope),
    p = scenario.inputs[selected[0].id];
  const scopeName = scope === "combined" ? "Combined MVP" : selected[0].name;
  const protectedReserveVolume = result.results.reduce((total, item) => total + item.reserveVolume, 0);
  const availableStorageBuffer = result.results.reduce((total, item) => total + Math.max(0, item.ending - item.reserveVolume), 0);
  const blendedNrw = result.supply > 0 ? result.results.reduce((total, item) => total + item.supply * item.nrw, 0) / result.supply : 0;
  const storageCoverDays = result.gap > 0 ? availableStorageBuffer / (result.gap / Math.max(.2, 1 - blendedNrw)) : 0;
  const currentSectorShortfalls = sectorNames.map((name, index) => ({name, unmet: Math.max(0, result.demands[index] - result.allocations[index])})).sort((a,b) => b.unmet - a.unmet);
  const allocationShareTotal = p.allocationShares.reduce((sum, share) => sum + share, 0);
  const setAllocationShare = (index: number, requested: number) => {
    const value = Math.max(0, Math.min(100, requested));
    const remaining = 100 - value;
    const otherIndices = [0, 1, 2, 3].filter((item) => item !== index);
    const previousTotal = otherIndices.reduce((sum, item) => sum + p.allocationShares[item], 0);
    const shares = [...p.allocationShares] as Inputs["allocationShares"];
    let assigned = 0;
    otherIndices.forEach((item, position) => {
      const next = position === otherIndices.length - 1 ? remaining - assigned : Math.round(remaining * (previousTotal ? p.allocationShares[item] / previousTotal : 1 / otherIndices.length));
      shares[item] = next;
      assigned += next;
    });
    shares[index] = value;
    update({ allocationShares: shares });
  };
  const spatialMunicipality = scope === "combined" ? pilots[2] : selected[0];
  const spatialResult = simulate(scenario, spatialMunicipality.id);
  const spatialStorage = spatialResult.results[0];
  const spatialDevelopments = (scenario.developments || []).filter(item=>item.municipalityId===spatialMunicipality.id);
  const spatialInput = scenario.inputs[spatialMunicipality.id];
  const nrwBaseline = baselineScenario.inputs[spatialMunicipality.id].nrw;
  const spatialAtBaselineNrw = simulateMunicipality(spatialMunicipality, {...spatialInput, nrw: nrwBaseline}, spatialDevelopments);
  const grossForNiw = spatialResult.supply + spatialMunicipality.opening;
  const baselineSourceLoss = grossForNiw * nrwBaseline / 100;
  const scenarioSourceLoss = grossForNiw * spatialInput.nrw / 100;
  const sourceLossRecovered = baselineSourceLoss - scenarioSourceLoss;
  const nrwAllocableGain = spatialResult.allocable - spatialAtBaselineNrw.allocable;
  const nrwAllocationGain = spatialResult.allocation - spatialAtBaselineNrw.allocation;
  const nrwPercentagePointChange = nrwBaseline - spatialInput.nrw;
  const nrwValueEstimate = Math.max(0, nrwAllocationGain) * 1000 * spatialInput.price;
  const spatialStorageUsed = Math.max(0, spatialResult.allocation - spatialResult.supply);
  const spatialCoverage = spatialResult.demand > 0 ? spatialResult.allocation / spatialResult.demand : 0;
  const baselineDemand = spatialMunicipality.demand.reduce((total, value) => total + value, 0);
  const waterStress = spatialResult.shortage <= .05 ? "Low" : spatialResult.shortage / Math.max(.1, spatialResult.demand) >= .2 ? "High" : "Moderate";
  const affordability = spatialResult.burden <= 3 ? "Low" : spatialResult.burden <= 5 ? "Moderate" : "High";
  const profileStats = [
    ["Modeled households", number(spatialResult.households), spatialResult.households === spatialMunicipality.households ? "DEMO INPUT" : "INCLUDES PLACED HOMES"],
    ["Baseline demand", `${number(baselineDemand)} ML/day`, "ESTIMATED"],
    ["Supply capacity", `${number(spatialResult.supply)} ML/day`, "SIMULATED · GROSS"],
    ["Allocable water", `${number(spatialResult.allocable)} ML/day`, "AFTER LOSSES & RESERVE"],
    ["Unmet demand", `${number(spatialResult.shortage)} ML/day`, "LIVE SIMULATION"],
  ] as const;
  const facilityInventory = [
    ["Households / service connections", `${number(spatialMunicipality.households)}`, "DEMO INPUT"],
    ["Schools", "Not configured", "DATA NEEDED"],
    ["Hospitals / clinics", "Not configured", "DATA NEEDED"],
    ["Government facilities", "Not configured", "DATA NEEDED"],
    ["Commercial establishments", "Not configured", "DATA NEEDED"],
    ["Agriculture / fisheries sites", "Not configured", "DATA NEEDED"],
    ["Other public services", "Not configured", "DATA NEEDED"],
  ] as const;
  const spatialDemands = sectorNames.map((name, i) => ({
    name,
    value: spatialResult.demands[i],
    allocation: spatialResult.allocations[i],
    coverage: spatialResult.coverage[i],
    color: sectorColors[i],
    icon: [Home, Leaf, Factory, Landmark][i],
  }));
  const balanceDemandMax = Math.max(1, ...spatialDemands.map((item) => item.value));
  const bubbleDomain = Math.max(1, ...spatialDemands.map((item) => item.value), ...spatialDemands.map((item) => item.allocation));
  const bubblePlot = { left: 54, top: 30, right: 354, bottom: 205 };
  const bubblePoints = spatialDemands.map((item) => ({
    ...item,
    x: bubblePlot.left + item.value / bubbleDomain * (bubblePlot.right - bubblePlot.left),
    y: bubblePlot.bottom - item.allocation / bubbleDomain * (bubblePlot.bottom - bubblePlot.top),
    radius: 6 + Math.sqrt(item.value / balanceDemandMax) * 13,
  }));
  const spatialSectorDetails: Record<string, { summary: string; facts: Array<[string, string]> }> = Object.fromEntries(spatialDemands.map((item) => [item.name, {
    summary: `${item.name} in the illustrative ${spatialMunicipality.name} model. The 3D buildings use the current allocation result.`,
    facts: [
      ...(item.name === "Households" ? [["Modeled households", number(spatialResult.households)] as [string, string]] : []),
      ["Estimated demand", `${number(item.value)} ML/day`],
      ["Water allocated", `${number(item.allocation)} ML/day`],
      ["Demand unmet", `${number(Math.max(0, item.value - item.allocation))} ML/day`],
      ["Demand covered", `${Math.round(item.coverage * 100)}%`],
    ],
  }])) as Record<string, { summary: string; facts: Array<[string, string]> }>;
  const expandedSpatialDemand = spatialDemands.find((item) => item.name === expandedSpatialSector);
  const unmetSectors = spatialDemands.map((item) => ({...item, unmet: Math.max(0, item.value - item.allocation)})).filter((item) => item.unmet > .05).sort((a,b) => b.unmet - a.unmet);
  const largestUnmet = unmetSectors[0];
  const daloyQuestions = ["Where is the imbalance?", "Who has unmet demand?", "What is causing the shortage?", "What should I test next?"];
  const selectDaloyQuestion = (question: string) => {
    setDaloyQuestion(question);
    if (question === daloyQuestions[0]) return;
    const focus = largestUnmet;
    if (focus) {
      setExpandedSpatialSector(focus.name);
      setHoverSpatialSector(focus.name);
      setExploreLayout("map-expanded");
      setWaterBalanceOpen(true);
    }
  };
  const focusedSpatialSector = hoverSpatialSector || expandedSpatialSector;
  const mixed = (key: keyof Inputs) =>
    selected.some(
      (m) =>
        JSON.stringify(scenario.inputs[m.id][key]) !== JSON.stringify(p[key]),
    );
  const update = (patch: Partial<Inputs>) =>
    setScenarios((list) =>
      list.map((s) =>
        s.id === scenario.id
          ? {
              ...s,
              inputs: {
                ...s.inputs,
                ...Object.fromEntries(
                  selected.map((m) => [m.id, { ...s.inputs[m.id], ...patch }]),
                ),
              },
            }
          : s,
      ),
    );
  const updateMunicipal = (id: string, patch: Partial<Inputs>) =>
    setScenarios((list) =>
      list.map((s) =>
        s.id === scenario.id
          ? {
              ...s,
              inputs: { ...s.inputs, [id]: { ...s.inputs[id], ...patch } },
            }
          : s,
      ),
    );
  const updateDevelopments = (next:Development[])=>setScenarios(list=>list.map(item=>item.id===scenario.id?{...item,developments:[...(item.developments || []).filter(development=>development.municipalityId!==spatialMunicipality.id),...next]}:item));
  const inform = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4000);
  };
  const reset = () => {
    setScenarios((list) =>
      list.map((s) => (s.id === scenario.id ? baseline(s.id, s.name) : s)),
    );
    inform("Current scenario reset to demonstration baseline.");
  };
  const saveScenario = () => {
    if (!scenarioName.trim()) return;
    const s = structuredClone(scenario);
    s.id = crypto.randomUUID();
    s.name = scenarioName.trim();
    const list = [...scenarios, s];
    setScenarios(list);
    setScenarioId(s.id);
    try {
      localStorage.setItem(
        "water-economics-scenarios-v1",
        JSON.stringify(
          list.filter((x) => !["baseline", "drought"].includes(x.id)),
        ),
      );
      inform("Scenario saved on this device.");
    } catch {
      inform(
        "Scenario created for this session. Device storage is unavailable.",
      );
    }
    setModal(false);
  };
  const exportData = () => {
    const rows = [
      [
        "Municipality",
        "Supply ML/day",
        "Demand ML/day",
        "Development demand ML/day",
        "Allocation ML/day",
        "Allocable water ML/day",
        "NRW % (demo assumption)",
        "Protected reserve % (demo assumption)",
        "Closing storage ML",
        "Unmet demand ML/day",
        "Household coverage %",
        "Affordability burden %",
      ],
      ...result.results.map((r) => [
        r.name,
        r.supply,
        r.demand,
        r.developmentDemand,
        r.allocation,
        r.allocable,
        r.nrw * 100,
        r.reserve * 100,
        r.ending,
        r.shortage,
        r.coverage[0] * 100,
        r.burden,
      ]),
    ];
    const blob = new Blob(
      [
        "Demonstration data - not official LGU statistics\n" +
          rows.map((r) => r.join(",")).join("\n"),
      ],
      { type: "text/csv" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DULOY-${scope}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    inform("Simulation results exported.");
  };
  const openSave = () => {
    setScenarioName(`${scenario.name} copy`);
    setModal(true);
  };
  return (
    <div className="app" data-theme={appearance}>
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Simulation");
          }}
        >
          <span className="brand-icon">
            <Droplets size={25} />
          </span>
          <span>
            DULOY
            <small>Samar Water Decision System</small>
          </span>
        </a>
        <div className="header-end">
          <a className="button secondary" href="./gis.html" aria-label="Open GIS map and shared barangay data">
            <MapPin size={15} />
            <span>GIS &amp; data</span>
          </a>
          <button
            className="appearance-toggle"
            type="button"
            aria-label={appearance === "day" ? "Switch to night mode with the background image" : "Switch to plain day mode"}
            aria-pressed={appearance === "night"}
            title={appearance === "day" ? "Switch to night mode" : "Switch to day mode"}
            onClick={() => setAppearance((mode) => mode === "day" ? "night" : "day")}
          >
            {appearance === "day" ? <Moon size={16}/> : <Sun size={16}/>}
            <span>{appearance === "day" ? "Night" : "Day"}</span>
          </button>
          <button
            className="icon-button"
            aria-label="View methodology and help"
            onClick={() => setPage("Methodology")}
          >
            <CircleHelp size={19} />
          </button>
          <span className="avatar" title="Local planning workspace">
            LG
          </span>
        </div>
      </header>
      <main className={page === "Simulation" ? "simulation-main" : ""}>
        <div className="page-heading">
          <div>
            <div className="breadcrumb">
              Samar Province <span>/</span> Planning workspace
            </div>
            <h1>
              {page === "Simulation"
                ? "Every drop. Every decision."
                  : page === "Scenarios"
                    ? "Explore the trade-offs."
                    : page === "Data"
                      ? "The inputs behind the water."
                      : "A transparent water model."}
            </h1>
            <p>
              {page === "Simulation"
                ? "Explore how water moves, who it reaches, and what changes when you act."
                : page === "Scenarios"
                  ? "Compare policies and water conditions before making a decision."
                    : page === "Data"
                      ? "Edit demonstration assumptions. Every change flows through the simulation."
                      : "Understand the assumptions, calculations, and limits of this demonstration."}
            </p>
          </div>
          {page !== "Simulation" && <div className="heading-actions">
            <button className="button secondary" onClick={reset}>
              <RotateCcw size={15} />
              Reset
            </button>
            <button className="button primary" onClick={openSave}>
              <Plus size={16} />
              Save scenario
            </button>
          </div>}
        </div>
        <div className="scopebar">
          <div className="context-cluster">
            <div className="scope-tabs" aria-label="Municipality scope">
              {[{ id: "combined", name: "Combined MVP" }, ...pilots].map((m) => (
                <button
                  key={m.id}
                  className={scope === m.id ? "selected" : ""}
                  onClick={() => { setScope(m.id); setReservoirDetailsOpen(false); }}
                >
                  {m.id === "combined" && <Layers3 size={15} />} {m.name}
                </button>
              ))}
            </div>
            {page === "Simulation" && <div className="simulation-view-tabs" role="tablist" aria-label="Simulation view">
              {["Reservoir", "Water flows"].map((item) => <button key={item} role="tab" aria-selected={view === item} className={view === item ? "active" : ""} onClick={() => { setView(item); setReservoirDetailsOpen(false); }}>
                {item === "Water flows" ? <GitBranch size={14}/> : <Layers3 size={14}/>}
                {item}
              </button>)}
            </div>}
          </div>
          <div className="context-cluster context-end">
            <div className="scenario-select">
              <GitBranch size={15} />
              <label htmlFor="scenario">Scenario</label>
              <select
                id="scenario"
                value={scenarioId}
                onChange={(e) => setScenarioId(e.target.value)}
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            {page === "Simulation" && <div className="context-actions">
              <button className="context-reset" onClick={reset} aria-label="Reset simulation" title="Reset simulation"><RotateCcw size={15}/></button>
              <button className="context-save" onClick={openSave}><Save size={15}/>Save</button>
            </div>}
          </div>
        </div>
        {page === "Simulation" && (
          <>
            <div className={`workspace ${controlsOpen ? "controls-open" : "controls-closed"} ${impactOpen ? "impact-open" : "impact-closed"}`}>
              <aside className={`control-panel ${controlsOpen ? "" : "collapsed"}`}>
                <div className="panel-heading">
                  <h2>{controlsOpen ? "Adjust the simulation" : "Adjust water"}</h2>
                  <button
                    className="panel-collapse"
                    onClick={() => setControlsOpen((open) => !open)}
                    aria-label={controlsOpen ? "Collapse simulation controls" : "Expand simulation controls"}
                  >
                    {controlsOpen ? <ChevronLeft size={17} /> : <SlidersHorizontal size={17} />}
                  </button>
                </div>
                <div className="control-tabs">
                  {[["Sources", "Sources"], ["Allocation", "Demand"], ["Equity", "Policies"]].map(([t, label]) => (
                    <button
                      key={t}
                      className={controlTab === t ? "selected" : ""}
                      onClick={() => setControlTab(t)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="controls-body">
                  <div className="scope-note">
                    <MapPin size={13} />
                    {scope === "combined"
                      ? "Applies to all 3 pilot LGUs"
                      : scopeName}
                  </div>
                  {controlTab === "Sources" && (
                    <>
                      <div className="control-section">
                        <div className="mini-heading">
                          <Waves size={16} />
                          <h3>Water supply</h3>
                          <span className="tag">Live</span>
                        </div>
                        <Slider
                          label="Source output"
                          value={p.supply}
                          max={150}
                          onChange={(v) => update({ supply: v })}
                        />
                        <div className="range-labels">
                          <span>0%</span>
                          <span>Normal</span>
                          <span>150%</span>
                        </div>
                        <p className="help-text source-intro">Set total output first. Open a utility only when you need to adjust an individual source.</p>
                        {selected.map((m) => (
                          <details className="source-group" key={m.id}>
                            <summary className="source-provider">
                              <span><Factory size={13} /><span className="source-provider-copy"><b>{m.name.toUpperCase()}</b><small>{m.provider}</small></span></span>
                              <strong>{number(scenario.inputs[m.id].sourceOutputs.reduce((sum, output) => sum + output, 0))} ML/d</strong>
                              <ChevronRight size={14}/>
                            </summary>
                            <div className="source-breakdown">
                            {m.sources.map((source, i) => (
                              <label className="source-row" key={source.name}>
                                <span>
                                  <i />
                                  <span>
                                    {source.name}
                                    <small>{source.type}</small>
                                  </span>
                                </span>
                                <input
                                  type="number"
                                  aria-label={`${m.name} ${source.name} output`}
                                  min="0"
                                  max="100"
                                  step="1"
                                  value={scenario.inputs[m.id].sourceOutputs[i]}
                                  onChange={(e) => {
                                    const outputs = [
                                      ...scenario.inputs[m.id].sourceOutputs,
                                    ];
                                    outputs[i] = Math.min(
                                      100,
                                      Math.max(0, +e.target.value),
                                    );
                                    updateMunicipal(m.id, {
                                      sourceOutputs: outputs,
                                    });
                                  }}
                                />
                                <small>ML/d</small>
                              </label>
                            ))}
                            </div>
                          </details>
                        ))}
                      </div>
                      <div className="control-section">
                        <div className="mini-heading">
                          <Sun size={17} />
                          <h3>Drought conditions</h3>
                        </div>
                        <div className="drought-presets">
                          {[
                            ["Normal", 0],
                            ["Moderate", 20],
                            ["Severe", 40],
                          ].map(([name, v]) => (
                            <button
                              key={name}
                              className={
                                !mixed("drought") && p.drought === v
                                  ? "selected"
                                  : ""
                              }
                              onClick={() => update({ drought: v as number })}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                        <Slider
                          label={
                            mixed("drought")
                              ? "Supply reduction (mixed)"
                              : "Supply reduction"
                          }
                          value={p.drought}
                          max={100}
                          onChange={(v) => update({ drought: v })}
                        />
                        <p className="help-text">
                          Reduces source inflow; stored water can cover part of
                          the shortfall.
                        </p>
                      </div>
                      <div className="control-section">
                        <div className="mini-heading"><Droplets size={16}/><h3>Distribution losses &amp; reserve</h3></div>
                        <Slider label="Non-revenue water (demo assumption)" value={p.nrw} max={80} unit="%" onChange={(v) => update({nrw:v})}/>
                        <Slider label="Protected storage reserve" value={p.reserve} max={90} unit="% of capacity" onChange={(v) => update({reserve:v})}/>
                        <p className="help-text">Losses reduce water delivered. Protected reserve stays in storage before water is allocated. Both start as illustrative 28% / 22% assumptions.</p>
                      </div>
                    </>
                  )}
                  {controlTab === "Allocation" && (
                    <>
                      <div className="control-section">
                        <div className="mini-heading">
                          <Home size={16} />
                          <h3>Water allocation simulator</h3>
                        </div>
                        <Slider
                          label="Demand multiplier"
                          value={p.demand}
                          min={50}
                          max={150}
                          onChange={(v) => update({ demand: v })}
                        />
                        <Slider
                          label="Allocation target"
                          value={p.allocation}
                          onChange={(v) => update({ allocation: v })}
                        />
                        <p className="help-text">
                          Allocation is a percentage of demand, capped by
                          available water.
                        </p>
                      </div>
                      {sectorNames.map((name, i) => (
                        <div className="control-section compact" key={name}>
                          <div className="mini-heading">
                            <i
                              className="dot"
                              style={{ background: sectorColors[i] }}
                            />
                            <h3>{name}</h3>
                            <span>{number(result.demands[i])} ML/d</span>
                          </div>
                          <Slider
                            label={`${name} channel`}
                            value={p.allocationShares[i]}
                            unit="%"
                            onChange={(v) => setAllocationShare(i, v)}
                          />
                        </div>
                      ))}
                      <div className="control-section allocation-outcome">
                        <div className="mini-heading"><BarChart3 size={16} /><h3>Live allocation outcome</h3></div>
                        <p>{mixed("allocationShares") ? "Channel settings vary by LGU." : "Increasing one channel automatically rebalances the other three. Water unused by a fully met channel flows to channels still needing water."}</p>
                        <div><span>Channel plan</span><strong>{number(allocationShareTotal)} <small>%</small></strong></div>
                        <div><span>Available for distribution</span><strong>{number(result.allocable)} <small>ML/day</small></strong></div>
                      </div>
                    </>
                  )}
                  {controlTab === "Equity" && (
                    <>
                      <div className="control-section">
                        <div className="mini-heading">
                          <Landmark size={16} />
                          <h3>Policies &amp; affordability</h3>
                        </div>
                        <Toggle
                          label="Protect essential needs"
                          description="Reserve 80% of household demand and all critical-service demand, as water permits."
                          value={p.protect}
                          onChange={() => update({ protect: !p.protect })}
                        />
                        <Toggle
                          label="Supplementary supply"
                          description="Add 5 ML/day to each selected LGU. Configurable demo partnership."
                          value={p.supplementary}
                          onChange={() => update({ supplementary: !p.supplementary })}
                        />
                        <Slider
                          label="Service price"
                          value={p.price}
                          min={0}
                          max={100}
                          unit=" ₱/m³"
                          onChange={(v) => update({ price: v })}
                        />
                        <Slider
                          label="Monthly household income"
                          value={p.income}
                          min={5000}
                          max={50000}
                          step={1000}
                          unit=" ₱"
                          onChange={(v) => update({ income: v })}
                        />
                        <Slider
                          label="Monthly assistance budget"
                          value={p.budget}
                          max={2000000}
                          step={50000}
                          unit=" ₱"
                          onChange={(v) => update({ budget: v })}
                        />
                        <p className="help-text">
                          ₱300 per assisted household, capped by the budget and
                          household count.
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <div className="panel-footer">
                  <Info size={14} />
                  <span>Illustrative inputs. Changes update instantly.</span>
                </div>
              </aside>
              <section className="simulation-panel">
                <div className="model-heading">
                  <div>
                    <span className="status-dot" />{" "}
                    <h2>{scopeName} water system</h2>
                    <span className="subtle-badge">1-day simulation</span>
                  </div>
                </div>
                <div className="model-stage">
                  {view === "Reservoir" ? (
                    <>
                      <Suspense
                        fallback={
                          <div className="loading-model">
                            <Waves />
                            Preparing water model…
                          </div>
                        }
                      >
                        <Reservoir
                          level={result.ending / result.capacity}
                          protectedLevel={result.capacity > 0 ? protectedReserveVolume / result.capacity : 0}
                          paused={false}
                          reset={0}
                          showDetails={reservoirDetailsOpen}
                          onToggleDetails={handleDamDetailsToggle}
                        />
                      </Suspense>
                      {reservoirDetailsOpen && <>
                        <div className="metrics-ribbon details-pop">
                          <div>
                            <span><ArrowDownRight size={13} /> Source inflow</span>
                            <strong>{number(result.supply)}<small>ML/day</small></strong>
                            <em>{percentChange(result.supply, baselineResult.supply)}</em>
                          </div>
                          <div>
                            <span><ArrowUpRight size={13} /> Water demand</span>
                            <strong>{number(result.demand)}<small>ML/day</small></strong>
                            <em>{percentChange(result.demand, baselineResult.demand)}</em>
                          </div>
                          <div className="amber">
                            <span><Activity size={13} /> Inflow deficit</span>
                            <strong>{number(result.gap)}<small>ML/day</small></strong>
                            <em>{result.demand > 0 ? `${number(result.gap / result.demand * 100)}% of demand` : "No demand"}</em>
                          </div>
                          <div className="storage-metric">
                            <span><Droplets size={13} /> Closing storage</span>
                            <strong>{number(result.ending)}<small> / {number(result.capacity)} ML</small></strong>
                            <i><b style={{ width: `${Math.max(0, Math.min(100, (result.ending / result.capacity) * 100))}%` }} /></i>
                            <em>{Math.round((result.ending / result.capacity) * 100)}% full · {number(Math.max(0, result.ending - protectedReserveVolume))} ML above reserve</em>
                          </div>
                        </div>
                        <div className={`balance-message details-pop ${result.shortage > 0 ? "warning" : ""}`}>
                          <Info size={16} />
                          <p>
                            {result.shortage > 0 ? (
                              <><strong>{number(result.shortage)} ML/day of demand is unmet.</strong>{" "}{currentSectorShortfalls[0]?.unmet > .05 ? `${currentSectorShortfalls[0].name} has the largest shortfall at ${number(currentSectorShortfalls[0].unmet)} ML/day.` : "Try increasing supply or revisiting the distribution channels."}</>
                            ) : result.gap > 0 ? (
                              <><strong>Stored water bridges the {number(result.gap)} ML/day inflow deficit.</strong>{" "}{availableStorageBuffer > .05 ? `Water above the protected reserve lasts about ${number(storageCoverDays)} days at this rate.` : "Storage is at its protected reserve."}</>
                            ) : (
                              <><strong>Source inflow covers current demand.</strong>{" "}The remaining water can replenish reservoir storage.</>
                            )}
                          </p>
                          <button className="compare-action" onClick={() => { setCompareMode("Scenarios"); setPage("Scenarios"); }}>Compare</button>
                          <button className="outcome-action" onClick={() => { setControlTab("Allocation"); setControlsOpen(true); }}>
                            Adjust distribution <ArrowRight size={17} />
                          </button>
                        </div>
                      </>}
                    </>
                  ) : (
                    <div className="large-flow">
                      <FlowDiagram result={result} />
                    </div>
                  )}
                </div>
              </section>
              <aside className={`inspector ${impactOpen ? "" : "collapsed"}`}>
                <div className="panel-heading">
                  <button
                    className="panel-collapse"
                    onClick={() => setImpactOpen((open) => !open)}
                    aria-label={impactOpen ? "Collapse allocation and impact" : "Expand allocation and impact"}
                  >
                    {impactOpen ? <ChevronRight size={17} /> : <BarChart3 size={17} />}
                  </button>
                  <h2>{impactOpen ? "Who receives water" : "View impact"}</h2>
                  {impactOpen && <span className="tag">Live</span>}
                </div>
                <div className="inspector-body">
                  <div className="inspector-subheading">
                    <span>Sector demand met</span>
                    <small>Allocated / demand</small>
                  </div>
                  <div className="sector-list">
                    {sectorNames.map((name, i) => {
                      const Icon = [Home, Leaf, Factory, Landmark][i];
                      const unmet = Math.max(0, result.demands[i] - result.allocations[i]);
                      return (
                        <button
                          key={name}
                          className={`sector-row ${sector === i && sectorDetailOpen ? "active" : ""} ${unmet > .05 ? "has-unmet" : "fully-met"}`}
                          aria-label={`${name}: ${number(result.allocations[i])} of ${number(result.demands[i])} ML/day supplied${unmet > .05 ? `, ${number(unmet)} ML/day unmet` : ", fully met"}`}
                          aria-expanded={sector === i && sectorDetailOpen}
                          onClick={() => {
                            if (sector === i) setSectorDetailOpen((open) => !open);
                            else {
                              setSector(i);
                              setSectorDetailOpen(true);
                            }
                          }}
                        >
                          <div>
                            <span>
                              <Icon
                                size={15}
                                style={{ color: sectorColors[i] }}
                              />
                              {name}
                            </span>
                            <strong>{unmet > .05 ? `${number(unmet)} ML/day unmet` : "Fully met"}</strong>
                          </div>
                          <div className="coverage-track">
                            <i
                              style={{
                                width: `${result.coverage[i] * 100}%`,
                                background: sectorColors[i],
                              }}
                            />
                          </div>
                          <small>{number(result.allocations[i])} / {number(result.demands[i])} ML/day · {Math.round(result.coverage[i] * 100)}% supplied</small>
                        </button>
                      );
                    })}
                  </div>
                  {sectorDetailOpen && <div className="sector-detail">
                    <strong>{sectorNames[sector]} allocation</strong>
                    <p>
                      {number(
                        result.demands[sector] - result.allocations[sector],
                      )}{" "}
                      ML/day unmet. Channel{" "}
                      {mixed("allocationShares")
                        ? "varies by LGU"
                        : `${p.allocationShares[sector]}%`}
                      ;{" "}
                      {p.protect
                        ? "essential-needs protection enabled."
                        : "unused channel water is redistributed to sectors still needing water."}
                    </p>
                  </div>}
                  <section className="impact-summary" aria-label="People behind the numbers">
                    <div className="impact-summary-heading"><BarChart3 size={14}/><strong>People behind the numbers</strong></div>
                    <div className="impact-stat-grid">
                      <div><strong>{number(result.affected)}</strong><span>Households at risk*</span></div>
                      <div><strong>{number(result.burden)}%</strong><span>Water burden</span></div>
                      <div><strong>{number(result.assisted)}</strong><span>Households assisted</span></div>
                    </div>
                    <p>*Equivalent household estimate from unmet household demand; not identified households.</p>
                    <div className="impact-agriculture"><span>Agriculture &amp; fisheries unmet</span><strong>{number(Math.max(0, result.demands[1] - result.allocations[1]))} ML/day</strong></div>
                    <button className="text-button" onClick={() => setPage("Methodology")}>
                      How are these calculated?<ArrowUpRight size={13}/>
                    </button>
                  </section>
                </div>
              </aside>
            </div>
            <div className="supporting-grid">
              <section className="map-card">
                <SectionHeading
                  icon={MapPin}
                  title="The Samar pilot"
                  detail="Spatial context"
                  onClick={() => document.getElementById("spatial-section")?.scrollIntoView({behavior:"smooth"})}
                />
                <SamarMap scope={scope} onSelect={setScope} />
              </section>
              <section className="flow-card">
                <SectionHeading
                  icon={GitBranch}
                  title="Follow the water"
                  detail="Allocation flows"
                  onClick={() => setView("Water flows")}
                />
                <FlowDiagram result={result} />
              </section>
              <section className="snapshot-card">
                <SectionHeading icon={BarChart3} title="Municipal balance" />
                <div className="balance-legend">
                  <span>
                    <i />
                    Supply
                  </span>
                  <span>
                    <i />
                    Demand
                  </span>
                </div>
                {simulate(scenario).results.map((r) => (
                  <button
                    key={r.id}
                    className="municipal-bar"
                    onClick={() => setScope(r.id)}
                  >
                    <div>
                      <span>{r.name}</span>
                      <small>
                        {number(r.supply)} / {number(r.demand)} ML/d
                      </small>
                    </div>
                    <div>
                      <i
                        style={{
                          width: `${(r.supply / Math.max(60, r.supply, r.demand)) * 100}%`,
                        }}
                      />
                      <i
                        style={{
                          width: `${(r.demand / Math.max(60, r.supply, r.demand)) * 100}%`,
                        }}
                      />
                    </div>
                  </button>
                ))}
                <button
                  className="text-button"
                  onClick={() => {
                    setCompareMode("Municipalities");
                    setPage("Scenarios");
                  }}
                >
                  Compare municipalities
                  <ArrowRight size={14} />
                </button>
              </section>
            </div>
            {view === "Reservoir" && <button className="scroll-prompt" onClick={() => document.getElementById("spatial-section")?.scrollIntoView({behavior:"smooth"})}>
              Explore Samar spatial context <ArrowDownRight size={15}/>
            </button>}
          </>
        )}
        {page === "Simulation" && view === "Reservoir" && (
          <section id="spatial-section" className="spatial-section" aria-label="Samar spatial context">
            <div className="explore-status-strip" aria-label={`${spatialMunicipality.name} live planning summary`}>
              <div className="explore-focus"><span>Spatial focus</span><strong>{spatialMunicipality.name}</strong><small>{scope === "combined" ? "REPRESENTATIVE PILOT" : "SELECTED PILOT"}</small></div>
              <div><span>Demand covered</span><strong>{Math.round(spatialCoverage * 100)}%</strong><small>SIMULATED</small></div>
              <div><span>Daily shortfall</span><strong>{number(spatialResult.shortage)} <small>ML/day</small></strong><small>SIMULATED</small></div>
              <div><span>Household water burden</span><strong>{number(spatialResult.burden)}%</strong><small>SIMULATED</small></div>
              <div className="explore-mode-control">
                <span>{exploreLayout === "split" ? "SPLIT EXPLORE" : exploreLayout === "map-expanded" ? "MAP VIEW" : "PLANNING VIEW"}</span>
                {exploreLayout !== "split" && <button type="button" onClick={() => setExploreLayout("split")}><Minimize2 size={14}/> Split view</button>}
              </div>
            </div>

            <div className={`planning-workspace layout-${exploreLayout}`}>
              {exploreLayout !== "planning-expanded" && <section className="planning-map">
                <SectionHeading icon={MapPin} title="Samar" detail={exploreLayout === "map-expanded" ? "Municipality explorer" : undefined} onClick={() => setExploreLayout(exploreLayout === "map-expanded" ? "split" : "map-expanded")} actionLabel={exploreLayout === "map-expanded" ? "Return to split view" : "Expand Samar map"} actionHref={exploreLayout === "map-expanded" ? `./gis.html?lgu=${encodeURIComponent(spatialMunicipality.id)}` : undefined} actionLinkText={exploreLayout === "map-expanded" ? "VIEW MAP IN GIS" : undefined} />
                <div className="map-key" aria-label="Map legend">
                  <span><i className="active-key" />Pilot LGU</span>
                  <span><i />Other municipality</span>
                </div>
                <SamarMap scope={scope} onSelect={setScope} expanded />
                <div className="map-scale"><span>0</span><span>10</span><span>20</span><span>40 km</span><i /></div>
              </section>}

              {exploreLayout !== "map-expanded" && <section className="planning-model">
                <header className="planning-model-head">
                  <div>
                    <h2>{spatialMunicipality.name}</h2>
                    <p>3D planning view <span>· illustrative model</span></p>
                    {exploreLayout === "planning-expanded" && <div className="planning-live-stats" aria-label={`${spatialMunicipality.name} live water status`}>
                      <span>Water stress <b className={`stress-${waterStress.toLowerCase()}`}>{waterStress}</b></span>
                      <span>NRW <b>{number(spatialInput.nrw)}%</b></span>
                      <span>Allocable water <b>{number(spatialResult.allocable)} ML/day</b></span>
                    </div>}
                  </div>
                  <div className="planning-model-actions">
                    <button className="planner-launch" type="button" onClick={()=>{setPlannerSelectedId(null);setPlannerOpen(true);}}><Building2 size={15}/> Development planner{spatialDevelopments.length>0?<span>{spatialDevelopments.length}</span>:null}</button>
                    <span className="planning-model-status"><span />Interactive model</span>
                    <button className="icon-button" type="button" aria-label={exploreLayout === "planning-expanded" ? "Return to split view" : "Expand 3D planning view"} onClick={() => setExploreLayout(exploreLayout === "planning-expanded" ? "split" : "planning-expanded")}>
                      {exploreLayout === "planning-expanded" ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
                    </button>
                  </div>
                </header>

                <div className="planning-canvas">
                  <CityMaquette
                    municipality={spatialMunicipality.name}
                    drought={spatialInput.drought}
                    nrw={spatialInput.nrw}
                    sectors={spatialDemands}
                    developments={spatialDevelopments}
                    onSelectDevelopment={id=>{setPlannerSelectedId(id);setPlannerOpen(true);}}
                    focusedSector={focusedSpatialSector}
                    onSectorHover={setHoverSpatialSector}
                    onSelectSector={(name) => {
                      setExpandedSpatialSector(name);
                      setHoverSpatialSector(name);
                    }}
                  />
                </div>

                <div className="demand-drawer">
                  <div className="demand-drawer-head"><div><h3>Water allocation · {spatialMunicipality.name}</h3><p>{exploreLayout === "split" ? "Expand the planning view for sector-level coverage." : "Hover a sector to highlight its buildings · values are illustrative."}</p></div><span className="demand-total">{number(spatialResult.allocation)} ML/day delivered{spatialStorageUsed > .05 ? ` · ${number(spatialStorageUsed)} from storage` : ""}</span></div>
                  <div className="demand-cards">
                    {spatialDemands.map(item => { const Icon = item.icon; const expanded = expandedSpatialSector === item.name; const status = item.coverage >= .999 ? "Met" : item.coverage >= .5 ? "Partly met" : "At risk"; return <button key={item.name} type="button" className={`sector-card ${expanded ? "expanded" : ""}`} aria-expanded={expanded} aria-label={`${item.name}: ${number(item.allocation)} of ${number(item.value)} ML per day allocated, ${Math.round(item.coverage * 100)} percent covered`} style={{"--sector": item.color, "--status": coverageColor(item.coverage, item.color)} as React.CSSProperties} onMouseEnter={() => setHoverSpatialSector(item.name)} onMouseLeave={() => setHoverSpatialSector(null)} onFocus={() => setHoverSpatialSector(item.name)} onBlur={() => setHoverSpatialSector(null)} onClick={() => setExpandedSpatialSector(expanded ? null : item.name)}><div><span><Icon size={16}/></span><b>{item.name}</b></div><strong>{number(item.allocation)} <small>of {number(item.value)} ML/day</small></strong><p>{Math.round(item.coverage * 100)}% covered · {status}</p><div><i style={{width: `${Math.max(0, Math.min(100, item.coverage * 100))}%`}}/></div></button>; })}
                  </div>
                  {expandedSpatialDemand && <section className="sector-detail" style={{"--sector": expandedSpatialDemand.color} as React.CSSProperties} aria-label={`${expandedSpatialDemand.name} planning detail`}>
                    <div className="sector-detail-copy"><span>{expandedSpatialDemand.name}</span><p>{spatialSectorDetails[expandedSpatialDemand.name].summary}</p></div>
                    <dl>{spatialSectorDetails[expandedSpatialDemand.name].facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                  </section>}
                </div>
              </section>}

              {exploreLayout === "map-expanded" && <aside className="explore-detail-rail municipal-profile">
                <header className="municipal-profile-head"><span>DEMOGRAPHICS / MAP</span><h3>{spatialMunicipality.name}</h3><p>Municipal profile · shared live simulation state</p></header>
                <div className="profile-statuses" aria-label="Municipal service conditions">
                  <span className={`profile-status stress-${waterStress.toLowerCase()}`}>Water stress <b>{waterStress}</b></span>
                  <span className={`profile-status affordability-${affordability.toLowerCase()}`}>Affordability <b>{affordability}</b></span>
                  <span className="profile-status">NRW <b>{number(spatialInput.nrw)}%</b><small>DEMO ASSUMPTION</small></span>
                  <span className="profile-status">Pressure <b>Not configured</b><small>DATA NEEDED</small></span>
                </div>
                <div className="municipal-profile-stats">
                  {profileStats.map(([label,value,source]) => <div key={label}><strong>{value}</strong><span>{label}</span><small>{source}</small></div>)}
                </div>
                <section className="facility-inventory">
                  <div className="facility-inventory-head"><h4>Sector inventory</h4><span>Counts with provenance</span></div>
                  <dl>{facilityInventory.map(([label,value,source]) => <div key={label}><dt>{label}</dt><dd>{value}</dd><small>{source}</small></div>)}</dl>
                </section>
                <div className="profile-economic-note"><span>Household affordability</span><strong>{number(spatialResult.burden)}% of income</strong><small>SIMULATED · {money(spatialInput.price)}/m³ tariff</small></div>
                <p className="profile-note">Facility counts and pressure are unconfigured. They are shown as data needed rather than estimated.</p>
              </aside>}

              {exploreLayout === "planning-expanded" && <aside className="explore-detail-rail allocation-context">
                <header><span>DEMAND &amp; SERVICE</span><h3>Water allocation</h3><p>{number(spatialResult.allocation)} ML/day delivered</p></header>
                <div className="allocation-context-list">{spatialDemands.map((item) => {
                  const Icon = item.icon;
                  const active = expandedSpatialSector === item.name;
                  const status = item.coverage >= .999 ? "Met" : item.coverage >= .5 ? "Partly met" : "At risk";
                  return <button key={item.name} className={`context-sector-row ${active ? "selected" : ""}`} style={{"--sector": item.color, "--status": coverageColor(item.coverage, item.color)} as React.CSSProperties} aria-pressed={active} onMouseEnter={() => setHoverSpatialSector(item.name)} onMouseLeave={() => setHoverSpatialSector(null)} onFocus={() => setHoverSpatialSector(item.name)} onBlur={() => setHoverSpatialSector(null)} onClick={() => setExpandedSpatialSector(active ? null : item.name)}>
                    <span className="context-sector-title"><i><Icon size={15}/></i><b>{item.name}</b><strong>{Math.round(item.coverage * 100)}%</strong></span>
                    <span className="context-sector-volume">{number(item.allocation)} of {number(item.value)} ML/day · {status}</span>
                    <span className="context-sector-track"><i style={{width: `${Math.max(0, Math.min(100, item.coverage * 100))}%`}}/></span>
                  </button>;
                })}</div>
                {expandedSpatialDemand && <section className="context-sector-detail"><h4>{expandedSpatialDemand.name}</h4><p>{spatialSectorDetails[expandedSpatialDemand.name].summary}</p><dl>{spatialSectorDetails[expandedSpatialDemand.name].facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}
                <p className="profile-note">Select a sector here or in the model to highlight its buildings. All figures are simulated from current inputs.</p>
              </aside>}
            </div>
            {exploreLayout === "planning-expanded" && <section className={"nrw-simulator" + (nrwSimulatorOpen ? " expanded" : "")} aria-labelledby="nrw-simulator-title">
              <button className="nrw-simulator-toggle" type="button" aria-expanded={nrwSimulatorOpen} onClick={() => setNrwSimulatorOpen((open) => !open)}>
                <span className="nrw-title"><small>RECOVER WATER ALREADY BEING PRODUCED</small><strong id="nrw-simulator-title">Non-revenue water simulator</strong></span>
                <span className="nrw-quick-stats"><span>Baseline <b>{number(nrwBaseline)}%</b></span><span>Scenario <b>{number(spatialInput.nrw)}%</b></span><span>More allocable <b>{nrwAllocableGain >= 0 ? "+" : "−"}{number(Math.abs(nrwAllocableGain))} ML/day</b></span></span>
                <span className="nrw-expand-label">{nrwSimulatorOpen ? "Collapse" : "Expand"}<ChevronRight size={16}/></span>
              </button>
              {nrwSimulatorOpen && <div className="nrw-simulator-content">
                <div className="nrw-simulator-intro"><div><h3>Reduce distribution losses</h3><p>Compare the current scenario with its demo baseline for {spatialMunicipality.name}. Only NRW changes in this comparison; source output, demand, and reserve stay the same.</p></div><span className="nrw-assumption-tag">BASELINE IS A DEMO ASSUMPTION</span></div>
                <div className="nrw-rate-compare">
                  <div><small>BASELINE NRW</small><strong>{number(nrwBaseline)}<i>%</i></strong><span>{number(baselineSourceLoss)} ML/day modeled water loss</span></div>
                  <div className="nrw-rate-arrow"><ArrowRight size={18}/></div>
                  <div className="scenario-rate"><small>SCENARIO NRW</small><strong>{number(spatialInput.nrw)}<i>%</i></strong><span>{number(scenarioSourceLoss)} ML/day modeled water loss</span></div>
                  <div className="nrw-recovered"><small>LESS SOURCE LOSS</small><strong>{sourceLossRecovered >= 0 ? "+" : "−"}{number(Math.abs(sourceLossRecovered))}<i>ML/day</i></strong><span>At the current simulated inflow</span></div>
                </div>
                <div className="nrw-slider-area"><Slider label={`Scenario NRW for ${spatialMunicipality.name}`} value={spatialInput.nrw} max={80} unit="%" onChange={(value) => updateMunicipal(spatialMunicipality.id, {nrw:value})}/><div className="nrw-range-labels"><span>0% loss</span><span>Baseline {number(nrwBaseline)}%</span><span>80% loss</span></div></div>
                <div className="nrw-balance-line"><span>Allocable at baseline NRW <b>{number(spatialAtBaselineNrw.allocable)} ML/day</b></span><ArrowRight size={16}/><span>At scenario NRW <b>{number(spatialResult.allocable)} ML/day</b></span><em>{nrwAllocableGain >= 0 ? "+" : "−"}{number(Math.abs(nrwAllocableGain))} ML/day</em></div>
                <div className="nrw-outcomes">
                  <div><strong>{nrwAllocableGain >= 0 ? "+" : "−"}{number(Math.abs(nrwAllocableGain))} ML/day</strong><span>Change in allocable water</span></div>
                  <div><strong>{nrwPercentagePointChange >= 0 ? "−" : "+"}{number(Math.abs(nrwPercentagePointChange))} pp</strong><span>NRW change from demo baseline</span></div>
                  <div><strong>{spatialInput.price > 0 ? `₱${number(nrwValueEstimate)}/day` : "Not estimated"}</strong><span>Potential value of added deliveries · ESTIMATED</span></div>
                </div>
                <p className="nrw-method-note">Source loss uses simulated inflow plus opening storage × NRW. Allocable water uses the live reservoir, protected reserve, and loss model. Potential value uses only the additional simulated allocation at the current illustrative tariff of {money(spatialInput.price)}/m³; it is not a revenue forecast.</p>
              </div>}
            </section>}
            {exploreLayout === "map-expanded" && <section className={`water-balance-panel ${waterBalanceOpen ? "expanded" : ""}`} aria-labelledby="water-balance-title">
              <button className="water-balance-toggle" type="button" aria-expanded={waterBalanceOpen} onClick={() => setWaterBalanceOpen((open) => !open)}>
                <span><small>LIVE MUNICIPALITY MODEL</small><strong id="water-balance-title">Water balance analysis</strong></span>
                <span className="water-balance-summary">
                  <span>Required <b>{number(spatialResult.demand)} ML/day</b></span>
                  <span>Unmet <b>{number(spatialResult.shortage)} ML/day</b></span>
                  <span>Allocable <b>{number(spatialResult.allocable)} ML/day</b></span>
                </span>
                <span className="analysis-expand">{waterBalanceOpen ? "Hide analysis" : "View analysis"}<ChevronRight size={16}/></span>
              </button>
              {waterBalanceOpen && <div className="water-balance-charts">
                <section className="wedge-stack-chart">
                  <header><h3>Demand allocation by sector</h3><p>Wedge length shows required volume; each wedge stacks delivered and unmet water · ML/day</p></header>
                  <div className="wedge-chart-layout">
                    <svg viewBox="0 0 380 270" role="img" aria-label={`Radial stacked chart: ${spatialDemands.map((item) => `${item.name}, ${number(item.allocation)} allocated of ${number(item.value)} ML per day required`).join("; ")}`}>
                      <circle cx="190" cy="128" r="104" className="wedge-guide"/><circle cx="190" cy="128" r="76" className="wedge-guide"/><circle cx="190" cy="128" r="48" className="wedge-guide"/>
                      {spatialDemands.map((item, index) => {
                        const start = index * 90 + 5;
                        const end = (index + 1) * 90 - 5;
                        const inner = 34;
                        const demandRadius = inner + item.value / balanceDemandMax * 72;
                        const allocatedRadius = inner + Math.min(item.value, item.allocation) / balanceDemandMax * 72;
                        const unmet = Math.max(0, item.value - item.allocation);
                        return <g key={item.name} className={expandedSpatialSector === item.name ? "chart-sector-focused" : ""} role="button" tabIndex={0} aria-label={`${item.name}: ${number(item.allocation)} ML/day allocated of ${number(item.value)} required`} onMouseEnter={() => setHoverSpatialSector(item.name)} onMouseLeave={() => setHoverSpatialSector(null)} onClick={() => setExpandedSpatialSector(item.name)} onKeyDown={(event) => {if(event.key === "Enter" || event.key === " "){event.preventDefault();setExpandedSpatialSector(item.name);}}}>
                          <path d={wedgePath(190,128,inner,demandRadius,start,end)} fill={item.color} fillOpacity=".17" stroke="white" strokeWidth="2"><title>{item.name}: {number(item.value)} ML/day required</title></path>
                          {item.allocation > 0 && <path d={wedgePath(190,128,inner,allocatedRadius,start,end)} fill={item.color} stroke="white" strokeWidth="2"><title>{number(item.allocation)} ML/day allocated</title></path>}
                          {unmet > .01 && <path d={wedgePath(190,128,Math.max(inner,allocatedRadius),demandRadius,start,end)} fill={coverageColor(item.coverage,item.color)} stroke="white" strokeWidth="2"><title>{number(unmet)} ML/day unmet</title></path>}
                        </g>;
                      })}
                      <circle cx="190" cy="128" r="31" className="wedge-center"/>
                      <text x="190" y="124" textAnchor="middle" className="wedge-center-label">ALLOCATED</text>
                      <text x="190" y="143" textAnchor="middle" className="wedge-center-value">{number(spatialResult.allocation)}</text>
                      <text x="190" y="158" textAnchor="middle" className="wedge-center-unit">of {number(spatialResult.demand)} ML/day</text>
                    </svg>
                    <div className="balance-chart-legend" aria-label="Sector demand details">
                      {spatialDemands.map((item) => <div key={item.name} style={{"--sector":item.color,"--status":coverageColor(item.coverage,item.color)} as React.CSSProperties}>
                        <i/><span>{item.name}</span><b>{number(item.allocation)} / {number(item.value)}</b><small>{number(Math.max(0,item.value-item.allocation))} unmet</small>
                      </div>)}
                      <p><i className="legend-delivered"/>Allocated <i className="legend-unmet"/>Unmet</p>
                    </div>
                  </div>
                </section>
                <section className="demand-bubble-chart">
                  <header><h3>Required vs allocated</h3><p>On the diagonal = fully covered; distance below it indicates unmet demand. Bubble size represents required demand.</p></header>
                  <svg viewBox="0 0 420 264" role="img" aria-label={`Bubble chart of required versus allocated water. ${bubblePoints.map((item) => `${item.name}: ${number(item.value)} required, ${number(item.allocation)} allocated`).join("; ")}`}>
                    {[0,.5,1].map((ratio) => {
                      const x = bubblePlot.left + ratio * (bubblePlot.right - bubblePlot.left);
                      const y = bubblePlot.bottom - ratio * (bubblePlot.bottom - bubblePlot.top);
                      return <g key={ratio}><line x1={bubblePlot.left} x2={bubblePlot.right} y1={y} y2={y} className="bubble-grid"/><line x1={x} x2={x} y1={bubblePlot.top} y2={bubblePlot.bottom} className="bubble-grid"/><text x={x} y={bubblePlot.bottom + 14} textAnchor="middle" className="bubble-tick">{number(bubbleDomain * ratio)}</text><text x={bubblePlot.left - 8} y={y + 3} textAnchor="end" className="bubble-tick">{number(bubbleDomain * ratio)}</text></g>;
                    })}
                    <line x1={bubblePlot.left} y1={bubblePlot.bottom} x2={bubblePlot.right} y2={bubblePlot.top} className="bubble-equality"/>
                    {bubblePoints.map((item) => <circle key={item.name} cx={item.x} cy={item.y} r={item.radius} fill={item.color} className="demand-bubble" stroke={expandedSpatialSector === item.name ? "#342740" : "white"} strokeWidth={expandedSpatialSector === item.name ? 3 : 2} role="button" tabIndex={0} aria-label={`${item.name}: ${number(item.value)} ML/day required, ${number(item.allocation)} allocated`} onClick={() => setExpandedSpatialSector(item.name)} onKeyDown={(event) => {if(event.key === "Enter" || event.key === " "){event.preventDefault();setExpandedSpatialSector(item.name);}}} onMouseEnter={() => setHoverSpatialSector(item.name)} onMouseLeave={() => setHoverSpatialSector(null)}>
                      <title>{item.name}: {number(item.value)} ML/day required, {number(item.allocation)} ML/day allocated, {number(Math.max(0,item.value-item.allocation))} ML/day unmet ({Math.round(item.coverage*100)}% covered)</title>
                    </circle>)}
                    <text x="210" y="258" textAnchor="middle" className="bubble-axis-label">Required demand · ML/day</text>
                    <text x="12" y="116" textAnchor="middle" className="bubble-axis-label" transform="rotate(-90 12 116)">Allocated · ML/day</text>
                  </svg>
                  <div className="bubble-legend">{spatialDemands.map((item) => <span key={item.name} style={{"--sector":item.color} as React.CSSProperties}><i/>{item.name}</span>)}</div>
                  <p className={`balance-delta ${spatialResult.shortage > .05 ? "deficit" : "surplus"}`}>{spatialResult.shortage > .05 ? `${number(spatialResult.shortage)} ML/day unmet across sectors` : `${number(Math.max(0,spatialResult.allocable-spatialResult.demand))} ML/day allocable after required demand`}</p>
                </section>
                <section className="reserve-strip" aria-label="Protected reservoir reserve">
                  <header><h3>Protected reserve</h3><p>{number(spatialStorage.reserveVolume)} ML protected of {number(spatialStorage.capacity)} ML capacity · Current storage {number(spatialStorage.ending)} ML</p></header>
                  <div className="reserve-track" role="img" aria-label={`Current storage ${number(spatialStorage.ending)} ML of ${number(spatialStorage.capacity)} ML capacity; protected reserve threshold ${number(spatialStorage.reserveVolume)} ML`}>
                    <i style={{width:`${Math.max(0,Math.min(100,spatialStorage.ending/Math.max(1,spatialStorage.capacity)*100))}%`}}/>
                    <b style={{left:`${Math.max(0,Math.min(100,spatialStorage.reserveVolume/Math.max(1,spatialStorage.capacity)*100))}%`}}/>
                  </div>
                  <div className="reserve-labels"><span>0 ML</span><span>Protected threshold {number(spatialStorage.reserveVolume)} ML</span><span>Capacity {number(spatialStorage.capacity)} ML</span></div>
                </section>
              </div>}
            </section>}
          </section>
        )}
        {page === "Scenarios" && (
          <section className="document-panel">
            <div className="document-toolbar">
              <div className="control-tabs">
                {["Scenarios", "Municipalities"].map((v) => (
                  <button
                    key={v}
                    className={compareMode === v ? "selected" : ""}
                    onClick={() => setCompareMode(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <button className="button secondary" onClick={openSave}>
                <Copy size={15} />
                Duplicate current scenario
              </button>
            </div>
            <div className="comparison-grid">
              {(compareMode === "Scenarios"
                ? scenarios.map((s) => ({
                    id: s.id,
                    name: s.name,
                    result: simulate(s, scope),
                  }))
                : pilots.map((m) => ({
                    id: m.id,
                    name: m.name,
                    result: simulate(scenario, m.id),
                  }))
              ).map(({ id, name, result: r }) => (
                <article className="comparison-card" key={id}>
                  <div className="comparison-title">
                    <GitBranch size={18} />
                    <h2>{name}</h2>
                  </div>
                  <div className="comparison-reserve">
                    <Waves size={30} />
                    <strong>
                      {number(r.ending)} <small>ML closing storage</small>
                    </strong>
                  </div>
                  <dl>
                    {[
                      ["Source inflow", number(r.supply) + " ML/day"],
                      ["Water demand", number(r.demand) + " ML/day"],
                      ["Unmet demand", number(r.shortage) + " ML/day"],
                      [
                        "Household coverage",
                        number(r.coverage[0] * 100) + "%",
                      ],
                      ["Affordability burden", number(r.burden) + "%"],
                      ["Households assisted", number(r.assisted)],
                    ].map(([a, b]) => (
                      <div key={a}>
                        <dt>{a}</dt>
                        <dd>{b}</dd>
                      </div>
                    ))}
                  </dl>
                  <button
                    className="button secondary"
                    onClick={() => {
                      compareMode === "Scenarios"
                        ? setScenarioId(id)
                        : setScope(id);
                      setPage("Simulation");
                    }}
                  >
                    Open simulation
                    <ArrowRight size={14} />
                  </button>
                  {compareMode === "Scenarios" && (
                    <label className="rename-label">
                      Scenario name
                      <input
                        aria-label={`Rename ${name}`}
                        value={name}
                        onChange={(e) =>
                          setScenarios((list) =>
                            list.map((s) =>
                              s.id === id ? { ...s, name: e.target.value } : s,
                            ),
                          )
                        }
                      />
                    </label>
                  )}
                </article>
              ))}
            </div>
            <p className="help-text">
              Saved copies are stored on this device. Save another copy to
              retain subsequent edits. All comparisons use a one-day horizon and
              the same opening storage assumptions.
            </p>
          </section>
        )}
        {page === "Data" && (
          <section className="document-panel">
            <div className="document-toolbar">
              <div>
                <h2>Municipal inputs</h2>
                <p>Demonstration dataset · editing “{scenario.name}”</p>
              </div>
              <button className="button secondary" onClick={exportData}>
                <Download size={15} />
                Export results
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Municipality</th>
                    <th>Provider / data status</th>
                    {sectorNames.map((s) => (
                      <th key={s}>
                        {s}
                        <small>ML/day demand</small>
                      </th>
                    ))}
                    <th>
                      Income<small>₱ / household / month</small>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selected.map((m) => (
                    <tr key={m.id}>
                      <th>
                        {m.name}
                        <small>{number(m.households)} demo households</small>
                      </th>
                      <td>
                        {m.provider}
                        <small>Demonstration · configurable</small>
                      </td>
                      {scenario.inputs[m.id].sectorDemand.map((v, i) => (
                        <td key={i}>
                          <input
                            type="number"
                            min="0"
                            max="200"
                            step=".5"
                            aria-label={`${m.name} ${sectorNames[i]} demand`}
                            value={v}
                            onChange={(e) => {
                              const values = [
                                ...scenario.inputs[m.id].sectorDemand,
                              ] as Inputs["sectorDemand"];
                              values[i] = Math.min(
                                200,
                                Math.max(0, +e.target.value),
                              );
                              updateMunicipal(m.id, { sectorDemand: values });
                            }}
                          />
                        </td>
                      ))}
                      <td>
                        <input
                          type="number"
                          min="1000"
                          max="1000000"
                          step="1000"
                          aria-label={`${m.name} household income`}
                          value={scenario.inputs[m.id].income}
                          onChange={(e) =>
                            updateMunicipal(m.id, {
                              income: Math.max(
                                1000,
                                Math.min(1000000, +e.target.value),
                              ),
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="table-heading">Calculated results</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Municipality</th>
                    <th>Supply</th>
                    <th>Demand</th>
                    <th>Allocation</th>
                    <th>Closing storage</th>
                    <th>Unmet demand</th>
                    <th>Assistance spent</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r) => (
                    <tr key={r.id}>
                      <th>{r.name}</th>
                      <td>{number(r.supply)} ML/d</td>
                      <td>{number(r.demand)} ML/d</td>
                      <td>{number(r.allocation)} ML/d</td>
                      <td>{number(r.ending)} ML</td>
                      <td>{number(r.shortage)} ML/d</td>
                      <td>{money(r.spent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="data-note">
              <Info size={19} />
              <p>
                All water, household, provider assignments, and economic figures
                are illustrative. Pinabacdao and Calbayog utility assignments
                are configurable placeholders. No official service relationship
                is asserted.
              </p>
            </div>
          </section>
        )}
        {page === "Methodology" && (
          <section className="document-panel methodology">
            <div className="method-intro">
              <ShieldCheck size={30} />
              <h2>Visible assumptions. Explainable results.</h2>
              <p>
                The current MVP calculates scenarios only for Catbalogan City,
                Pinabacdao, and Calbayog. Other Samar municipalities are
                reserved for future expansion and are not included in calculated
                results.
              </p>
            </div>
            <div className="method-grid">
              {[
                [
                  "One day, three separate systems",
                  "Each municipality is calculated independently before aggregation. Water is not automatically transferred between LGUs. The visualization shows closing storage after a single day, not a forecast.",
                ],
                [
                  "Supply and storage",
                  "Gross inflow is the sum of source outputs after the output multiplier and drought reduction, plus any supplementary supply. The demonstration assumptions are 28% non-revenue water (NRW) and a protected reserve equal to 22% of reservoir capacity; both are editable in Sources. Allocable water = max(0, opening storage + inflow − protected reserve volume) × (1 − NRW). Actual allocations cannot exceed this amount. Closing storage subtracts the physical withdrawal needed to deliver allocations (allocation ÷ (1 − NRW)) from opening storage + inflow, then applies reservoir capacity; excess is spill. This is a one-day illustrative balance, not an operational forecast.",
                ],
                [
                  "Allocation and unmet demand",
                  "Required demand = each sector's baseline demand × the demand multiplier. Target allocation also applies the allocation target. When water is limited, distribute by each remaining target × its user-set distribution-channel share, redistributing excess from sectors whose targets are already met. Actual allocation is capped by allocable water after the NRW and protected-reserve assumptions. Unmet demand = required demand − actual allocation. Supply gap excludes storage and equals max(demand − current inflow, 0).",
                ],
                [
                  "Essential-needs protection",
                  "The optional policy first reserves critical-service demand, then 80% of household demand, as available water permits. The remaining supply follows the user-set distribution channels; unused channel water is reallocated to sectors that still need water. This is a user-selected scenario, not an automatic policy recommendation.",
                ],
                [
                  "Affordability and assistance",
                  "Assume 15 m³ of monthly water use per household. Monthly expense = 15 × service price. Assistance provides ₱300 per household, capped by budget and household count. Burden = (expense − average assistance per household) / monthly income × 100. Combined burden is household-weighted.",
                ],
                [
                  "People and livelihoods",
                  "Households with unmet needs = household count × household unmet-demand share, rounded per LGU. This is an equivalent household estimate, not identified beneficiaries. Agriculture and fisheries unmet demand indicates exposure; it does not estimate monetary losses.",
                ],
                [
                  "Sources and provider relationships",
                  "All numerical inputs are demonstration data. Catbalogan Water District is represented as a configurable example. The brief’s Calbiga/Calbayog provider relationship is unverified, so Calbayog uses a neutral placeholder. Supplementary supply is a demo 5 ML/day per selected LGU, configurable for a future Balibago partnership.",
                ],
                [
                  "Map and future modules",
                  "Samar boundaries come from the 2011 Philippines JSON Maps dataset (faeldon, MIT license). They provide geographic context and should be replaced with current verified GIS data for operational use. AI interpretation and forecasting are future modules; no inference or predictions run in this app.",
                ],
              ].map(([title, text]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
            <a
              href="https://github.com/faeldon/philippines-json-maps"
              target="_blank"
              rel="noreferrer"
              className="text-button"
            >
              View geographic data source
              <ArrowUpRight size={14} />
            </a>
            <div className="future-grid">
              <div>
                <Sparkles />
                <h3>AI interpretation</h3>
                <p>Future integration · disabled</p>
              </div>
              <div>
                <Activity />
                <h3>Forecasting & prediction</h3>
                <p>Future integration · disabled</p>
              </div>
            </div>
          </section>
        )}
        <footer>
          <span>
            <Info size={13} />
            Illustrative demonstration data — not official LGU statistics.
          </span>
          <span>
            3 active LGUs
            <span className="footer-dot" />
            Human-led planning, made visible.
          </span>
        </footer>
      </main>
      {page === "Simulation" && <aside className={`daloy-assistant ${daloyOpen ? "open" : ""}`} aria-label="DULOY AI scenario assistant">
        {daloyOpen && <section className="daloy-panel">
          <header><span><Sparkles size={15}/> DULOY AI <small>LIVE SCENARIO READING</small></span><button className="icon-button" aria-label="Close DULOY AI" onClick={() => setDaloyOpen(false)}><X size={17}/></button></header>
          <p className="daloy-prompt">Ask about {spatialMunicipality.name}</p>
          <div className="daloy-questions">{daloyQuestions.map((question) => <button key={question} className={daloyQuestion === question ? "selected" : ""} onClick={() => selectDaloyQuestion(question)}>{question}<ArrowRight size={13}/></button>)}</div>
          {daloyQuestion && <div className="daloy-answer" aria-live="polite">
            <span><Sparkles size={13}/> {daloyQuestion}</span>
            {daloyQuestion === daloyQuestions[0] && <>
              <strong>{largestUnmet ? `The largest demand shortfall is in ${largestUnmet.name.toLowerCase()}.` : "No sector has unmet demand in the current scenario."}</strong>
              {largestUnmet && <dl><div><dt>Required</dt><dd>{number(largestUnmet.value)} ML/day</dd></div><div><dt>Allocated</dt><dd>{number(largestUnmet.allocation)} ML/day</dd></div><div><dt>Unmet</dt><dd>{number(largestUnmet.unmet)} ML/day</dd></div><div><dt>Covered</dt><dd>{Math.round(largestUnmet.coverage*100)}%</dd></div></dl>}
              <p>Current NRW is {number(spatialInput.nrw)}% (demo assumption), equivalent to about {number(scenarioSourceLoss)} ML/day of modeled water loss before delivery. Allocable water is {number(spatialResult.allocable)} ML/day for {number(spatialResult.demand)} ML/day required across {spatialMunicipality.name}.</p>
              <button className="daloy-action" onClick={() => {setView("Reservoir");setExploreLayout("planning-expanded");setNrwSimulatorOpen(true);setDaloyOpen(false);window.setTimeout(() => document.getElementById("spatial-section")?.scrollIntoView({behavior:"smooth",block:"start"}), 0);}}>Inspect NRW and the leak in 3D <ArrowRight size={14}/></button>
            </>}
            {daloyQuestion === daloyQuestions[1] && (unmetSectors.length ? <><strong>{unmetSectors.length} {unmetSectors.length === 1 ? "sector has" : "sectors have"} unmet demand:</strong><dl>{unmetSectors.map((item) => <div key={item.name}><dt>{item.name}</dt><dd>{number(item.unmet)} ML/day · {Math.round(item.coverage*100)}% covered</dd></div>)}</dl>{largestUnmet?.name === "Households" && <p>About {number(spatialResult.affected)} households are equivalent to the current household coverage shortfall.</p>}</> : <><strong>All current sector demand is covered.</strong><p>No unmet demand is calculated for this scenario.</p></>)}
            {daloyQuestion === daloyQuestions[2] && (spatialResult.shortage > .05 ? <><strong>{number(spatialResult.allocable)} ML/day is allocable against {number(spatialResult.demand)} ML/day required.</strong><p>The model applies {number(spatialInput.nrw)}% non-revenue water loss and protects {number(spatialInput.reserve)}% of reservoir capacity. Current source inflow is {number(spatialResult.supply)} ML/day; the remaining {number(spatialResult.shortage)} ML/day is unmet.</p>{spatialInput.allocation < 100 && <p>The allocation target is also set to {number(spatialInput.allocation)}%.</p>}</> : <><strong>There is no current supply shortage.</strong><p>Allocable water covers the present required demand. Any changes to source output, losses, reserve, or sector needs update this reading.</p></>)}
            {daloyQuestion === daloyQuestions[3] && <><strong>Change one assumption at a time to see what moves the balance.</strong><p>Try reducing NRW, increasing source output, or shifting a distribution channel. Watch allocable water, unmet demand, and the highlighted sector update together.</p><button className="daloy-action" onClick={() => {setControlTab("Sources");setControlsOpen(true);setDaloyOpen(false);}}>Open water controls <ArrowRight size={14}/></button></>}
            {spatialResult.developmentCount>0 && <p>{spatialResult.developmentCount} {spatialResult.developmentCount===1?"included establishment adds":"included establishments add"} {number(spatialResult.developmentDemand)} ML/day to {spatialMunicipality.name}'s sector demand. These values come from the profiles set in the Development planner.</p>}
            <small>Computed directly from the current scenario inputs; no extra AI estimate.</small>
          </div>}
        </section>}
        <button className="daloy-launcher" onClick={() => setDaloyOpen((open) => !open)} aria-expanded={daloyOpen} aria-label={daloyOpen ? "Close scenario interpretation" : "Interpret scenario with DULOY AI"}><Sparkles size={16}/>{daloyOpen ? "Close interpretation" : "Interpret scenario"}</button>
      </aside>}
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {plannerOpen && <DevelopmentPlanner municipality={spatialMunicipality} scenario={scenario} result={spatialResult} developments={spatialDevelopments} initialDevelopmentId={plannerSelectedId} onChange={updateDevelopments} onClose={closePlanner} onSaveScenario={()=>{closePlanner();openSave();}}/>}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setModal(false);
              if (e.key === "Tab") {
                const nodes = Array.from(
                  e.currentTarget.querySelectorAll<HTMLElement>("button,input"),
                );
                if (e.shiftKey && document.activeElement === nodes[0]) {
                  e.preventDefault();
                  nodes[nodes.length - 1].focus();
                } else if (
                  !e.shiftKey &&
                  document.activeElement === nodes[nodes.length - 1]
                ) {
                  e.preventDefault();
                  nodes[0].focus();
                }
              }
            }}
          >
            <div className="panel-heading">
              <h2 id="save-title">Save a scenario</h2>
              <button
                className="icon-button"
                onClick={() => setModal(false)}
                aria-label="Close save dialog"
              >
                <X size={19} />
              </button>
            </div>
            <p>
              Capture the current assumptions for all three pilot LGUs. Saved
              locally on this device.
            </p>
            <label>
              Scenario name
              <input
                autoFocus
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveScenario()}
                maxLength={60}
              />
            </label>
            <button
              className="button primary"
              disabled={!scenarioName.trim()}
              onClick={saveScenario}
            >
              <Save size={16} />
              Save scenario
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
