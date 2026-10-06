import { notifyBarangayUpdated } from "./waterEconomyApi";

export async function getNRWScenario(
  psgcCode
) {
  const response = await fetch(
    `/api/water-economy/nrw/${encodeURIComponent(
      psgcCode
    )}`
  );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Unable to load NRW scenario."
      )
    );
  }

  return response.json();
}

export async function updateNRWScenario(
  psgcCode,
  payload
) {
  const response = await fetch(
    `/api/water-economy/nrw/${encodeURIComponent(
      psgcCode
    )}`,
    {
      method: "PUT",
      headers: {
        "Content-Type":
          "application/json",
        Accept:
          "application/json",
      },
      body:
        JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Unable to save NRW scenario."
      )
    );
  }

  const result = await response.json();
  notifyBarangayUpdated(psgcCode);
  return result;
}

async function readError(
  response,
  fallback
) {
  try {
    const data =
      await response.json();

    return (
      data.message ||
      data.error ||
      fallback
    );
  } catch {
    return fallback;
  }
}
