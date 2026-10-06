import {
  AlertTriangle,
  Droplets,
  Save,
  Sparkles,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  getNRWScenario,
  updateNRWScenario,
} from "./nrwApi";
import { subscribeToBarangayUpdates } from "./waterEconomyApi";

import "./NRWSimulatorPanel.css";

export default function NRWSimulatorPanel({
  psgcCode,
  onSaved,
  onAskDaloy,
}) {
  const [record, setRecord] =
    useState(null);

  const [nrw, setNrw] =
    useState(null);

  const [allocable, setAllocable] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  async function load() {
    if (!psgcCode) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data =
        await getNRWScenario(
          psgcCode
        );

      setRecord(data.record);
      setNrw(data.nrw);

      setAllocable(
        data.nrw
          ?.allocable_water_m3_day ??
        data.record
          ?.allocable_water_m3_day ??
        ""
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load NRW data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    return subscribeToBarangayUpdates(psgcCode, load);
  }, [psgcCode]);

  async function save() {
    if (
      !psgcCode ||
      saving
    ) {
      return;
    }

    const allocableValue =
      Number(allocable);

    if (
      !Number.isFinite(
        allocableValue
      ) ||
      allocableValue < 0
    ) {
      setError(
        "Allocable water must be 0 or greater."
      );

      return;
    }

    setSaving(true);
    setError("");

    try {
      const data =
        await updateNRWScenario(
          psgcCode,
          {
            allocable_water_m3_day:
              allocableValue,
          }
        );

      setRecord(data.record);
      setNrw(data.nrw);

      setAllocable(
        data.nrw
          ?.allocable_water_m3_day ??
        data.record
          ?.allocable_water_m3_day ??
        allocableValue
      );

      onSaved?.(data);
    } catch (err) {
      setError(
        err?.message ||
          "Unable to save NRW data."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!psgcCode) {
    return (
      <div className="nrw-empty">
        Select a barangay to view
        NRW data.
      </div>
    );
  }

  if (
    loading ||
    !record ||
    !nrw
  ) {
    return (
      <div className="nrw-empty">
        Loading NRW data...
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | CURRENT NRW COMPUTATION
  |--------------------------------------------------------------------------
  |
  | User enters allocable water.
  | NRW percentage comes from the barangay's current NRW rate.
  | NRW loss is calculated automatically.
  |
  */

  const allocableValue =
    Number(allocable) || 0;

  const nrwRate =
    Number(
      record?.nrw_rate_pct
    ) || 0;

  const nrwLoss =
    allocableValue *
    (nrwRate / 100);

  const usableWater =
    Math.max(
      0,
      allocableValue -
        nrwLoss
    );

  const alerts =
    nrw?.alerts || [];

  return (
    <div className="nrw-panel">
      <div className="nrw-head">
        <div>
          <span>
            NRW
          </span>

          <h3>
            {record.barangay}
          </h3>

          <p>
            {record.lgu}
            {" · "}
            Version{" "}
            {record.data_version}
          </p>
        </div>

        <Droplets size={20} />
      </div>

      {error && (
        <div className="nrw-error">
          {error}
        </div>
      )}

      <section className="nrw-input-section">
        <label>
          <span>
            Allocable water
          </span>

          <div>
            <input
              type="number"
              min="0"
              step="0.01"
              value={allocable}
              onChange={(event) =>
                setAllocable(
                  event.target.value
                )
              }
            />

            <small>
              m³/day
            </small>
          </div>
        </label>

        <p>
          NRW loss is calculated
          automatically using the
          current NRW percentage.
        </p>
      </section>

      <section className="nrw-visual">
        <div className="nrw-visual-title">
          Automatic Water Loss
        </div>

        <div className="nrw-pipe">
          <div
            className="nrw-loss"
            style={{
              width: `${Math.min(
                100,
                Math.max(
                  0,
                  nrwRate
                )
              )}%`,
            }}
          />
        </div>

        <div className="nrw-visual-row">
          <span>
            NRW Rate
          </span>

          <strong>
            {fmt(nrwRate)}%
          </strong>
        </div>
      </section>

      <section className="nrw-results">
        <Metric
          label="Allocable water"
          value={`${fmt(
            allocableValue
          )} m³/day`}
        />

        <Metric
          label="NRW rate"
          value={`${fmt(
            nrwRate
          )}%`}
        />

        <Metric
          label="NRW loss"
          value={`${fmt(
            nrwLoss
          )} m³/day`}
          loss
        />

        <Metric
          label="Usable water"
          value={`${fmt(
            usableWater
          )} m³/day`}
          highlight
        />
      </section>

      <div className="nrw-formula">
        <span>
          Automatic formula
        </span>

        <strong>
          NRW Loss =
          Allocable Water × NRW %
        </strong>

        <small>
          Usable Water =
          Allocable Water − NRW Loss
        </small>
      </div>

      {alerts.length > 0 && (
        <section className="nrw-alerts">
          <div className="nrw-section-title">
            Automatic Alerts
          </div>

          {alerts.map(
            (alert) => (
              <div
                className={`nrw-alert ${
                  alert.severity ||
                  "advisory"
                }`}
                key={alert.code}
              >
                <AlertTriangle
                  size={15}
                />

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
                        `Explain this NRW result: ${alert.title}. ${alert.message} What should we test next?`
                      )
                    }
                  >
                    <Sparkles
                      size={12}
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
        type="button"
        className="nrw-save"
        onClick={save}
        disabled={saving}
      >
        <Save size={15} />

        {saving
          ? "Saving & recalculating..."
          : "Save NRW Data"}
      </button>
    </div>
  );
}

function Metric({
  label,
  value,
  highlight = false,
  loss = false,
}) {
  return (
    <div
      className={[
        "nrw-metric",
        highlight
          ? "highlight"
          : "",
        loss
          ? "loss"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
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

function fmt(value) {
  return Number(
    value ?? 0
  ).toLocaleString(
    undefined,
    {
      maximumFractionDigits: 2,
    }
  );
}
