import { useEffect, useState } from "react";
import { Save, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getBarangay, subscribeToBarangayUpdates, updateBarangay } from "./waterEconomyApi";
import "./EditableWaterDataPanel.css";

const groups = [
  ["Water System", [
    ["gross_supply_m3_day", "Gross supply", "m³/day"],
    ["source_capacity_m3_day", "Source capacity", "m³/day"],
    ["nrw_rate_pct", "NRW", "%"],
    ["reserve_rate_pct", "Reserve", "%"],
    ["supply_reliability_pct", "Reliability", "%"],
    ["piped_access_pct", "Piped access", "%"],
  ]],
  ["Affordability", [
    ["tariff_php_m3", "Tariff", "₱/m³"],
    ["avg_household_income_php", "Avg household income", "₱/month"],
    ["monthly_water_cost_php", "Monthly water cost", "₱/month"],
  ]],
  ["Sector Demand", [
    ["household_demand_m3_day", "Households", "m³/day"],
    ["critical_services_demand_m3_day", "Critical services", "m³/day"],
    ["agriculture_demand_m3_day", "Agriculture", "m³/day"],
    ["fisheries_demand_m3_day", "Fisheries", "m³/day"],
    ["aquaculture_demand_m3_day", "Aquaculture", "m³/day"],
    ["business_demand_m3_day", "Business", "m³/day"],
    ["industry_demand_m3_day", "Industry", "m³/day"],
  ]],
  ["Sector Allocation", [
    ["household_allocated_m3_day", "Households", "m³/day"],
    ["critical_services_allocated_m3_day", "Critical services", "m³/day"],
    ["agriculture_allocated_m3_day", "Agriculture", "m³/day"],
    ["fisheries_allocated_m3_day", "Fisheries", "m³/day"],
    ["aquaculture_allocated_m3_day", "Aquaculture", "m³/day"],
    ["business_allocated_m3_day", "Business", "m³/day"],
    ["industry_allocated_m3_day", "Industry", "m³/day"],
  ]],
];

export default function EditableWaterDataPanel({ psgcCode, onSaved }) {
  const [record, setRecord] = useState(null);
  const [calc, setCalc] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load(notifyParent = false) {
    if (!psgcCode) return;
    setLoading(true);
    try {
      const data = await getBarangay(psgcCode);
      setRecord(data.record);
      setCalc(data.calculated);
      setForm(data.record);
      setError("");
      if (notifyParent) onSaved?.(data);
    } catch (requestError) {
      setError(requestError.message || "Unable to load the shared barangay record.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setRecord(null);
    void load();
    return subscribeToBarangayUpdates(psgcCode, () => void load(true));
  }, [psgcCode]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const payload = {};
    for (const [, fields] of groups) {
      for (const [key] of fields) {
        if (form[key] !== "" && form[key] !== undefined) payload[key] = Number(form[key]);
      }
    }
    payload.livelihood_profile = form.livelihood_profile ?? "";
    setSaving(true);
    try {
      const data = await updateBarangay(psgcCode, payload);
      setRecord(data.record);
      setCalc(data.calculated);
      setForm(data.record);
      setError("");
      onSaved?.(data);
    } catch (saveError) {
      setError(saveError.message || "Unable to save the barangay record.");
    } finally {
      setSaving(false);
    }
  }

  if (!psgcCode) return <div className="ew-empty">Select a barangay first.</div>;
  if (loading || !record) return <div className="ew-empty"><RefreshCw size={14} /> Loading shared database record…</div>;

  return <div className="ew-panel">
    <div className="ew-head"><div><span>SHARED GIS DATABASE</span><h3>{record.barangay}</h3><p>{record.lgu} · Version {record.data_version}</p></div></div>
    {error && <div className="ew-error" role="alert">{error}</div>}
    {groups.map(([title, fields]) => <section key={title}><h4>{title}</h4><div className="ew-grid">
      {fields.map(([key, label, unit]) => <label key={key}><span>{label}</span><div><input type="number" min="0" step="any" value={form[key] ?? ""} onChange={(event) => updateField(key, event.target.value)} /><small>{unit}</small></div></label>)}
    </div></section>)}
    <label className="ew-livelihood"><span>Livelihood profile</span><input value={form.livelihood_profile ?? ""} onChange={(event) => updateField("livelihood_profile", event.target.value)} /></label>
    {calc && <section><h4>CALCULATED FROM SAVED DATA</h4><div className="ew-metrics">
      <M label="Usable water" value={`${fmt(calc.water?.usable_water_m3_day)} m³/day`} />
      <M label="Demand" value={`${fmt(calc.water?.total_demand_m3_day)} m³/day`} />
      <M label="Deficit" value={`${fmt(calc.water?.deficit_m3_day)} m³/day`} />
      <M label="Source pressure" value={calc.water?.source_pressure_pct == null ? "N/A" : `${fmt(calc.water.source_pressure_pct)}%`} />
      <M label="Water burden" value={calc.affordability?.water_burden_pct == null ? "N/A" : `${fmt(calc.affordability.water_burden_pct)}%`} />
    </div></section>}
    {calc?.alerts?.length > 0 && <section><h4>AUTOMATIC ALERTS</h4>{calc.alerts.map((alert) => <div key={alert.code} className={`ew-alert ${alert.severity}`}>
      {alert.severity === "advisory" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}<div><strong>{alert.title}</strong><span>{alert.message}</span></div>
    </div>)}</section>}
    <button className="ew-save" disabled={saving} onClick={save}><Save size={15} />{saving ? "Saving and recalculating…" : "Save shared GIS data"}</button>
    <p className="ew-note">Saved changes update the same Laravel record used by the DALOY data editor.</p>
  </div>;
}

function M({ label, value }) { return <div className="ew-metric"><span>{label}</span><strong>{value}</strong></div>; }
function fmt(value) { return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
