async function parseJson(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || `Request failed: ${response.status}`);
  return data;
}

export function notifyBarangayUpdated(code) {
  const detail = { code, at: Date.now() };
  window.dispatchEvent(new CustomEvent("water-economy:barangay-updated", { detail }));
  try {
    localStorage.setItem("water-economy:barangay-updated", JSON.stringify(detail));
  } catch {
    // The backend record remains the source of truth if browser storage is unavailable.
  }
}

export function subscribeToBarangayUpdates(code, callback) {
  const handleUpdate = (event) => {
    const update = event.detail ?? (() => {
      try {
        return JSON.parse(event.newValue || "{}");
      } catch {
        return {};
      }
    })();
    if (!code || update.code === code) callback();
  };
  const handleStorage = (event) => {
    if (event.key === "water-economy:barangay-updated") handleUpdate(event);
  };
  window.addEventListener("water-economy:barangay-updated", handleUpdate);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener("water-economy:barangay-updated", handleUpdate);
    window.removeEventListener("storage", handleStorage);
  };
}

export async function getBarangay(code) {
  return parseJson(await fetch(`/api/water-economy/barangays/${encodeURIComponent(code)}`, {
    headers: { Accept: "application/json" },
  }));
}

export async function getBarangayRecords() {
  const records = await parseJson(await fetch("/api/water-economy/barangays", {
    headers: { Accept: "application/json" },
  }));
  return Array.isArray(records) ? records : [];
}

export async function updateBarangay(code, values) {
  const result = await parseJson(await fetch(`/api/water-economy/barangays/${encodeURIComponent(code)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(values),
  }));
  notifyBarangayUpdated(code);
  return result;
}
