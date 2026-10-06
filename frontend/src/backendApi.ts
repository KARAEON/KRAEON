export type BarangayRecord = {
  psgc_code: string;
  lgu: string;
  barangay: string;
  urban_rural: string | null;
  population_2024: number;
  data_version: number;
  avg_household_size?: number;
  gross_supply_m3_day?: number;
  source_capacity_m3_day?: number;
  nrw_rate_pct?: number;
  reserve_rate_pct?: number;
  avg_household_income_php?: number;
  monthly_water_cost_php?: number;
  piped_access_pct?: number;
  supply_reliability_pct?: number;
  household_demand_m3_day?: number;
  critical_services_demand_m3_day?: number;
  agriculture_demand_m3_day?: number;
  fisheries_demand_m3_day?: number;
  aquaculture_demand_m3_day?: number;
  business_demand_m3_day?: number;
  industry_demand_m3_day?: number;
  household_allocated_m3_day?: number;
  critical_services_allocated_m3_day?: number;
  agriculture_allocated_m3_day?: number;
  fisheries_allocated_m3_day?: number;
  aquaculture_allocated_m3_day?: number;
  business_allocated_m3_day?: number;
  industry_allocated_m3_day?: number;
};

export type BarangayDetail = {
  record: BarangayRecord & Record<string, unknown>;
  calculated: {
    water?: {
      usable_water_m3_day?: number;
      total_demand_m3_day?: number;
      deficit_m3_day?: number;
      nrw_rate_pct?: number;
    };
    affordability?: {
      affordability_class?: string;
    };
  };
};

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || `Request failed (${response.status})`);
  }
  return data as T;
}

export async function getBarangays(signal?: AbortSignal): Promise<BarangayRecord[]> {
  return readJson(await fetch("/api/water-economy/barangays", {
    headers: { Accept: "application/json" },
    signal,
  }));
}

export async function getBarangayDetail(code: string, signal?: AbortSignal): Promise<BarangayDetail> {
  return readJson(await fetch(`/api/water-economy/barangays/${encodeURIComponent(code)}`, {
    headers: { Accept: "application/json" },
    signal,
  }));
}

export async function updateBarangay(
  code: string,
  values: Record<string, number | string | null>,
): Promise<BarangayDetail> {
  const result = await readJson<BarangayDetail>(await fetch(`/api/water-economy/barangays/${encodeURIComponent(code)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(values),
  }));
  const update = { code, at: Date.now() };
  window.dispatchEvent(new CustomEvent("water-economy:barangay-updated", { detail: update }));
  try {
    localStorage.setItem("water-economy:barangay-updated", JSON.stringify(update));
  } catch {
    // The saved backend record remains authoritative if browser storage is unavailable.
  }
  return result;
}

export async function askDaloy(payload: {
  message: string;
  psgc_code?: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
}): Promise<{ reply?: string; message?: string; details?: unknown }> {
  return readJson(await fetch("/api/ai/decision-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  }));
}
