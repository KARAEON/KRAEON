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

export async function getProjectValuations(
  psgcCode
) {
  const response = await fetch(
    `/api/water-economy/valuation/${encodeURIComponent(
      psgcCode
    )}`
  );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Unable to load project valuations."
      )
    );
  }

  return response.json();
}
