import { useEffect, useState } from "react";
import {
  FlaskConical,
  Maximize2,
  Minimize2,
  PanelRightOpen,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";

import {
  previewDaloyScenario,
} from "./scenarioPreviewApi";

import "./ChatAssistant.css";

export default function ChatAssistant({
  outage,
  selectedBarangay,
  workflowRequest,
}) {
  const [open, setOpen] =
    useState(false);

  const [panelSize, setPanelSize] =
    useState("compact");
  const [fontSize, setFontSize] = useState(() => {
    const saved = Number(window.localStorage.getItem("daloy-ai-font-size"));
    return Number.isFinite(saved) && saved >= 14 && saved <= 24 ? saved : 16;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [input, setInput] =
    useState("");
  const [pendingWorkflowContext, setPendingWorkflowContext] = useState(null);

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
          "Ask about population, watersheds, water supply, affordability, or what scenario to test next.",
      },
    ]);

  useEffect(() => {
    if (!workflowRequest) return;
    setOpen(true);
    setPanelSize("half");
    setInput(workflowRequest.prompt || "Explain these results.");
    setPendingWorkflowContext(workflowRequest.context || null);
  }, [workflowRequest?.id]);

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
                      .filter((message) => !message.isError)
                      .slice(-4)
                      .map(
                        ({
                          role,
                          text,
                        }) => ({
                          role,
                          text: text.slice(0, 600),
                        })
                      ),
                  psgc_code:
                    selectedBarangay
                      ?.psgc_code ??
                    null,
                  workflow_context: pendingWorkflowContext,
                }),
            }
          );

        const data =
          await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            data?.message ||
              (response.status === 429
                ? "The AI is busy right now. Please wait a moment and try again."
                : "The AI service is temporarily unavailable. Please try again shortly.")
          );
        }

        if (!data) {
          throw new Error("The AI did not return an answer. Please try again shortly.");
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
        setPendingWorkflowContext(null);
      } catch (error) {
        setMessages(
          (previous) => [
            ...previous,
            {
              role: "assistant",
              isError: true,
              text: error instanceof TypeError
                ? "I could not reach the server. Please check your connection and try again."
                : error.message,
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

  const nextPanelSize = {
    compact: "half",
    half: "full",
    full: "compact",
  }[panelSize];
  const panelSizeLabel = {
    compact: "Expand chat to half screen",
    half: "Expand chat to full screen",
    full: "Return chat to compact size",
  }[panelSize];
  const PanelSizeIcon = {
    compact: PanelRightOpen,
    half: Maximize2,
    full: Minimize2,
  }[panelSize];

  return (
    <>
      {open && (
        <aside className={`daloy-panel daloy-panel-${panelSize}`}>
          <header className="daloy-header">
            <div className="daloy-brand">
              <div className="daloy-mark">
                <Sparkles
                  size={15}
                />
              </div>

              <div>
                <strong>
                  Ask DALOY AI
                </strong>
                <span>
                  Decision Assistant
                </span>
              </div>
            </div>

            <div className="daloy-header-actions">
              <button
                type="button"
                className="daloy-panel-control"
                aria-label="DALOY AI settings"
                aria-expanded={settingsOpen}
                title="DALOY AI settings"
                onClick={() => setSettingsOpen((value) => !value)}
              >
                <Settings2 size={16} />
              </button>
              <button
                type="button"
                className="daloy-panel-control"
                aria-label={panelSizeLabel}
                title={panelSizeLabel}
                onClick={() => setPanelSize(nextPanelSize)}
              >
                <PanelSizeIcon size={16} />
              </button>
              <button
                type="button"
                className="daloy-close"
                aria-label="Close DALOY AI"
                title="Close DALOY AI"
                onClick={() => {
                  setSettingsOpen(false);
                  setOpen(false);
                }}
              >
                <X size={15} />
              </button>
            </div>
            {settingsOpen && (
              <div className="daloy-settings-popover" role="group" aria-label="DALOY AI text settings">
                <div className="daloy-settings-heading">
                  <label htmlFor="daloy-font-size">Message font size</label>
                  <output htmlFor="daloy-font-size">{fontSize}px</output>
                </div>
                <input
                  id="daloy-font-size"
                  type="range"
                  min="14"
                  max="24"
                  step="1"
                  value={fontSize}
                  aria-label="DALOY AI message font size"
                  onChange={(event) => {
                    const nextSize = Number(event.target.value);
                    setFontSize(nextSize);
                    window.localStorage.setItem("daloy-ai-font-size", String(nextSize));
                  }}
                />
                <div className="daloy-settings-range-labels"><span>Smaller</span><span>Larger</span></div>
              </div>
            )}
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
                    style={{ fontSize: `${fontSize}px` }}
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
                <div className="daloy-bubble assistant" style={{ fontSize: `${fontSize}px` }}>
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

          <div className="daloy-composer">
            <input
              value={input}
              placeholder={
                selectedBarangay
                  ? `Ask about ${selectedBarangay.barangay}...`
                  : "Ask DALOY AI..."
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
            DALOY AI explains and proposes
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
          Ask DALOY AI
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
