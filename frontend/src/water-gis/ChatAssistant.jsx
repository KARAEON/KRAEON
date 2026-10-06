import { useState } from "react";
import {
  CircleHelp,
  FlaskConical,
  Scale,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  previewDaloyScenario,
} from "./scenarioPreviewApi";

import "./ChatAssistant.css";

const QUICK_ACTIONS = [
  {
    label: "Explain result",
    icon: CircleHelp,
    prompt:
      "Explain the most important current result and what it means for the water economy.",
  },
  {
    label: "Who is disadvantaged?",
    icon: TriangleAlert,
    prompt:
      "Who is currently disadvantaged or most exposed by the selected water allocation, affordability, or shortage conditions?",
  },
  {
    label: "Better value?",
    icon: Scale,
    prompt:
      "Which saved intervention gives better public value per peso, and why? Mention the main trade-off.",
  },
  {
    label: "What should I test?",
    icon: Sparkles,
    prompt:
      "What specific scenario should I test next? If appropriate, return one safe suggested scenario.",
  },
];

export default function ChatAssistant({
  outage,
  selectedBarangay,
}) {
  const [open, setOpen] =
    useState(false);

  const [input, setInput] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [previewing, setPreviewing] =
    useState(false);

  const [suggestion, setSuggestion] =
    useState(null);

  const [preview, setPreview] =
    useState(null);

  const [messages, setMessages] =
    useState([
      {
        role: "assistant",
        text:
          "Ask about water supply, affordability, allocation, interventions, value per peso, or what scenario to test next.",
      },
    ]);

  const send =
    async (
      questionOverride
    ) => {
      const q =
        (
          questionOverride ??
          input
        ).trim();

      if (!q || loading) {
        return;
      }

      const previousMessages =
        messages;

      setMessages(
        (previous) => [
          ...previous,
          {
            role: "user",
            text: q,
          },
        ]
      );

      setInput("");
      setLoading(true);
      setSuggestion(null);
      setPreview(null);

      try {
        const response =
          await fetch(
            "/api/ai/decision-chat",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json",
              },
              body:
                JSON.stringify({
                  message: q,
                  outage:
                    Boolean(outage),
                  history:
                    previousMessages
                      .slice(-8)
                      .map(
                        ({
                          role,
                          text,
                        }) => ({
                          role,
                          text,
                        })
                      ),
                  psgc_code:
                    selectedBarangay
                      ?.psgc_code ??
                    null,
                }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "DULOY AI request failed."
          );
        }

        setMessages(
          (previous) => [
            ...previous,
            {
              role: "assistant",
              text:
                data.reply ||
                formatRecommendation(
                  data.recommendation
                ),
            },
          ]
        );

        setSuggestion(
          data.suggested_scenario
          ?? null
        );
      } catch (error) {
        setMessages(
          (previous) => [
            ...previous,
            {
              role: "assistant",
              text:
                `Unable to contact DULOY AI: ${error.message}`,
            },
          ]
        );
      } finally {
        setLoading(false);
      }
    };

  async function trySuggestion() {
    if (
      !selectedBarangay
        ?.psgc_code ||
      !suggestion?.changes ||
      previewing
    ) {
      return;
    }

    setPreviewing(true);

    try {
      const data =
        await previewDaloyScenario(
          selectedBarangay
            .psgc_code,
          suggestion.changes
        );

      setPreview(data);
    } catch (error) {
      setMessages(
        (previous) => [
          ...previous,
          {
            role:
              "assistant",
            text:
              `Unable to preview the scenario: ${error.message}`,
          },
        ]
      );
    } finally {
      setPreviewing(false);
    }
  }

  const selectedName =
    selectedBarangay
      ? selectedBarangay
          .barangay
      : "Pilot Area";

  const selectedLgu =
    selectedBarangay
      ? selectedBarangay.lgu
      : "General Water Economy Context";

  return (
    <>
      {open && (
        <aside className="daloy-panel">
          <header className="daloy-header">
            <div className="daloy-brand">
              <div className="daloy-mark">
                <Sparkles
                  size={15}
                />
              </div>

              <div>
                <strong>
                  Ask DULOY AI
                </strong>
                <span>
                  Decision Assistant
                </span>
              </div>
            </div>

            <button
              type="button"
              className="daloy-close"
              onClick={() =>
                setOpen(false)
              }
            >
              <X size={15} />
            </button>
          </header>

          <div className="daloy-context">
            <div className="daloy-context-location">
              <span>
                {selectedName}
              </span>
              <small>
                {selectedLgu}
              </small>
            </div>

            <div className="daloy-context-badge">
              <span className="daloy-live-dot" />
              {selectedBarangay
                ? "Live context"
                : "General context"}
            </div>
          </div>

          <div className="daloy-messages">
            {messages.map(
              (
                message,
                index
              ) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`daloy-message-row ${message.role}`}
                >
                  {message.role ===
                    "assistant" && (
                    <div className="daloy-avatar">
                      <Sparkles
                        size={11}
                      />
                    </div>
                  )}

                  <div
                    className={`daloy-bubble ${message.role}`}
                  >
                    <FormattedMessage
                      text={
                        message.text
                      }
                    />
                  </div>
                </div>
              )
            )}

            {loading && (
              <div className="daloy-message-row assistant">
                <div className="daloy-avatar">
                  <Sparkles
                    size={11}
                  />
                </div>
                <div className="daloy-bubble assistant">
                  Analyzing calculated context...
                </div>
              </div>
            )}

            {suggestion &&
              selectedBarangay && (
              <div className="daloy-suggestion">
                <div>
                  <FlaskConical
                    size={14}
                  />
                  <strong>
                    {
                      suggestion.label
                    }
                  </strong>
                </div>

                <div className="daloy-change-list">
                  {Object.entries(
                    suggestion.changes
                  ).map(
                    ([
                      key,
                      value,
                    ]) => (
                      <span
                        key={key}
                      >
                        {prettyKey(
                          key
                        )}
                        :{" "}
                        <strong>
                          {value}
                        </strong>
                      </span>
                    )
                  )}
                </div>

                <button
                  type="button"
                  onClick={
                    trySuggestion
                  }
                  disabled={
                    previewing
                  }
                >
                  {previewing
                    ? "Calculating Preview..."
                    : "Try Suggested Scenario"}
                </button>

                <small>
                  Preview only. This
                  does not save or
                  apply changes.
                </small>
              </div>
            )}

            {preview && (
              <ScenarioPreview
                preview={
                  preview
                }
              />
            )}
          </div>

          <div className="daloy-tools">
            <div className="daloy-tools-label">
              Quick actions
            </div>

            <div className="daloy-quick-grid">
              {QUICK_ACTIONS.map(
                ({
                  label,
                  icon: Icon,
                  prompt,
                }) => (
                  <button
                    key={label}
                    type="button"
                    disabled={
                      loading
                    }
                    onClick={() =>
                      send(
                        prompt
                      )
                    }
                  >
                    <Icon
                      size={12}
                    />
                    <span>
                      {label}
                    </span>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="daloy-composer">
            <input
              value={input}
              placeholder={
                selectedBarangay
                  ? `Ask about ${selectedBarangay.barangay}...`
                  : "Ask DULOY AI..."
              }
              onChange={(
                event
              ) =>
                setInput(
                  event.target
                    .value
                )
              }
              onKeyDown={(
                event
              ) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  send();
                }
              }}
            />

            <button
              type="button"
              onClick={() =>
                send()
              }
              disabled={
                loading ||
                !input.trim()
              }
            >
              Send
            </button>
          </div>

          <div className="daloy-footer-note">
            Calculations happen first.
            DULOY AI explains and proposes
            tests. Suggested scenarios
            are previewed before any
            real change.
          </div>
        </aside>
      )}

      {!open && (
        <button
          type="button"
          className="daloy-launcher"
          onClick={() =>
            setOpen(true)
          }
        >
          <Sparkles
            size={15}
          />
          Ask DULOY AI
        </button>
      )}
    </>
  );
}

function ScenarioPreview({
  preview,
}) {
  const before =
    preview.before || {};

  const after =
    preview.after || {};

  return (
    <div className="daloy-preview">
      <div className="daloy-preview-head">
        CALCULATION PREVIEW
        <span>
          NOT SAVED
        </span>
      </div>

      <PreviewRow
        label="Deficit"
        before={
          before.deficit_m3_day
        }
        after={
          after.deficit_m3_day
        }
        unit="m³/day"
      />

      <PreviewRow
        label="Usable water"
        before={
          before.usable_water_m3_day
        }
        after={
          after.usable_water_m3_day
        }
        unit="m³/day"
      />

      <PreviewRow
        label="Source pressure"
        before={
          before.source_pressure_pct
        }
        after={
          after.source_pressure_pct
        }
        unit="%"
      />

      <PreviewRow
        label="NRW"
        before={
          before.nrw_rate_pct
        }
        after={
          after.nrw_rate_pct
        }
        unit="%"
      />

      <small>
        {preview.note}
      </small>
    </div>
  );
}

function PreviewRow({
  label,
  before,
  after,
  unit,
}) {
  return (
    <div className="daloy-preview-row">
      <span>
        {label}
      </span>

      <div>
        <del>
          {fmt(before)}
          {unit}
        </del>

        <strong>
          {fmt(after)}
          {unit}
        </strong>
      </div>
    </div>
  );
}

function formatRecommendation(
  recommendation
) {
  if (!recommendation) {
    return "";
  }

  return [
    recommendation
      .suggested_option
      ? `Suggested option: ${recommendation.suggested_option}`
      : null,

    ...(recommendation.why ||
      []).map(
      (item) =>
        `Why: ${item}`
    ),

    recommendation.tradeoff
      ? `Trade-off: ${recommendation.tradeoff}`
      : null,

    recommendation.next_test
      ? `Next test: ${recommendation.next_test}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function FormattedMessage({
  text,
}) {
  return (
    <div className="daloy-message-content">
      {String(text || "")
        .split(/\n+/)
        .filter(Boolean)
        .map(
          (
            line,
            index
          ) => (
            <div
              key={index}
              className="daloy-message-line"
            >
              {line}
            </div>
          )
        )}
    </div>
  );
}

function prettyKey(value) {
  return String(value)
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (c) =>
        c.toUpperCase()
    );
}

function fmt(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "N/A";
  }

  return Number(value)
    .toLocaleString(
      undefined,
      {
        maximumFractionDigits:
          2,
      }
    );
}
