import EditableWaterDataPanel from "./EditableWaterDataPanel";

import TariffAffordabilityPanel from "./TariffAffordabilityPanel";

import NRWSimulatorPanel from "./NRWSimulatorPanel";

import InterventionValuationPanel from "./InterventionValuationPanel";

import InvestPanel from "./InvestPanel";

import DecisionSnapshotPanel from "./DecisionSnapshotPanel";

import { useEffect, useMemo, useRef, useState } from "react";

import { motion, AnimatePresence } from "framer-motion";

import PublicBenefitPerPesoPanel from "./PublicBenefitPerPesoPanel";
import BarangayWorkflowPanel from "./BarangayWorkflowPanel";


import {

  Activity,

  Building2,
  Camera,

  ChevronDown,

  ChevronRight,

  CircleDollarSign,

  Droplets,

  Factory,

  Fish,

  Gauge,

  HeartPulse,

  Home,

  Landmark,

  Layers3,

  Map,

  Menu,

  Network,

  PanelLeftClose,

  PanelLeftOpen,

  Search,

  ShieldAlert,

  Sparkles,

  Sprout,

  Store,

  Waves,

  Wheat,

  X,

  Zap,

} from "lucide-react";

import LGUDataPanel from "./LGUDataPanel";

const dataCategories = [
  { id: "overview", label: "Overview", icon: Map },
  { id: "barangays", label: "Barangays", icon: Home },
  { id: "workflow", label: "Workflow", icon: Zap },
  { id: "water", label: "Water System", icon: Droplets },
  { id: "affordability", label: "Affordability", icon: CircleDollarSign },
  { id: "investment", label: "Investment", icon: Factory },
  { id: "benefits", label: "Public Benefits", icon: HeartPulse },
  { id: "decision", label: "Decision", icon: Activity },
];



const waterItems = [

  { key: "sources", label: "Water Sources", icon: Droplets },

  { key: "rivers", label: "Rivers / Creeks", icon: Waves },

  { key: "pipelines", label: "Pipelines", icon: Network },

  { key: "zones", label: "Service Zones", icon: Layers3 },

];



const publicItems = [

  { key: "households", label: "Households", icon: Home },

  { key: "health", label: "Health Facilities", icon: HeartPulse },

  { key: "schools", label: "Schools", icon: Landmark },

  { key: "government", label: "Government", icon: Building2 },

];

const publicInventory = {
  catbalogan: {
    households: { value: "23,107", detail: "households | 2020 census", source: "PSA Region VIII", href: "https://rsso08.psa.gov.ph/system/files/publication/2023%20Regional%20Social%20and%20Economic%20Trends%20-%20Eastern%20Visayas.pdf" },
    health: { value: "2", detail: "hospitals | 2024", source: "PSA Region VIII", href: "https://rsso08.psa.gov.ph/system/files/publication/CSW-202501-0800-03.pdf" },
    schools: { value: "58", detail: "schools | DepEd inventory", source: "DepEd NID", href: "https://nid.deped.gov.ph/public-dashboard/region/Region%20VIII/division/Catbalogan%20City" },
    government: { value: "31", detail: "city offices listed", source: "Catbalogan LGU", href: "https://catbalogancity.gov.ph/city-offices/" },
  },
  calbayog: {
    households: { value: "43,030", detail: "households | 2020 census", source: "PSA Region VIII", href: "https://rsso08.psa.gov.ph/system/files/publication/2023%20Regional%20Social%20and%20Economic%20Trends%20-%20Eastern%20Visayas.pdf" },
    health: { value: "3", detail: "hospitals | 2024", source: "PSA Region VIII", href: "https://rsso08.psa.gov.ph/system/files/publication/CSW-202501-0800-03.pdf" },
    schools: { value: "174", detail: "schools | DepEd inventory", source: "DepEd NID", href: "https://www.nid.deped.gov.ph/public-dashboard/region/Region%20VIII/division/Calbayog%20City" },
    government: { value: "Directory", detail: "city offices listed", source: "Calbayog LGU", href: "https://calbayog.gov.ph/lgu-directory/" },
  },
};



const sectorItems = [

  { key: "agriculture", label: "Agricultural land", icon: Wheat },

  { key: "fisheries", label: "Fisheries", icon: Fish },

  { key: "aquaculture", label: "Aquaculture", icon: Waves },

  { key: "business", label: "Businesses", icon: Store },
  { key: "tourism", label: "Tourism", icon: Camera },

];



const analysisItems = [

  { key: "productivity", label: "Water Productivity", icon: Gauge },

  { key: "economic-loss", label: "Economic Loss", icon: CircleDollarSign },

  { key: "water-burden", label: "Water Burden", icon: Activity },

  { key: "shortage", label: "Shortage Allocation", icon: ShieldAlert },

  { key: "investment", label: "Investment Priority", icon: Zap },

  { key: "dependency", label: "Source Dependency", icon: Network },

];



export default function MissionControlSidebar({

  outage,

  selectedBarangay,

  layers,

  toggleLayer,

  analysisMode,

  setAnalysisMode,

  focusSource,

  showDependencyArea,

  onToggleOutage,

  onBarangaySelect,
  onAskDaloy,
  lguKey,

}) {

  const [railCollapsed, setRailCollapsed] = useState(false);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const max = Math.max(240, Math.min(520, window.innerWidth - 52));
    const min = Math.min(300, max);
    try {
      const saved = Number(window.localStorage.getItem("daloy-gis-sidebar-width"));
      if (Number.isFinite(saved) && saved > 0) return Math.max(min, Math.min(max, saved));
    } catch { /* Use the default width when storage is unavailable. */ }
    return Math.max(min, Math.min(max, 380));
  });
  const resizeStartRef = useRef(null);

  const [activeWorkspace, setActiveWorkspace] = useState("water");

  const [dataOpen, setDataOpen] = useState(false);

  const [activeDataCategory, setActiveDataCategory] = useState("workflow");

  const [dataSelectedLGU, setDataSelectedLGU] = useState("Catbalogan City");

  const [dataSelectedBarangayCode, setDataSelectedBarangayCode] = useState("");

  const [dataBarangaySearch, setDataBarangaySearch] = useState("");

  const dataTabListRef = useRef(null);

  const [search, setSearch] = useState("");

  const publicInventoryKey = String(lguKey || "catbalogan").toLowerCase().includes("calbayog")
    ? "calbayog"
    : String(lguKey || "catbalogan").toLowerCase().includes("pinabacdao")
      ? "pinabacdao"
      : "catbalogan";

  const selectGisSector = (key) => {
    setAnalysisMode(key);
  };

  const resizeSidebar = (requestedWidth) => {
    const max = Math.max(240, Math.min(520, window.innerWidth - 52));
    const min = Math.min(300, max);
    const next = Math.round(Math.max(min, Math.min(max, requestedWidth)));
    setSidebarWidth(next);
    try { window.localStorage.setItem("daloy-gis-sidebar-width", String(next)); }
    catch { /* Resizing still works for this session when storage is unavailable. */ }
  };

  useEffect(() => {
    const fitSidebarToViewport = () => {
      const max = Math.max(240, Math.min(520, window.innerWidth - 52));
      const min = Math.min(300, max);
      setSidebarWidth((width) => Math.max(min, Math.min(max, width)));
    };
    window.addEventListener("resize", fitSidebarToViewport);
    return () => window.removeEventListener("resize", fitSidebarToViewport);
  }, []);

  const handleResizePointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStartRef.current = { x: event.clientX, width: sidebarWidth };
  };

  const handleResizePointerMove = (event) => {
    if (!resizeStartRef.current) return;
    resizeSidebar(resizeStartRef.current.width + event.clientX - resizeStartRef.current.x);
  };

  const handleResizePointerUp = () => {
    resizeStartRef.current = null;
  };

  const handleResizeKeyDown = (event) => {
    const step = event.shiftKey ? 32 : 16;
    if (event.key === "ArrowLeft") resizeSidebar(sidebarWidth - step);
    else if (event.key === "ArrowRight") resizeSidebar(sidebarWidth + step);
    else if (event.key === "Home") resizeSidebar(300);
    else if (event.key === "End") resizeSidebar(520);
    else return;
    event.preventDefault();
  };

  const handleDataTabKeyDown = (event) => {
    const tabs = Array.from(event.currentTarget.querySelectorAll('[role="tab"]'));
    const currentIndex = tabs.indexOf(document.activeElement);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    tabs[nextIndex]?.focus();
    tabs[nextIndex]?.click();
  };

  useEffect(() => {
    const tabList = dataTabListRef.current;
    const activeTab = tabList?.querySelector('[aria-selected="true"]');
    if (!tabList || !activeTab) return;

    const tabLeft = activeTab.offsetLeft;
    const tabRight = tabLeft + activeTab.offsetWidth;
    if (tabLeft < tabList.scrollLeft) {
      tabList.scrollTo({ left: tabLeft, behavior: "smooth" });
    } else if (tabRight > tabList.scrollLeft + tabList.clientWidth) {
      tabList.scrollTo({ left: tabRight - tabList.clientWidth, behavior: "smooth" });
    }
  }, [activeDataCategory]);



  const selectedSector = useMemo(() => {

    if (!selectedBarangay) return null;

    const lookup = {

      agriculture: selectedBarangay.agriculture_simulated,

      fisheries: selectedBarangay.fisheries_simulated,

      aquaculture: selectedBarangay.aquaculture_simulated,

      business: selectedBarangay.business_simulated,
      tourism: selectedBarangay.tourism_simulated || selectedBarangay.sector_meta?.tourism,

    };

    return lookup[analysisMode] || null;

  }, [selectedBarangay, analysisMode]);



  const nav = [

    { key: "water", label: "Water", icon: Droplets },

    { key: "economy", label: "Economy", icon: CircleDollarSign },

    { key: "public", label: "Public", icon: Home },

    { key: "analysis", label: "Analysis", icon: Sparkles },

    { key: "spatial", label: "GIS sectors", icon: Map },

  ];



  return (

    <aside className={`mc-shell ${railCollapsed ? "mc-collapsed" : ""}`} style={{ "--mc-sidebar-width": `${sidebarWidth}px` }}>

      <div className="mc-rail">

        <button

          className="mc-logo"

          type="button"

          title="DALOY"

          onClick={() => setRailCollapsed((v) => !v)}

        >

          <Droplets size={21} strokeWidth={2.2} />

        </button>



        <div className="mc-nav">

          {nav.map((item) => {

            const Icon = item.icon;

            const active = activeWorkspace === item.key;

            return (

              <button

                key={item.key}

                className={`mc-rail-btn ${active ? "active" : ""}`}

                type="button"

                title={item.label}

                onClick={() => {

                  setActiveWorkspace(item.key);

                  setRailCollapsed(false);

                }}

              >

                <Icon size={18} />

                {!railCollapsed && <span>{item.label}</span>}

              </button>

            );

          })}

        </div>



        <div className="mc-rail-bottom">

          <button

            className={`mc-rail-btn ${dataOpen ? "active" : ""}`}

            type="button"

            title="LGU Data"

            onClick={() => {

              setDataOpen((v) => !v);

              setRailCollapsed(false);

            }}

          >

            <Layers3 size={18} />

            {!railCollapsed && <span>LGU Data</span>}

          </button>



          <button

            className="mc-collapse-btn"

            type="button"

            onClick={() => setRailCollapsed((v) => !v)}

            title={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}

          >

            {railCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}

          </button>

        </div>

      </div>



      <AnimatePresence initial={false}>

        {!railCollapsed && (

          <motion.div

            className="mc-panel"

            initial={{ opacity: 0, x: -12 }}

            animate={{ opacity: 1, x: 0 }}

            exit={{ opacity: 0, x: -12 }}

            transition={{ duration: 0.18 }}

          >

            <div className="mc-head">

              <div>

                <div className="mc-kicker">WATER DECISION SYSTEM</div>

                <h1>DALOY</h1>

                <p>Decision support for Samar LGUs</p>

              </div>



              <div className={`mc-live ${outage ? "danger" : ""}`}>

                <span />

                {outage ? "OUTAGE" : "LIVE"}

              </div>

            </div>



            <div className="mc-context">

              <div>

                <span>Selected area</span>

                <strong>{selectedBarangay?.barangay || "No barangay selected"}</strong>

              </div>

              <button type="button" onClick={() => setDataOpen(true)}>

                Data

                <ChevronRight size={14} />

              </button>

            </div>



            <div className="mc-search">

              <Search size={15} />

              <input

                value={search}

                onChange={(e) => setSearch(e.target.value)}

                placeholder="Search tools, sectors, layers..."

              />

              {search && (

                <button type="button" onClick={() => setSearch("")}>

                  <X size={14} />

                </button>

              )}

            </div>



            <div className="mc-content">

              {activeWorkspace === "water" && (

                <Workspace

                  eyebrow="NETWORK"

                  title="Water System"

                  description="Infrastructure and natural water layers"

                >

                  <div className="mc-toggle-grid">

                    {waterItems.map(({ key, ...item }) => (

                      <LayerTile

                        key={key}

                        {...item}

                        checked={layers[key]}

                        onClick={() => toggleLayer(key)}

                      />

                    ))}

                  </div>



                  <div className="mc-command-row">

                    <CommandButton icon={Droplets} label="Focus source" onClick={focusSource} />

                    <CommandButton icon={Network} label="Dependency area" onClick={showDependencyArea} />

                  </div>

                </Workspace>

              )}



              {activeWorkspace === "economy" && (

                <Workspace

                  eyebrow="ECONOMIC ENGINE"

                  title="Water-dependent sectors"

                  description="Compare economic value, jobs and water intensity"

                >

                  <div className="mc-sector-list">

                    {sectorItems.map(({ key, ...item }) => (

                      <SectorButton

                        key={key}

                        {...item}

                        active={analysisMode === key}

                        onClick={() => setAnalysisMode(key)}

                      />

                    ))}

                  </div>



                  <SectorSnapshot

                    barangay={selectedBarangay}

                    sector={selectedSector}

                    mode={analysisMode}

                  />

                </Workspace>

              )}



              {activeWorkspace === "public" && (

                <Workspace

                  eyebrow="ESSENTIAL NEEDS"

                  title="Public welfare"

                  description="Basic needs and critical services"

                >

                  <div className="mc-toggle-grid">

                    {publicItems.map(({ key, ...item }) => {
                      const record = publicInventory[publicInventoryKey]?.[key];
                      return <LayerTile key={key} {...item} badge={record?.value} checked={layers[key]} onClick={() => toggleLayer(key)} />;
                    })}

                  </div>

                  <div className="mc-public-inventory">
                    <strong>Citywide public inventory</strong>
                    <p>Source totals are citywide. Map pins appear only when facility coordinates are verified.</p>
                    {publicItems.map(({ key, label }) => {
                      const record = publicInventory[publicInventoryKey]?.[key];
                      return <div className="mc-public-inventory-row" key={key}>
                        <span>{label}</span>
                        {record ? <><b>{record.value}</b><small>{record.detail} | <a href={record.href} target="_blank" rel="noreferrer">{record.source} (source)</a></small></> : <small>Published citywide total not available</small>}
                      </div>;
                    })}
                  </div>

                </Workspace>

              )}



              {activeWorkspace === "analysis" && (

                <Workspace

                  eyebrow="DECISION INTELLIGENCE"

                  title="Economic analysis"

                  description="Scenario tools for allocation and investment"

                >

                  <div className="mc-analysis-list">

                    {analysisItems.map((item) => (

                      <AnalysisItem

                        key={item.key}

                        {...item}

                        active={analysisMode === item.key}

                        onClick={() => setAnalysisMode(item.key)}

                      />

                    ))}

                  </div>

                </Workspace>

              )}



              {activeWorkspace === "spatial" && (

                <Workspace

                  eyebrow="GIS SECTORS"

                  title="Sector and service layers"

                  description="Barangay-level sector indicators and mapped public service locations"

                >

                  <div className="mc-subsection-title">Water-dependent sectors</div>
                  <div className="mc-sector-list">
                    {sectorItems.map(({ key, ...item }) => (
                      <SectorButton key={key} {...item} active={analysisMode === key} onClick={() => selectGisSector(key)} />
                    ))}
                  </div>
                  <SectorSnapshot barangay={selectedBarangay} sector={selectedSector} mode={analysisMode} onOpenData={() => setDataOpen(true)} />
                  <div className="mc-subsection-title">Public services</div>
                  <div className="mc-toggle-grid">
                    {publicItems.filter(({ key }) => key !== "households").map(({ key, ...item }) => {
                      const record = publicInventory[publicInventoryKey]?.[key];
                      return <LayerTile key={key} {...item} badge={record?.value} checked={layers[key]} onClick={() => toggleLayer(key)} />;
                    })}
                  </div>
<LayerTile

                    key="barangays"

                    label="Barangay boundaries"

                    icon={Map}

                    checked={layers.barangays}

                    onClick={() => toggleLayer("barangays")}

                    wide

                  />



                  <div className="mc-command-stack">

                    <CommandButton icon={Map} label="Fit dependency area" onClick={showDependencyArea} />

                    <CommandButton icon={Droplets} label="Focus water source" onClick={focusSource} />

                  </div>

                </Workspace>

              )}

            </div>



            <div className="mc-footer">

              <div>

                <span className="mc-footer-label">Analysis mode</span>

                <strong>{formatMode(analysisMode)}</strong>

              </div>

              <button

                type="button"

                className={outage ? "restore" : "outage"}

                onClick={onToggleOutage}

              >

                {outage ? "Restore supply" : "Simulate outage"}

              </button>

            </div>

          </motion.div>

        )}

      </AnimatePresence>



      <AnimatePresence>

        {dataOpen && !railCollapsed && (

          <motion.div

            className="mc-data-drawer"

            initial={{ opacity: 0, x: -24 }}

            animate={{ opacity: 1, x: 0 }}

            exit={{ opacity: 0, x: -24 }}

            transition={{ duration: 0.2 }}

          >

            <div className="mc-drawer-head">

              <div>

                <span>LOCAL DATA</span>

                <h2>LGU Explorer</h2>

              </div>

              <button type="button" onClick={() => setDataOpen(false)}>

                <X size={18} />

              </button>

            </div>



            <div ref={dataTabListRef} className="mc-data-tabs" role="tablist" aria-label="LGU data categories" onKeyDown={handleDataTabKeyDown}>
              {dataCategories.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  id={`mc-data-tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeDataCategory === id}
                  aria-controls={`mc-data-panel-${id}`}
                  tabIndex={activeDataCategory === id ? 0 : -1}
                  className={`mc-data-tab${activeDataCategory === id ? " active" : ""}`}
                  onClick={() => setActiveDataCategory(id)}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="mc-data-category-content">
              <section id="mc-data-panel-workflow" role="tabpanel" aria-labelledby="mc-data-tab-workflow" className="mc-data-category-panel" hidden={activeDataCategory !== "workflow"}>
                <BarangayWorkflowPanel selectedBarangay={selectedBarangay} onBarangayUpdate={onBarangaySelect} onAskDaloy={onAskDaloy} />
              </section>
              <section id="mc-data-panel-overview" role="tabpanel" aria-labelledby="mc-data-tab-overview" className="mc-data-category-panel" hidden={activeDataCategory !== "overview"}>
                <LGUDataPanel view="overview" selectedLGU={dataSelectedLGU} onLGUChange={(lgu) => { setDataSelectedLGU(lgu); setDataSelectedBarangayCode(""); setDataBarangaySearch(""); }} activeBarangay={selectedBarangay} onBarangaySelect={onBarangaySelect} selectedBarangayCode={dataSelectedBarangayCode} search={dataBarangaySearch} onSearchChange={setDataBarangaySearch} />
              </section>
              <section id="mc-data-panel-barangays" role="tabpanel" aria-labelledby="mc-data-tab-barangays" className="mc-data-category-panel" hidden={activeDataCategory !== "barangays"}>
                <LGUDataPanel view="barangays" selectedLGU={dataSelectedLGU} onLGUChange={(lgu) => { setDataSelectedLGU(lgu); setDataSelectedBarangayCode(""); setDataBarangaySearch(""); }} activeBarangay={selectedBarangay} onBarangaySelect={(barangay) => { setDataSelectedBarangayCode(barangay.psgc_code); onBarangaySelect(barangay); }} selectedBarangayCode={dataSelectedBarangayCode} search={dataBarangaySearch} onSearchChange={setDataBarangaySearch} />
              </section>
              <section id="mc-data-panel-water" role="tabpanel" aria-labelledby="mc-data-tab-water" className="mc-data-category-panel" hidden={activeDataCategory !== "water"}>
                <EditableWaterDataPanel psgcCode={selectedBarangay?.psgc_code} onSaved={(data) => { onBarangaySelect(data.record); console.log("Latest calculated state:", data.calculated); }} />
                <NRWSimulatorPanel psgcCode={selectedBarangay?.psgc_code} onSaved={(data) => { onBarangaySelect(data.record); console.log("NRW scenario recalculated:", data.nrw); }} />
              </section>
              <section id="mc-data-panel-affordability" role="tabpanel" aria-labelledby="mc-data-tab-affordability" className="mc-data-category-panel" hidden={activeDataCategory !== "affordability"}>
                <TariffAffordabilityPanel psgcCode={selectedBarangay?.psgc_code} onSaved={(data) => { onBarangaySelect(data.record); console.log("Tariff scenario recalculated:", data.calculated); }} />
              </section>
              <section id="mc-data-panel-investment" role="tabpanel" aria-labelledby="mc-data-tab-investment" className="mc-data-category-panel" hidden={activeDataCategory !== "investment"}>
                <InvestPanel psgcCode={selectedBarangay?.psgc_code} selectedBarangay={selectedBarangay} />
                <InterventionValuationPanel psgcCode={selectedBarangay?.psgc_code} />
              </section>
              <section id="mc-data-panel-benefits" role="tabpanel" aria-labelledby="mc-data-tab-benefits" className="mc-data-category-panel" hidden={activeDataCategory !== "benefits"}>
                <PublicBenefitPerPesoPanel psgcCode={selectedBarangay?.psgc_code} />
              </section>
              <section id="mc-data-panel-decision" role="tabpanel" aria-labelledby="mc-data-tab-decision" className="mc-data-category-panel" hidden={activeDataCategory !== "decision"}>
                <DecisionSnapshotPanel psgcCode={selectedBarangay?.psgc_code} />
              </section>
            </div>


          </motion.div>

        )}

      </AnimatePresence>

      {!railCollapsed && <div
        className="mc-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize GIS sidebar"
        aria-valuemin={Math.min(300, Math.max(240, window.innerWidth - 52))}
        aria-valuemax={Math.max(240, Math.min(520, window.innerWidth - 52))}
        aria-valuenow={sidebarWidth}
        aria-valuetext={`${sidebarWidth} pixels wide`}
        tabIndex={0}
        title="Drag to resize sidebar; use arrow keys for fine adjustment"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerUp}
        onLostPointerCapture={handleResizePointerUp}
        onKeyDown={handleResizeKeyDown}
      />}

    </aside>

  );

}

function Workspace({ eyebrow, title, description, children }) {

  return (

    <motion.section

      className="mc-workspace"

      initial={{ opacity: 0, y: 8 }}

      animate={{ opacity: 1, y: 0 }}

      transition={{ duration: 0.18 }}

    >

      <div className="mc-section-head">

        <span>{eyebrow}</span>

        <h2>{title}</h2>

        <p>{description}</p>

      </div>

      {children}

    </motion.section>

  );

}



function LayerTile({ icon: Icon, label, checked, onClick, wide = false, badge }) {

  return (

    <button

      className={`mc-layer-tile ${checked ? "active" : ""} ${wide ? "wide" : ""}`}

      type="button"

      onClick={onClick}

    >

      <div className="mc-layer-icon">

        <Icon size={17} />

      </div>

      <span>{label}</span>

      {badge && <small className="mc-layer-badge">{badge}</small>}

      <div className={`mc-switch ${checked ? "on" : ""}`}>

        <i />

      </div>

    </button>

  );

}



function SectorButton({ icon: Icon, label, active, onClick }) {

  return (

    <motion.button

      className={`mc-sector ${active ? "active" : ""}`}

      type="button"

      onClick={onClick}

      whileHover={{ x: 3 }}

      whileTap={{ scale: 0.985 }}

    >

      <div className="mc-sector-icon">

        <Icon size={18} />

      </div>

      <div>

        <strong>{label}</strong>

        <span>Water + economic impact</span>

      </div>

      <ChevronRight size={16} />

    </motion.button>

  );

}



function AnalysisItem({ icon: Icon, label, active, onClick }) {

  return (

    <motion.button

      className={`mc-analysis-item ${active ? "active" : ""}`}

      type="button"

      onClick={onClick}

      whileHover={{ x: 3 }}

    >

      <Icon size={17} />

      <span>{label}</span>

      <ChevronRight size={14} />

    </motion.button>

  );

}



function CommandButton({ icon: Icon, label, onClick }) {

  return (

    <button className="mc-command" type="button" onClick={onClick}>

      <Icon size={15} />

      {label}

    </button>

  );

}



function SectorSnapshot({ barangay, sector, mode, onOpenData }) {

  const sectorModes = ["agriculture", "fisheries", "aquaculture", "business", "tourism"];

  if (!sectorModes.includes(mode)) {

    return (

      <div className="mc-empty-card">

        Select a sector to compare its water demand and economic contribution.

      </div>

    );

  }



  if (!barangay || !sector) {

    return (

      <div className="mc-empty-card">

        {!barangay
          ? "The selected sector layer is shown on the map. Choose a barangay to view or edit its saved economic indicators."
          : mode === "tourism"
            ? "Tourism is available as a GIS sector, but this dataset does not yet include tourism indicators. Add tourism records to the shared GIS database to populate this snapshot."
            : "This barangay does not have indicators for the selected sector yet."}
        <button className="mc-sector-edit" type="button" onClick={onOpenData}>
          {barangay ? "Open shared GIS data" : "Choose barangay"}
        </button>

      </div>

    );

  }



  return (

    <div className="mc-sector-snapshot">

      <div className="mc-snapshot-title">

        <span>BARANGAY SECTOR SNAPSHOT</span>

        <strong>{barangay.barangay}</strong>

      </div>



      <Metric label="Water" value={`${sector.water_demand_m3_day} m³/d`} />

      <Metric label="Workers" value={Number(sector.workers_supported || 0).toLocaleString()} />

      <Metric

        label="Output"

        value={`₱${Number(sector.economic_output_php_day || 0).toLocaleString()}/d`}

      />

      <Metric

        label="Value / m³"

        value={`₱${Number(sector.economic_output_php_per_m3 || 0).toLocaleString()}`}

      />

      <button className="mc-sector-edit" type="button" onClick={onOpenData}>Edit shared GIS data</button>

    </div>

  );

}



function Metric({ label, value }) {

  return (

    <div className="mc-snapshot-metric">

      <span>{label}</span>

      <strong>{value}</strong>

    </div>

  );

}



function formatMode(value) {

  return String(value || "")

    .replaceAll("-", " ")

    .replace(/\b\w/g, (c) => c.toUpperCase());

}
