import { useMemo } from "react";
import waterEconomyData from "./data/water_economy_dataset_v3_238_barangays_sectors.json";
import "./LGUDataPanel.css";

export default function LGUDataPanel({
  onBarangaySelect,
  activeBarangay,
  view = "all",
  selectedLGU = "Catbalogan City",
  onLGUChange,
  selectedBarangayCode = "",
  search = "",
  onSearchChange,
}) {

  const barangays = waterEconomyData.barangays || [];
  const lguBaselines = waterEconomyData.lgu_baselines || [];

  const lguBarangays = useMemo(() => {
    return barangays
      .filter((b) => b.lgu === selectedLGU)
      .filter((b) => b.barangay.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.barangay.localeCompare(b.barangay));
  }, [barangays, selectedLGU, search]);

  const datasetBarangay = barangays.find(
    (b) => b.psgc_code === selectedBarangayCode
  );
  const selectedBarangay = activeBarangay?.psgc_code === selectedBarangayCode
    ? activeBarangay
    : datasetBarangay;

  const baseline = lguBaselines.find((item) => item.lgu === selectedLGU);

  function handleLGUChange(e) {
    onLGUChange?.(e.target.value);
  }

  function handleBarangayClick(barangay) {
    onBarangaySelect?.(barangay);
  }

  const number = (value) =>
    value === null || value === undefined
      ? "N/A"
      : Number(value).toLocaleString();

  const peso = (value) =>
    value === null || value === undefined
      ? "N/A"
      : `₱${Number(value).toLocaleString()}`;

  const riskClass = (risk) =>
    risk ? risk.toLowerCase().replace(/\s+/g, "-") : "";
  const showOverview = view === "all" || view === "overview";
  const showBarangays = view === "all" || view === "barangays";

  return (
    <div className="lgu-panel">
      <div className="lgu-glow" />

      {showOverview && <>
      <div className="lgu-panel-header">
        <div className="panel-icon">◈</div>
        <div>
          <h2>DALOY Data Intelligence</h2>
          <p>Barangay-level water and economic decision support</p>
        </div>
      </div>

      <div className="lgu-controls">
        <label>Local Government Unit</label>
        <select value={selectedLGU} onChange={handleLGUChange}>
          <option value="Catbalogan City">Catbalogan City</option>
          <option value="Pinabacdao">Pinabacdao</option>
          <option value="Calbayog City">Calbayog City</option>
        </select>
      </div>

      {baseline && (
        <div className="lgu-summary">
          <Summary label="Population" value={number(baseline.population_2024_psa)} />
          <Summary label="Est. Households" value={number(baseline.households_2024_estimated)} />
          <Summary label="Domestic Demand" value={`${baseline.basic_domestic_demand_ml_day_estimated} ML/d`} />
          <Summary label="Production Need" value={`${baseline.gross_production_requirement_ml_day_at_15pct_nrw_estimated} ML/d`} />
        </div>
      )}

      <div className="data-note">
        PSA-backed population is combined with derived household and domestic-demand estimates.
        Economic and sector indicators are simulated prototype values.
      </div>
      </>}

      {showBarangays && <>
      {view === "barangays" && <div className="lgu-controls">
        <label>Local Government Unit</label>
        <select value={selectedLGU} onChange={handleLGUChange}>
          <option value="Catbalogan City">Catbalogan City</option>
          <option value="Pinabacdao">Pinabacdao</option>
          <option value="Calbayog City">Calbayog City</option>
        </select>
      </div>}
      <div className="barangay-section">
        <div className="barangay-section-title">
          <span>Barangays</span>
          <span className="barangay-count">{lguBarangays.length}</span>
        </div>

        <input
          className="barangay-search"
          type="text"
          placeholder="Search barangay..."
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />

        <div className="barangay-list">
          {lguBarangays.map((barangay) => (
            <button
              key={barangay.psgc_code}
              className={`barangay-item ${
                selectedBarangayCode === barangay.psgc_code ? "selected" : ""
              }`}
              onClick={() => handleBarangayClick(barangay)}
            >
              <div>
                <strong>{barangay.barangay}</strong>
                <span>{barangay.urban_rural_psa}</span>
              </div>
              <div className="barangay-population">
                {number(barangay.population_2024_psa)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedBarangay && (
        <div className="barangay-details">
          <div className="details-header">
            <div>
              <span className="details-label">Selected Barangay</span>
              <h3>{selectedBarangay.barangay}</h3>
              <p>{selectedBarangay.lgu}</p>
            </div>

            <div className={`risk-badge ${riskClass(selectedBarangay.shortage_risk_simulated)}`}>
              {selectedBarangay.shortage_risk_simulated} Risk
            </div>
          </div>

          <div className="details-grid">
            <DataItem label="Population" value={number(selectedBarangay.population_2024_psa)} type="PSA" />
            <DataItem label="Est. Households" value={number(selectedBarangay.households_2024_estimated)} type="Derived" />
            <DataItem label="Domestic Demand" value={`${selectedBarangay.basic_domestic_demand_ml_day_estimated} ML/day`} type="Derived" />
            <DataItem label="Household Income" value={peso(selectedBarangay.avg_household_income_php_simulated)} type="Simulated" />
            <DataItem label="Water Burden" value={`${selectedBarangay.water_burden_pct_simulated}%`} type="Simulated" />
            <DataItem label="Reliability" value={`${selectedBarangay.supply_reliability_pct_simulated}%`} type="Simulated" />
          </div>

          <div className="sector-title">Economic Water Sectors</div>

          <div className="sector-grid">
            <SectorCard
              icon="🌾"
              name="Agriculture"
              sector={selectedBarangay.agriculture_simulated}
              countLabel="Farms"
              countValue={selectedBarangay.agriculture_simulated?.farms_count}
            />
            <SectorCard
              icon="🐟"
              name="Fisheries"
              sector={selectedBarangay.fisheries_simulated}
              countLabel="Fishery HH"
              countValue={selectedBarangay.fisheries_simulated?.fishery_households}
            />
            <SectorCard
              icon="🦐"
              name="Aquaculture"
              sector={selectedBarangay.aquaculture_simulated}
              countLabel="Sites"
              countValue={selectedBarangay.aquaculture_simulated?.sites_count}
            />
            <SectorCard
              icon="🏪"
              name="Businesses"
              sector={selectedBarangay.business_simulated}
              countLabel="Establishments"
              countValue={selectedBarangay.business_simulated?.establishments_count}
            />
          </div>

          <div className="intervention-box">
            <span>Suggested Intervention</span>
            <strong>{selectedBarangay.recommended_intervention_simulated}</strong>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}

function Summary({ label, value }) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DataItem({ label, value, type }) {
  return (
    <div className="data-item">
      <span className="data-item-label">{label}</span>
      <strong>{value}</strong>
      <small>{type}</small>
    </div>
  );
}

function SectorCard({ icon, name, sector, countLabel, countValue }) {
  if (!sector) return null;

  return (
    <div className="sector-card">
      <div className="sector-card-top">
        <span className="sector-icon">{icon}</span>
        <strong>{name}</strong>
      </div>

      <div className="sector-stat">
        <span>{countLabel}</span>
        <b>{Number(countValue || 0).toLocaleString()}</b>
      </div>

      <div className="sector-stat">
        <span>Workers</span>
        <b>{Number(sector.workers_supported || 0).toLocaleString()}</b>
      </div>

      <div className="sector-stat">
        <span>Water</span>
        <b>{sector.water_demand_m3_day} m³/d</b>
      </div>

      <div className="sector-stat">
        <span>Output</span>
        <b>₱{Number(sector.economic_output_php_day || 0).toLocaleString()}/d</b>
      </div>

      <div className="sector-stat">
        <span>Value / m³</span>
        <b>₱{Number(sector.economic_output_php_per_m3 || 0).toLocaleString()}</b>
      </div>

      <div className={`sector-sensitivity ${sector.shortage_sensitivity?.toLowerCase()}`}>
        {sector.shortage_sensitivity} shortage sensitivity
      </div>
    </div>
  );
}
