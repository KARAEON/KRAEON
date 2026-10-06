import waterEconomyData from "./data/water_economy_dataset_v3_238_barangays_sectors.json";
import barangayBoundaryData from "./data/samar_barangay_boundaries.json";
import verifiedSectorData from "./data/calbayog_verified_sector_indicators.json";

import developmentAssets from "./data/development_asset_bank_water_economy.json";

import LGUDataPanel from "./LGUDataPanel";

import { useEffect, useRef, useState } from "react";

import * as maplibregl from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

maplibregl.setWorkerUrl(mapLibreWorkerUrl);

import * as turf from "@turf/turf";

import "maplibre-gl/dist/maplibre-gl.css";

import "./App.css";
import "./Sidebar3D.css";

import ChatAssistant from "./ChatAssistant";
import MissionControlSidebar from "./MissionControlSidebar";
import ScenarioDock from "./ScenarioDock";
import "./MissionControl.css";
import { getBarangay, getBarangayRecords, subscribeToBarangayUpdates } from "./waterEconomyApi";





/*

  WATER ECONOMY GIS PROTOTYPE



  IMPORTANT:

  Most facilities, pipelines, service zones and statistics below

  are DEMO DATA for your hackathon prototype.

*/



// ==============================

// WATER SOURCE

// ==============================



const sourceFeatures = {

  type: "FeatureCollection",

  features: [

    {

      type: "Feature",



      properties: {

        id: "masacpasac",

        name: "Masacpasac Spring",

        type: "Water Source",

        status: "Normal",



        flow: "Demo: 2.14 ML/day",



        households: 624,

        schools: 2,

        health: 1,

        population: 2370,

      },



      geometry: {

        type: "Point",

        coordinates: [124.91967, 11.81633],

      },

    },

  ],

};



// ==============================

// FACILITIES

// ==============================



const facilityFeatures = {
  type: "FeatureCollection",
  // Source counts are shown in Public welfare; synthetic sample points are not mapped.
  features: [],
};



// ==============================

// HOUSEHOLDS

// ==============================



const householdCoordinates = [

  [124.8935, 11.787],

  [124.891, 11.7845],

  [124.8888, 11.781],

  [124.886, 11.7792],

  [124.8838, 11.7775],

  [124.8817, 11.7755],

  [124.8798, 11.7782],

  [124.8844, 11.783],

  [124.8898, 11.788],

  [124.896, 11.79],

];



const householdFeatures = {
  type: "FeatureCollection",
  // Census totals are citywide and do not represent geocoded household locations.
  features: [],
};



// ==============================

// PIPELINES

// ==============================



const pipelineFeatures = {

  type: "FeatureCollection",



  features: [

    {

      type: "Feature",



      properties: {

        id: "main-pipeline",

        name: "Demo Main Pipeline",

        type: "main",

      },



      geometry: {

        type: "LineString",



        coordinates: [

          [124.91967, 11.81633],

          [124.909, 11.805],

          [124.901, 11.795],

          [124.892, 11.786],

          [124.883, 11.778],

        ],

      },

    },



    {

      type: "Feature",



      properties: {

        id: "distribution-pipeline",

        name: "Demo Distribution Pipeline",

        type: "distribution",

      },



      geometry: {

        type: "LineString",



        coordinates: [

          [124.892, 11.786],

          [124.887, 11.782],

          [124.881, 11.777],

        ],

      },

    },

  ],

};



// ==============================

// SERVICE ZONE

// ==============================



const serviceZone = {

  type: "FeatureCollection",



  features: [

    {

      type: "Feature",



      properties: {

        id: "zone-a",

        name: "Demo Service Zone A",

        source: "Masacpasac Spring",

      },



      geometry: {

        type: "Polygon",



        coordinates: [

          [

            [124.9025, 11.7945],

            [124.9015, 11.775],

            [124.876, 11.7705],

            [124.8745, 11.7895],

            [124.9025, 11.7945],

          ],

        ],

      },

    },

  ],

};



// ==============================

// BARANGAY DEMO BOUNDARY

// ==============================



const barangayBoundary = {

  type: "FeatureCollection",



  features: [

    {

      type: "Feature",



      properties: {

        name: "Demo Barangay Boundary",

      },



      geometry: {

        type: "Polygon",



        coordinates: [

          [

            [124.908, 11.799],

            [124.907, 11.767],

            [124.868, 11.765],

            [124.867, 11.798],

            [124.908, 11.799],

          ],

        ],

      },

    },

  ],

};



// ==============================

// RIVER

// ==============================



const riverFeatures = {

  type: "FeatureCollection",



  features: [

    {

      type: "Feature",



      properties: {

        name: "Demo River / Creek",

      },



      geometry: {

        type: "LineString",



        coordinates: [

          [124.93, 11.824],

          [124.92, 11.814],

          [124.911, 11.804],

          [124.904, 11.796],

        ],

      },

    },

  ],

};

// This prototype has a fully drawn example network around Catbalogan. Until
// surveyed asset coordinates are available, show a clearly labeled schematic
// version in the other pilot LGUs instead of leaving their GIS maps empty.
const translateFeatureCollection = (collection, delta, lguName) => {
  const shiftCoordinates = (value) => {
    if (typeof value?.[0] === "number" && typeof value?.[1] === "number") {
      return [value[0] + delta[0], value[1] + delta[1], ...value.slice(2)];
    }
    return value.map(shiftCoordinates);
  };

  return {
    ...collection,
    features: collection.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        name: feature.properties.id === "masacpasac"
          ? `${lguName} Illustrative Water Source`
          : feature.properties.name
            ? `${lguName} ${feature.properties.name.replace(/^Demo |^Sample /, "")}`
            : feature.properties.name,
        lgu: lguName,
        illustrative: true,
      },
      geometry: {
        ...feature.geometry,
        coordinates: shiftCoordinates(feature.geometry.coordinates),
      },
    })),
  };
};

const buildLguMapLayers = (lgu, center) => {
  if (!lgu || lgu === "catbalogan" || lgu === "samar") {
    return {
      sources: sourceFeatures,
      facilities: facilityFeatures,
      households: householdFeatures,
      pipelines: pipelineFeatures,
      zones: serviceZone,
      barangays: barangayBoundary,
      rivers: riverFeatures,
    };
  }

  const delta = [center[0] - 124.887, center[1] - 11.776];
  const lguName = lgu === "calbayog" ? "Calbayog" : "Pinabacdao";
  return {
    sources: translateFeatureCollection(sourceFeatures, delta, lguName),
    facilities: translateFeatureCollection(facilityFeatures, delta, lguName),
    households: translateFeatureCollection(householdFeatures, delta, lguName),
    pipelines: translateFeatureCollection(pipelineFeatures, delta, lguName),
    zones: translateFeatureCollection(serviceZone, delta, lguName),
    barangays: translateFeatureCollection(barangayBoundary, delta, lguName),
    rivers: translateFeatureCollection(riverFeatures, delta, lguName),
  };
};

const SECTOR_MAP_MODES = ["agriculture", "fisheries", "aquaculture", "business", "tourism"];
const SECTOR_MAP_LABELS = {
  agriculture: "Agricultural land",
  fisheries: "Fisheries",
  aquaculture: "Aquaculture",
  business: "Businesses",
  tourism: "Tourism",
};

const BOUNDARY_LGU_NAMES = {
  calbayog: "Calbayog City",
  "calbayog city": "Calbayog City",
  catbalogan: "Catbalogan City",
  "catbalogan city": "Catbalogan City",
  pinabacdao: "Pinabacdao",
};

const SECTOR_COLOR_RAMPS = {
  agriculture: ["#dcfce7", "#86efac", "#22c55e", "#15803d"],
  fisheries: ["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8"],
  aquaculture: ["#ccfbf1", "#5eead4", "#14b8a6", "#0f766e"],
  business: ["#fef3c7", "#fcd34d", "#f59e0b", "#b45309"],
  tourism: ["#ffe4e6", "#fda4af", "#f43f5e", "#be123c"],
};

const sectorFillColorExpression = (mode, breaks) => {
  const ramp = SECTOR_COLOR_RAMPS[mode] || SECTOR_COLOR_RAMPS.agriculture;
  if (mode === "aquaculture") {
    return ["case", ["==", ["get", "sector_value"], null], "#e9e3ed", ramp[2]];
  }
  return [
    "case", ["==", ["get", "sector_value"], null], "#e9e3ed",
    ["interpolate", ["linear"], ["get", "sector_value"],
      breaks[0], ramp[0], breaks[1], ramp[1], breaks[2], ramp[2], breaks[3], ramp[3]],
  ];
};

const normalizeBarangayName = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]/g, "");

const CALBAYOG_SOURCE_BARANGAY_ALIASES = {
  barral: "manuelbarralsr",
};

const sourceBarangayKey = (value) => {
  const key = normalizeBarangayName(value);
  return CALBAYOG_SOURCE_BARANGAY_ALIASES[key] || key;
};

const sectorDataForLgu = (lguName) => lguName === verifiedSectorData.lgu
  ? verifiedSectorData
  : verifiedSectorData.additional_lgus?.[lguName] || {};

const sectorSourceMetadata = (mode, lguName) => sectorDataForLgu(lguName).sources?.[mode]
  || verifiedSectorData.additional_lgus?.[lguName]?.sources?.[mode]
  || verifiedSectorData.sources[mode];

const sectorSourceValues = (mode, lguName) => {
  const data = sectorDataForLgu(lguName);
  if (mode === "agriculture") return data.agriculture_irrigated_area_ha_2018 || {};
  if (mode === "aquaculture") return Object.fromEntries(
    (data.aquaculture_reported_barangays_2025 || data.aquaculture_reported_barangays || []).map((name) => [name, 1]),
  );
  if (mode === "business") return Object.fromEntries(
    Object.entries(data.business_profile_industries_2024 || {}).map(([name, activities]) => [name, activities.length]),
  );
  if (mode === "tourism") return (data.tourism_attractions_2024 || []).reduce((counts, [, name]) => {
    counts[name] = (counts[name] || 0) + 1;
    return counts;
  }, {});
  return {};
};

const buildSectorChoropleth = (mode, lguName) => {
  const source = sectorSourceMetadata(mode, lguName);
  const sourceValues = sectorSourceValues(mode, lguName);
  const valuesByBarangay = new Map(Object.entries(sourceValues).map(([name, value]) => [sourceBarangayKey(name), Number(value)]));
  const values = [];
  const features = barangayBoundaryData.features
    .filter((feature) => !lguName || feature.properties.lgu === lguName)
    .map((feature) => {
      const value = valuesByBarangay.get(sourceBarangayKey(feature.properties.barangay)) ?? null;
      if (value != null) values.push(value);
      return {
        ...feature,
        properties: { ...feature.properties, sector_value: value },
      };
    });
  const maxValue = values.length ? Math.max(...values) : 0;
  values.sort((a, b) => a - b);
  const quantile = (fraction) => values.length
    ? values[Math.floor((values.length - 1) * fraction)]
    : 0;
  const breaks = values.length
    ? [quantile(0), quantile(0.25), quantile(0.65), quantile(1)]
    : [0, 0.25, 0.65, 1];
  if (values.length && values.every((value) => value === values[0])) {
    breaks.splice(0, breaks.length, values[0] - 1, values[0] - 0.5, values[0], values[0] + 1);
  }
  for (let index = 1; index < breaks.length; index += 1) {
    if (breaks[index] <= breaks[index - 1]) {
      breaks[index] = breaks[index - 1] + Math.max(Math.abs(breaks[index - 1]) * 0.000001, 0.000001);
    }
  }
  return { geojson: { type: "FeatureCollection", features }, maxValue, breaks, recordCount: values.length, source };
};



// ==============================

// APP

// ==============================



export default function App() {

  const requestedLgu = new URLSearchParams(window.location.search).get("lgu")?.toLowerCase();
  const mapFocus = {
    samar: { center: [124.895, 11.792], zoom: 9.2 },
    catbalogan: { center: [124.887, 11.776], zoom: 12.3 },
    calbayog: { center: [124.607, 12.067], zoom: 10.4 },
    pinabacdao: { center: [124.994, 11.594], zoom: 11.2 },
  }[requestedLgu] || { center: [124.895, 11.792], zoom: 12.3 };
  const waterLayers = buildLguMapLayers(requestedLgu, mapFocus.center);
  const isIllustrativeNetwork = ["calbayog", "pinabacdao"].includes(requestedLgu);
  const embedded = new URLSearchParams(window.location.search).get("embedded") === "1";

  const barangays = waterEconomyData.barangays;

  const [sharedBarangays, setSharedBarangays] = useState(barangays);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const records = await getBarangayRecords();
        if (active && records.length) setSharedBarangays(records);
      } catch {
        // Keep the bundled editable-dataset snapshot available when the API is offline.
      }
    };
    refresh();
    const unsubscribe = subscribeToBarangayUpdates(null, refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const lguBaselines = waterEconomyData.lgu_baselines;

const assets = developmentAssets.assets;

  const [selectedBarangayData, setSelectedBarangayData] =

  useState(null);

  const boundaryLgu = BOUNDARY_LGU_NAMES[requestedLgu]
    || BOUNDARY_LGU_NAMES[selectedBarangayData?.lgu?.toLowerCase()]
    || "Catbalogan City";

  const selectedBarangayRequest = useRef(0);

  const applyBarangayRecord = (record) => {
    const sourceRecord = barangays.find((item) => item.psgc_code === record?.psgc_code);
    if (!sourceRecord) {
      setSelectedBarangayData(record);
      return;
    }
    const income = Number(record.avg_household_income_php ?? sourceRecord.avg_household_income_php_simulated ?? 0);
    const waterCost = Number(record.monthly_water_cost_php ?? sourceRecord.avg_monthly_water_cost_php_simulated ?? 0);
    const demand = [
      "household_demand_m3_day", "critical_services_demand_m3_day", "agriculture_demand_m3_day",
      "fisheries_demand_m3_day", "aquaculture_demand_m3_day", "business_demand_m3_day", "industry_demand_m3_day",
    ].reduce((sum, key) => sum + Number(record[key] ?? 0), 0);
    const netSupply = Number(record.gross_supply_m3_day ?? 0)
      * (1 - Number(record.nrw_rate_pct ?? 0) / 100 - Number(record.reserve_rate_pct ?? 0) / 100);
    const editedSector = (name, original) => record[`${name}_demand_m3_day`] == null
      ? original
      : {
          ...original,
          water_demand_m3_day: Number(record[`${name}_demand_m3_day`]),
          water_allocated_m3_day: Number(record[`${name}_allocated_m3_day`] ?? 0),
        };
    setSelectedBarangayData({
      ...sourceRecord,
      ...record,
      avg_household_income_php_simulated: record.avg_household_income_php ?? sourceRecord.avg_household_income_php_simulated,
      avg_monthly_water_cost_php_simulated: record.monthly_water_cost_php ?? sourceRecord.avg_monthly_water_cost_php_simulated,
      piped_access_pct_simulated: record.piped_access_pct ?? sourceRecord.piped_access_pct_simulated,
      supply_reliability_pct_simulated: record.supply_reliability_pct ?? sourceRecord.supply_reliability_pct_simulated,
      water_burden_pct_simulated: income > 0 ? Number(((waterCost / income) * 100).toFixed(1)) : sourceRecord.water_burden_pct_simulated,
      basic_domestic_demand_ml_day_estimated: record.household_demand_m3_day != null
        ? Number((Number(record.household_demand_m3_day) / 1000).toFixed(2))
        : sourceRecord.basic_domestic_demand_ml_day_estimated,
      shortage_risk_simulated: record.gross_supply_m3_day != null
        ? netSupply < demand * 0.7 ? "High" : netSupply < demand ? "Medium" : "Low"
        : sourceRecord.shortage_risk_simulated,
      agriculture_simulated: editedSector("agriculture", sourceRecord.agriculture_simulated),
      fisheries_simulated: editedSector("fisheries", sourceRecord.fisheries_simulated),
      aquaculture_simulated: editedSector("aquaculture", sourceRecord.aquaculture_simulated),
      business_simulated: editedSector("business", sourceRecord.business_simulated),
    });
  };

  const selectBarangayRecord = async (record) => {
    if (!record?.psgc_code) return;
    const requestId = ++selectedBarangayRequest.current;
    if (record.data_version != null) {
      applyBarangayRecord(record);
      return;
    }
    try {
      const result = await getBarangay(record.psgc_code);
      if (requestId === selectedBarangayRequest.current) {
        applyBarangayRecord(result.record);
      }
    } catch {
      if (requestId === selectedBarangayRequest.current) {
        applyBarangayRecord(record);
      }
    }
  };

  useEffect(() => {
    const code = selectedBarangayData?.psgc_code;
    if (!code) return undefined;
    return subscribeToBarangayUpdates(code, async () => {
      try {
        const result = await getBarangay(code);
        if (selectedBarangayData?.psgc_code === code) {
          applyBarangayRecord(result.record);
        }
      } catch {
        // Keep the last synchronized GIS record visible if a refresh is unavailable.
      }
    });
  }, [selectedBarangayData?.psgc_code]);



  const mapContainer = useRef(null);

  const mapRef = useRef(null);

  const sectorFocusKeyRef = useRef("");



  const [outage, setOutage] = useState(false);



  // ==============================

  // GIS LAYER STATES

  // ==============================



  const [layers, setLayers] = useState({

    sources: true,

    rivers: true,

    pipelines: true,

    zones: true,



    households: true,

    schools: true,

    health: true,

    government: false,



    barangays: false,

  });



  // ==============================

  // COLLAPSIBLE SIDEBAR

  // ==============================



  const [sections, setSections] = useState({

    water: true,

    sectors: true,

    publicNeeds: true,

    geographic: false,

    analysis: true,

    simulation: true,

    data: false,

  });



  const [analysisMode, setAnalysisMode] =

    useState("dependency");



  const [selectedSource, setSelectedSource] = useState(

    waterLayers.sources.features[0].properties

  );



  const [affected, setAffected] = useState({

    households: 0,

    facilities: 0,

  });



  // ==============================

  // CREATE MAP

  // ==============================



  useEffect(() => {

    if (mapRef.current) return;



    const map = new maplibregl.Map({

      container: mapContainer.current,



      style: {

        version: 8,



        sources: {

          osm: {

            type: "raster",



            tiles: [

              "https://tile.openstreetmap.org/{z}/{x}/{y}.png",

            ],



            tileSize: 256,



            minzoom: 0,

            maxzoom: 19,



            attribution:

              "© OpenStreetMap contributors",

          },

        },



        layers: [

          {

            id: "osm",

            type: "raster",

            source: "osm",

          },

        ],

      },



      center: mapFocus.center,



      zoom: mapFocus.zoom,

      minZoom: 5,

      maxZoom: 19,



      // 3D-style viewing angle

      pitch: 55,

      bearing: -20,

      maxPitch: 75,

    });



    mapRef.current = map;



    // Allow desktop drag rotation and mobile two-finger rotation

    map.dragRotate.enable();

    map.touchZoomRotate.enableRotation();



    // Navigation buttons



    map.addControl(

      new maplibregl.NavigationControl(),

      "top-right"

    );



    // Scale



    map.addControl(

      new maplibregl.ScaleControl({

        maxWidth: 120,

        unit: "metric",

      }),

      "bottom-right"

    );



    map.on("load", () => {

      // ==========================

      // BARANGAY BOUNDARY

      // ==========================



      map.addSource("barangays", {

        type: "geojson",

        data: waterLayers.barangays,

      });



      map.addLayer({

        id: "barangay-fill",

        type: "fill",

        source: "barangays",



        layout: {

          visibility: layers.barangays

            ? "visible"

            : "none",

        },



        paint: {

          "fill-color": "#64748b",

          "fill-opacity": 0.15,

        },

      });



      map.addLayer({

        id: "barangay-line",

        type: "line",

        source: "barangays",



        layout: {

          visibility: layers.barangays

            ? "visible"

            : "none",

        },



        paint: {

          "line-color": "#334155",

          "line-width": 3,

          "line-dasharray": [3, 2],

        },

      });



      const sectorMap = buildSectorChoropleth(analysisMode, boundaryLgu);
      map.addSource("sector-boundaries", { type: "geojson", data: sectorMap.geojson });
      map.addLayer({
        id: "sector-boundaries-fill", type: "fill", source: "sector-boundaries",
        layout: { visibility: SECTOR_MAP_MODES.includes(analysisMode) ? "visible" : "none" },
        paint: {
          "fill-color": sectorFillColorExpression(analysisMode, sectorMap.breaks),
          "fill-opacity": ["case", ["==", ["get", "sector_value"], null], 0, 0.78],
        },
      });
      map.addLayer({
        id: "sector-boundaries-line", type: "line", source: "sector-boundaries",
        layout: { visibility: SECTOR_MAP_MODES.includes(analysisMode) ? "visible" : "none" },
        paint: { "line-color": "#ffffff", "line-width": 1.15, "line-opacity": 0.95 },
      });
      map.addLayer({
        id: "sector-boundaries-selected", type: "line", source: "sector-boundaries",
        filter: ["==", ["get", "psgc_code"], ""],
        layout: { visibility: SECTOR_MAP_MODES.includes(analysisMode) ? "visible" : "none" },
        paint: { "line-color": "#54217c", "line-width": 3 },
      });
      map.on("mouseenter", "sector-boundaries-fill", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "sector-boundaries-fill", () => { map.getCanvas().style.cursor = ""; });
      map.on("click", "sector-boundaries-fill", (event) => {
        const code = event.features?.[0]?.properties?.psgc_code;
        if (!code) return;
        const localRecord = barangays.find((row) => String(row.psgc_code) === String(code));
        if (localRecord) selectBarangayRecord(localRecord);
        map.easeTo({ center: event.lngLat, duration: 450 });
      });

      // ==========================

      // SERVICE ZONES

      // ==========================



      map.addSource("zones", {

        type: "geojson",

        data: waterLayers.zones,

      });



      map.addLayer({

        id: "zones-fill",

        type: "fill",

        source: "zones",



        paint: {

          "fill-color": "#16a34a",

          "fill-opacity": 0.42,

        },

      });



      map.addLayer({

        id: "zones-line",

        type: "line",

        source: "zones",



        paint: {

          "line-color": "#065f46",

          "line-width": 4,

        },

      });



      // ==========================

      map.moveLayer("zones-fill", "sector-boundaries-fill");
      map.moveLayer("zones-line", "sector-boundaries-fill");

      // RIVERS

      // ==========================



      map.addSource("rivers", {

        type: "geojson",

        data: waterLayers.rivers,

      });



      map.addLayer({

        id: "rivers-line",

        type: "line",

        source: "rivers",



        paint: {

          "line-color": "#00bfff",

          "line-width": 5,

          "line-opacity": 0.95,

        },

      });



      // ==========================

      // PIPELINES

      // ==========================



      map.addSource("pipelines", {

        type: "geojson",

        data: waterLayers.pipelines,

      });



      map.addLayer({

        id: "pipelines-main",



        type: "line",



        source: "pipelines",



        filter: [

          "==",

          ["get", "type"],

          "main",

        ],



        paint: {

          "line-color": "#1d4ed8",

          "line-width": 7,

        },

      });



      map.addLayer({

        id: "pipelines-distribution",



        type: "line",



        source: "pipelines",



        filter: [

          "==",

          ["get", "type"],

          "distribution",

        ],



        paint: {

          "line-color": "#38bdf8",

          "line-width": 5,

          "line-dasharray": [2, 1],

        },

      });



      // ==========================

      // HOUSEHOLDS

      // ==========================



      map.addSource("households", {

        type: "geojson",

        data: waterLayers.households,

      });



      map.addLayer({

        id: "households-circle",



        type: "circle",



        source: "households",



        paint: {

          "circle-radius": 7,

          "circle-color": "#22c55e",



          "circle-stroke-color":

            "#064e3b",



          "circle-stroke-width": 2.5,

        },

      });



      // ==========================

      // FACILITIES

      // ==========================



      map.addSource("facilities", {

        type: "geojson",

        data: waterLayers.facilities,

      });



      // SCHOOLS



      map.addLayer({

        id: "schools-circle",



        type: "circle",



        source: "facilities",



        filter: [

          "==",

          ["get", "category"],

          "School",

        ],



        paint: {

          "circle-radius": 9,

          "circle-color": "#f59e0b",



          "circle-stroke-color":

            "#78350f",



          "circle-stroke-width": 3,

        },

      });



      // HEALTH



      map.addLayer({

        id: "health-circle",



        type: "circle",



        source: "facilities",



        filter: [

          "==",

          ["get", "category"],

          "Health",

        ],



        paint: {

          "circle-radius": 9,

          "circle-color": "#ef4444",



          "circle-stroke-color":

            "#7f1d1d",



          "circle-stroke-width": 3,

        },

      });



      // GOVERNMENT



      map.addLayer({

        id: "government-circle",



        type: "circle",



        source: "facilities",



        filter: [

          "==",

          ["get", "category"],

          "Government",

        ],



        layout: {

          visibility: "none",

        },



        paint: {

          "circle-radius": 9,

          "circle-color": "#8b5cf6",



          "circle-stroke-color":

            "#4c1d95",



          "circle-stroke-width": 3,

        },

      });



      // ==========================

      // WATER SOURCE

      // ==========================



      map.addSource("sources", {

        type: "geojson",

        data: waterLayers.sources,

      });



      map.addLayer({

        id: "sources-circle",



        type: "circle",



        source: "sources",



        paint: {

          "circle-radius": 11,



          "circle-color": "#06b6d4",



          "circle-stroke-color":

            "#164e63",



          "circle-stroke-width": 3,

        },

      });



      map.addLayer({

        id: "sources-label",



        type: "symbol",



        source: "sources",



        layout: {

          "text-field": ["get", "name"],



          "text-size": 14,



          "text-offset": [0, 1.6],



          "text-anchor": "top",

        },



        paint: {

          "text-color": "#0f172a",



          "text-halo-color": "#ffffff",



          "text-halo-width": 2,

        },

      });



      // ==========================

      // CLICKABLE FEATURES

      // ==========================



      const clickableLayers = [

        "sources-circle",

        "households-circle",

        "schools-circle",

        "health-circle",

        "government-circle",

      ];



      clickableLayers.forEach(

        (layerId) => {

          map.on(

            "mouseenter",

            layerId,

            () => {

              map.getCanvas().style.cursor =

                "pointer";

            }

          );



          map.on(

            "mouseleave",

            layerId,

            () => {

              map.getCanvas().style.cursor =

                "";

            }

          );



          map.on(

            "click",

            layerId,

            (event) => {

              const feature =

                event.features?.[0];



              if (!feature) return;



              const properties =

                feature.properties || {};



              if (

                layerId ===

                "sources-circle"

              ) {

                setSelectedSource(

                  properties

                );

              }



              const popupHTML = `

                <div style="

                  font-family: Arial;

                  min-width: 170px;

                ">



                  <strong>

                    ${

                      properties.name ||

                      "GIS Feature"

                    }

                  </strong>



                  <br/>



                  ${

                    properties.category

                      ? properties.category

                      : properties.type || ""

                  }



                  ${

                    properties.zone

                      ? `<br/>Zone: ${properties.zone}`

                      : ""

                  }



                </div>

              `;



              new maplibregl.Popup()

                .setLngLat(event.lngLat)

                .setHTML(popupHTML)

                .addTo(map);

            }

          );

        }

      );



      // ==========================

      // TURF ANALYSIS

      // ==========================



      const zone =

        waterLayers.zones.features[0];



      const householdCount =

        waterLayers.households.features.filter(

          (feature) =>

            turf.booleanPointInPolygon(

              feature,

              zone

            )

        ).length;



      const facilityCount =

        waterLayers.facilities.features.filter(

          (feature) =>

            turf.booleanPointInPolygon(

              feature,

              zone

            )

        ).length;



      setAffected({

        households:

          householdCount,



        facilities:

          facilityCount,

      });

    });



    return () => {

      map.remove();

      mapRef.current = null;

    };

  }, []);



  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const updateSectorOverlay = () => {
      const source = map.getSource("sector-boundaries");
      if (!source) return;
      const sectorMap = buildSectorChoropleth(analysisMode, boundaryLgu);
      source.setData(sectorMap.geojson);
      const visible = SECTOR_MAP_MODES.includes(analysisMode) ? "visible" : "none";
      ["sector-boundaries-fill", "sector-boundaries-line", "sector-boundaries-selected"].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible);
      });
      if (map.getLayer("sector-boundaries-fill")) {
        map.setPaintProperty("sector-boundaries-fill", "fill-color", sectorFillColorExpression(analysisMode, sectorMap.breaks));
      }
      if (map.getLayer("sector-boundaries-selected")) {
        map.setFilter("sector-boundaries-selected", ["==", ["get", "psgc_code"], selectedBarangayData?.psgc_code || ""]);
      }
    };
    if (map.getSource("sector-boundaries")) updateSectorOverlay();
    else map.once("load", updateSectorOverlay);
  }, [analysisMode, sharedBarangays, boundaryLgu, selectedBarangayData?.psgc_code]);

  useEffect(() => {
    if (!SECTOR_MAP_MODES.includes(analysisMode)) return;
    const focusKey = `${boundaryLgu}:${analysisMode}`;
    if (sectorFocusKeyRef.current === focusKey) return;
    const map = mapRef.current;
    if (!map) return;
    const focusSectorData = () => {
      if (!map.getLayer("sector-boundaries-fill")) return;
      const sectorMap = buildSectorChoropleth(analysisMode, boundaryLgu);
      const mappedFeatures = sectorMap.geojson.features.filter((feature) => feature.properties.sector_value != null);
      if (!mappedFeatures.length) {
        sectorFocusKeyRef.current = focusKey;
        return;
      }

      const bounds = new maplibregl.LngLatBounds();
      mappedFeatures.forEach((feature) => {
        const [west, south, east, north] = turf.bbox(feature);
        bounds.extend([west, south]);
        bounds.extend([east, north]);
      });
      sectorFocusKeyRef.current = focusKey;
      map.fitBounds(bounds, {
        padding: { top: 125, right: 330, bottom: 115, left: 45 },
        maxZoom: 12.8,
        duration: 650,
      });
    };
    if (map.getLayer("sector-boundaries-fill")) focusSectorData();
    else map.once("load", focusSectorData);
  }, [analysisMode, boundaryLgu]);

  // ==============================

  // LAYER VISIBILITY

  // ==============================



  useEffect(() => {

    const map = mapRef.current;



    if (!map) return;



    const updateLayers = () => {

      const visibilityMap = {

        "sources-circle":

          layers.sources,



        "sources-label":

          layers.sources,



        "rivers-line":

          layers.rivers,



        "pipelines-main":

          layers.pipelines,



        "pipelines-distribution":

          layers.pipelines,



        "zones-fill":

          layers.zones && !SECTOR_MAP_MODES.includes(analysisMode),



        "zones-line":

          layers.zones && !SECTOR_MAP_MODES.includes(analysisMode),



        "households-circle":

          layers.households,



        "schools-circle":

          layers.schools,



        "health-circle":

          layers.health,



        "government-circle":

          layers.government,



        "barangay-fill":

          layers.barangays,



        "barangay-line":

          layers.barangays,

      };



      Object.entries(

        visibilityMap

      ).forEach(

        ([layerId, visible]) => {

          if (

            map.getLayer(layerId)

          ) {

            map.setLayoutProperty(

              layerId,



              "visibility",



              visible

                ? "visible"

                : "none"

            );

          }

        }

      );

    };



    if (map.getLayer("zones-fill")) {

      updateLayers();

    } else {

      map.once(

        "load",

        updateLayers

      );

    }

  }, [layers, analysisMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const applySectorLayerVisibility = () => {
      const sectorMode = SECTOR_MAP_MODES.includes(analysisMode);
      const visibility = layers.zones && !sectorMode ? "visible" : "none";
      ["zones-fill", "zones-line"].forEach((layerId) => {
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", visibility);
      });
    };
    if (map.getLayer("zones-fill")) applySectorLayerVisibility();
    else map.once("load", applySectorLayerVisibility);
  }, [analysisMode, layers.zones]);



  // ==============================

  // OUTAGE SIMULATION

  // ==============================



  useEffect(() => {

    const map = mapRef.current;



    if (

      !map ||

      !map.isStyleLoaded()

    ) {

      return;

    }



    if (

      map.getLayer("zones-fill")

    ) {

      map.setPaintProperty(

        "zones-fill",

        "fill-color",

        outage

          ? "#dc2626"

          : "#16a34a"

      );



      map.setPaintProperty(

        "zones-fill",

        "fill-opacity",

        outage ? 0.58 : 0.42

      );

    }



    if (

      map.getLayer("zones-line")

    ) {

      map.setPaintProperty(

        "zones-line",

        "line-color",

        outage

          ? "#7f1d1d"

          : "#065f46"

      );

    }



    if (

      map.getLayer(

        "households-circle"

      )

    ) {

      map.setPaintProperty(

        "households-circle",



        "circle-color",



        outage

          ? "#ef4444"

          : "#22c55e"

      );

    }

  }, [outage]);



  // ==============================

  // SIDEBAR FUNCTIONS

  // ==============================



  const toggleLayer = (name) => {

    setLayers((previous) => ({

      ...previous,



      [name]:

        !previous[name],

    }));

  };



  const toggleSection = (name) => {

    setSections((previous) => ({

      ...previous,



      [name]:

        !previous[name],

    }));

  };



  // ==============================

  // MAP FUNCTIONS

  // ==============================



  const focusSource = () => {

    mapRef.current?.flyTo({

      center: [

        ...waterLayers.sources.features[0].geometry.coordinates,

      ],



      zoom: 14,



      duration: 1200,

    });

  };



  const showDependencyArea =

    () => {

      const bbox =

        turf.bbox(waterLayers.zones);



      mapRef.current?.fitBounds(

        [

          [

            bbox[0],

            bbox[1],

          ],



          [

            bbox[2],

            bbox[3],

          ],

        ],



        {

          padding: 80,

          duration: 1200,

        }

      );

    };



  // ==============================

  // UI

  // ==============================


  const sectorMapRecordCount = SECTOR_MAP_MODES.includes(analysisMode)
    ? buildSectorChoropleth(analysisMode, boundaryLgu).recordCount
    : 0;
  const sectorMapLegendSource = SECTOR_MAP_MODES.includes(analysisMode)
    ? sectorSourceMetadata(analysisMode, boundaryLgu)
    : null;

  return (

    <div className={`gis-app economic-theme${embedded ? " embedded-gis" : ""}`}>



      {/* MISSION CONTROL SIDEBAR */}

      <MissionControlSidebar
        outage={outage}
        selectedBarangay={selectedBarangayData}
        layers={layers}
        toggleLayer={toggleLayer}
        analysisMode={analysisMode}
        setAnalysisMode={setAnalysisMode}
        focusSource={focusSource}
        showDependencyArea={showDependencyArea}
        onToggleOutage={() => setOutage((previous) => !previous)}
        onBarangaySelect={selectBarangayRecord}
        lguKey={requestedLgu}
      />



      {/* MAP */}



      <main className="map-area">



        {/* TOP BAR */}



        <header className="topbar">



          <div>



            <h2>

              DULOY | Water Dependency Map

            </h2>



            <p>

              Water infrastructure

              and community impact

              visualization

            </p>



          </div>



          <div className="topbar-badges">
            <a className="back-main-btn" href="./" aria-label="Back to main economics interface">
              <span aria-hidden="true">←</span> Back to Main UI
            </a>



            <span

              className={`status-pill ${

                outage

                  ? "critical"

                  : "normal"

              }`}

            >



              <span className="status-dot" />



              {outage

                ? "SOURCE OFFLINE"

                : "SYSTEM NORMAL"}



            </span>



            <button

              className="outage-btn"



              onClick={() =>

                setOutage(

                  (previous) =>

                    !previous

                )

              }

            >



              {outage

                ? "Restore Supply"

                : "Simulate Outage"}



            </button>



          </div>



        </header>



        {/* ACTUAL MAP */}



        <div

          ref={mapContainer}

          className="map"

        />
        {isIllustrativeNetwork && (
          <div className="illustrative-network-note" role="note">
            <strong>Illustrative water network</strong>
            <span>Demo geometry shown for {requestedLgu === "calbayog" ? "Calbayog City" : "Pinabacdao"}. Replace with surveyed local asset locations when available.</span>
          </div>
        )}

        <ScenarioDock
          outage={outage}
          analysisMode={analysisMode}
          setAnalysisMode={setAnalysisMode}
          onToggleOutage={() => setOutage((previous) => !previous)}
          selectedBarangay={selectedBarangayData}
        />



        {/* LEGEND */}



        <div className="legend-card">

          {SECTOR_MAP_MODES.includes(analysisMode) && (
            <div className="sector-map-legend">
              <strong>{SECTOR_MAP_LABELS[analysisMode]} · {sectorMapLegendSource.metric} · {sectorMapLegendSource.year}</strong>
              <span>{sectorMapLegendSource.note}</span>
              {analysisMode === "aquaculture" && sectorMapRecordCount > 0 && (
                <span className="sector-map-presence"><i /> Reported aquaculture locations or projects</span>
              )}
              {!["aquaculture", "fisheries"].includes(analysisMode) && sectorMapRecordCount > 0 && (
                <>
                  <div className={`sector-map-ramp sector-map-ramp-${analysisMode}`}><i /><i /><i /><i /></div>
                  <div className="sector-map-range"><span>{analysisMode === "agriculture" ? "Less irrigated area" : "Fewer listed records"}</span><span>{analysisMode === "agriculture" ? "More irrigated area" : "More listed records"}</span></div>
                </>
              )}
              {sectorMapRecordCount === 0 && <span>No barangay tiles are shown because this source does not report a mappable value for this LGU and sector.</span>}
              <span>{sectorMapRecordCount} barangays with reported records</span>
              <a href={sectorMapLegendSource.url} target="_blank" rel="noreferrer">Source: {sectorMapLegendSource.title}</a>
            </div>
          )}



          <button className="legend-toggle" type="button" aria-pressed={layers.sources} onClick={() => toggleLayer("sources")} title="Toggle water sources">
            <span className="legend-dot water" aria-hidden="true" />Water Source
          </button>

          <button className="legend-toggle" type="button" aria-pressed={layers.pipelines} onClick={() => toggleLayer("pipelines")} title="Toggle pipeline and distribution lines">
            <span className="legend-line main" aria-hidden="true" />Main Pipeline
          </button>

          <button className="legend-toggle" type="button" aria-pressed={layers.pipelines} onClick={() => toggleLayer("pipelines")} title="Toggle pipeline and distribution lines">
            <span className="legend-line distribution" aria-hidden="true" />Distribution
          </button>

          <button className="legend-toggle" type="button" aria-pressed={layers.households} onClick={() => toggleLayer("households")} title="Toggle household locations">
            <span className={`legend-dot ${outage ? "danger" : "safe"}`} aria-hidden="true" />Households
          </button>

          <button className="legend-toggle" type="button" aria-pressed={layers.schools} onClick={() => toggleLayer("schools")} title="Toggle school locations">
            <span className="legend-dot school" aria-hidden="true" />School
          </button>

          <button className="legend-toggle" type="button" aria-pressed={layers.health} onClick={() => toggleLayer("health")} title="Toggle health facility locations">
            <span className="legend-dot health" aria-hidden="true" />Health Facility
          </button>



        </div>



        {/* SOURCE INFO */}



        <aside className="info-panel">



          <div className="info-panel-header">



            <div>



              <span className="eyebrow">

                SELECTED SOURCE

              </span>



              <h3>

                {

                  selectedSource.name

                }

              </h3>



            </div>



            <span

              className={`mini-status ${

                outage

                  ? "critical"

                  : "normal"

              }`}

            >

              {outage

                ? "Critical"

                : "Normal"}

            </span>



          </div>



          <div className="metric-grid">



            <Metric

              label="Flow"

              value={

                selectedSource.flow

              }

            />



            <Metric

              label="Analysis"

              value={

                analysisMode

              }

            />



            <Metric

              label="Demo HH in Zone"

              value={

                affected.households

              }

            />



            <Metric

              label="Demo Facilities"

              value={

                affected.facilities

              }

            />



          </div>



          <div className="dependency-box">



            <div className="dependency-title">

              DEPENDENCY IMPACT

            </div>



            <div className="impact-row">



              <span>

                🏠 Households

              </span>



              <strong>

                {

                  selectedSource.households

                }

              </strong>



            </div>



            <div className="impact-row">



              <span>

                🏫 Schools

              </span>



              <strong>

                {

                  selectedSource.schools

                }

              </strong>



            </div>



            <div className="impact-row">



              <span>

                🏥 Health Facilities

              </span>



              <strong>

                {

                  selectedSource.health

                }

              </strong>



            </div>



            <div className="impact-row">



              <span>

                👥 Population

              </span>



              <strong>

                {selectedSource.population?.toLocaleString()}

              </strong>



            </div>



          </div>



          {outage && (



            <div className="alert-box">



              <strong>

                Outage Simulation

              </strong>



              <p>

                The affected demo

                service zone and

                households are now

                highlighted in red.

              </p>



            </div>



          )}



        </aside>



        {/* AI CHATBOT */}



        <ChatAssistant

          outage={outage}
          selectedBarangay={selectedBarangayData}

        />



      </main>



    </div>

  );

}



// ==========================================

// SIDEBAR COMPONENT

// ==========================================



function LayerGroup({

  title,

  open,

  onToggle,

  children,

}) {

  return (

    <div className="layer-group">



      <div

        className="layer-group-title"

        onClick={onToggle}

        style={{

          cursor: "pointer",

          userSelect: "none",

        }}

      >



        <span

          style={{

            display: "inline-block",

            width: "18px",

          }}

        >

          {open ? "⌄" : "›"}

        </span>



        {title}



      </div>



      {open && (



        <div className="layer-items">

          {children}

        </div>



      )}



    </div>

  );

}



// ==========================================

// CHECKBOX

// ==========================================



function LayerToggle({

  label,

  checked,

  onChange,

  onSelect,

  active,

}) {

  return (

    <div

      className="layer-toggle-row"

      style={{

        display: "flex",

        alignItems: "center",

        gap: "9px",

        minHeight: "36px",

        padding: "5px 8px",

        borderRadius: "7px",

        background: active

          ? "rgba(6, 182, 212, 0.18)"

          : "transparent",

        borderLeft: active

          ? "3px solid #22d3ee"

          : "3px solid transparent",

      }}

    >

      <button

        type="button"

        onClick={(event) => {

          event.stopPropagation();

          onChange();

        }}

        style={{

          width: "18px",

          height: "18px",

          minWidth: "18px",

          padding: "0",

          borderRadius: "4px",

          border: checked

            ? "1px solid #06b6d4"

            : "1px solid #64748b",

          background: checked

            ? "#0891b2"

            : "transparent",

          color: "white",

          cursor: "pointer",

          display: "flex",

          alignItems: "center",

          justifyContent: "center",

          fontSize: "12px",

          fontWeight: "bold",

        }}

      >

        {checked ? "✓" : ""}

      </button>



      <span

        onClick={onSelect}

        style={{

          flex: 1,

          cursor: "pointer",

          color: active ? "#ffffff" : "#cbd5e1",

          userSelect: "none",

        }}

      >

        {label}

      </span>

    </div>

  );

}



// ==========================================

// ANALYSIS BUTTON

// ==========================================



function AnalysisButton({

  label,

  active,

  onClick,

}) {

  return (

    <button

      onClick={onClick}

      style={{

        width: "100%",



        border: "none",



        borderRadius: "8px",



        padding: "8px 10px",



        marginBottom: "4px",



        cursor: "pointer",



        textAlign: "left",



        color: active

          ? "#ffffff"

          : "#cbd5e1",



        background: active

          ? "#0e7490"

          : "transparent",

      }}

    >



      {active ? "●" : "○"}{" "}

      {label}



    </button>

  );

}



// ==========================================

// METRIC

// ==========================================



function Metric({

  label,

  value,

}) {

  return (

    <div className="metric">



      <span>

        {label}

      </span>



      <strong

        style={{

          textTransform:

            label === "Analysis"

              ? "capitalize"

              : "none",

        }}

      >

        {value}

      </strong>



    </div>

  );

}
