export async function getBenefitPerPeso(
  psgcCode,
  weights
) {
  const params =
    new URLSearchParams();

  Object.entries(
    weights || {}
  ).forEach(
    ([key, value]) => {
      params.set(
        key,
        String(value)
      );
    }
  );

  const query =
    params.toString();

  const response =
    await fetch(
      `/api/water-economy/benefit-per-peso/${encodeURIComponent(
        psgcCode
      )}${query ? `?${query}` : ""}`
    );

  if (!response.ok) {
    let message =
      "Unable to load Benefit per Peso.";

    try {
      const data =
        await response.json();

      message =
        data.message ||
        message;
    } catch {
      // Ignore JSON parse error.
    }

    throw new Error(message);
  }

  return response.json();
}
