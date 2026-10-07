import {
  Building2,
  Droplets,
  Edit3,
  Hammer,
  Plus,
  Save,
  Trash2,
  Wrench,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createProject,
  deleteProject,
  getProjects,
  updateProject,
} from "./investApi";

import "./InvestPanel.css";

const PROJECT_TYPES = [
  {
    value:
      "Pipeline Rehabilitation",
    icon:
      Wrench,
  },
  {
    value:
      "NRW Reduction Program",
    icon:
      Droplets,
  },
  {
    value:
      "New Water Source",
    icon:
      Building2,
  },
  {
    value:
      "Storage Expansion",
    icon:
      Hammer,
  },
];

const EMPTY_FORM = {
  project_type:
    "Pipeline Rehabilitation",

  name:
    "",

  capex_php:
    "",

  annual_opex_php:
    "",

  useful_life_years:
    15,

  water_gain_m3_per_day:
    "",

  households_benefited:
    "",

  reliability_score:
    50,

  equity_score:
    50,

  economic_benefit_score:
    50,

  implementation_time_months:
    12,
};

export default function InvestPanel({
  psgcCode,
  selectedBarangay,
}) {
  const [projects, setProjects] =
    useState([]);

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [editingId, setEditingId] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  async function loadProjects() {
    if (!psgcCode) {
      setProjects([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data =
        await getProjects(
          psgcCode
        );

      setProjects(
        data.projects || []
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load interventions."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    resetForm();
    loadProjects();
  }, [psgcCode]);

  function setValue(
    key,
    value
  ) {
    setForm(
      (previous) => ({
        ...previous,
        [key]: value,
      })
    );
  }

  function resetForm() {
    setEditingId(null);

    setForm({
      ...EMPTY_FORM,
    });
  }

  function editProject(
    project
  ) {
    setEditingId(
      project.id
    );

    setForm({
      project_type:
        project.project_type,

      name:
        project.name,

      capex_php:
        project.capex_php,

      annual_opex_php:
        project.annual_opex_php,

      useful_life_years:
        project.useful_life_years,

      water_gain_m3_per_day:
        project.water_gain_m3_per_day,

      households_benefited:
        project.households_benefited,

      reliability_score:
        project.reliability_score,

      equity_score:
        project.equity_score,

      economic_benefit_score:
        project.economic_benefit_score,

      implementation_time_months:
        project.implementation_time_months,
    });
  }

  function useTemplate(
    projectType
  ) {
    setValue(
      "project_type",
      projectType
    );

    if (
      !String(
        form.name || ""
      ).trim()
    ) {
      setValue(
        "name",
        projectType
      );
    }
  }

  async function save() {
    if (
      !psgcCode ||
      saving
    ) {
      return;
    }

    const payload = {
      project_type:
        String(
          form.project_type
        ).trim(),

      name:
        String(
          form.name
        ).trim(),

      capex_php:
        number(
          form.capex_php
        ),

      annual_opex_php:
        number(
          form.annual_opex_php
        ),

      useful_life_years:
        integer(
          form.useful_life_years
        ),

      water_gain_m3_per_day:
        number(
          form.water_gain_m3_per_day
        ),

      households_benefited:
        integer(
          form.households_benefited
        ),

      reliability_score:
        clampScore(
          form.reliability_score
        ),

      equity_score:
        clampScore(
          form.equity_score
        ),

      economic_benefit_score:
        clampScore(
          form.economic_benefit_score
        ),

      implementation_time_months:
        integer(
          form.implementation_time_months
        ),
    };

    if (!payload.name) {
      setError(
        "Project name is required."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (editingId) {
        await updateProject(
          psgcCode,
          editingId,
          payload
        );
      } else {
        await createProject(
          psgcCode,
          payload
        );
      }

      resetForm();

      await loadProjects();
    } catch (err) {
      setError(
        err?.message ||
          "Unable to save intervention."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeProject(
    project
  ) {
    if (!psgcCode) return;

    const confirmed =
      window.confirm(
        `Delete "${project.name}"?`
      );

    if (!confirmed) return;

    setError("");

    try {
      await deleteProject(
        psgcCode,
        project.id
      );

      if (
        editingId ===
        project.id
      ) {
        resetForm();
      }

      await loadProjects();
    } catch (err) {
      setError(
        err?.message ||
          "Unable to delete intervention."
      );
    }
  }

  const summary = useMemo(
    () => ({
      count:
        projects.length,

      capex:
        projects.reduce(
          (sum, project) =>
            sum +
            number(
              project.capex_php
            ),
          0
        ),

      waterGain:
        projects.reduce(
          (sum, project) =>
            sum +
            number(
              project.water_gain_m3_per_day
            ),
          0
        ),

      households:
        projects.reduce(
          (sum, project) =>
            sum +
            integer(
              project.households_benefited
            ),
          0
        ),
    }),
    [projects]
  );

  if (!psgcCode) {
    return (
      <div className="invest-empty">
        Select a barangay before
        adding interventions.
      </div>
    );
  }

  return (
    <div className="invest-panel">
      <header className="invest-header">
        <div>
          <span>
            INVESTMENT
          </span>

          <h3>
            Intervention Portfolio
          </h3>

          <p>
            {selectedBarangay
              ?.barangay ||
              "Selected barangay"}
          </p>
        </div>

        <Plus size={20} />
      </header>

      <section className="invest-purpose">
        Where should the next
        peso go?
      </section>

      {error && (
        <div className="invest-error">
          {error}
        </div>
      )}

      <section className="invest-templates">
        <div className="invest-section-title">
          Representative Interventions
        </div>

        <div className="invest-template-grid">
          {PROJECT_TYPES.map(
            ({
              value,
              icon: Icon,
            }) => (
              <button
                key={value}
                type="button"
                className={
                  form.project_type ===
                  value
                    ? "active"
                    : ""
                }
                onClick={() =>
                  useTemplate(
                    value
                  )
                }
              >
                <Icon size={14} />
                <span>
                  {value}
                </span>
              </button>
            )
          )}
        </div>
      </section>

      <section className="invest-editor">
        <div className="invest-section-head">
          <div className="invest-section-title">
            {editingId
              ? "Edit Intervention"
              : "New Intervention"}
          </div>

          {editingId && (
            <button
              type="button"
              className="invest-cancel"
              onClick={
                resetForm
              }
            >
              <X size={12} />
              Cancel
            </button>
          )}
        </div>

        <Field
          label="Project name"
          value={form.name}
          type="text"
          onChange={(value) =>
            setValue(
              "name",
              value
            )
          }
        />

        <div className="invest-grid">
          <Field
            label="CAPEX"
            unit="₱"
            value={
              form.capex_php
            }
            onChange={(value) =>
              setValue(
                "capex_php",
                value
              )
            }
          />

          <Field
            label="Annual OPEX"
            unit="₱/year"
            value={
              form.annual_opex_php
            }
            onChange={(value) =>
              setValue(
                "annual_opex_php",
                value
              )
            }
          />

          <Field
            label="Useful life"
            unit="years"
            value={
              form.useful_life_years
            }
            onChange={(value) =>
              setValue(
                "useful_life_years",
                value
              )
            }
          />

          <Field
            label="Water gain"
            unit="m³/day"
            value={
              form.water_gain_m3_per_day
            }
            onChange={(value) =>
              setValue(
                "water_gain_m3_per_day",
                value
              )
            }
          />

          <Field
            label="Households benefited"
            unit="HH"
            value={
              form.households_benefited
            }
            onChange={(value) =>
              setValue(
                "households_benefited",
                value
              )
            }
          />

          <Field
            label="Implementation time"
            unit="months"
            value={
              form.implementation_time_months
            }
            onChange={(value) =>
              setValue(
                "implementation_time_months",
                value
              )
            }
          />
        </div>

        <div className="invest-score-grid">
          <ScoreField
            label="Reliability"
            value={
              form.reliability_score
            }
            onChange={(value) =>
              setValue(
                "reliability_score",
                value
              )
            }
          />

          <ScoreField
            label="Equity"
            value={
              form.equity_score
            }
            onChange={(value) =>
              setValue(
                "equity_score",
                value
              )
            }
          />

          <ScoreField
            label="Economic benefit"
            value={
              form.economic_benefit_score
            }
            onChange={(value) =>
              setValue(
                "economic_benefit_score",
                value
              )
            }
          />
        </div>

        <button
          type="button"
          className="invest-save"
          disabled={saving}
          onClick={save}
        >
          <Save size={15} />

          {saving
            ? "Saving..."
            : editingId
              ? "Update Intervention"
              : "Save Intervention"}
        </button>
      </section>

      <section className="invest-summary">
        <Metric
          label="Projects"
          value={
            summary.count
          }
        />

        <Metric
          label="Total CAPEX"
          value={
            pesoCompact(
              summary.capex
            )
          }
        />

        <Metric
          label="Water gain"
          value={`${formatNumber(
            summary.waterGain
          )} m³/day`}
        />

        <Metric
          label="Households"
          value={
            formatNumber(
              summary.households
            )
          }
        />
      </section>

      <section className="invest-projects">
        <div className="invest-section-title">
          Saved Interventions
        </div>

        {loading ? (
          <div className="invest-loading">
            Loading interventions...
          </div>
        ) : projects.length ===
          0 ? (
          <div className="invest-no-projects">
            No interventions saved
            yet.
          </div>
        ) : (
          projects.map(
            (project) => (
              <article
                className="invest-project-card"
                key={project.id}
              >
                <div className="invest-card-head">
                  <div>
                    <span>
                      {
                        project.project_type
                      }
                    </span>

                    <strong>
                      {project.name}
                    </strong>
                  </div>

                  <div className="invest-card-actions">
                    <button
                      type="button"
                      title="Edit"
                      onClick={() =>
                        editProject(
                          project
                        )
                      }
                    >
                      <Edit3
                        size={13}
                      />
                    </button>

                    <button
                      type="button"
                      title="Delete"
                      onClick={() =>
                        removeProject(
                          project
                        )
                      }
                    >
                      <Trash2
                        size={13}
                      />
                    </button>
                  </div>
                </div>

                <div className="invest-card-grid">
                  <SmallMetric
                    label="CAPEX"
                    value={pesoCompact(
                      project.capex_php
                    )}
                  />

                  <SmallMetric
                    label="Annual OPEX"
                    value={pesoCompact(
                      project.annual_opex_php
                    )}
                  />

                  <SmallMetric
                    label="Water gain"
                    value={`${formatNumber(
                      project.water_gain_m3_per_day
                    )} m³/day`}
                  />

                  <SmallMetric
                    label="Households"
                    value={formatNumber(
                      project.households_benefited
                    )}
                  />

                  <SmallMetric
                    label="Life"
                    value={`${project.useful_life_years} yr`}
                  />

                  <SmallMetric
                    label="Time"
                    value={`${project.implementation_time_months} mo`}
                  />
                </div>

                <div className="invest-card-scores">
                  <ScoreChip
                    label="Reliability"
                    value={
                      project.reliability_score
                    }
                  />

                  <ScoreChip
                    label="Equity"
                    value={
                      project.equity_score
                    }
                  />

                  <ScoreChip
                    label="Economic"
                    value={
                      project.economic_benefit_score
                    }
                  />
                </div>
              </article>
            )
          )
        )}
      </section>

      <div className="invest-note">
        Investment stores project inputs only. Lifecycle cost, cost per m³, and economic valuation are shown in Intervention Valuation.
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  unit,
  type = "number",
}) {
  return (
    <label className="invest-field">
      <span>
        {label}
      </span>

      <div>
        <input
          type={type}
          min={
            type === "number"
              ? "0"
              : undefined
          }
          step={
            type === "number"
              ? "any"
              : undefined
          }
          value={value ?? ""}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
        />

        {unit && (
          <small>
            {unit}
          </small>
        )}
      </div>
    </label>
  );
}

function ScoreField({
  label,
  value,
  onChange,
}) {
  return (
    <label className="invest-score">
      <div>
        <span>
          {label}
        </span>

        <strong>
          {Math.round(
            Number(value) || 0
          )}
          /100
        </strong>
      </div>

      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={
          Number(value) || 0
        }
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
      />
    </label>
  );
}

function Metric({
  label,
  value,
}) {
  return (
    <div className="invest-summary-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function SmallMetric({
  label,
  value,
}) {
  return (
    <div className="invest-small-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function ScoreChip({
  label,
  value,
}) {
  return (
    <span className="invest-score-chip">
      {label}{" "}
      <strong>
        {Math.round(
          Number(value) || 0
        )}
      </strong>
    </span>
  );
}

function number(value) {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function integer(value) {
  return Math.max(
    0,
    Math.round(
      number(value)
    )
  );
}

function clampScore(value) {
  return Math.min(
    100,
    Math.max(
      0,
      number(value)
    )
  );
}

function formatNumber(value) {
  return Number(
    value ?? 0
  ).toLocaleString(
    undefined,
    {
      maximumFractionDigits: 2,
    }
  );
}

function pesoCompact(value) {
  const n =
    number(value);

  if (n >= 1_000_000) {
    return `₱${(
      n / 1_000_000
    ).toFixed(2)}M`;
  }

  if (n >= 1_000) {
    return `₱${(
      n / 1_000
    ).toFixed(1)}K`;
  }

  return `₱${formatNumber(
    n
  )}`;
}
