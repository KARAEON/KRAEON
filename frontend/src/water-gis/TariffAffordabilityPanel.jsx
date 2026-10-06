import {
  AlertTriangle,
  Bell,
  Save,
  Sparkles,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getBarangay,
  subscribeToBarangayUpdates,
  updateBarangay,
} from "./waterEconomyApi";

import "./TariffAffordabilityPanel.css";

export default function TariffAffordabilityPanel({
  psgcCode,
  onSaved,
  onAskDaloy,
}) {
  const [record, setRecord] =
    useState(null);

  const [calculated, setCalculated] =
    useState(null);

  const [form, setForm] =
    useState({});

  const [saving, setSaving] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function load() {
    if (!psgcCode) return;

    setLoading(true);
    setError("");

    try {
      const data =
        await getBarangay(
          psgcCode
        );

      setRecord(data.record);
      setCalculated(
        data.calculated
      );
      setForm(data.record);
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load tariff data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    return subscribeToBarangayUpdates(psgcCode, load);
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

  async function save() {
    if (
      !psgcCode ||
      saving
    ) {
      return;
    }

    const payload = {
      tariff_php_m3:
        number(
          form.tariff_php_m3
        ),

      monthly_consumption_m3:
        number(
          form.monthly_consumption_m3
        ),

      proposed_tariff_php_m3:
        number(
          form.proposed_tariff_php_m3
        ),

      /*
      | NO. 10
      | USER ASSUMPTION
      */
      demand_response_pct:
        number(
          form.demand_response_pct
        ),

      avg_household_income_php:
        number(
          form.avg_household_income_php
        ),

      low_income_monthly_income_php:
        number(
          form.low_income_monthly_income_php
        ),

      affordability_low_threshold_pct:
        number(
          form.affordability_low_threshold_pct
        ),

      affordability_high_threshold_pct:
        number(
          form.affordability_high_threshold_pct
        ),
    };

    setSaving(true);
    setError("");

    try {
      const data =
        await updateBarangay(
          psgcCode,
          payload
        );

      setRecord(data.record);
      setCalculated(
        data.calculated
      );
      setForm(data.record);

      onSaved?.(data);
    } catch (err) {
      setError(
        err?.message ||
          "Unable to save scenario."
      );
    } finally {
      setSaving(false);
    }
  }

  const affordability =
    calculated?.affordability;

  const demandResponse =
    calculated?.demand_response;

  const alerts = useMemo(
    () =>
      calculated?.alerts?.filter(
        (alert) =>
          alert.code?.includes(
            "AFFORDABILITY"
          ) ||
          alert.code ===
            "TARIFF_SHOCK" ||
          alert.code?.startsWith(
            "DEMAND_RESPONSE"
          )
      ) || [],
    [calculated]
  );

  if (!psgcCode) {
    return (
      <div className="tariff-empty">
        Select a barangay to edit
        tariff and demand assumptions.
      </div>
    );
  }

  if (
    loading ||
    !record
  ) {
    return (
      <div className="tariff-empty">
        Loading tariff and
        affordability data...
      </div>
    );
  }

  return (
    <div className="tariff-panel">
      <div className="tariff-head">
        <div>
          <span>
            TARIFF & AFFORDABILITY
          </span>

          <h3>
            {record.barangay}
          </h3>

          <p>
            {record.lgu}
            {" · "}
            Data version{" "}
            {record.data_version}
          </p>
        </div>

        <WalletCards
          size={20}
        />
      </div>

      {error && (
        <div className="tariff-error">
          {error}
        </div>
      )}

      <section className="tariff-section">
        <div className="tariff-section-title">
          Pricing Scenario
        </div>

        <div className="tariff-grid">
          <Field
            label="Current tariff"
            unit="₱/m³"
            value={
              form.tariff_php_m3
            }
            onChange={(value) =>
              setValue(
                "tariff_php_m3",
                value
              )
            }
          />

          <Field
            label="Proposed tariff"
            unit="₱/m³"
            value={
              form.proposed_tariff_php_m3
            }
            onChange={(value) =>
              setValue(
                "proposed_tariff_php_m3",
                value
              )
            }
          />

          <Field
            label="Monthly consumption"
            unit="m³"
            value={
              form.monthly_consumption_m3
            }
            onChange={(value) =>
              setValue(
                "monthly_consumption_m3",
                value
              )
            }
          />
        </div>
      </section>

      {/*
      |--------------------------------------------------------------------------
      | NO. 10 — DEMAND RESPONSE ASSUMPTION
      |--------------------------------------------------------------------------
      */}

      <section className="tariff-section demand-response-section">
        <div className="tariff-section-title">
          No. 10 · Demand-Response Assumption
        </div>

        <div className="demand-response-tag">
          USER ASSUMPTION
        </div>

        <Field
          label="Expected demand response"
          unit="%"
          value={
            form.demand_response_pct
          }
          min="-100"
          onChange={(value) =>
            setValue(
              "demand_response_pct",
              value
            )
          }
        />

        <div className="tariff-note">
          Do not assume that a 10%
          tariff increase causes a 10%
          demand decrease. Enter the
          response you want to test.
        </div>

        {demandResponse && (
          <div className="demand-response-results">
            <Metric
              label="Baseline demand"
              value={`${formatNumber(
                demandResponse
                  .baseline_demand_m3_day
              )} m³/day`}
            />

            <Metric
              label="Response"
              value={`${formatNumber(
                demandResponse
                  .expected_demand_response_pct
              )}%`}
              trend
            />

            <Metric
              label="Adjusted demand"
              value={`${formatNumber(
                demandResponse
                  .adjusted_demand_m3_day
              )} m³/day`}
            />

            <Metric
              label="Demand change"
              value={`${signed(
                demandResponse
                  .demand_change_m3_day
              )} m³/day`}
              trend
            />
          </div>
        )}

        <div className="demand-response-flow">
          Demand Response
          <span>→</span>
          Adjusted Demand
          <span>→</span>
          Deficit
          <span>→</span>
          Source Pressure
        </div>
      </section>

      <section className="tariff-section">
        <div className="tariff-section-title">
          Household Income
        </div>

        <div className="tariff-grid">
          <Field
            label="Average income"
            unit="₱/month"
            value={
              form.avg_household_income_php
            }
            onChange={(value) =>
              setValue(
                "avg_household_income_php",
                value
              )
            }
          />

          <Field
            label="Low-income reference"
            unit="₱/month"
            value={
              form.low_income_monthly_income_php
            }
            onChange={(value) =>
              setValue(
                "low_income_monthly_income_php",
                value
              )
            }
          />
        </div>
      </section>

      <section className="tariff-section">
        <div className="tariff-section-title">
          Policy Thresholds
        </div>

        <div className="tariff-grid">
          <Field
            label="Low below"
            unit="% burden"
            value={
              form.affordability_low_threshold_pct
            }
            onChange={(value) =>
              setValue(
                "affordability_low_threshold_pct",
                value
              )
            }
          />

          <Field
            label="High at / above"
            unit="% burden"
            value={
              form.affordability_high_threshold_pct
            }
            onChange={(value) =>
              setValue(
                "affordability_high_threshold_pct",
                value
              )
            }
          />
        </div>

        <div className="tariff-note">
          These are configurable
          policy thresholds, not
          universal affordability
          standards.
        </div>
      </section>

      {affordability && (
        <section className="tariff-results">
          <div className="tariff-results-head">
            <span>
              CALCULATED RESULT
            </span>

            <strong>
              {
                affordability
                  .affordability_class
              }
            </strong>
          </div>

          <div className="tariff-result-grid">
            <Metric
              label="Current bill"
              value={peso(
                affordability
                  .current_monthly_bill_php
              )}
            />

            <Metric
              label="Proposed bill"
              value={peso(
                affordability
                  .proposed_monthly_bill_php
              )}
            />

            <Metric
              label="Average burden"
              value={percent(
                affordability
                  .proposed_water_burden_pct
              )}
            />

            <Metric
              label="Low-income burden"
              value={percent(
                affordability
                  .low_income_water_burden_pct
              )}
            />

            <Metric
              label="Tariff change"
              value={percent(
                affordability
                  .tariff_change_pct
              )}
              trend
            />

            <Metric
              label="Adjusted household use"
              value={`${formatNumber(
                affordability
                  .adjusted_monthly_consumption_m3
              )} m³/mo`}
            />
          </div>
        </section>
      )}

      {alerts.length > 0 && (
        <section className="tariff-alert-section">
          <div className="tariff-section-title">
            <Bell size={14} />
            Automatic Alerts
          </div>

          {alerts.map(
            (alert) => (
              <div
                className={`tariff-alert ${
                  alert.severity
                }`}
                key={alert.code}
              >
                <div className="tariff-alert-icon">
                  <AlertTriangle
                    size={16}
                  />
                </div>

                <div>
                  <strong>
                    {alert.title}
                  </strong>

                  <p>
                    {alert.message}
                  </p>

                  {alert.ai_action && (
                    <span>
                      DULOY AI:{" "}
                      {
                        alert.ai_action
                      }
                    </span>
                  )}
                </div>

                {onAskDaloy && (
                  <button
                    type="button"
                    onClick={() =>
                      onAskDaloy(
                        `Explain this result: ${alert.title}. ${alert.message} What should we test next?`
                      )
                    }
                  >
                    <Sparkles
                      size={13}
                    />

                    Ask DULOY AI
                  </button>
                )}
              </div>
            )
          )}
        </section>
      )}

      <button
        className="tariff-save"
        type="button"
        disabled={saving}
        onClick={save}
      >
        <Save size={15} />

        {saving
          ? "Saving & recalculating..."
          : "Save Scenario"}
      </button>

      <div className="tariff-footnote">
        Saving updates the database,
        recalculates demand, deficit,
        source pressure, affordability,
        sector satisfaction and alerts,
        then makes the newest results
        available to DULOY AI.
      </div>
    </div>
  );
}

function Field({
  label,
  unit,
  value,
  onChange,
  min = "0",
}) {
  return (
    <label className="tariff-field">
      <span>
        {label}
      </span>

      <div>
        <input
          type="number"
          step="any"
          min={min}
          value={value ?? ""}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
        />

        <small>
          {unit}
        </small>
      </div>
    </label>
  );
}

function Metric({
  label,
  value,
  trend = false,
}) {
  const numeric =
    parseFloat(
      String(value).replace(
        /[^\d.-]/g,
        ""
      )
    ) || 0;

  return (
    <div className="tariff-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      {trend &&
        (
          numeric > 0
            ? (
              <TrendingUp
                size={12}
              />
            )
            : numeric < 0
              ? (
                <TrendingDown
                  size={12}
                />
              )
              : null
        )}
    </div>
  );
}

function number(value) {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function formatNumber(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "N/A";
  }

  return Number(
    value
  ).toLocaleString(
    undefined,
    {
      maximumFractionDigits: 2,
    }
  );
}

function signed(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "N/A";
  }

  const n =
    Number(value);

  return `${n > 0 ? "+" : ""}${formatNumber(
    n
  )}`;
}

function peso(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "N/A";
  }

  return `₱${formatNumber(
    value
  )}`;
}

function percent(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "N/A";
  }

  return `${formatNumber(
    value
  )}%`;
}
