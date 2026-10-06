import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  WalletCards,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  getAiDecisionSnapshot,
  getDecisionSnapshot,
} from "./decisionSnapshotApi";

import "./DecisionSnapshotPanel.css";

export default function DecisionSnapshotPanel({
  psgcCode,
}) {
  const [snapshot, setSnapshot] =
    useState(null);

  const [ai, setAi] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [aiLoading, setAiLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function load() {
    if (!psgcCode) {
      setSnapshot(null);
      setAi(null);
      return;
    }

    setLoading(true);
    setError("");
    setAi(null);

    try {
      const data =
        await getDecisionSnapshot(
          psgcCode
        );

      setSnapshot(
        data.snapshot
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load decision snapshot."
      );
    } finally {
      setLoading(false);
    }
  }

  async function rewriteWithDaloy() {
    if (
      !psgcCode ||
      aiLoading
    ) {
      return;
    }

    setAiLoading(true);
    setError("");

    try {
      const data =
        await getAiDecisionSnapshot(
          psgcCode
        );

      setSnapshot(
        data.snapshot
      );

      setAi(
        data.ai
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to generate DULOY AI insight."
      );
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [psgcCode]);

  if (!psgcCode) {
    return (
      <div className="snapshot-empty">
        Select a barangay to
        generate a Decision Snapshot.
      </div>
    );
  }

  if (
    loading ||
    !snapshot
  ) {
    return (
      <div className="snapshot-empty">
        Building Decision Snapshot...
      </div>
    );
  }

  const displayHeadline =
    ai?.headline ||
    snapshot
      .strongest_current_tradeoff;

  const displayWhy =
    ai?.why?.length
      ? ai.why
      : snapshot.why.map(
          (item) =>
            item.text
        );

  const displayTradeoff =
    ai?.tradeoff ||
    snapshot.tradeoff;

  const confidence =
    snapshot.confidence.label;

  return (
    <section className="snapshot-panel">
      <header className="snapshot-header">
        <div>
          <span>
            NO. 20 · DECISION SNAPSHOT
          </span>

          <h3>
            Current Decision Signal
          </h3>

          <p>
            {
              snapshot.barangay
            }
            {" · "}
            {snapshot.lgu}
          </p>
        </div>

        <BrainCircuit
          size={20}
        />
      </header>

      {error && (
        <div className="snapshot-error">
          {error}
        </div>
      )}

      <div className="snapshot-signal">
        <span>
          STRONGEST CURRENT
          TRADE-OFF
        </span>

        <strong>
          {displayHeadline}
        </strong>
      </div>

      <div className="snapshot-block">
        <div className="snapshot-block-title">
          <CheckCircle2
            size={13}
          />
          Why
        </div>

        <div className="snapshot-reasons">
          {displayWhy.length >
          0 ? (
            displayWhy.map(
              (
                reason,
                index
              ) => (
                <div
                  key={index}
                  className="snapshot-reason"
                >
                  <span>
                    {index + 1}
                  </span>

                  <p>
                    {reason}
                  </p>
                </div>
              )
            )
          ) : (
            <p className="snapshot-muted">
              Add project and scenario
              data to create stronger
              decision reasons.
            </p>
          )}
        </div>
      </div>

      <div className="snapshot-block snapshot-tradeoff">
        <div className="snapshot-block-title">
          <AlertTriangle
            size={13}
          />
          Trade-off
        </div>

        <p>
          {displayTradeoff}
        </p>
      </div>

      <div className="snapshot-confidence">
        <div>
          <span>
            Confidence
          </span>

          <strong>
            {confidence}
          </strong>
        </div>

        <p>
          {
            snapshot.confidence
              .basis
          }
        </p>
      </div>

      <div className="snapshot-actions">
        <button
          type="button"
          className="snapshot-refresh"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw
            size={13}
          />

          Refresh
        </button>

        <button
          type="button"
          className="snapshot-ai"
          onClick={
            rewriteWithDaloy
          }
          disabled={aiLoading}
        >
          <Sparkles
            size={13}
          />

          {aiLoading
            ? "DULOY AI is rewriting..."
            : ai
              ? "Rewrite Again"
              : "Rewrite with DULOY AI"}
        </button>
      </div>

      <div className="snapshot-rule">
        <WalletCards
          size={12}
        />

        <span>
          Calculation engine decides
          the structured result first.
          DULOY AI only rewrites and
          explains it.
        </span>
      </div>
    </section>
  );
}
