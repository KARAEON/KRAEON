export async function previewDaloyScenario(
  psgcCode,
  changes
) {
  const response = await fetch(
    `/api/water-economy/scenario-preview/${encodeURIComponent(
      psgcCode
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        changes,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        "Unable to preview suggested scenario."
    );
  }

  return data;
}