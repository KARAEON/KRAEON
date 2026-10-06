async function readError(
  response,
  fallback
) {
  try {
    const data =
      await response.json();

    if (data?.message) {
      return data.message;
    }

    if (data?.errors) {
      return Object.values(
        data.errors
      )
        .flat()
        .join(" ");
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export async function getProjects(
  psgcCode
) {
  const response = await fetch(
    `/api/water-economy/projects/${encodeURIComponent(
      psgcCode
    )}`
  );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Unable to load interventions."
      )
    );
  }

  return response.json();
}

export async function createProject(
  psgcCode,
  payload
) {
  const response = await fetch(
    `/api/water-economy/projects/${encodeURIComponent(
      psgcCode
    )}`,
    {
      method: "POST",
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
        "Unable to save intervention."
      )
    );
  }

  return response.json();
}

export async function updateProject(
  psgcCode,
  projectId,
  payload
) {
  const response = await fetch(
    `/api/water-economy/projects/${encodeURIComponent(
      psgcCode
    )}/${projectId}`,
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
        "Unable to update intervention."
      )
    );
  }

  return response.json();
}

export async function deleteProject(
  psgcCode,
  projectId
) {
  const response = await fetch(
    `/api/water-economy/projects/${encodeURIComponent(
      psgcCode
    )}/${projectId}`,
    {
      method: "DELETE",
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
        "Unable to delete intervention."
      )
    );
  }

  return response.json();
}
