import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Activity, Database, MapPin, Pencil, RefreshCw, Save, Search, Wifi, WifiOff, X } from "lucide-react";
import { getBarangayDetail, updateBarangay, type BarangayDetail, type BarangayRecord } from "./backendApi";
import "./backendData.css";

type BackendDataPanelProps = {
  records: BarangayRecord[];
  status: "loading" | "connected" | "unavailable";
  error: string;
  selectedCode: string;
  onSelectCode: (code: string) => void;
  onRetry: () => void;
  onFocusLgu: (lgu: string) => void;
  onRecordSaved?: (record: BarangayRecord & Record<string, unknown>) => void;
};

const number = (value: unknown) => typeof value === "number"
  ? value.toLocaleString("en-US", { maximumFractionDigits: 1 })
  : "—";

const editGroups = [
  { title: "Water system", fields: [
    ["gross_supply_m3_day", "Gross supply", "m³/day"],
    ["source_capacity_m3_day", "Source capacity", "m³/day"],
    ["nrw_rate_pct", "Non-revenue water", "%"],
    ["reserve_rate_pct", "Protected reserve", "%"],
    ["supply_reliability_pct", "Supply reliability", "%"],
    ["piped_access_pct", "Piped access", "%"],
  ] },
  { title: "Affordability", fields: [
    ["tariff_php_m3", "Current tariff", "₱/m³"],
    ["proposed_tariff_php_m3", "Proposed tariff", "₱/m³"],
    ["avg_household_income_php", "Household income", "₱/month"],
    ["monthly_water_cost_php", "Monthly water cost", "₱/month"],
  ] },
  { title: "Sector demand", fields: [
    ["household_demand_m3_day", "Households", "m³/day"],
    ["critical_services_demand_m3_day", "Critical services", "m³/day"],
    ["agriculture_demand_m3_day", "Agriculture", "m³/day"],
    ["fisheries_demand_m3_day", "Fisheries", "m³/day"],
    ["aquaculture_demand_m3_day", "Aquaculture", "m³/day"],
    ["business_demand_m3_day", "Business", "m³/day"],
    ["industry_demand_m3_day", "Industry", "m³/day"],
  ] },
  { title: "Sector allocation", fields: [
    ["household_allocated_m3_day", "Households", "m³/day"],
    ["critical_services_allocated_m3_day", "Critical services", "m³/day"],
    ["agriculture_allocated_m3_day", "Agriculture", "m³/day"],
    ["fisheries_allocated_m3_day", "Fisheries", "m³/day"],
    ["aquaculture_allocated_m3_day", "Aquaculture", "m³/day"],
    ["business_allocated_m3_day", "Business", "m³/day"],
    ["industry_allocated_m3_day", "Industry", "m³/day"],
  ] },
] as const;

export default function BackendDataPanel({
  records, status, error, selectedCode, onSelectCode, onRetry, onFocusLgu, onRecordSaved,
}: BackendDataPanelProps) {
  const [detail, setDetail] = useState<BarangayDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const loadDetail = useCallback(async (signal?: AbortSignal) => {
    if (!selectedCode) {
      setDetail(null);
      return null;
    }
    try {
      const next = await getBarangayDetail(selectedCode, signal);
      setDetail(next);
      setForm(Object.fromEntries(Object.entries(next.record).map(([key, value]) => [key, value == null ? "" : String(value)])));
      setDetailError("");
      return next;
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name !== "AbortError") setDetailError(requestError.message);
      return null;
    }
  }, [selectedCode, onRecordSaved]);

  useEffect(() => {
    setDetail(null);
    setDetailError("");
    setEditing(false);
    const controller = new AbortController();
    void loadDetail(controller.signal);
    return () => controller.abort();
  }, [loadDetail]);

  useEffect(() => {
    const refreshFromOtherView = (event: Event) => {
      const update = event instanceof StorageEvent
        ? (() => { try { return JSON.parse(event.newValue || "{}"); } catch { return {}; } })()
        : (event as CustomEvent<{ code?: string }>).detail;
      if (!selectedCode || update?.code !== selectedCode) return;
      void loadDetail().then((next) => { if (next) onRecordSaved?.(next.record); });
    };
    window.addEventListener("water-economy:barangay-updated", refreshFromOtherView);
    window.addEventListener("storage", refreshFromOtherView);
    return () => {
      window.removeEventListener("water-economy:barangay-updated", refreshFromOtherView);
      window.removeEventListener("storage", refreshFromOtherView);
    };
  }, [loadDetail, onRecordSaved, selectedCode]);

  const matches = records.filter((record) =>
    `${record.barangay} ${record.lgu} ${record.psgc_code}`.toLowerCase().includes(search.toLowerCase()),
  ).slice(0, 30);
  const water = detail?.calculated.water;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail || saving) return;
    const values: Record<string, number | string> = {};
    for (const group of editGroups) {
      for (const [key] of group.fields) values[key] = Number(form[key] || 0);
    }
    values.livelihood_profile = form.livelihood_profile || "";
    setSaving(true);
    setDetailError("");
    try {
      const updated = await updateBarangay(selectedCode, values);
      setDetail(updated);
      setForm(Object.fromEntries(Object.entries(updated.record).map(([key, value]) => [key, value == null ? "" : String(value)])));
      setEditing(false);
      onRecordSaved?.(updated.record);
    } catch (requestError) {
      setDetailError(requestError instanceof Error ? requestError.message : "Could not save the database record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="backend-data-panel" aria-labelledby="backend-data-title">
      <header className="backend-data-heading">
        <div className="backend-data-title">
          <span className="backend-data-icon"><Database size={17} /></span>
          <div>
            <h2 id="backend-data-title">DULOY shared data</h2>
            <p>Shared barangay records used by the GIS data editor.</p>
          </div>
        </div>
        <span className={`backend-status ${status}`}>
          {status === "connected" ? <Wifi size={13} /> : status === "unavailable" ? <WifiOff size={13} /> : <Activity size={13} />}
          {status === "connected" ? `${records.length} records connected` : status === "loading" ? "Connecting" : "Backend unavailable"}
        </span>
      </header>

      {status === "unavailable" ? (
        <div className="backend-empty" role="status">
          <p>{error || "Start the Laravel backend to load the database."}</p>
          <button className="button secondary" onClick={onRetry}><RefreshCw size={14} /> Retry connection</button>
        </div>
      ) : (
        <div className="backend-data-grid">
          <div className="backend-data-browser">
            <label className="backend-search">
              <Search size={15} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a barangay or LGU" aria-label="Search database barangays" />
            </label>
            <label className="backend-select-label" htmlFor="backend-barangay-select">Database area</label>
            <select id="backend-barangay-select" value={selectedCode} onChange={(event) => onSelectCode(event.target.value)} disabled={!records.length}>
              <option value="">Select a barangay</option>
              {matches.map((record) => <option key={record.psgc_code} value={record.psgc_code}>{record.barangay} · {record.lgu}</option>)}
            </select>
            <p className="backend-match-count">{records.length ? `Showing ${matches.length} of ${records.length} database records` : "Waiting for database records"}</p>
            {detail && <button className="backend-map-link" onClick={() => onFocusLgu(detail.record.lgu)}><MapPin size={14} /> Locate {detail.record.lgu} on the Samar map</button>}
          </div>

          <div className="backend-indicators" aria-live="polite">
            {detail ? <>
              <div className="backend-area-title"><span>{detail.record.lgu}</span><h3>{detail.record.barangay}</h3><small>PSGC {detail.record.psgc_code} · {detail.record.urban_rural || "Classification not set"} · population {number(detail.record.population_2024)}</small></div>
              {detailError && <p className="backend-error" role="alert">{detailError}</p>}
              {editing ? (
                <form className="backend-edit-form" onSubmit={save}>
                  {editGroups.map((group) => <fieldset key={group.title}>
                    <legend>{group.title}</legend>
                    <div className="backend-edit-grid">
                      {group.fields.map(([key, label, unit]) => <label key={key}>
                        <span>{label}</span>
                        <div><input type="number" min="0" step="any" value={form[key] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /><small>{unit}</small></div>
                      </label>)}
                    </div>
                  </fieldset>)}
                  <label className="backend-livelihood-label">Livelihood profile<input value={form.livelihood_profile ?? ""} onChange={(event) => setForm((current) => ({ ...current, livelihood_profile: event.target.value }))} /></label>
                  <div className="backend-edit-actions">
                    <button type="button" className="button secondary" onClick={() => { setEditing(false); if (detail) setForm(Object.fromEntries(Object.entries(detail.record).map(([key, value]) => [key, value == null ? "" : String(value)]))); }}><X size={14} /> Cancel</button>
                    <button type="submit" className="button primary" disabled={saving}><Save size={14} /> {saving ? "Saving…" : "Save to GIS data"}</button>
                  </div>
                </form>
              ) : <>
                <div className="backend-metric-grid">
                  <div><small>Usable water</small><strong>{number(water?.usable_water_m3_day)} <i>m³/day</i></strong></div>
                  <div><small>Total demand</small><strong>{number(water?.total_demand_m3_day)} <i>m³/day</i></strong></div>
                  <div><small>Modeled deficit</small><strong>{number(water?.deficit_m3_day)} <i>m³/day</i></strong></div>
                  <div><small>Non-revenue water</small><strong>{number(water?.nrw_rate_pct)}<i>%</i></strong></div>
                </div>
                <p className="backend-data-footnote">Affordability: {detail.calculated.affordability?.affordability_class || "not classified"}. Last saved version {detail.record.data_version}.</p>
                <button className="backend-edit-button" onClick={() => setEditing(true)}><Pencil size={14} /> Edit this GIS-linked record</button>
              </>}
            </> : detailError ? <p className="backend-error" role="alert">{detailError}</p> : <div className="backend-placeholder"><Database size={22} /><span>Select a barangay to load its editable database record.</span></div>}
          </div>
        </div>
      )}
    </section>
  );
}
