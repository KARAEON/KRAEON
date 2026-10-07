import { useEffect, useMemo, useState } from "react";
import { Sparkles, RotateCcw, Save, Calculator } from "lucide-react";
import { getBarangay, updateBarangay } from "./waterEconomyApi";
import { previewDaloyScenario } from "./scenarioPreviewApi";
import "./BarangayWorkflowPanel.css";

const starter = (type) => ({
  project_type: type === "nrw" ? "NRW Reduction Program" : "New Water Source",
  name: type === "nrw" ? "Illustrative NRW Reduction" : "Illustrative New Water Source",
  capex_php: type === "nrw" ? 2500000 : 5000000,
  annual_opex_php: type === "nrw" ? 150000 : 250000,
  useful_life_years: 15,
  water_gain_m3_per_day: 0,
  households_benefited: 1000,
  reliability_score: type === "nrw" ? 75 : 80,
  equity_score: 70,
  economic_benefit_score: 70,
  implementation_time_months: type === "nrw" ? 12 : 24,
});
const n = (x) => Number(x || 0);
const fmt = (x, unit = " m³/day") => `${n(x).toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit}`;

export default function BarangayWorkflowPanel({ selectedBarangay, onBarangayUpdate, onAskDaloy }) {
  const [record, setRecord] = useState(null);
  const [nrw, setNrw] = useState("");
  const [supply, setSupply] = useState("");
  const [preview, setPreview] = useState(null);
  const [projects, setProjects] = useState({ nrw: starter("nrw"), source: starter("source") });
  const [savedDraftKeys, setSavedDraftKeys] = useState([]);
  const [ranking, setRanking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const code = selectedBarangay?.psgc_code;

  useEffect(() => {
    let live = true;
    setPreview(null); setRanking(null); setError("");
    setProjects({ nrw: starter("nrw"), source: starter("source") }); setSavedDraftKeys([]);
    if (!code) { setRecord(null); return () => { live = false; }; }
    getBarangay(code).then((r) => { if (live) { const row = r.record || r; setRecord({ ...row, calculated: r.calculated }); setNrw(String(row.nrw_rate_pct ?? 0)); setSupply(String(row.gross_supply_m3_day ?? 0)); } })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [code]);

  const changes = useMemo(() => ({ nrw_rate_pct: n(nrw), gross_supply_m3_day: n(supply), source_capacity_m3_day: n(supply) }), [nrw, supply]);
  function editProject(key, name, value) {
    setProjects((current) => ({ ...current, [key]: { ...current[key], [name]: ["name", "project_type"].includes(name) ? value : Number(value) } }));
    setSavedDraftKeys((current) => current.filter((savedKey) => savedKey !== key));
    setRanking(null);
  }
  async function calculate({ excludeKey } = {}) {
    if (!code) return;
    setBusy(true); setError("");
    try {
      const scenario = await previewDaloyScenario(code, changes);
      const gain = Math.max(0, n(scenario.after?.usable_water_m3_day) - n(scenario.before?.usable_water_m3_day));
      const drafts = { ...projects, nrw: { ...projects.nrw, water_gain_m3_per_day: gain } };
      if (n(drafts.source.water_gain_m3_per_day) === 0) {
        drafts.source = { ...drafts.source, water_gain_m3_per_day: Math.max(250, Math.min(1000, n(scenario.before?.deficit_m3_day))) };
      }
      const draftRows = Object.entries(drafts).filter(([key]) => !savedDraftKeys.includes(key) && key !== excludeKey).map(([, project]) => project);
      const response = await fetch(`/api/water-economy/benefit-per-peso/${encodeURIComponent(code)}/preview`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ projects: draftRows }) });
      const rankingData = await response.json(); if (!response.ok) throw new Error(rankingData.message || "Unable to rank interventions.");
      setPreview(scenario); setRanking(rankingData); setProjects(drafts);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function applyScenario() {
    if (!code || !preview) return;
    setBusy(true); setError("");
    try {
      const result = await updateBarangay(code, changes);
      const latest = result.record ? result : await getBarangay(code);
      const updated = latest.record || latest.barangay || latest;
      setRecord({ ...updated, calculated: latest.calculated }); setNrw(String(updated.nrw_rate_pct)); setSupply(String(updated.gross_supply_m3_day)); setPreview(null); setRanking(null);
      onBarangayUpdate?.(updated);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function saveProject(key, project) {
    if (!preview) return;
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/water-economy/projects/${encodeURIComponent(code)}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(project) });
      const data = await r.json(); if (!r.ok) throw new Error(data.message || "Unable to save intervention.");
      setSavedDraftKeys((current) => current.includes(key) ? current : [...current, key]);
      await calculate({ excludeKey: key });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (!code) return <div className="bw-empty">Select a barangay in Overview or Barangays to start the decision workflow.</div>;
  if (!record) return <div className="bw-empty">Loading barangay water data…</div>;
  const base = preview?.before;
  const after = preview?.after;
  const calc = record.calculated || record.calculation || {};
  const water = calc.water || {};
  return <div className="bw-workflow">
    <header><span>GUIDED DECISION WORKFLOW</span><h3>{record.barangay} · {record.lgu}</h3><p>Illustrative scenario preview. Draft values stay local to this preview until you apply them.</p></header>
    {error && <div className="bw-error" role="alert">{error}</div>}
    <section className="bw-section"><h4>1 · Current condition</h4><div className="bw-metrics">
      <Metric label="Usable water" value={fmt(water.usable_water_m3_day ?? record.usable_water_m3_day)} /><Metric label="Demand" value={fmt(water.total_demand_m3_day ?? record.total_demand_m3_day)} /><Metric label="Deficit" value={fmt(water.deficit_m3_day ?? record.deficit_m3_day)} /><Metric label="NRW" value={fmt(record.nrw_rate_pct, "%")} /><Metric label="Source pressure" value={fmt(water.source_pressure_pct ?? record.source_pressure_pct, "%")} />
    </div></section>
    <section className="bw-section"><h4>2 · Test a scenario</h4><div className="bw-fields">
      <label><span>Proposed NRW (%)</span><input type="number" min="0" max="100" value={nrw} onChange={(e) => { setNrw(e.target.value); setPreview(null); setRanking(null); }} /></label>
      <label><span>Proposed supply capacity (m³/day)</span><input type="number" min="0" value={supply} onChange={(e) => { setSupply(e.target.value); setPreview(null); setRanking(null); }} /></label>
    </div><small className="bw-field-note">For this prototype scenario, supply capacity sets gross supply and source capacity.</small><div className="bw-actions"><button type="button" onClick={calculate} disabled={busy}><Calculator size={14}/>{busy ? "Calculating…" : "Calculate preview"}</button><button type="button" className="secondary" onClick={() => { setNrw(String(record.nrw_rate_pct ?? 0)); setSupply(String(record.gross_supply_m3_day ?? 0)); setPreview(null); setRanking(null); }}><RotateCcw size={14}/>Reset</button>{preview && <button type="button" className="secondary" onClick={applyScenario} disabled={busy}><Save size={14}/>Apply to barangay data</button>}</div>
      {preview && <div className="bw-compare"><div className="bw-compare-head"><b>Before</b><b>After · preview</b></div>{[["Usable water","usable_water_m3_day"],["Demand","total_demand_m3_day"],["Deficit","deficit_m3_day"],["NRW","nrw_rate_pct"],["Source pressure","source_pressure_pct"]].map(([label,key])=><div className="bw-compare-row" key={key}><span>{label}</span><strong>{fmt(base?.[key], key.includes("pct") ? "%" : " m³/day")}</strong><strong>{fmt(after?.[key], key.includes("pct") ? "%" : " m³/day")}</strong></div>)}</div>}
    </section>
    <section className="bw-section"><h4>3 · Compare interventions</h4><p className="bw-note">Starter costs and scores are illustrative prototype assumptions. Edit them before comparing or saving.</p>
      <div className="bw-projects">{[["nrw","NRW Reduction"],["source","New Water Source"]].map(([key,title])=><div className="bw-project" key={key}><h5>{title}</h5>{[["name","Project name"],["capex_php","Capital cost (₱)"],["annual_opex_php","Annual operating cost (₱)"],["useful_life_years","Useful life (years)"],["water_gain_m3_per_day","Water gain (m³/day)"],["households_benefited","Households benefited"],["reliability_score","Reliability score"],["equity_score","Equity score"],["economic_benefit_score","Economic score"],["implementation_time_months","Implementation (months)"]].map(([field,label])=><label key={field}>{label}<input type={field === "name" ? "text" : "number"} min={field === "name" ? undefined : 0} max={field.includes("score") ? 100 : undefined} value={projects[key][field]} onChange={(e)=>editProject(key,field,e.target.value)}/></label>)}<button type="button" className="secondary" onClick={()=>saveProject(key, projects[key])} disabled={busy || !preview || savedDraftKeys.includes(key)}><Save size={13}/>{savedDraftKeys.includes(key) ? "Saved as project" : "Save as project"}</button></div>)}</div>
      {ranking && <div className="bw-ranking"><h5>Benefit per Peso · calculated with configured default weights</h5>{ranking.ranking?.map((item)=><article key={`${item.project_id ?? "draft"}-${item.name}`}><div><b>#{item.rank} {item.name}</b><span>{item.project_id ? "Saved project" : "Draft example"}</span></div><strong>{Number(item.public_benefit_score).toFixed(1)} / 100</strong><small>₱{Number(item.economics?.simple_lifecycle_cost_per_m3_php ?? 0).toFixed(2)} per m³ · {fmt(item.economics?.water_gain_m3_per_day)}</small></article>)}</div>}
    </section>
    <button type="button" className="bw-ask" disabled={!preview || !ranking} onClick={()=>onAskDaloy?.("Explain why the higher-ranked intervention performs better for this barangay, and describe the calculated before/after scenario.", { changes, projects: Object.entries(projects).filter(([key]) => !savedDraftKeys.includes(key)).map(([, project]) => project) })}><Sparkles size={15}/>Ask DALOY AI to explain these results</button>
  </div>;
}
function Metric({label,value}) { return <div><span>{label}</span><strong>{value}</strong></div>; }
