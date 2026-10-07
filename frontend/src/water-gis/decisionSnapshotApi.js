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

export async function getDecisionSnapshot(
  psgcCode
) {
  const response = await fetch(
    `/api/water-economy/decision-snapshot/${encodeURIComponent(
      psgcCode
    )}`
  );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Unable to load decision snapshot."
      )
    );
  }

  return response.json();
}

export async function getAiDecisionSnapshot(
  psgcCode
) {
  const response = await fetch(
    `/api/water-economy/decision-snapshot/${encodeURIComponent(
      psgcCode
    )}/ai`,
    {
      method: "POST",
      headers: {
        Accept:
          "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Unable to generate DALOY AI snapshot."
      )
    );
  }

  return response.json();
}
