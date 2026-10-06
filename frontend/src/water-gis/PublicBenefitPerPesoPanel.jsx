import {
  Award,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  getBenefitPerPeso,
} from "./benefitPerPesoApi";

import "./PublicBenefitPerPesoPanel.css";

const DEFAULT_WEIGHTS = {
  water: 30,
  equity: 25,
  economic: 20,
  reliability: 15,
  cost_efficiency: 10,
};

export default function PublicBenefitPerPesoPanel({
  psgcCode,
}) {
  const [weights, setWeights] =
    useState(
      DEFAULT_WEIGHTS
    );

  const [data, setData] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function load(
    nextWeights = weights
  ) {
    if (!psgcCode) {
      setData(null);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result =
        await getBenefitPerPeso(
          psgcCode,
          nextWeights
        );

      setData(result);
    } catch (err) {
      setError(
        err?.message ||
          "Unable to calculate Benefit per Peso."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(DEFAULT_WEIGHTS);
  }, [psgcCode]);

  function updateWeight(
    key,
    value
  ) {
    setWeights(
      (previous) => ({
        ...previous,
        [key]:
          Math.max(
            0,
            Number(value) || 0
          ),
      })
    );
  }

  const totalWeight =
    Object.values(
      weights
    ).reduce(
      (sum, value) =>
        sum + Number(value),
      0
    );

  if (!psgcCode) {
    return (
      <div className="benefit-empty">
        Select a barangay to
        rank its interventions.
      </div>
    );
  }

  return (
    <section className="benefit-panel">
      <header className="benefit-header">
        <div>
          <span>
            NO. 15 · PUBLIC BENEFIT PER PESO
          </span>

          <h3>
            Intervention Ranking
          </h3>

          <p>
            Economics + public value
          </p>
        </div>

        <Award size={20} />
      </header>

      {error && (
        <div className="benefit-error">
          {error}
        </div>
      )}

      <section className="benefit-weights">
        <div className="benefit-section-title">
          <SlidersHorizontal
            size={13}
          />

          Policy Weights
        </div>

        <div className="benefit-weight-label">
          CUSTOM POLICY WEIGHTS
        </div>

        <Weight
          label="Water benefit"
          value={weights.water}
          onChange={(value) =>
            updateWeight(
              "water",
              value
            )
          }
        />

        <Weight
          label="Equity"
          value={weights.equity}
          onChange={(value) =>
            updateWeight(
              "equity",
              value
            )
          }
        />

        <Weight
          label="Economic / livelihood"
          value={
            weights.economic
          }
          onChange={(value) =>
            updateWeight(
              "economic",
              value
            )
          }
        />

        <Weight
          label="Reliability"
          value={
            weights.reliability
          }
          onChange={(value) =>
            updateWeight(
              "reliability",
              value
            )
          }
        />

        <Weight
          label="Cost efficiency"
          value={
            weights.cost_efficiency
          }
          onChange={(value) =>
            updateWeight(
              "cost_efficiency",
              value
            )
          }
        />

        <div className="benefit-weight-total">
          <span>
            Entered total
          </span>

          <strong>
            {totalWeight}%
          </strong>
        </div>

        <button
          type="button"
          className="benefit-recalculate"
          onClick={() =>
            load(weights)
          }
          disabled={loading}
        >
          <RefreshCw
            size={13}
          />

          {loading
            ? "Recalculating..."
            : "Apply Policy Weights"}
        </button>

        <p className="benefit-weight-note">
          The backend normalizes
          entered weights to 100%.
        </p>
      </section>

      {!loading &&
        data?.ranking?.length ===
          0 && (
          <div className="benefit-empty">
            Add No. 13 interventions
            first.
          </div>
        )}

      {data?.ranking?.length >
        0 && (
        <section className="benefit-ranking">
          <div className="benefit-section-title">
            Ranked Interventions
          </div>

          {data.ranking.map(
            (item) => (
              <article
                key={
                  item.project_id
                }
                className={`benefit-card ${
                  item.rank === 1
                    ? "winner"
                    : ""
                }`}
              >
                <div className="benefit-card-head">
                  <div className="benefit-rank">
                    #{item.rank}
                  </div>

                  <div>
                    <span>
                      {
                        item.project_type
                      }
                    </span>

                    <strong>
                      {item.name}
                    </strong>
                  </div>

                  <div className="benefit-score">
                    {
                      item.public_benefit_score
                    }
                    <small>
                      /100
                    </small>
                  </div>
                </div>

                <div className="benefit-subscore-grid">
                  <Subscore
                    label="Water"
                    value={
                      item.subscores
                        .water_benefit
                    }
                  />

                  <Subscore
                    label="Equity"
                    value={
                      item.subscores
                        .equity
                    }
                  />

                  <Subscore
                    label="Economic"
                    value={
                      item.subscores
                        .economic_livelihood
                    }
                  />

                  <Subscore
                    label="Reliability"
                    value={
                      item.subscores
                        .reliability
                    }
                  />

                  <Subscore
                    label="Cost efficiency"
                    value={
                      item.subscores
                        .cost_efficiency
                    }
                  />
                </div>

                <div className="benefit-economics">
                  <span>
                    Cost/m³{" "}
                    <strong>
                      {item.economics
                        .simple_lifecycle_cost_per_m3_php ===
                      null
                        ? "N/A"
                        : `₱${Number(
                            item.economics
                              .simple_lifecycle_cost_per_m3_php
                          ).toFixed(
                            2
                          )}`}
                    </strong>
                  </span>

                  <span>
                    Water gain{" "}
                    <strong>
                      {Number(
                        item.economics
                          .water_gain_m3_per_day
                      ).toLocaleString()}
                      {" "}
                      m³/day
                    </strong>
                  </span>
                </div>
              </article>
            )
          )}

          <div className="benefit-method-note">
            {data.method_note}
          </div>
        </section>
      )}
    </section>
  );
}

function Weight({
  label,
  value,
  onChange,
}) {
  return (
    <label className="benefit-weight">
      <div>
        <span>
          {label}
        </span>

        <strong>
          {value}%
        </strong>
      </div>

      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
      />
    </label>
  );
}

function Subscore({
  label,
  value,
}) {
  return (
    <div className="benefit-subscore">
      <span>
        {label}
      </span>

      <strong>
        {Math.round(
          Number(value) || 0
        )}
      </strong>

      <div>
        <i
          style={{
            width: `${Math.max(
              0,
              Math.min(
                100,
                Number(value) || 0
              )
            )}%`,
          }}
        />
      </div>
    </div>
  );
}
