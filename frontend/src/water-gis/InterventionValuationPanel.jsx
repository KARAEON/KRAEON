import {
  Calculator,
  Droplets,
  RefreshCw,
  WalletCards,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  getProjectValuations,
} from "./valuationApi";

import "./InterventionValuationPanel.css";

export default function InterventionValuationPanel({
  psgcCode,
}) {
  const [data, setData] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function load() {
    if (!psgcCode) {
      setData(null);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result =
        await getProjectValuations(
          psgcCode
        );

      setData(result);
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load valuations."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [psgcCode]);

  if (!psgcCode) {
    return (
      <div className="valuation-empty">
        Select a barangay to
        value its interventions.
      </div>
    );
  }

  return (
    <div className="valuation-panel">
      <header className="valuation-header">
        <div>
          <span>
            INTERVENTION
            ECONOMIC VALUATION
          </span>

          <h3>
            Economic Consequences
          </h3>

          <p>
            Compare projects by
            lifecycle economics, not
            only by water created.
          </p>
        </div>

        <Calculator
          size={20}
        />
      </header>

      <div className="valuation-toolbar">
        <div>
          {data?.barangay && (
            <>
              <strong>
                {
                  data.barangay
                    .barangay
                }
              </strong>

              <span>
                {
                  data.barangay
                    .lgu
                }
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw
            size={12}
          />

          Refresh
        </button>
      </div>

      {error && (
        <div className="valuation-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="valuation-empty">
          Calculating project
          valuations...
        </div>
      ) : !data ||
        data.valuations?.length ===
          0 ? (
        <div className="valuation-empty">
          No saved interventions yet. Add an investment first.
        </div>
      ) : (
        <>
          <div className="valuation-method-note">
            {
              data.method_note
            }
          </div>

          <div className="valuation-list">
            {data.valuations.map(
              (item) => (
                <ValuationCard
                  key={
                    item.project_id
                  }
                  item={item}
                />
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ValuationCard({
  item,
}) {
  const valuation =
    item.valuation;

  const inputs =
    item.inputs;

  return (
    <article className="valuation-card">
      <div className="valuation-card-head">
        <div>
          <span>
            {item.project_type}
          </span>

          <strong>
            {item.name}
          </strong>
        </div>

        <Droplets
          size={17}
        />
      </div>

      <div className="valuation-input-strip">
        <MiniMetric
          label="CAPEX"
          value={pesoCompact(
            inputs.capex_php
          )}
        />

        <MiniMetric
          label="Annual OPEX"
          value={pesoCompact(
            inputs.annual_opex_php
          )}
        />

        <MiniMetric
          label="Life"
          value={`${inputs.useful_life_years} yr`}
        />

        <MiniMetric
          label="Water gain"
          value={`${formatNumber(
            inputs.water_gain_m3_per_day
          )} m³/day`}
        />
      </div>

      <div className="valuation-results">
        <ResultMetric
          label="Simple lifecycle cost"
          value={peso(
            valuation
              .simple_lifecycle_cost_php
          )}
        />

        <ResultMetric
          label="Lifetime water"
          value={`${formatNumber(
            valuation
              .lifetime_water_m3
          )} m³`}
        />

        <ResultMetric
          label="Simple lifecycle cost / m³"
          value={
            valuation
              .simple_lifecycle_cost_per_m3_php ===
            null
              ? "N/A"
              : `${peso(
                  valuation
                    .simple_lifecycle_cost_per_m3_php
                )}/m³`
          }
          emphasis
        />

        <ResultMetric
          label="CAPEX / household"
          value={
            valuation
              .capex_per_household_php ===
            null
              ? "N/A"
              : peso(
                  valuation
                    .capex_per_household_php
                )
          }
        />
      </div>

      <div className="valuation-economic-loss">
        <WalletCards
          size={14}
        />

        <div>
          <strong>
            Economic loss avoided
          </strong>

          <span>
            {
              valuation
                .economic_loss_avoided_status
            }
          </span>

          <p>
            {
              valuation
                .economic_loss_avoided_note
            }
          </p>
        </div>
      </div>
    </article>
  );
}

function MiniMetric({
  label,
  value,
}) {
  return (
    <div className="valuation-mini">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function ResultMetric({
  label,
  value,
  emphasis = false,
}) {
  return (
    <div
      className={`valuation-result ${
        emphasis
          ? "emphasis"
          : ""
      }`}
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
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

function peso(value) {
  return `₱${Number(
    value ?? 0
  ).toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function pesoCompact(value) {
  const n =
    Number(value ?? 0);

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

  return peso(n);
}
