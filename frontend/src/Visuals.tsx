import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { ArrowUpRight, MapPin } from "lucide-react";
import { type Result, sectorColors, sectorNames } from "./engine/simulation";
import samar from "../public/samar.json";

type Feature = {
  type: "Feature";
  properties: Record<string, string>;
  geometry: GeoJSON.Geometry;
};
export function SamarMap({
  scope,
  onSelect,
  expanded = false,
}: {
  scope: string;
  onSelect: (s: string) => void;
  expanded?: boolean;
}) {
  const features = samar.features as unknown as Feature[],
    error = false;
  const [hover, setHover] = useState("");
  const path = useMemo(
    () =>
      geoPath(
        geoMercator().fitExtent(
          [
            [45, 14],
            [365, expanded ? 490 : 245],
          ],
          { type: "FeatureCollection", features },
        ),
      ),
    [features, expanded],
  );
  const name = (f: Feature) =>
    f.properties.NAME_2 || f.properties.ADM3_EN || f.properties.name || "";
  const active = (n: string) =>
    n.toLowerCase().includes("catbalogan")
      ? "catbalogan"
      : n.toLowerCase().includes("calbayog")
        ? "calbayog"
        : n.toLowerCase().includes("pinabacdao")
          ? "pinabacdao"
          : null;
  return (
    <div className={`map-visual ${expanded ? "expanded" : ""}`}>
      <div className="map-north">
        N<span>↑</span>
      </div>
      {error ? (
        <p className="map-error">
          Map could not load. Use the municipality selector above to continue.
        </p>
      ) : (
        <svg
          viewBox={`0 0 420 ${expanded ? 515 : 270}`}
          role="img"
          aria-label="Samar municipal boundaries. Three active pilot LGUs; all other areas excluded."
        >
          <text x="32" y={expanded ? 290 : 155} className="sea-label">
            Samar Sea
          </text>
          {features.map((f, i) => {
            const n = name(f),
              id = active(n),
              center = path.centroid(f);
            return (
              <g key={i}>
                <path
                  d={path(f) || ""}
                  fill={id ? (scope === id ? "#9a60e0" : "#cdb4ee") : "#E7E3E9"}
                  stroke="#F7F7F2"
                  strokeWidth="1.1"
                  onMouseEnter={() =>
                    setHover(id ? n : `${n} · excluded from simulation`)
                  }
                  onMouseLeave={() => setHover("")}
                  onClick={() => id && onSelect(id)}
                  tabIndex={id ? 0 : undefined}
                  role={id ? "button" : undefined}
                  aria-label={id ? `Select ${n}` : undefined}
                  onKeyDown={(e) => {
                    if (id && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onSelect(id);
                    }
                  }}
                  className={id ? "map-active" : ""}
                >
                  <title>
                    {n}
                    {id
                      ? " · active pilot"
                      : " · future expansion, excluded from simulation"}
                  </title>
                </path>
              </g>
            );
          })}
          {/* Labels are rendered last so neighbouring municipal polygons never cover them. */}
          {features.map((f, i) => {
            const id = active(name(f));
            if (!id) return null;
            const center = path.centroid(f);
            return (
              <g key={`label-${i}`} pointerEvents="none">
                <circle
                  cx={center[0]}
                  cy={center[1]}
                  r="4"
                  fill="#9a60e0"
                  stroke="white"
                  strokeWidth="2"
                />
                <text
                  x={center[0] + 9}
                  y={center[1] + 4}
                  className="map-label"
                >
                  {id === "catbalogan"
                    ? "Catbalogan"
                    : id === "calbayog"
                      ? "Calbayog"
                      : "Pinabacdao"}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      <div className="map-caption">
        {hover || "Samar Province · 3 pilot LGUs"}
      </div>
      <div className="legend">
        <span>
                  <i style={{ background: "#cdb4ee" }} />
          Active pilot
        </span>
        <span>
                  <i style={{ background: "#E7E3E9" }} />
          Future expansion
        </span>
      </div>
    </div>
  );
}
export function FlowDiagram({ result }: { result: Result }) {
  const labels = ["Surface water", "Springs & wells", "Supplementary"];
  const sourceTotals = [0, 0, 0];
  result.results.forEach((r) => {
    if (r.id === "catbalogan") {
      sourceTotals[0] += r.sourceOutputs[0];
      sourceTotals[1] += r.sourceOutputs[1];
    } else if (r.id === "calbayog") {
      sourceTotals[0] += r.sourceOutputs[0];
    } else {
      sourceTotals[1] += r.sourceOutputs.reduce((a, b) => a + b, 0);
    }
    sourceTotals[2] += Math.max(
      0,
      r.supply - r.sourceOutputs.reduce((a, b) => a + b, 0),
    );
  });
  const inputScale = 1.4,
    outputScale = 1.4;
  return (
    <div className="flow-diagram">
      <svg
        viewBox="0 0 710 240"
        role="img"
        aria-label="Water flow from sources through local utilities and storage to four demand sectors. Ribbon width represents ML per day."
      >
        <text x="8" y="20" className="flow-heading">
          Water sources
        </text>
        <text x="262" y="20" className="flow-heading">
          Local utilities & storage
        </text>
        <text x="557" y="20" className="flow-heading">
          Sector allocation
        </text>
        {sourceTotals.map((v, i) => (
          <g key={labels[i]}>
            <path
              d={`M 140 ${65 + i * 55} C 210 ${65 + i * 55}, 219 122, 290 122`}
              stroke={i === 2 ? "#cdb4ee" : "#9a60e0"}
              strokeWidth={Math.max(0, v * inputScale)}
              opacity=".34"
              fill="none"
            />
            <rect
              x="133"
              y={65 + i * 55 - Math.max(2, v * inputScale) / 2}
              width="5"
              height={Math.max(2, v * inputScale)}
              rx="2"
                fill="#9a60e0"
            />
            <text x="8" y={61 + i * 55} className="flow-label">
              {labels[i]}
            </text>
            <text x="8" y={78 + i * 55} className="flow-value">
              {v.toFixed(1)} ML/day
            </text>
          </g>
        ))}
        <rect
          x="289"
          y="66"
          width="102"
          height="122"
          rx="12"
          fill="#FAF9F7"
          stroke="#E7E3E9"
        />
        <path d="M333 93q-16 20-4 26 19 6 16-10Z" fill="#9a60e0" />
        <text x="340" y="146" textAnchor="middle" className="flow-total">
          {result.allocation.toFixed(1)}
        </text>
        <text x="340" y="164" textAnchor="middle" className="flow-value">
          ML/day allocated
        </text>
        {result.allocations.map((v, i) => (
          <g key={i}>
            <path
              d={`M391 125 C 465 125, 468 ${57 + i * 46}, 548 ${57 + i * 46}`}
              stroke={sectorColors[i]}
              strokeWidth={Math.max(0, v * outputScale)}
              opacity=".35"
              fill="none"
            />
            <rect
              x="548"
              y={57 + i * 46 - Math.max(2, v * outputScale) / 2}
              width="5"
              height={Math.max(2, v * outputScale)}
              fill={sectorColors[i]}
              rx="2"
            />
            <text x="563" y={53 + i * 46} className="flow-label">
              {sectorNames[i]}
            </text>
            <text x="563" y={70 + i * 46} className="flow-value">
              {v.toFixed(1)} ML/day
            </text>
          </g>
        ))}
      </svg>
      <p className="flow-note">
        Storage contribution:{" "}
        {Math.max(0, result.allocation - result.supply).toFixed(1)} ML over one
        day. Remaining storage: {result.ending.toFixed(1)} ML.
      </p>
    </div>
  );
}
export function SectionHeading({
  icon: Icon,
  title,
  detail,
  onClick,
  actionLabel,
  actionHref,
  actionLinkText,
}: {
  icon: typeof MapPin;
  title: string;
  detail?: string;
  onClick?: () => void;
  actionLabel?: string;
  actionHref?: string;
  actionLinkText?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <Icon size={16} />
        <h3>{title}</h3>
        {detail && <span>{detail}</span>}
      </div>
      {(onClick || actionHref) && (
        <div className="section-heading-actions">
          {actionHref && actionLinkText && (
            <a className="section-action-link" href={actionHref}>
              {actionLinkText}
              <ArrowUpRight size={14} />
            </a>
          )}
          {onClick && (
            <button
              className="icon-button"
              onClick={onClick}
              aria-label={actionLabel || `Expand ${title}`}
              title={actionLabel || `Expand ${title}`}
            >
              <ArrowUpRight size={17} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
